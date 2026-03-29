import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { createLogger, extractCorrelationId } from '../_shared/logger.ts';
import { jsonResponse } from '../_shared/places/http.ts';
import { fetchViewportPlaces } from '../_shared/places/service.ts';
import type { PlacesViewportRequest, PlacesResponseMeta } from '../_shared/places/types.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const requestId = extractCorrelationId(req);
  const logger = createLogger(requestId);

  try {
    const body = await req.json() as PlacesViewportRequest;
    const result = await fetchViewportPlaces(body, logger);

    const meta: PlacesResponseMeta = {
      provider: 'foursquare',
      cacheStatus: result.cacheStatus,
      requestId,
      fallbackUsed: result.fallbackUsed,
    };

    return jsonResponse(req, { data: result.data, meta });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    logger.error('places.viewport.error', 'Failed to fetch viewport places', { message });
    return jsonResponse(req, { error: message, requestId }, 400);
  }
});
