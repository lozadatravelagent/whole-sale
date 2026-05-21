/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';

import { inferCrossProductSlots } from '../combinedRequestNormalization';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';

/**
 * When a user says "vuelo a Punta Cana y después hotel" without re-naming
 * the destination on the hotel side, the parser leaves `hotels.city` empty.
 * The validator then asks for it, and the missing-info copy reads as
 * "decime a qué destino quieren ir" — confusing, because the user *already*
 * named the destination on the flight side.
 *
 * The fix is post-parse, deterministic: for combined requests, sync the
 * destination/city pair and the dates pair across the two product slots
 * when one side has the data and the other doesn't. The parser stays
 * untouched; the validator sees a more-complete payload and stops asking
 * for things the user already said.
 *
 * Module under test: `combinedRequestNormalization.ts:inferCrossProductSlots`.
 * Pure function. Idempotent. Never mutates the input.
 */

function makeRequest(overrides: Partial<ParsedTravelRequest> = {}): ParsedTravelRequest {
  return {
    requestType: 'combined',
    originalMessage: '',
    confidence: 0.9,
    ...overrides,
  } as ParsedTravelRequest;
}

describe('inferCrossProductSlots — destination / city pair', () => {
  it('fills hotels.city from flights.destination when only the flight side has it', () => {
    const input = makeRequest({
      flights: { destination: 'PUJ', adults: 1 } as any,
      hotels: { adults: 1 } as any,
    });

    const out = inferCrossProductSlots(input);

    expect(out.hotels?.city).toBe('PUJ');
  });

  it('fills flights.destination from hotels.city when only the hotel side has it', () => {
    const input = makeRequest({
      flights: { adults: 1 } as any,
      hotels: { city: 'Madrid', adults: 1 } as any,
    });

    const out = inferCrossProductSlots(input);

    expect(out.flights?.destination).toBe('Madrid');
  });

  it('does NOT overwrite when both sides have different values (respect explicit user input)', () => {
    const input = makeRequest({
      flights: { destination: 'PUJ', adults: 1 } as any,
      hotels: { city: 'Madrid', adults: 1 } as any,
    });

    const out = inferCrossProductSlots(input);

    expect(out.flights?.destination).toBe('PUJ');
    expect(out.hotels?.city).toBe('Madrid');
  });
});

describe('inferCrossProductSlots — date pairs', () => {
  it('fills hotels.checkinDate from flights.departureDate when missing', () => {
    const input = makeRequest({
      flights: { destination: 'PUJ', departureDate: '2026-06-01' } as any,
      hotels: { city: 'PUJ' } as any,
    });

    const out = inferCrossProductSlots(input);

    expect(out.hotels?.checkinDate).toBe('2026-06-01');
  });

  it('fills hotels.checkoutDate from flights.returnDate when missing', () => {
    const input = makeRequest({
      flights: { destination: 'PUJ', departureDate: '2026-06-01', returnDate: '2026-06-08' } as any,
      hotels: { city: 'PUJ' } as any,
    });

    const out = inferCrossProductSlots(input);

    expect(out.hotels?.checkoutDate).toBe('2026-06-08');
  });

  it('fills flights.departureDate from hotels.checkinDate when only the hotel side has it', () => {
    const input = makeRequest({
      flights: { destination: 'PUJ' } as any,
      hotels: { city: 'PUJ', checkinDate: '2026-06-01' } as any,
    });

    const out = inferCrossProductSlots(input);

    expect(out.flights?.departureDate).toBe('2026-06-01');
  });

  it('fills flights.returnDate from hotels.checkoutDate when only the hotel side has it', () => {
    const input = makeRequest({
      flights: { destination: 'PUJ' } as any,
      hotels: { city: 'PUJ', checkoutDate: '2026-06-08' } as any,
    });

    const out = inferCrossProductSlots(input);

    expect(out.flights?.returnDate).toBe('2026-06-08');
  });

  it('does NOT overwrite a date that is already explicit on both sides', () => {
    const input = makeRequest({
      flights: { destination: 'PUJ', departureDate: '2026-06-01' } as any,
      hotels: { city: 'PUJ', checkinDate: '2026-05-30' } as any,
    });

    const out = inferCrossProductSlots(input);

    expect(out.flights?.departureDate).toBe('2026-06-01');
    expect(out.hotels?.checkinDate).toBe('2026-05-30');
  });
});

describe('inferCrossProductSlots — scope guards', () => {
  it('returns the input unchanged when requestType is not combined', () => {
    const input = makeRequest({
      requestType: 'flights',
      flights: { destination: 'PUJ' } as any,
      hotels: undefined,
    });

    const out = inferCrossProductSlots(input);

    expect(out).toEqual(input);
  });

  it('returns the input unchanged when either product slot is undefined', () => {
    const flightsOnly = makeRequest({
      flights: { destination: 'PUJ' } as any,
      hotels: undefined,
    });
    const hotelsOnly = makeRequest({
      flights: undefined,
      hotels: { city: 'Madrid' } as any,
    });

    expect(inferCrossProductSlots(flightsOnly)).toEqual(flightsOnly);
    expect(inferCrossProductSlots(hotelsOnly)).toEqual(hotelsOnly);
  });

  it('returns the input unchanged when neither side has destination data', () => {
    const input = makeRequest({
      flights: { adults: 1 } as any,
      hotels: { adults: 1 } as any,
    });

    const out = inferCrossProductSlots(input);

    expect(out.flights?.destination).toBeUndefined();
    expect(out.hotels?.city).toBeUndefined();
  });

  it('does not mutate the input object', () => {
    const input = makeRequest({
      flights: { destination: 'PUJ' } as any,
      hotels: { adults: 1 } as any,
    });
    const snapshot = JSON.parse(JSON.stringify(input));

    inferCrossProductSlots(input);

    expect(input).toEqual(snapshot);
  });

  it('is idempotent: re-applying does not change the second result', () => {
    const input = makeRequest({
      flights: { destination: 'PUJ', departureDate: '2026-06-01' } as any,
      hotels: { adults: 1 } as any,
    });

    const once = inferCrossProductSlots(input);
    const twice = inferCrossProductSlots(once);

    expect(twice).toEqual(once);
  });

  it('handles a nullish or undefined input gracefully', () => {
    expect(inferCrossProductSlots(null as any)).toBeNull();
    expect(inferCrossProductSlots(undefined as any)).toBeUndefined();
  });
});
