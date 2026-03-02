import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// HOTELBEDS CONTENT API SYNC
// ============================================================================
// Batch pulls hotel content from Hotelbeds Content API and upserts into
// hotelbeds_hotels table. Designed for scheduled execution:
// - Weekly: full sync
// - Daily: delta via lastUpdateTime parameter
// ============================================================================

class HotelbedsContentClient {
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
   * Fetch hotels from Content API with pagination
   * GET /hotel-content-api/1.0/hotels
   */
  async fetchHotels(params: {
    from?: number;
    to?: number;
    destinationCode?: string;
    lastUpdateTime?: string; // ISO date for delta sync
    language?: string;
  }): Promise<{ hotels: any[]; total: number }> {
    const query = new URLSearchParams();
    query.set('from', String(params.from || 1));
    query.set('to', String(params.to || 100));
    query.set('language', params.language || 'ENG');
    if (params.destinationCode) query.set('destinationCode', params.destinationCode);
    if (params.lastUpdateTime) query.set('lastUpdateTime', params.lastUpdateTime);

    const headers = await this.getHeaders();
    const url = `${this.baseUrl}/hotel-content-api/1.0/hotels?${query}`;

    console.log(`[CONTENT_SYNC] GET ${url}`);

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Content API error (${response.status}): ${text}`);
    }

    const data = await response.json();
    return {
      hotels: data.hotels || [],
      total: data.total || 0,
    };
  }

  /**
   * Fetch destinations from Content API
   * GET /hotel-content-api/1.0/locations/destinations
   */
  async fetchDestinations(params: {
    from?: number;
    to?: number;
    language?: string;
  }): Promise<{ destinations: any[]; total: number }> {
    const query = new URLSearchParams();
    query.set('from', String(params.from || 1));
    query.set('to', String(params.to || 1000));
    query.set('language', params.language || 'ENG');

    const headers = await this.getHeaders();
    const url = `${this.baseUrl}/hotel-content-api/1.0/locations/destinations?${query}`;

    console.log(`[CONTENT_SYNC] GET ${url}`);

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Content API error (${response.status}): ${text}`);
    }

    const data = await response.json();
    return {
      destinations: data.destinations || [],
      total: data.total || 0,
    };
  }
}

// ============================================================================
// CORS & HANDLER
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

    const client = new HotelbedsContentClient({
      apiKey: HOTELBEDS_API_KEY,
      secret: HOTELBEDS_SECRET,
      baseUrl: HOTELBEDS_BASE_URL,
    });

    const { action, data } = await req.json();
    console.log(`[CONTENT_SYNC] Action: ${action}`);

    let result;

    switch (action) {
      case 'syncHotels': {
        // Paginated hotel sync
        const batchSize = data?.batchSize || 100;
        const lastUpdateTime = data?.lastUpdateTime;
        const destinationCode = data?.destinationCode;
        let from = data?.from || 1;
        let totalSynced = 0;

        while (true) {
          const batch = await client.fetchHotels({
            from,
            to: from + batchSize - 1,
            destinationCode,
            lastUpdateTime,
          });

          if (batch.hotels.length === 0) break;

          // Upsert batch into database
          const rows = batch.hotels.map((hotel: any) => ({
            code: String(hotel.code),
            name: hotel.name?.content || hotel.name,
            description: hotel.description?.content || '',
            category_code: hotel.categoryCode,
            destination_code: hotel.destinationCode,
            city: hotel.city?.content || '',
            country: hotel.countryCode,
            latitude: hotel.coordinates?.latitude || null,
            longitude: hotel.coordinates?.longitude || null,
            images: hotel.images || [],
            facilities: hotel.facilities || [],
            address: hotel.address?.content || '',
            web: hotel.web || '',
            updated_at: new Date().toISOString(),
          }));

          const { error } = await supabase
            .from('hotelbeds_hotels')
            .upsert(rows, { onConflict: 'code' });

          if (error) {
            console.error(`[CONTENT_SYNC] Upsert error at batch ${from}:`, error);
          }

          totalSynced += rows.length;
          console.log(`[CONTENT_SYNC] Synced ${totalSynced} hotels (batch from ${from})`);

          if (batch.hotels.length < batchSize) break;
          from += batchSize;
        }

        result = { totalSynced, message: `Synced ${totalSynced} hotels` };
        break;
      }

      case 'syncDestinations': {
        const batchSize = data?.batchSize || 1000;
        let from = 1;
        let totalSynced = 0;

        while (true) {
          const batch = await client.fetchDestinations({ from, to: from + batchSize - 1 });
          if (batch.destinations.length === 0) break;

          const rows = batch.destinations.map((dest: any) => ({
            code: dest.code,
            name: dest.name?.content || dest.name,
            country_code: dest.countryCode,
          }));

          const { error } = await supabase
            .from('hotelbeds_destinations')
            .upsert(rows, { onConflict: 'code' });

          if (error) {
            console.error(`[CONTENT_SYNC] Destination upsert error:`, error);
          }

          totalSynced += rows.length;
          if (batch.destinations.length < batchSize) break;
          from += batchSize;
        }

        result = { totalSynced, message: `Synced ${totalSynced} destinations` };
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
    console.error('[CONTENT_SYNC] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
