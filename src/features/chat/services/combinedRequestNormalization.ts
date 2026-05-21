/**
 * Combined-request normalization — post-parse, pre-validation.
 *
 * When the user expresses a combined intent in a way that omits redundant
 * information ("vuelo a Punta Cana y después hotel"), the parser captures
 * the slot on only one product. The validator then asks the user for
 * something they already said. This module syncs the cross-product slots
 * so the validator sees a complete payload.
 *
 * Scope: `requestType === 'combined'` only. Pure. Never mutates the input.
 * Idempotent — calling twice yields the same result as calling once.
 *
 * Rules (only when one side has the data and the other does NOT):
 *   flights.destination   ⇄ hotels.city
 *   flights.departureDate ⇄ hotels.checkinDate
 *   flights.returnDate    ⇄ hotels.checkoutDate
 *
 * The rules NEVER overwrite an existing value — explicit user input always
 * wins over inference. Cases where the two products have legitimately
 * different cities or dates are preserved verbatim.
 */

import type { ParsedTravelRequest } from '@/services/aiMessageParser';

type FlightsSlot = NonNullable<ParsedTravelRequest['flights']>;
type HotelsSlot = NonNullable<ParsedTravelRequest['hotels']>;

const isPresent = (v: unknown): boolean =>
  v !== undefined && v !== null && v !== '';

/**
 * Sync the destination/city and date slots across the two product objects
 * of a combined request. Returns a new parsed request with inferred slots
 * filled in; returns the input unchanged when the request is not combined,
 * when one product slot is missing, or when both sides already have data.
 */
export function inferCrossProductSlots(
  parsed: ParsedTravelRequest,
): ParsedTravelRequest {
  if (!parsed || typeof parsed !== 'object') return parsed;
  if (parsed.requestType !== 'combined') return parsed;
  if (!parsed.flights || !parsed.hotels) return parsed;

  const flights: FlightsSlot = { ...parsed.flights };
  const hotels: HotelsSlot = { ...parsed.hotels };
  let changed = false;

  // destination / city
  if (isPresent(flights.destination) && !isPresent(hotels.city)) {
    hotels.city = flights.destination as string;
    changed = true;
  } else if (isPresent(hotels.city) && !isPresent(flights.destination)) {
    flights.destination = hotels.city as string;
    changed = true;
  }

  // departureDate / checkinDate
  if (isPresent(flights.departureDate) && !isPresent(hotels.checkinDate)) {
    hotels.checkinDate = flights.departureDate as string;
    changed = true;
  } else if (isPresent(hotels.checkinDate) && !isPresent(flights.departureDate)) {
    flights.departureDate = hotels.checkinDate as string;
    changed = true;
  }

  // returnDate / checkoutDate
  if (isPresent(flights.returnDate) && !isPresent(hotels.checkoutDate)) {
    hotels.checkoutDate = flights.returnDate as string;
    changed = true;
  } else if (isPresent(hotels.checkoutDate) && !isPresent(flights.returnDate)) {
    flights.returnDate = hotels.checkoutDate as string;
    changed = true;
  }

  if (!changed) return parsed;

  return { ...parsed, flights, hotels };
}
