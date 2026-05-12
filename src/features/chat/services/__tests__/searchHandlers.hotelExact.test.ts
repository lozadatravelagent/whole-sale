/**
 * Tests for the exact-match-first hotel flow — Phase 2 / sub-task C.
 *
 * Covers the four `responseMode` outcomes emitted by `handleHotelSearch`:
 *   - exact_match                    (hotelName specified, results > 0)
 *   - alternatives_no_availability   (hotelName specified, 0 hits → city-broad fallback returns >0)
 *   - hotel_not_in_destination       (hotelName specified, both calls return 0)
 *   - generic_search                 (chain-only or multi-name; existing behavior preserved)
 *
 * Plus a regression test that the `uncoveredChains` filter is bypassed when
 * entering exact-match mode (so chain alternatives remain available for the
 * fallback path).
 *
 * The SOAP edge function is mocked at the supabase client boundary; storage
 * helpers are also mocked so the tests do not touch IndexedDB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { LocalHotelData } from '@/types/external';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockInvoke, mockSaveHotels, mockGenerateHotelSearchId, mockGetCityCode } = vi.hoisted(() => {
  const mockInvoke = vi.fn();
  const mockSaveHotels = vi.fn(async () => undefined);
  const mockGenerateHotelSearchId = vi.fn(() => 'hotel-search-id-test');
  const mockGetCityCode = vi.fn(async (city: string) => {
    // Lightweight deterministic mapping for test cities.
    const map: Record<string, string> = {
      Aruba: 'AUA',
      'Punta Cana': 'PUJ',
      'Cancún': 'CUN',
    };
    return map[city] || 'AUA';
  });
  return { mockInvoke, mockSaveHotels, mockGenerateHotelSearchId, mockGetCityCode };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}));

vi.mock('../hotelStorageService', () => ({
  generateHotelSearchId: mockGenerateHotelSearchId,
  saveHotelsToStorage: mockSaveHotels,
}));

vi.mock('@/services/cityCodeMapping', () => ({
  getCityCode: mockGetCityCode,
}));

// Import AFTER mocks
import { handleHotelSearch } from '../searchHandlers';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeHotel(name: string, city: string, price = 1000): LocalHotelData {
  return {
    name,
    city,
    nights: 7,
    check_in: '2026-07-10',
    check_out: '2026-07-17',
    rooms: [
      {
        type: 'DBL',
        description: 'Habitación doble',
        total_price: price,
        currency: 'USD',
        meal_plan: 'all_inclusive',
        availability: 'available',
      } as unknown as LocalHotelData['rooms'][number],
    ],
  } as unknown as LocalHotelData;
}

function makeHotelRequest(overrides: Partial<NonNullable<ParsedTravelRequest['hotels']>>): ParsedTravelRequest {
  return {
    requestType: 'hotels',
    confidence: 0.95,
    originalMessage: '',
    responseLanguage: 'es',
    hotels: {
      city: 'Aruba',
      checkinDate: '2026-07-10',
      checkoutDate: '2026-07-17',
      adults: 2,
      adultsExplicit: true,
      children: 0,
      ...overrides,
    },
  } as unknown as ParsedTravelRequest;
}

beforeEach(() => {
  mockInvoke.mockReset();
  mockSaveHotels.mockClear();
});

// ---------------------------------------------------------------------------
// Suite 1: exact_match
// ---------------------------------------------------------------------------

describe('handleHotelSearch — responseMode = exact_match', () => {
  it('returns exact_match when hotelName is specified and SOAP returns hits, boosting exact-name matches to top of price-sorted list', async () => {
    // SOAP returns the requested hotel + a cheaper non-matching hotel.
    // Without the boost, sort-by-price would put "Cheaper Other" first;
    // with the boost, "Riu Palace Aruba" must be position 0.
    mockInvoke.mockResolvedValueOnce({
      data: {
        results: [
          makeHotel('Cheaper Other Hotel', 'Aruba', 500),
          makeHotel('Riu Palace Aruba', 'Aruba', 1500),
        ],
      },
      error: null,
    });

    const parsed = makeHotelRequest({ hotelName: 'Riu Palace Aruba' });
    const result = await handleHotelSearch(parsed);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [, firstCallArgs] = mockInvoke.mock.calls[0];
    expect(firstCallArgs.body.data.hotelName).toBe('Riu Palace Aruba');
    expect(firstCallArgs.body.data.cityCode).toBe('AUA');

    expect(result.data.combinedData.hotelResponseMode).toBe('exact_match');
    expect(result.data.combinedData.requestedHotelName).toBe('Riu Palace Aruba');
    expect(result.data.combinedData.hotels[0].name).toBe('Riu Palace Aruba');
    // Heading copy must mention the requested hotel name.
    expect(result.response).toContain('Riu Palace Aruba');
  });

  it('treats single-element hotelNames (no chain) as a specific request → exact_match', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { results: [makeHotel('Iberostar Dominicana', 'Punta Cana', 1200)] },
      error: null,
    });

    const parsed = makeHotelRequest({
      city: 'Punta Cana',
      hotelNames: ['Iberostar Dominicana'],
    });
    const result = await handleHotelSearch(parsed);

    expect(result.data.combinedData.hotelResponseMode).toBe('exact_match');
    expect(mockInvoke).toHaveBeenCalledTimes(1); // exact-match branch, no parallel calls
  });
});

// ---------------------------------------------------------------------------
// Suite 2: alternatives_no_availability
// ---------------------------------------------------------------------------

describe('handleHotelSearch — responseMode = alternatives_no_availability', () => {
  it('falls back to city-broad SOAP when exact-name returns 0 hits', async () => {
    // First call: exact name → 0 hits.
    mockInvoke.mockResolvedValueOnce({ data: { results: [] }, error: null });
    // Second call: city-broad fallback → 2 hotels.
    mockInvoke.mockResolvedValueOnce({
      data: {
        results: [
          makeHotel('Some Other Aruba Resort', 'Aruba', 800),
          makeHotel('Tamarijn Aruba', 'Aruba', 950),
        ],
      },
      error: null,
    });

    const parsed = makeHotelRequest({ hotelName: 'Riu Palace Aruba' });
    const result = await handleHotelSearch(parsed);

    expect(mockInvoke).toHaveBeenCalledTimes(2);

    // First call has the name filter
    expect(mockInvoke.mock.calls[0][1].body.data.hotelName).toBe('Riu Palace Aruba');
    // Second call (fallback) has empty name filter
    expect(mockInvoke.mock.calls[1][1].body.data.hotelName).toBe('');

    expect(result.data.combinedData.hotelResponseMode).toBe('alternatives_no_availability');
    expect(result.data.combinedData.hotels.length).toBe(2);
    // Copy must call out both the missing hotel and that we are showing alternatives.
    expect(result.response).toContain('Riu Palace Aruba');
    expect(result.response.toLowerCase()).toMatch(/alternativa|disponibilidad/);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: hotel_not_in_destination
// ---------------------------------------------------------------------------

describe('handleHotelSearch — responseMode = hotel_not_in_destination', () => {
  it('returns hotel_not_in_destination when both exact and city-broad calls return 0 hits', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { results: [] }, error: null });
    mockInvoke.mockResolvedValueOnce({ data: { results: [] }, error: null });

    const parsed = makeHotelRequest({ hotelName: 'Hotel Que No Existe' });
    const result = await handleHotelSearch(parsed);

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(result.data.combinedData.hotelResponseMode).toBe('hotel_not_in_destination');
    expect(result.data.combinedData.hotels.length).toBe(0);
    // Copy should prompt the user with a recovery question.
    expect(result.response).toContain('Hotel Que No Existe');
    expect(result.response).toMatch(/\?/); // contains a recovery question mark
  });
});

// ---------------------------------------------------------------------------
// Suite 4: generic_search (preserve existing behavior)
// ---------------------------------------------------------------------------

describe('handleHotelSearch — responseMode = generic_search (existing flows)', () => {
  it('multiple hotelNames keeps generic_search behavior (no exact-match branching)', async () => {
    // Parallel pool fires N requests (one per name); each returns a different hotel.
    mockInvoke.mockResolvedValue({
      data: { results: [makeHotel('RIU Bambu', 'Punta Cana', 900)] },
      error: null,
    });

    const parsed = makeHotelRequest({
      city: 'Punta Cana',
      hotelNames: ['RIU Bambu', 'Iberostar Dominicana'],
    });
    const result = await handleHotelSearch(parsed);

    expect(result.data.combinedData.hotelResponseMode).toBe('generic_search');
    // Heading should be the generic "X Hoteles Disponibles" copy, NOT exact-match copy.
    expect(result.response).toMatch(/Hoteles Disponibles/);
  });

  it('chain-only request (hotelChains, no hotelName) keeps generic_search behavior', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        results: [
          makeHotel('RIU Republica', 'Punta Cana', 1100),
          makeHotel('RIU Palace Punta Cana', 'Punta Cana', 1300),
        ],
      },
      error: null,
    });

    const parsed = makeHotelRequest({
      city: 'Punta Cana',
      hotelChains: ['Riu'],
    });
    const result = await handleHotelSearch(parsed);

    expect(result.data.combinedData.hotelResponseMode).toBe('generic_search');
    // No exact-match heading for chain-only requests.
    expect(result.response).toMatch(/Hoteles Disponibles/);
  });
});

// ---------------------------------------------------------------------------
// Suite 5: uncoveredChains bypass
// ---------------------------------------------------------------------------

describe('handleHotelSearch — uncoveredChains is bypassed in exact_match mode', () => {
  it('with hotelName + chain present, runs the exact-match flow (single SOAP call) instead of the chain-coverage parallel flow', async () => {
    // If uncoveredChains were NOT bypassed, the code would fire a parallel
    // batch with at least the chain task. By asserting only ONE invoke
    // happens (the exact-name call), we guarantee the bypass works.
    mockInvoke.mockResolvedValueOnce({
      data: { results: [makeHotel('Riu Palace Aruba', 'Aruba', 1500)] },
      error: null,
    });

    const parsed = makeHotelRequest({
      hotelName: 'Riu Palace Aruba',
      hotelChains: ['Riu'],
    });
    const result = await handleHotelSearch(parsed);

    // Only the exact-match call — no parallel chain-coverage fan-out.
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.data.combinedData.hotelResponseMode).toBe('exact_match');
  });
});
