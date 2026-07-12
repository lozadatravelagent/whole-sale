/**
 * Delfos API adapter — search only (flights + hotels).
 * OAuth client credentials + ACL mappers to Wholesale canonical items.
 * Booking / price endpoints are intentionally NOT exposed.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { withRateLimit } from '../_shared/rateLimit.ts';
import { buildDelfosFlightSearchBody, buildDelfosHotelSearchBody } from './buildRequest.ts';
import { mapDelfosFlightOffers } from './mapFlights.ts';
import { mapDelfosHotelOffers } from './mapHotels.ts';
import { getDelfosAccessToken, clearDelfosTokenCache } from './oauth.ts';

const ALLOWED_ACTIONS = new Set(['searchFlights', 'searchHotels', 'health']);
const REQUEST_TIMEOUT_MS = 45_000;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function validationError(detail: string): Response {
  return jsonResponse(
    {
      success: false,
      error: 'invalid_request_body',
      detail,
      timestamp: new Date().toISOString(),
    },
    400,
  );
}

function getConfig() {
  const baseUrl = Deno.env.get('DELFOS_BASE_URL') || '';
  const clientId = Deno.env.get('DELFOS_CLIENT_ID') || '';
  const clientSecret = Deno.env.get('DELFOS_CLIENT_SECRET') || '';
  return { baseUrl, clientId, clientSecret };
}

async function delfosFetch(
  path: string,
  body: unknown,
  config: { baseUrl: string; clientId: string; clientSecret: string },
  requestId?: string,
): Promise<{ ok: true; data: any } | { ok: false; status: number; code: string; message: string }> {
  const base = config.baseUrl.replace(/\/$/, '');
  const url = `${base}${path}`;

  const doRequest = async (token: string) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (requestId) headers['X-Request-ID'] = requestId;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 300) };
    }
    return { response, json, text };
  };

  let token = await getDelfosAccessToken(config);
  let { response, json, text } = await doRequest(token.accessToken);

  if (response.status === 401) {
    clearDelfosTokenCache();
    token = await getDelfosAccessToken({ ...config, forceRefresh: true });
    ({ response, json, text } = await doRequest(token.accessToken));
  }

  if (!response.ok) {
    const code =
      response.status === 503
        ? 'provider.unavailable'
        : response.status === 504
          ? 'provider.timeout'
          : response.status === 401 || response.status === 403
            ? 'DELFOS_AUTH'
            : json?.code || 'delfos_error';
    const message =
      json?.detail || json?.title || text.slice(0, 200) || `Delfos HTTP ${response.status}`;
    console.error('[DELFOS] upstream error', {
      path,
      status: response.status,
      code,
      message,
      problemCode: json?.code,
      instance: json?.instance,
    });
    return {
      ok: false,
      status: response.status,
      code,
      message,
    };
  }

  return { ok: true, data: json };
}

/** Defensive extract — public contract is data.offers; tolerate alternates. */
function extractOffers(payload: any): any[] {
  if (Array.isArray(payload?.data?.offers)) return payload.data.offers;
  if (Array.isArray(payload?.offers)) return payload.offers;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

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
    { action: 'search', resource: 'delfos-api' },
    async () => {
      try {
        if (req.method !== 'POST') {
          return jsonResponse({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405);
        }

        let body: any;
        try {
          body = await req.json();
        } catch {
          return validationError('body must be valid JSON');
        }

        const action = String(body?.action || '');
        if (!ALLOWED_ACTIONS.has(action)) {
          return validationError(`unsupported action: ${action || '(empty)'}`);
        }

        const requestId =
          typeof body.request_id === 'string'
            ? body.request_id
            : req.headers.get('x-request-id') || undefined;

        if (action === 'health') {
          const config = getConfig();
          return jsonResponse({
            success: true,
            action: 'health',
            provider: 'DELFOS',
            configured: Boolean(config.baseUrl && config.clientId && config.clientSecret),
            searchOnly: true,
            timestamp: new Date().toISOString(),
          });
        }

        const config = getConfig();
        if (!config.baseUrl || !config.clientId || !config.clientSecret) {
          return jsonResponse(
            {
              success: false,
              error: 'DELFOS_NOT_CONFIGURED',
              detail: 'DELFOS_BASE_URL, DELFOS_CLIENT_ID and DELFOS_CLIENT_SECRET are required',
              provider: 'DELFOS',
            },
            503,
          );
        }

        if (action === 'searchFlights') {
          const data = body.data && typeof body.data === 'object' ? body.data : {};
          const built = buildDelfosFlightSearchBody(data);
          if (!built.ok) {
            const status = built.code === 'UNSUPPORTED_ITINERARY' ? 422 : 400;
            return jsonResponse(
              {
                success: false,
                code: built.code,
                error: built.code,
                detail: built.message,
                provider: 'DELFOS',
                skipped: built.code === 'UNSUPPORTED_ITINERARY',
              },
              status,
            );
          }

          console.log('[DELFOS] searchFlights', JSON.stringify(built.body));
          const result = await delfosFetch('/v1/flights/search', built.body, config, requestId);
          if (!result.ok) {
            console.error('[DELFOS] searchFlights failed', {
              status: result.status,
              code: result.code,
              detail: result.message,
            });
            return jsonResponse(
              {
                success: false,
                error: result.code,
                detail: result.message,
                provider: 'DELFOS',
                status: result.status,
              },
              result.status >= 400 && result.status < 600 ? result.status : 502,
            );
          }

          const offers = extractOffers(result.data);
          const mapped = mapDelfosFlightOffers(offers, built.ctx);
          const rawKeys =
            result.data && typeof result.data === 'object' ? Object.keys(result.data) : [];
          console.log('[DELFOS] searchFlights ok', {
            raw_count: offers.length,
            mapped_count: mapped.length,
            meta_count: result.data?.meta?.count,
            response_keys: rawKeys,
            sample_offer_id: offers[0]?.offer_id || null,
          });
          if (offers.length === 0) {
            console.warn('[DELFOS] searchFlights empty offers from upstream', {
              meta: result.data?.meta ?? null,
              response_keys: rawKeys,
            });
          }
          return jsonResponse({
            success: true,
            action: 'searchFlights',
            provider: 'DELFOS',
            results: mapped,
            meta: {
              count: mapped.length,
              source_provider: result.data?.meta?.provider || 'lleego',
              raw_count: Array.isArray(offers) ? offers.length : 0,
            },
            timestamp: new Date().toISOString(),
          });
        }

        if (action === 'searchHotels') {
          const data = body.data && typeof body.data === 'object' ? body.data : {};
          const built = buildDelfosHotelSearchBody(data);
          if (!built.ok) {
            return jsonResponse(
              {
                success: false,
                code: built.code,
                error: built.code,
                detail: built.message,
                provider: 'DELFOS',
              },
              400,
            );
          }

          console.log('[DELFOS] searchHotels', JSON.stringify(built.body));
          const result = await delfosFetch('/v1/hotels/search', built.body, config, requestId);
          if (!result.ok) {
            console.error('[DELFOS] searchHotels failed', {
              status: result.status,
              code: result.code,
              detail: result.message,
            });
            return jsonResponse(
              {
                success: false,
                error: result.code,
                detail: result.message,
                provider: 'DELFOS',
                status: result.status,
              },
              result.status >= 400 && result.status < 600 ? result.status : 502,
            );
          }

          const offers = extractOffers(result.data);
          const mapped = mapDelfosHotelOffers(offers, built.ctx);
          console.log('[DELFOS] searchHotels ok', {
            raw_count: offers.length,
            mapped_count: mapped.length,
            meta_count: result.data?.meta?.count,
            hotels_searched: result.data?.meta?.hotels_searched,
          });
          return jsonResponse({
            success: true,
            action: 'searchHotels',
            provider: 'DELFOS',
            results: mapped,
            meta: {
              count: mapped.length,
              source_provider: 'dingus',
              raw_count: Array.isArray(offers) ? offers.length : 0,
              hotels_searched: result.data?.meta?.hotels_searched,
            },
            timestamp: new Date().toISOString(),
          });
        }

        return validationError(`unsupported action: ${action}`);
      } catch (error) {
        console.error('[DELFOS] error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResponse(
          {
            success: false,
            error: 'DELFOS_INTERNAL',
            detail: message,
            provider: 'DELFOS',
          },
          500,
        );
      }
    },
  );
});
