import type { ParsedTravelRequest, HotelRequest } from '@/services/aiMessageParser';
import { detectMultipleHotelChains } from '../data/hotelChainAliases';
import type { ContextState } from '../types/contextState';

export type ResolvedTurnIntent =
  | 'hotel_search'
  | 'flight_search'
  | 'combined_search'
  | 'itinerary'
  | 'service_search'
  | 'package_search'
  | 'general';

export interface TurnIntentResolution {
  resolvedRequest: ParsedTravelRequest;
  resolvedIntent: ResolvedTurnIntent;
  contextUsed: Array<'last_flight_search' | 'last_hotel_search' | 'message_preferences'>;
  confidence: number;
  invalidatedServerRoute: boolean;
  reason: string;
}

function normalizeIntentText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// LEGACY intent regexes (Spanish-only)
//
// As of prompt v17/v18 the parser emits these signals as semantic fields on
// `ParsedTravelRequest` (`requestType`, `hotels`/`flights` blocks,
// `hotels.mealPlan`, `hotels.roomType`, `hotels.hotelChains`,
// `referencesCurrentPlan`). The regexes are retained ONLY as a defensive
// fallback for the legacy `useMessageHandler.ts:isAddHotelRequest` branch
// that runs BEFORE the LLM parser -- and for hotel-chain extraction (the
// `hotelChainAliases.ts` registry has hundreds of variants the LLM hasn't
// been trained on).
//
// REMOVE the message-only branches once all callers reliably emit v18+
// semantic fields and the early add-hotel branch is migrated.
// ---------------------------------------------------------------------------

const LEGACY_HOTEL_MEAL_PLAN_RULES: Array<[NonNullable<HotelRequest['mealPlan']>, RegExp]> = [
  ['all_inclusive', /(all\s+inclusive|todo\s+incluido)/],
  ['half_board', /(media\s+pension|half\s+board)/],
  ['room_only', /(solo\s+habitacion|room\s+only)/],
  ['breakfast', /(desayuno|breakfast)/],
];

const LEGACY_HOTEL_ROOM_TYPE_RULES: Array<[NonNullable<HotelRequest['roomType']>, RegExp]> = [
  ['triple', /\btriple\b/],
  ['single', /\b(single|simple)\b/],
  ['double', /\b(double|doble)\b/],
];

const LEGACY_PREVIOUS_CONTEXT_REGEX =
  /\b(mism[ao]s?\s+busqueda|misma\s+consulta|mismo\s+vuelo|mismas?\s+fechas?|esas?\s+fechas?|lo\s+mismo\s+pero|igual\s+que\s+antes|como\s+antes|busqueda\s+anterior|busqueda\s+previa)\b/;

// Explicit message-level intent regexes used by `applyExplicitServiceIntent`.
// These are intentionally MESSAGE-LEVEL (not parser-based) because that
// function distinguishes "user just wrote 'vuelo'" from "parser carried a
// flights block from previous context". The parsed-payload helpers
// `hasHotelIntent` / `hasFlightIntent` would conflate those two.
// LEGACY because Spanish-only -- close the EN/PT gap when prompt v18 also
// emits an `explicitlyMentions` field per service. Until then, keep these.
const LEGACY_EXPLICIT_HOTEL_MENTION_REGEX =
  /\b(hotel|hotels|hoteles|alojamiento|hospedaje|donde quedarme|donde alojarme)\b/;
const LEGACY_EXPLICIT_FLIGHT_MENTION_REGEX =
  /\b(vuelo|vuelos|avion|aereo|flight|flights)\b/;
const LEGACY_HOTEL_REJECTION_REGEX =
  /\b(no quiero hotel|sin hotel|solo vuelo|solo el vuelo|no necesito hotel)\b/;

function legacyDetectMealPlanFromMessage(message: string): HotelRequest['mealPlan'] | undefined {
  const normalized = normalizeIntentText(message);
  for (const [value, regex] of LEGACY_HOTEL_MEAL_PLAN_RULES) {
    if (regex.test(normalized)) return value;
  }
  return undefined;
}

function legacyDetectRoomTypeFromMessage(message: string): HotelRequest['roomType'] | undefined {
  const normalized = normalizeIntentText(message);
  for (const [value, regex] of LEGACY_HOTEL_ROOM_TYPE_RULES) {
    if (regex.test(normalized)) return value;
  }
  return undefined;
}

/**
 * Hotel preference extraction. Primary source is the parsed payload (parser
 * v17/v18 already extracts `mealPlan`, `roomType`, `hotelChains`). The
 * legacy message-regex path is retained for the early `isAddHotelRequest`
 * branch in `useMessageHandler.ts` that runs BEFORE the LLM parser.
 *
 * `detectMultipleHotelChains` always runs against the message as a safety
 * net for chain extraction -- see `hotelChainAliases.ts`.
 */
export function detectHotelPreferencesFromMessage(
  parsedRequest: ParsedTravelRequest | null | undefined,
  message?: string,
): {
  hotelChains: string[];
  mealPlan: HotelRequest['mealPlan'] | undefined;
  roomType: HotelRequest['roomType'] | undefined;
} {
  const parsedHotels = parsedRequest?.hotels;
  const parsedChains = parsedHotels?.hotelChains;
  const fallbackChains = message ? detectMultipleHotelChains(message) : [];
  const hotelChains = parsedChains && parsedChains.length > 0 ? parsedChains : fallbackChains;

  const mealPlan =
    parsedHotels?.mealPlan
    ?? (message ? legacyDetectMealPlanFromMessage(message) : undefined);

  const roomType =
    parsedHotels?.roomType
    ?? (message ? legacyDetectRoomTypeFromMessage(message) : undefined);

  return { hotelChains, mealPlan, roomType };
}

function hasHotelIntent(parsedRequest: ParsedTravelRequest): boolean {
  return (
    parsedRequest.requestType === 'hotels' ||
    parsedRequest.requestType === 'combined' ||
    parsedRequest.requestType === 'packages' ||
    Boolean(parsedRequest.hotels)
  );
}

function hasFlightIntent(parsedRequest: ParsedTravelRequest): boolean {
  return (
    parsedRequest.requestType === 'flights' ||
    parsedRequest.requestType === 'combined' ||
    parsedRequest.requestType === 'packages' ||
    Boolean(parsedRequest.flights)
  );
}

/**
 * "Mismo vuelo" / "esas fechas" / "como antes" detection. Primary source is
 * the parser's `referencesCurrentPlan` boolean (multilingual, prompt v18+).
 * The legacy ES regex is retained as a defensive fallback for cached
 * pre-v18 parses, and ALSO ORs with the parsed signal to keep the broader
 * "previous search" semantic -- `referencesCurrentPlan` is specifically about
 * the active plan/itinerary, while the legacy regex catches "misma busqueda"
 * (i.e. previous flight/hotel search) which is broader.
 */
function explicitlyReferencesPreviousContext(
  parsedRequest: ParsedTravelRequest | null | undefined,
  message: string,
): boolean {
  // Type augmentation: `referencesCurrentPlan` is added by the schema-extender
  // (Phase 4 / sub-task A). Read defensively via any-cast for forward-compat.
  const fromParsed = (parsedRequest as { referencesCurrentPlan?: boolean | null } | null | undefined)
    ?.referencesCurrentPlan;
  if (fromParsed === true) return true;
  return LEGACY_PREVIOUS_CONTEXT_REGEX.test(normalizeIntentText(message));
}

function messageMentions(message: string, value?: string): boolean {
  if (!value) return false;
  return normalizeIntentText(message).includes(normalizeIntentText(value).trim());
}

function applyExplicitServiceIntent(
  parsedRequest: ParsedTravelRequest,
  message: string,
): { request: ParsedTravelRequest; changed: boolean; contextUsed: TurnIntentResolution['contextUsed']; reason?: string } {
  const normalized = normalizeIntentText(message);
  const wantsHotel = LEGACY_EXPLICIT_HOTEL_MENTION_REGEX.test(normalized);
  const wantsFlight = LEGACY_EXPLICIT_FLIGHT_MENTION_REGEX.test(normalized);
  const rejectsHotel = LEGACY_HOTEL_REJECTION_REGEX.test(normalized);
  const referencesPrevious = explicitlyReferencesPreviousContext(parsedRequest, message);

  let request = parsedRequest;
  let changed = false;
  let reason: string | undefined;

  if (wantsHotel && wantsFlight && !referencesPrevious) {
    const flightDestination = request.flights?.destination;
    const hotelCity = request.hotels?.city;
    if (
      flightDestination &&
      hotelCity &&
      normalizeIntentText(flightDestination) !== normalizeIntentText(hotelCity)
    ) {
      const mentionsFlightDestination = messageMentions(message, flightDestination);
      const mentionsHotelCity = messageMentions(message, hotelCity);

      if (mentionsHotelCity && !mentionsFlightDestination && request.flights) {
        request = {
          ...request,
          flights: {
            ...request.flights,
            destination: hotelCity,
          },
          orchestration: undefined,
        } as ParsedTravelRequest;
        changed = true;
        reason = 'aligned_flight_destination_to_explicit_hotel_city';
      } else if (mentionsFlightDestination && !mentionsHotelCity && request.hotels) {
        request = {
          ...request,
          hotels: {
            ...request.hotels,
            city: flightDestination,
          },
          orchestration: undefined,
        } as ParsedTravelRequest;
        changed = true;
        reason = 'aligned_hotel_city_to_explicit_flight_destination';
      }
    }
  }

  if (wantsHotel && !wantsFlight && !referencesPrevious) {
    const flightsSnapshot = request.flights;
    if (request.requestType !== 'hotels' || request.flights) {
      request = {
        ...request,
        requestType: 'hotels',
        flights: undefined,
        hotels: request.hotels || (flightsSnapshot?.destination
          ? {
              city: flightsSnapshot.destination,
              checkinDate: flightsSnapshot.departureDate,
              checkoutDate: flightsSnapshot.returnDate,
              adults: flightsSnapshot.adults || 1,
              adultsExplicit: flightsSnapshot.adultsExplicit,
              children: flightsSnapshot.children ?? 0,
              infants: flightsSnapshot.infants ?? 0,
            }
          : request.hotels),
        orchestration: undefined,
      } as ParsedTravelRequest;
      changed = true;
      reason = 'forced_hotels_only_from_explicit_intent';
    }
  }

  if (wantsHotel && wantsFlight && !rejectsHotel && request.requestType !== 'combined') {
    const flights = request.flights;
    const existingHotels = request.hotels || {};
    request = {
      ...request,
      requestType: 'combined',
      hotels: {
        ...existingHotels,
        city: existingHotels.city || flights?.destination,
        checkinDate: existingHotels.checkinDate || flights?.departureDate,
        checkoutDate: existingHotels.checkoutDate || flights?.returnDate,
        adults: existingHotels.adults || flights?.adults,
        children: existingHotels.children ?? flights?.children ?? 0,
        infants: existingHotels.infants ?? flights?.infants ?? 0,
      },
      orchestration: undefined,
    } as ParsedTravelRequest;
    changed = true;
    reason = 'coerced_combined_from_explicit_service_intent';
  }

  return {
    request,
    changed,
    contextUsed: changed ? ['message_preferences'] : [],
    reason,
  };
}

function addDays(date: string, days: number): string {
  return new Date(new Date(date).getTime() + days * 86400000).toISOString().split('T')[0];
}

export function enrichHotelIntentFromContext(
  parsedRequest: ParsedTravelRequest,
  flightCtx: ContextState['lastSearch']['flightsParams'],
  message: string,
): { request: ParsedTravelRequest; changed: boolean; contextUsed: TurnIntentResolution['contextUsed'] } {
  if (!flightCtx || !hasHotelIntent(parsedRequest)) {
    return { request: parsedRequest, changed: false, contextUsed: [] };
  }

  const existingHotels = parsedRequest.hotels || {};
  const missingRequiredHotelContext =
    !existingHotels.city ||
    !existingHotels.checkinDate ||
    !existingHotels.checkoutDate ||
    !existingHotels.adults ||
    existingHotels.adultsExplicit === false;

  const hotelPreferences = detectHotelPreferencesFromMessage(parsedRequest, message);
  const hasPreferenceContext = Boolean(
    hotelPreferences.roomType ||
    hotelPreferences.mealPlan ||
    hotelPreferences.hotelChains.length > 0,
  );

  if (!missingRequiredHotelContext && !hasPreferenceContext) {
    return { request: parsedRequest, changed: false, contextUsed: [] };
  }

  const checkoutDate = flightCtx.returnDate || addDays(flightCtx.departureDate, 3);
  const shouldUseFlightAdults = !existingHotels.adults || existingHotels.adultsExplicit === false;
  const hotelChains = existingHotels.hotelChains?.length
    ? existingHotels.hotelChains
    : hotelPreferences.hotelChains.length > 0
      ? hotelPreferences.hotelChains
      : undefined;

  return {
    changed: true,
    contextUsed: [
      ...(missingRequiredHotelContext ? ['last_flight_search' as const] : []),
      ...(hasPreferenceContext ? ['message_preferences' as const] : []),
    ],
    request: {
      ...parsedRequest,
      requestType: parsedRequest.requestType === 'combined' ? 'combined' : 'hotels',
      flights: parsedRequest.requestType === 'combined' ? parsedRequest.flights : undefined,
      hotels: {
        ...existingHotels,
        city: existingHotels.city || flightCtx.destination,
        checkinDate: existingHotels.checkinDate || flightCtx.departureDate,
        checkoutDate: existingHotels.checkoutDate || checkoutDate,
        adults: shouldUseFlightAdults ? flightCtx.adults : existingHotels.adults,
        adultsExplicit: existingHotels.adultsExplicit || shouldUseFlightAdults,
        children: existingHotels.children ?? flightCtx.children ?? 0,
        infants: existingHotels.infants ?? flightCtx.infants ?? 0,
        roomType: existingHotels.roomType || hotelPreferences.roomType,
        mealPlan: existingHotels.mealPlan || hotelPreferences.mealPlan,
        hotelChains,
      },
      orchestration: undefined,
    } as ParsedTravelRequest,
  };
}

export function enrichFlightIntentFromContext(
  parsedRequest: ParsedTravelRequest,
  hotelCtx: ContextState['lastSearch']['hotelsParams'],
  message: string,
): { request: ParsedTravelRequest; changed: boolean; contextUsed: TurnIntentResolution['contextUsed'] } {
  if (!hotelCtx || !hasFlightIntent(parsedRequest)) {
    return { request: parsedRequest, changed: false, contextUsed: [] };
  }

  const existingFlights = parsedRequest.flights || {};
  const missingReusableFlightContext =
    !existingFlights.destination ||
    !existingFlights.departureDate ||
    !existingFlights.returnDate ||
    !existingFlights.adults ||
    existingFlights.adultsExplicit === false;

  if (!missingReusableFlightContext) {
    return { request: parsedRequest, changed: false, contextUsed: [] };
  }

  const shouldUseHotelAdults = !existingFlights.adults || existingFlights.adultsExplicit === false;

  return {
    changed: true,
    contextUsed: ['last_hotel_search'],
    request: {
      ...parsedRequest,
      requestType: parsedRequest.requestType === 'combined' ? 'combined' : 'flights',
      hotels: parsedRequest.requestType === 'combined' ? parsedRequest.hotels : undefined,
      flights: {
        ...existingFlights,
        destination: existingFlights.destination || hotelCtx.city,
        departureDate: existingFlights.departureDate || hotelCtx.checkinDate,
        returnDate: existingFlights.returnDate || hotelCtx.checkoutDate,
        adults: shouldUseHotelAdults ? hotelCtx.adults : existingFlights.adults,
        adultsExplicit: existingFlights.adultsExplicit || shouldUseHotelAdults,
        children: existingFlights.children ?? hotelCtx.children ?? 0,
        infants: existingFlights.infants ?? hotelCtx.infants ?? 0,
      },
      orchestration: undefined,
    } as ParsedTravelRequest,
  };
}

function resolveIntentFromRequest(request: ParsedTravelRequest): ResolvedTurnIntent {
  switch (request.requestType) {
    case 'hotels':
      return 'hotel_search';
    case 'flights':
      return 'flight_search';
    case 'combined':
      return 'combined_search';
    case 'itinerary':
      return 'itinerary';
    case 'services':
      return 'service_search';
    case 'packages':
      return 'package_search';
    default:
      return 'general';
  }
}

export function resolveTurnIntent(input: {
  message: string;
  parsedRequest: ParsedTravelRequest;
  persistentState?: ContextState | null;
}): TurnIntentResolution {
  let resolvedRequest = input.parsedRequest;
  const contextUsed = new Set<TurnIntentResolution['contextUsed'][number]>();
  let invalidatedServerRoute = false;
  const reasons: string[] = [];

  const explicitServiceIntent = applyExplicitServiceIntent(resolvedRequest, input.message);
  if (explicitServiceIntent.changed) {
    resolvedRequest = explicitServiceIntent.request;
    explicitServiceIntent.contextUsed.forEach((item) => contextUsed.add(item));
    invalidatedServerRoute = true;
    reasons.push(explicitServiceIntent.reason || 'explicit_service_intent_applied');
  }

  const hotelEnrichment = enrichHotelIntentFromContext(
    resolvedRequest,
    input.persistentState?.lastSearch?.flightsParams,
    input.message,
  );
  if (hotelEnrichment.changed) {
    resolvedRequest = hotelEnrichment.request;
    hotelEnrichment.contextUsed.forEach((item) => contextUsed.add(item));
    invalidatedServerRoute = true;
    reasons.push('hotel_intent_enriched_from_context');
  }

  const flightEnrichment = enrichFlightIntentFromContext(
    resolvedRequest,
    input.persistentState?.lastSearch?.hotelsParams,
    input.message,
  );
  if (flightEnrichment.changed) {
    resolvedRequest = flightEnrichment.request;
    flightEnrichment.contextUsed.forEach((item) => contextUsed.add(item));
    invalidatedServerRoute = true;
    reasons.push('flight_intent_enriched_from_context');
  }

  return {
    resolvedRequest,
    resolvedIntent: resolveIntentFromRequest(resolvedRequest),
    contextUsed: Array.from(contextUsed),
    confidence: Math.max(resolvedRequest.confidence || 0, contextUsed.size > 0 ? 0.85 : 0),
    invalidatedServerRoute,
    reason: reasons.length ? reasons.join(',') : 'parser_result_accepted',
  };
}
