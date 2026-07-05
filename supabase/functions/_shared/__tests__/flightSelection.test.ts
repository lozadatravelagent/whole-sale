import { describe, expect, it } from 'vitest';
import { countFlightStops, selectDistinctPriceFlights } from '../flightSelection.ts';

/** Build a minimal flight with a precomputed stops.count. */
function flight(
  amount: number,
  stopsCount: number,
  opts: { id?: string; currency?: string } = {},
) {
  return {
    id: opts.id ?? `f-${amount}-${stopsCount}`,
    price: { amount, currency: opts.currency ?? 'USD' },
    stops: { count: stopsCount },
  };
}

/** Build a flight whose stop count must be derived from its legs/options/segments. */
function legFlight(amount: number, segmentsPerLeg: number[], id: string) {
  return {
    id,
    price: { amount, currency: 'USD' },
    legs: segmentsPerLeg.map((n) => ({
      options: [{ segments: Array.from({ length: n }, () => ({})) }],
    })),
  };
}

describe('selectDistinctPriceFlights', () => {
  it('keeps one flight per distinct price', () => {
    const result = selectDistinctPriceFlights([
      flight(700, 1, { id: 'x' }),
      flight(500, 0, { id: 'y' }),
      flight(600, 2, { id: 'z' }),
    ]);
    expect(result.map((f) => f.price.amount)).toEqual([500, 600, 700]);
  });

  it('returns ALL distinct prices (no cap)', () => {
    const flights = Array.from({ length: 12 }, (_, i) =>
      flight(100 + i * 25, 1, { id: `f${i}` }),
    );
    expect(selectDistinctPriceFlights(flights)).toHaveLength(12);
  });

  it('sorts the result by price ascending', () => {
    const result = selectDistinctPriceFlights([
      flight(900, 0, { id: 'c' }),
      flight(300, 0, { id: 'a' }),
      flight(600, 0, { id: 'b' }),
    ]);
    expect(result.map((f) => f.id)).toEqual(['a', 'b', 'c']);
  });

  it('on a price tie, keeps the flight with the fewest escalas (stops.count)', () => {
    const result = selectDistinctPriceFlights([
      flight(500, 2, { id: 'two' }),
      flight(500, 0, { id: 'direct' }),
      flight(500, 1, { id: 'one' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('direct');
  });

  it('on a price tie, uses leg-derived stops when stops.count is absent', () => {
    const result = selectDistinctPriceFlights([
      legFlight(500, [2, 2], 'two-stops'), // (2-1)+(2-1) = 2 escalas
      legFlight(500, [1, 1], 'direct'), // 0 escalas
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('direct');
  });

  it('does NOT collapse the same amount in different currencies', () => {
    const result = selectDistinctPriceFlights([
      flight(500, 1, { id: 'usd', currency: 'USD' }),
      flight(500, 0, { id: 'eur', currency: 'EUR' }),
    ]);
    expect(result).toHaveLength(2);
  });

  it('returns an empty array for empty or nullish input', () => {
    expect(selectDistinctPriceFlights([])).toEqual([]);
    const nullish = undefined as unknown as never[];
    expect(selectDistinctPriceFlights(nullish)).toEqual([]);
  });

  it('does not mutate the input array order', () => {
    const input = [flight(700, 0, { id: 'x' }), flight(500, 0, { id: 'y' })];
    selectDistinctPriceFlights(input);
    expect(input.map((f) => f.id)).toEqual(['x', 'y']);
  });
});

describe('countFlightStops', () => {
  it('prefers a precomputed stops.count', () => {
    expect(countFlightStops({ stops: { count: 3 }, legs: [] })).toBe(3);
  });

  it('sums escalas across legs when stops.count is missing', () => {
    expect(countFlightStops(legFlight(0, [2, 1], 'x'))).toBe(1); // (2-1)+(1-1)
    expect(countFlightStops(legFlight(0, [3, 2], 'y'))).toBe(3); // (3-1)+(2-1)
  });

  it('treats a flight with no legs as direct (0 stops)', () => {
    expect(countFlightStops({})).toBe(0);
  });
});
