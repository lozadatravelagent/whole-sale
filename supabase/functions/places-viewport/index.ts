import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { createLogger, extractCorrelationId } from '../_shared/logger.ts';
import { jsonResponse } from '../_shared/places/http.ts';
import { resetProviderCallCount, getProviderCallCount, getProviderCooldownRemaining } from '../_shared/places/foursquare.ts';
import { fetchViewportPlaces } from '../_shared/places/service.ts';
import type { PlacesViewportRequest, PlacesResponseMeta } from '../_shared/places/types.ts';

const ALLOWED_PLACE_CATEGORIES = new Set([
  'hotel',
  'restaurant',
  'cafe',
  'museum',
  'activity',
  'sights',
  'nightlife',
  'parks',
  'shopping',
  'culture',
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateLocation(value: unknown, label: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return `${label} must be an object`;
  }
  const location = value as { lat?: unknown; lng?: unknown };
  if (!isFiniteNumber(location.lat) || !isFiniteNumber(location.lng)) {
    return `${label}.lat and ${label}.lng must be finite numbers`;
  }
  return null;
}

function validatePlacesViewportRequest(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'body must be a JSON object';
  }
  const request = body as Partial<PlacesViewportRequest>;
  if (typeof request.city !== 'string' || request.city.trim() === '') {
    return 'city is required';
  }
  const locationError = validateLocation(request.location, 'location');
  if (locationError) return locationError;
  if (request.radius !== undefined && (!isFiniteNumber(request.radius) || request.radius <= 0)) {
    return 'radius must be a positive number when provided';
  }
  if (request.limit !== undefined && (!Number.isInteger(request.limit) || request.limit <= 0)) {
    return 'limit must be a positive integer when provided';
  }
  if (request.categories !== undefined) {
    if (!Array.isArray(request.categories)) return 'categories must be an array when provided';
    for (const category of request.categories) {
      if (typeof category !== 'string' || !ALLOWED_PLACE_CATEGORIES.has(category)) {
        return `unsupported category: ${String(category)}`;
      }
    }
  }
  if (request.searchPoints !== undefined) {
    if (!Array.isArray(request.searchPoints)) return 'searchPoints must be an array when provided';
    for (let i = 0; i < request.searchPoints.length; i += 1) {
      const point = request.searchPoints[i] as { location?: unknown; radius?: unknown };
      const pointLocationError = validateLocation(point?.location, `searchPoints[${i}].location`);
      if (pointLocationError) return pointLocationError;
      if (point.radius !== undefined && (!isFiniteNumber(point.radius) || point.radius <= 0)) {
        return `searchPoints[${i}].radius must be a positive number when provided`;
      }
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const requestId = extractCorrelationId(req);
  const logger = createLogger(requestId);

  // Reset per-invocation provider call counter
  resetProviderCallCount();

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { error: 'invalid_request_body', detail: 'body must be valid JSON', requestId }, 400);
    }
    const validationError = validatePlacesViewportRequest(body);
    if (validationError) {
      return jsonResponse(req, { error: 'invalid_request_body', detail: validationError, requestId }, 400);
    }
    const result = await fetchViewportPlaces(body as PlacesViewportRequest, logger);

    const providerCalls = getProviderCallCount();

    const meta: PlacesResponseMeta = {
      provider: 'foursquare',
      cacheStatus: result.cacheStatus,
      requestId,
      fallbackUsed: result.fallbackUsed,
      providerCalls,
    };

    const cooldownRemainingS = getProviderCooldownRemaining();
    return jsonResponse(req, { data: { ...result.data, providerCalls, cooldownRemainingS: cooldownRemainingS || undefined }, meta });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    logger.error('places.viewport.error', 'Failed to fetch viewport places', { message, provider_calls: getProviderCallCount(), cooldown_remaining_s: getProviderCooldownRemaining() });
    return jsonResponse(req, { error: message, requestId }, 400);
  }
});
