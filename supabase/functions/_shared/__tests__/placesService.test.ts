/**
 * Unit tests for `supabase/functions/_shared/places/service.ts`.
 *
 * Strategy: mock at the module boundary (foursquare, wikipedia, cache,
 * jsr:@supabase/supabase-js) so no live HTTP escapes the suite. The SUT is
 * dynamically re-imported per test (`vi.resetModules()` in beforeEach) to
 * reset the module-level `cityCoordinateCache` Map between cases.
 *
 * Coverage groups:
 *   1. resolveCityCoordinates — happy path, cache, no-results, errors, empty city
 *   2. fetchPlaceRecommendations — broad path (no categories)
 *   3. fetchPlaceRecommendations — categorized path (per-category semantic queries)
 *   4. fetchPlaceRecommendations — input contracts + cache hit short-circuit
 *   5. Light coverage of viewport / details / photos / hotel-candidates
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanonicalVenue } from '../places/foursquare.ts';
import type {
  PlaceDetailsRequest,
  PlaceHotelCandidatesRequest,
  PlacePhotosRequest,
  PlaceRecommendationsRequest,
  PlannerPlaceCategory,
  PlacesViewportRequest,
} from '../places/types.ts';

// ---------------------------------------------------------------------------
// Note on the `Deno` global: `service.ts` calls `Deno.env.get` inside
// `createAdminClient`, which is invoked by `withCache`. The shared test
// setup at `src/test/setup.ts` already shims `globalThis.Deno` with a
// no-op `env.get` for vitest, so we don't need to re-stub it here.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Module mocks — vi.mock is hoisted to the top of the file by Vitest, so
// every `await import('../places/service.ts')` below resolves these mocks.
// ---------------------------------------------------------------------------

vi.mock('jsr:@supabase/supabase-js@2', () => ({
  createClient: vi.fn(() => ({})),
}));

vi.mock('../cache.ts', () => ({
  getCachedSearch: vi.fn(async () => null),
  setCachedSearch: vi.fn(async () => undefined),
}));

vi.mock('../places/foursquare.ts', () => ({
  searchText: vi.fn(),
  searchByQuery: vi.fn(),
  searchNearby: vi.fn(),
  getDetails: vi.fn(),
  getPhotos: vi.fn(),
  getVenuePhotoUrl: vi.fn(),
}));

vi.mock('../places/wikipedia.ts', () => ({
  fetchWikipediaPhoto: vi.fn(async () => null),
}));

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

interface VenueOverrides {
  id?: string;
  name?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  ratingSignals?: number;
  categoryCode?: number;
  categoryId?: string;
  categoryName?: string;
  withPhoto?: boolean;
  extraPhotos?: number;
}

function makeVenue(overrides: VenueOverrides = {}): CanonicalVenue {
  const id = overrides.id ?? 'aaaaaaaaaaaaaaaaaaaaaaaa'; // 24-hex valid Foursquare id
  const items = overrides.withPhoto
    ? Array.from({ length: 1 + (overrides.extraPhotos ?? 0) }, (_, i) => ({
        prefix: `https://example.com/p${i}_`,
        suffix: '.jpg',
      }))
    : undefined;

  return {
    id,
    name: overrides.name ?? 'Example Venue',
    location: {
      address: '1 Example Street',
      formattedAddress: ['1 Example Street', 'City'],
      lat: overrides.lat,
      lng: overrides.lng,
    },
    categories: overrides.categoryId || overrides.categoryCode || overrides.categoryName
      ? [{
          id: overrides.categoryId ?? '10027',
          name: overrides.categoryName ?? 'Museum',
          categoryCode: overrides.categoryCode,
        }]
      : undefined,
    rating: overrides.rating,
    ratingSignals: overrides.ratingSignals,
    photos: items ? { groups: [{ items }] } : undefined,
  };
}

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Type alias for the dynamically-imported module surface, kept loose so we
// don't drag the full `service.ts` types through every test.
// ---------------------------------------------------------------------------

type ServiceModule = typeof import('../places/service.ts');
type FsqModule = typeof import('../places/foursquare.ts');
type CacheModule = typeof import('../cache.ts');
type WikiModule = typeof import('../places/wikipedia.ts');

interface Suite {
  service: ServiceModule;
  fsq: FsqModule;
  cache: CacheModule;
  wiki: WikiModule;
}

async function loadSuite(): Promise<Suite> {
  // Resetting modules ensures the module-level `cityCoordinateCache` Map in
  // service.ts starts empty for each test.
  vi.resetModules();
  const fsq = await import('../places/foursquare.ts');
  const cache = await import('../cache.ts');
  const wiki = await import('../places/wikipedia.ts');
  const service = await import('../places/service.ts');

  // Reset call history but preserve mock identities.
  vi.mocked(fsq.searchText).mockReset();
  vi.mocked(fsq.searchByQuery).mockReset();
  vi.mocked(fsq.searchNearby).mockReset();
  vi.mocked(fsq.getDetails).mockReset();
  vi.mocked(fsq.getPhotos).mockReset();
  vi.mocked(fsq.getVenuePhotoUrl).mockReset();
  vi.mocked(cache.getCachedSearch).mockReset();
  vi.mocked(cache.setCachedSearch).mockReset();
  vi.mocked(wiki.fetchWikipediaPhoto).mockReset();

  // Defaults: cache miss, no Wikipedia fallback, getVenuePhotoUrl returns first photo URL.
  vi.mocked(cache.getCachedSearch).mockResolvedValue(null);
  vi.mocked(cache.setCachedSearch).mockResolvedValue(undefined);
  vi.mocked(wiki.fetchWikipediaPhoto).mockResolvedValue(null);
  vi.mocked(fsq.getVenuePhotoUrl).mockImplementation((venue, size = '400x300') => {
    const photo = venue.bestPhoto || venue.photos?.groups?.[0]?.items?.[0];
    if (!photo) return undefined;
    return `${photo.prefix}${size}${photo.suffix}`;
  });

  return { service, fsq, cache, wiki };
}

let suite: Suite;

beforeEach(async () => {
  suite = await loadSuite();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Group 1 — resolveCityCoordinates
// ===========================================================================

describe('resolveCityCoordinates', () => {
  it('returns coords on Foursquare hit', async () => {
    const { service, fsq } = suite;
    vi.mocked(fsq.searchText).mockResolvedValueOnce([
      makeVenue({ lat: 48.8566, lng: 2.3522 }),
    ]);

    const logger = makeLogger();
    const coords = await service.resolveCityCoordinates('Paris', 'France', logger);

    expect(coords).toEqual({ lat: 48.8566, lng: 2.3522 });
    expect(fsq.searchText).toHaveBeenCalledTimes(1);
    expect(fsq.searchText).toHaveBeenCalledWith({
      query: 'Paris',
      near: 'Paris, France',
      limit: 1,
    });
  });

  it('caches positive results — second call does not re-query Foursquare', async () => {
    const { service, fsq } = suite;
    vi.mocked(fsq.searchText).mockResolvedValueOnce([
      makeVenue({ lat: 40.4168, lng: -3.7038 }),
    ]);

    const first = await service.resolveCityCoordinates('Madrid');
    const second = await service.resolveCityCoordinates('Madrid');

    expect(first).toEqual({ lat: 40.4168, lng: -3.7038 });
    expect(second).toEqual({ lat: 40.4168, lng: -3.7038 });
    expect(fsq.searchText).toHaveBeenCalledTimes(1);
  });

  it('returns null and caches it when Foursquare returns no venues', async () => {
    const { service, fsq } = suite;
    vi.mocked(fsq.searchText).mockResolvedValueOnce([]);

    const first = await service.resolveCityCoordinates('Atlantis');
    const second = await service.resolveCityCoordinates('Atlantis');

    expect(first).toBeNull();
    expect(second).toBeNull();
    // Negative result is cached too — no re-fetch on subsequent calls.
    expect(fsq.searchText).toHaveBeenCalledTimes(1);
  });

  it('returns null on Foursquare error, logs warn, does NOT poison cache', async () => {
    const { service, fsq } = suite;
    vi.mocked(fsq.searchText)
      .mockRejectedValueOnce(new Error('rate_limited'))
      .mockResolvedValueOnce([makeVenue({ lat: 1, lng: 2 })]);

    const logger = makeLogger();
    const first = await service.resolveCityCoordinates('Tokyo', null, logger);
    expect(first).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'places.geocode',
      'City coordinate resolution failed',
      expect.objectContaining({ city: 'Tokyo', reason: 'rate_limited' }),
    );

    // Errors do not poison the cache — second call retries.
    const second = await service.resolveCityCoordinates('Tokyo', null, logger);
    expect(second).toEqual({ lat: 1, lng: 2 });
    expect(fsq.searchText).toHaveBeenCalledTimes(2);
  });

  it('returns null for empty city without calling Foursquare', async () => {
    const { service, fsq } = suite;

    const result = await service.resolveCityCoordinates('   ');
    expect(result).toBeNull();
    expect(fsq.searchText).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Group 2 — fetchPlaceRecommendations: broad path (no `categories` provided)
// ===========================================================================

describe('fetchPlaceRecommendations — broad path', () => {
  it('happy path returns mapped places with rating halved and photos extracted', async () => {
    const { service, fsq } = suite;
    vi.mocked(fsq.searchText).mockResolvedValueOnce([
      makeVenue({
        id: 'a'.repeat(24),
        name: 'Eiffel Tower',
        rating: 9.2, // Foursquare 0-10 → mapped to 4.6 (0-5)
        ratingSignals: 1000,
        categoryId: '16026',
        withPhoto: true,
      }),
      makeVenue({
        id: 'b'.repeat(24),
        name: 'Louvre',
        rating: 9.0,
        categoryId: '10027',
        withPhoto: true,
      }),
    ]);

    const logger = makeLogger();
    const input: PlaceRecommendationsRequest = { destinations: ['Paris'] };
    const out = await service.fetchPlaceRecommendations(input, logger);

    expect(out.data.destinations).toHaveLength(1);
    const places = out.data.destinations[0].places;
    expect(places).toHaveLength(2);
    // Rating halved (Foursquare 0-10 → 0-5).
    expect(places[0].rating).toBeCloseTo(4.6, 1);
    expect(places[0].photoUrls.length).toBeGreaterThan(0);
    // Broad path query was used.
    expect(fsq.searchText).toHaveBeenCalledWith({
      query: 'top tourist attractions in Paris',
      near: 'Paris',
      limit: 4,
    });
  });

  it('falls back to "${city} attractions" when first query returns empty', async () => {
    const { service, fsq } = suite;
    vi.mocked(fsq.searchText)
      .mockResolvedValueOnce([]) // first attempt empty
      .mockResolvedValueOnce([makeVenue({ name: 'Plaza Mayor', categoryId: '16026' })]);

    const out = await service.fetchPlaceRecommendations(
      { destinations: ['Madrid'] },
      makeLogger(),
    );

    expect(out.data.destinations[0].places).toHaveLength(1);
    expect(fsq.searchText).toHaveBeenCalledTimes(2);
    expect(fsq.searchText).toHaveBeenNthCalledWith(2, {
      query: 'Madrid attractions',
      near: 'Madrid',
      limit: 4,
    });
  });

  it('deduplicates venues with the same placeId', async () => {
    const { service, fsq } = suite;
    const dupId = 'c'.repeat(24);
    vi.mocked(fsq.searchText).mockResolvedValueOnce([
      makeVenue({ id: dupId, name: 'Same Place', rating: 5 }),
      makeVenue({ id: dupId, name: 'Same Place', rating: 8 }),
    ]);

    const out = await service.fetchPlaceRecommendations(
      { destinations: ['Lisbon'] },
      makeLogger(),
    );

    expect(out.data.destinations[0].places).toHaveLength(1);
  });

  it('caps results at limitPerCity in the broad path', async () => {
    const { service, fsq } = suite;
    const venues = Array.from({ length: 8 }, (_, i) =>
      makeVenue({ id: String(i).padStart(24, '0'), name: `Place ${i}`, rating: 8 - i * 0.1 }),
    );
    vi.mocked(fsq.searchText).mockResolvedValueOnce(venues);

    const out = await service.fetchPlaceRecommendations(
      { destinations: ['Rome'], limitPerCity: 3 },
      makeLogger(),
    );

    expect(out.data.destinations[0].places).toHaveLength(3);
  });
});

// ===========================================================================
// Group 3 — fetchPlaceRecommendations: categorized path
// ===========================================================================

describe('fetchPlaceRecommendations — categorized path', () => {
  it('builds semantic per-category queries (nightlife / museum)', async () => {
    const { service, fsq } = suite;
    vi.mocked(fsq.searchText)
      .mockResolvedValueOnce([makeVenue({ id: '1'.repeat(24), name: 'Bar 1' })])
      .mockResolvedValueOnce([makeVenue({ id: '2'.repeat(24), name: 'Museum 1' })]);

    const input: PlaceRecommendationsRequest = {
      destinations: ['Madrid'],
      categories: ['nightlife', 'museum'] as PlannerPlaceCategory[],
    };
    await service.fetchPlaceRecommendations(input, makeLogger());

    const calls = vi.mocked(fsq.searchText).mock.calls;
    const queries = calls.map((c) => (c[0] as { query: string }).query);
    expect(queries).toContain('bars and nightlife in Madrid');
    expect(queries).toContain('museums in Madrid');
  });

  it('forces the requested category onto venues (overrides FSQ inference)', async () => {
    const { service, fsq } = suite;
    // Venue has restaurant FSQ id (13065) but we ask for nightlife — output
    // must carry category=nightlife because the categorized path forces it.
    vi.mocked(fsq.searchText).mockResolvedValueOnce([
      makeVenue({ id: 'd'.repeat(24), name: 'Some Bar', categoryId: '13065', categoryCode: 13065 }),
    ]);

    const out = await service.fetchPlaceRecommendations(
      { destinations: ['Berlin'], categories: ['nightlife'] as PlannerPlaceCategory[] },
      makeLogger(),
    );

    expect(out.data.destinations[0].places[0].category).toBe('nightlife');
  });

  it('falls back to "${city} attractions" when every per-category query is empty', async () => {
    const { service, fsq } = suite;
    vi.mocked(fsq.searchText)
      .mockResolvedValueOnce([]) // nightlife
      .mockResolvedValueOnce([]) // museum
      .mockResolvedValueOnce([makeVenue({ id: 'e'.repeat(24), name: 'Catch-all' })]);

    const out = await service.fetchPlaceRecommendations(
      {
        destinations: ['Reykjavik'],
        categories: ['nightlife', 'museum'] as PlannerPlaceCategory[],
      },
      makeLogger(),
    );

    const calls = vi.mocked(fsq.searchText).mock.calls;
    const queries = calls.map((c) => (c[0] as { query: string }).query);
    expect(queries).toContain('Reykjavik attractions');
    expect(out.data.destinations[0].places).toHaveLength(1);
  });

  it('silently filters unknown category strings out of the request', async () => {
    const { service, fsq } = suite;
    vi.mocked(fsq.searchText).mockResolvedValueOnce([
      makeVenue({ id: 'f'.repeat(24), name: 'Tapas Bar' }),
    ]);

    await service.fetchPlaceRecommendations(
      {
        destinations: ['Seville'],
        // Deliberately pass an unknown category alongside a valid one.
        categories: ['restaurant', 'totally-bogus' as unknown as PlannerPlaceCategory],
      },
      makeLogger(),
    );

    // Only the valid 'restaurant' category triggers a per-category call.
    expect(fsq.searchText).toHaveBeenCalledTimes(1);
    const firstCall = vi.mocked(fsq.searchText).mock.calls[0][0] as { query: string };
    expect(firstCall.query).toBe('restaurants in Seville');
  });

  it('dedupes venues that show up across two categories', async () => {
    const { service, fsq } = suite;
    const dupId = '9'.repeat(24);
    // Same id returned for both per-category queries → dedupeCandidates collapses to 1.
    vi.mocked(fsq.searchText)
      .mockResolvedValueOnce([makeVenue({ id: dupId, name: 'Hybrid Spot', rating: 6 })])
      .mockResolvedValueOnce([makeVenue({ id: dupId, name: 'Hybrid Spot', rating: 6 })]);

    const out = await service.fetchPlaceRecommendations(
      {
        destinations: ['Oslo'],
        categories: ['restaurant', 'cafe'] as PlannerPlaceCategory[],
      },
      makeLogger(),
    );

    expect(out.data.destinations[0].places).toHaveLength(1);
  });
});

// ===========================================================================
// Group 4 — fetchPlaceRecommendations: input contracts + cache short-circuit
// ===========================================================================

describe('fetchPlaceRecommendations — input contracts & cache', () => {
  it('throws when destinations is empty', async () => {
    const { service } = suite;
    await expect(
      service.fetchPlaceRecommendations({ destinations: [] }, makeLogger()),
    ).rejects.toThrow('destinations is required');
  });

  it('dedups + caps destinations at 8', async () => {
    const { service, fsq } = suite;
    vi.mocked(fsq.searchText).mockResolvedValue([]); // empty everywhere; broad fallback also empty

    // 10 unique cities + 2 dupes — only 8 unique should be processed.
    const cities = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'A', 'B'];
    const out = await service.fetchPlaceRecommendations(
      { destinations: cities },
      makeLogger(),
    );

    expect(out.data.destinations).toHaveLength(8);
    const seen = new Set(out.data.destinations.map((d) => d.city));
    expect(seen.size).toBe(8);
  });

  it('reports cacheStatus="hit" and skips the provider when cache is fresh', async () => {
    const { service, fsq, cache } = suite;
    vi.mocked(cache.getCachedSearch).mockResolvedValueOnce({
      results: [
        {
          placeId: 'cached',
          name: 'Cached Place',
          photoUrls: [],
          category: 'museum' as PlannerPlaceCategory,
        },
      ],
      status: 'fresh',
    });

    const out = await service.fetchPlaceRecommendations(
      { destinations: ['Paris'] },
      makeLogger(),
    );

    expect(out.cacheStatus).toBe('hit');
    expect(out.data.destinations[0].places[0].placeId).toBe('cached');
    expect(fsq.searchText).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Group 5 — viewport / details / photos / hotel-candidates (light coverage)
// ===========================================================================

describe('viewport / details / photos / hotel-candidates', () => {
  it('fetchViewportPlaces rejects without a city', async () => {
    const { service } = suite;
    const input = {
      city: '',
      location: { lat: 48.85, lng: 2.35 },
    } as PlacesViewportRequest;

    await expect(service.fetchViewportPlaces(input, makeLogger())).rejects.toThrow(
      'city is required',
    );
  });

  it('fetchViewportPlaces rejects without numeric location.lat / lng', async () => {
    const { service } = suite;
    const input = {
      city: 'Paris',
      location: { lat: Number.NaN, lng: 2.35 },
    } as PlacesViewportRequest;

    await expect(service.fetchViewportPlaces(input, makeLogger())).rejects.toThrow(
      'location.lat and location.lng are required',
    );
  });

  it('fetchPlaceDetails returns Wikipedia fallback when Foursquare yields no venue', async () => {
    const { service, fsq, wiki } = suite;
    vi.mocked(fsq.searchByQuery).mockResolvedValueOnce([]);
    vi.mocked(wiki.fetchWikipediaPhoto).mockResolvedValueOnce('https://wiki.example/photo.jpg');

    const input: PlaceDetailsRequest = { title: 'Mystery Place', city: 'Nowhere' };
    const out = await service.fetchPlaceDetails(input, makeLogger());

    expect(out.data?.source).toBe('wikipedia');
    expect(out.data?.photoUrls).toEqual(['https://wiki.example/photo.jpg']);
    expect(out.fallbackUsed).toBe(true);
  });

  it('fetchPlacePhotos returns an empty list when placeId is not a valid Foursquare id', async () => {
    const { service, fsq } = suite;
    const input: PlacePhotosRequest = { placeId: 'not-a-foursquare-id' };

    const out = await service.fetchPlacePhotos(input, makeLogger());

    expect(out.data.photoUrls).toEqual([]);
    expect(fsq.getPhotos).not.toHaveBeenCalled();
  });

  it('fetchPlaceHotelCandidates filters out venues that lack lat/lng', async () => {
    const { service, fsq } = suite;
    vi.mocked(fsq.searchByQuery)
      // First hotel: venue without lat/lng → dropped.
      .mockResolvedValueOnce([
        makeVenue({ id: 'h'.repeat(24), name: 'Hotel A' }),
      ])
      // Second hotel: venue with coords → kept.
      .mockResolvedValueOnce([
        makeVenue({ id: 'i'.repeat(24), name: 'Hotel B', lat: 41.4, lng: 2.17 }),
      ]);

    const input: PlaceHotelCandidatesRequest = {
      city: 'Barcelona',
      hotels: [
        { name: 'Hotel A' },
        { name: 'Hotel B' },
      ],
    };
    const out = await service.fetchPlaceHotelCandidates(input, makeLogger());

    expect(out.data).toHaveLength(1);
    expect(out.data[0].name).toBe('Hotel B');
    expect(out.data[0].category).toBe('hotel');
  });
});
