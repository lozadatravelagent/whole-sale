import { describe, expect, it } from 'vitest';
import { mapDelfosFlightOffer, mapDelfosFlightOffers } from '../mapFlights.ts';
import { buildDelfosFlightSearchBody } from '../buildRequest.ts';

const sampleOffer = {
  offer_id: 'off_01J00000000000000000000000',
  provider: 'lleego',
  route_type: 'ROUND_TRIP',
  is_two_one_ways: false,
  price: {
    total: { amount: '899.50', currency: 'USD' },
    breakdown: [],
  },
  is_private_fare: false,
  time_limits: { last_ticket_date: null, requires_immediate_ticketing: false },
  priceable_until: '2026-07-11T12:00:00Z',
  journeys: [
    {
      origin: 'EZE',
      destination: 'MAD',
      departure_at: '2026-08-15T22:00:00',
      arrival_at: '2026-08-16T14:00:00',
      layovers: 0,
      duration_minutes: 720,
      segments: [
        {
          marketing_carrier: 'IB',
          operating_carrier: 'IB',
          flight_number: '6846',
          origin: 'EZE',
          destination: 'MAD',
          departure_at: '2026-08-15T22:00:00',
          arrival_at: '2026-08-16T14:00:00',
          technical_stops: [],
          fare_type: 'PUBLIC',
        },
      ],
    },
    {
      origin: 'MAD',
      destination: 'EZE',
      departure_at: '2026-08-30T11:00:00',
      arrival_at: '2026-08-30T19:00:00',
      layovers: 0,
      duration_minutes: 720,
      segments: [
        {
          marketing_carrier: 'IB',
          operating_carrier: 'IB',
          flight_number: '6845',
          origin: 'MAD',
          destination: 'EZE',
          departure_at: '2026-08-30T11:00:00',
          arrival_at: '2026-08-30T19:00:00',
          technical_stops: [],
          fare_type: 'PUBLIC',
        },
      ],
    },
  ],
};

describe('mapDelfosFlightOffer', () => {
  it('maps amount string and provider fields', () => {
    const mapped = mapDelfosFlightOffer(sampleOffer, { adults: 2, children: 1, infants: 0 });
    expect(mapped.provider).toBe('DELFOS');
    expect(mapped.providerOfferId).toBe('off_01J00000000000000000000000');
    expect(mapped.price.amount).toBe(899.5);
    expect(mapped.price.currency).toBe('USD');
    expect(mapped.airline.code).toBe('IB');
    expect(mapped.departure_date).toBe('2026-08-15');
    expect(mapped.departure_time).toBe('22:00');
    expect(mapped.return_date).toBe('2026-08-30');
    expect(mapped.stops.direct).toBe(true);
    expect(mapped.providerMeta.priceableUntil).toBe('2026-07-11T12:00:00Z');
    expect(mapped.legs).toHaveLength(2);
    expect(mapped.adults).toBe(2);
  });

  it('maps empty list safely', () => {
    expect(mapDelfosFlightOffers(null as any)).toEqual([]);
  });
});

describe('buildDelfosFlightSearchBody', () => {
  it('builds round trip from origin/destination', () => {
    const result = buildDelfosFlightSearchBody({
      origin: 'eze',
      destination: 'mad',
      departureDate: '2026-08-15',
      returnDate: '2026-08-30',
      adults: 2,
      children: 1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.journeys).toEqual([
      { origin: 'EZE', destination: 'MAD', date: '2026-08-15' },
      { origin: 'MAD', destination: 'EZE', date: '2026-08-30' },
    ]);
    expect((result.body.passengers as any).ages).toEqual([30, 30, 8]);
  });

  it('rejects multi-city >2 legs', () => {
    const result = buildDelfosFlightSearchBody({
      segments: [
        { origin: 'EZE', destination: 'MAD', departureDate: '2026-08-01' },
        { origin: 'MAD', destination: 'CDG', departureDate: '2026-08-05' },
        { origin: 'CDG', destination: 'EZE', departureDate: '2026-08-10' },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNSUPPORTED_ITINERARY');
  });
});
