import type { ParsedTravelRequest, UserLanguage } from '@/services/aiMessageParser';
import type { TripPlannerState, PlannerActivity, PlannerRestaurant } from '@/features/trip-planner/types';
import type { ContextState } from '../types/contextState';
import type { RouteResult } from './routeRequest';
import { isGenericPlaceholder } from './itineraryPipeline';

export interface ChatRecommendedPlace {
  placeId?: string;
  name: string;
  description?: string;
  category: string;
  bucket?: 'imperdibles' | 'historia' | 'museos' | 'barrios' | 'miradores' | 'parques' | 'gastronomia' | 'noche';
  city: string;
  country?: string;
  suggestedSlot?: 'morning' | 'afternoon' | 'evening';
  photoUrl?: string;
  lat?: number;
  lng?: number;
  source?: string;
}

export interface ConversationGap {
  key: 'dates' | 'hotels' | 'flights' | 'return_flight';
  label: string;
}

export type ConversationExecutionBranch =
  | 'ask_minimal'
  | 'standard_itinerary'
  | 'standard_search'
  | 'mode_bridge';
export type ConversationResponseMode =
  | 'proposal_first_plan'
  | 'show_places'
  | 'needs_input'
  | 'quote_or_search'
  | 'standard'
  | 'needs_mode_switch';

export interface ConversationTurnResolution {
  executionBranch: ConversationExecutionBranch;
  responseMode: ConversationResponseMode;
  normalizedMissingFields: string[];
  messageType:
    | 'collect_question'
    | 'missing_info_request'
    | 'trip_planner'
    | 'search_results'
    | 'general_response'
    | 'discovery_results'
    | 'mode_bridge';
  shouldUseStandardItinerary: boolean;
  shouldAskMinimalQuestion: boolean;
  uiMeta: {
    route: RouteResult['route'];
    reason: string;
    firstPlanHandledAs: 'standard_itinerary' | null;
    // PR 3 (C3): populated only for `mode_bridge` turns. Tells the UI which
    // mode to offer switching to in the bridge action chip (C4).
    suggestedMode?: 'agency' | 'passenger';
  };
}

export type TravelContextBridgeKind = 'plan_to_quote' | 'quote_to_plan';

export interface TravelContextBridgeResolution {
  kind: TravelContextBridgeKind | null;
  parsedRequest: ParsedTravelRequest;
  reason: string | null;
}

export interface DiscoveryVisualConfig {
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
}

function normalizeText(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SPECIALIZED_CULTURE_PATTERN = /\b(museos?|arte|galerias?|galerías|arquitectura|historia)\b/i;
const QUOTE_CONTEXT_REFERENCE_PATTERN =
  /\b(este|esta|ese|esa|el|la)\s+(viaje|plan|itinerario|recorrido|propuesta|cotizacion|cotización|busqueda|búsqueda|resultado|opcion|opción)\b|\b(esto|eso|lo\s+(anterior|que\s+armamos|que\s+cotizamos|que\s+buscamos))\b/i;
const ITINERARY_FROM_CONTEXT_PATTERN =
  /\b(arma(me)?|armame|armá|planifica(me)?|itinerario|recorrido|ruta|dia\s+por\s+dia|día\s+por\s+día)\b/i;
// Mirror of routeRequest's PLAN_INTENT (kept local to avoid a cross-module
// import cycle). Used by guard G5 in resolveConversationTurn — when a user
// in agency mode asks for a trip with high confidence + explicit planning
// keywords, we skip the mode_bridge to passenger because that bridge would
// force a useless extra turn.
const PLAN_INTENT =
  /\b(arma(me)?|planifica|itinerario|recorrido|ruta|circuito|viaje\s+por)\b/;

function addDays(date: string, days: number): string | undefined {
  const parsedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return undefined;
  parsedDate.setDate(parsedDate.getDate() + days);
  return parsedDate.toISOString().slice(0, 10);
}

function calculateDaysFromDates(startDate?: string, endDate?: string): number | undefined {
  if (!startDate || !endDate) return undefined;
  const diff = new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime();
  if (Number.isNaN(diff)) return undefined;
  return Math.max(1, Math.round(diff / 86400000) + 1);
}

function getSearchContext(persistentState?: ContextState | null) {
  const lastSearch = persistentState?.lastSearch;
  const flights = lastSearch?.flightsParams;
  const hotels = lastSearch?.hotelsParams;
  const destination = flights?.destination || hotels?.city;
  const startDate = flights?.departureDate || hotels?.checkinDate;
  const endDate = flights?.returnDate || hotels?.checkoutDate;
  const adults = flights?.adults || hotels?.adults;
  const children = flights?.children ?? hotels?.children;
  const infants = flights?.infants ?? hotels?.infants;

  if (!destination) return null;

  return {
    destination,
    startDate,
    endDate,
    days: calculateDaysFromDates(startDate, endDate),
    travelers: adults ? {
      adults,
      children: children ?? 0,
      infants: infants ?? 0,
    } : undefined,
  };
}

function getPlanQuoteMissingFields(plannerState: TripPlannerState): string[] {
  return [
    !plannerState.origin ? 'ciudad de salida' : null,
    (plannerState.isFlexibleDates || !plannerState.startDate || !plannerState.endDate) ? 'fechas exactas' : null,
  ].filter(Boolean) as string[];
}

/**
 * Canonical slot names for the missing quote fields. Mirrors getPlanQuoteMissingFields
 * 1:1 but emits machine-stable keys for the pending_action.fields contract.
 *
 * Used by the CE layer (messageTurnContext.emitPendingAction) so the model
 * receives canonical names in <pending_action.fields> rather than display
 * strings. The display strings (`'ciudad de salida'`, `'fechas exactas'`)
 * remain in pending_action.prompt for the user-facing response text.
 *
 * Parity note: getPlanQuoteMissingFields collapses the flexible-month case
 * into the same `'fechas exactas'` bucket as exact dates (it asks for exact
 * dates whenever isFlexibleDates is true OR start/end are missing). This
 * function mirrors that exact behavior — it does NOT introduce a new
 * flexible_month/flexible_year slot pair.
 */
function getPlanQuoteMissingSlots(plannerState: TripPlannerState): string[] {
  const slots: string[] = [];
  if (!plannerState.origin) slots.push('origin');
  if (plannerState.isFlexibleDates || !plannerState.startDate || !plannerState.endDate) {
    slots.push('start_date', 'end_date');
  }
  return slots;
}

function buildQuoteRequestFromPlanner(
  message: string,
  parsedRequest: ParsedTravelRequest,
  plannerState: TripPlannerState,
): ParsedTravelRequest | null {
  const missingQuoteFields = getPlanQuoteMissingFields(plannerState);
  if (missingQuoteFields.length > 0) return null;

  const segments = (plannerState.segments || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const firstDestination = segments[0]?.city || plannerState.destinations?.[0];
  if (!plannerState.origin || !firstDestination || !plannerState.startDate || !plannerState.endDate) {
    return null;
  }

  let cursorDate = plannerState.startDate;
  const hotelSegments = segments.length > 0
    ? segments.map((segment, index) => {
        const checkinDate = segment.startDate || cursorDate;
        const checkoutDate =
          segment.endDate ||
          (segment.nights ? addDays(checkinDate, segment.nights) : undefined) ||
          (index === segments.length - 1 ? plannerState.endDate : checkinDate);
        cursorDate = checkoutDate || cursorDate;
        return {
          id: segment.id,
          city: segment.city,
          checkinDate,
          checkoutDate,
          adults: plannerState.travelers.adults,
          children: plannerState.travelers.children,
          infants: plannerState.travelers.infants,
        };
      })
    : undefined;

  return {
    ...parsedRequest,
    requestType: 'combined',
    confidence: Math.max(parsedRequest.confidence || 0, 0.8),
    originalMessage: parsedRequest.originalMessage || message,
    flights: {
      origin: plannerState.origin,
      destination: firstDestination,
      departureDate: plannerState.startDate,
      returnDate: plannerState.endDate,
      adults: plannerState.travelers.adults,
      children: plannerState.travelers.children,
      infants: plannerState.travelers.infants,
    },
    hotels: {
      city: firstDestination,
      checkinDate: plannerState.startDate,
      checkoutDate: plannerState.endDate,
      adults: plannerState.travelers.adults,
      children: plannerState.travelers.children,
      infants: plannerState.travelers.infants,
      ...(hotelSegments?.length ? { segments: hotelSegments } : {}),
    },
  };
}

export function resolveTravelContextBridge(options: {
  message: string;
  parsedRequest: ParsedTravelRequest;
  plannerState?: TripPlannerState | null;
  persistentState?: ContextState | null;
  routeResult?: RouteResult;
}): TravelContextBridgeResolution {
  const { message, parsedRequest, plannerState, persistentState, routeResult } = options;
  const hasActivePlanner = Boolean(plannerState && !plannerState.generationMeta?.isDraft);
  const referencesCurrentContext = QUOTE_CONTEXT_REFERENCE_PATTERN.test(message);

  if (routeResult?.reason === 'quote_active_plan' && hasActivePlanner) {
    return {
      kind: 'plan_to_quote',
      parsedRequest: buildQuoteRequestFromPlanner(message, parsedRequest, plannerState) || parsedRequest,
      reason: 'quote_active_plan',
    };
  }

  const wantsItineraryFromContext =
    referencesCurrentContext &&
    ITINERARY_FROM_CONTEXT_PATTERN.test(message) &&
    !hasActivePlanner;

  if (!wantsItineraryFromContext) {
    return {
      kind: null,
      parsedRequest,
      reason: null,
    };
  }

  const searchContext = getSearchContext(persistentState);
  if (!searchContext) {
    return {
      kind: null,
      parsedRequest,
      reason: null,
    };
  }

  return {
    kind: 'quote_to_plan',
    reason: 'itinerary_from_quote_context',
    parsedRequest: {
      ...parsedRequest,
      requestType: 'itinerary',
      confidence: Math.max(parsedRequest.confidence || 0, 0.7),
      originalMessage: parsedRequest.originalMessage || message,
      itinerary: {
        ...(parsedRequest.itinerary || {}),
        destinations: parsedRequest.itinerary?.destinations?.length
          ? parsedRequest.itinerary.destinations
          : [searchContext.destination],
        startDate: parsedRequest.itinerary?.startDate || searchContext.startDate,
        endDate: parsedRequest.itinerary?.endDate || searchContext.endDate,
        days: parsedRequest.itinerary?.days || searchContext.days,
        travelers: parsedRequest.itinerary?.travelers || searchContext.travelers,
      },
    },
  };
}

export function buildPlanToQuoteResponse(plannerState: TripPlannerState) {
  const segments = (plannerState.segments || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const segmentLabels = segments.length > 0
    ? segments.map((segment) => `${segment.city}${segment.nights ? ` (${segment.nights} noches)` : ''}`)
    : (plannerState.destinations || []);
  const days = plannerState.days || segments.reduce((total, segment) => total + (segment.nights || 0), 0);
  const travelers = plannerState.travelers;
  const travelerLabel = [
    `${travelers?.adults || 1} adulto${(travelers?.adults || 1) === 1 ? '' : 's'}`,
    travelers?.children ? `${travelers.children} menor${travelers.children === 1 ? '' : 'es'}` : null,
    travelers?.infants ? `${travelers.infants} infante${travelers.infants === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(', ');
  const dateLabel = plannerState.isFlexibleDates
    ? (() => {
        const flexibleLabel = plannerState.flexibleMonth
          ? new Date(`${plannerState.flexibleYear || new Date().getFullYear()}-${plannerState.flexibleMonth}-01T00:00:00`)
            .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
          : 'mes flexible';
        return `${flexibleLabel}${days ? ` (${days} días)` : ''}`;
      })()
    : `${plannerState.startDate || 'sin salida'}${plannerState.endDate ? ` al ${plannerState.endDate}` : ''}`;
  const missingQuoteFields = getPlanQuoteMissingFields(plannerState);
  const missingQuoteSlots = getPlanQuoteMissingSlots(plannerState);

  const summary = [
    segmentLabels.length > 0 ? segmentLabels.join(' → ') : 'el plan activo',
    days ? `${days} días` : null,
    travelerLabel,
    dateLabel,
  ].filter(Boolean).join(' · ');

  const response = missingQuoteFields.length > 0
    ? `Tengo el plan activo para cotizar: ${summary}.\n\nPara avanzar con precios reales necesito cerrar: ${missingQuoteFields.join(' y ')}. Con eso puedo buscar vuelos y hoteles sobre este mismo itinerario, sin volver a armar el viaje.`
    : `Tengo el plan activo para cotizar: ${summary}.\n\nYa puedo usar este itinerario como base para buscar vuelos y hoteles, sin volver a armar el viaje.`;

  return {
    response,
    data: {
      messageType: 'quote_active_plan',
      quoteContext: {
        source: 'active_planner',
        title: plannerState.title,
        destinations: plannerState.destinations || [],
        days,
        startDate: plannerState.startDate,
        endDate: plannerState.endDate,
        isFlexibleDates: plannerState.isFlexibleDates,
        flexibleMonth: plannerState.flexibleMonth,
        flexibleYear: plannerState.flexibleYear,
        origin: plannerState.origin || null,
        travelers: plannerState.travelers,
        missingQuoteFields,
        missingQuoteSlots,
        segments: segments.map((segment) => ({
          city: segment.city,
          country: segment.country,
          nights: segment.nights,
          startDate: segment.startDate,
          endDate: segment.endDate,
        })),
      },
    },
  };
}
const FOOD_PATTERN = /\b(restaurantes?|gastronomia|gastronomía|comida|cena|cafes?|cafés)\b/i;
const NEIGHBORHOOD_PATTERN = /\b(barrios?|zonas?)\b/i;

function titleCase(value?: string | null): string {
  if (!value) return '';
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getRequestTypeFromParsed(parsed?: ParsedTravelRequest | null): ParsedTravelRequest['requestType'] | 'general' {
  return parsed?.requestType || 'general';
}

function getKnownDestination(parsed?: ParsedTravelRequest | null): string | undefined {
  if (!parsed) return undefined;
  if (parsed.itinerary?.destinations?.length) return parsed.itinerary.destinations.join(', ');
  if (parsed.hotels?.city) return parsed.hotels.city;
  if (parsed.flights?.destination) return parsed.flights.destination;
  if (parsed.packages?.destination) return parsed.packages.destination;
  return undefined;
}

function getKnownDuration(parsed?: ParsedTravelRequest | null): string | undefined {
  const days = parsed?.itinerary?.days;
  if (!days) return undefined;
  return `${days} día${days !== 1 ? 's' : ''}`;
}

function getKnownTravelers(parsed?: ParsedTravelRequest | null): string | undefined {
  if (!parsed) return undefined;
  const itineraryTravelers = parsed.itinerary?.travelers;
  const adults = itineraryTravelers?.adults ?? parsed.hotels?.adults ?? parsed.flights?.adults;
  const children = itineraryTravelers?.children ?? parsed.hotels?.children ?? parsed.flights?.children ?? 0;
  const infants = itineraryTravelers?.infants ?? parsed.hotels?.infants ?? parsed.flights?.infants ?? 0;
  if (!adults && !children && !infants) return undefined;

  const parts: string[] = [];
  if (adults && adults > 0) parts.push(`${adults} adulto${adults > 1 ? 's' : ''}`);
  if (children && children > 0) parts.push(`${children} niño${children > 1 ? 's' : ''}`);
  if (infants && infants > 0) parts.push(`${infants} bebé${infants > 1 ? 's' : ''}`);
  return parts.join(', ');
}

function normalizeMissingField(field: string): string {
  const normalized = normalizeText(field);
  if (!normalized) return field;
  if (normalized.includes('origin')) return 'origin';
  if (normalized.includes('destino')) return 'destination';
  if (normalized.includes('destination')) return 'destination';
  if (normalized.includes('fecha') || normalized.includes('date')) return 'dates';
  if (normalized.includes('passenger') || normalized.includes('adult') || normalized.includes('traveler') || normalized.includes('cantidad de pasajeros')) return 'passengers';
  if (normalized.includes('duration') || normalized.includes('dias')) return 'duration';
  if (normalized.includes('budget')) return 'budget';
  if (normalized.includes('confirmation')) return 'confirmation';
  return normalized.replace(/\s+/g, '_');
}

function buildKnownContextLead(parsed?: ParsedTravelRequest | null, language: UserLanguage = 'es'): string {
  const requestType = getRequestTypeFromParsed(parsed);
  const destination = getKnownDestination(parsed);
  const duration = getKnownDuration(parsed);
  const travelers = getKnownTravelers(parsed);

  if (language === 'en') {
    if (requestType === 'itinerary' && destination) {
      const detail = [duration, travelers].filter(Boolean).join(' · ');
      return `I already have a base${detail ? ` for ${detail}` : ''} in ${destination}.`;
    }
    if (requestType === 'flights' && destination) return `I already have the flight to ${destination} started.`;
    if (requestType === 'hotels' && destination) return `I already have the stay in ${destination} located.`;
    if (requestType === 'combined' && destination) return `I already have enough to build a trip base to ${destination}.`;
    return 'I already have enough context to guide you well.';
  }

  if (language === 'pt') {
    if (requestType === 'itinerary' && destination) {
      const detail = [duration, travelers].filter(Boolean).join(' · ');
      return `Já tenho uma base${detail ? ` para ${detail}` : ''} em ${destination}.`;
    }
    if (requestType === 'flights' && destination) return `Já tenho encaminhado o voo para ${destination}.`;
    if (requestType === 'hotels' && destination) return `Já tenho localizada a estadia em ${destination}.`;
    if (requestType === 'combined' && destination) return `Já tenho bastante para montar uma base de viagem para ${destination}.`;
    return 'Já tenho contexto suficiente para te orientar bem.';
  }

  if (requestType === 'itinerary' && destination) {
    const detail = [duration, travelers].filter(Boolean).join(' · ');
    return `Ya tengo una base${detail ? ` para ${detail}` : ''} en ${destination}.`;
  }

  if (requestType === 'flights' && destination) {
    return `Ya tengo encaminado el vuelo a ${destination}.`;
  }

  if (requestType === 'hotels' && destination) {
    return `Ya tengo ubicada la estadía en ${destination}.`;
  }

  if (requestType === 'combined' && destination) {
    return `Ya tengo bastante para trabajarte una base de viaje a ${destination}.`;
  }

  return 'Ya tengo bastante contexto para orientarte bien.';
}

function buildAskLine(requestType: ParsedTravelRequest['requestType'] | 'general', fields: string[], language: UserLanguage = 'es'): string {
  const has = (field: string) => fields.includes(field);

  if (language === 'en') {
    if (has('origin') && has('dates')) return 'To close a concrete proposal, tell me the departure city and the travel dates.';
    if (has('passengers') && has('dates')) return requestType === 'itinerary'
      ? 'To finish shaping the proposal, tell me how many people are traveling and when you would like to go.'
      : 'To show concrete options, tell me how many people are traveling and the dates.';
    if (has('origin')) return 'To move forward with a concrete proposal, tell me the departure city.';
    if (has('dates')) return requestType === 'itinerary'
      ? 'To build the proposal properly, tell me when you would like to travel.'
      : 'To refine the search, tell me the exact dates you want to use.';
    if (has('passengers')) return 'To adjust it properly, tell me how many people are traveling in total and whether there are children.';
    if (has('budget')) return 'Tell me the budget range you would like to stay within and I will curate the proposal better.';
    if (has('destination')) return 'Tell me which destination or city combination you want to prioritize and I will move it forward.';
    return 'Send me one more key detail and I will keep closing it.';
  }

  if (language === 'pt') {
    if (has('origin') && has('dates')) return 'Para fechar uma proposta concreta, me diga de qual cidade saem e em quais datas querem viajar.';
    if (has('passengers') && has('dates')) return requestType === 'itinerary'
      ? 'Para terminar de ajustar a proposta, me diga quantas pessoas viajam e em quais datas gostariam de ir.'
      : 'Para mostrar opções concretas, me diga quantas pessoas viajam e em quais datas.';
    if (has('origin')) return 'Para avançar com uma proposta concreta, me diga de qual cidade saem.';
    if (has('dates')) return requestType === 'itinerary'
      ? 'Para montar bem a proposta, me diga em quais datas gostaria de viajar.'
      : 'Para refinar a busca, me diga as datas exatas que quer usar.';
    if (has('passengers')) return 'Para ajustar bem, me diga quantas pessoas viajam no total e se há crianças.';
    if (has('budget')) return 'Me diga a faixa de orçamento em que gostaria de se mover e eu curo melhor a proposta.';
    if (has('destination')) return 'Me diga qual destino ou combinação de cidades quer priorizar e eu encaminho.';
    return 'Me envie mais um dado importante e continuo fechando isso.';
  }

  if (has('origin') && has('dates')) {
    return 'Para cerrarte una propuesta concreta, decime desde qué ciudad salen y en qué fechas quieren viajar.';
  }
  if (has('passengers') && has('dates')) {
    return requestType === 'itinerary'
      ? 'Para terminar de acomodarte la propuesta, decime cuántos viajan y en qué fechas les gustaría ir.'
      : 'Para dejarte opciones concretas, decime cuántos viajan y en qué fechas quieren hacerlo.';
  }
  if (has('origin')) return 'Para avanzar con una propuesta concreta, decime desde qué ciudad salen.';
  if (has('dates')) {
    return requestType === 'itinerary'
      ? 'Para dejarte la propuesta bien armada, decime en qué fechas te gustaría viajar.'
      : 'Para afinarte la búsqueda, decime las fechas exactas que querés usar.';
  }
  if (has('passengers')) return 'Para ajustarlo bien, decime cuántos viajan en total y si hay chicos.';
  if (has('budget')) return 'Si querés, decime en qué rango de presupuesto te gustaría moverte y te curó mejor la propuesta.';
  if (has('destination')) return 'Decime qué destino o combinación de ciudades querés priorizar y te lo encamino.';
  return 'Decime un dato clave más y te lo sigo cerrando.';
}

// PR 3 (C4): builds the body copy for a mode_bridge turn. Direction-specific,
// no runtime interpolation of the mode label (avoids awkward translations like
// "in Quote mode"). Consumer resolves the translation function via
// react-i18next; the pure-function shape here makes it testable without the
// i18n singleton.
export function buildModeBridgeMessage(options: {
  suggestedMode: 'agency' | 'passenger';
  t: (key: string) => string;
}): string {
  const { suggestedMode, t } = options;
  const key =
    suggestedMode === 'agency'
      ? 'mode.bridgeTitle.toAgency'
      : 'mode.bridgeTitle.toPassenger';
  return t(key);
}

export function buildConversationalMissingInfoMessage(options: {
  parsedRequest?: ParsedTravelRequest | null;
  missingFields?: string[];
  fallbackMessage?: string;
  language?: UserLanguage;
}): string {
  const { parsedRequest, missingFields = [], fallbackMessage, language = 'es' } = options;
  const requestType = getRequestTypeFromParsed(parsedRequest);
  const normalizedFields = [...new Set(missingFields.map(normalizeMissingField))].slice(0, 2);

  if (requestType === 'itinerary' && normalizedFields.includes('dates') && fallbackMessage) {
    return fallbackMessage;
  }

  if (normalizedFields.length === 0) {
    if (fallbackMessage) return fallbackMessage;
    if (language === 'en') return 'Send me one more key detail and I will make the proposal more concrete.';
    if (language === 'pt') return 'Me envie mais um dado importante e deixo a proposta mais concreta.';
    return 'Contame un dato clave más y te dejo una propuesta más concreta.';
  }

  const lead = buildKnownContextLead(parsedRequest, language);
  const askLine = buildAskLine(requestType, normalizedFields, language);

  return `${lead} ${askLine}`;
}

function pushPlace(
  places: ChatRecommendedPlace[],
  seen: Set<string>,
  input: ChatRecommendedPlace,
) {
  const key = `${normalizeText(input.city)}::${normalizeText(input.name)}`;
  if (!input.name || seen.has(key)) return;
  seen.add(key);
  places.push(input);
}

function activityToPlace(city: string, activity: PlannerActivity, slot: 'morning' | 'afternoon' | 'evening'): ChatRecommendedPlace | null {
  if (!activity?.title) return null;
  if (isGenericPlaceholder(activity.title)) return null;
  return {
    name: activity.title,
    description: activity.description || activity.tip,
    category: activity.category || activity.activityType || 'Actividad',
    city,
    suggestedSlot: slot,
    photoUrl: activity.photoUrls?.find(Boolean),
  };
}

function restaurantToPlace(city: string, restaurant: PlannerRestaurant): ChatRecommendedPlace | null {
  if (!restaurant?.name) return null;
  if (isGenericPlaceholder(restaurant.name)) return null;
  return {
    name: restaurant.name,
    description: restaurant.type ? `${restaurant.type}${restaurant.priceRange ? ` · ${restaurant.priceRange}` : ''}` : restaurant.priceRange,
    category: 'Gastronomía',
    city,
    suggestedSlot: 'evening',
    photoUrl: restaurant.photoUrls?.find(Boolean),
  };
}

export function extractRecommendedPlacesFromMeta(meta?: Record<string, unknown> | null): ChatRecommendedPlace[] {
  if (!meta) return [];

  const discoveryPlaces = Array.isArray((meta as any).discoveryContext?.places)
    ? (((meta as any).discoveryContext.places as Array<ChatRecommendedPlace>).slice(0, 6))
    : [];
  if (discoveryPlaces.length > 0) {
    return discoveryPlaces;
  }

  const places: ChatRecommendedPlace[] = [];
  const seen = new Set<string>();

  const rawRecommended = Array.isArray(meta.recommendedPlaces)
    ? (meta.recommendedPlaces as Array<Record<string, unknown>>)
    : [];

  rawRecommended.forEach((place) => {
    pushPlace(places, seen, {
      name: String(place.name || ''),
      description: typeof place.description === 'string' ? place.description : undefined,
      category: titleCase(String(place.category || 'Lugar recomendado')),
      city: String(place.segmentCity || place.city || ''),
      suggestedSlot: (place.suggestedSlot as 'morning' | 'afternoon' | 'evening' | undefined),
      photoUrl: typeof place.photoUrl === 'string' ? place.photoUrl : undefined,
    });
  });

  const plannerData = meta.plannerData as TripPlannerState | undefined;
  if (plannerData?.segments?.length) {
    plannerData.segments.forEach((segment) => {
      segment.days.forEach((day) => {
        day.morning.forEach((activity) => {
          const place = activityToPlace(segment.city, activity, 'morning');
          if (place) pushPlace(places, seen, place);
        });
        day.afternoon.forEach((activity) => {
          const place = activityToPlace(segment.city, activity, 'afternoon');
          if (place) pushPlace(places, seen, place);
        });
        day.evening.forEach((activity) => {
          const place = activityToPlace(segment.city, activity, 'evening');
          if (place) pushPlace(places, seen, place);
        });
        day.restaurants.forEach((restaurant) => {
          const place = restaurantToPlace(segment.city, restaurant);
          if (place) pushPlace(places, seen, place);
        });
      });
    });
  }

  return places.slice(0, 6);
}

export function getDiscoveryVisualConfig(requestText: string, city?: string): DiscoveryVisualConfig {
  const place = city || 'ese destino';
  if (SPECIALIZED_CULTURE_PATTERN.test(requestText)) {
    return {
      title: `Museos y cultura en ${place}`,
      subtitle: 'Arrancá por lo más representativo antes de ir a lugares más nicho.',
      primaryCtaLabel: 'Ordenarlo por días',
      secondaryCtaLabel: 'Ver más',
    };
  }
  return {
    title: `Imperdibles en ${place}`,
    subtitle: `Lugares clave para arrancar bien en ${place}.`,
    primaryCtaLabel: 'Guardar imperdible',
    secondaryCtaLabel: 'Ver más',
  };
}

function buildDiscoveryHeading(requestText: string, city: string): string {
  if (SPECIALIZED_CULTURE_PATTERN.test(requestText)) {
    return `Si querés foco en cultura en ${city}, yo arrancaría por estos lugares:`;
  }
  if (FOOD_PATTERN.test(requestText)) {
    return `Para disfrutar ${city} desde lo gastronómico, te recomendaría empezar por acá:`;
  }
  if (NEIGHBORHOOD_PATTERN.test(requestText)) {
    return `Para entender bien el espíritu de ${city}, estas zonas valen mucho la pena:`;
  }
  return `Para ${city}, estos son los lugares que más vale la pena priorizar:`;
}

export function formatDiscoveryResponse(options: {
  city?: string;
  requestText: string;
  places: ChatRecommendedPlace[];
}): string {
  const city = options.city || 'ese destino';
  const finalPlaces = options.places.slice(0, 6);

  if (finalPlaces.length === 0) {
    return `Para ${city}, te dejo una base clara de imperdibles, barrios y algún museo fuerte apenas tenga mejores candidatos del destino.`;
  }

  const lines = finalPlaces.slice(0, 6).map((place) => `- ${place.name} — ${place.description || place.category}`);
  const hasDays = /\b(1|2|3|4|5|6|7|8|9|10)\s+dias?\b/i.test(options.requestText);
  const cta = hasDays
    ? `Si querés, te los ordeno en un recorrido por días para aprovechar mejor ${city}.`
    : `Si querés, te los agrupo por imperdibles, museos, barrios o te digo en qué zona conviene alojarte cerca.`;

  return `${buildDiscoveryHeading(options.requestText, city)}\n${lines.join('\n')}\n${cta}`;
}

function hasHotelCoverage(segment: TripPlannerState['segments'][number]): boolean {
  const hotelPlan = segment.hotelPlan;
  return Boolean(
    hotelPlan?.confirmedInventoryHotel
    || hotelPlan?.selectedPlaceCandidate
    || (hotelPlan?.hotelRecommendations?.length ?? 0) > 0
    || ['matched', 'quoted', 'needs_confirmation'].includes(hotelPlan?.matchStatus || '')
  );
}

function hasTransportCoverage(transport: TripPlannerState['segments'][number]['transportIn'] | TripPlannerState['segments'][number]['transportOut']): boolean {
  return Boolean(
    transport
    && (
      transport.selectedOptionId
      || (transport.options?.length ?? 0) > 0
      || transport.searchStatus === 'ready'
    )
  );
}

function joinCities(cities: string[]): string {
  if (cities.length === 0) return '';
  if (cities.length === 1) return cities[0];
  if (cities.length === 2) return `${cities[0]} y ${cities[1]}`;
  return `${cities.slice(0, -1).join(', ')} y ${cities[cities.length - 1]}`;
}

export function deriveConversationGaps(meta?: Record<string, unknown> | null): ConversationGap[] {
  if (!meta) return [];
  const conversationTurn = meta.conversationTurn as ConversationTurnResolution | undefined;
  if (conversationTurn?.responseMode === 'show_places') return [];

  const gaps: ConversationGap[] = [];
  const plannerData = meta.plannerData as TripPlannerState | undefined;

  if (plannerData?.segments?.length) {
    const hotelCities = plannerData.segments
      .filter((segment) => !hasHotelCoverage(segment))
      .map((segment) => segment.city);
    if (hotelCities.length > 0) {
      gaps.push({
        key: 'hotels',
        label: `Hoteles por definir en ${joinCities(hotelCities)}`,
      });
    }

    const inboundCities = plannerData.segments
      .filter((segment, index) => (index > 0 || Boolean(plannerData.origin)) && !hasTransportCoverage(segment.transportIn))
      .map((segment) => segment.city);
    if (inboundCities.length > 0) {
      gaps.push({
        key: 'flights',
        label: `Vuelos o traslados por definir para ${joinCities(inboundCities)}`,
      });
    }

    const lastSegment = plannerData.segments[plannerData.segments.length - 1];
    if (plannerData.origin && lastSegment && !hasTransportCoverage(lastSegment.transportOut)) {
      gaps.push({
        key: 'return_flight',
        label: `Regreso a ${plannerData.origin} todavía sin cerrar`,
      });
    }

    if (!plannerData.isFlexibleDates && (!plannerData.startDate || !plannerData.endDate)) {
      gaps.push({
        key: 'dates',
        label: 'Falta definir las fechas exactas del viaje',
      });
    }

    return gaps;
  }

  const combinedData = meta.combinedData as { flights?: unknown[]; hotels?: unknown[] } | undefined;
  const flightsCount = combinedData?.flights?.length ?? 0;
  const hotelsCount = combinedData?.hotels?.length ?? 0;
  if (flightsCount > 0 && hotelsCount === 0) {
    gaps.push({ key: 'hotels', label: 'Todavía falta sumar la base de hoteles' });
  }
  if (hotelsCount > 0 && flightsCount === 0) {
    gaps.push({ key: 'flights', label: 'Todavía falta cerrar la parte aérea' });
  }

  return gaps;
}

export function resolveConversationTurn(options: {
  parsedRequest: ParsedTravelRequest;
  routeResult: RouteResult;
  plannerState?: { generationMeta?: { isDraft?: boolean } } | null;
  hasPersistentContext: boolean;
  hasPreviousParsedRequest: boolean;
  recentCollectCount: number;
  maxCollectTurns: number;
  // PR 3 (C8 — Phase 5): `mode` is REQUIRED. The legacy fallthrough branch
  // that ran when `mode === undefined` has been deleted; strict
  // agency/passenger routing is the only path. Discovery intent
  // (`isDiscoveryIntent`) is handled explicitly inside this function as a
  // dedicated branch — it still resolves to `standard_itinerary` with
  // `responseMode='show_places'` regardless of mode (the show_places flow is
  // mode-agnostic). Callers that historically passed `undefined` (consumer /
  // B2C) must now choose a mode at the call site.
  mode: 'agency' | 'passenger';
  // PR 3 (C3): anti-loop guardrails for the mode_bridge branch. When the
  // previous turn was itself a bridge, OR when the caller signals the user
  // explicitly chose to stay in the current mode (via the "seguir" chip
  // from C4), the orchestrator suppresses bridge emission and falls to the
  // mode's default branch.
  previousMessageType?: string;
  forceCurrentMode?: boolean;
  /**
   * Phase 5 (Context Engineering): when EmiliaState carries a non-null
   * `pending_action`, the assistant is awaiting user input on a prior prompt
   * (slot fill, confirmation, etc.). We must NOT bounce them to mode_bridge
   * — that would interrupt the in-flight ask. Generic guardrail: any kind of
   * pending_action with an active planner suppresses the bridge.
   */
  hasPendingAction?: boolean;
}): ConversationTurnResolution {
  const {
    parsedRequest,
    routeResult,
    plannerState,
    hasPersistentContext,
    hasPreviousParsedRequest,
    recentCollectCount,
    maxCollectTurns,
    mode,
    previousMessageType,
    forceCurrentMode,
    hasPendingAction,
  } = options;

  const hasActivePlanner = Boolean(plannerState && !plannerState.generationMeta?.isDraft);
  // Discovery intent is now driven exclusively by the LLM `discover_places`
  // tool result (surfaced as `placeDiscoveryResult` on the parser response).
  // The legacy regex fallback and unused `placeDiscovery` parser field were
  // removed alongside the client-side `buildDiscoveryResponsePayload` path.
  const isDiscoveryIntent = Boolean(parsedRequest.placeDiscoveryResult?.ok);
  const isQuoteFromActivePlanner = routeResult.reason === 'quote_active_plan';
  const normalizedMissingFields = [...new Set(routeResult.missingFields.map(normalizeMissingField))];
  const collectExhausted = recentCollectCount >= maxCollectTurns;

  const shouldAskMinimalQuestion =
    routeResult.route === 'COLLECT' &&
    Boolean(routeResult.collectQuestion) &&
    !collectExhausted &&
    (
      normalizedMissingFields.includes('passengers') ||
      (routeResult.reason === 'quote_intent_incomplete' && !hasPreviousParsedRequest && !hasPersistentContext)
    );

  // === STRICT MODE (PR 3 / C3 + C7.1.e partial revert + C8 closure) =========
  // `mode` is required. Agency emits `standard_search` or `ask_minimal`;
  // passenger emits `standard_itinerary` or `ask_minimal`. A `mode_bridge`
  // branch nudges the user to switch modes when intent doesn't match the
  // active mode.
  //
  // C7.1.e history: passenger originally emitted `planner_agent` per the
  // ADR-002 strict contract, but empirically that branch never produced a
  // structured CanonicalItineraryResult and the right-side planner panel
  // did not hydrate. Passenger was rerouted to `standard_itinerary`. PR 4
  // deleted the `planner_agent` branch, handler, and edge function; see
  // ADR-002 addendum 2026-04-18.
  //
  // DISCOVERY (C8): handled as a dedicated explicit branch BEFORE the
  // strict-mode bridge logic. The legacy fallthrough that previously served
  // discovery has been removed. Discovery resolves to `standard_itinerary`
  // with `responseMode='show_places'` and `messageType='discovery_results'`,
  // mode-agnostic — the existing show_places flow in useMessageHandler's
  // requestType='itinerary' case dispatches off `standard_itinerary`.
  //
  // BRIDGE RULES:
  //   - agency → passenger  when (requestType==='itinerary' || route==='PLAN'),
  //     except `quote_active_plan`: the router owns the "quote the current
  //     plan" intent, so agency mode can price/search against that planner
  //     context instead of bouncing back to passenger mode.
  //   - passenger → agency  when route==='QUOTE' && requestType in
  //     {flights, hotels, combined} && !hasActivePlanner. With an active
  //     planner the QUOTE turn is contextually grounded in the plan; it
  //     stays on standard_itinerary (quote-in-plan-context). The
  //     useMessageHandler switch dispatches by requestType, so flights/
  //     hotels/combined QUOTEs with active planner run their respective
  //     search handlers even though the label is `standard_itinerary`.
  //
  // GUARDRAILS:
  //   G1 — `previousMessageType === 'mode_bridge'`: previous turn already
  //     nudged the user; a second consecutive bridge would loop.
  //   G2 — `forceCurrentMode === true`: the user clicked "seguir en este
  //     modo" on the bridge chip; we must respect that choice.
  //   G3 — pending_action with active planner: the assistant is mid-ask
  //     (slot fill / confirmation), bouncing modes would interrupt.
  //   G4 — `previousMessageType === 'quote_active_plan'`: the previous turn
  //     opened a quote flow against the active plan; the user's current
  //     message is the slot fill answer, regardless of what the parser made
  //     of it.
  //
  // HANDLER NOTE: the `standard_itinerary` branch dispatches through
  // `useMessageHandler`'s `switch (parsedRequest.requestType)` — for
  // `requestType==='itinerary'` it calls `handleItineraryRequest` wrapped by
  // `buildCanonicalResultFromStandard`. No draft bootstrap is required; the
  // handler tolerates `!hasActivePlanner` as the consumer flow already
  // demonstrates.

  // Discovery intent: explicit, mode-agnostic branch. Returns before any
  // strict-mode bridge logic runs so "qué ver en Roma" never trips the
  // agency→passenger bridge nor depends on a deleted legacy fallthrough.
  if (isDiscoveryIntent) {
    return {
      executionBranch: 'standard_itinerary',
      responseMode: 'show_places',
      normalizedMissingFields,
      messageType: 'discovery_results',
      shouldUseStandardItinerary: true,
      shouldAskMinimalQuestion: false,
      uiMeta: {
        route: routeResult.route,
        reason: routeResult.reason,
        firstPlanHandledAs: routeResult.route === 'PLAN' && !hasActivePlanner ? 'standard_itinerary' : null,
      },
    };
  }

  // Bridge guard composition (most → least specific):
  //   G1 — anti-loop: previous turn was already a bridge.
  //   G2 — explicit user choice: clicked "seguir en este modo".
  //   G3 — pending_action with active planner: the assistant is mid-ask
  //        (slot fill / confirmation), bouncing modes would interrupt.
  //   G4 — quote_active_plan messageType: the previous turn opened a quote
  //        flow against the active plan; the user's current message is the
  //        slot fill answer, regardless of what the parser made of it.
  //   G5 — high-confidence explicit itinerary intent: the user asked for a
  //        trip in plain language with clear keywords ("armame un viaje",
  //        "planifica", "itinerario"). Bouncing them to passenger mode forces
  //        a useless extra turn before producing the requested plan. The
  //        standard_itinerary branch handles agency-mode itineraries fine
  //        (handleItineraryRequest tolerates !hasActivePlanner).
  const isHighConfidenceExplicitItinerary =
    parsedRequest.requestType === 'itinerary' &&
    parsedRequest.confidence >= 0.85 &&
    PLAN_INTENT.test(parsedRequest.originalMessage || '');

  const bridgeBlocked =
    previousMessageType === 'mode_bridge' ||
    forceCurrentMode === true ||
    previousMessageType === 'quote_active_plan' ||
    Boolean(hasPendingAction && hasActivePlanner) ||
    isHighConfidenceExplicitItinerary;

  let bridgeTarget: 'agency' | 'passenger' | null = null;
  if (!bridgeBlocked) {
    if (
      mode === 'agency' &&
      !isQuoteFromActivePlanner &&
      (parsedRequest.requestType === 'itinerary' || routeResult.route === 'PLAN')
    ) {
      bridgeTarget = 'passenger';
    } else if (
      mode === 'passenger' &&
      routeResult.route === 'QUOTE' &&
      (parsedRequest.requestType === 'flights' ||
        parsedRequest.requestType === 'hotels' ||
        parsedRequest.requestType === 'combined') &&
      !hasActivePlanner
    ) {
      bridgeTarget = 'agency';
    }
  }

  if (bridgeTarget) {
    return {
      executionBranch: 'mode_bridge',
      responseMode: 'needs_mode_switch',
      normalizedMissingFields,
      messageType: 'mode_bridge',
      shouldUseStandardItinerary: false,
      shouldAskMinimalQuestion: false,
      uiMeta: {
        route: routeResult.route,
        reason: routeResult.reason,
        firstPlanHandledAs: null,
        suggestedMode: bridgeTarget,
      },
    };
  }

  if (shouldAskMinimalQuestion) {
    return {
      executionBranch: 'ask_minimal',
      responseMode: 'needs_input',
      normalizedMissingFields,
      messageType: 'collect_question',
      shouldUseStandardItinerary: false,
      shouldAskMinimalQuestion: true,
      uiMeta: {
        route: routeResult.route,
        reason: routeResult.reason,
        firstPlanHandledAs: null,
      },
    };
  }

  if (mode === 'passenger') {
    return {
      executionBranch: 'standard_itinerary',
      responseMode: 'proposal_first_plan',
      normalizedMissingFields,
      messageType: 'trip_planner',
      shouldUseStandardItinerary: true,
      shouldAskMinimalQuestion: false,
      uiMeta: {
        route: routeResult.route,
        reason: routeResult.reason,
        firstPlanHandledAs: !hasActivePlanner ? 'standard_itinerary' : null,
      },
    };
  }

  // mode === 'agency', default branch.
  return {
    executionBranch: 'standard_search',
    responseMode: routeResult.route === 'QUOTE' ? 'quote_or_search' : 'standard',
    normalizedMissingFields,
    messageType: parsedRequest.requestType === 'general' ? 'general_response' : 'search_results',
    shouldUseStandardItinerary: false,
    shouldAskMinimalQuestion: false,
    uiMeta: {
      route: routeResult.route,
      reason: routeResult.reason,
      firstPlanHandledAs: null,
    },
  };
}
