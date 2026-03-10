import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rateLimit.ts";

// ============================================================================
// HOTELBEDS TRANSFERS API CLIENT
// ============================================================================

class HotelbedsTransfersClient {
  private apiKey: string;
  private secret: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: {
    apiKey: string;
    secret: string;
    baseUrl?: string;
    timeout?: number;
  }) {
    this.apiKey = config.apiKey;
    this.secret = config.secret;
    this.baseUrl = config.baseUrl || 'https://api.test.hotelbeds.com';
    this.timeout = config.timeout || 30000;
  }

  private async generateSignature(): Promise<string> {
    const utcTimestamp = Math.floor(Date.now() / 1000);
    const raw = `${this.apiKey}${this.secret}${utcTimestamp}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const signature = await this.generateSignature();
    return {
      'Api-Key': this.apiKey,
      'X-Signature': signature,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip',
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = await this.getHeaders();

    console.log(`[HB_TRANSFERS] ${method} ${path}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    });

    const text = await response.text();
    if (!response.ok) {
      let detail: any;
      try { detail = JSON.parse(text); } catch { detail = { raw: text }; }
      console.error(`[HB_TRANSFERS] Error ${response.status}:`, detail);
      throw new Error(`Transfers API error (${response.status}): ${detail?.error?.message || response.statusText}`);
    }

    return JSON.parse(text) as T;
  }

  /**
   * Search available transfers
   * POST /transfer-api/1.0/availability
   */
  async searchAvailability(params: {
    language: string;
    fromType: string;
    fromCode: string;
    toType: string;
    toCode: string;
    outbound: string; // ISO date
    inbound?: string; // ISO date (for round trip)
    adults: number;
    children: number;
    infants: number;
  }): Promise<any> {
    return await this.request<any>('POST', '/transfer-api/1.0/availability', params);
  }

  /**
   * Search transfers and map to TransferData format
   */
  async searchTransfers(params: {
    fromType: string;
    fromCode: string;
    toType: string;
    toCode: string;
    outboundDate: string;
    inboundDate?: string;
    adults?: number;
    children?: number;
    infants?: number;
  }): Promise<{ results: any[]; total: number }> {
    const direction = params.inboundDate ? 'ROUND_TRIP' : 'ARRIVAL';

    try {
      const response = await this.searchAvailability({
        language: 'en',
        fromType: params.fromType,
        fromCode: params.fromCode,
        toType: params.toType,
        toCode: params.toCode,
        outbound: params.outboundDate,
        inbound: params.inboundDate,
        adults: params.adults || 2,
        children: params.children || 0,
        infants: params.infants || 0,
      });

      const services = (response.services || []).map((service: any) => {
        const transferType = service.transferType?.toUpperCase() || 'SHARED';
        const vehicle = service.vehicle?.name || service.category?.name || 'Standard Vehicle';
        const price = service.price || {};

        return {
          id: `HB-TRF-${service.id || Math.random().toString(36).slice(2)}`,
          provider: 'HOTELBEDS',
          type: transferType === 'PRIVATE' ? 'PRIVATE' :
                transferType === 'LUXURY' ? 'LUXURY' : 'SHARED',
          direction: direction as 'ARRIVAL' | 'DEPARTURE' | 'ROUND_TRIP',
          vehicle,
          maxPassengers: service.vehicle?.maxPax || service.maxPaxCapacity || 0,
          price: {
            amount: parseFloat(price.totalAmount || price.amount || '0'),
            currency: price.currencyId || 'USD',
          },
          pickup: {
            location: service.pickupInformation?.from?.description || params.fromCode,
            time: service.pickupInformation?.time || undefined,
          },
          dropoff: {
            location: service.pickupInformation?.to?.description || params.toCode,
          },
          cancellationPolicy: service.cancellationPolicies?.[0]
            ? `Free cancellation until ${new Date(service.cancellationPolicies[0].from).toLocaleDateString('en-US')}`
            : undefined,
        };
      });

      return { results: services, total: services.length };
    } catch (error) {
      console.error('[HB_TRANSFERS] searchTransfers failed:', error);
      throw error;
    }
  }
}

// ============================================================================
// CORS HEADERS
// ============================================================================

import { corsHeaders } from '../_shared/cors.ts';

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  return await withRateLimit(
    req,
    supabase,
    { action: 'search', resource: 'hotelbeds-transfers' },
    async () => {
      try {
        const HOTELBEDS_API_KEY = Deno.env.get('HOTELBEDS_API_KEY');
        const HOTELBEDS_SECRET = Deno.env.get('HOTELBEDS_SECRET');
        const HOTELBEDS_BASE_URL = Deno.env.get('HOTELBEDS_BASE_URL') || 'https://api.test.hotelbeds.com';

        if (!HOTELBEDS_API_KEY || !HOTELBEDS_SECRET) {
          throw new Error('Hotelbeds credentials not configured');
        }

        const client = new HotelbedsTransfersClient({
          apiKey: HOTELBEDS_API_KEY,
          secret: HOTELBEDS_SECRET,
          baseUrl: HOTELBEDS_BASE_URL,
        });

        const { action, data } = await req.json();
        console.log(`[HB_TRANSFERS] Action: ${action}`);

        let result;

        switch (action) {
          case 'searchTransfers':
            result = await client.searchTransfers(data);
            break;

          case 'searchAvailability':
            result = await client.searchAvailability(data);
            break;

          default:
            throw new Error(`Unsupported action: ${action}`);
        }

        return new Response(JSON.stringify({
          success: true,
          data: result,
          provider: 'HOTELBEDS',
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('[HB_TRANSFERS] Error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Internal server error',
          provider: 'HOTELBEDS',
          timestamp: new Date().toISOString(),
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
  );
});
