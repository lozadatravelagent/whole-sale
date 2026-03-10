import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// HOTELBEDS CACHE API SYNC
// ============================================================================
// Nightly batch job pulling from Hotels Cache API.
// Stores pre-computed rates for fast price estimates before hitting real-time
// availability. Designed for scheduled execution (nightly).
// ============================================================================

class HotelbedsCacheClient {
  private apiKey: string;
  private secret: string;
  private baseUrl: string;

  constructor(config: { apiKey: string; secret: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.secret = config.secret;
    this.baseUrl = config.baseUrl || 'https://api.test.hotelbeds.com';
  }

  private async generateSignature(): Promise<string> {
    const utcTimestamp = Math.floor(Date.now() / 1000);
    const raw = `${this.apiKey}${this.secret}${utcTimestamp}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const signature = await this.generateSignature();
    return {
      'Api-Key': this.apiKey,
      'X-Signature': signature,
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
    };
  }

  /**
   * Fetch cached availability from Hotels Cache API
   * This endpoint returns pre-computed rates for a destination.
   */
  async fetchCachedAvailability(params: {
    destinationCode: string;
    checkIn: string;
    checkOut: string;
    currency?: string;
    from?: number;
    to?: number;
  }): Promise<{ hotels: any[]; total: number }> {
    const query = new URLSearchParams();
    query.set('destinationCode', params.destinationCode);
    query.set('checkIn', params.checkIn);
    query.set('checkOut', params.checkOut);
    query.set('currency', params.currency || 'USD');
    query.set('from', String(params.from || 1));
    query.set('to', String(params.to || 200));

    const headers = await this.getHeaders();
    // Note: The actual endpoint path may vary based on Hotelbeds Cache API documentation
    const url = `${this.baseUrl}/hotel-api/1.0/hotels?${query}`;

    console.log(`[CACHE_SYNC] GET ${url}`);

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Cache API error (${response.status}): ${text}`);
    }

    const data = await response.json();
    return {
      hotels: data.hotels || [],
      total: data.total || 0,
    };
  }
}

// ============================================================================
// CORS & HANDLER
// ============================================================================

import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const HOTELBEDS_API_KEY = Deno.env.get('HOTELBEDS_API_KEY');
    const HOTELBEDS_SECRET = Deno.env.get('HOTELBEDS_SECRET');
    const HOTELBEDS_BASE_URL = Deno.env.get('HOTELBEDS_BASE_URL') || 'https://api.test.hotelbeds.com';

    if (!HOTELBEDS_API_KEY || !HOTELBEDS_SECRET) {
      throw new Error('Hotelbeds credentials not configured');
    }

    const client = new HotelbedsCacheClient({
      apiKey: HOTELBEDS_API_KEY,
      secret: HOTELBEDS_SECRET,
      baseUrl: HOTELBEDS_BASE_URL,
    });

    const { action, data } = await req.json();
    console.log(`[CACHE_SYNC] Action: ${action}`);

    let result;

    switch (action) {
      case 'syncCache': {
        // Sync cached rates for a destination and date range
        const { destinationCode, checkIn, checkOut, currency } = data;

        if (!destinationCode || !checkIn || !checkOut) {
          throw new Error('Missing required params: destinationCode, checkIn, checkOut');
        }

        const batchSize = 200;
        let from = 1;
        let totalSynced = 0;

        while (true) {
          const batch = await client.fetchCachedAvailability({
            destinationCode,
            checkIn,
            checkOut,
            currency: currency || 'USD',
            from,
            to: from + batchSize - 1,
          });

          if (batch.hotels.length === 0) break;

          // Map and upsert
          const rows = batch.hotels.map((hotel: any) => ({
            hotel_code: String(hotel.code),
            check_in: checkIn,
            check_out: checkOut,
            currency: hotel.currency || currency || 'USD',
            min_rate: parseFloat(hotel.minRate || '0'),
            max_rate: parseFloat(hotel.maxRate || '0'),
            room_count: hotel.rooms?.length || 0,
            updated_at: new Date().toISOString(),
          }));

          const { error } = await supabase
            .from('hotelbeds_cache')
            .upsert(rows, {
              onConflict: 'hotel_code,check_in,check_out,currency',
            });

          if (error) {
            console.error(`[CACHE_SYNC] Upsert error at batch ${from}:`, error);
          }

          totalSynced += rows.length;
          console.log(`[CACHE_SYNC] Synced ${totalSynced} hotel rates`);

          if (batch.hotels.length < batchSize) break;
          from += batchSize;
        }

        result = { totalSynced, destinationCode, checkIn, checkOut };
        break;
      }

      case 'cleanupStale': {
        // Remove cache entries older than N days
        const daysOld = data?.daysOld || 7;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysOld);

        const { data: deleted, error } = await supabase
          .from('hotelbeds_cache')
          .delete()
          .lt('updated_at', cutoff.toISOString())
          .select('hotel_code');

        if (error) {
          throw new Error(`Cleanup error: ${error.message}`);
        }

        result = { deleted: deleted?.length || 0, cutoff: cutoff.toISOString() };
        break;
      }

      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    return new Response(JSON.stringify({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[CACHE_SYNC] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
