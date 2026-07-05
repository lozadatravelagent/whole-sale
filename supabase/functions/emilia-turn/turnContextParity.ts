import { normalizeFlightRequest } from '../_shared/flightSegments.ts';
import type { ParsedRequest } from '../_shared/contextManagement.ts';

export interface ContextState {
  lastSearch: {
    requestType: 'flights' | 'hotels' | 'combined';
    timestamp: string;
    flightsParams?: Record<string, unknown>;
    hotelsParams?: Record<string, unknown>;
    resultsSummary?: {
      flightsCount: number;
      hotelsCount: number;
      cheapestFlightPrice?: number;
      cheapestHotelPrice?: number;
      currency?: string;
    };
  };
  constraintsHistory: Array<Record<string, unknown>>;
  turnNumber: number;
  schemaVersion: number;
}

export interface IterationContext {
  isIteration: boolean;
  iterationType:
    | 'hotel_modification'
    | 'flight_modification'
    | 'filter_change'
    | 'full_reuse'
    | 'stay_duration_modification'
    | 'destination_swap'
    | 'new_search';
  baseRequestType: 'flights' | 'hotels' | 'combined' | null;
  modifiedComponent: 'flights' | 'hotels' | 'both' | null;
  preserveFields: string[];
  confidence: number;
  matchedPattern?: string;
  flightModification?: {
    stops?: 'direct' | 'with_stops' | 'one_stop' | 'two_stops';
    luggage?: 'backpack' | 'carry_on' | 'checked';
    airline?: string;
    tripType?: 'one_way' | 'round_trip' | 'multi_city';
    returnDate?: string;
    departureTimePreference?: string;
    arrivalTimePreference?: string;
    maxLayoverHours?: number;
    adults?: number;
    children?: number;
    infants?: number;
    cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
  };
  stayModification?: {
    nights: number;
  };
  destinationSwap?: {
    newDestination: string;
  };
}

export interface ApiQuoteTurnContextResolution {
  parsedRequest: ParsedRequest;
  iterationContext: IterationContext;
  appliedSlots: Record<string, unknown>;
}

const EMPTY_ITERATION: IterationContext = {
  isIteration: false,
  iterationType: 'new_search',
  baseRequestType: null,
  modifiedComponent: null,
  preserveFields: [],
  confidence: 1,
};

function requestTypeOf(parsed: ParsedRequest): ParsedRequest['type'] {
  return (parsed.type || (parsed as Record<string, unknown>).requestType || 'general') as ParsedRequest['type'];
}

function withRequestType(parsed: ParsedRequest, type: ParsedRequest['type']): ParsedRequest {
  return { ...parsed, type, requestType: type } as ParsedRequest;
}

function normalizedText(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isSearchRequestType(value?: string): value is 'flights' | 'hotels' | 'combined' {
  return value === 'flights' || value === 'hotels' || value === 'combined';
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function hasUsableString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function addDaysIso(date: string, days: number): string | undefined {
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) return undefined;
  parsedDate.setUTCDate(parsedDate.getUTCDate() + days);
  return parsedDate.toISOString().slice(0, 10);
}

function mergeDefined<T extends Record<string, unknown>>(base: T | undefined | null, overlay: T | undefined | null): T | undefined {
  if (!base && !overlay) return undefined;
  const out: Record<string, unknown> = { ...(base || {}) };
  for (const [key, value] of Object.entries(overlay || {})) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out as T;
}

function explicitlyNewIndependent(parsed: ParsedRequest): boolean {
  const iteration = (parsed as Record<string, unknown>).iterationIntent as Record<string, unknown> | undefined;
  const continuity = (parsed as Record<string, unknown>).turnContinuity as Record<string, unknown> | undefined;
  return iteration?.type === 'unrelated' || continuity?.relation === 'new_independent_request';
}

function getFirstDestination(parsed: ParsedRequest): string | undefined {
  const itineraryDestinations = parsed.itinerary?.destinations;
  const searchSeeds = (parsed as Record<string, unknown>).searchSeeds as Record<string, unknown> | undefined;
  return parsed.flights?.destination ||
    parsed.hotels?.city ||
    (Array.isArray(itineraryDestinations) ? itineraryDestinations.find((value) => typeof value === 'string' && value.trim()) : undefined) ||
    (typeof searchSeeds?.destination === 'string' ? searchSeeds.destination : undefined);
}

function destinationsDiffer(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return normalizedText(a).trim() !== normalizedText(b).trim();
}

function extractDurationDays(message: string): number | null {
  const normalized = normalizedText(message);
  const numeric = /\b(\d{1,2})\s*(dias|días|noches|nights|days)\b/i.exec(normalized);
  if (numeric) return Math.max(1, Number(numeric[1]));
  if (/\b(una|un)\s+semana\b/i.test(normalized)) return 7;
  if (/\bdos\s+semanas\b/i.test(normalized)) return 14;
  if (/\bquincena\b/i.test(normalized)) return 15;
  return null;
}

function extractPassengerModification(message: string): IterationContext['flightModification'] | null {
  const normalized = normalizedText(message);
  const people = /\b(?:somos|para|viajan|viajamos)\s+(\d{1,2})\s*(?:personas|pax|pasajeros?)?\b/i.exec(normalized);
  if (people) return { adults: Math.max(1, Number(people[1])) };

  const adults = /\b(?:con|para|agrega(?:r)?|sum(?:a|ar)?)\s+(\d{1,2})\s*adultos?\b/i.exec(normalized) ||
    /\b(\d{1,2})\s*adultos?\b/i.exec(normalized);
  if (adults) return { adults: Math.max(1, Number(adults[1])) };
  return null;
}

function extractFlightModification(message: string): IterationContext['flightModification'] | null {
  const normalized = normalizedText(message);
  const modification: NonNullable<IterationContext['flightModification']> = {};

  if (/\b(sin\s+escalas|directo|directos|nonstop)\b/i.test(normalized)) modification.stops = 'direct';
  else if (/\b(con\s+escalas?|escalas?)\b/i.test(normalized)) modification.stops = 'with_stops';
  else if (/\buna\s+escala\b/i.test(normalized)) modification.stops = 'one_stop';
  else if (/\bdos\s+escalas\b/i.test(normalized)) modification.stops = 'two_stops';

  if (/\b(solo\s+ida|one\s+way)\b/i.test(normalized)) modification.tripType = 'one_way';
  if (/\b(ida\s+y\s+vuelta|round\s+trip)\b/i.test(normalized)) modification.tripType = 'round_trip';

  if (/\b(equipaje\s+de\s+mano|carry\s*on)\b/i.test(normalized)) modification.luggage = 'carry_on';
  if (/\b(equipaje\s+(facturado|despachado)|valija|checked)\b/i.test(normalized)) modification.luggage = 'checked';
  if (/\b(mochila|backpack)\b/i.test(normalized)) modification.luggage = 'backpack';

  const maxLayover = /\b(?:max(?:imo)?|hasta)\s+(\d{1,2})\s*h(?:oras?)?\s+(?:de\s+)?escala/i.exec(normalized);
  if (maxLayover) modification.maxLayoverHours = Number(maxLayover[1]);

  const passenger = extractPassengerModification(message);
  if (passenger) Object.assign(modification, passenger);

  return Object.keys(modification).length > 0 ? modification : null;
}

function extractDestinationSwap(message: string): string | null {
  const normalized = normalizedText(message);
  const patterns = [
    /\ben\s+vez\s+de\s+[^,]+,\s*([a-z\s]+)$/i,
    /\bcambia(?:r)?\s+[^,]+?\s+por\s+([a-z\s]+)$/i,
    /\bcambia(?:r)?\s+destino\s+a\s+([a-z\s]+)$/i,
    /\bmejor\s+([a-z\s]+)$/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(normalized);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function hasHotelIntent(message: string, parsedRequest?: ParsedRequest): boolean {
  return /\b(hotel|hoteles|alojamiento|hospedaje|resort)\b/i.test(normalizedText(message)) || Boolean(parsedRequest?.hotels);
}

function hasFlightIntent(message: string, parsedRequest?: ParsedRequest): boolean {
  return /\b(vuelo|vuelos|aereo|pasaje|flight|flights)\b/i.test(normalizedText(message)) || Boolean(parsedRequest?.flights);
}

function asksHotelOnly(message: string): boolean {
  return /\b(solo|only|unicamente|únicamente)\s+(hotel|hoteles|alojamiento|hospedaje)\b/i.test(normalizedText(message));
}

function canonicalSlotName(field: string): string {
  const normalized = field
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalized.includes('origin')) return 'origin';
  if (normalized.includes('destino') || normalized.includes('destination') || normalized.includes('city')) return 'destination';
  if (normalized.includes('fecha') || normalized.includes('date')) return 'dates';
  if (normalized.includes('passenger') || normalized.includes('adult') || normalized.includes('traveler') || normalized.includes('pasaj')) return 'passengers';
  if (normalized.includes('dias') || normalized.includes('duration')) return 'duration';
  return normalized.replace(/\s+/g, '_');
}

function firstDefinedString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function firstDefinedNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

function firstSlotString(slots: Record<string, unknown> | null | undefined, keys: string[]): string | undefined {
  if (!slots) return undefined;
  for (const key of keys) {
    const value = slots[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function firstSlotNumber(slots: Record<string, unknown> | null | undefined, keys: string[]): number | undefined {
  if (!slots) return undefined;
  for (const key of keys) {
    const parsed = Number(slots[key]);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

function extractRouteFromMessage(message: string): { origin?: string; destination?: string } {
  const patterns = [
    /\bdesde\s+(.+?)\s+(?:a|hacia|hasta|para)\s+(.+?)(?:\s+(?:del|desde|para|por|con|en)\b|$)/i,
    /\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s+(?:from|for|with|on|in)\b|$)/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(message);
    if (match?.[1] && match?.[2]) {
      return {
        origin: match[1].trim(),
        destination: match[2].trim(),
      };
    }
  }
  return {};
}

function shortSlotAnswer(message: string): string | undefined {
  const text = message.trim();
  if (!text || text.length > 80) return undefined;
  if (/[?¿!¡]/.test(text)) return undefined;
  if (/\b(cotiz|busc|arma|plan|hotel|vuelo|viaje|cambia|quiero|necesito)\b/i.test(normalizedText(text))) return undefined;
  return text;
}

export function derivePendingAnswerSlots(
  pendingAction: Record<string, unknown> | null | undefined,
  message: string,
  parsedRequest: ParsedRequest,
): Record<string, unknown> {
  const fields = Array.isArray(pendingAction?.fields)
    ? [...new Set((pendingAction.fields as unknown[]).map((field) => canonicalSlotName(String(field))))]
    : [];
  if (fields.length === 0) return {};

  const answer = shortSlotAnswer(message);
  if (!answer) return {};

  const currentOrigin = parsedRequest.flights?.origin;
  const currentDestination = getFirstDestination(parsedRequest);
  const slots: Record<string, unknown> = {};

  if (fields.includes('origin') && !hasUsableString(currentOrigin) && hasUsableString(currentDestination)) {
    slots.origin = answer;
  } else if (fields.includes('destination') && !hasUsableString(currentDestination)) {
    slots.destination = answer;
  }

  if (fields.includes('passengers')) {
    const pax = /^(\d{1,2})\s*(?:personas|pax|pasajeros?|adultos?)?$/i.exec(answer);
    if (pax) slots.adults = Math.max(1, Number(pax[1]));
  }

  return slots;
}

export function normalizeApiQuoteRequest(parsed: ParsedRequest): ParsedRequest {
  const next = { ...parsed } as ParsedRequest;
  if (next.flights) {
    const normalizedFlight = normalizeFlightRequest(next.flights);
    const origin = firstDefinedString(normalizedFlight?.origin, next.flights.origin);
    const destination = firstDefinedString(normalizedFlight?.destination, next.flights.destination);
    const departureDate = firstDefinedString(normalizedFlight?.departureDate, next.flights.departureDate);
    const returnDate = firstDefinedString(normalizedFlight?.returnDate, next.flights.returnDate);
    const tripType = firstDefinedString(normalizedFlight?.tripType, next.flights.tripType);
    const shouldBuildRoundTrip =
      tripType === 'round_trip' &&
      origin &&
      destination &&
      departureDate &&
      returnDate;

    next.flights = {
      ...normalizedFlight,
      ...(shouldBuildRoundTrip
        ? {
            origin,
            destination,
            departureDate,
            returnDate,
            tripType: 'round_trip',
            segments: [
              { origin, destination, departureDate },
              { origin: destination, destination: origin, departureDate: returnDate },
            ],
          }
        : {}),
    };
  }

  return inferCrossProductSlots(next);
}

export function applyResolvedSlotsToQuoteRequest(parsed: ParsedRequest, slots?: Record<string, unknown> | null): ParsedRequest {
  if (!slots || Object.keys(slots).length === 0) return normalizeApiQuoteRequest(parsed);

  const next = { ...parsed } as ParsedRequest;
  const origin = firstSlotString(slots, ['origin', 'from', 'departureCity', 'segment_1_origin']);
  const destination = firstSlotString(slots, ['destination', 'to', 'city', 'hotelCity', 'segment_1_destination']);
  const departureDate = firstSlotString(slots, ['departureDate', 'departure_date', 'checkinDate', 'checkin_date', 'segment_1_departureDate']);
  const returnDate = firstSlotString(slots, ['returnDate', 'return_date', 'checkoutDate', 'checkout_date', 'segment_2_departureDate']);
  const adults = firstSlotNumber(slots, ['adults', 'passengers', 'travelers', 'pax']);
  const children = firstSlotNumber(slots, ['children']);
  const infants = firstSlotNumber(slots, ['infants']);

  if (next.flights || origin || destination || departureDate || returnDate || adults !== undefined) {
    const baseFlights = { ...(next.flights || {}) } as Record<string, unknown>;
    const flightOrigin = origin || firstDefinedString(baseFlights.origin);
    const flightDestination = destination || firstDefinedString(baseFlights.destination);
    const flightDepartureDate = departureDate || firstDefinedString(baseFlights.departureDate);
    const flightReturnDate = returnDate || firstDefinedString(baseFlights.returnDate);
    const rawSegments = Array.isArray(baseFlights.segments)
      ? [...baseFlights.segments] as Array<Record<string, unknown>>
      : [];

    if (flightOrigin) baseFlights.origin = flightOrigin;
    if (flightDestination) baseFlights.destination = flightDestination;
    if (flightDepartureDate) baseFlights.departureDate = flightDepartureDate;
    if (flightReturnDate) {
      baseFlights.returnDate = flightReturnDate;
      baseFlights.tripType = 'round_trip';
    }
    if (adults !== undefined) {
      baseFlights.adults = Math.max(1, adults);
      baseFlights.adultsExplicit = true;
    }
    if (children !== undefined) baseFlights.children = children;
    if (infants !== undefined) baseFlights.infants = infants;

    if (rawSegments.length > 0 && (flightOrigin || flightDestination || flightReturnDate)) {
      const first = { ...(rawSegments[0] || {}) };
      const second = { ...(rawSegments[1] || {}) };
      const firstOrigin = firstDefinedString(first.origin, flightOrigin);
      const firstDestination = firstDefinedString(first.destination, flightDestination);
      const firstDepartureDate = firstDefinedString(first.departureDate, flightDepartureDate);
      const secondOrigin = firstDefinedString(second.origin, firstDestination);
      const secondDestination = firstDefinedString(second.destination, firstOrigin);
      const secondDepartureDate = firstDefinedString(second.departureDate, flightReturnDate);

      rawSegments[0] = {
        ...first,
        ...(firstOrigin ? { origin: firstOrigin } : {}),
        ...(firstDestination ? { destination: firstDestination } : {}),
        ...(firstDepartureDate ? { departureDate: firstDepartureDate } : {}),
      };
      if (rawSegments.length > 1 || secondDepartureDate || secondOrigin || secondDestination) {
        rawSegments[1] = {
          ...second,
          ...(secondOrigin ? { origin: secondOrigin } : {}),
          ...(secondDestination ? { destination: secondDestination } : {}),
          ...(secondDepartureDate ? { departureDate: secondDepartureDate } : {}),
        };
      }
      baseFlights.segments = rawSegments;
    }

    next.flights = normalizeFlightRequest(baseFlights);
  }

  if (next.hotels || destination || departureDate || returnDate || adults !== undefined) {
    const baseHotels = { ...(next.hotels || {}) } as Record<string, unknown>;
    const hotelCity = destination || firstDefinedString(baseHotels.city, next.flights?.destination);
    const checkinDate = departureDate || firstDefinedString(baseHotels.checkinDate, next.flights?.departureDate);
    const checkoutDate = returnDate || firstDefinedString(baseHotels.checkoutDate, next.flights?.returnDate);

    if (hotelCity) baseHotels.city = hotelCity;
    if (checkinDate) baseHotels.checkinDate = checkinDate;
    if (checkoutDate) baseHotels.checkoutDate = checkoutDate;
    if (adults !== undefined) {
      baseHotels.adults = Math.max(1, adults);
      baseHotels.adultsExplicit = true;
    }
    if (children !== undefined) baseHotels.children = children;
    if (infants !== undefined) baseHotels.infants = infants;
    next.hotels = baseHotels;
  }

  if (next.flights && next.hotels) return normalizeApiQuoteRequest(withRequestType(next, 'combined'));
  if (next.flights) return normalizeApiQuoteRequest(withRequestType(next, 'flights'));
  if (next.hotels) return normalizeApiQuoteRequest(withRequestType(next, 'hotels'));
  return normalizeApiQuoteRequest(next);
}

export function forceApiQuoteOnlyRequest(parsed: ParsedRequest, message: string): ParsedRequest {
  const type = requestTypeOf(parsed);
  const searchSeeds = (parsed as Record<string, unknown>).searchSeeds as Record<string, unknown> | undefined;
  const itinerary = parsed.itinerary || {};
  const quoteType = ['flights', 'hotels', 'combined', 'packages', 'services', 'activities', 'transfers'].includes(type);
  const routeFromMessage = extractRouteFromMessage(message);

  if (quoteType) {
    return {
      ...parsed,
      planIntent: false,
      quoteIntent: true,
    } as ParsedRequest;
  }

  const wantsFlight = hasFlightIntent(message, parsed);
  const wantsHotel = hasHotelIntent(message, parsed);
  const targetType: ParsedRequest['type'] = wantsHotel && !wantsFlight
    ? 'hotels'
    : wantsFlight && !wantsHotel
      ? 'flights'
      : 'combined';

  const destination = getFirstDestination(parsed) || routeFromMessage.destination;
  const origin = firstDefinedString(
    parsed.flights?.origin,
    searchSeeds?.origin,
    itinerary.origin,
    itinerary.departureCity,
    itinerary.from,
    routeFromMessage.origin,
  );
  const startDate = firstDefinedString(
    parsed.flights?.departureDate,
    parsed.hotels?.checkinDate,
    itinerary.startDate,
    searchSeeds?.departureDate,
    searchSeeds?.checkinDate,
  );
  const endDate = firstDefinedString(
    parsed.flights?.returnDate,
    parsed.hotels?.checkoutDate,
    itinerary.endDate,
    searchSeeds?.returnDate,
    searchSeeds?.checkoutDate,
  ) || (startDate && itinerary.days ? addDaysIso(startDate, Number(itinerary.days)) : undefined);
  const travelers = itinerary.travelers || searchSeeds || {};
  const adults = firstDefinedNumber(parsed.flights?.adults, parsed.hotels?.adults, travelers.adults) ?? 1;
  const children = firstDefinedNumber(parsed.flights?.children, parsed.hotels?.children, travelers.children) ?? 0;
  const infants = firstDefinedNumber(parsed.flights?.infants, parsed.hotels?.infants, travelers.infants) ?? 0;

  return normalizeApiQuoteRequest({
    ...parsed,
    type: targetType,
    requestType: targetType,
    planIntent: false,
    quoteIntent: true,
    apiQuoteOnly: true,
    ...(targetType === 'flights' || targetType === 'combined'
      ? {
          flights: {
            ...(parsed.flights || {}),
            ...(origin ? { origin } : {}),
            ...(destination ? { destination } : {}),
            ...(startDate ? { departureDate: startDate } : {}),
            ...(endDate ? { returnDate: endDate, tripType: 'round_trip' } : {}),
            adults,
            adultsExplicit: true,
            children,
            infants,
          },
        }
      : { flights: undefined }),
    ...(targetType === 'hotels' || targetType === 'combined'
      ? {
          hotels: {
            ...(parsed.hotels || {}),
            ...(destination ? { city: destination } : {}),
            ...(startDate ? { checkinDate: startDate } : {}),
            ...(endDate ? { checkoutDate: endDate } : {}),
            adults,
            adultsExplicit: true,
            children,
            infants,
          },
        }
      : { hotels: undefined }),
    originalMessage: parsed.originalMessage || message,
  } as ParsedRequest);
}

export function normalizeApiQuoteMissingFields(parsed: ParsedRequest, rawFields: string[]): string[] {
  const hasOrigin = hasUsableString(parsed.flights?.origin) ||
    (Array.isArray(parsed.flights?.segments) && hasUsableString(parsed.flights.segments[0]?.origin));
  const hasDestination = hasUsableString(parsed.flights?.destination) ||
    hasUsableString(parsed.hotels?.city) ||
    (Array.isArray(parsed.flights?.segments) && hasUsableString(parsed.flights.segments[0]?.destination));
  const hasPassengers = Number(parsed.flights?.adults || parsed.hotels?.adults || 0) > 0;
  const hasOutboundDate = hasUsableString(parsed.flights?.departureDate) ||
    (Array.isArray(parsed.flights?.segments) && hasUsableString(parsed.flights.segments[0]?.departureDate));
  const hasReturnDate = hasUsableString(parsed.flights?.returnDate) ||
    (Array.isArray(parsed.flights?.segments) && hasUsableString(parsed.flights.segments[1]?.departureDate));
  const hasHotelCheckin = hasUsableString(parsed.hotels?.checkinDate);
  const hasHotelCheckout = hasUsableString(parsed.hotels?.checkoutDate);

  const isDateFieldSatisfied = (field: string): boolean => {
    const normalized = field.toLowerCase();
    if (normalized.includes('segment_2') || normalized.includes('return')) return hasReturnDate;
    if (normalized.includes('checkout')) return hasHotelCheckout;
    if (normalized.includes('segment_1') || normalized.includes('departure')) return hasOutboundDate;
    if (normalized.includes('checkin')) return hasHotelCheckin;
    return hasOutboundDate || hasHotelCheckin || hasReturnDate || hasHotelCheckout;
  };

  const canonical = [...new Set(rawFields.map((field) => {
    const slot = canonicalSlotName(field);
    if (slot === 'dates' && isDateFieldSatisfied(field)) return '';
    return slot;
  }).filter(Boolean))];

  return canonical.filter((field) => {
    if (field === 'origin') return !hasOrigin;
    if (field === 'destination') return !hasDestination;
    if (field === 'passengers') return !hasPassengers;
    return true;
  });
}

export function shouldExecuteApiQuoteSearch(args: {
  route: string;
  executionBranch: string;
  requestType?: string;
  missingFields?: string[];
}): boolean {
  return (
    (args.executionBranch === 'standard_search' || args.executionBranch === 'standard_itinerary') &&
    args.route === 'QUOTE' &&
    args.requestType !== 'general' &&
    (args.missingFields || []).length === 0
  );
}

export function inferCrossProductSlots(parsed: ParsedRequest): ParsedRequest {
  if (!parsed || typeof parsed !== 'object') return parsed;
  if (requestTypeOf(parsed) !== 'combined') return parsed;
  if (!parsed.flights || !parsed.hotels) return parsed;

  const flights = { ...parsed.flights };
  const hotels = { ...parsed.hotels };
  let changed = false;

  if (isPresent(flights.destination) && !isPresent(hotels.city)) {
    hotels.city = flights.destination;
    changed = true;
  } else if (isPresent(hotels.city) && !isPresent(flights.destination)) {
    flights.destination = hotels.city;
    changed = true;
  }

  if (isPresent(flights.departureDate) && !isPresent(hotels.checkinDate)) {
    hotels.checkinDate = flights.departureDate;
    changed = true;
  } else if (isPresent(hotels.checkinDate) && !isPresent(flights.departureDate)) {
    flights.departureDate = hotels.checkinDate;
    changed = true;
  }

  if (isPresent(flights.returnDate) && !isPresent(hotels.checkoutDate)) {
    hotels.checkoutDate = flights.returnDate;
    changed = true;
  } else if (isPresent(hotels.checkoutDate) && !isPresent(flights.returnDate)) {
    flights.returnDate = hotels.checkoutDate;
    changed = true;
  }

  return changed ? { ...parsed, flights, hotels } as ParsedRequest : parsed;
}

export function buildLlmIterationContext(parsedRequest: ParsedRequest, persistentState?: ContextState | null): IterationContext | null {
  const intent = (parsedRequest as Record<string, any>).iterationIntent;
  if (!intent?.isIteration || !persistentState?.lastSearch || !isSearchRequestType(persistentState.lastSearch.requestType)) {
    return null;
  }

  const modifiedFields: string[] = intent.modifiedFields || [];
  const hasFlightModification =
    modifiedFields.some((field) => field.startsWith('flights.')) ||
    Boolean(parsedRequest.flights);
  const hasHotelModification =
    modifiedFields.some((field) => field.startsWith('hotels.')) ||
    Boolean(parsedRequest.hotels);

  const typeMap: Record<string, IterationContext['iterationType']> = {
    duration_change: 'stay_duration_modification',
    destination_swap: 'destination_swap',
    pax_change: 'filter_change',
    preference_change: 'filter_change',
    continuation: 'full_reuse',
    unrelated: 'new_search',
  };

  let iterationType = intent.type ? typeMap[intent.type] || 'full_reuse' : 'full_reuse';
  if (iterationType === 'filter_change' && hasFlightModification) iterationType = 'flight_modification';
  else if (iterationType === 'filter_change' && hasHotelModification && persistentState.lastSearch.requestType === 'combined') iterationType = 'hotel_modification';
  if (iterationType === 'new_search') return null;

  return {
    isIteration: true,
    iterationType,
    baseRequestType: persistentState.lastSearch.requestType,
    modifiedComponent:
      hasFlightModification && hasHotelModification
        ? 'both'
        : hasFlightModification
          ? 'flights'
          : hasHotelModification
            ? 'hotels'
            : null,
    preserveFields: [],
    confidence: Math.max(parsedRequest.confidence || 0, 0.85),
    matchedPattern: `llm:${intent.type || 'iteration'}`,
    flightModification: hasFlightModification
      ? {
          ...(parsedRequest.flights?.adults !== undefined && { adults: parsedRequest.flights.adults }),
          ...(parsedRequest.flights?.children !== undefined && { children: parsedRequest.flights.children }),
          ...(parsedRequest.flights?.infants !== undefined && { infants: parsedRequest.flights.infants }),
          ...(parsedRequest.flights?.tripType && { tripType: parsedRequest.flights.tripType }),
          ...(parsedRequest.flights?.returnDate && { returnDate: parsedRequest.flights.returnDate }),
          ...(parsedRequest.flights?.stops && { stops: parsedRequest.flights.stops }),
          ...(parsedRequest.flights?.luggage && { luggage: parsedRequest.flights.luggage }),
          ...(parsedRequest.flights?.preferredAirline && { airline: parsedRequest.flights.preferredAirline }),
          ...(parsedRequest.flights?.maxLayoverHours !== undefined && { maxLayoverHours: parsedRequest.flights.maxLayoverHours }),
          ...(parsedRequest.flights?.cabinClass && { cabinClass: parsedRequest.flights.cabinClass }),
        }
      : undefined,
  };
}

export function buildTurnContinuityIterationContext(parsedRequest: ParsedRequest, persistentState?: ContextState | null): IterationContext | null {
  const continuity = (parsedRequest as Record<string, any>).turnContinuity;
  if (
    !continuity ||
    continuity.relation === 'new_independent_request' ||
    continuity.relation === 'answers_pending_question' ||
    continuity.target === 'pending_action' ||
    !persistentState?.lastSearch ||
    !isSearchRequestType(persistentState.lastSearch.requestType)
  ) {
    return null;
  }

  if (continuity.target !== 'last_search' && continuity.target !== 'unknown') return null;

  const hasFlights = Boolean(parsedRequest.flights);
  const hasHotels = Boolean(parsedRequest.hotels);
  const baseRequestType = persistentState.lastSearch.requestType;
  let iterationType: IterationContext['iterationType'] = 'full_reuse';
  let modifiedComponent: IterationContext['modifiedComponent'] = null;

  if (continuity.relation === 'changes_slot' || continuity.relation === 'refines_active_search') {
    if (hasFlights && !hasHotels) {
      iterationType = 'flight_modification';
      modifiedComponent = 'flights';
    } else if (hasHotels && !hasFlights) {
      iterationType = baseRequestType === 'combined' ? 'hotel_modification' : 'full_reuse';
      modifiedComponent = 'hotels';
    } else if (hasFlights && hasHotels) {
      iterationType = 'full_reuse';
      modifiedComponent = 'both';
    }
  }

  if (continuity.relation === 'adds_product' || continuity.relation === 'selects_active_result') {
    iterationType = 'full_reuse';
    modifiedComponent = hasFlights && hasHotels ? 'both' : hasFlights ? 'flights' : hasHotels ? 'hotels' : null;
  }

  return {
    isIteration: true,
    iterationType,
    baseRequestType,
    modifiedComponent,
    preserveFields: [],
    confidence: Math.max(parsedRequest.confidence || 0, continuity.confidence || 0, 0.8),
    matchedPattern: `llm-continuity:${continuity.relation}`,
  };
}

export function detectIterationIntent(message: string, previousContext: ContextState | null): IterationContext {
  if (!previousContext?.lastSearch) return { ...EMPTY_ITERATION };

  const lastSearch = previousContext.lastSearch;
  const normalized = normalizedText(message);
  const durationDays = extractDurationDays(message);
  if (durationDays) {
    return {
      isIteration: true,
      iterationType: 'stay_duration_modification',
      baseRequestType: lastSearch.requestType,
      modifiedComponent: lastSearch.requestType === 'combined' ? 'both' : lastSearch.requestType,
      preserveFields: [],
      confidence: 0.95,
      matchedPattern: 'stay_duration',
      stayModification: { nights: durationDays },
    };
  }

  const newDestination = extractDestinationSwap(message);
  if (newDestination && (lastSearch.flightsParams || lastSearch.hotelsParams)) {
    return {
      isIteration: true,
      iterationType: 'destination_swap',
      baseRequestType: lastSearch.requestType,
      modifiedComponent: lastSearch.requestType === 'combined' ? 'both' : lastSearch.requestType,
      preserveFields: [],
      confidence: 0.85,
      matchedPattern: 'destination_swap',
      destinationSwap: { newDestination },
    };
  }

  const flightModification = extractFlightModification(message);
  if (flightModification && (lastSearch.requestType === 'flights' || lastSearch.requestType === 'combined')) {
    return {
      isIteration: true,
      iterationType: 'flight_modification',
      baseRequestType: lastSearch.requestType,
      modifiedComponent: lastSearch.requestType === 'combined' ? 'both' : 'flights',
      preserveFields: lastSearch.requestType === 'combined' ? ['hotels'] : [],
      confidence: 0.9,
      matchedPattern: 'flight_modification',
      flightModification,
    };
  }

  const mentionsContext = /\b(mism[ao]s?\s+busqueda|misma\s+consulta|mismo\s+vuelo|mismas?\s+fechas?|esas?\s+fechas?|lo\s+mismo\s+pero|igual\s+que\s+antes|como\s+antes|busqueda\s+anterior|busqueda\s+previa|cambia\s+las?\s+fechas?)\b/i.test(normalized);
  const hotelIntent = hasHotelIntent(message);
  if ((hotelIntent || /\b(agrega(?:r|me)?|sum(?:a|ar)?)\s+hotel\b/i.test(normalized)) && lastSearch.requestType !== 'hotels') {
    return {
      isIteration: true,
      iterationType: 'hotel_modification',
      baseRequestType: lastSearch.requestType,
      modifiedComponent: 'hotels',
      preserveFields: ['flights'],
      confidence: mentionsContext ? 0.9 : 0.8,
      matchedPattern: 'hotel_modification',
    };
  }

  if (mentionsContext) {
    return {
      isIteration: true,
      iterationType: 'full_reuse',
      baseRequestType: lastSearch.requestType,
      modifiedComponent: lastSearch.requestType === 'combined' ? 'both' : lastSearch.requestType,
      preserveFields: [],
      confidence: 0.8,
      matchedPattern: 'context_reference',
    };
  }

  return {
    ...EMPTY_ITERATION,
    baseRequestType: lastSearch.requestType,
  };
}

export function mergeIterationContext(
  previousContext: ContextState,
  newParsedRequest: ParsedRequest,
  iterationContext: IterationContext,
): ParsedRequest {
  if (!iterationContext.isIteration) return newParsedRequest;

  const { lastSearch } = previousContext;

  if (iterationContext.iterationType === 'hotel_modification') {
    const mergedRequest: ParsedRequest = withRequestType({
      ...newParsedRequest,
      flights: lastSearch.flightsParams
        ? normalizeFlightRequest(lastSearch.flightsParams)
        : newParsedRequest.flights,
      hotels: {
        city: lastSearch.hotelsParams?.city || lastSearch.flightsParams?.destination || '',
        checkinDate: lastSearch.hotelsParams?.checkinDate || lastSearch.flightsParams?.departureDate || '',
        checkoutDate: lastSearch.hotelsParams?.checkoutDate || lastSearch.flightsParams?.returnDate || '',
        adults: lastSearch.hotelsParams?.adults || lastSearch.flightsParams?.adults || 1,
        children: lastSearch.hotelsParams?.children ?? lastSearch.flightsParams?.children ?? 0,
        infants: lastSearch.hotelsParams?.infants ?? lastSearch.flightsParams?.infants ?? 0,
        roomType: newParsedRequest.hotels?.roomType || lastSearch.hotelsParams?.roomType,
        mealPlan: newParsedRequest.hotels?.mealPlan || lastSearch.hotelsParams?.mealPlan,
        ...(newParsedRequest.hotels?.hotelChains && { hotelChains: newParsedRequest.hotels.hotelChains }),
        ...(newParsedRequest.hotels?.hotelName && { hotelName: newParsedRequest.hotels.hotelName }),
      },
    } as ParsedRequest, lastSearch.flightsParams ? 'combined' : 'hotels');

    return inferCrossProductSlots(mergedRequest);
  }

  if (iterationContext.iterationType === 'flight_modification') {
    const flightMod = iterationContext.flightModification || {};
    const preserveHotel = lastSearch.requestType === 'combined';
    const nextTripType = flightMod.tripType ?? newParsedRequest.flights?.tripType ?? lastSearch.flightsParams?.tripType;
    const nextReturnDate =
      flightMod.tripType === 'one_way'
        ? undefined
        : flightMod.returnDate ?? newParsedRequest.flights?.returnDate ?? lastSearch.flightsParams?.returnDate;

    const mergedRequest: ParsedRequest = withRequestType({
      ...newParsedRequest,
      flights: normalizeFlightRequest({
        ...(lastSearch.flightsParams || {}),
        ...(newParsedRequest.flights || {}),
        ...(nextTripType && { tripType: nextTripType }),
        ...(nextReturnDate && { returnDate: nextReturnDate }),
        ...(flightMod.stops && { stops: flightMod.stops }),
        ...(flightMod.luggage && { luggage: flightMod.luggage }),
        ...(flightMod.airline && { preferredAirline: flightMod.airline }),
        ...(flightMod.maxLayoverHours !== undefined && { maxLayoverHours: flightMod.maxLayoverHours }),
        ...(flightMod.cabinClass && { cabinClass: flightMod.cabinClass }),
        ...(flightMod.adults !== undefined && { adults: flightMod.adults, adultsExplicit: true }),
        ...(flightMod.children !== undefined && { children: flightMod.children }),
        ...(flightMod.infants !== undefined && { infants: flightMod.infants }),
      }),
      ...(preserveHotel && lastSearch.hotelsParams
        ? {
            hotels: {
              ...lastSearch.hotelsParams,
              ...(newParsedRequest.hotels?.checkinDate
                ? { checkinDate: newParsedRequest.hotels.checkinDate }
                : newParsedRequest.flights?.departureDate
                  ? { checkinDate: newParsedRequest.flights.departureDate }
                  : {}),
              ...(newParsedRequest.hotels?.checkoutDate
                ? { checkoutDate: newParsedRequest.hotels.checkoutDate }
                : newParsedRequest.flights?.returnDate || flightMod.returnDate
                  ? { checkoutDate: newParsedRequest.flights?.returnDate || flightMod.returnDate }
                  : {}),
              ...(flightMod.adults !== undefined && { adults: flightMod.adults, adultsExplicit: true }),
              ...(flightMod.children !== undefined && { children: flightMod.children }),
              ...(flightMod.infants !== undefined && { infants: flightMod.infants }),
            },
          }
        : {}),
    } as ParsedRequest, preserveHotel ? 'combined' : 'flights');

    return inferCrossProductSlots(mergedRequest);
  }

  if (iterationContext.iterationType === 'stay_duration_modification') {
    const nights = iterationContext.stayModification?.nights;
    if (!nights) return newParsedRequest;
    const departureDate = String(lastSearch.flightsParams?.departureDate || '');
    const checkinDate = String(lastSearch.hotelsParams?.checkinDate || departureDate || '');
    const newReturnDate = departureDate ? addDaysIso(departureDate, nights) : undefined;
    const newCheckoutDate = checkinDate ? addDaysIso(checkinDate, nights) : undefined;

    return inferCrossProductSlots(withRequestType({
      ...newParsedRequest,
      flights: lastSearch.flightsParams
        ? normalizeFlightRequest({
            ...lastSearch.flightsParams,
            ...(newReturnDate && { returnDate: newReturnDate, tripType: 'round_trip' }),
          })
        : newParsedRequest.flights,
      hotels: lastSearch.hotelsParams
        ? {
            ...lastSearch.hotelsParams,
            ...(newCheckoutDate && { checkoutDate: newCheckoutDate }),
          }
        : newParsedRequest.hotels,
    } as ParsedRequest, lastSearch.requestType));
  }

  if (iterationContext.iterationType === 'destination_swap') {
    const newDestination = iterationContext.destinationSwap?.newDestination;
    if (!newDestination) return newParsedRequest;
    const aiFlightDestination = newParsedRequest.flights?.destination;
    const aiHotelCity = newParsedRequest.hotels?.city;
    const previousFlightDestination = String(lastSearch.flightsParams?.destination || '');
    const previousHotelCity = String(lastSearch.hotelsParams?.city || '');
    const resolvedNewDestination =
      (aiFlightDestination && destinationsDiffer(aiFlightDestination, previousFlightDestination)
        ? aiFlightDestination
        : undefined) ||
      (aiHotelCity && destinationsDiffer(aiHotelCity, previousHotelCity)
        ? aiHotelCity
        : undefined) ||
      newDestination;
    const updatedFlightSegments = Array.isArray(lastSearch.flightsParams?.segments)
      ? lastSearch.flightsParams.segments.map((segment: Record<string, unknown>, index: number) => {
          if (index === 0) {
            return {
              ...segment,
              destination: resolvedNewDestination,
            };
          }
          if (index === 1) {
            return {
              ...segment,
              origin: resolvedNewDestination,
              destination: lastSearch.flightsParams?.origin || segment.destination,
            };
          }
          return {
            ...segment,
            ...(String(segment.origin || '') === previousFlightDestination ? { origin: resolvedNewDestination } : {}),
            ...(String(segment.destination || '') === previousFlightDestination ? { destination: resolvedNewDestination } : {}),
          };
        })
      : undefined;
    return inferCrossProductSlots(withRequestType({
      ...newParsedRequest,
      flights: lastSearch.flightsParams
        ? normalizeFlightRequest({
            ...lastSearch.flightsParams,
            destination: resolvedNewDestination,
            ...(updatedFlightSegments ? { segments: updatedFlightSegments } : {}),
          })
        : newParsedRequest.flights,
      hotels: lastSearch.hotelsParams
        ? {
            ...lastSearch.hotelsParams,
            city: resolvedNewDestination,
          }
        : newParsedRequest.hotels,
    } as ParsedRequest, lastSearch.requestType));
  }

  if (iterationContext.iterationType === 'full_reuse') {
    const merged = {
      ...newParsedRequest,
      flights: lastSearch.flightsParams
        ? normalizeFlightRequest(mergeDefined(lastSearch.flightsParams, newParsedRequest.flights as Record<string, unknown>))
        : newParsedRequest.flights,
      hotels: lastSearch.hotelsParams
        ? mergeDefined(lastSearch.hotelsParams, newParsedRequest.hotels as Record<string, unknown>)
        : newParsedRequest.hotels,
    } as ParsedRequest;
    const targetType = merged.flights && merged.hotels ? 'combined' : lastSearch.requestType;
    return inferCrossProductSlots(withRequestType(merged, targetType));
  }

  return newParsedRequest;
}

function hasContinuitySignal(parsed: ParsedRequest, message: string): boolean {
  const iteration = (parsed as Record<string, unknown>).iterationIntent as Record<string, unknown> | undefined;
  const continuity = (parsed as Record<string, unknown>).turnContinuity as Record<string, unknown> | undefined;
  if (iteration?.isIteration === true) return true;
  if (
    continuity &&
    continuity.relation !== 'new_independent_request' &&
    (continuity.target === 'last_search' || continuity.target === 'pending_action' || continuity.target === 'unknown')
  ) {
    return true;
  }
  return /\b(mism[ao]s?|esas?\s+fechas?|esos?\s+vuelos?|agrega(?:r|me)?\s+hotel|sum(?:a|ar)\s+hotel|una\s+semana|\d{1,2}\s*(dias|días|noches)|desde\s+|cambia\s+las?\s+fechas?)\b/i.test(message);
}

function mergeWithPersistentSearchContext(
  parsedRequest: ParsedRequest,
  persistentState: ContextState | null,
  message: string,
): ParsedRequest {
  const lastSearch = persistentState?.lastSearch;
  if (!lastSearch || explicitlyNewIndependent(parsedRequest)) return parsedRequest;

  const previousDestination = lastSearch.flightsParams?.destination || lastSearch.hotelsParams?.city;
  const currentDestination = getFirstDestination(parsedRequest);
  const continuity = hasContinuitySignal(parsedRequest, message);
  if (destinationsDiffer(currentDestination, previousDestination as string | undefined) && !continuity) {
    return parsedRequest;
  }

  const parsedType = requestTypeOf(parsedRequest);
  if (!continuity && !['missing_info_request', 'flights', 'hotels', 'combined'].includes(parsedType)) {
    return parsedRequest;
  }

  const merged = { ...parsedRequest } as ParsedRequest;
  const wantsHotel = hasHotelIntent(message, parsedRequest);
  const wantsFlight = hasFlightIntent(message, parsedRequest);

  if (lastSearch.flightsParams && (parsedType !== 'hotels' || wantsFlight || lastSearch.requestType === 'combined')) {
    merged.flights = mergeDefined(lastSearch.flightsParams, parsedRequest.flights as Record<string, unknown>) as Record<string, unknown>;
  }

  if (lastSearch.hotelsParams && (parsedType !== 'flights' || wantsHotel || lastSearch.requestType === 'combined')) {
    merged.hotels = mergeDefined(lastSearch.hotelsParams, parsedRequest.hotels as Record<string, unknown>) as Record<string, unknown>;
  }

  if (wantsHotel && !merged.hotels && lastSearch.flightsParams) {
    merged.hotels = {
      city: lastSearch.flightsParams.destination,
      checkinDate: lastSearch.flightsParams.departureDate,
      checkoutDate: lastSearch.flightsParams.returnDate || addDaysIso(String(lastSearch.flightsParams.departureDate || ''), 7),
      adults: lastSearch.flightsParams.adults || 1,
      adultsExplicit: true,
      children: lastSearch.flightsParams.children || 0,
      infants: lastSearch.flightsParams.infants || 0,
    };
  }

  if (wantsFlight && !merged.flights && lastSearch.hotelsParams) {
    merged.flights = {
      destination: lastSearch.hotelsParams.city,
      departureDate: lastSearch.hotelsParams.checkinDate,
      returnDate: lastSearch.hotelsParams.checkoutDate,
      adults: lastSearch.hotelsParams.adults || 1,
      adultsExplicit: true,
      children: lastSearch.hotelsParams.children || 0,
      infants: lastSearch.hotelsParams.infants || 0,
      tripType: 'round_trip',
    };
  }

  if (merged.flights && merged.hotels) return inferCrossProductSlots(withRequestType(merged, 'combined'));
  if (merged.flights) return withRequestType(merged, 'flights');
  if (merged.hotels) return withRequestType(merged, 'hotels');
  return merged;
}

function resolveTurnIntentFromSearchContext(
  parsedRequest: ParsedRequest,
  persistentState: ContextState | null,
  message: string,
): ParsedRequest {
  const wantsHotel = hasHotelIntent(message, parsedRequest);
  const wantsFlight = hasFlightIntent(message, parsedRequest);
  const messageWantsHotel = hasHotelIntent(message);
  const messageWantsFlight = hasFlightIntent(message);
  let next = parsedRequest;

  if (messageWantsHotel && !messageWantsFlight && persistentState?.lastSearch?.flightsParams) {
    const flight = persistentState.lastSearch.flightsParams;
    const shouldAddToFlightQuote = persistentState.lastSearch.requestType === 'flights' && !asksHotelOnly(message);
    next = withRequestType({
      ...next,
      flights: shouldAddToFlightQuote
        ? normalizeFlightRequest(flight)
        : undefined,
      hotels: mergeDefined({
        city: flight.destination,
        checkinDate: flight.departureDate,
        checkoutDate: flight.returnDate || addDaysIso(String(flight.departureDate || ''), 7),
        adults: flight.adults || 1,
        adultsExplicit: true,
        children: flight.children || 0,
        infants: flight.infants || 0,
      }, next.hotels as Record<string, unknown>) as Record<string, unknown>,
    } as ParsedRequest, shouldAddToFlightQuote ? 'combined' : 'hotels');
  }

  if (wantsHotel && wantsFlight && requestTypeOf(next) !== 'combined') {
    next = withRequestType({
      ...next,
      flights: next.flights || persistentState?.lastSearch?.flightsParams,
      hotels: next.hotels || persistentState?.lastSearch?.hotelsParams,
    } as ParsedRequest, 'combined');
  }

  return next;
}

export function resolveApiTurnContext(args: {
  parsedRequest: ParsedRequest;
  persistentState: ContextState | null;
  message: string;
}): { parsedRequest: ParsedRequest; iterationContext: IterationContext } {
  const { persistentState, message } = args;
  let parsedRequest = inferCrossProductSlots(args.parsedRequest);

  if (!persistentState?.lastSearch || explicitlyNewIndependent(parsedRequest)) {
    return { parsedRequest, iterationContext: { ...EMPTY_ITERATION } };
  }

  parsedRequest = resolveTurnIntentFromSearchContext(parsedRequest, persistentState, message);

  const deterministicIterationContext = detectIterationIntent(message, persistentState);
  const llmIterationContext = buildLlmIterationContext(parsedRequest, persistentState);
  const continuityIterationContext = !llmIterationContext
    ? buildTurnContinuityIterationContext(parsedRequest, persistentState)
    : null;
  const iterationContext = llmIterationContext || continuityIterationContext || deterministicIterationContext;

  if (iterationContext !== deterministicIterationContext && deterministicIterationContext.isIteration) {
    iterationContext.flightModification ??= deterministicIterationContext.flightModification;
    iterationContext.stayModification ??= deterministicIterationContext.stayModification;
    iterationContext.destinationSwap ??= deterministicIterationContext.destinationSwap;
  }

  if (
    iterationContext.iterationType === 'stay_duration_modification' &&
    !iterationContext.stayModification
  ) {
    iterationContext.iterationType = 'full_reuse';
    iterationContext.matchedPattern = `${iterationContext.matchedPattern || 'llm'}:slot_change`;
  }

  if (iterationContext.isIteration) {
    parsedRequest = mergeIterationContext(persistentState, parsedRequest, iterationContext);
  } else {
    parsedRequest = mergeWithPersistentSearchContext(parsedRequest, persistentState, message);
  }

  return {
    parsedRequest: inferCrossProductSlots(parsedRequest),
    iterationContext,
  };
}

export function resolveApiQuoteTurnContext(args: {
  parsedRequest: ParsedRequest;
  persistentState: ContextState | null;
  message: string;
  resolvedSlots?: Record<string, unknown> | null;
}): ApiQuoteTurnContextResolution {
  let parsedRequest = forceApiQuoteOnlyRequest(args.parsedRequest, args.message);
  const turnContextResolution = resolveApiTurnContext({
    parsedRequest,
    persistentState: args.persistentState,
    message: args.message,
  });
  parsedRequest = forceApiQuoteOnlyRequest(turnContextResolution.parsedRequest, args.message);

  const appliedSlots = { ...(args.resolvedSlots || {}) };
  parsedRequest = applyResolvedSlotsToQuoteRequest(parsedRequest, appliedSlots);
  parsedRequest = forceApiQuoteOnlyRequest(parsedRequest, args.message);

  return {
    parsedRequest: normalizeApiQuoteRequest(parsedRequest),
    iterationContext: turnContextResolution.iterationContext,
    appliedSlots,
  };
}
