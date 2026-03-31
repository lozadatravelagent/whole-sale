import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCachedSearch, setCachedSearch } from '../cache.ts';
import { fetchWikipediaPhoto } from './wikipedia.ts';
import {
  getDetails,
  getPhotos,
  getVenuePhotoUrl,
  searchByQuery,
  searchNearby,
  searchText,
  type CanonicalVenue,
} from './foursquare.ts';
import type {
  PlaceDetails,
  PlaceDetailsRequest,
  PlaceHotelCandidatesRequest,
  PlacePhotosRequest,
  PlacePhotosResponse,
  PlaceRecommendationsRequest,
  PlaceRecommendationsResponse,
  PlaceSummaryRequest,
  PlannerActivityType,
  PlannerPlaceCandidate,
  PlannerPlaceCategory,
  PlannerPlaceHotelCandidate,
  PlacesViewportRequest,
  PlacesViewportResponse,
} from './types.ts';

type CacheState = 'hit' | 'miss' | 'stale';

type LoggerLike = {
  info: (type: string, message: string, metadata?: Record<string, unknown>) => void;
  warn: (type: string, message: string, metadata?: Record<string, unknown>) => void;
  error: (type: string, message: string, metadata?: Record<string, unknown>) => void;
};

interface ServiceResult<T> {
  data: T;
  cacheStatus: CacheState;
  fallbackUsed?: boolean;
}

const DEFAULT_VIEWPORT_CATEGORIES: PlannerPlaceCategory[] = ['restaurant', 'cafe', 'museum', 'activity'];

const FSQ_CATEGORIES: Record<PlannerPlaceCategory, string[]> = {
  hotel: ['19014', '19013', '19012'],
  restaurant: ['13065', '13064', '13338', '13145', '13236', '13263', '13303'],
  cafe: ['13032', '13034', '13035', '13063'],
  museum: ['10027', '10024', '10058', '10025'],
  activity: ['16000', '10000', '10056', '10059', '16011', '16015', '16039'],
  sights: ['16026', '12104', '16020', '16009', '16008', '16004'],
  nightlife: ['13003', '10032', '10039', '10043'],
  parks: ['16032', '16019', '16046', '16034'],
  shopping: ['17000', '17114', '17069', '17018'],
  culture: ['10025', '10028', '10022', '10023'],
};

function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(supabaseUrl, serviceRoleKey);
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizeText(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function sanitizeCategoryList(categories?: PlannerPlaceCategory[]): PlannerPlaceCategory[] {
  if (!categories?.length) return DEFAULT_VIEWPORT_CATEGORIES;

  return uniq(categories.filter((category): category is PlannerPlaceCategory => category in FSQ_CATEGORIES)).slice(0, 6);
}

function sanitizeLimit(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.round(value as number)));
}

function sanitizeRadius(value?: number): number {
  if (!Number.isFinite(value)) return 2500;
  return Math.max(250, Math.min(5000, Math.round(value as number)));
}

function inferCategoryFromFSQ(
  categories: Array<{ id?: string; categoryCode?: number }> | undefined,
  venueName?: string,
): PlannerPlaceCategory {
  const ids = categories?.map((category) => String(category.categoryCode ?? category.id ?? '')) ?? [];

  for (const [category, fsqIds] of Object.entries(FSQ_CATEGORIES)) {
    if (ids.some((id) => fsqIds.some((fsqId) => id.startsWith(fsqId)))) {
      return category as PlannerPlaceCategory;
    }
  }

  const normalizedName = normalizeText(venueName);
  if (/(museum|museo|gallery|galeria)/.test(normalizedName)) return 'museum';
  if (/(hotel|resort|suite)/.test(normalizedName)) return 'hotel';
  if (/(cafe|coffee|cafeteria|brunch)/.test(normalizedName)) return 'cafe';
  if (/(club|night|cocktail|pub|\bbar\b)/.test(normalizedName)) return 'nightlife';
  if (/(restaurant|restaurante|bistro|rooftop|tapas|steakhouse|pizzeria)/.test(normalizedName)) return 'restaurant';
  if (/(park|parque|garden|jardin|nature)/.test(normalizedName)) return 'parks';
  if (/(shopping|mall|market|mercado|boutique)/.test(normalizedName)) return 'shopping';
  if (/(monument|landmark|cathedral|palace|tower|castle|plaza|temple|church)/.test(normalizedName)) return 'sights';

  return 'activity';
}

function inferPlannerActivityType(
  types: string[] | undefined,
  name?: string,
  category?: PlannerPlaceCategory,
): PlannerActivityType {
  if (category === 'hotel') return 'hotel';
  if (category === 'museum') return 'museum';
  if (category === 'restaurant' || category === 'cafe') return 'food';
  if (category === 'sights') return 'landmark';
  if (category === 'nightlife') return 'nightlife';
  if (category === 'parks') return 'nature';
  if (category === 'shopping') return 'shopping';
  if (category === 'culture') return 'culture';

  const normalized = normalizeText(`${name || ''} ${(types || []).join(' ')}`);
  if (/(viewpoint|lookout|mirador|observatory)/.test(normalized)) return 'viewpoint';
  if (/(walk|walking|district|barrio|neighborhood)/.test(normalized)) return 'walk';
  if (/(family|zoo|aquarium|theme park)/.test(normalized)) return 'family';
  if (/(spa|wellness|onsen)/.test(normalized)) return 'wellness';
  if (/(market|mercado)/.test(normalized)) return 'market';
  if (/(show|theater|theatre|performance|concert)/.test(normalized)) return 'culture';
  if (/(tour|experience|workshop|activity)/.test(normalized)) return 'experience';

  return 'unknown';
}

function scoreCandidate(place: PlannerPlaceCandidate): number {
  const ratingScore = (place.rating || 0) * 20;
  const reviewsScore = Math.log10((place.userRatingsTotal || 0) + 1) * 25;
  const photoBonus = place.photoUrls?.length ? 12 : 0;
  const categoryBonus = place.category === 'museum'
    ? 18
    : place.category === 'sights'
      ? 16
      : place.category === 'activity'
        ? 14
        : place.category === 'parks'
          ? 10
          : place.category === 'restaurant' || place.category === 'cafe'
            ? 8
            : 4;

  return ratingScore + reviewsScore + photoBonus + categoryBonus;
}

function dedupeCandidates(candidates: PlannerPlaceCandidate[]): PlannerPlaceCandidate[] {
  const unique = new Map<string, PlannerPlaceCandidate>();

  for (const candidate of candidates) {
    const key = candidate.placeId || `${normalizeText(candidate.name)}:${candidate.lat}:${candidate.lng}`;
    const existing = unique.get(key);
    if (!existing || scoreCandidate(candidate) > scoreCandidate(existing)) {
      unique.set(key, candidate);
    }
  }

  return Array.from(unique.values()).sort((left, right) => scoreCandidate(right) - scoreCandidate(left));
}

function mapVenueToCandidate(venue: CanonicalVenue, forcedCategory?: PlannerPlaceCategory): PlannerPlaceCandidate {
  const category = forcedCategory || inferCategoryFromFSQ(venue.categories, venue.name);
  const types = venue.categories?.map((categoryItem) => categoryItem.name).filter(Boolean);

  // Extract up to 3 photos (hero + 2 extras from photo groups)
  const photoUrls: string[] = [];
  const hero = getVenuePhotoUrl(venue);
  if (hero) photoUrls.push(hero);
  const extras = venue.photos?.groups?.[0]?.items?.slice(1, 3) ?? [];
  for (const photo of extras) {
    if (photo.prefix && photo.suffix) {
      photoUrls.push(`${photo.prefix}400x300${photo.suffix}`);
    }
  }

  return {
    placeId: venue.id,
    name: venue.name,
    formattedAddress: venue.location?.formattedAddress?.join(', ') || venue.location?.address,
    lat: venue.location?.lat,
    lng: venue.location?.lng,
    rating: venue.rating != null ? venue.rating / 2 : undefined,
    userRatingsTotal: venue.ratingSignals,
    photoUrls,
    category,
    activityType: inferPlannerActivityType(types, venue.name, category),
    types,
    source: 'foursquare',
  };
}

function mapVenueToDetails(venue: CanonicalVenue): PlaceDetails {
  const photoUrls: string[] = [];
  const hero = getVenuePhotoUrl(venue, '1200x800');
  if (hero) photoUrls.push(hero);

  const extraPhotos = venue.photos?.groups?.[0]?.items?.slice(1, 4) ?? [];
  for (const photo of extraPhotos) {
    photoUrls.push(`${photo.prefix}1200x800${photo.suffix}`);
  }

  return {
    placeId: venue.id,
    source: 'foursquare',
    name: venue.name,
    formattedAddress: venue.location?.formattedAddress?.join(', ') || venue.location?.address,
    rating: venue.rating != null ? venue.rating / 2 : undefined,
    userRatingsTotal: venue.ratingSignals,
    website: venue.url,
    phoneNumber: venue.tel,
    openingHours: venue.hours?.status ? [venue.hours.status] : undefined,
    isOpenNow: venue.hours?.isOpen,
    photoUrls,
    reviewSnippet: venue.description,
    types: venue.categories?.map((category) => category.name).filter(Boolean),
    freshness: new Date().toISOString(),
  };
}

function isLikelyFoursquareVenueId(value?: string): boolean {
  return /^[0-9a-f]{24}$/i.test((value || '').trim());
}

async function hydrateCandidatesWithWikipedia(
  candidates: PlannerPlaceCandidate[],
  city: string,
): Promise<boolean> {
  let fallbackUsed = false;

  const targets = candidates.filter((candidate) => !candidate.photoUrls?.length).slice(0, 4);
  if (targets.length === 0) return fallbackUsed;

  await Promise.all(targets.map(async (candidate) => {
    const photo = await fetchWikipediaPhoto(candidate.name, city, candidate.category);
    if (photo) {
      candidate.photoUrls = [photo];
      fallbackUsed = true;
    }
  }));

  return fallbackUsed;
}

async function hydrateDetailsWithWikipedia(
  details: PlaceDetails,
  title: string,
  city: string,
  category?: PlannerPlaceCategory,
): Promise<boolean> {
  if (details.photoUrls.length > 0) return false;

  const photo = await fetchWikipediaPhoto(title, city, category);
  if (!photo) return false;

  details.photoUrls.push(photo);
  if (!details.source) details.source = 'wikipedia';
  return true;
}

async function withCache<T>(
  searchType: string,
  params: Record<string, unknown>,
  loader: () => Promise<T>,
): Promise<ServiceResult<T>> {
  const supabase = createAdminClient();
  const cached = await getCachedSearch(supabase, searchType, params);

  if (cached) {
    return {
      data: cached.results as T,
      cacheStatus: cached.status === 'fresh' ? 'hit' : 'stale',
    };
  }

  const data = await loader();
  await setCachedSearch(supabase, searchType, params, data);

  return {
    data,
    cacheStatus: 'miss',
  };
}

const VIEWPORT_CONCURRENCY = 6;
const VIEWPORT_TASK_TIMEOUT_MS = 8000;

/**
 * Runs async task factories with a concurrency limit and per-task logical timeout.
 * Timeout stops WAITING (Promise.race), not the underlying operation — the task
 * may continue running until the edge function exits. Timer is cleaned up on
 * normal completion to avoid leaks.
 * Tasks that timeout or throw return null.
 */
async function runWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
  taskTimeoutMs: number,
): Promise<Array<T | null>> {
  const results: Array<T | null> = new Array(tasks.length).fill(null);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      const index = cursor++;
      results[index] = await new Promise<T | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), taskTimeoutMs);
        tasks[index]()
          .then((value) => { clearTimeout(timer); resolve(value); })
          .catch(() => { clearTimeout(timer); resolve(null); });
      });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker()),
  );

  return results;
}

function assertViewportRequest(input: PlacesViewportRequest) {
  if (!input?.city?.trim()) {
    throw new Error('city is required');
  }

  if (!Number.isFinite(input.location?.lat) || !Number.isFinite(input.location?.lng)) {
    throw new Error('location.lat and location.lng are required');
  }
}

function assertPlaceLookup(input: PlaceDetailsRequest | PlaceSummaryRequest) {
  if (!input?.title?.trim()) {
    throw new Error('title is required');
  }

  if (!input?.city?.trim()) {
    throw new Error('city is required');
  }
}

function assertRecommendationsRequest(input: PlaceRecommendationsRequest) {
  if (!Array.isArray(input?.destinations) || input.destinations.length === 0) {
    throw new Error('destinations is required');
  }
}

function assertHotelCandidatesRequest(input: PlaceHotelCandidatesRequest) {
  if (!input?.city?.trim()) {
    throw new Error('city is required');
  }

  if (!Array.isArray(input.hotels) || input.hotels.length === 0) {
    throw new Error('hotels is required');
  }
}

function buildVenueSearchQuery(title: string, city: string): string {
  return `${title} ${city}`.trim();
}

async function resolveVenueForLookup(input: PlaceDetailsRequest | PlaceSummaryRequest): Promise<CanonicalVenue | null> {
  if (input.placeId && isLikelyFoursquareVenueId(input.placeId)) {
    const venue = await getDetails(input.placeId);
    if (venue) return venue;
  }

  const matches = await searchByQuery({
    query: buildVenueSearchQuery(input.title, input.city),
    lat: input.locationBias?.lat,
    lng: input.locationBias?.lng,
    limit: 1,
  });

  const first = matches[0];
  if (!first) return null;

  return isLikelyFoursquareVenueId(first.id)
    ? await getDetails(first.id) || first
    : first;
}

export async function fetchViewportPlaces(
  input: PlacesViewportRequest,
  logger: LoggerLike,
): Promise<ServiceResult<PlacesViewportResponse>> {
  assertViewportRequest(input);

  const categories = sanitizeCategoryList(input.categories);
  const defaultRadius = sanitizeRadius(input.radius);
  const limit = sanitizeLimit(input.limit, 20, 30);
  const city = input.city.trim();

  // Build search points: use searchPoints[] if provided, else single location
  const points = (input.searchPoints?.length ? input.searchPoints : [{ location: input.location, radius: input.radius }])
    .slice(0, 3) // Hard cap at 3 points
    .map((sp) => ({
      lat: roundCoordinate(sp.location.lat),
      lng: roundCoordinate(sp.location.lng),
      radius: sanitizeRadius(sp.radius ?? defaultRadius),
    }));

  const placesByCategory: Partial<Record<PlannerPlaceCategory, PlannerPlaceCandidate[]>> = {};
  let aggregateCacheStatus: CacheState = 'hit';
  let fallbackUsed = false;

  // Fan-out with concurrency limit and per-task timeout
  type SearchResult = {
    category: PlannerPlaceCategory;
    data: PlannerPlaceCandidate[];
    cacheStatus: CacheState;
    pointIndex: number;
    failReason: string | null; // null = success, string = reason
  };

  const startMs = Date.now();

  const tasks = points.flatMap((point, pointIdx) =>
    categories.map((category): (() => Promise<SearchResult>) => {
      return async () => {
        const cacheParams = {
          city: normalizeText(city),
          category,
          lat: point.lat,
          lng: point.lng,
          radius: point.radius,
          limit,
        };

        try {
          const result = await withCache<PlannerPlaceCandidate[]>('placesViewport', cacheParams, async () => {
            const venues = await searchNearby({
              lat: point.lat,
              lng: point.lng,
              categoryId: FSQ_CATEGORIES[category]?.join(','),
              radius: point.radius,
              limit,
            });

            const mapped = dedupeCandidates(venues.map((venue) => mapVenueToCandidate(venue, category))).slice(0, limit);
            await hydrateCandidatesWithWikipedia(mapped, city);
            return mapped;
          });

          return { category, data: result.data, cacheStatus: result.cacheStatus, pointIndex: pointIdx, failReason: null };
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'unknown';
          return { category, data: [] as PlannerPlaceCandidate[], cacheStatus: 'miss' as CacheState, pointIndex: pointIdx, failReason: reason };
        }
      };
    }),
  );

  const rawResults = await runWithConcurrencyLimit(tasks, VIEWPORT_CONCURRENCY, VIEWPORT_TASK_TIMEOUT_MS);
  const durationMs = Date.now() - startMs;

  // Task-level stats — null = pool timeout, non-null = task completed (success or caught error)
  const completed = rawResults.filter((r): r is SearchResult => r !== null);
  const succeeded = completed.filter((r) => r.failReason === null);
  const taskErrors = completed.filter((r) => r.failReason !== null);
  const capExceeded = taskErrors.filter((r) => r.failReason?.includes('provider_call_cap_exceeded')).length;
  const rateLimited = taskErrors.filter((r) => r.failReason?.includes('provider_rate_limited')).length;
  const timedOut = rawResults.filter((r) => r === null).length;
  const cacheHits = succeeded.filter((r) => r.cacheStatus === 'hit').length;
  const cacheMisses = succeeded.filter((r) => r.cacheStatus === 'miss').length;
  const cacheStale = succeeded.filter((r) => r.cacheStatus === 'stale').length;

  // ── Per-category and per-point breakdown ────────────────────────────────

  const catStats = new Map<string, { hits: number; misses: number; stale: number; timeouts: number; errors: number; rateLimited: number; places: number }>();
  for (const cat of categories) catStats.set(cat, { hits: 0, misses: 0, stale: 0, timeouts: 0, errors: 0, rateLimited: 0, places: 0 });

  const ptStats = new Map<number, { succeeded: number; failed: number; places: number }>();
  for (let i = 0; i < points.length; i++) ptStats.set(i, { succeeded: 0, failed: 0, places: 0 });

  rawResults.forEach((result, index) => {
    const ptIdx = Math.floor(index / categories.length);
    const cat = categories[index % categories.length];
    const cs = catStats.get(cat)!;
    const ps = ptStats.get(ptIdx)!;

    if (result === null) {
      cs.timeouts++;
      ps.failed++;
    } else if (result.failReason) {
      if (result.failReason.includes('provider_rate_limited')) cs.rateLimited++;
      else cs.errors++;
      ps.failed++;
    } else {
      if (result.cacheStatus === 'hit') cs.hits++;
      else if (result.cacheStatus === 'stale') cs.stale++;
      else cs.misses++;
      cs.places += result.data.length;
      ps.succeeded++;
      ps.places += result.data.length;
    }
  });

  // Compact: only include non-zero stats per category
  const categoryBreakdown: Record<string, Record<string, number>> = {};
  for (const [cat, s] of catStats) {
    const c: Record<string, number> = { places: s.places };
    if (s.hits) c.hits = s.hits;
    if (s.misses) c.misses = s.misses;
    if (s.stale) c.stale = s.stale;
    if (s.timeouts) c.timeouts = s.timeouts;
    if (s.errors) c.errors = s.errors;
    if (s.rateLimited) c.rate_limited = s.rateLimited;
    categoryBreakdown[cat] = c;
  }

  const pointBreakdown = Array.from(ptStats.entries()).map(([idx, s]) => {
    const entry: Record<string, number> = { point: idx, succeeded: s.succeeded, places: s.places };
    if (s.failed) entry.failed = s.failed;
    return entry;
  });

  // ── Merge results by category, then dedup across points ─────────────────

  for (const result of succeeded) {
    const { category, data, cacheStatus } = result;
    placesByCategory[category] = [...(placesByCategory[category] || []), ...data];
    if (cacheStatus === 'miss') aggregateCacheStatus = 'miss';
    if (cacheStatus === 'stale' && aggregateCacheStatus !== 'miss') aggregateCacheStatus = 'stale';
  }

  for (const category of categories) {
    if (placesByCategory[category]?.length) {
      placesByCategory[category] = dedupeCandidates(placesByCategory[category]!);
    }
  }

  const totalPlaces = Object.values(placesByCategory).reduce((sum, places) => sum + (places?.length ?? 0), 0);
  const hasPartialFailures = timedOut > 0 || taskErrors.length > 0;
  fallbackUsed = Object.values(placesByCategory).some((places) => places?.some((place) => place.source === 'wikipedia'));

  logger.info('places.viewport', 'Fetched places viewport', {
    city,
    points: points.length,
    total_tasks: rawResults.length,
    succeeded: succeeded.length,
    cache_hits: cacheHits,
    cache_misses: cacheMisses,
    cache_stale: cacheStale,
    timeouts: timedOut,
    errors: taskErrors.length - capExceeded - rateLimited,
    cap_exceeded: capExceeded,
    rate_limited: rateLimited,
    total_places: totalPlaces,
    duration_ms: durationMs,
    partial: hasPartialFailures,
    limit,
    category_breakdown: categoryBreakdown,
    point_breakdown: pointBreakdown,
  });

  return {
    data: { placesByCategory, partial: hasPartialFailures || undefined },
    cacheStatus: aggregateCacheStatus,
    fallbackUsed,
  };
}

export async function fetchPlaceDetails(
  input: PlaceDetailsRequest,
  logger: LoggerLike,
): Promise<ServiceResult<PlaceDetails | null>> {
  assertPlaceLookup(input);

  const cacheParams = {
    placeId: input.placeId || '',
    title: normalizeText(input.title),
    city: normalizeText(input.city),
  };

  const result = await withCache<PlaceDetails | null>('placeDetails', cacheParams, async () => {
    const venue = await resolveVenueForLookup(input);

    if (!venue) {
      const photo = await fetchWikipediaPhoto(input.title, input.city);
      if (!photo) return null;

      return {
        placeId: input.placeId || `wiki-${normalizeText(`${input.title} ${input.city}`).replace(/\s+/g, '-')}`,
        source: 'wikipedia',
        name: input.title,
        photoUrls: [photo],
        freshness: new Date().toISOString(),
      } satisfies PlaceDetails;
    }

    const details = mapVenueToDetails(venue);
    const fallback = await hydrateDetailsWithWikipedia(
      details,
      input.title,
      input.city,
      inferCategoryFromFSQ(venue.categories, venue.name),
    );

    if (fallback && details.source !== 'foursquare') {
      details.source = 'wikipedia';
    }

    return details;
  });

  logger.info('places.details', 'Fetched place details', {
    title: input.title,
    city: input.city,
    cache_status: result.cacheStatus,
  });

  return {
    ...result,
    fallbackUsed: result.data?.source === 'wikipedia',
  };
}

export async function fetchPlaceSummary(
  input: PlaceSummaryRequest,
  logger: LoggerLike,
): Promise<ServiceResult<PlannerPlaceCandidate | null>> {
  assertPlaceLookup(input);

  const cacheParams = {
    placeId: input.placeId || '',
    title: normalizeText(input.title),
    city: normalizeText(input.city),
    category: input.category || '',
  };

  const result = await withCache<PlannerPlaceCandidate | null>('placeSummary', cacheParams, async () => {
    const venue = await resolveVenueForLookup(input);
    if (!venue) return null;

    const candidate = mapVenueToCandidate(venue, input.category);
    await hydrateCandidatesWithWikipedia([candidate], input.city);
    return candidate;
  });

  logger.info('places.summary', 'Fetched place summary', {
    title: input.title,
    city: input.city,
    cache_status: result.cacheStatus,
  });

  return {
    ...result,
    fallbackUsed: result.data?.source === 'wikipedia',
  };
}

export async function fetchPlacePhotos(
  input: PlacePhotosRequest,
  logger: LoggerLike,
): Promise<ServiceResult<PlacePhotosResponse>> {
  if (!input?.placeId?.trim()) {
    throw new Error('placeId is required');
  }

  const limit = sanitizeLimit(input.limit, input.size === 'gallery' ? 6 : 3, 8);
  const cacheParams = {
    placeId: input.placeId,
    limit,
    size: input.size || 'hero',
  };

  const result = await withCache<PlacePhotosResponse>('placePhotos', cacheParams, async () => {
    if (!isLikelyFoursquareVenueId(input.placeId)) {
      return { placeId: input.placeId, photoUrls: [] };
    }

    const photos = await getPhotos(input.placeId, limit);
    const width = input.size === 'thumb' ? '400x300' : '1200x800';
    return {
      placeId: input.placeId,
      photoUrls: photos.map((photo) => `${photo.prefix}${width}${photo.suffix}`),
    };
  });

  logger.info('places.photos', 'Fetched place photos', {
    placeId: input.placeId,
    limit,
    cache_status: result.cacheStatus,
  });

  return result;
}

export async function fetchPlaceRecommendations(
  input: PlaceRecommendationsRequest,
  logger: LoggerLike,
): Promise<ServiceResult<PlaceRecommendationsResponse>> {
  assertRecommendationsRequest(input);

  const destinations = uniq(input.destinations.map((city) => city.trim()).filter(Boolean)).slice(0, 8);
  const limitPerCity = sanitizeLimit(input.limitPerCity, 4, 6);
  const response: PlaceRecommendationsResponse = { destinations: [] };
  let aggregateCacheStatus: CacheState = 'hit';

  const cityResults = await Promise.all(destinations.map(async (city) => {
    const cacheParams = {
      city: normalizeText(city),
      limitPerCity,
    };

    const result = await withCache<PlannerPlaceCandidate[]>('placeRecommendations', cacheParams, async () => {
      let venues = await searchText({
        query: `top tourist attractions in ${city}`,
        near: city,
        limit: limitPerCity,
      });

      if (venues.length === 0) {
        venues = await searchText({
          query: `${city} attractions`,
          near: city,
          limit: limitPerCity,
        });
      }

      const candidates = dedupeCandidates(venues.map((venue) => mapVenueToCandidate(venue))).slice(0, limitPerCity);
      await hydrateCandidatesWithWikipedia(candidates, city);
      return candidates;
    });

    return { city, ...result };
  }));

  for (const { city, data, cacheStatus } of cityResults) {
    response.destinations.push({ city, places: data });
    if (cacheStatus === 'miss') aggregateCacheStatus = 'miss';
    if (cacheStatus === 'stale' && aggregateCacheStatus !== 'miss') aggregateCacheStatus = 'stale';
  }

  logger.info('places.recommendations', 'Fetched place recommendations', {
    destinations,
    limitPerCity,
    cache_status: aggregateCacheStatus,
  });

  return {
    data: response,
    cacheStatus: aggregateCacheStatus,
    fallbackUsed: response.destinations.some((group) => group.places.some((place) => place.source === 'wikipedia')),
  };
}

export async function fetchPlaceHotelCandidates(
  input: PlaceHotelCandidatesRequest,
  logger: LoggerLike,
): Promise<ServiceResult<PlannerPlaceHotelCandidate[]>> {
  assertHotelCandidatesRequest(input);

  const city = input.city.trim();
  const hotels = input.hotels.slice(0, sanitizeLimit(input.limit, 12, 20));
  const cacheParams = {
    city: normalizeText(city),
    hotelNames: hotels.map((hotel) => normalizeText(hotel.name)),
    lat: roundCoordinate(input.locationBias?.lat ?? 0),
    lng: roundCoordinate(input.locationBias?.lng ?? 0),
  };

  const result = await withCache<PlannerPlaceHotelCandidate[]>('placeHotelCandidates', cacheParams, async () => {
    const matches = await Promise.all(hotels.map(async (hotel): Promise<PlannerPlaceHotelCandidate | null> => {
      const venues = await searchByQuery({
        query: buildVenueSearchQuery(hotel.name, city),
        lat: input.locationBias?.lat,
        lng: input.locationBias?.lng,
        limit: 2,
      });

      const venue = venues[0];
      if (!venue || venue.location?.lat == null || venue.location?.lng == null) {
        return null;
      }

      return {
        ...mapVenueToCandidate(venue, 'hotel'),
        category: 'hotel' as const,
        hotelId: undefined,
        hotel: null,
        provider: undefined,
      } satisfies PlannerPlaceHotelCandidate;
    }));

    return matches.filter((item): item is PlannerPlaceHotelCandidate => item !== null);
  });

  logger.info('places.hotel_candidates', 'Fetched hotel place candidates', {
    city,
    hotels: hotels.length,
    cache_status: result.cacheStatus,
  });

  return result;
}
