import type { ChatSuggestedAction } from '@/features/chat/types/chat';
import type { FlightContextParams, HotelContextParams } from '@/features/chat/types/contextState';
import { SEARCH_STAY_NIGHTS } from '@/services/searchDefaults';

/**
 * Minimal slice of the parsed last search this builder reads. Matches the
 * relevant fields of ParsedTravelRequest / ContextState.lastSearch.
 */
export interface RefinementSource {
  flights?: Partial<FlightContextParams> | null;
  hotels?: Partial<HotelContextParams> | null;
}

/** Add `days` to an ISO yyyy-mm-dd string, returning yyyy-mm-dd (UTC-safe). */
function addDaysToIso(iso: string, days: number): string | null {
  const ms = Date.parse(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole nights between two ISO yyyy-mm-dd dates; null if unparseable. */
function nightsBetween(startIso: string, endIso: string): number | null {
  const a = Date.parse(`${startIso}T00:00:00.000Z`);
  const b = Date.parse(`${endIso}T00:00:00.000Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const n = Math.round((b - a) / 86_400_000);
  return n > 0 ? n : null;
}

function paxPhrase(adults?: number, children?: number, infants?: number): string {
  const a = Math.max(0, adults ?? 0);
  const c = Math.max(0, children ?? 0);
  const i = Math.max(0, infants ?? 0);
  const parts = [`${a} ${a === 1 ? 'adulto' : 'adultos'}`];
  if (c > 0) parts.push(`${c} ${c === 1 ? 'niño' : 'niños'}`);
  if (i > 0) parts.push(`${i} ${i === 1 ? 'bebé' : 'bebés'}`);
  return parts.join(', ');
}

function productPassengers(
  source: Partial<FlightContextParams> | Partial<HotelContextParams>,
) {
  return {
    adults: Math.max(1, source.adults ?? 1),
    children: Math.max(0, source.children ?? 0),
    infants: Math.max(0, source.infants ?? 0),
  };
}

function flightPrompt(f: Partial<FlightContextParams>, returnDate?: string): string {
  const pax = productPassengers(f);
  const base = returnDate
    ? `vuelo a ${f.destination} del ${f.departureDate} al ${returnDate}`
    : `vuelo a ${f.destination} el ${f.departureDate}`;
  const origin = f.origin ? ` saliendo desde ${f.origin}` : '';
  return `${base}${origin} para ${paxPhrase(pax.adults, pax.children, pax.infants)}`;
}

function hotelPrompt(h: Partial<HotelContextParams>): string {
  const pax = productPassengers(h);
  return `hotel en ${h.city} del ${h.checkinDate} al ${h.checkoutDate} para ${paxPhrase(pax.adults, pax.children, pax.infants)}`;
}

function combinedPrompt(f: Partial<FlightContextParams>, h: Partial<HotelContextParams>): string {
  const pax = productPassengers(f.adults != null ? f : h);
  const destination = h.city || f.destination;
  const start = h.checkinDate || f.departureDate;
  const end = h.checkoutDate || f.returnDate;
  const origin = f.origin ? ` saliendo desde ${f.origin}` : '';
  return `vuelo y hotel a ${destination} del ${start} al ${end}${origin} para ${paxPhrase(pax.adults, pax.children, pax.infants)}`;
}

/**
 * Derive post-search "refinement" chips from the parsed last search.
 * Pure and defensive: missing data => that chip is omitted; no search => [].
 * Never throws. The inserted text uses SEARCH_STAY_NIGHTS for the inferred
 * return date so it matches the rest of the search-defaults architecture.
 */
// _now reserved for future "relative to today" chips (e.g., "search sooner"); not consumed yet. _language reserved for future i18n; copy is Spanish by product scope.
export function buildRefinementChips(
  source: RefinementSource,
  _now: Date,
  _language: string,
): ChatSuggestedAction[] {
  const chips: ChatSuggestedAction[] = [];
  const f = source.flights ?? null;
  const h = source.hotels ?? null;

  const hasFlightSearch =
    !!f && !!f.origin && !!f.destination && !!f.departureDate;
  const hasHotelSearch =
    !!h && !!h.city && !!h.checkinDate && !!h.checkoutDate;

  if (!hasFlightSearch && !hasHotelSearch) return [];

  // 1. Ida y Vuelta — only when the flight search is explicitly one-way.
  // Priorities 1/4/5/6 — gaps (2,3) reserved for future refinement chips (e.g., cabin class, destination change).
  // Only when the flight is EXPLICITLY one-way. tripType undefined or 'multi_city' => suppressed (we don't infer one-way from a missing returnDate).
  if (hasFlightSearch && f!.tripType === 'one_way') {
    const ret = addDaysToIso(f!.departureDate as string, SEARCH_STAY_NIGHTS);
    if (ret) {
      const prompt = flightPrompt(f!, ret);
      chips.push({
        id: 'refine-roundtrip',
        label: 'Ida y vuelta',
        prompt,
        type: 'refine',
        priority: 1,
        behavior: 'autocomplete',
        intent: 'convert_to_round_trip',
        template: 'vuelo a {destination} del {departureDate} al {returnDate} saliendo desde {origin} para {passengers}',
        context: {
          product: 'flight',
          origin: f!.origin,
          destination: f!.destination,
          departureDate: f!.departureDate,
          returnDate: ret,
          passengers: productPassengers(f!),
        },
        editableFields: ['departureDate', 'returnDate', 'passengers'],
        expectedRequestType: 'flights',
        expectedProducts: ['flight'],
        reasonCodes: ['autocomplete_chip_generated'],
      });
    }
  }

  const destination = hasFlightSearch ? f!.destination! : h!.city!;

  // 2. Modificar pasajeros.
  const adults = hasFlightSearch ? f!.adults : h!.adults;
  const children = hasFlightSearch ? f!.children : h!.children;
  const infants = hasFlightSearch ? f!.infants : h!.infants;
  chips.push({
    id: 'refine-passengers',
    label: 'Modificar pasajeros',
    prompt: hasFlightSearch && hasHotelSearch
      ? combinedPrompt(f!, h!)
      : hasFlightSearch
        ? flightPrompt(f!, f!.returnDate)
        : hotelPrompt(h!),
    type: 'refine',
    priority: 4,
    behavior: 'autocomplete',
    intent: 'change_passengers',
    template: hasFlightSearch && hasHotelSearch
      ? 'vuelo y hotel a {destination} del {departureDate} al {returnDate} saliendo desde {origin} para {passengers}'
      : hasFlightSearch
        ? 'vuelo a {destination} del {departureDate} al {returnDate} saliendo desde {origin} para {passengers}'
        : 'hotel en {destination} del {checkinDate} al {checkoutDate} para {passengers}',
    context: {
      product: hasFlightSearch && hasHotelSearch ? 'combined' : hasFlightSearch ? 'flight' : 'hotel',
      origin: f?.origin,
      destination,
      departureDate: f?.departureDate,
      returnDate: f?.returnDate,
      checkinDate: h?.checkinDate,
      checkoutDate: h?.checkoutDate,
      passengers: { adults, children, infants },
    },
    editableFields: ['passengers'],
    expectedRequestType: hasFlightSearch && hasHotelSearch ? 'combined' : hasFlightSearch ? 'flights' : 'hotels',
    expectedProducts: hasFlightSearch && hasHotelSearch ? ['flight', 'hotel'] : hasFlightSearch ? ['flight'] : ['hotel'],
    reasonCodes: ['autocomplete_chip_generated'],
  });

  // 3. Agregar / quitar días.
  const startIso = hasFlightSearch ? f!.departureDate : h!.checkinDate;
  const endIso = hasFlightSearch ? f!.returnDate : h!.checkoutDate;
  const nights = startIso && endIso ? nightsBetween(startIso, endIso) : null;
  chips.push({
    id: 'refine-duration',
    label: 'Agregar o quitar días',
    prompt: hasFlightSearch && hasHotelSearch
      ? combinedPrompt(f!, h!)
      : hasFlightSearch
        ? flightPrompt(f!, f!.returnDate)
        : hotelPrompt(h!),
    type: 'refine',
    priority: 5,
    behavior: 'autocomplete',
    intent: 'change_duration',
    template: hasFlightSearch && hasHotelSearch
      ? 'vuelo y hotel a {destination} del {departureDate} al {returnDate} saliendo desde {origin} para {passengers}'
      : hasFlightSearch
        ? 'vuelo a {destination} del {departureDate} al {returnDate} saliendo desde {origin} para {passengers}'
        : 'hotel en {destination} del {checkinDate} al {checkoutDate} para {passengers}',
    context: {
      product: hasFlightSearch && hasHotelSearch ? 'combined' : hasFlightSearch ? 'flight' : 'hotel',
      origin: f?.origin,
      destination,
      departureDate: f?.departureDate,
      returnDate: f?.returnDate,
      checkinDate: h?.checkinDate,
      checkoutDate: h?.checkoutDate,
      passengers: productPassengers(hasFlightSearch ? f! : h!),
    },
    editableFields: ['departureDate', 'returnDate', 'checkinDate', 'checkoutDate'],
    expectedRequestType: hasFlightSearch && hasHotelSearch ? 'combined' : hasFlightSearch ? 'flights' : 'hotels',
    expectedProducts: hasFlightSearch && hasHotelSearch ? ['flight', 'hotel'] : hasFlightSearch ? ['flight'] : ['hotel'],
    reasonCodes: [
      'autocomplete_chip_generated',
      ...(nights != null ? [`current_duration_${nights}_nights`] : []),
    ],
  });

  // 4. Modificar la búsqueda (genérico).
  chips.push({
    id: 'refine-search',
    label: 'Modificar la búsqueda',
    prompt: hasFlightSearch && hasHotelSearch
      ? combinedPrompt(f!, h!)
      : hasFlightSearch
        ? flightPrompt(f!, f!.returnDate)
        : hotelPrompt(h!),
    type: 'refine',
    priority: 6,
    behavior: 'autocomplete',
    intent: 'modify_search',
    template: hasFlightSearch && hasHotelSearch
      ? 'vuelo y hotel a {destination} del {departureDate} al {returnDate} saliendo desde {origin} para {passengers}'
      : hasFlightSearch
        ? 'vuelo a {destination} del {departureDate} al {returnDate} saliendo desde {origin} para {passengers}'
        : 'hotel en {destination} del {checkinDate} al {checkoutDate} para {passengers}',
    context: {
      product: hasFlightSearch && hasHotelSearch ? 'combined' : hasFlightSearch ? 'flight' : 'hotel',
      origin: f?.origin,
      destination,
      departureDate: f?.departureDate,
      returnDate: f?.returnDate,
      checkinDate: h?.checkinDate,
      checkoutDate: h?.checkoutDate,
      passengers: productPassengers(hasFlightSearch ? f! : h!),
    },
    editableFields: ['destination', 'origin', 'departureDate', 'returnDate', 'checkinDate', 'checkoutDate', 'passengers'],
    expectedRequestType: hasFlightSearch && hasHotelSearch ? 'combined' : hasFlightSearch ? 'flights' : 'hotels',
    expectedProducts: hasFlightSearch && hasHotelSearch ? ['flight', 'hotel'] : hasFlightSearch ? ['flight'] : ['hotel'],
    reasonCodes: ['autocomplete_chip_generated'],
  });

  return chips;
}
