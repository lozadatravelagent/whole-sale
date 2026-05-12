import { describe, expect, it } from 'vitest';

import {
  detectHotelPreferencesFromMessage,
  resolveTurnIntent,
} from '../turnIntentResolver';
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

// ---------------------------------------------------------------------------
// Phase 4 / sub-task D — turnIntentResolver migration to parsed payload.
// Verifies that hotel preferences and intent helpers prefer parser-emitted
// fields and only fall back to legacy ES regex when parsed data is absent.
// Also covers the EN/PT multilingual gap that the legacy regex missed.
// ---------------------------------------------------------------------------

describe('detectHotelPreferencesFromMessage — parsed-payload migration', () => {
  it('reads mealPlan / roomType from parsed.hotels and ignores message', () => {
    const parsed = {
      requestType: 'hotels',
      confidence: 0.9,
      originalMessage: 'breakfast and double room please',
      hotels: {
        city: 'CUN',
        adults: 2,
        children: 0,
        infants: 0,
        mealPlan: 'all_inclusive',
        roomType: 'triple',
        hotelChains: ['RIU'],
      },
    } as unknown as ParsedTravelRequest;

    // Message says "breakfast" + "double" but parsed wins.
    const result = detectHotelPreferencesFromMessage(parsed, 'breakfast and double room please');
    expect(result.mealPlan).toBe('all_inclusive');
    expect(result.roomType).toBe('triple');
    expect(result.hotelChains).toEqual(['RIU']);
  });

  it('falls back to legacy ES regex when parsed.hotels is missing', () => {
    const parsed = {
      requestType: 'hotels',
      confidence: 0.9,
      originalMessage: 'quiero hotel media pension habitacion triple',
    } as unknown as ParsedTravelRequest;

    const result = detectHotelPreferencesFromMessage(parsed, 'quiero hotel media pension habitacion triple');
    expect(result.mealPlan).toBe('half_board');
    expect(result.roomType).toBe('triple');
  });

  it('legacy fallback works when parsedRequest is null (early add-hotel branch)', () => {
    const result = detectHotelPreferencesFromMessage(null, 'hotel todo incluido habitacion single');
    expect(result.mealPlan).toBe('all_inclusive');
    expect(result.roomType).toBe('single');
  });

  it('multilingual: parsed payload from EN message produces same result as ES', () => {
    const enParsed = {
      requestType: 'hotels',
      confidence: 0.9,
      originalMessage: 'I want a hotel with breakfast in a single room',
      hotels: {
        city: 'NYC',
        adults: 1,
        children: 0,
        infants: 0,
        mealPlan: 'breakfast',
        roomType: 'single',
      },
    } as unknown as ParsedTravelRequest;
    const ptParsed = {
      requestType: 'hotels',
      confidence: 0.9,
      originalMessage: 'Quero hotel com cafe da manha em quarto single',
      hotels: {
        city: 'LIS',
        adults: 1,
        children: 0,
        infants: 0,
        mealPlan: 'breakfast',
        roomType: 'single',
      },
    } as unknown as ParsedTravelRequest;

    const enResult = detectHotelPreferencesFromMessage(enParsed, enParsed.originalMessage);
    const ptResult = detectHotelPreferencesFromMessage(ptParsed, ptParsed.originalMessage);
    expect(enResult.mealPlan).toBe('breakfast');
    expect(enResult.roomType).toBe('single');
    expect(ptResult.mealPlan).toBe('breakfast');
    expect(ptResult.roomType).toBe('single');
  });

  it('chain detection always runs against the message as a safety net (legacy pattern)', () => {
    const parsed = {
      requestType: 'hotels',
      confidence: 0.9,
      originalMessage: 'cadena Riu y Iberostar habitacion doble',
      hotels: {
        city: 'PUJ',
        adults: 2,
        children: 0,
        infants: 0,
        // No hotelChains in parsed.
      },
    } as unknown as ParsedTravelRequest;
    // detectMultipleHotelChains matches the "cadena X y Y" pattern.
    const result = detectHotelPreferencesFromMessage(parsed, 'cadena Riu y Iberostar habitacion doble');
    expect(result.hotelChains).toEqual(expect.arrayContaining(['RIU', 'Iberostar']));
  });
});

describe('resolveTurnIntent — hasHotelIntent / hasFlightIntent via parsed payload', () => {
  // hasHotelIntent / hasFlightIntent are exercised through enrichHotelIntent /
  // enrichFlightIntent. We assert the multilingual EN/PT case the legacy
  // regex would have missed.

  it('EN parsed combined message triggers hotel enrichment from flight context', () => {
    const parsed = {
      requestType: 'combined',
      confidence: 0.9,
      originalMessage: 'I also need a hotel for the same dates',
      hotels: {
        adults: 1,
        adultsExplicit: false,
        children: 0,
        infants: 0,
      },
    } as unknown as ParsedTravelRequest;

    const result = resolveTurnIntent({
      message: 'I also need a hotel for the same dates',
      parsedRequest: parsed,
      persistentState: flightContextState,
    });

    // The parsed.requestType=combined would route via hasHotelIntent.
    // Result keeps requestType=combined (not forced hotels-only because no
    // explicit ES hotel mention), and hotels block enriched from flight ctx.
    expect(result.contextUsed).toContain('last_flight_search');
    expect(result.resolvedRequest.hotels?.city).toBe('CUN');
  });

  it('PT parsed flights message enriches from hotel context', () => {
    const parsed = {
      requestType: 'flights',
      confidence: 0.9,
      originalMessage: 'Quero voos para esse destino',
      flights: {
        origin: 'GRU',
        adults: 1,
        adultsExplicit: false,
        children: 0,
        infants: 0,
      },
    } as unknown as ParsedTravelRequest;

    const result = resolveTurnIntent({
      message: 'Quero voos para esse destino',
      parsedRequest: parsed,
      persistentState: hotelContextState,
    });

    expect(result.contextUsed).toContain('last_hotel_search');
    expect(result.resolvedRequest.flights?.destination).toBe('CUN');
  });

  it('parsed.requestType=general with no hotels/flights blocks does not trigger enrichment', () => {
    const parsed = {
      requestType: 'general',
      confidence: 0.7,
      originalMessage: 'que onda',
    } as unknown as ParsedTravelRequest;

    const result = resolveTurnIntent({
      message: 'que onda',
      parsedRequest: parsed,
      persistentState: flightContextState,
    });

    expect(result.contextUsed).toEqual([]);
    expect(result.invalidatedServerRoute).toBe(false);
  });
});

describe('resolveTurnIntent — explicitlyReferencesPreviousContext via parsed.referencesCurrentPlan', () => {
  // Used inside applyExplicitServiceIntent. When the user explicitly mentions
  // BOTH "vuelo" AND "hotel" but ALSO references the previous/active plan,
  // applyExplicitServiceIntent must NOT coerce to combined or align
  // destinations — those guards depend on the previous-context check.

  it('parsed.referencesCurrentPlan=true suppresses destination alignment for explicit combined mention', () => {
    const parsed = {
      requestType: 'combined',
      confidence: 0.9,
      originalMessage: 'vuelo y hotel para este viaje',
      referencesCurrentPlan: true,
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '2026-07-01',
        adults: 2,
        children: 0,
        infants: 0,
      },
      hotels: {
        city: 'PUJ', // Different from flights.destination on purpose.
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-05',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        infants: 0,
      },
    } as unknown as ParsedTravelRequest;

    const result = resolveTurnIntent({
      message: 'vuelo y hotel para este viaje',
      parsedRequest: parsed,
      persistentState: null,
    });

    // Because referencesCurrentPlan=true, the destination-mismatch alignment
    // is skipped — both the original flight destination and hotel city are kept.
    expect(result.resolvedRequest.flights?.destination).toBe('CUN');
    expect(result.resolvedRequest.hotels?.city).toBe('PUJ');
  });

  it('legacy ES regex catches "misma busqueda" when parsed.referencesCurrentPlan is undefined', () => {
    const parsed = {
      requestType: 'combined',
      confidence: 0.9,
      originalMessage: 'vuelo y hotel para la misma busqueda',
      // referencesCurrentPlan undefined → legacy regex must catch "misma busqueda"
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '2026-07-01',
        adults: 2,
        children: 0,
        infants: 0,
      },
      hotels: {
        city: 'PUJ',
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-05',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        infants: 0,
      },
    } as unknown as ParsedTravelRequest;

    const result = resolveTurnIntent({
      message: 'vuelo y hotel para la misma busqueda',
      parsedRequest: parsed,
      persistentState: null,
    });

    // Legacy regex catches "misma busqueda" → previous context referenced →
    // alignment is suppressed.
    expect(result.resolvedRequest.flights?.destination).toBe('CUN');
    expect(result.resolvedRequest.hotels?.city).toBe('PUJ');
  });

  it('without previous-context signal, mismatched dest+city aligns to message-mentioned city', () => {
    const parsed = {
      requestType: 'combined',
      confidence: 0.9,
      originalMessage: 'vuelo y hotel para Punta Cana',
      flights: {
        origin: 'EZE',
        destination: 'CUN', // Stale from previous turn.
        departureDate: '2026-07-01',
        adults: 2,
        children: 0,
        infants: 0,
      },
      hotels: {
        city: 'Punta Cana',
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-05',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        infants: 0,
      },
    } as unknown as ParsedTravelRequest;

    const result = resolveTurnIntent({
      message: 'vuelo y hotel para Punta Cana',
      parsedRequest: parsed,
      persistentState: null,
    });

    // No previous-context signal AND user mentions "Punta Cana" → flight
    // destination realigns to the explicit hotel city.
    expect(result.resolvedRequest.flights?.destination).toBe('Punta Cana');
  });
});
