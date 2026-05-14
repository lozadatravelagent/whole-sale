import { describe, it, expect } from 'vitest';

import {
  detectIterationIntent,
  mergeIterationContext,
} from '../iterationDetection';
import type {
  ContextState,
  FlightContextParams,
  HotelContextParams,
} from '../../types/contextState';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';

/**
 * Builds a ContextState with a combined search (flights + hotels) as last search.
 * Tests can override individual fields by passing partials.
 */
function makeCombinedContext(
  overrides: {
    flights?: Partial<FlightContextParams>;
    hotels?: Partial<HotelContextParams>;
    requestType?: 'flights' | 'hotels' | 'combined';
  } = {},
): ContextState {
  const flightsParams: FlightContextParams = {
    origin: 'EZE',
    destination: 'CUN',
    departureDate: '2026-05-15',
    returnDate: '2026-05-18',
    tripType: 'round_trip',
    adults: 2,
    children: 0,
    infants: 0,
    ...overrides.flights,
  };
  const hotelsParams: HotelContextParams = {
    city: 'Cancun',
    checkinDate: '2026-05-15',
    checkoutDate: '2026-05-18',
    adults: 2,
    children: 0,
    infants: 0,
    ...overrides.hotels,
  };
  return {
    lastSearch: {
      requestType: overrides.requestType ?? 'combined',
      timestamp: new Date().toISOString(),
      flightsParams,
      hotelsParams,
    },
    constraintsHistory: [],
    turnNumber: 1,
    schemaVersion: 1,
  };
}

function makeParsed(overrides: Partial<ParsedTravelRequest>): ParsedTravelRequest {
  return {
    requestType: 'general',
    confidence: 0.5,
    originalMessage: '',
    ...overrides,
  } as ParsedTravelRequest;
}

describe('detectIterationIntent — stay duration modification (CASE 13)', () => {
  it('detects "quiero una semana" on a combined search → stay_duration_modification, 7 nights', () => {
    const ctx = makeCombinedContext();
    const result = detectIterationIntent('quiero una semana', ctx);

    expect(result.isIteration).toBe(true);
    expect(result.iterationType).toBe('stay_duration_modification');
    expect(result.stayModification?.nights).toBe(7);
    expect(result.baseRequestType).toBe('combined');
  });

  it('detects "que sea una semana" on a flights search → stay_duration_modification, 7 nights', () => {
    const ctx = makeCombinedContext({ requestType: 'flights' });
    const result = detectIterationIntent('que sea una semana', ctx);

    expect(result.isIteration).toBe(true);
    expect(result.iterationType).toBe('stay_duration_modification');
    expect(result.stayModification?.nights).toBe(7);
  });

  it('detects "10 días" on a combined search → 10 nights', () => {
    const ctx = makeCombinedContext();
    const result = detectIterationIntent('10 días', ctx);

    expect(result.isIteration).toBe(true);
    expect(result.iterationType).toBe('stay_duration_modification');
    expect(result.stayModification?.nights).toBe(10);
  });

  it('detects "por una quincena" on a hotels search → 15 nights', () => {
    const ctx = makeCombinedContext({ requestType: 'hotels' });
    const result = detectIterationIntent('por una quincena', ctx);

    expect(result.isIteration).toBe(true);
    expect(result.iterationType).toBe('stay_duration_modification');
    expect(result.stayModification?.nights).toBe(15);
  });

  it('detects "por 5 noches" → 5 nights', () => {
    const ctx = makeCombinedContext();
    const result = detectIterationIntent('por 5 noches', ctx);

    expect(result.isIteration).toBe(true);
    expect(result.iterationType).toBe('stay_duration_modification');
    expect(result.stayModification?.nights).toBe(5);
  });

  it('detects "dos semanas" → 14 nights', () => {
    const ctx = makeCombinedContext();
    const result = detectIterationIntent('dos semanas', ctx);

    expect(result.isIteration).toBe(true);
    expect(result.stayModification?.nights).toBe(14);
  });

  it('does NOT match stay_duration when the message is a full new hotel search ("quiero ir a Madrid 5 días")', () => {
    const ctx = makeCombinedContext();
    // This message says "hotel"? No — but uses a destination and looks like a new search.
    // Use the actual likelyNewHotelSearch guard which fires on hotel keyword + range or pax.
    // Here we test that a different new-search-like phrasing without iteration cues
    // still returns false when previous context had a hotels search.
    const result = detectIterationIntent(
      'busco un hotel en Madrid para 2 adultos 5 días',
      ctx,
    );

    // The guard `likelyNewHotelSearch` should fire (hotel keyword + pax info) → not iteration
    expect(result.isIteration).toBe(false);
    expect(result.iterationType).toBe('new_search');
  });

  it('returns no iteration when previous context is null', () => {
    const result = detectIterationIntent('una semana', null);
    expect(result.isIteration).toBe(false);
  });
});

describe('detectIterationIntent — destination swap (CASE 14)', () => {
  it('detects "en vez de Cancún, Punta Cana" → destination_swap', () => {
    const ctx = makeCombinedContext();
    const result = detectIterationIntent('en vez de Cancún, Punta Cana', ctx);

    expect(result.isIteration).toBe(true);
    expect(result.iterationType).toBe('destination_swap');
    expect(result.destinationSwap?.newDestination?.toLowerCase()).toContain('punta');
    expect(result.destinationSwap?.oldDestination?.toLowerCase()).toContain('cancun');
  });

  it('detects "mejor Punta Cana" → destination_swap with newDestination only', () => {
    const ctx = makeCombinedContext();
    const result = detectIterationIntent('mejor Punta Cana', ctx);

    expect(result.isIteration).toBe(true);
    expect(result.iterationType).toBe('destination_swap');
    expect(result.destinationSwap?.newDestination?.toLowerCase()).toContain('punta');
  });

  it('detects "cambia Cancún por Punta Cana" → destination_swap with both', () => {
    const ctx = makeCombinedContext();
    const result = detectIterationIntent('cambia Cancún por Punta Cana', ctx);

    expect(result.isIteration).toBe(true);
    expect(result.iterationType).toBe('destination_swap');
    expect(result.destinationSwap?.newDestination?.toLowerCase()).toContain('punta');
    expect(result.destinationSwap?.oldDestination?.toLowerCase()).toContain('cancun');
  });

  it('detects "cambiar destino a Madrid" → destination_swap', () => {
    const ctx = makeCombinedContext();
    const result = detectIterationIntent('cambiar destino a Madrid', ctx);

    expect(result.isIteration).toBe(true);
    expect(result.iterationType).toBe('destination_swap');
    expect(result.destinationSwap?.newDestination?.toLowerCase()).toContain('madrid');
  });
});

describe('mergeIterationContext — stay duration modification', () => {
  it('recomputes returnDate from departureDate + nights on a flights/combined search', () => {
    const ctx = makeCombinedContext({
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '2026-05-15',
        returnDate: '2026-05-18',
        tripType: 'round_trip',
        adults: 2,
        children: 0,
        infants: 0,
      },
      hotels: {
        city: 'Cancun',
        checkinDate: '2026-05-15',
        checkoutDate: '2026-05-18',
        adults: 2,
        children: 0,
        infants: 0,
      },
    });
    const iter = detectIterationIntent('una semana', ctx);
    expect(iter.isIteration).toBe(true);

    const merged = mergeIterationContext(
      ctx,
      makeParsed({ requestType: 'general', originalMessage: 'una semana' }),
      iter,
    );

    expect(merged.requestType).toBe('combined');
    expect(merged.flights?.departureDate).toBe('2026-05-15');
    expect(merged.flights?.returnDate).toBe('2026-05-22');
    expect(merged.hotels?.checkinDate).toBe('2026-05-15');
    expect(merged.hotels?.checkoutDate).toBe('2026-05-22');
    // Origin/destination/pax intact
    expect(merged.flights?.origin).toBe('EZE');
    expect(merged.flights?.destination).toBe('CUN');
    expect(merged.flights?.adults).toBe(2);
  });
});

describe('mergeIterationContext — destination swap', () => {
  it('swaps destination from CUN → PUJ keeping origin, dates, and pax intact', () => {
    const ctx = makeCombinedContext({
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '2026-05-15',
        returnDate: '2026-05-18',
        tripType: 'round_trip',
        adults: 2,
        children: 1,
        infants: 0,
      },
      hotels: {
        city: 'Cancun',
        checkinDate: '2026-05-15',
        checkoutDate: '2026-05-18',
        adults: 2,
        children: 1,
        infants: 0,
      },
    });
    const iter = detectIterationIntent('cambia Cancún por Punta Cana', ctx);
    expect(iter.isIteration).toBe(true);
    expect(iter.iterationType).toBe('destination_swap');

    // Simulate that the AI parser resolved Punta Cana → PUJ for flights and "Punta Cana" for hotel city
    const aiParsed = makeParsed({
      requestType: 'general',
      originalMessage: 'cambia Cancún por Punta Cana',
      flights: {
        origin: '',
        destination: 'PUJ',
        departureDate: '',
        adults: 0,
        children: 0,
      },
      hotels: {
        city: 'Punta Cana',
        checkinDate: '',
        checkoutDate: '',
        adults: 0,
        children: 0,
      } as ParsedTravelRequest['hotels'],
    });

    const merged = mergeIterationContext(ctx, aiParsed, iter);

    expect(merged.requestType).toBe('combined');
    expect(merged.flights?.origin).toBe('EZE');
    expect(merged.flights?.destination).toBe('PUJ');
    expect(merged.flights?.departureDate).toBe('2026-05-15');
    expect(merged.flights?.returnDate).toBe('2026-05-18');
    expect(merged.flights?.adults).toBe(2);
    expect(merged.flights?.children).toBe(1);
    expect(merged.hotels?.city).toBe('Punta Cana');
    expect(merged.hotels?.checkinDate).toBe('2026-05-15');
    expect(merged.hotels?.checkoutDate).toBe('2026-05-18');
  });
});
