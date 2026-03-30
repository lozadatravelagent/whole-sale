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
      limit: 20,
    });

    const placesByCategory = response?.placesByCategory || {};

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
