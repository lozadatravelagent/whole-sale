/**
 * Emilia 5.0 — Search Intent Normalizer (Phase 1 + Phase 2)
 *
 * Pure deterministic layer that runs between the LLM parser and the router.
 * Fills safe structural defaults the parser intentionally leaves for the
 * client to derive (so prompt size stays bounded and the schema stays stable).
 *
 * Phase 1 scope:
 *   1. Apply `travelerType` semantic value to `adults` (couple → 2, solo → 1).
 *   2. Derive `roomType` from total passenger count when not explicit.
 *
 * Phase 2 scope:
 *   3. Apply `partialStay` (vuelo + hotel parcial) semantics: set
 *      `flights.tripType` and recompute `hotels.checkoutDate` from
 *      `hotelNights` when present.
 *   4. Apply `relativeDateHint` arithmetic against an injected clock
 *      (`tomorrow`, `this_weekend`, `next_week`, `next_month`).
 *
 * Invariants:
 *   - Pure function. No I/O, no side effects, no React/Supabase imports.
 *   - Deterministic with respect to the injected `now` clock.
 *   - Deeply non-mutating: returns a new ParsedTravelRequest; the input is
 *     untouched. Downstream code (router, search handlers) sees the
 *     normalized payload; the original is preserved for telemetry/audit.
 *   - Explicit user values ALWAYS win. `adultsExplicit === true` blocks
 *     traveler-type adult overrides; an explicit `roomType` blocks pax-based
 *     derivation; explicit `departureDate`/`checkinDate` blocks relative-date
 *     filling; explicit `returnDate` blocks the partial-stay one-way override.
 *   - Whenever a value is derived (not user-spoken), the corresponding
 *     `*Inferred` flag is set so UI/copy can disclose the inference.
 */

import type { HotelRequest, ParsedTravelRequest } from '@/services/aiMessageParser';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Room derivation table by total pax (adults + children + infants).
 *
 * Schema enum is `'single' | 'double' | 'triple' | 'quadruple'`. For 5+ pax we
 * leave roomType undefined — the spec says that fallback is a render concern
 * (e.g. show "2 dobles + 1 single"), not a normalizer concern.
 */
const ROOM_BY_PAX: Record<number, HotelRequest['roomType']> = {
  1: 'single',
  2: 'double',
  3: 'triple',
  4: 'quadruple',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function totalHotelPax(hotels: HotelRequest | undefined): number {
  if (!hotels) return 0;
  return (hotels.adults || 0) + (hotels.children || 0) + (hotels.infants || 0);
}

/**
 * Derives the canonical roomType for a hotel block based on total pax.
 * Returns undefined when the count is outside the supported enum range
 * (5+ pax — the render layer handles that case, e.g. "2 dobles + 1 single").
 */
function deriveRoomTypeFromPax(hotels: HotelRequest | undefined): HotelRequest['roomType'] | undefined {
  const pax = totalHotelPax(hotels);
  return ROOM_BY_PAX[pax];
}

/**
 * UTC-safe date arithmetic — we reason in YYYY-MM-DD strings, so do the math
 * in UTC to avoid agency-timezone drift around midnight (a Buenos Aires user
 * adding 7 days at 23:55 must not produce the same date because of local-tz
 * rounding). Constructing from the input epoch and using `setUTCDate` keeps
 * the result deterministic regardless of the host timezone.
 */
function addDays(d: Date, n: number): Date {
  const next = new Date(d.getTime());
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

/**
 * Returns the next date that falls on the given weekday (0=Sun, 1=Mon, ... 6=Sat).
 *
 * Convention: if `from` itself already falls on `weekday`, returns `from + 7`
 * (the NEXT occurrence, never today). This matches "next Monday" semantics
 * — on a Monday, "next Monday" means a week from now, not today.
 *
 * NOTE: the `this_weekend` Saturday edge case is handled in
 * `applyRelativeDates` directly, NOT here. On a Saturday, this_weekend uses
 * TODAY (Saturday) as the start and tomorrow (Sunday) as the end, so we
 * deliberately bypass `nextWeekday` for the start in that case.
 */
function nextWeekday(from: Date, weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6): Date {
  const fromDow = from.getUTCDay();
  let delta = (weekday - fromDow + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(from, delta);
}

/**
 * First day (1st) of the month AFTER the month containing `from`. UTC-safe.
 */
function firstDayOfNextMonth(from: Date): Date {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return next;
}

/**
 * ISO date string (YYYY-MM-DD) in UTC. Matches the format used everywhere
 * else in the parser (departureDate/checkinDate are wire-format ISO dates).
 */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Phase 2 — Partial-stay normalization
// ---------------------------------------------------------------------------

/**
 * Applies `partialStay` semantics in-place on the cloned `next` payload.
 *
 * Behavior:
 *   - If `flights` is present and the user did NOT explicitly state a
 *     returnDate, set `flights.tripType` to `partialStay.flightIntent`
 *     (defaulting to `'one_way'`). When the resolved tripType is `one_way`,
 *     remove any pre-existing `returnDate` (legacy carry-over) and flag
 *     `tripTypeInferred = true`.
 *   - If `flights.returnDate` is set (explicit), leave tripType alone —
 *     explicit user values always win.
 *   - If `partialStay.hotelNights` is set AND `hotels.checkinDate` is
 *     present, recompute `hotels.checkoutDate = checkin + hotelNights`. If
 *     the user already provided a checkoutDate that matches the computed
 *     value, leave it (no-op) and DO NOT set `checkoutDateInferred`. If
 *     it differs, overwrite and set `checkoutDateInferred = true`.
 *
 * Runs BEFORE `applyRelativeDates` so that downstream date defaults respect
 * the resolved `tripType` (e.g. relative-date filler must not add a
 * returnDate when partial-stay set one_way).
 */
function applyPartialStay(next: ParsedTravelRequest): void {
  const partialStay = next.partialStay;
  if (!partialStay || partialStay.extendsBeyondHotel !== true) return;

  // --- Flight intent ---
  if (next.flights) {
    const userExplicitReturn = typeof next.flights.returnDate === 'string'
      && next.flights.returnDate.length > 0
      // Don't treat a returnDate as "explicit" if the model just echoed the
      // checkout-derived round-trip default. Heuristic: if tripType is unset
      // OR explicitly 'one_way' / 'multi_city', the returnDate is not a hard
      // explicit signal. We rely on tripType === 'round_trip' as the
      // explicit-intent marker.
      && next.flights.tripType === 'round_trip';

    if (!userExplicitReturn) {
      const resolvedIntent = partialStay.flightIntent ?? 'one_way';
      const flights = { ...next.flights };
      flights.tripType = resolvedIntent;
      flights.tripTypeInferred = true;
      if (resolvedIntent === 'one_way') {
        delete flights.returnDate;
      }
      next.flights = flights;
    }
  }

  // --- Hotel nights → checkout ---
  if (
    typeof partialStay.hotelNights === 'number'
    && partialStay.hotelNights > 0
    && next.hotels
    && typeof next.hotels.checkinDate === 'string'
    && next.hotels.checkinDate.length > 0
  ) {
    const checkinIso = next.hotels.checkinDate;
    // Parse YYYY-MM-DD as UTC midnight for safe arithmetic.
    const checkin = new Date(`${checkinIso}T00:00:00.000Z`);
    if (!Number.isNaN(checkin.getTime())) {
      const computedCheckout = toIsoDate(addDays(checkin, partialStay.hotelNights));
      const existingCheckout = next.hotels.checkoutDate;
      if (existingCheckout !== computedCheckout) {
        next.hotels = {
          ...next.hotels,
          checkoutDate: computedCheckout,
          checkoutDateInferred: true,
        };
      }
      // If existing matches computed, the user-explicit value already aligns
      // with hotelNights — leave it alone (explicit wins, no inferred flag).
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 2 — Relative-date hint normalization
// ---------------------------------------------------------------------------

/**
 * Returns true when `flights` exists and the user did NOT provide an explicit
 * departure date. Used to gate relative-date filling.
 */
function flightsNeedDateFill(parsed: ParsedTravelRequest): boolean {
  if (!parsed.flights) return false;
  return !parsed.flights.departureDate || parsed.flights.departureDate.length === 0;
}

/**
 * Returns true when `hotels` exists and the user did NOT provide an explicit
 * check-in date.
 */
function hotelsNeedDateFill(parsed: ParsedTravelRequest): boolean {
  if (!parsed.hotels) return false;
  return !parsed.hotels.checkinDate || parsed.hotels.checkinDate.length === 0;
}

/**
 * Applies relative-date arithmetic in-place on the cloned `next` payload.
 *
 * Behavior matrix (when `relativeDateHint` set AND no explicit start date):
 *   - tomorrow + flights-only → one_way, departureDate = now+1
 *   - tomorrow + hotels-only → checkinDate = now+1, checkoutDate = now+8 (7 nights)
 *   - tomorrow + combined → flights now+1 → now+8 (round_trip), hotels aligned
 *   - this_weekend → next Friday → next Sunday (2 nights)
 *     EDGE: when `now` is itself a Saturday, use TODAY-Sunday (1 night start
 *     from Saturday, end on tomorrow = Sunday) — documented in nextWeekday.
 *   - next_week + flights-only → next Monday one-way
 *   - next_week + hotels/combined → next Monday → +7 days (Monday-to-Monday)
 *   - next_month → first-of-next-month + 7 nights when hotel present;
 *     flights-only → first-of-next-month, one_way
 *
 * Explicit user dates always win — both gates (`flightsNeedDateFill`,
 * `hotelsNeedDateFill`) skip when an explicit date is present.
 *
 * Respects the tripType set by `applyPartialStay` when run earlier: the
 * combined-mode return/round-trip block only runs when `flights.tripType`
 * is NOT already `one_way` (partial-stay locked it as one_way).
 */
function applyRelativeDates(next: ParsedTravelRequest, now: Date): void {
  const hint = next.relativeDateHint;
  if (!hint) return;

  const hasFlights = !!next.flights;
  const hasHotels = !!next.hotels;
  if (!hasFlights && !hasHotels) return;

  const flightsFill = flightsNeedDateFill(next);
  const hotelsFill = hotelsNeedDateFill(next);
  if (!flightsFill && !hotelsFill) return;

  // Resolve the (start, end) pair per hint. `end` is `null` when only a
  // single-date one-way scenario applies (no hotel and no return).
  let start: Date;
  let end: Date | null;

  switch (hint) {
    case 'tomorrow': {
      start = addDays(now, 1);
      end = addDays(start, 7); // default 7-night window
      break;
    }
    case 'this_weekend': {
      const dow = now.getUTCDay();
      if (dow === 6 /* Saturday */) {
        // EDGE: on a Saturday, "this weekend" already started today.
        // Use TODAY (Sat) as the start and TOMORROW (Sun) as the end.
        // 1-night stay; flights-only takes Saturday one-way.
        start = now;
        end = addDays(now, 1);
      } else {
        start = nextWeekday(now, 5 /* Friday */);
        end = nextWeekday(now, 0 /* Sunday */);
        // If Sunday computed earlier than Friday (week-wrap edge), bump
        // Sunday by 7 days. nextWeekday's "+7 if today" convention prevents
        // this in normal cases, but be defensive.
        if (end.getTime() <= start.getTime()) {
          end = addDays(end, 7);
        }
      }
      break;
    }
    case 'next_week': {
      start = nextWeekday(now, 1 /* Monday */);
      end = addDays(start, 7); // Monday-to-Monday
      break;
    }
    case 'next_month': {
      start = firstDayOfNextMonth(now);
      end = addDays(start, 7);
      break;
    }
    default:
      return;
  }

  const startIso = toIsoDate(start);
  const endIso = end ? toIsoDate(end) : null;

  // ----- Apply to flights -----
  if (hasFlights && flightsFill) {
    const flights = { ...next.flights! };
    flights.departureDate = startIso;
    if (hasHotels) {
      // Combined: align flight return to hotel checkout unless partial-stay
      // already locked tripType=one_way.
      if (flights.tripType !== 'one_way' && endIso) {
        flights.returnDate = endIso;
        if (flights.tripType !== 'round_trip') {
          flights.tripType = 'round_trip';
          flights.tripTypeInferred = true;
        }
      }
    } else {
      // Flights-only: one-way. Don't add a returnDate.
      if (!flights.tripType) {
        flights.tripType = 'one_way';
        flights.tripTypeInferred = true;
      }
    }
    next.flights = flights;
  }

  // ----- Apply to hotels -----
  if (hasHotels && hotelsFill && endIso) {
    const hotels = { ...next.hotels! };
    hotels.checkinDate = startIso;
    // Don't overwrite checkoutDate if partial-stay already set it (the
    // partial-stay branch ran earlier and set checkoutDateInferred). Use
    // checkin + nights here only when checkout is also missing.
    if (!hotels.checkoutDate || hotels.checkoutDate.length === 0) {
      hotels.checkoutDate = endIso;
      hotels.checkoutDateInferred = true;
    }
    next.hotels = hotels;
  }
}

// ---------------------------------------------------------------------------
// Phase 4 — Structural date fallback
// ---------------------------------------------------------------------------

/**
 * Default offset (in days) from `now` for the synthesized start date when no
 * explicit nor relative date was provided. Mirrors the legacy
 * `DEFAULT_SEARCH_START_OFFSET_DAYS` constant from `aiMessageParser.ts`.
 */
const DEFAULT_SEARCH_START_OFFSET_DAYS = 3;

/**
 * Default duration (in days) added to a fallback start date to produce a
 * fallback end date for hotels/combined searches. Aligned with the 7-night
 * window used by `applyRelativeDates` for consistency.
 */
const DEFAULT_FALLBACK_STAY_NIGHTS = 7;

/**
 * Applies structural date defaults LAST in the normalizer chain.
 *
 * Behavior (Phase 4):
 *   - flights: if `departureDate` is still missing after upstream steps
 *     (relative-date filling, partial-stay), set it to `now + 3 days` and
 *     flag `departureDateInferred = true`.
 *   - combined flights: if `returnDate` is missing AND tripType is not
 *     `one_way` (partial-stay may have locked it), set it to
 *     `departureDate + 7 days` and flag `returnDateInferred = true`.
 *   - hotels (and combined hotels): if `checkinDate` is missing, set it to
 *     `now + 3 days` and flag `checkinDateInferred = true`. If `checkoutDate`
 *     is also missing, set it to `checkinDate + 7 days` and flag
 *     `checkoutDateInferred = true`.
 *
 * This is purely structural — no regex on the original message. The function
 * operates on the parsed JSON only and assumes upstream steps already
 * resolved any user-provided or relative-date hints.
 */
function applyDateFallback(next: ParsedTravelRequest, now: Date): void {
  const fallbackStart = toIsoDate(addDays(now, DEFAULT_SEARCH_START_OFFSET_DAYS));

  // ----- Flights -----
  if (
    (next.requestType === 'flights' || next.requestType === 'combined')
    && next.flights
  ) {
    const flights = { ...next.flights };
    let touched = false;

    if (!flights.departureDate || flights.departureDate.length === 0) {
      flights.departureDate = fallbackStart;
      flights.departureDateInferred = true;
      touched = true;
    }

    // Combined-mode round-trip return fallback. Skip when partial-stay or
    // an upstream step locked tripType=one_way.
    if (
      next.requestType === 'combined'
      && flights.tripType !== 'one_way'
      && (!flights.returnDate || flights.returnDate.length === 0)
    ) {
      const startDate = new Date(`${flights.departureDate}T00:00:00.000Z`);
      if (!Number.isNaN(startDate.getTime())) {
        flights.returnDate = toIsoDate(addDays(startDate, DEFAULT_FALLBACK_STAY_NIGHTS));
        flights.returnDateInferred = true;
        touched = true;
      }
    }

    if (touched) {
      next.flights = flights;
    }
  }

  // ----- Hotels (and combined hotels) -----
  if (
    (next.requestType === 'hotels' || next.requestType === 'combined')
    && next.hotels
  ) {
    const hotels = { ...next.hotels };
    let touched = false;

    if (!hotels.checkinDate || hotels.checkinDate.length === 0) {
      hotels.checkinDate = fallbackStart;
      hotels.checkinDateInferred = true;
      touched = true;
    }

    if (!hotels.checkoutDate || hotels.checkoutDate.length === 0) {
      const checkin = new Date(`${hotels.checkinDate}T00:00:00.000Z`);
      if (!Number.isNaN(checkin.getTime())) {
        hotels.checkoutDate = toIsoDate(addDays(checkin, DEFAULT_FALLBACK_STAY_NIGHTS));
        hotels.checkoutDateInferred = true;
        touched = true;
      }
    }

    if (touched) {
      next.hotels = hotels;
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Normalizes a parsed travel request by filling structural defaults derived
 * from `travelerType` semantics, passenger counts, partial-stay signals, and
 * relative-date hints. Pure function — see file header for full invariants.
 *
 * @param parsed The LLM-parsed travel request (untouched by this function).
 * @param now    Clock injection for deterministic relative-date arithmetic.
 *               Defaults to `new Date()`. Tests should pass a fixed Date.
 *               Production callers (e.g. `useMessageHandler`) pass
 *               `new Date()` — the same source that feeds `currentDate` in
 *               `aiMessageParser.ts`, keeping the agency clock coherent.
 */
export function normalizeSearchIntent(
  parsed: ParsedTravelRequest,
  now: Date = new Date(),
): ParsedTravelRequest {
  // Shallow-clone the top level; sub-objects are cloned only when we touch
  // them. This keeps the function deeply non-mutating without blanket-cloning
  // unrelated branches (placeDiscoveryResult, orchestration, etc.).
  const next: ParsedTravelRequest = { ...parsed };

  // ---------------------------------------------------------------------
  // Step 1 — travelerType → adults
  //
  // Apply only when the parser did NOT mark adults as explicit (the user
  // didn't state a count). 'family' is intentionally skipped here: the parser
  // already maps "familia" → 2A+2C upstream, and overriding here would clobber
  // that. 'group' is also skipped because group sizes vary and the user
  // typically states a count alongside ("grupo de 6 amigos").
  // ---------------------------------------------------------------------
  if (next.travelerType === 'couple' || next.travelerType === 'solo') {
    const targetAdults = next.travelerType === 'couple' ? 2 : 1;

    if (next.flights && !next.flights.adultsExplicit) {
      next.flights = {
        ...next.flights,
        adults: targetAdults,
        adultsExplicit: true,
      };
    }
    if (next.hotels && !next.hotels.adultsExplicit) {
      next.hotels = {
        ...next.hotels,
        adults: targetAdults,
        adultsExplicit: true,
      };
    }
  }

  // ---------------------------------------------------------------------
  // Step 2 — derive roomType from total hotel pax
  //
  // Runs for any request that carries a `hotels` block (hotels-only,
  // combined, or hotels-as-part-of-itinerary). Skipped when the user
  // already specified a roomType (explicit wins). Whenever we set the
  // value, we flag `roomTypeInferred = true` so the client can disclose.
  //
  // NOTE: the room derivation runs AFTER the traveler-type adult adjustment
  // above, so a 'couple' with no explicit adults gets adults=2 first, then
  // 2 pax → 'double' here. This is the spec-aligned ordering.
  // ---------------------------------------------------------------------
  if (next.hotels && !next.hotels.roomType) {
    const derived = deriveRoomTypeFromPax(next.hotels);
    if (derived) {
      next.hotels = {
        ...next.hotels,
        roomType: derived,
        roomTypeInferred: true,
      };
    }
  }

  // ---------------------------------------------------------------------
  // Step 3 — applyPartialStay (Phase 2)
  //
  // Runs BEFORE applyRelativeDates because partial-stay may set
  // tripType='one_way', and the relative-date filler must respect that
  // (no auto round-trip return when partial-stay locked one-way).
  // ---------------------------------------------------------------------
  applyPartialStay(next);

  // ---------------------------------------------------------------------
  // Step 4 — applyRelativeDates (Phase 2)
  //
  // Performs the date arithmetic for `relativeDateHint`. Deterministic
  // against the injected `now` clock. Explicit user dates always win.
  // ---------------------------------------------------------------------
  applyRelativeDates(next, now);

  // ---------------------------------------------------------------------
  // Step 5 — applyDateFallback (Phase 4)
  //
  // Final structural fallback: when neither the user nor any upstream step
  // produced a departureDate / checkinDate, synthesize today+3 (and
  // checkin+7 for checkout). Replaces the legacy
  // `applyDefaultSearchAssumptions` path that lived in `aiMessageParser.ts`
  // and relied on Spanish regex over the raw message. Pure structural
  // operation on the parsed JSON.
  // ---------------------------------------------------------------------
  applyDateFallback(next, now);

  return next;
}
