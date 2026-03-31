import { supabase } from '@/integrations/supabase/client';
import { placesCache, cacheKeys } from './placesCache';
import type {
  PlannerPlaceCandidate,
  PlannerPlaceCategory,
  PlannerPlaceHotelCandidate,
} from '../types';

export interface PlaceReview {
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
}

export interface PlaceDetails {
  placeId: string;
  source?: 'foursquare' | 'wikipedia' | 'inventory';
  name: string;
  formattedAddress?: string;
  rating?: number;
  userRatingsTotal?: number;
  website?: string;
  phoneNumber?: string;
  openingHours?: string[];
  isOpenNow?: boolean;
  photoUrls: string[];
  reviewSnippet?: string;
  reviews?: PlaceReview[];
  types?: string[];
  freshness?: string;
}

export interface PlaceRecommendationGroup {
  city: string;
  places: PlannerPlaceCandidate[];
}

interface PlaceDetailsLookup {
  placeId?: string;
  title: string;
  city: string;
  locationBias?: { lat: number; lng: number };
}

interface FunctionResponse<T> {
  data?: T;
  error?: string;
}

const FAILED_REQUEST_TTL_MS = 2 * 60 * 1000;
const failedRequestCooldown = new Map<string, number>();
const inFlightRequests = new Map<string, Promise<unknown>>();

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${key}:${stableStringify(nested)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function requestKey(functionName: string, params: unknown): string {
  return `${functionName}::${stableStringify(params)}`;
}

function requestRecentlyFailed(key: string): boolean {
  const timestamp = failedRequestCooldown.get(key);
  if (!timestamp) return false;

  if (Date.now() - timestamp < FAILED_REQUEST_TTL_MS) {
    return true;
  }

  failedRequestCooldown.delete(key);
  return false;
}

async function invokePlacesFunction<T>(
  functionName: string,
  payload: unknown,
): Promise<T | null> {
  const key = requestKey(functionName, payload);

  if (requestRecentlyFailed(key)) {
    return null;
  }

  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T | null>;
  }

  const request = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
      });

      const response = (data || {}) as FunctionResponse<T>;

      if (error || response.error) {
        failedRequestCooldown.set(key, Date.now());
        return null;
      }

      failedRequestCooldown.delete(key);
      return (response.data ?? null) as T | null;
    } catch {
      failedRequestCooldown.set(key, Date.now());
      return null;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, request as Promise<unknown>);
  return request;
}

function buildHotelsCacheKey(city: string, hotels: Array<{ name: string; hotel_id?: string }>, limit: number): string {
  return cacheKeys.geocoding(
    `hotels::${city}::${limit}::${hotels
      .map((hotel) => hotel.hotel_id || hotel.name)
      .join('::')}`,
  );
}

function isLikelyFoursquareVenueId(value?: string): boolean {
  return /^[0-9a-f]{24}$/i.test((value || '').trim());
}

type NearbyCategory = PlannerPlaceCategory;

export async function fetchNearbyPlacesBundle(
  city: string,
  location: { lat: number; lng: number },
  categories: NearbyCategory[] = ['restaurant', 'cafe', 'museum', 'activity'],
): Promise<Record<string, PlannerPlaceCandidate[]>> {
  const requestedCategories = Array.from(new Set(categories));
  const results: Record<string, PlannerPlaceCandidate[]> = {};
  const missingCategories: NearbyCategory[] = [];

  await Promise.all(requestedCategories.map(async (category) => {
    const key = cacheKeys.nearby(city, category, 2500);
    const cached = await placesCache.get<PlannerPlaceCandidate[]>('nearby', key);

    if (cached) {
      results[category] = cached;
      return;
    }

    missingCategories.push(category);
  }));

  if (missingCategories.length > 0) {
    const response = await invokePlacesFunction<{ placesByCategory?: Record<string, PlannerPlaceCandidate[]> }>('places-viewport', {
      city,
      location,
      categories: missingCategories,
      radius: 2500,
      limit: 30,
    });

    if (!response) {
      // Edge function failed or was blocked by cooldown — do NOT cache empty results
      throw new Error('places-viewport invocation failed');
    }

    const placesByCategory = response.placesByCategory || {};

    await Promise.all(missingCategories.map(async (category) => {
      const candidates = placesByCategory[category] || [];
      results[category] = candidates;
      await placesCache.set('nearby', cacheKeys.nearby(city, category, 2500), candidates);
    }));
  }

  requestedCategories.forEach((category) => {
    if (!results[category]) {
      results[category] = [];
    }
  });

  return results;
}

export async function fetchNearbyPlacesByCategory(
  city: string,
  location: { lat: number; lng: number },
  category: NearbyCategory,
): Promise<PlannerPlaceCandidate[]> {
  const bundle = await fetchNearbyPlacesBundle(city, location, [category]);
  return bundle[category] ?? [];
}

/**
 * Maps zoom level to search radius in meters.
 * Higher zoom = smaller area visible = smaller radius.
 * Formula: 250 * 1.6^(16 - zoom), clamped to [250, 5000].
 *
 * Produces:  z16→250m  z15→400m  z14→640m  z13→1024m  z12→1638m  z11→2621m  z≤10→5000m
 * Backend accepts 250-5000m (enforced by sanitizeRadius in service.ts).
 */
export function zoomToRadius(zoom: number): number {
  const raw = 250 * Math.pow(1.6, 16 - zoom);
  return Math.max(250, Math.min(5000, Math.round(raw)));
}

/**
 * Distance threshold for viewport refetch (in degrees).
 * Scales with radius so low zoom = large threshold, high zoom = small threshold.
 * Roughly half the radius converted to degrees (1° ≈ 111km).
 */
export function viewportRefetchThreshold(radius: number): number {
  return (radius * 0.5) / 111_000;
}

/**
 * Derives a search radius from the actual visible map bounds.
 * Uses half of the longer span (lat vs lng) so the circle covers the majority
 * of the viewport rectangle. Adjusts longitude span by cos(lat) for accuracy.
 * Clamped to [250, 5000] to match backend limits.
 */
export function viewportRadiusFromBounds(
  center: { lat: number; lng: number },
  sw: { lat: number; lng: number },
  ne: { lat: number; lng: number },
): number {
  const dLat = Math.abs(ne.lat - sw.lat) * 111_000;
  const dLng = Math.abs(ne.lng - sw.lng) * 111_000 * Math.cos(center.lat * Math.PI / 180);
  const raw = Math.max(dLat, dLng) / 2;
  return Math.max(250, Math.min(5000, Math.round(raw)));
}

/**
 * Computes 1-3 search points to approximate the visible viewport rectangle
 * with circles, since the backend API searches point+radius.
 *
 * - maxSpan ≤ 8km  → 1 search at center (z13+)
 * - maxSpan 8-14km → 2 searches offset along longer axis (z12 area)
 * - maxSpan > 14km → 3 searches offset along longer axis (z11 area)
 *
 * Each search point has its own center and radius clamped to [250, 5000].
 */
export function computeViewportSearchPoints(
  center: { lat: number; lng: number },
  sw: { lat: number; lng: number },
  ne: { lat: number; lng: number },
): Array<{ center: { lat: number; lng: number }; radius: number }> {
  const cosLat = Math.cos(center.lat * Math.PI / 180);
  const dLat = Math.abs(ne.lat - sw.lat) * 111_000;
  const dLng = Math.abs(ne.lng - sw.lng) * 111_000 * cosLat;
  const maxSpan = Math.max(dLat, dLng);

  // 1 search: viewport fits within a single circle
  if (maxSpan <= 8000) {
    return [{ center, radius: Math.max(250, Math.min(5000, Math.round(maxSpan / 2))) }];
  }

  const isWider = dLng > dLat;
  const offsetDeg = isWider
    ? (ne.lng - sw.lng) / 4
    : (ne.lat - sw.lat) / 4;

  const shift = (sign: number) => isWider
    ? { lat: center.lat, lng: center.lng + sign * offsetDeg }
    : { lat: center.lat + sign * offsetDeg, lng: center.lng };

  // 2 searches: centers at 25% and 75% of the longer axis
  if (maxSpan <= 14000) {
    const r = Math.max(250, Math.min(5000, Math.round(maxSpan / 3)));
    return [
      { center: shift(-1), radius: r },
      { center: shift(1), radius: r },
    ];
  }

  // 3 searches: center + offset sides
  return [
    { center: shift(-1), radius: 5000 },
    { center, radius: 5000 },
    { center: shift(1), radius: 5000 },
  ];
}

/**
 * Builds a stable, deterministic viewport signature from bounds + zoom.
 * Bounds are bucketized to a grid proportional to the search radius at that
 * zoom level, so micro-movements within the same bucket produce the same key.
 *
 * Grid size: ~250m at z16, ~640m at z14, ~1.6km at z12, ~2.6km at z11.
 */
export function buildViewportSignature(
  zoom: number,
  sw: { lat: number; lng: number },
  ne: { lat: number; lng: number },
): string {
  const zoomBucket = Math.round(zoom);
  const bucketSize = zoomToRadius(zoomBucket) / 111_000;
  const r = (v: number) => (Math.round(v / bucketSize) * bucketSize).toFixed(4);
  return `${zoomBucket}:${r(sw.lat)}:${r(sw.lng)}:${r(ne.lat)}:${r(ne.lng)}`;
}

/**
 * Viewport-triggered nearby places fetch. Bypasses IndexedDB cache because
 * the cache key doesn't include location — different viewport centers in the
 * same city must not share cached results. The backend handles its own cache.
 */
export interface ViewportNearbyResult {
  placesByCategory: Record<string, PlannerPlaceCandidate[]>;
  partial?: boolean;
}

export async function fetchViewportNearbyPlaces(
  city: string,
  searchPoints: Array<{ center: { lat: number; lng: number }; radius: number }>,
  categories: PlannerPlaceCategory[],
): Promise<ViewportNearbyResult> {
  const requestedCategories = Array.from(new Set(categories));
  const primary = searchPoints[0];

  const response = await invokePlacesFunction<{ placesByCategory?: Record<string, PlannerPlaceCandidate[]>; partial?: boolean }>('places-viewport', {
    city,
    location: primary.center,
    categories: requestedCategories,
    radius: primary.radius,
    limit: 30,
    searchPoints: searchPoints.map(sp => ({ location: sp.center, radius: sp.radius })),
  });

  if (!response) return { placesByCategory: {}, partial: true };

  const placesByCategory: Record<string, PlannerPlaceCandidate[]> = {};
  const responsePlaces = response.placesByCategory || {};
  for (const cat of requestedCategories) {
    placesByCategory[cat] = responsePlaces[cat] || [];
  }
  return { placesByCategory, partial: response.partial };
}

export async function fetchNearbyHotels(
  city: string,
  location: { lat: number; lng: number },
): Promise<PlannerPlaceCandidate[]> {
  return await fetchNearbyPlacesByCategory(city, location, 'hotel');
}

export async function fetchPlaceDetails(
  lookupOrTitle: string | PlaceDetailsLookup,
  city?: string,
  locationBias?: { lat: number; lng: number },
): Promise<PlaceDetails | null> {
  const lookup = typeof lookupOrTitle === 'string'
    ? {
        title: lookupOrTitle,
        city: city || '',
        locationBias,
      }
    : lookupOrTitle;

  const idKey = lookup.placeId && isLikelyFoursquareVenueId(lookup.placeId)
    ? cacheKeys.details(`id::${lookup.placeId}`)
    : null;
  const queryKey = cacheKeys.details(`${lookup.title}::${lookup.city}`);

  if (idKey) {
    const cachedById = await placesCache.get<PlaceDetails>('details', idKey);
    if (cachedById) return cachedById;
  }

  const cachedByQuery = await placesCache.get<PlaceDetails>('details', queryKey);
  if (cachedByQuery) return cachedByQuery;

  const result = await invokePlacesFunction<PlaceDetails | null>('place-details', lookup);
  if (!result) return null;

  await Promise.all([
    placesCache.set('details', queryKey, result),
    ...(idKey ? [placesCache.set('details', idKey, result)] : []),
  ]);

  return result;
}

export async function fetchPlaceSummary(
  lookup: PlaceDetailsLookup,
): Promise<PlannerPlaceCandidate | null> {
  return await invokePlacesFunction<PlannerPlaceCandidate | null>('place-summary', lookup);
}

export async function fetchPlacePhotos(
  placeId: string,
  limit = 3,
  size: 'thumb' | 'hero' | 'gallery' = 'hero',
): Promise<string[]> {
  const result = await invokePlacesFunction<{ placeId: string; photoUrls: string[] }>('place-photos', {
    placeId,
    limit,
    size,
  });

  return result?.photoUrls || [];
}

export async function fetchPlaceRecommendations(
  destinations: string[],
  limitPerCity = 4,
): Promise<PlaceRecommendationGroup[]> {
  const result = await invokePlacesFunction<{ destinations: PlaceRecommendationGroup[] }>('place-recommendations', {
    destinations,
    limitPerCity,
  });

  return result?.destinations || [];
}

export async function fetchInventoryHotelPlaces(
  city: string,
  hotels: Array<{ name: string; address?: string; hotel_id?: string; city?: string }>,
  locationBias?: { lat: number; lng: number },
  limit = 12,
): Promise<PlannerPlaceHotelCandidate[]> {
  const cacheKey = buildHotelsCacheKey(city, hotels.slice(0, limit), limit);
  const cached = await placesCache.get<PlannerPlaceHotelCandidate[]>('geocoding', cacheKey);
  if (cached) return cached;

  const result = await invokePlacesFunction<PlannerPlaceHotelCandidate[]>('place-hotel-candidates', {
    city,
    hotels: hotels.slice(0, limit),
    locationBias,
    limit,
  });

  const places = result || [];
  await placesCache.set('geocoding', cacheKey, places);
  return places;
}

export function clearNearbyPlacesCooldown(
  city: string,
  location: { lat: number; lng: number },
  categories: PlannerPlaceCategory[],
): void {
  const payload = {
    city,
    location,
    categories: Array.from(new Set(categories)),
    radius: 2500,
    limit: 30,
  };
  failedRequestCooldown.delete(requestKey('places-viewport', payload));
}
