import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rateLimit.ts";

// ============================================================================
// HOTELBEDS ACTIVITIES API CLIENT
// ============================================================================

class HotelbedsActivitiesClient {
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

    console.log(`[HB_ACTIVITIES] ${method} ${path}`);

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
      console.error(`[HB_ACTIVITIES] Error ${response.status}:`, detail);
      throw new Error(`Activities API error (${response.status}): ${detail?.error?.message || response.statusText}`);
    }

    return JSON.parse(text) as T;
  }

  /**
   * Search available activities
   * POST /activity-api/3.0/activities/availability
   */
  async searchAvailability(params: {
    destination: string;
    dateFrom: string;
    dateTo: string;
    language?: string;
    paxes?: Array<{ age: number }>;
  }): Promise<any> {
    const body = {
      filters: [{
        searchFilterItems: [{
          type: 'destination',
          value: params.destination,
        }],
      }],
      from: params.dateFrom,
      to: params.dateTo,
      language: params.language || 'en',
      paxes: params.paxes || [{ age: 30 }, { age: 30 }],
    };

    return await this.request<any>('POST', '/activity-api/3.0/activities/availability', body);
  }

  /**
   * Get activity content/details
   * GET /activity-content-api/3.0/activities
   */
  async getContent(params: {
    codes?: string[];
    destinationCode?: string;
    language?: string;
    from?: number;
    to?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params.codes) queryParams.set('codes', params.codes.join(','));
    if (params.destinationCode) queryParams.set('destinationCode', params.destinationCode);
    queryParams.set('language', params.language || 'en');
    queryParams.set('from', String(params.from || 1));
    queryParams.set('to', String(params.to || 20));

    return await this.request<any>('GET', `/activity-content-api/3.0/activities?${queryParams}`);
  }

  /**
   * Search activities and map to ActivityData format
   */
  async searchActivities(params: {
    destination: string;
    dateFrom: string;
    dateTo: string;
    adults?: number;
    children?: number;
    childrenAges?: number[];
  }): Promise<{ results: any[]; total: number }> {
    const paxes: Array<{ age: number }> = [];
    for (let i = 0; i < (params.adults || 2); i++) {
      paxes.push({ age: 30 });
    }
    for (const age of (params.childrenAges || [])) {
      paxes.push({ age });
    }

    try {
      const response = await this.searchAvailability({
        destination: params.destination,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        paxes,
      });

      const activities = (response.activities || []).map((activity: any) => ({
        id: `HB-ACT-${activity.code}`,
        provider: 'HOTELBEDS',
        name: activity.name || `Activity ${activity.code}`,
        description: activity.content?.description || '',
        city: params.destination,
        images: (activity.content?.media?.images || []).map((img: any) =>
          img.urls?.[0]?.resource || ''
        ).filter(Boolean),
        duration: activity.content?.duration?.value
          ? `${activity.content.duration.value} ${activity.content.duration.metric || 'hours'}`
          : undefined,
        price: {
          amount: activity.amountFrom || 0,
          currency: activity.currency || 'USD',
          priceFrom: true,
        },
        categories: (activity.content?.segmentationGroups || []).flatMap(
          (g: any) => (g.segments || []).map((s: any) => s.name)
        ),
        modalities: (activity.modalities || []).map((mod: any) => ({
          code: mod.code,
          name: mod.name,
          rate: mod.amountFrom || 0,
          currency: activity.currency || 'USD',
        })),
        operationDates: activity.operationDates?.[0]
          ? { from: activity.operationDates[0].from, to: activity.operationDates[0].to }
          : undefined,
        cancellationPolicy: activity.content?.featureGroups?.find(
          (g: any) => g.groupCode === 'CANCEL'
        )?.features?.[0]?.description || undefined,
      }));

      return { results: activities, total: activities.length };
    } catch (error) {
      console.error('[HB_ACTIVITIES] searchActivities failed:', error);
      throw error;
    }
  }
}

// ============================================================================
// CORS HEADERS
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

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
    { action: 'search', resource: 'hotelbeds-activities' },
    async () => {
      try {
        const HOTELBEDS_API_KEY = Deno.env.get('HOTELBEDS_API_KEY');
        const HOTELBEDS_SECRET = Deno.env.get('HOTELBEDS_SECRET');
        const HOTELBEDS_BASE_URL = Deno.env.get('HOTELBEDS_BASE_URL') || 'https://api.test.hotelbeds.com';

        if (!HOTELBEDS_API_KEY || !HOTELBEDS_SECRET) {
          throw new Error('Hotelbeds credentials not configured');
        }

        const client = new HotelbedsActivitiesClient({
          apiKey: HOTELBEDS_API_KEY,
          secret: HOTELBEDS_SECRET,
          baseUrl: HOTELBEDS_BASE_URL,
        });

        const { action, data } = await req.json();
        console.log(`[HB_ACTIVITIES] Action: ${action}`);

        let result;

        switch (action) {
          case 'searchActivities':
            result = await client.searchActivities(data);
            break;

          case 'searchAvailability':
            result = await client.searchAvailability(data);
            break;

          case 'getContent':
            result = await client.getContent(data);
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
        console.error('[HB_ACTIVITIES] Error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
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
