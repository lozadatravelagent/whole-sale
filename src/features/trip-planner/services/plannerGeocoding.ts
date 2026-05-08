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
  // Caribbean — missing cities caused geocoder to find wrong US suburbs
  'montego bay': { lat: 18.4762, lng: -77.8939, country: 'Jamaica', placeLabel: 'Montego Bay, Jamaica', source: 'fallback' },
  'san juan': { lat: 18.4655, lng: -66.1057, country: 'Puerto Rico', placeLabel: 'San Juan, Puerto Rico', source: 'fallback' },
  'la habana': { lat: 23.1136, lng: -82.3666, country: 'Cuba', placeLabel: 'La Habana, Cuba', source: 'fallback' },
  havana: { lat: 23.1136, lng: -82.3666, country: 'Cuba', placeLabel: 'La Habana, Cuba', source: 'fallback' },
  cartagena: { lat: 10.3910, lng: -75.4794, country: 'Colombia', placeLabel: 'Cartagena, Colombia', source: 'fallback' },
  aruba: { lat: 12.5092, lng: -70.0086, country: 'Aruba', placeLabel: 'Aruba', source: 'fallback' },
  // Europa del Este
  budapest: { lat: 47.4979, lng: 19.0402, country: 'Hungría', placeLabel: 'Budapest, Hungría', source: 'fallback' },
  varsovia: { lat: 52.2297, lng: 21.0122, country: 'Polonia', placeLabel: 'Varsovia, Polonia', source: 'fallback' },
  warsaw: { lat: 52.2297, lng: 21.0122, country: 'Polonia', placeLabel: 'Varsovia, Polonia', source: 'fallback' },
  cracovia: { lat: 50.0647, lng: 19.9450, country: 'Polonia', placeLabel: 'Cracovia, Polonia', source: 'fallback' },
  krakow: { lat: 50.0647, lng: 19.9450, country: 'Polonia', placeLabel: 'Cracovia, Polonia', source: 'fallback' },
  // Escandinavia
  copenhague: { lat: 55.6761, lng: 12.5683, country: 'Dinamarca', placeLabel: 'Copenhague, Dinamarca', source: 'fallback' },
  copenhagen: { lat: 55.6761, lng: 12.5683, country: 'Dinamarca', placeLabel: 'Copenhague, Dinamarca', source: 'fallback' },
  estocolmo: { lat: 59.3293, lng: 18.0686, country: 'Suecia', placeLabel: 'Estocolmo, Suecia', source: 'fallback' },
  stockholm: { lat: 59.3293, lng: 18.0686, country: 'Suecia', placeLabel: 'Estocolmo, Suecia', source: 'fallback' },
  oslo: { lat: 59.9139, lng: 10.7522, country: 'Noruega', placeLabel: 'Oslo, Noruega', source: 'fallback' },
  bergen: { lat: 60.3913, lng: 5.3221, country: 'Noruega', placeLabel: 'Bergen, Noruega', source: 'fallback' },
  helsinki: { lat: 60.1699, lng: 24.9384, country: 'Finlandia', placeLabel: 'Helsinki, Finlandia', source: 'fallback' },
  // Medio Oriente
  estambul: { lat: 41.0082, lng: 28.9784, country: 'Turquía', placeLabel: 'Estambul, Turquía', source: 'fallback' },
  istanbul: { lat: 41.0082, lng: 28.9784, country: 'Turquía', placeLabel: 'Estambul, Turquía', source: 'fallback' },
  doha: { lat: 25.2854, lng: 51.5310, country: 'Qatar', placeLabel: 'Doha, Qatar', source: 'fallback' },
  'abu dabi': { lat: 24.4539, lng: 54.3773, country: 'Emiratos Árabes Unidos', placeLabel: 'Abu Dabi, EAU', source: 'fallback' },
  'abu dhabi': { lat: 24.4539, lng: 54.3773, country: 'Emiratos Árabes Unidos', placeLabel: 'Abu Dabi, EAU', source: 'fallback' },
  aman: { lat: 31.9539, lng: 35.9106, country: 'Jordania', placeLabel: 'Amán, Jordania', source: 'fallback' },
  amman: { lat: 31.9539, lng: 35.9106, country: 'Jordania', placeLabel: 'Amán, Jordania', source: 'fallback' },
  // África
  'el cairo': { lat: 30.0444, lng: 31.2357, country: 'Egipto', placeLabel: 'El Cairo, Egipto', source: 'fallback' },
  cairo: { lat: 30.0444, lng: 31.2357, country: 'Egipto', placeLabel: 'El Cairo, Egipto', source: 'fallback' },
  marrakech: { lat: 31.6295, lng: -7.9811, country: 'Marruecos', placeLabel: 'Marrakech, Marruecos', source: 'fallback' },
  'ciudad del cabo': { lat: -33.9249, lng: 18.4241, country: 'Sudáfrica', placeLabel: 'Ciudad del Cabo, Sudáfrica', source: 'fallback' },
  'cape town': { lat: -33.9249, lng: 18.4241, country: 'Sudáfrica', placeLabel: 'Ciudad del Cabo, Sudáfrica', source: 'fallback' },
  nairobi: { lat: -1.2921, lng: 36.8219, country: 'Kenia', placeLabel: 'Nairobi, Kenia', source: 'fallback' },
  zanzibar: { lat: -6.1659, lng: 39.2026, country: 'Tanzania', placeLabel: 'Zanzíbar, Tanzania', source: 'fallback' },
  // Oceanía
  sidney: { lat: -33.8688, lng: 151.2093, country: 'Australia', placeLabel: 'Sídney, Australia', source: 'fallback' },
  sydney: { lat: -33.8688, lng: 151.2093, country: 'Australia', placeLabel: 'Sídney, Australia', source: 'fallback' },
  melbourne: { lat: -37.8136, lng: 144.9631, country: 'Australia', placeLabel: 'Melbourne, Australia', source: 'fallback' },
  brisbane: { lat: -27.4698, lng: 153.0251, country: 'Australia', placeLabel: 'Brisbane, Australia', source: 'fallback' },
  auckland: { lat: -36.8485, lng: 174.7633, country: 'Nueva Zelanda', placeLabel: 'Auckland, Nueva Zelanda', source: 'fallback' },
  queenstown: { lat: -45.0312, lng: 168.6626, country: 'Nueva Zelanda', placeLabel: 'Queenstown, Nueva Zelanda', source: 'fallback' },
  // Asia
  bangkok: { lat: 13.7563, lng: 100.5018, country: 'Tailandia', placeLabel: 'Bangkok, Tailandia', source: 'fallback' },
  bali: { lat: -8.4095, lng: 115.1889, country: 'Indonesia', placeLabel: 'Bali, Indonesia', source: 'fallback' },
  hanoi: { lat: 21.0285, lng: 105.8542, country: 'Vietnam', placeLabel: 'Hanói, Vietnam', source: 'fallback' },
  hanoi: { lat: 21.0285, lng: 105.8542, country: 'Vietnam', placeLabel: 'Hanói, Vietnam', source: 'fallback' },
  'hong kong': { lat: 22.3193, lng: 114.1694, country: 'Hong Kong', placeLabel: 'Hong Kong', source: 'fallback' },
  seul: { lat: 37.5665, lng: 126.9780, country: 'Corea del Sur', placeLabel: 'Seúl, Corea del Sur', source: 'fallback' },
  seoul: { lat: 37.5665, lng: 126.9780, country: 'Corea del Sur', placeLabel: 'Seúl, Corea del Sur', source: 'fallback' },
  kioto: { lat: 35.0116, lng: 135.7681, country: 'Japón', placeLabel: 'Kioto, Japón', source: 'fallback' },
  kyoto: { lat: 35.0116, lng: 135.7681, country: 'Japón', placeLabel: 'Kioto, Japón', source: 'fallback' },
  // Sudamérica
  'buenos aires': { lat: -34.6037, lng: -58.3816, country: 'Argentina', placeLabel: 'Buenos Aires, Argentina', source: 'fallback' },
  'rio de janeiro': { lat: -22.9068, lng: -43.1729, country: 'Brasil', placeLabel: 'Río de Janeiro, Brasil', source: 'fallback' },
  lima: { lat: -12.0464, lng: -77.0428, country: 'Perú', placeLabel: 'Lima, Perú', source: 'fallback' },
  cusco: { lat: -13.5319, lng: -71.9675, country: 'Perú', placeLabel: 'Cusco, Perú', source: 'fallback' },
  santiago: { lat: -33.4569, lng: -70.6483, country: 'Chile', placeLabel: 'Santiago, Chile', source: 'fallback' },
  montevideo: { lat: -34.9011, lng: -56.1645, country: 'Uruguay', placeLabel: 'Montevideo, Uruguay', source: 'fallback' },
  // Patagonia
  bariloche: { lat: -41.1335, lng: -71.3103, country: 'Argentina', placeLabel: 'Bariloche, Argentina', source: 'fallback' },
  'el calafate': { lat: -50.3380, lng: -72.2648, country: 'Argentina', placeLabel: 'El Calafate, Argentina', source: 'fallback' },
  ushuaia: { lat: -54.8019, lng: -68.3030, country: 'Argentina', placeLabel: 'Ushuaia, Argentina', source: 'fallback' },
  // Norteamérica
  miami: { lat: 25.7617, lng: -80.1918, country: 'Estados Unidos', placeLabel: 'Miami, Estados Unidos', source: 'fallback' },
  'los angeles': { lat: 34.0522, lng: -118.2437, country: 'Estados Unidos', placeLabel: 'Los Ángeles, Estados Unidos', source: 'fallback' },
  'los angele': { lat: 34.0522, lng: -118.2437, country: 'Estados Unidos', placeLabel: 'Los Ángeles, Estados Unidos', source: 'fallback' },
  'san francisco': { lat: 37.7749, lng: -122.4194, country: 'Estados Unidos', placeLabel: 'San Francisco, Estados Unidos', source: 'fallback' },
  'las vegas': { lat: 36.1699, lng: -115.1398, country: 'Estados Unidos', placeLabel: 'Las Vegas, Estados Unidos', source: 'fallback' },
  toronto: { lat: 43.6532, lng: -79.3832, country: 'Canadá', placeLabel: 'Toronto, Canadá', source: 'fallback' },
  vancouver: { lat: 49.2827, lng: -123.1207, country: 'Canadá', placeLabel: 'Vancouver, Canadá', source: 'fallback' },
  'new york': { lat: 40.7128, lng: -74.006, country: 'Estados Unidos', placeLabel: 'Nueva York, Estados Unidos', source: 'fallback' },
  'nueva york': { lat: 40.7128, lng: -74.006, country: 'Estados Unidos', placeLabel: 'Nueva York, Estados Unidos', source: 'fallback' },
  // Centroamérica
  'san jose': { lat: 9.9281, lng: -84.0907, country: 'Costa Rica', placeLabel: 'San José, Costa Rica', source: 'fallback' },
  panama: { lat: 8.9936, lng: -79.5197, country: 'Panamá', placeLabel: 'Ciudad de Panamá, Panamá', source: 'fallback' },
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

function needsOriginResolution(state: TripPlannerState): boolean {
  if (!state.origin) return false;
  if (!state.originLocation) return true;
  return normalizeLocationKey(state.originLocation.city) !== normalizeLocationKey(state.origin);
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

  // Origin → drives the origin→destination polyline on the maps. Same provider/cache as segments.
  let nextOriginLocation = plannerState.originLocation;
  if (needsOriginResolution(plannerState)) {
    const resolved = await resolvePlannerSegmentLocation({
      city: plannerState.origin!,
      country: plannerState.originCountry,
    });
    if (resolved) {
      nextOriginLocation = resolved;
      changed = true;
    } else {
      unresolvedCities.push(formatDestinationLabel(plannerState.origin!));
    }
  }

  return {
    plannerState: changed
      ? {
          ...plannerState,
          segments: nextSegments,
          originLocation: nextOriginLocation,
        }
      : plannerState,
    changed,
    unresolvedCities,
  };
}
