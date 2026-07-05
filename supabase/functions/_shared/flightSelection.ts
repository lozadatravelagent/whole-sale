/**
 * Flight selection — one flight per distinct price, keeping the fewest-stops option on ties.
 *
 * Shared rule across Emilia Web, Emilia API (/v1/emilia/turn) and /v1/search:
 *  1. Sort by price ASC, then by fewer stops (escalas) ASC.
 *  2. Keep the FIRST flight of each distinct price — given the sort, that is the
 *     one with the fewest stops at that price.
 *  3. Return ALL distinct-price flights, sorted by price ASC (no cap).
 *
 * The dedup key includes the currency because flights are NOT currency-normalized;
 * two fares with the same numeric amount but different currencies must not collapse.
 *
 * NOTE: `api/`, `supabase/functions/` and `src/` are separate projects with no shared
 * code, so this helper is intentionally duplicated (kept identical) in each of them.
 */

interface PricedFlight {
  price?: { amount?: number; currency?: string };
  stops?: { count?: number };
  legs?: Array<{ options?: Array<{ segments?: unknown[] }> }>;
}

/** Total number of stops (escalas) for a flight, summed across its legs. */
export function countFlightStops(flight: PricedFlight): number {
  const precomputed = flight?.stops?.count;
  if (typeof precomputed === 'number') return precomputed;

  const legs = Array.isArray(flight?.legs) ? flight.legs : [];
  return legs.reduce((sum, leg) => {
    const segments = leg?.options?.[0]?.segments;
    const segCount = Array.isArray(segments) ? segments.length : 1;
    return sum + Math.max(0, segCount - 1);
  }, 0);
}

/**
 * One flight per distinct price (fewest stops wins ties), all distinct prices,
 * sorted by price ASC. No upper limit.
 */
export function selectDistinctPriceFlights<T extends PricedFlight>(flights: T[]): T[] {
  if (!Array.isArray(flights) || flights.length === 0) return [];

  const sorted = [...flights].sort((a, b) => {
    const priceA = a?.price?.amount ?? 0;
    const priceB = b?.price?.amount ?? 0;
    if (priceA !== priceB) return priceA - priceB;
    // Same price → prefer the flight with fewer stops (escalas)
    return countFlightStops(a) - countFlightStops(b);
  });

  const seen = new Set<string>();
  const result: T[] = [];
  for (const flight of sorted) {
    const amount = flight?.price?.amount ?? 0;
    const currency = flight?.price?.currency ?? 'USD';
    const key = `${amount}|${currency}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(flight);
    }
  }
  return result;
}
