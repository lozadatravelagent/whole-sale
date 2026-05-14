import { describe, it, expect } from 'vitest';

import { normalizeSearchIntent } from '../searchIntentNormalizer';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';

/**
 * Helper to build a minimal ParsedTravelRequest. Keeps tests focused on the
 * normalizer's specific concerns (traveler defaults + room derivation).
 */
function makeParsed(overrides: Partial<ParsedTravelRequest>): ParsedTravelRequest {
  return {
    requestType: 'general',
    confidence: 0.9,
    originalMessage: '',
    ...overrides,
  } as ParsedTravelRequest;
}

describe('normalizeSearchIntent — travelerType → adults/room defaults', () => {
  it('travelerType=couple with no adults sets adults=2 and roomType=double for hotels', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      travelerType: 'couple',
      flights: {
        origin: 'EZE',
        destination: 'MIA',
        departureDate: '2026-07-10',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Miami',
        checkinDate: '2026-07-10',
        checkoutDate: '2026-07-17',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed);

    expect(out.flights?.adults).toBe(2);
    expect(out.flights?.adultsExplicit).toBe(true);
    expect(out.hotels?.adults).toBe(2);
    expect(out.hotels?.adultsExplicit).toBe(true);
    expect(out.hotels?.roomType).toBe('double');
    expect(out.hotels?.roomTypeInferred).toBe(true);
  });

  it('travelerType=couple with explicit adults=1 keeps adults=1 (explicit wins) and derives roomType=single from pax', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      travelerType: 'couple',
      hotels: {
        city: 'Miami',
        checkinDate: '2026-07-10',
        checkoutDate: '2026-07-17',
        adults: 1,
        adultsExplicit: true,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed);

    expect(out.hotels?.adults).toBe(1);
    expect(out.hotels?.adultsExplicit).toBe(true);
    // travelerType-derived 'double' is skipped (adults explicit), but pax-based
    // derivation still runs and 1 pax → 'single'.
    expect(out.hotels?.roomType).toBe('single');
    expect(out.hotels?.roomTypeInferred).toBe(true);
  });

  it('travelerType=solo sets adults=1 and roomType=single for hotels', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      travelerType: 'solo',
      hotels: {
        city: 'Madrid',
        checkinDate: '2026-09-01',
        checkoutDate: '2026-09-05',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed);

    expect(out.hotels?.adults).toBe(1);
    expect(out.hotels?.adultsExplicit).toBe(true);
    expect(out.hotels?.roomType).toBe('single');
    expect(out.hotels?.roomTypeInferred).toBe(true);
  });

  it('travelerType=family with 4 total pax derives quadruple', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      travelerType: 'family',
      hotels: {
        city: 'Orlando',
        checkinDate: '2026-12-20',
        checkoutDate: '2026-12-27',
        adults: 2,
        adultsExplicit: true,
        children: 2,
      },
    });

    const out = normalizeSearchIntent(parsed);

    // 2A + 2C = 4 pax → 'quadruple' (Phase 4: schema enum extended to include quadruple).
    expect(out.hotels?.roomType).toBe('quadruple');
    expect(out.hotels?.roomTypeInferred).toBe(true);
    // family must NOT override pax counts even when not explicit
    expect(out.hotels?.adults).toBe(2);
  });

  it('hotel with 4 pax (no roomType) derives quadruple, roomTypeInferred=true', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      hotels: {
        city: 'Orlando',
        checkinDate: '2026-12-20',
        checkoutDate: '2026-12-27',
        adults: 4,
        adultsExplicit: true,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed);

    expect(out.hotels?.roomType).toBe('quadruple');
    expect(out.hotels?.roomTypeInferred).toBe(true);
  });

  it('hotel with 4 pax and explicit roomType=double leaves it unchanged (explicit wins)', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      hotels: {
        city: 'Orlando',
        checkinDate: '2026-12-20',
        checkoutDate: '2026-12-27',
        adults: 4,
        adultsExplicit: true,
        children: 0,
        roomType: 'double',
      },
    });

    const out = normalizeSearchIntent(parsed);

    expect(out.hotels?.roomType).toBe('double');
    // Explicit user roomType is NOT flagged as inferred.
    expect(out.hotels?.roomTypeInferred).toBeUndefined();
  });

  it('hotel-only with 3 pax and no roomType derives triple', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      hotels: {
        city: 'Cusco',
        checkinDate: '2026-08-01',
        checkoutDate: '2026-08-05',
        adults: 3,
        adultsExplicit: true,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed);

    expect(out.hotels?.roomType).toBe('triple');
    expect(out.hotels?.roomTypeInferred).toBe(true);
  });

  it('hotel with explicit roomType=single for 2 pax stays unchanged (explicit wins)', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      hotels: {
        city: 'Buenos Aires',
        checkinDate: '2026-10-01',
        checkoutDate: '2026-10-05',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        roomType: 'single',
      },
    });

    const out = normalizeSearchIntent(parsed);

    expect(out.hotels?.roomType).toBe('single');
    // explicit user roomType is NOT flagged as inferred
    expect(out.hotels?.roomTypeInferred).toBeUndefined();
  });

  it('5+ pax leaves roomType undefined (no derivation)', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      hotels: {
        city: 'Bariloche',
        checkinDate: '2026-08-01',
        checkoutDate: '2026-08-05',
        adults: 4,
        adultsExplicit: true,
        children: 2,
      },
    });

    const out = normalizeSearchIntent(parsed);

    expect(out.hotels?.roomType).toBeUndefined();
    expect(out.hotels?.roomTypeInferred).toBeUndefined();
  });

  it('does not mutate the input', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      travelerType: 'couple',
      hotels: {
        city: 'Roma',
        checkinDate: '2026-09-10',
        checkoutDate: '2026-09-15',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });
    const snapshot = structuredClone(parsed);

    normalizeSearchIntent(parsed);

    expect(parsed).toEqual(snapshot);
  });

  it('travelerType=group does not infer pax counts (group sizes vary; user must specify)', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      travelerType: 'group',
      hotels: {
        city: 'Mendoza',
        checkinDate: '2026-11-01',
        checkoutDate: '2026-11-05',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed);

    // group label is preserved but pax count is not overridden.
    expect(out.travelerType).toBe('group');
    expect(out.hotels?.adults).toBe(1);
    expect(out.hotels?.adultsExplicit).toBe(false);
    // 1 pax still derives 'single' via the room-by-pax table.
    expect(out.hotels?.roomType).toBe('single');
    expect(out.hotels?.roomTypeInferred).toBe(true);
  });

  it('flight-only request with travelerType=couple does not touch hotels block', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      travelerType: 'couple',
      flights: {
        origin: 'EZE',
        destination: 'MAD',
        departureDate: '2026-09-01',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed);

    expect(out.flights?.adults).toBe(2);
    expect(out.flights?.adultsExplicit).toBe(true);
    expect(out.hotels).toBeUndefined();
  });
});

// =============================================================================
// Phase 2 — Relative date hints
//
// All tests inject a fixed `now` clock for determinism. Reference clock used
// throughout: 2026-05-11T00:00:00Z (a Monday). When a test needs a different
// weekday (e.g. the Saturday edge case), it provides its own clock.
// =============================================================================

const NOW_MONDAY = new Date('2026-05-11T00:00:00.000Z'); // Monday

describe('normalizeSearchIntent — relativeDateHint (Phase 2)', () => {
  it('tomorrow + flights-only sets one_way and no returnDate', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      relativeDateHint: 'tomorrow',
      flights: {
        origin: 'EZE',
        destination: 'MAD',
        departureDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.flights?.departureDate).toBe('2026-05-12'); // Tue
    expect(out.flights?.returnDate).toBeUndefined();
    expect(out.flights?.tripType).toBe('one_way');
    expect(out.flights?.tripTypeInferred).toBe(true);
  });

  it('tomorrow + combined yields 7-night stay aligned to flight dates', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      relativeDateHint: 'tomorrow',
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '',
        checkoutDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.flights?.departureDate).toBe('2026-05-12'); // Tue
    expect(out.flights?.returnDate).toBe('2026-05-19'); // +7 days
    expect(out.flights?.tripType).toBe('round_trip');
    expect(out.flights?.tripTypeInferred).toBe(true);
    expect(out.hotels?.checkinDate).toBe('2026-05-12');
    expect(out.hotels?.checkoutDate).toBe('2026-05-19');
    expect(out.hotels?.checkoutDateInferred).toBe(true);
  });

  it('tomorrow + hotels-only fills checkin/checkout with 7 nights', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      relativeDateHint: 'tomorrow',
      hotels: {
        city: 'Cancún',
        checkinDate: '',
        checkoutDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.hotels?.checkinDate).toBe('2026-05-12');
    expect(out.hotels?.checkoutDate).toBe('2026-05-19');
    expect(out.hotels?.checkoutDateInferred).toBe(true);
  });

  it('this_weekend resolves to next Fri-Sun (2 nights)', () => {
    // NOW_MONDAY (2026-05-11). Next Fri = 2026-05-15. Next Sun = 2026-05-17.
    const parsed = makeParsed({
      requestType: 'combined',
      relativeDateHint: 'this_weekend',
      flights: {
        origin: 'EZE',
        destination: 'BRC',
        departureDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Bariloche',
        checkinDate: '',
        checkoutDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.flights?.departureDate).toBe('2026-05-15'); // Fri
    expect(out.flights?.returnDate).toBe('2026-05-17'); // Sun (2 nights)
    expect(out.hotels?.checkinDate).toBe('2026-05-15');
    expect(out.hotels?.checkoutDate).toBe('2026-05-17');
  });

  it('this_weekend on a Saturday uses today-Sunday (documented edge: weekend has already started)', () => {
    // 2026-05-16 is a Saturday. Edge rule: start = today (Sat), end = tomorrow
    // (Sun). Captures the "the weekend already started" semantic so we don't
    // push the user to NEXT week's Friday.
    const saturday = new Date('2026-05-16T00:00:00.000Z');
    const parsed = makeParsed({
      requestType: 'hotels',
      relativeDateHint: 'this_weekend',
      hotels: {
        city: 'Bariloche',
        checkinDate: '',
        checkoutDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, saturday);

    expect(out.hotels?.checkinDate).toBe('2026-05-16'); // today (Sat)
    expect(out.hotels?.checkoutDate).toBe('2026-05-17'); // tomorrow (Sun)
  });

  it('next_week + flights-only is Monday one-way', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      relativeDateHint: 'next_week',
      flights: {
        origin: 'EZE',
        destination: 'MAD',
        departureDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    // From Mon 2026-05-11, next Monday = 2026-05-18 (Mon today → +7).
    expect(out.flights?.departureDate).toBe('2026-05-18');
    expect(out.flights?.returnDate).toBeUndefined();
    expect(out.flights?.tripType).toBe('one_way');
    expect(out.flights?.tripTypeInferred).toBe(true);
  });

  it('next_week + hotels is Monday-to-Monday (7 nights)', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      relativeDateHint: 'next_week',
      hotels: {
        city: 'Madrid',
        checkinDate: '',
        checkoutDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.hotels?.checkinDate).toBe('2026-05-18'); // next Mon
    expect(out.hotels?.checkoutDate).toBe('2026-05-25'); // +7
    expect(out.hotels?.checkoutDateInferred).toBe(true);
  });

  it('next_month yields first-of-month and +7 days when hotel present', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      relativeDateHint: 'next_month',
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '',
        checkoutDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY); // May 2026

    expect(out.flights?.departureDate).toBe('2026-06-01');
    expect(out.flights?.returnDate).toBe('2026-06-08'); // +7
    expect(out.hotels?.checkinDate).toBe('2026-06-01');
    expect(out.hotels?.checkoutDate).toBe('2026-06-08');
  });

  it('relativeDateHint is ignored when explicit departureDate already set', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      relativeDateHint: 'tomorrow',
      flights: {
        origin: 'EZE',
        destination: 'MAD',
        departureDate: '2026-08-15', // explicit
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    // Explicit wins.
    expect(out.flights?.departureDate).toBe('2026-08-15');
    expect(out.flights?.returnDate).toBeUndefined();
    expect(out.flights?.tripTypeInferred).toBeUndefined();
  });

  it('does not mutate input (structuredClone deep equality on input)', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      relativeDateHint: 'tomorrow',
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '',
        checkoutDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });
    const snapshot = structuredClone(parsed);

    normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(parsed).toEqual(snapshot);
  });
});

// =============================================================================
// Phase 2 — Partial-stay
// =============================================================================

describe('normalizeSearchIntent — partialStay (Phase 2)', () => {
  it('partialStay + flights → one_way + tripTypeInferred=true', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      partialStay: {
        flightIntent: 'one_way',
        hotelNights: 3,
        extendsBeyondHotel: true,
        signalsCaught: ['después me quedo con un amigo'],
      },
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '2026-07-10',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-10',
        checkoutDate: '2026-07-17',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.flights?.tripType).toBe('one_way');
    expect(out.flights?.tripTypeInferred).toBe(true);
    expect(out.flights?.returnDate).toBeUndefined();
  });

  it('partialStay.hotelNights overrides default 7-night checkout', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      partialStay: {
        flightIntent: 'one_way',
        hotelNights: 3,
        extendsBeyondHotel: true,
        signalsCaught: ["crashing at a friend's place"],
      },
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '2026-07-10',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-10',
        checkoutDate: '2026-07-17', // default 7 nights — should be overridden
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.hotels?.checkoutDate).toBe('2026-07-13'); // checkin + 3
    expect(out.hotels?.checkoutDateInferred).toBe(true);
  });

  it('partialStay with explicit returnDate from user keeps round_trip (explicit wins)', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      partialStay: {
        flightIntent: 'one_way',
        hotelNights: 3,
        extendsBeyondHotel: true,
        signalsCaught: ['después me quedo con un amigo'],
      },
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '2026-07-10',
        returnDate: '2026-07-20',
        tripType: 'round_trip', // explicit user round-trip
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-10',
        checkoutDate: '2026-07-13',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    // Explicit returnDate + round_trip is preserved.
    expect(out.flights?.tripType).toBe('round_trip');
    expect(out.flights?.returnDate).toBe('2026-07-20');
    expect(out.flights?.tripTypeInferred).toBeUndefined();
  });

  it('partialStay.extendsBeyondHotel=false leaves combined behavior unchanged', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      partialStay: {
        flightIntent: 'round_trip',
        hotelNights: 7,
        extendsBeyondHotel: false,
        signalsCaught: [],
      },
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '2026-07-10',
        returnDate: '2026-07-17',
        tripType: 'round_trip',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-10',
        checkoutDate: '2026-07-17',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.flights?.tripType).toBe('round_trip');
    expect(out.flights?.returnDate).toBe('2026-07-17');
    expect(out.flights?.tripTypeInferred).toBeUndefined();
    expect(out.hotels?.checkoutDate).toBe('2026-07-17');
    expect(out.hotels?.checkoutDateInferred).toBeUndefined();
  });

  it('partialStay without hotelNights does not override existing checkoutDate', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      partialStay: {
        flightIntent: 'one_way',
        // hotelNights omitted
        extendsBeyondHotel: true,
        signalsCaught: ['después me quedo en otro lado'],
      },
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '2026-07-10',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-10',
        checkoutDate: '2026-07-15',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    // checkoutDate untouched, but flight tripType still flips to one_way.
    expect(out.hotels?.checkoutDate).toBe('2026-07-15');
    expect(out.hotels?.checkoutDateInferred).toBeUndefined();
    expect(out.flights?.tripType).toBe('one_way');
    expect(out.flights?.tripTypeInferred).toBe(true);
  });

  it('partialStay sets tripTypeInferred=true and checkoutDateInferred=true', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      partialStay: {
        flightIntent: 'one_way',
        hotelNights: 4,
        extendsBeyondHotel: true,
        signalsCaught: ['depois fico na casa de um amigo'],
      },
      flights: {
        origin: 'GRU',
        destination: 'CUN',
        departureDate: '2026-08-01',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-08-01',
        checkoutDate: '2026-08-08', // 7-night default → will be overridden
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.flights?.tripTypeInferred).toBe(true);
    expect(out.hotels?.checkoutDate).toBe('2026-08-05'); // +4 nights
    expect(out.hotels?.checkoutDateInferred).toBe(true);
  });

  it('partialStay absent ⇒ normalizer is a no-op for this rule', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '2026-07-10',
        returnDate: '2026-07-17',
        tripType: 'round_trip',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-10',
        checkoutDate: '2026-07-17',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.flights?.tripType).toBe('round_trip');
    expect(out.flights?.tripTypeInferred).toBeUndefined();
    expect(out.flights?.returnDate).toBe('2026-07-17');
    expect(out.hotels?.checkoutDate).toBe('2026-07-17');
    expect(out.hotels?.checkoutDateInferred).toBeUndefined();
  });

  it('partialStay + travelerType=couple still resolves adults=2 (Phase 1 still runs)', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      travelerType: 'couple',
      partialStay: {
        flightIntent: 'one_way',
        hotelNights: 3,
        extendsBeyondHotel: true,
        signalsCaught: ['después me quedo con un amigo'],
      },
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '2026-07-10',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-10',
        checkoutDate: '2026-07-17',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    // Phase 1 — couple → adults=2.
    expect(out.flights?.adults).toBe(2);
    expect(out.hotels?.adults).toBe(2);
    expect(out.hotels?.roomType).toBe('double');
    // Phase 2 — partial-stay still runs.
    expect(out.flights?.tripType).toBe('one_way');
    expect(out.flights?.tripTypeInferred).toBe(true);
    expect(out.hotels?.checkoutDate).toBe('2026-07-13'); // checkin + 3
    expect(out.hotels?.checkoutDateInferred).toBe(true);
  });

  it('partialStay + relativeDateHint: partial-stay applies first, then relative dates respect tripType=one_way', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      relativeDateHint: 'tomorrow',
      partialStay: {
        flightIntent: 'one_way',
        hotelNights: 3,
        extendsBeyondHotel: true,
        signalsCaught: ['después me quedo con un amigo'],
      },
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '',
        checkoutDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    // Partial-stay locked one_way BEFORE relative-date filling, so the
    // combined-mode round-trip return is suppressed.
    expect(out.flights?.tripType).toBe('one_way');
    expect(out.flights?.tripTypeInferred).toBe(true);
    expect(out.flights?.departureDate).toBe('2026-05-12'); // tomorrow
    expect(out.flights?.returnDate).toBeUndefined();

    // Hotel checkin filled by relative-date; checkout filled later by
    // applyRelativeDates' default (since partial-stay couldn't compute
    // checkout: there was no checkin yet when partial-stay ran).
    expect(out.hotels?.checkinDate).toBe('2026-05-12');
    // Relative-date 7-night default applies because partial-stay couldn't
    // recompute checkout (no checkin at the time it ran). This is acceptable
    // behavior — the user's explicit hotelNights=3 will only take effect when
    // they confirm the checkin date in a follow-up turn. Documented limitation.
    expect(out.hotels?.checkoutDate).toBe('2026-05-19');
    expect(out.hotels?.checkoutDateInferred).toBe(true);
  });
});

// =============================================================================
// Phase 4 — applyDateFallback
//
// Final structural fallback: when the parser, partial-stay, and relative-date
// steps all leave dates empty, synthesize today+3 / checkin+7 from the injected
// clock. Replaces the legacy `applyDefaultSearchAssumptions` Spanish-regex path.
// All tests inject NOW_MONDAY (2026-05-11). Expected fallback start: 2026-05-14
// (now + 3). Expected fallback end (checkin+7): 2026-05-21.
// =============================================================================

describe('normalizeSearchIntent — applyDateFallback (Phase 4)', () => {
  it('flights with no departureDate gets today+3 and departureDateInferred=true', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      flights: {
        origin: 'EZE',
        destination: 'MAD',
        departureDate: '',
        adults: 1,
        adultsExplicit: true,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.flights?.departureDate).toBe('2026-05-14');
    expect(out.flights?.departureDateInferred).toBe(true);
    // Flights-only: no return fallback (only combined-mode synthesizes one).
    expect(out.flights?.returnDate).toBeUndefined();
    expect(out.flights?.returnDateInferred).toBeUndefined();
  });

  it('hotels with no checkinDate gets today+3 and checkin+7 for checkout', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      hotels: {
        city: 'Cancún',
        checkinDate: '',
        checkoutDate: '',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.hotels?.checkinDate).toBe('2026-05-14');
    expect(out.hotels?.checkinDateInferred).toBe(true);
    expect(out.hotels?.checkoutDate).toBe('2026-05-21'); // checkin + 7
    expect(out.hotels?.checkoutDateInferred).toBe(true);
  });

  it('combined with checkinDate but no checkoutDate gets checkin+7 (partial fallback)', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '2026-08-01',
        returnDate: '2026-08-10',
        tripType: 'round_trip',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-08-01',
        checkoutDate: '',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    // Explicit checkin preserved.
    expect(out.hotels?.checkinDate).toBe('2026-08-01');
    expect(out.hotels?.checkinDateInferred).toBeUndefined();
    // Checkout filled from checkin + 7.
    expect(out.hotels?.checkoutDate).toBe('2026-08-08');
    expect(out.hotels?.checkoutDateInferred).toBe(true);
    // Flights untouched.
    expect(out.flights?.departureDate).toBe('2026-08-01');
    expect(out.flights?.departureDateInferred).toBeUndefined();
    expect(out.flights?.returnDate).toBe('2026-08-10');
    expect(out.flights?.returnDateInferred).toBeUndefined();
  });

  it('explicit dates are preserved (no fallback fires, no inference flags)', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      flights: {
        origin: 'EZE',
        destination: 'MIA',
        departureDate: '2026-09-15',
        returnDate: '2026-09-22',
        tripType: 'round_trip',
        adults: 1,
        adultsExplicit: true,
        children: 0,
      },
      hotels: {
        city: 'Miami',
        checkinDate: '2026-09-15',
        checkoutDate: '2026-09-22',
        adults: 1,
        adultsExplicit: true,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.flights?.departureDate).toBe('2026-09-15');
    expect(out.flights?.returnDate).toBe('2026-09-22');
    expect(out.hotels?.checkinDate).toBe('2026-09-15');
    expect(out.hotels?.checkoutDate).toBe('2026-09-22');
    // No inference flags set on user-explicit values.
    expect(out.flights?.departureDateInferred).toBeUndefined();
    expect(out.flights?.returnDateInferred).toBeUndefined();
    expect(out.hotels?.checkinDateInferred).toBeUndefined();
    expect(out.hotels?.checkoutDateInferred).toBeUndefined();
  });

  it('relativeDateHint resolves first; fallback only fires if normalizer chain still left it empty', () => {
    // Hint=tomorrow on combined → applyRelativeDates fills both flights and
    // hotels. Fallback should be a no-op (nothing left empty).
    const parsed = makeParsed({
      requestType: 'combined',
      relativeDateHint: 'tomorrow',
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '',
        checkoutDate: '',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    // Relative-date filling produced these values; fallback did not overwrite.
    expect(out.flights?.departureDate).toBe('2026-05-12'); // tomorrow
    expect(out.flights?.returnDate).toBe('2026-05-19'); // +7
    expect(out.hotels?.checkinDate).toBe('2026-05-12');
    expect(out.hotels?.checkoutDate).toBe('2026-05-19');
    // applyRelativeDates already set checkoutDateInferred; departureDateInferred
    // should NOT be set by fallback (relative-date filling wrote the value).
    expect(out.hotels?.checkoutDateInferred).toBe(true);
    expect(out.flights?.departureDateInferred).toBeUndefined();
    expect(out.hotels?.checkinDateInferred).toBeUndefined();
  });

  it('partialStay one_way + flights-only: fallback fills departureDate, no returnDate', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      partialStay: {
        flightIntent: 'one_way',
        extendsBeyondHotel: true,
        signalsCaught: ['after Bariloche I head to Mendoza by car'],
      },
      flights: {
        origin: 'EZE',
        destination: 'BRC',
        departureDate: '',
        adults: 1,
        adultsExplicit: true,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.flights?.tripType).toBe('one_way');
    expect(out.flights?.tripTypeInferred).toBe(true);
    expect(out.flights?.departureDate).toBe('2026-05-14'); // fallback today+3
    expect(out.flights?.departureDateInferred).toBe(true);
    // No returnDate fallback for flights-only.
    expect(out.flights?.returnDate).toBeUndefined();
    expect(out.flights?.returnDateInferred).toBeUndefined();
  });

  it('combined with no dates anywhere: flights and hotels both filled with aligned defaults', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      flights: {
        origin: 'EZE',
        destination: 'MAD',
        departureDate: '',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
      hotels: {
        city: 'Madrid',
        checkinDate: '',
        checkoutDate: '',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    // Flights: today+3 departure, +7 return (combined-mode round-trip default).
    expect(out.flights?.departureDate).toBe('2026-05-14');
    expect(out.flights?.departureDateInferred).toBe(true);
    expect(out.flights?.returnDate).toBe('2026-05-21');
    expect(out.flights?.returnDateInferred).toBe(true);
    // Hotels: today+3 checkin, checkin+7 checkout.
    expect(out.hotels?.checkinDate).toBe('2026-05-14');
    expect(out.hotels?.checkinDateInferred).toBe(true);
    expect(out.hotels?.checkoutDate).toBe('2026-05-21');
    expect(out.hotels?.checkoutDateInferred).toBe(true);
  });
});

// =============================================================================
// Phase 4 — combined one_way promotion
//
// The LLM defaults `tripType = 'one_way'` for any 1-segment flight. When the
// requestType is `combined`, this is semantically wrong — a flight+hotel
// request implies a closed trip. The normalizer detects that case and
// promotes to `round_trip`, aligning returnDate to the hotel checkoutDate
// when available. The only one_way it respects in combined mode is the
// INTENTIONAL one set by partialStay.extendsBeyondHotel=true.
// =============================================================================

describe('normalizeSearchIntent — combined one_way promotion', () => {
  it('combined + month-only (LLM emits one_way for 1 segment) → promoted to round_trip aligned to hotel.checkoutDate', () => {
    // Simulates "Vuelo + hotel a Madrid en julio" — LLM applies its
    // 1-segment-one_way rule and resolves month to first-of-month. The
    // normalizer should recognize this is a combined trip without
    // partialStay and promote to round_trip aligned to the hotel.
    const parsed = makeParsed({
      requestType: 'combined',
      flights: {
        origin: 'EZE',
        destination: 'MAD',
        departureDate: '2026-07-01',
        tripType: 'one_way',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
      hotels: {
        city: 'Madrid',
        checkinDate: '2026-07-01',
        checkoutDate: '',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    // Hotels branch ran first and filled checkout = checkin + 7.
    expect(out.hotels?.checkoutDate).toBe('2026-07-08');
    expect(out.hotels?.checkoutDateInferred).toBe(true);
    // Flights promoted: tripType → round_trip, returnDate aligned to hotel.
    expect(out.flights?.tripType).toBe('round_trip');
    expect(out.flights?.tripTypeInferred).toBe(true);
    expect(out.flights?.returnDate).toBe('2026-07-08');
    expect(out.flights?.returnDateInferred).toBe(true);
  });

  it('combined + explicit hotel.checkoutDate + LLM one_way → returnDate aligned to checkoutDate (no +7 blind fallback)', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      flights: {
        origin: 'EZE',
        destination: 'CUN',
        departureDate: '2026-08-01',
        tripType: 'one_way',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-08-01',
        checkoutDate: '2026-08-12', // user-explicit 11-night stay
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    // Hotel checkout preserved (user-explicit, no inferred flag).
    expect(out.hotels?.checkoutDate).toBe('2026-08-12');
    expect(out.hotels?.checkoutDateInferred).toBeUndefined();
    // Flights aligned to that 11-night window — NOT departureDate + 7.
    expect(out.flights?.tripType).toBe('round_trip');
    expect(out.flights?.tripTypeInferred).toBe(true);
    expect(out.flights?.returnDate).toBe('2026-08-12');
    expect(out.flights?.returnDateInferred).toBe(true);
  });

  it('combined + partialStay one_way (intentional) → respects one_way, no returnDate promotion', () => {
    // Simulates "Vuelo a Madrid en julio + hotel 3 noches, después me quedo
    // con un amigo" — partialStay.extendsBeyondHotel=true marks intentional
    // one_way. The promotion logic MUST NOT fire here.
    const parsed = makeParsed({
      requestType: 'combined',
      partialStay: {
        flightIntent: 'one_way',
        hotelNights: 3,
        extendsBeyondHotel: true,
        signalsCaught: ['después me quedo con un amigo'],
      },
      flights: {
        origin: 'EZE',
        destination: 'MAD',
        departureDate: '2026-07-01',
        tripType: 'one_way',
        adults: 1,
        adultsExplicit: true,
        children: 0,
      },
      hotels: {
        city: 'Madrid',
        checkinDate: '2026-07-01',
        checkoutDate: '',
        adults: 1,
        adultsExplicit: true,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    // partialStay resolves checkout via hotelNights (3 noches → +3).
    expect(out.hotels?.checkoutDate).toBe('2026-07-04');
    // tripType stays one_way (partialStay intentional), no returnDate.
    expect(out.flights?.tripType).toBe('one_way');
    expect(out.flights?.returnDate).toBeUndefined();
    expect(out.flights?.returnDateInferred).toBeUndefined();
  });

  it('flights-only (no combined) + LLM one_way → respects one_way, no promotion', () => {
    // Promotion is combined-only. A flights-only one_way is a legitimate
    // user choice and must not be touched.
    const parsed = makeParsed({
      requestType: 'flights',
      flights: {
        origin: 'EZE',
        destination: 'MAD',
        departureDate: '2026-07-01',
        tripType: 'one_way',
        adults: 1,
        adultsExplicit: true,
        children: 0,
      },
    });

    const out = normalizeSearchIntent(parsed, NOW_MONDAY);

    expect(out.flights?.tripType).toBe('one_way');
    expect(out.flights?.tripTypeInferred).toBeUndefined();
    expect(out.flights?.returnDate).toBeUndefined();
    expect(out.flights?.returnDateInferred).toBeUndefined();
  });
});
