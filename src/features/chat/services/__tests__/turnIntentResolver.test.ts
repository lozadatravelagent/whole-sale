import { describe, expect, it } from 'vitest';

import { resolveTurnIntent } from '../turnIntentResolver';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { ContextState } from '../../types/contextState';

const flightContextState: ContextState = {
  lastSearch: {
    requestType: 'flights',
    timestamp: '2026-05-01T00:00:00Z',
    flightsParams: {
      origin: 'EZE',
      destination: 'CUN',
      departureDate: '2026-07-01',
      adults: 2,
      children: 0,
      infants: 0,
    },
  },
  constraintsHistory: [],
  turnNumber: 1,
  schemaVersion: 1,
};

const hotelContextState: ContextState = {
  lastSearch: {
    requestType: 'hotels',
    timestamp: '2026-05-01T00:00:00Z',
    hotelsParams: {
      city: 'CUN',
      checkinDate: '2026-07-01',
      checkoutDate: '2026-07-04',
      adults: 2,
      children: 0,
      infants: 0,
      mealPlan: 'all_inclusive',
    },
  },
  constraintsHistory: [],
  turnNumber: 1,
  schemaVersion: 1,
};

describe('resolveTurnIntent', () => {
  it('enriches incomplete hotel follow-ups from the last flight search', () => {
    const parsedRequest = {
      requestType: 'hotels',
      confidence: 0.9,
      originalMessage: 'I also want a Hotel all inclusive, Iberostar y Riu',
      hotels: {
        adults: 1,
        adultsExplicit: false,
        children: 0,
        infants: 0,
      },
      orchestration: {
        routeResult: {
          route: 'PLAN',
          score: 0.38,
          missingFields: ['destination', 'dates'],
          collectQuestion: null,
          reason: 'low_definition',
          dimensions: {},
          inferredFields: {},
        },
      },
    } as unknown as ParsedTravelRequest;

    const result = resolveTurnIntent({
      message: 'I also want a Hotel all inclusive, Iberostar y Riu',
      parsedRequest,
      persistentState: flightContextState,
    });

    expect(result.resolvedIntent).toBe('hotel_search');
    expect(result.contextUsed).toEqual(['last_flight_search', 'message_preferences']);
    expect(result.invalidatedServerRoute).toBe(true);
    expect(result.resolvedRequest.orchestration).toBeUndefined();
    expect(result.resolvedRequest.hotels).toMatchObject({
      city: 'CUN',
      checkinDate: '2026-07-01',
      checkoutDate: '2026-07-04',
      adults: 2,
      children: 0,
      infants: 0,
      mealPlan: 'all_inclusive',
    });
    expect(result.resolvedRequest.hotels?.hotelChains).toEqual(expect.arrayContaining(['RIU', 'Iberostar']));
  });

  it('enriches incomplete flight follow-ups from the last hotel search', () => {
    const parsedRequest = {
      requestType: 'flights',
      confidence: 0.88,
      originalMessage: 'sumame vuelos desde Buenos Aires',
      flights: {
        origin: 'BUE',
        adults: 1,
        adultsExplicit: false,
        children: 0,
        infants: 0,
      },
      orchestration: {
        routeResult: {
          route: 'COLLECT',
          score: 0.5,
          missingFields: ['destination', 'dates'],
          collectQuestion: 'A dónde querés viajar?',
          reason: 'missing_context',
          dimensions: {},
          inferredFields: {},
        },
      },
    } as unknown as ParsedTravelRequest;

    const result = resolveTurnIntent({
      message: 'sumame vuelos desde Buenos Aires',
      parsedRequest,
      persistentState: hotelContextState,
    });

    expect(result.resolvedIntent).toBe('flight_search');
    expect(result.contextUsed).toEqual(['last_hotel_search']);
    expect(result.invalidatedServerRoute).toBe(true);
    expect(result.resolvedRequest.orchestration).toBeUndefined();
    expect(result.resolvedRequest.flights).toMatchObject({
      origin: 'BUE',
      destination: 'CUN',
      departureDate: '2026-07-01',
      returnDate: '2026-07-04',
      adults: 2,
      children: 0,
      infants: 0,
    });
  });

  it('keeps complete standalone requests untouched', () => {
    const parsedRequest = {
      requestType: 'hotels',
      confidence: 0.92,
      originalMessage: 'hotel en Punta Cana del 1 al 5 de julio para 2',
      hotels: {
        city: 'PUJ',
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-05',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        infants: 0,
      },
      orchestration: {
        routeResult: {
          route: 'QUOTE',
          score: 0.95,
          missingFields: [],
          collectQuestion: null,
          reason: 'high_definition',
          dimensions: {},
          inferredFields: {},
        },
      },
    } as unknown as ParsedTravelRequest;

    const result = resolveTurnIntent({
      message: 'hotel en Punta Cana del 1 al 5 de julio para 2',
      parsedRequest,
      persistentState: flightContextState,
    });

    expect(result.resolvedRequest).toBe(parsedRequest);
    expect(result.contextUsed).toEqual([]);
    expect(result.invalidatedServerRoute).toBe(false);
    expect(result.reason).toBe('parser_result_accepted');
  });

  it.each([
    {
      name: 'forces hotels-only when the parser leaks previous flight data',
      message: 'quiero hotel all inclusive',
      parsedRequest: {
        requestType: 'combined',
        confidence: 0.86,
        originalMessage: 'quiero hotel all inclusive',
        flights: {
          origin: 'EZE',
          destination: 'CUN',
          departureDate: '2026-07-01',
          adults: 2,
          children: 0,
          infants: 0,
        },
        hotels: {
          adults: 1,
          adultsExplicit: false,
          children: 0,
          infants: 0,
        },
        orchestration: {
          routeResult: {
            route: 'PLAN',
            score: 0.4,
            missingFields: ['destination'],
            collectQuestion: null,
            reason: 'stale_parser_context',
            dimensions: {},
            inferredFields: {},
          },
        },
      } as unknown as ParsedTravelRequest,
      persistentState: flightContextState,
      expected: {
        requestType: 'hotels',
        resolvedIntent: 'hotel_search',
        noFlights: true,
        city: 'CUN',
        mealPlan: 'all_inclusive',
      },
    },
    {
      name: 'coerces explicit flight+hotel requests to combined before routing',
      message: 'vuelo y hotel para Cancun',
      parsedRequest: {
        requestType: 'flights',
        confidence: 0.88,
        originalMessage: 'vuelo y hotel para Cancun',
        flights: {
          origin: 'EZE',
          destination: 'CUN',
          departureDate: '2026-07-01',
          returnDate: '2026-07-08',
          adults: 2,
          children: 0,
          infants: 0,
        },
        orchestration: {
          routeResult: {
            route: 'QUOTE',
            score: 0.9,
            missingFields: [],
            collectQuestion: null,
            reason: 'flight_only',
            dimensions: {},
            inferredFields: {},
          },
        },
      } as unknown as ParsedTravelRequest,
      persistentState: null,
      expected: {
        requestType: 'combined',
        resolvedIntent: 'combined_search',
        city: 'CUN',
      },
    },
  ])('$name', ({ message, parsedRequest, persistentState, expected }) => {
    const result = resolveTurnIntent({
      message,
      parsedRequest,
      persistentState,
    });

    expect(result.resolvedIntent).toBe(expected.resolvedIntent);
    expect(result.resolvedRequest.requestType).toBe(expected.requestType);
    expect(result.invalidatedServerRoute).toBe(true);
    expect(result.resolvedRequest.orchestration).toBeUndefined();
    if (expected.noFlights) {
      expect(result.resolvedRequest.flights).toBeUndefined();
    }
    if (expected.city) {
      expect(result.resolvedRequest.hotels?.city).toBe(expected.city);
    }
    if (expected.mealPlan) {
      expect(result.resolvedRequest.hotels?.mealPlan).toBe(expected.mealPlan);
    }
  });
});
