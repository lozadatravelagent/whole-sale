/**
 * Emilia Search Opener — empathic narrative shown above flight/hotel cards.
 *
 * Implements the "Respuestas esperadas" patterns from the product doc (sección
 * "reglas default"). Composes a final sentence from pure clause builders:
 *
 *   [opener] [intent] [pax] [origin] [dates] [room]. [closing]
 *
 * Multi-product ordered requests produce a two-sentence structure:
 *
 *   [opener] [first product clause]. Después sumo [second product clause].
 *
 * Pure module — no I/O, no React, no Supabase. Receives a `ParsedTravelRequest`
 * already populated by the parser + client-side `searchIntentNormalizer`
 * (which sets the `*Inferred` flags this module reads to pick the right
 * closing copy and date phrasing).
 */

import type { ParsedTravelRequest, UserLanguage, ProductKind } from '@/services/aiMessageParser';
import { getSearchOpenerCopy, type SearchOpenerCopy } from '@/features/chat/i18n/chatResultCopy';
import { SEARCH_START_OFFSET_DAYS, SEARCH_STAY_NIGHTS } from '@/services/searchDefaults';

export interface SearchOpenerOutput {
  text: string;
  /** True when at least one default was applied (drives the closing copy choice). */
  hadAssumptions: boolean;
}

/**
 * Public entry point. Builds the empathic opener text for a parsed travel
 * request. Returns an empty string when the request shape is not searchable
 * (no destination / no flights+hotels payload).
 */
export function buildSearchOpener(
  parsed: ParsedTravelRequest,
  language: UserLanguage = 'es',
): SearchOpenerOutput {
  const copy = getSearchOpenerCopy(language);
  const products = detectProducts(parsed);
  if (products.length === 0) {
    return { text: '', hadAssumptions: false };
  }

  const destination = pickDestination(parsed);
  if (!destination) {
    return { text: '', hadAssumptions: false };
  }

  const ordered = isOrderedMulti(parsed);
  const familyNoAges = detectFamilyNoAges(parsed);
  const hadAssumptions = detectAnyAssumption(parsed);

  // Opener: "Tomo N personas para avanzar." takes precedence for family without ages.
  const opener = familyNoAges
    ? copy.openers.family_no_ages(familyNoAges)
    : copy.openers.standard;

  // Ordered multi-product: "Busco primero X. Después sumo Y."
  if (ordered && products.length >= 2) {
    return buildOrderedSentence(parsed, products, destination, copy, opener, hadAssumptions);
  }

  // Single product or unordered package.
  return buildFlatSentence(parsed, products, destination, copy, opener, hadAssumptions);
}

// ---------------------------------------------------------------------------
// Sentence builders
// ---------------------------------------------------------------------------

function buildFlatSentence(
  parsed: ParsedTravelRequest,
  products: ProductKind[],
  destination: string,
  copy: SearchOpenerCopy,
  opener: string,
  hadAssumptions: boolean,
): SearchOpenerOutput {
  const intent = describeIntent(parsed, products, destination, copy);
  const pax = describePax(parsed, copy);
  const origin = describeOrigin(parsed, copy);
  const dates = describeDates(parsed, copy);
  const room = describeRoom(parsed, copy);

  const clauses = [intent, pax, origin, dates, room].filter(Boolean);
  const body = clauses.join(', ');
  const closing = pickClosing(parsed, copy, hadAssumptions);

  const text = `${opener} ${body}.${closing ? ` ${closing}` : ''}`.trim();
  return { text, hadAssumptions };
}

function buildOrderedSentence(
  parsed: ParsedTravelRequest,
  products: ProductKind[],
  destination: string,
  copy: SearchOpenerCopy,
  opener: string,
  hadAssumptions: boolean,
): SearchOpenerOutput {
  const order = (parsed.productOrder && parsed.productOrder.length >= 2)
    ? parsed.productOrder
    : products;
  const first = order[0];
  const rest = order.slice(1);

  const firstClause = describeFirstOrdered(parsed, first, destination, copy);
  const restClauses = rest.map((p) => describeNextOrdered(parsed, p, copy));

  const text = `${opener} ${firstClause}. ${restClauses.join('. ')}.`.trim();
  return { text, hadAssumptions };
}

function describeFirstOrdered(
  parsed: ParsedTravelRequest,
  product: ProductKind,
  destination: string,
  copy: SearchOpenerCopy,
): string {
  const pax = describePax(parsed, copy);
  const origin = describeOrigin(parsed, copy);
  const dates = describeDates(parsed, copy);

  if (product === 'flight') {
    const base = copy.intent.ordered_first_flight(destination);
    const parts = [base, pax, origin, dates].filter(Boolean);
    return parts.join(', ');
  }
  if (product === 'hotel') {
    const base = copy.intent.ordered_first(copy.intent.hotel_simple, destination);
    const room = describeRoom(parsed, copy);
    const parts = [base, pax, dates, room].filter(Boolean);
    return parts.join(', ');
  }
  // transfer or fallback
  const base = copy.intent.ordered_first(copy.intent.transfer, destination);
  return base;
}

function describeNextOrdered(
  parsed: ParsedTravelRequest,
  product: ProductKind,
  copy: SearchOpenerCopy,
): string {
  const productLabel = labelForProduct(product, parsed, copy);
  // "Después sumo hotel all inclusive para las mismas fechas, en habitación doble."
  if (product === 'hotel') {
    const room = describeRoom(parsed, copy);
    const base = copy.intent.ordered_next_same_dates(productLabel);
    return room ? `${base}, ${room}` : base;
  }
  return copy.intent.ordered_next_same_dates(productLabel);
}

// ---------------------------------------------------------------------------
// Intent clause (non-ordered path)
// ---------------------------------------------------------------------------

function describeIntent(
  parsed: ParsedTravelRequest,
  products: ProductKind[],
  destination: string,
  copy: SearchOpenerCopy,
): string {
  // Packages take priority — there's an explicit `packages` payload or a
  // package intent with transfer+flight+hotel.
  if (parsed.requestType === 'packages' || (products.includes('transfer') && products.includes('flight') && products.includes('hotel'))) {
    const productList = formatProductList(products, copy);
    return productList
      ? copy.intent.package_with_products(destination, productList)
      : copy.intent.package(destination);
  }

  // Combined: flight + hotel without explicit ordering.
  if (parsed.requestType === 'combined' || (products.includes('flight') && products.includes('hotel'))) {
    return copy.intent.combined(destination);
  }

  // Hotel only.
  if (parsed.requestType === 'hotels' || (products.length === 1 && products[0] === 'hotel')) {
    return copy.intent.hotel(destination);
  }

  // Flight only — pick one_way vs round_trip.
  if (parsed.requestType === 'flights' || (products.length === 1 && products[0] === 'flight')) {
    const tripType = parsed.flights?.tripType;
    if (tripType === 'round_trip' || tripType === 'multi_city' || parsed.flights?.returnDate) {
      return copy.intent.flight_round_trip(destination);
    }
    return copy.intent.flight_one_way(destination);
  }

  // Fallback — combined-style.
  return copy.intent.combined(destination);
}

function formatProductList(products: ProductKind[], copy: SearchOpenerCopy): string {
  const labels = products.map((p) => {
    if (p === 'flight') return copy.intent.flight;
    if (p === 'hotel') return copy.intent.hotel_simple;
    return copy.intent.transfer;
  });
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  const head = labels.slice(0, -1).join(copy.intent.productListJoin);
  return `${head} ${copy.intent.and} ${labels[labels.length - 1]}`;
}

function labelForProduct(product: ProductKind, parsed: ParsedTravelRequest, copy: SearchOpenerCopy): string {
  if (product === 'flight') return copy.intent.flight;
  if (product === 'transfer') return copy.intent.transfer;
  // Hotel — include meal plan if present (e.g., "hotel all inclusive").
  const mealPlan = parsed.hotels?.mealPlan;
  if (mealPlan === 'all_inclusive') return `${copy.intent.hotel_simple} all inclusive`;
  return copy.intent.hotel_simple;
}

// ---------------------------------------------------------------------------
// Pax clause
// ---------------------------------------------------------------------------

function describePax(parsed: ParsedTravelRequest, copy: SearchOpenerCopy): string {
  const adults = pickAdults(parsed);
  const children = pickChildren(parsed);
  const infants = pickInfants(parsed);
  if (!adults && !children && !infants) return '';

  // Family without ages → "para N personas" (don't break out adults/children).
  if (detectFamilyNoAges(parsed)) {
    const total = (adults ?? 0) + (children ?? 0) + (infants ?? 0);
    return copy.pax.forPeople(total);
  }

  let base = copy.pax.forAdults(adults ?? 1);
  if (children && children > 0) base += ` ${copy.pax.withChildren(children)}`;
  if (infants && infants > 0) base += ` ${copy.pax.withInfants(infants)}`;
  return base;
}

function pickAdults(p: ParsedTravelRequest): number | undefined {
  return p.flights?.adults ?? p.hotels?.adults ?? p.packages?.adults ?? p.itinerary?.travelers?.adults;
}

function pickChildren(p: ParsedTravelRequest): number | undefined {
  return p.flights?.children ?? p.hotels?.children ?? p.packages?.children ?? p.itinerary?.travelers?.children;
}

function pickInfants(p: ParsedTravelRequest): number | undefined {
  return p.flights?.infants ?? p.hotels?.infants ?? p.itinerary?.travelers?.infants;
}

// ---------------------------------------------------------------------------
// Origin clause
// ---------------------------------------------------------------------------

function describeOrigin(parsed: ParsedTravelRequest, copy: SearchOpenerCopy): string {
  // Origin only matters if there's a flight in the request.
  if (!parsed.flights?.origin) return '';
  const origin = parsed.flights.origin.trim();
  if (!origin) return '';
  return copy.origin.fromCity(origin);
}

// ---------------------------------------------------------------------------
// Dates clause — dispatches on relativeDateHint, partial-stay, and ISO dates.
// ---------------------------------------------------------------------------

function describeDates(parsed: ParsedTravelRequest, copy: SearchOpenerCopy): string {
  // Relative date hints take precedence — they map to fixed phrasing per doc §3.
  if (parsed.relativeDateHint === 'tomorrow') {
    return needsRoundTrip(parsed) ? copy.dates.tomorrowFor7 : copy.dates.tomorrow;
  }
  if (parsed.relativeDateHint === 'this_weekend') {
    return copy.dates.weekendFriToSun;
  }
  if (parsed.relativeDateHint === 'next_week') {
    return copy.dates.nextWeekMonToMon;
  }
  if (parsed.relativeDateHint === 'next_month') {
    return copy.dates.nextMonthFirstWeek;
  }

  // Pull resolved dates from the most-populated payload.
  const dateInfo = pickDates(parsed);
  if (!dateInfo) return '';

  const { startISO, endISO, startInferred, endInferred } = dateInfo;
  if (!startISO) return '';

  // Both inferred via today+N fallback → "desde dentro de 3 días por 7 noches".
  if (startInferred && (endISO ? endInferred : true) && isStructuralFallback(startISO, endISO)) {
    if (endISO) return copy.dates.tentativeIn3For7Nights;
    return copy.dates.tentativeIn3;
  }

  // Start is day 1 of a month, end is day 8 → "del 1 al 8 de {mes}".
  if (isFirstWeekOfMonth(startISO, endISO)) {
    const month = monthName(startISO, copy);
    if (month) return copy.dates.monthFirstWeek(month);
  }

  // Start is day 1 of a month, no end → "con salida tentativa el 1 de {mes}".
  if (!endISO && isFirstOfMonth(startISO)) {
    const month = monthName(startISO, copy);
    if (month) return copy.dates.monthFirstDay(month);
  }

  // Custom nights starting on a specific day.
  if (startISO && endISO) {
    const start = formatDayMonth(startISO, copy);
    const end = formatDayMonth(endISO, copy);
    return copy.dates.range(start, end);
  }

  // Single date only (one-way flight with explicit date).
  return copy.dates.nightsFrom(formatDayMonth(startISO, copy), 1).replace(/ por 1 noche| for 1 night| por 1 noite/, '');
}

interface DateInfo {
  startISO?: string;
  endISO?: string;
  startInferred: boolean;
  endInferred: boolean;
}

function pickDates(parsed: ParsedTravelRequest): DateInfo | null {
  // Prefer flights dates when present (one-way or round-trip).
  if (parsed.flights?.departureDate) {
    return {
      startISO: parsed.flights.departureDate,
      endISO: parsed.flights.returnDate,
      startInferred: Boolean(parsed.flights.departureDateInferred),
      endInferred: Boolean(parsed.flights.returnDateInferred),
    };
  }
  if (parsed.hotels?.checkinDate) {
    return {
      startISO: parsed.hotels.checkinDate,
      endISO: parsed.hotels.checkoutDate,
      startInferred: Boolean(parsed.hotels.checkinDateInferred),
      endInferred: Boolean(parsed.hotels.checkoutDateInferred),
    };
  }
  if (parsed.packages?.dateFrom) {
    return {
      startISO: parsed.packages.dateFrom,
      endISO: parsed.packages.dateTo,
      startInferred: false,
      endInferred: false,
    };
  }
  return null;
}

function isStructuralFallback(startISO?: string, endISO?: string): boolean {
  if (!startISO) return false;
  try {
    const start = new Date(`${startISO}T00:00:00`);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.round((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays !== SEARCH_START_OFFSET_DAYS) return false;
    if (!endISO) return true;
    const end = new Date(`${endISO}T00:00:00`);
    const stayDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return stayDays === SEARCH_STAY_NIGHTS;
  } catch {
    return false;
  }
}

function isFirstOfMonth(iso: string): boolean {
  try {
    return new Date(`${iso}T00:00:00`).getDate() === 1;
  } catch {
    return false;
  }
}

function isFirstWeekOfMonth(startISO: string, endISO?: string): boolean {
  if (!endISO) return false;
  try {
    const s = new Date(`${startISO}T00:00:00`);
    const e = new Date(`${endISO}T00:00:00`);
    return s.getDate() === 1 && e.getDate() === 8 && s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  } catch {
    return false;
  }
}

function monthName(iso: string, copy: SearchOpenerCopy): string | null {
  try {
    const d = new Date(`${iso}T00:00:00`);
    return copy.months[d.getMonth()] ?? null;
  } catch {
    return null;
  }
}

function formatDayMonth(iso: string, copy: SearchOpenerCopy): string {
  try {
    const d = new Date(`${iso}T00:00:00`);
    const day = d.getDate();
    const month = copy.months[d.getMonth()];
    if (!month) return iso;
    if (copy.monthDayJoin) return `${day} ${copy.monthDayJoin} ${month}`;
    return `${month} ${day}`;
  } catch {
    return iso;
  }
}

function needsRoundTrip(parsed: ParsedTravelRequest): boolean {
  return (
    Boolean(parsed.hotels) ||
    Boolean(parsed.flights?.returnDate) ||
    parsed.flights?.tripType === 'round_trip' ||
    parsed.flights?.tripType === 'multi_city' ||
    parsed.requestType === 'combined' ||
    parsed.requestType === 'packages'
  );
}

// ---------------------------------------------------------------------------
// Room clause
// ---------------------------------------------------------------------------

function describeRoom(parsed: ParsedTravelRequest, copy: SearchOpenerCopy): string {
  if (!parsed.hotels) return '';
  const explicit = parsed.hotels.roomType;
  if (explicit) {
    switch (explicit) {
      case 'single': return copy.room.single;
      case 'double': return copy.room.double;
      case 'triple': return copy.room.triple;
      case 'quadruple': return copy.room.quadruple;
    }
  }
  // Derived by pax (table 6.2 of the doc).
  const adults = parsed.hotels.adults ?? 1;
  const children = parsed.hotels.children ?? 0;
  const total = adults + children;
  if (total <= 1) return copy.room.single;
  if (total === 2) return copy.room.double;
  if (total === 3) return copy.room.triple;
  if (total === 4) return copy.room.quadruple;
  return copy.room.twoDoubles;
}

// ---------------------------------------------------------------------------
// Closing — picks the empathic close based on which defaults were applied.
// ---------------------------------------------------------------------------

function pickClosing(
  parsed: ParsedTravelRequest,
  copy: SearchOpenerCopy,
  hadAssumptions: boolean,
): string {
  // Family without ages → "Si tus hijos son menores, pasame edades..."
  if (detectFamilyNoAges(parsed)) {
    return copy.closings.kidsAges;
  }

  // One-way assumed (flight without return) → offer round-trip.
  const isOneWay = parsed.flights && !parsed.flights.returnDate && parsed.flights.tripType !== 'multi_city'
    && (!parsed.flights.tripType || Boolean(parsed.flights.tripTypeInferred));
  if (isOneWay && !parsed.hotels && !parsed.packages) {
    return copy.closings.makeRoundTrip;
  }

  // Pax was defaulted (1 adult, no explicit), and hotel room was also derived.
  const paxInferred = isPaxInferred(parsed);
  const hasHotel = Boolean(parsed.hotels);
  if (paxInferred && hasHotel) {
    return copy.closings.adjustPaxOrRoom;
  }

  // Origin + date both inferred → mention both.
  const datesInferred = isDateInferred(parsed);
  const originInferred = isOriginInferred(parsed);
  if (datesInferred && originInferred) {
    return copy.closings.adjustOriginOrDate;
  }
  if (datesInferred && paxInferred) {
    return copy.closings.adjustDateOrPax;
  }

  // Any single default → "Si querés otra fecha, lo ajusto."
  if (hadAssumptions) {
    return copy.closings.adjustDate;
  }

  // No defaults → no closing (user provided everything).
  return '';
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

function detectProducts(parsed: ParsedTravelRequest): ProductKind[] {
  if (parsed.productOrder && parsed.productOrder.length > 0) {
    return [...parsed.productOrder];
  }
  const products: ProductKind[] = [];
  if (parsed.flights) products.push('flight');
  if (parsed.hotels) products.push('hotel');
  if (parsed.transfers?.included) products.push('transfer');
  return products;
}

function pickDestination(parsed: ParsedTravelRequest): string | null {
  return (
    parsed.flights?.destination ||
    parsed.hotels?.city ||
    parsed.packages?.destination ||
    parsed.itinerary?.destinations?.[0] ||
    null
  );
}

function isOrderedMulti(parsed: ParsedTravelRequest): boolean {
  return Boolean(parsed.productOrder && parsed.productOrder.length >= 2);
}

function detectFamilyNoAges(parsed: ParsedTravelRequest): number | null {
  if (parsed.travelerType !== 'family') return null;
  const adults = pickAdults(parsed) ?? 0;
  const children = pickChildren(parsed) ?? 0;
  const total = adults + children;
  if (total < 3) return null;
  // Children present but no ages → ambiguous family.
  const ages = parsed.hotels?.childrenAges ?? [];
  if (children > 0 && ages.length === 0) return total;
  return null;
}

function isPaxInferred(parsed: ParsedTravelRequest): boolean {
  if (parsed.flights && !parsed.flights.adultsExplicit && parsed.flights.adults === 1) return true;
  if (parsed.hotels && !parsed.hotels.adultsExplicit && parsed.hotels.adults === 1) return true;
  return false;
}

function isDateInferred(parsed: ParsedTravelRequest): boolean {
  if (parsed.flights?.departureDateInferred || parsed.flights?.returnDateInferred) return true;
  if (parsed.hotels?.checkinDateInferred || parsed.hotels?.checkoutDateInferred) return true;
  if (parsed.relativeDateHint) return true;
  return false;
}

function isOriginInferred(_parsed: ParsedTravelRequest): boolean {
  // Today the parser does not flag origin source. If a future parser change
  // adds `originSource: 'geolocation' | 'explicit'`, plumb it here.
  return false;
}

function detectAnyAssumption(parsed: ParsedTravelRequest): boolean {
  if (isPaxInferred(parsed)) return true;
  if (isDateInferred(parsed)) return true;
  if (parsed.flights?.tripTypeInferred) return true;
  if (parsed.hotels?.roomTypeInferred) return true;
  if (parsed.hotels?.checkinDateInferred || parsed.hotels?.checkoutDateInferred) return true;
  return false;
}
