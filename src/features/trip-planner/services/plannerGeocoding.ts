import type { PlannerLocation, TripPlannerState } from '../types';
import { MAPBOX_TOKEN } from '../map';
import { formatDestinationLabel } from '../utils';
import { geocodeCacheGet, geocodeCacheSet, geocodeCacheGetAll } from './geocodingCache';
import { fetchPlaceSummary } from './placesService';

type SegmentLike = TripPlannerState['segments'][number];

type EnrichedPlannerLocations = {
  plannerState: TripPlannerState;
  changed: boolean;
  unresolvedCities: string[];
};

const GEOCODER_URL = 'https://nominatim.openstreetmap.org/search';
const IDB_CITY_PREFIX = 'city:';
const IDB_ACTIVITY_PREFIX = 'activity:';

// Nominatim rate limit: 1 req/sec. Serial queue to guarantee ordering.
let nominatimQueue: Promise<void> = Promise.resolve();
function throttleNominatim(): Promise<void> {
  nominatimQueue = nominatimQueue.then(
    () => new Promise((r) => setTimeout(r, 1500)),
  );
  return nominatimQueue;
}

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

export const FALLBACK_CITY_COORDINATES_FLAT: Record<string, { lat: number }> =
  Object.fromEntries(
    Object.entries(FALLBACK_CITY_COORDINATES).map(([k, v]) => [k, { lat: v.lat }])
  );

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

function sanitizeGeocodeFragment(value?: string | null): string {
  return (value || '')
    .replace(/[|/\\]+/g, ' ')
    .replace(/[[\](){}]+/g, ' ')
    .replace(/[,:;]+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim()
    .replace(/^,+|,+$/g, '');
}

function buildGeocodeQuery(parts: Array<string | undefined | null>, maxLength = 120): string {
  const query = parts
    .map((part) => sanitizeGeocodeFragment(part))
    .filter(Boolean)
    .join(', ')
    .replace(/\s+/g, ' ')
    .trim();

  if (query.length <= maxLength) {
    return query;
  }

  return query.slice(0, maxLength).replace(/[\s,]+[^\s,]*$/, '').trim();
}

function uniqQueries(queries: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const query of queries) {
    const normalized = query?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
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

async function fetchMapboxLocation(city: string, country?: string): Promise<PlannerLocation | null> {
  if (!MAPBOX_TOKEN) return null;
  const query = buildGeocodeQuery([city, country]);
  if (!query) return null;
  const params = new URLSearchParams({
    q: query,
    limit: '1',
    language: 'es',
    access_token: MAPBOX_TOKEN,
  });
  try {
    const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`);
    if (!response.ok) return null;
    const payload = await response.json() as {
      features?: Array<{
        properties?: { full_address?: string; name?: string };
        geometry?: { coordinates?: [number, number] };
      }>;
    };
    const feature = payload.features?.[0];
    if (!feature?.geometry?.coordinates) return null;
    const [lng, lat] = feature.geometry.coordinates;
    return {
      city: formatDestinationLabel(city),
      country,
      lat,
      lng,
      placeLabel: feature.properties?.full_address || feature.properties?.name,
      source: 'provider',
    };
  } catch {
    return null;
  }
}

async function fetchProviderLocation(city: string, country?: string): Promise<PlannerLocation | null> {
  // Mapbox first (fast, no rate limit), Nominatim as fallback
  const mapboxResult = await fetchMapboxLocation(city, country);
  if (mapboxResult) return mapboxResult;
  return fetchNominatimLocation(city, country);
}

async function fetchNominatimLocation(city: string, country?: string): Promise<PlannerLocation | null> {
  const query = buildGeocodeQuery([city, country], 160);
  if (!query) return null;
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
  });

  const url = `${GEOCODER_URL}?${params.toString()}`;
  const headers = { Accept: 'application/json', 'Accept-Language': 'es' };

  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttleNominatim();
    try {
      response = await fetch(url, { headers });
    } catch {
      return null;
    }
    if (response.status === 429) {
      // Rate limited — wait extra and retry
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      response = null;
      continue;
    }
    break;
  }

  if (!response || !response.ok) {
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

function buildActivityCacheKey(title: string, neighborhood?: string, city?: string, placeId?: string, formattedAddress?: string): string {
  return [placeId, title, formattedAddress, neighborhood, city]
    .filter(Boolean)
    .map((value) => normalizeLocationKey(value!))
    .join('::');
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
  formattedAddress?: string;
  placeId?: string;
  city: string;
  country?: string;
}): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = buildActivityCacheKey(
    input.title,
    input.neighborhood,
    input.city,
    input.placeId,
    input.formattedAddress,
  );
  const cached = readCachedActivityLocation(cacheKey);
  if (cached !== undefined) return cached;

  const summary = await fetchPlaceSummary({
    placeId: input.placeId,
    title: input.title,
    city: input.city,
  }).catch(() => null);

  if (summary?.lat != null && summary?.lng != null) {
    const result = { lat: summary.lat, lng: summary.lng };
    writeCachedActivityLocation(cacheKey, result);
    return result;
  }

  const addressQueries = uniqQueries([
    buildGeocodeQuery([input.formattedAddress, input.city, input.country], 140),
    buildGeocodeQuery([input.neighborhood, input.city, input.country], 120),
  ]);

  for (const query of addressQueries) {
    const providerLocation = await fetchProviderLocation(query);
    if (providerLocation) {
      const result = { lat: providerLocation.lat, lng: providerLocation.lng };
      writeCachedActivityLocation(cacheKey, result);
      return result;
    }
  }

  const poiQueries = uniqQueries([
    buildGeocodeQuery([input.title, input.city, input.country], 96),
    buildGeocodeQuery([input.title, input.neighborhood, input.city], 96),
    buildGeocodeQuery([input.city, input.country], 80),
  ]);

  let providerLocation: PlannerLocation | null = null;
  for (const query of poiQueries) {
    providerLocation = await fetchNominatimLocation(query);
    if (providerLocation) break;
  }

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

const REVERSE_GEOCODER_URL = 'https://nominatim.openstreetmap.org/reverse';

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<{ city: string; country: string } | null> {
  const cacheKey = `reverse::${lat.toFixed(3)}::${lng.toFixed(3)}`;
  const cached = memoryCache.get(cacheKey);
  if (cached !== undefined) {
    return cached ? { city: cached.city, country: cached.country || '' } : null;
  }

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      'accept-language': 'es',
    });
    await throttleNominatim();
    const response = await fetch(`${REVERSE_GEOCODER_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;

    const data = await response.json() as {
      address?: { city?: string; town?: string; village?: string; country?: string };
    };
    const city = data.address?.city || data.address?.town || data.address?.village;
    const country = data.address?.country || '';
    if (!city) return null;

    // Cache as PlannerLocation for reuse
    memoryCache.set(cacheKey, { city, country, lat, lng, source: 'provider' });
    return { city, country };
  } catch {
    return null;
  }
}

let cachedOriginResult: { city: string; country: string } | null | undefined = undefined;

export async function detectUserOriginCity(): Promise<{ city: string; country: string } | null> {
  if (cachedOriginResult !== undefined) return cachedOriginResult;

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    cachedOriginResult = null;
    return null;
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
    });
    const result = await reverseGeocodeNominatim(position.coords.latitude, position.coords.longitude);
    if (result) {
      // Normalize against FALLBACK_CITY_COORDINATES keys
      const normalizedKey = normalizeLocationKey(result.city);
      const fallbackEntry = FALLBACK_CITY_COORDINATES[normalizedKey];
      if (fallbackEntry) {
        result.city = formatDestinationLabel(
          Object.keys(FALLBACK_CITY_COORDINATES).find(
            (k) => FALLBACK_CITY_COORDINATES[k] === fallbackEntry
          ) || result.city
        );
        result.country = fallbackEntry.country || result.country;
      }
    }
    cachedOriginResult = result;
    return result;
  } catch {
    cachedOriginResult = null;
    return null;
  }
}

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
