import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { TripPlannerState, PlannerActivity, PlannerRestaurant } from '@/features/trip-planner/types';
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
  | 'planner_agent'
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
  shouldUsePlannerAgent: boolean;
  shouldUseStandardItinerary: boolean;
  shouldAskMinimalQuestion: boolean;
  uiMeta: {
    route: RouteResult['route'];
    reason: string;
    firstPlanHandledAs: 'planner_agent' | 'standard_itinerary' | null;
    // PR 3 (C3): populated only for `mode_bridge` turns. Tells the UI which
    // mode to offer switching to in the bridge action chip (C4).
    suggestedMode?: 'agency' | 'passenger';
  };
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

const DISCOVERY_PATTERN = /\b(cosas\s+para\s+hacer|que\s+ver|qué\s+ver|que\s+hacer|qué\s+hacer|imperdibles?|museos?|barrios?|restaurantes?|actividades?)\b/i;
const SPECIALIZED_CULTURE_PATTERN = /\b(museos?|arte|galerias?|galerías|arquitectura|historia)\b/i;
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

function buildKnownContextLead(parsed?: ParsedTravelRequest | null): string {
  const requestType = getRequestTypeFromParsed(parsed);
  const destination = getKnownDestination(parsed);
  const duration = getKnownDuration(parsed);
  const travelers = getKnownTravelers(parsed);

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

function buildAskLine(requestType: ParsedTravelRequest['requestType'] | 'general', fields: string[]): string {
  const has = (field: string) => fields.includes(field);

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
}): string {
  const { parsedRequest, missingFields = [], fallbackMessage } = options;
  const requestType = getRequestTypeFromParsed(parsedRequest);
  const normalizedFields = [...new Set(missingFields.map(normalizeMissingField))].slice(0, 2);

  if (requestType === 'itinerary' && normalizedFields.includes('dates') && fallbackMessage) {
    return fallbackMessage;
  }

  if (normalizedFields.length === 0) {
    return fallbackMessage || 'Contame un dato clave más y te dejo una propuesta más concreta.';
  }

  const lead = buildKnownContextLead(parsedRequest);
  const askLine = buildAskLine(requestType, normalizedFields);

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
  // PR 3 (C1): mode param reserved. When undefined, legacy routing runs
  // unchanged (including the standard_itinerary branch). C3 wires strict
  // agency/passenger routing when defined. C8 makes it required and removes
  // the legacy branch.
  mode?: 'agency' | 'passenger';
  // PR 3 (C3): anti-loop guardrails for the mode_bridge branch. When the
  // previous turn was itself a bridge, OR when the caller signals the user
  // explicitly chose to stay in the current mode (via the "seguir" chip
  // from C4), the orchestrator suppresses bridge emission and falls to the
  // mode's default branch.
  previousMessageType?: string;
  forceCurrentMode?: boolean;
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
  } = options;

  const hasActivePlanner = Boolean(plannerState && !plannerState.generationMeta?.isDraft);
  const isDiscoveryIntent = DISCOVERY_PATTERN.test(parsedRequest.originalMessage || '');
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

  // === STRICT MODE (PR 3 / C3) ==============================================
  // When `mode !== undefined`, apply the ADR-002 strict agency/passenger
  // routing: agency emits only `standard_search` or `ask_minimal`; passenger
  // emits only `planner_agent` or `ask_minimal`. A new `mode_bridge` branch
  // nudges the user to switch modes when intent doesn't match the active
  // mode.
  //
  // DISCOVERY BYPASS (carryover to C8): `isDiscoveryIntent` intentionally
  // falls through to the legacy path below. Discovery is orthogonal to the
  // QUOTE/PLAN/COLLECT intent axis the strict contract is about, and the
  // existing show_places flow (`buildDiscoveryResponsePayload` in
  // useMessageHandler's requestType='itinerary' case) is dispatched off the
  // legacy `standard_itinerary` branch with responseMode='show_places'. When
  // C8 removes `standard_itinerary`, discovery MUST get a dedicated branch
  // (e.g. 'discovery') OR the show_places path must be preserved under a
  // renamed branch. Do not ship C8 without resolving this.
  //
  // BRIDGE RULES:
  //   - agency → passenger  when (requestType==='itinerary' || route==='PLAN').
  //     No active-planner refinement: an active plan is itself a
  //     passenger-mode artifact, so bridging an itinerary-intent turn is
  //     always appropriate in agency.
  //   - passenger → agency  when route==='QUOTE' && requestType in
  //     {flights, hotels, combined} && !hasActivePlanner. With an active
  //     planner the QUOTE turn is contextually grounded in the plan; it
  //     stays on planner_agent (quote-in-plan-context). This refinement
  //     preserves the D14 #1 spec naturally.
  //
  // GUARDRAILS:
  //   G1 — `previousMessageType === 'mode_bridge'`: previous turn already
  //     nudged the user; a second consecutive bridge would loop.
  //   G2 — `forceCurrentMode === true`: the user clicked "seguir en este
  //     modo" on the bridge chip; we must respect that choice.
  //
  // HANDLER NOTE (removed when C4/C5 lands):
  //   Passenger emits `planner_agent` even when `!hasActivePlanner`
  //   (e.g. "armame Italia" with no draft yet). `useMessageHandler`
  //   currently assumes the planner_agent branch has an active planner;
  //   C4/C5 must add the draft-bootstrap path. Until then no call site
  //   passes `mode`, so this branch is only exercised by tests.
  if (mode !== undefined && !isDiscoveryIntent) {
    const bridgeBlocked = previousMessageType === 'mode_bridge' || forceCurrentMode === true;

    let bridgeTarget: 'agency' | 'passenger' | null = null;
    if (!bridgeBlocked) {
      if (
        mode === 'agency' &&
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
        shouldUsePlannerAgent: false,
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
        shouldUsePlannerAgent: false,
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
        executionBranch: 'planner_agent',
        responseMode: 'proposal_first_plan',
        normalizedMissingFields,
        messageType: 'trip_planner',
        shouldUsePlannerAgent: true,
        shouldUseStandardItinerary: false,
        shouldAskMinimalQuestion: false,
        uiMeta: {
          route: routeResult.route,
          reason: routeResult.reason,
          firstPlanHandledAs: !hasActivePlanner ? 'planner_agent' : null,
        },
      };
    }

    // mode === 'agency', default branch.
    return {
      executionBranch: 'standard_search',
      responseMode: routeResult.route === 'QUOTE' ? 'quote_or_search' : 'standard',
      normalizedMissingFields,
      messageType: parsedRequest.requestType === 'general' ? 'general_response' : 'search_results',
      shouldUsePlannerAgent: false,
      shouldUseStandardItinerary: false,
      shouldAskMinimalQuestion: false,
      uiMeta: {
        route: routeResult.route,
        reason: routeResult.reason,
        firstPlanHandledAs: null,
      },
    };
  }

  // === LEGACY PATH (mode === undefined OR discovery intent) =================
  // Preserved unchanged from pre-C3. C8 removes this path along with the
  // `standard_itinerary` branch (see DISCOVERY BYPASS note above — discovery
  // needs its own branch before this path can go).

  const shouldUsePlannerAgent = routeResult.route === 'PLAN' && hasActivePlanner && !isDiscoveryIntent;

  const shouldUseStandardItinerary =
    !shouldUsePlannerAgent &&
    (parsedRequest.requestType === 'itinerary' || routeResult.route === 'PLAN');

  if (shouldUsePlannerAgent) {
    return {
      executionBranch: 'planner_agent',
      responseMode: isDiscoveryIntent ? 'show_places' : 'proposal_first_plan',
      normalizedMissingFields,
      messageType: isDiscoveryIntent ? 'discovery_results' : 'trip_planner',
      shouldUsePlannerAgent,
      shouldUseStandardItinerary: false,
      shouldAskMinimalQuestion: false,
      uiMeta: {
        route: routeResult.route,
        reason: routeResult.reason,
        firstPlanHandledAs: null,
      },
    };
  }

  if (shouldAskMinimalQuestion) {
    return {
      executionBranch: 'ask_minimal',
      responseMode: 'needs_input',
      normalizedMissingFields,
      messageType: 'collect_question',
      shouldUsePlannerAgent: false,
      shouldUseStandardItinerary: false,
      shouldAskMinimalQuestion: true,
      uiMeta: {
        route: routeResult.route,
        reason: routeResult.reason,
        firstPlanHandledAs: null,
      },
    };
  }

  if (shouldUseStandardItinerary) {
    return {
      executionBranch: 'standard_itinerary',
      responseMode: isDiscoveryIntent ? 'show_places' : routeResult.route === 'PLAN' ? 'proposal_first_plan' : 'standard',
      normalizedMissingFields,
      messageType: isDiscoveryIntent ? 'discovery_results' : 'trip_planner',
      shouldUsePlannerAgent: false,
      shouldUseStandardItinerary: true,
      shouldAskMinimalQuestion: false,
      uiMeta: {
        route: routeResult.route,
        reason: routeResult.reason,
        firstPlanHandledAs: routeResult.route === 'PLAN' && !hasActivePlanner ? 'standard_itinerary' : null,
      },
    };
  }

  return {
    executionBranch: 'standard_search',
    responseMode: routeResult.route === 'QUOTE' ? 'quote_or_search' : 'standard',
    normalizedMissingFields,
    messageType: parsedRequest.requestType === 'general' ? 'general_response' : 'search_results',
    shouldUsePlannerAgent: false,
    shouldUseStandardItinerary: false,
    shouldAskMinimalQuestion: false,
    uiMeta: {
      route: routeResult.route,
      reason: routeResult.reason,
      firstPlanHandledAs: null,
    },
  };
}
