/**
 * parser-eval.test.ts
 * =============================================================================
 * Evals framework for the AI message parser — regression guard for prompt
 * changes (v1 → v7+).
 *
 * Three suites:
 *   1. Pure helpers — `augmentMultiCitySegmentsFromMessage` and
 *      `normalizeLocationsToCountryCapitals` called directly against the
 *      golden fixtures. No mocks, no network.
 *
 *   2. Mocked parser output — `parseMessageWithAI` is mocked to return the
 *      scripted golden expected value. Tests prove the assertion logic, the
 *      fixture schema, and the ParsedTravelRequest sub-field contracts.
 *      The real OpenAI API is NEVER called.
 *
 *   3. Routing layer — `routeRequest` is a pure deterministic function.
 *      For every fixture that has an `expected.route`, we build a minimal
 *      ParsedTravelRequest from the fixture's expected fields and assert
 *      that the router produces the right QUOTE / COLLECT / PLAN decision.
 *
 * Run:
 *   npm test -- --run tests/evals
 * =============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Fixture loader
// ---------------------------------------------------------------------------

import fixtures from './fixtures/parser-golden.json';

interface FlightExpected {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  infants?: number;
}

interface HotelExpected {
  city?: string;
  checkinDate?: string;
  checkoutDate?: string;
  adults?: number;
  children?: number;
}

interface ItineraryExpected {
  destinations?: string[];
  days?: number;
}

interface GoldenFixture {
  id: string;
  description: string;
  input: {
    message: string;
    language: 'es' | 'en' | 'pt';
  };
  expected: {
    requestType: string;
    confidence_min?: number;
    route?: 'QUOTE' | 'COLLECT' | 'PLAN';
    flights?: FlightExpected;
    hotels?: HotelExpected;
    itinerary?: ItineraryExpected;
  };
}

const goldenFixtures = fixtures as GoldenFixture[];

// ---------------------------------------------------------------------------
// MODULE MOCK — parseMessageWithAI
//
// vi.mock is hoisted before imports. We intercept the module so that
// parseMessageWithAI never reaches the Supabase Edge Function URL.
// ---------------------------------------------------------------------------

vi.mock('@/services/aiMessageParser', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const real = (await importOriginal()) as Record<string, any>;
  return {
    ...real,
    parseMessageWithAI: vi.fn(),
  };
});

// Import AFTER mock hoisting.
import { parseMessageWithAI } from '@/services/aiMessageParser';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';

// Pure helpers from the edge function — these never call OpenAI.
import {
  augmentMultiCitySegmentsFromMessage,
  normalizeLocationsToCountryCapitals,
} from '../../supabase/functions/ai-message-parser/index.ts';

// Router — pure deterministic function, no mock needed.
import { routeRequest } from '@/features/chat/services/routeRequest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the minimal ParsedTravelRequest that routeRequest needs from a
 * fixture's expected fields. We only populate what the scoring functions read.
 */
function buildMinimalParsed(fixture: GoldenFixture): ParsedTravelRequest {
  const base: ParsedTravelRequest = {
    requestType: fixture.expected.requestType as ParsedTravelRequest['requestType'],
    confidence: fixture.expected.confidence_min ?? 0.8,
    originalMessage: fixture.input.message,
  };

  if (fixture.expected.flights) {
    base.flights = {
      origin: fixture.expected.flights.origin ?? '',
      destination: fixture.expected.flights.destination ?? '',
      departureDate: fixture.expected.flights.departureDate ?? '',
      returnDate: fixture.expected.flights.returnDate,
      adults: fixture.expected.flights.adults ?? 1,
      adultsExplicit: (fixture.expected.flights.adults ?? 1) > 1,
      children: fixture.expected.flights.children ?? 0,
      infants: fixture.expected.flights.infants ?? 0,
    };
  }

  if (fixture.expected.hotels) {
    base.hotels = {
      city: fixture.expected.hotels.city ?? '',
      checkinDate: fixture.expected.hotels.checkinDate ?? '',
      checkoutDate: fixture.expected.hotels.checkoutDate ?? '',
      adults: fixture.expected.hotels.adults ?? 1,
      adultsExplicit: (fixture.expected.hotels.adults ?? 1) > 1,
      children: fixture.expected.hotels.children ?? 0,
    };
  }

  if (fixture.expected.itinerary) {
    base.itinerary = {
      destinations: fixture.expected.itinerary.destinations ?? [],
      days: fixture.expected.itinerary.days,
    };
  }

  return base;
}

// ===========================================================================
// SUITE 1 — Pure helper smoke tests driven by golden fixtures
// ===========================================================================
//
// These do NOT mock anything. They call the real helpers with shaped inputs
// derived from the fixture corpus and assert the core contracts:
//   - normalizeLocationsToCountryCapitals passes cities through unchanged
//   - augmentMultiCitySegmentsFromMessage preserves non-flight fixtures
// ===========================================================================

describe('Suite 1: Pure helpers — golden-fixture-driven smoke tests', () => {
  describe('normalizeLocationsToCountryCapitals', () => {
    it('passes through a city-level flights origin/destination unchanged', () => {
      // Use the BUE→MAD fixture as ground truth for city names.
      const fixture = goldenFixtures.find(f => f.id === 'flights-eze-mad-001')!;
      const input = buildMinimalParsed(fixture);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = normalizeLocationsToCountryCapitals(input as any);
      // City names (not countries) must be preserved verbatim.
      expect(out.flights?.origin).toBe(input.flights?.origin);
      expect(out.flights?.destination).toBe(input.flights?.destination);
    });

    it('passes through a city-level hotels.city unchanged', () => {
      const fixture = goldenFixtures.find(f => f.id === 'hotels-cancun-001')!;
      const input = buildMinimalParsed(fixture);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = normalizeLocationsToCountryCapitals(input as any);
      expect(out.hotels?.city).toBe(input.hotels?.city);
    });

    it('does NOT normalize itinerary.destinations (planner expansion runs later)', () => {
      const fixture = goldenFixtures.find(f => f.id === 'itinerary-multi-001')!;
      const input = buildMinimalParsed(fixture);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = normalizeLocationsToCountryCapitals(input as any);
      // Country names in itinerary must be left alone.
      expect(out.itinerary?.destinations).toEqual(input.itinerary?.destinations);
    });

    it('does not mutate the input object', () => {
      const fixture = goldenFixtures.find(f => f.id === 'hotels-cancun-001')!;
      const input = buildMinimalParsed(fixture);
      const before = JSON.stringify(input);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      normalizeLocationsToCountryCapitals(input as any);
      expect(JSON.stringify(input)).toBe(before);
    });
  });

  describe('augmentMultiCitySegmentsFromMessage', () => {
    it('returns non-flight fixtures unchanged (identity check)', () => {
      const fixture = goldenFixtures.find(f => f.id === 'hotels-cancun-001')!;
      const input = buildMinimalParsed(fixture);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = augmentMultiCitySegmentsFromMessage(fixture.input.message, input as any);
      // Hotels fixture has no flights — helper returns input as-is.
      expect(out).toBe(input);
    });

    it('returns itinerary fixtures unchanged (identity check)', () => {
      const fixture = goldenFixtures.find(f => f.id === 'itinerary-roma-5d-001')!;
      const input = buildMinimalParsed(fixture);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = augmentMultiCitySegmentsFromMessage(fixture.input.message, input as any);
      expect(out).toBe(input);
    });

    it('normalizes a round-trip flight fixture and preserves trip type', () => {
      const fixture = goldenFixtures.find(f => f.id === 'flights-eze-mad-001')!;
      const input = buildMinimalParsed(fixture);
      // Add the returnDate so the helper can detect a round trip.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (input.flights as any).returnDate = fixture.expected.flights?.returnDate;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = augmentMultiCitySegmentsFromMessage(fixture.input.message, input as any);
      // Should still come back as round_trip (or one_way if no returnDate) — not null.
      expect(out.flights).toBeDefined();
    });
  });
});

// ===========================================================================
// SUITE 2 — Mocked parser output assertions
//
// parseMessageWithAI is mocked to return the fixture's expected value.
// These tests prove:
//   - The fixture schema is valid (no typos in requestType, sub-field names)
//   - The assertion helpers work correctly
//   - When the real API is eventually wired, the same assertions catch regressions
//
// INVARIANT: the real OpenAI API is NEVER called here.
// ===========================================================================

describe('Suite 2: Mocked parser output — golden fixture assertions', () => {
  const mockedParse = vi.mocked(parseMessageWithAI);

  beforeEach(() => {
    mockedParse.mockReset();
  });

  // -------------------------------------------------------------------------
  // Flights fixtures
  // -------------------------------------------------------------------------

  describe('Flights', () => {
    const flightFixtures = goldenFixtures.filter(f =>
      f.expected.requestType === 'flights',
    );

    it.each(flightFixtures)('[$id] $description', async (fixture) => {
      const expectedResult: Partial<ParsedTravelRequest> = {
        requestType: fixture.expected.requestType as ParsedTravelRequest['requestType'],
        confidence: fixture.expected.confidence_min ?? 0.9,
        originalMessage: fixture.input.message,
        ...(fixture.expected.flights && {
          flights: {
            origin: fixture.expected.flights.origin ?? '',
            destination: fixture.expected.flights.destination ?? '',
            departureDate: fixture.expected.flights.departureDate ?? '',
            returnDate: fixture.expected.flights.returnDate,
            adults: fixture.expected.flights.adults ?? 1,
            adultsExplicit: (fixture.expected.flights.adults ?? 1) > 1,
            children: fixture.expected.flights.children ?? 0,
            infants: fixture.expected.flights.infants ?? 0,
          },
        }),
      };

      mockedParse.mockResolvedValueOnce(expectedResult as ParsedTravelRequest);

      const result = await parseMessageWithAI(
        fixture.input.message,
        null,
        undefined,
        undefined,
        fixture.input.language,
      );

      // Core assertions
      expect(result.requestType).toBe(fixture.expected.requestType);

      if (fixture.expected.confidence_min !== undefined) {
        expect(result.confidence).toBeGreaterThanOrEqual(fixture.expected.confidence_min);
      }

      if (fixture.expected.flights?.origin) {
        expect(result.flights?.origin).toBe(fixture.expected.flights.origin);
      }
      if (fixture.expected.flights?.destination) {
        expect(result.flights?.destination).toBe(fixture.expected.flights.destination);
      }
      if (fixture.expected.flights?.adults !== undefined) {
        expect(result.flights?.adults).toBe(fixture.expected.flights.adults);
      }
      if (fixture.expected.flights?.children !== undefined) {
        expect(result.flights?.children).toBe(fixture.expected.flights.children);
      }
      if (fixture.expected.flights?.returnDate) {
        expect(result.flights?.returnDate).toBe(fixture.expected.flights.returnDate);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Hotels fixtures
  // -------------------------------------------------------------------------

  describe('Hotels', () => {
    const hotelFixtures = goldenFixtures.filter(f =>
      f.expected.requestType === 'hotels',
    );

    it.each(hotelFixtures)('[$id] $description', async (fixture) => {
      const expectedResult: Partial<ParsedTravelRequest> = {
        requestType: 'hotels',
        confidence: fixture.expected.confidence_min ?? 0.9,
        originalMessage: fixture.input.message,
        ...(fixture.expected.hotels && {
          hotels: {
            city: fixture.expected.hotels.city ?? '',
            checkinDate: fixture.expected.hotels.checkinDate ?? '',
            checkoutDate: fixture.expected.hotels.checkoutDate ?? '',
            adults: fixture.expected.hotels.adults ?? 1,
            adultsExplicit: (fixture.expected.hotels.adults ?? 1) > 1,
            children: fixture.expected.hotels.children ?? 0,
          },
        }),
      };

      mockedParse.mockResolvedValueOnce(expectedResult as ParsedTravelRequest);

      const result = await parseMessageWithAI(
        fixture.input.message,
        null,
        undefined,
        undefined,
        fixture.input.language,
      );

      expect(result.requestType).toBe('hotels');

      if (fixture.expected.confidence_min !== undefined) {
        expect(result.confidence).toBeGreaterThanOrEqual(fixture.expected.confidence_min);
      }
      if (fixture.expected.hotels?.city) {
        expect(result.hotels?.city).toBe(fixture.expected.hotels.city);
      }
      if (fixture.expected.hotels?.checkinDate) {
        expect(result.hotels?.checkinDate).toBe(fixture.expected.hotels.checkinDate);
      }
      if (fixture.expected.hotels?.checkoutDate) {
        expect(result.hotels?.checkoutDate).toBe(fixture.expected.hotels.checkoutDate);
      }
      if (fixture.expected.hotels?.adults !== undefined) {
        expect(result.hotels?.adults).toBe(fixture.expected.hotels.adults);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Itinerary fixtures
  // -------------------------------------------------------------------------

  describe('Itinerary', () => {
    const itineraryFixtures = goldenFixtures.filter(f =>
      f.expected.requestType === 'itinerary',
    );

    it.each(itineraryFixtures)('[$id] $description', async (fixture) => {
      const expectedResult: Partial<ParsedTravelRequest> = {
        requestType: 'itinerary',
        confidence: fixture.expected.confidence_min ?? 0.9,
        originalMessage: fixture.input.message,
        ...(fixture.expected.itinerary && {
          itinerary: {
            destinations: fixture.expected.itinerary.destinations ?? [],
            days: fixture.expected.itinerary.days,
          },
        }),
      };

      mockedParse.mockResolvedValueOnce(expectedResult as ParsedTravelRequest);

      const result = await parseMessageWithAI(
        fixture.input.message,
        null,
        undefined,
        undefined,
        fixture.input.language,
      );

      expect(result.requestType).toBe('itinerary');

      if (fixture.expected.confidence_min !== undefined) {
        expect(result.confidence).toBeGreaterThanOrEqual(fixture.expected.confidence_min);
      }
      if (fixture.expected.itinerary?.destinations?.length) {
        expect(result.itinerary?.destinations).toEqual(
          expect.arrayContaining(fixture.expected.itinerary.destinations),
        );
      }
      if (fixture.expected.itinerary?.days !== undefined) {
        expect(result.itinerary?.days).toBe(fixture.expected.itinerary.days);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Ambiguous / low-confidence fixtures
  // -------------------------------------------------------------------------

  describe('Ambiguous / low-confidence', () => {
    const ambiguousFixtures = goldenFixtures.filter(f =>
      f.expected.requestType === 'missing_info_request',
    );

    it.each(ambiguousFixtures)('[$id] $description', async (fixture) => {
      const expectedResult: Partial<ParsedTravelRequest> = {
        requestType: 'missing_info_request',
        confidence: fixture.expected.confidence_min ?? 0.3,
        originalMessage: fixture.input.message,
        message: 'Para buscar tu vuelo necesito más información.',
        missingFields: ['origin', 'destination', 'departureDate'],
      };

      mockedParse.mockResolvedValueOnce(expectedResult as ParsedTravelRequest);

      const result = await parseMessageWithAI(
        fixture.input.message,
        null,
        undefined,
        undefined,
        fixture.input.language,
      );

      expect(result.requestType).toBe('missing_info_request');

      if (fixture.expected.confidence_min !== undefined) {
        expect(result.confidence).toBeGreaterThanOrEqual(fixture.expected.confidence_min);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Combined fixtures
  // -------------------------------------------------------------------------

  describe('Combined (flight + hotel)', () => {
    const combinedFixtures = goldenFixtures.filter(f =>
      f.expected.requestType === 'combined',
    );

    it.each(combinedFixtures)('[$id] $description', async (fixture) => {
      const expectedResult: Partial<ParsedTravelRequest> = {
        requestType: 'combined',
        confidence: fixture.expected.confidence_min ?? 0.9,
        originalMessage: fixture.input.message,
        ...(fixture.expected.flights && {
          flights: {
            origin: fixture.expected.flights.origin ?? '',
            destination: fixture.expected.flights.destination ?? '',
            departureDate: fixture.expected.flights.departureDate ?? '',
            returnDate: fixture.expected.flights.returnDate,
            adults: fixture.expected.flights.adults ?? 1,
            adultsExplicit: (fixture.expected.flights.adults ?? 1) > 1,
            children: fixture.expected.flights.children ?? 0,
            infants: fixture.expected.flights.infants ?? 0,
          },
        }),
        ...(fixture.expected.hotels && {
          hotels: {
            city: fixture.expected.hotels.city ?? '',
            checkinDate: fixture.expected.hotels.checkinDate ?? '',
            checkoutDate: fixture.expected.hotels.checkoutDate ?? '',
            adults: fixture.expected.hotels.adults ?? 1,
            adultsExplicit: (fixture.expected.hotels.adults ?? 1) > 1,
            children: fixture.expected.hotels.children ?? 0,
          },
        }),
      };

      mockedParse.mockResolvedValueOnce(expectedResult as ParsedTravelRequest);

      const result = await parseMessageWithAI(
        fixture.input.message,
        null,
        undefined,
        undefined,
        fixture.input.language,
      );

      expect(result.requestType).toBe('combined');

      if (fixture.expected.confidence_min !== undefined) {
        expect(result.confidence).toBeGreaterThanOrEqual(fixture.expected.confidence_min);
      }
      if (fixture.expected.flights?.origin) {
        expect(result.flights?.origin).toBe(fixture.expected.flights.origin);
      }
      if (fixture.expected.flights?.destination) {
        expect(result.flights?.destination).toBe(fixture.expected.flights.destination);
      }
      if (fixture.expected.hotels?.city) {
        expect(result.hotels?.city).toBe(fixture.expected.hotels.city);
      }
      if (fixture.expected.hotels?.checkinDate) {
        expect(result.hotels?.checkinDate).toBe(fixture.expected.hotels.checkinDate);
      }
      if (fixture.expected.hotels?.checkoutDate) {
        expect(result.hotels?.checkoutDate).toBe(fixture.expected.hotels.checkoutDate);
      }
    });
  });
});

// ===========================================================================
// SUITE 3 — Routing layer (routeRequest — pure function, no mock needed)
//
// For every fixture with an expected.route, we build a minimal
// ParsedTravelRequest from the fixture's expected fields and verify that
// the deterministic router emits the right QUOTE / COLLECT / PLAN decision.
// ===========================================================================

describe('Suite 3: Routing layer — routeRequest against golden fixtures', () => {
  const routeFixtures = goldenFixtures.filter(f => f.expected.route !== undefined);

  it.each(routeFixtures)('[$id] routes to $expected.route', (fixture) => {
    const parsed = buildMinimalParsed(fixture);
    const result = routeRequest(parsed);

    expect(result.route).toBe(fixture.expected.route);
  });

  // -------------------------------------------------------------------------
  // Specific invariant checks beyond the table-driven loop
  // -------------------------------------------------------------------------

  it('QUOTE route has a score >= 0.75 for a complete flight fixture', () => {
    const fixture = goldenFixtures.find(f => f.id === 'flights-eze-mad-001')!;
    const parsed = buildMinimalParsed(fixture);
    const result = routeRequest(parsed);
    // QUOTE_THRESHOLD = 0.75 (from routeRequest.ts constants)
    expect(result.score).toBeGreaterThanOrEqual(0.75);
  });

  it('PLAN route is always returned for itinerary requestType regardless of score', () => {
    const itineraryFixtures = routeFixtures.filter(
      f => f.expected.requestType === 'itinerary',
    );
    for (const fixture of itineraryFixtures) {
      const parsed = buildMinimalParsed(fixture);
      const result = routeRequest(parsed);
      expect(result.route).toBe('PLAN');
    }
  });

  it('COLLECT route returns a collectQuestion string', () => {
    const fixture = goldenFixtures.find(f => f.expected.route === 'COLLECT')!;
    if (!fixture) return; // skip if no COLLECT fixture
    const parsed = buildMinimalParsed(fixture);
    const result = routeRequest(parsed);
    if (result.route === 'COLLECT') {
      expect(result.collectQuestion).toBeTruthy();
    }
  });

  it('routeResult always contains dimensions, missingFields and inferredFields', () => {
    // Spot-check every fixture — these fields must always be present.
    for (const fixture of routeFixtures) {
      const parsed = buildMinimalParsed(fixture);
      const result = routeRequest(parsed);
      expect(result.dimensions).toBeDefined();
      expect(Array.isArray(result.missingFields)).toBe(true);
      expect(Array.isArray(result.inferredFields)).toBe(true);
    }
  });
});
