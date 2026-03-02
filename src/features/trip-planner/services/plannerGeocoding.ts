import type { PlannerLocation, TripPlannerState } from '../types';
import { PLANNER_GOOGLE_MAPS_API_KEY } from '../map';
import { formatDestinationLabel } from '../utils';
import { geocodeCacheGet, geocodeCacheSet, geocodeCacheGetAll } from './geocodingCache';

type SegmentLike = TripPlannerState['segments'][number];

type EnrichedPlannerLocations = {
  plannerState: TripPlannerState;
  changed: boolean;
  unresolvedCities: string[];
};

const GEOCODER_URL = 'https://nominatim.openstreetmap.org/search';
const IDB_CITY_PREFIX = 'city:';
const IDB_ACTIVITY_PREFIX = 'activity:';

const FALLBACK_CITY_COORDINATES: Record<string, Omit<PlannerLocation, 'city'>> = {
  madrid: { lat: 40.4168, lng: -3.7038, country: 'España', placeLabel: 'Madrid, España', source: 'fallback' },
  paris: { lat: 48.8566, lng: 2.3522, country: 'Francia', placeLabel: 'París, Francia', source: 'fallback' },
  roma: { lat: 41.9028, lng: 12.4964, country: 'Italia', placeLabel: 'Roma, Italia', source: 'fallback' },
  rome: { lat: 41.9028, lng: 12.4964, country: 'Italia', placeLabel: 'Roma, Italia', source: 'fallback' },
  barcelona: { lat: 41.3874, lng: 2.1686, country: 'España', placeLabel: 'Barcelona, España', source: 'fallback' },
  lisboa: { lat: 38.7223, lng: -9.1393, country: 'Portugal', placeLabel: 'Lisboa, Portugal', source: 'fallback' },
  lisbon: { lat: 38.7223, lng: -9.1393, country: 'Portugal', placeLabel: 'Lisboa, Portugal', source: 'fallback' },
  londres: { lat: 51.5072, lng: -0.1276, country: 'Reino Unido', placeLabel: 'Londres, Reino Unido', source: 'fallback' },
  london: { lat: 51.5072, lng: -0.1276, country: 'Reino Unido', placeLabel: 'Londres, Reino Unido', source: 'fallback' },
  amsterdam: { lat: 52.3676, lng: 4.9041, country: 'Países Bajos', placeLabel: 'Ámsterdam, Países Bajos', source: 'fallback' },
  berlin: { lat: 52.52, lng: 13.405, country: 'Alemania', placeLabel: 'Berlín, Alemania', source: 'fallback' },
  viena: { lat: 48.2082, lng: 16.3738, country: 'Austria', placeLabel: 'Viena, Austria', source: 'fallback' },
  vienna: { lat: 48.2082, lng: 16.3738, country: 'Austria', placeLabel: 'Viena, Austria', source: 'fallback' },
  praga: { lat: 50.0755, lng: 14.4378, country: 'República Checa', placeLabel: 'Praga, República Checa', source: 'fallback' },
  prague: { lat: 50.0755, lng: 14.4378, country: 'República Checa', placeLabel: 'Praga, República Checa', source: 'fallback' },
  florencia: { lat: 43.7696, lng: 11.2558, country: 'Italia', placeLabel: 'Florencia, Italia', source: 'fallback' },
  florence: { lat: 43.7696, lng: 11.2558, country: 'Italia', placeLabel: 'Florencia, Italia', source: 'fallback' },
  venecia: { lat: 45.4408, lng: 12.3155, country: 'Italia', placeLabel: 'Venecia, Italia', source: 'fallback' },
  venice: { lat: 45.4408, lng: 12.3155, country: 'Italia', placeLabel: 'Venecia, Italia', source: 'fallback' },
  milan: { lat: 45.4642, lng: 9.19, country: 'Italia', placeLabel: 'Milán, Italia', source: 'fallback' },
  milanó: { lat: 45.4642, lng: 9.19, country: 'Italia', placeLabel: 'Milán, Italia', source: 'fallback' },
  atenas: { lat: 37.9838, lng: 23.7275, country: 'Grecia', placeLabel: 'Atenas, Grecia', source: 'fallback' },
  athens: { lat: 37.9838, lng: 23.7275, country: 'Grecia', placeLabel: 'Atenas, Grecia', source: 'fallback' },
  cancun: { lat: 21.1619, lng: -86.8515, country: 'México', placeLabel: 'Cancún, México', source: 'fallback' },
  'playa del carmen': { lat: 20.6296, lng: -87.0739, country: 'México', placeLabel: 'Playa del Carmen, México', source: 'fallback' },
  'punta cana': { lat: 18.5601, lng: -68.3725, country: 'República Dominicana', placeLabel: 'Punta Cana, República Dominicana', source: 'fallback' },
  'buenos aires': { lat: -34.6037, lng: -58.3816, country: 'Argentina', placeLabel: 'Buenos Aires, Argentina', source: 'fallback' },
  miami: { lat: 25.7617, lng: -80.1918, country: 'Estados Unidos', placeLabel: 'Miami, Estados Unidos', source: 'fallback' },
  'new york': { lat: 40.7128, lng: -74.006, country: 'Estados Unidos', placeLabel: 'Nueva York, Estados Unidos', source: 'fallback' },
  'nueva york': { lat: 40.7128, lng: -74.006, country: 'Estados Unidos', placeLabel: 'Nueva York, Estados Unidos', source: 'fallback' },
  dubai: { lat: 25.2048, lng: 55.2708, country: 'Emiratos Árabes Unidos', placeLabel: 'Dubái, Emiratos Árabes Unidos', source: 'fallback' },
  tokyo: { lat: 35.6762, lng: 139.6503, country: 'Japón', placeLabel: 'Tokio, Japón', source: 'fallback' },
  singapur: { lat: 1.3521, lng: 103.8198, country: 'Singapur', placeLabel: 'Singapur', source: 'fallback' },
  singapore: { lat: 1.3521, lng: 103.8198, country: 'Singapur', placeLabel: 'Singapur', source: 'fallback' },
};

const memoryCache = new Map<string, PlannerLocation | null>();

function normalizeLocationKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function buildCacheKey(city: string, country?: string): string {
  return `${normalizeLocationKey(city)}::${normalizeLocationKey(country || '')}`;
}

function readCachedLocation(cacheKey: string): PlannerLocation | null | undefined {
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }
  return undefined;
}

function writeCachedLocation(cacheKey: string, location: PlannerLocation | null) {
  memoryCache.set(cacheKey, location);
  geocodeCacheSet(`${IDB_CITY_PREFIX}${cacheKey}`, JSON.stringify(location)).catch(() => {});
}

function getFallbackLocation(city: string): PlannerLocation | null {
  const fallback = FALLBACK_CITY_COORDINATES[normalizeLocationKey(city)];
  if (!fallback) return null;

  return {
    city: formatDestinationLabel(city),
    country: fallback.country,
    lat: fallback.lat,
    lng: fallback.lng,
    placeLabel: fallback.placeLabel,
    source: 'fallback',
  };
}

function needsLocationResolution(segment: SegmentLike): boolean {
  if (!segment.location) return true;
  return normalizeLocationKey(segment.location.city) !== normalizeLocationKey(segment.city);
}

async function fetchProviderLocation(city: string, country?: string): Promise<PlannerLocation | null> {
  if (PLANNER_GOOGLE_MAPS_API_KEY) {
    const googleLocation = await fetchGoogleLocation(city, country);
    if (googleLocation) {
      return googleLocation;
    }
  }

  return fetchNominatimLocation(city, country);
}

async function fetchGoogleLocation(city: string, country?: string): Promise<PlannerLocation | null> {
  const address = [city, country].filter(Boolean).join(', ');
  const params = new URLSearchParams({
    address,
    key: PLANNER_GOOGLE_MAPS_API_KEY,
    language: 'es',
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      geometry?: {
        location?: {
          lat?: number;
          lng?: number;
        };
      };
    }>;
  };

  if (payload.status !== 'OK' || !payload.results?.[0]?.geometry?.location) {
    return null;
  }

  const firstResult = payload.results[0];

  return {
    city: formatDestinationLabel(city),
    country,
    lat: Number(firstResult.geometry?.location?.lat),
    lng: Number(firstResult.geometry?.location?.lng),
    placeLabel: firstResult.formatted_address,
    source: 'provider',
  };
}

async function fetchNominatimLocation(city: string, country?: string): Promise<PlannerLocation | null> {
  const query = [city, country].filter(Boolean).join(', ');
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
  });

  const response = await fetch(`${GEOCODER_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'es',
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as Array<{
    lat: string;
    lon: string;
    display_name?: string;
  }>;

  const firstResult = payload[0];
  if (!firstResult) {
    return null;
  }

  return {
    city: formatDestinationLabel(city),
    country,
    lat: Number(firstResult.lat),
    lng: Number(firstResult.lon),
    placeLabel: firstResult.display_name,
    source: 'provider',
  };
}

export async function resolvePlannerSegmentLocation(input: {
  city: string;
  country?: string;
}): Promise<PlannerLocation | null> {
  const cacheKey = buildCacheKey(input.city, input.country);
  const cached = readCachedLocation(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const fallback = getFallbackLocation(input.city);
  if (fallback) {
    writeCachedLocation(cacheKey, fallback);
    return fallback;
  }

  const providerLocation = await fetchProviderLocation(input.city, input.country);
  writeCachedLocation(cacheKey, providerLocation);
  return providerLocation;
}

const activityMemoryCache = new Map<string, { lat: number; lng: number } | null>();

function buildActivityCacheKey(title: string, neighborhood?: string, city?: string): string {
  return [title, neighborhood, city].filter(Boolean).map((v) => normalizeLocationKey(v!)).join('::');
}

function readCachedActivityLocation(cacheKey: string): { lat: number; lng: number } | null | undefined {
  if (activityMemoryCache.has(cacheKey)) return activityMemoryCache.get(cacheKey)!;
  return undefined;
}

function writeCachedActivityLocation(cacheKey: string, location: { lat: number; lng: number } | null) {
  activityMemoryCache.set(cacheKey, location);
  geocodeCacheSet(`${IDB_ACTIVITY_PREFIX}${cacheKey}`, JSON.stringify(location)).catch(() => {});
}

export async function resolveActivityLocation(input: {
  title: string;
  neighborhood?: string;
  city: string;
  country?: string;
}): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = buildActivityCacheKey(input.title, input.neighborhood, input.city);
  const cached = readCachedActivityLocation(cacheKey);
  if (cached !== undefined) return cached;

  const query = [input.title, input.neighborhood, input.city, input.country].filter(Boolean).join(', ');
  const providerLocation = await fetchProviderLocation(query);
  const result = providerLocation ? { lat: providerLocation.lat, lng: providerLocation.lng } : null;
  writeCachedActivityLocation(cacheKey, result);
  return result;
}

// Prefetch all geocoding entries from IndexedDB into memory caches on module load
function initGeocodingCache() {
  geocodeCacheGetAll().then((entries) => {
    for (const { key, value } of entries) {
      try {
        if (key.startsWith(IDB_CITY_PREFIX)) {
          const cacheKey = key.slice(IDB_CITY_PREFIX.length);
          if (!memoryCache.has(cacheKey)) {
            memoryCache.set(cacheKey, JSON.parse(value));
          }
        } else if (key.startsWith(IDB_ACTIVITY_PREFIX)) {
          const cacheKey = key.slice(IDB_ACTIVITY_PREFIX.length);
          if (!activityMemoryCache.has(cacheKey)) {
            activityMemoryCache.set(cacheKey, JSON.parse(value));
          }
        }
      } catch {
        // Skip malformed entries
      }
    }
  }).catch(() => {});
}

initGeocodingCache();

export async function enrichPlannerWithLocations(plannerState: TripPlannerState): Promise<EnrichedPlannerLocations> {
  const unresolvedCities: string[] = [];
  let changed = false;

  const nextSegments: SegmentLike[] = await Promise.all(
    plannerState.segments.map(async (segment) => {
      if (!needsLocationResolution(segment)) {
        return segment;
      }

      const resolvedLocation = await resolvePlannerSegmentLocation({
        city: segment.city,
        country: segment.country,
      });

      if (!resolvedLocation) {
        unresolvedCities.push(formatDestinationLabel(segment.city));
        return segment;
      }

      changed = true;
      return {
        ...segment,
        location: resolvedLocation,
      };
    }),
  );

  return {
    plannerState: changed
      ? {
          ...plannerState,
          segments: nextSegments,
        }
      : plannerState,
    changed,
    unresolvedCities,
  };
}
