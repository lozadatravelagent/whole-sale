/**
 * Canonical itinerary pipeline — shared by standard_itinerary and planner_agent branches.
 *
 * Both branches must produce a CanonicalItineraryResult before persisting or rendering.
 * This eliminates divergence in meta shape, recommended places, and persistence logic.
 */

import type { TripPlannerState, PlannerSegment } from '@/features/trip-planner/types';
import type { PlannerEditorialData, BuildEditorialOptions } from '@/features/trip-planner/editorial';
import type { ConversationTurnResolution, ConversationResponseMode, ChatRecommendedPlace } from './conversationOrchestrator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanonicalItineraryResult {
  response: string;
  plannerData: TripPlannerState | null;
  flights: unknown[];
  hotels: unknown[];
  recommendedPlaces: ChatRecommendedPlace[];
  responseMode: ConversationResponseMode;
  conversationTurn: ConversationTurnResolution;
  source: 'AI_PARSER + EUROVIPS' | 'planner-agent';
  emiliaRoute?: { route: string; score: number; reason: string; inferredFields: string[] };
  requestText?: string;
  actionChips?: Array<{ label: string; message: string }>;
  itineraryData?: unknown;
  agentInjectData?: {
    flightSearchParams?: Record<string, unknown>;
    hotelSearchParams?: Record<string, unknown>;
    action?: string;
  } | null;
  editorial?: PlannerEditorialData | null;
}

// ---------------------------------------------------------------------------
// Generic placeholder filter (shared with backend generateItinerary.ts)
// ---------------------------------------------------------------------------

const GENERIC_PLACE_PREFIXES = [
  'paseo por', 'recorrido por', 'caminata por', 'visita por',
  'cena en zona', 'cena tranquila', 'almuerzo en zona', 'desayuno en el hotel',
  'comida en zona', 'tarde libre', 'mañana libre', 'día libre', 'tiempo libre',
  'traslado a', 'traslado al', 'traslado desde',
  'check-in', 'check-out', 'llegada a', 'salida de',
  'descanso en', 'relax en', 'noche en el hotel', 'noche libre',
  'walking tour of', 'stroll through', 'walk around',
  'local dinner', 'dinner at a', 'lunch at a', 'breakfast at the',
  'cultural visit', 'free time', 'free afternoon', 'free morning',
  'transfer to', 'arrival at', 'departure from', 'rest at hotel',
];

export function isGenericPlaceholder(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  if (normalized.length < 4) return true;
  return GENERIC_PLACE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function titleCase(value?: string | null): string {
  if (!value) return '';
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function extractRawPlacesFromSegments(segments: PlannerSegment[]): Array<Record<string, unknown>> {
  const raw: Array<Record<string, unknown>> = [];
  const slots = ['morning', 'afternoon', 'evening'] as const;

  for (const segment of segments) {
    for (const day of segment.days) {
      for (const slot of slots) {
        for (const activity of day[slot]) {
          if (activity?.title) {
            raw.push({
              name: activity.title,
              description: activity.description || activity.tip,
              category: activity.category || activity.activityType || 'Actividad',
              city: segment.city,
              segmentCity: segment.city,
              suggestedSlot: slot,
              photoUrl: activity.photoUrls?.find(Boolean),
            });
          }
        }
      }
      for (const restaurant of day.restaurants) {
        if (restaurant?.name) {
          raw.push({
            name: restaurant.name,
            description: restaurant.type
              ? `${restaurant.type}${restaurant.priceRange ? ` · ${restaurant.priceRange}` : ''}`
              : restaurant.priceRange,
            category: 'Gastronomía',
            city: segment.city,
            segmentCity: segment.city,
            suggestedSlot: 'evening',
            photoUrl: restaurant.photoUrls?.find(Boolean),
          });
        }
      }
    }
  }
  return raw;
}

// ---------------------------------------------------------------------------
// normalizeRecommendedPlaces
// ---------------------------------------------------------------------------

export function normalizeRecommendedPlaces(
  places: Array<Record<string, unknown>>,
  maxCount = 6,
): ChatRecommendedPlace[] {
  const result: ChatRecommendedPlace[] = [];
  const seen = new Set<string>();

  for (const place of places) {
    const name = String(place.name || '').trim();
    if (!name || isGenericPlaceholder(name)) continue;

    const city = String(place.segmentCity || place.city || '');
    const key = `${city.toLowerCase()}::${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      name,
      description: typeof place.description === 'string' ? place.description : undefined,
      category: titleCase(String(place.category || 'Lugar recomendado')),
      city,
      suggestedSlot: place.suggestedSlot as 'morning' | 'afternoon' | 'evening' | undefined,
      photoUrl: typeof place.photoUrl === 'string' ? place.photoUrl : undefined,
    });

    if (result.length >= maxCount) break;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Canonical result builders
// ---------------------------------------------------------------------------

export function buildCanonicalResultFromStandard(args: {
  response: string;
  structuredData: {
    itineraryData?: unknown;
    plannerData?: TripPlannerState;
    messageType?: string;
    recommendedPlaces?: Array<Record<string, unknown>>;
  } | null;
  conversationTurn: ConversationTurnResolution;
  routeResult: { route: string; score: number; reason: string; inferredFields: string[] };
  requestText: string;
  editorial?: PlannerEditorialData | null;
}): CanonicalItineraryResult {
  const plannerData = args.structuredData?.plannerData ?? null;

  let rawPlaces: Array<Record<string, unknown>> = [];
  if (args.structuredData?.recommendedPlaces) {
    rawPlaces = args.structuredData.recommendedPlaces;
  } else if (plannerData?.segments) {
    rawPlaces = extractRawPlacesFromSegments(plannerData.segments);
  }

  return {
    response: args.response,
    plannerData,
    flights: [],
    hotels: [],
    recommendedPlaces: normalizeRecommendedPlaces(rawPlaces),
    responseMode: args.conversationTurn.responseMode,
    conversationTurn: args.conversationTurn,
    source: 'AI_PARSER + EUROVIPS',
    emiliaRoute: args.routeResult,
    requestText: args.requestText,
    itineraryData: args.structuredData?.itineraryData,
    agentInjectData: null,
    editorial: args.editorial ?? null,
  };
}

export function buildCanonicalResultFromAgent(args: {
  response: string;
  rawStructuredData: Record<string, unknown> | null;
  plannerData: TripPlannerState | null;
  flights: unknown[];
  hotels: unknown[];
  conversationTurn: ConversationTurnResolution;
  actionChips?: Array<{ label: string; message: string }>;
  editorial?: PlannerEditorialData | null;
}): CanonicalItineraryResult {
  const rawPlaces = Array.isArray(args.rawStructuredData?.recommendedPlaces)
    ? (args.rawStructuredData!.recommendedPlaces as Array<Record<string, unknown>>)
    : [];

  return {
    response: args.response,
    plannerData: args.plannerData,
    flights: args.flights,
    hotels: args.hotels,
    recommendedPlaces: normalizeRecommendedPlaces(rawPlaces, 8),
    responseMode: args.conversationTurn.responseMode,
    conversationTurn: args.conversationTurn,
    source: 'planner-agent',
    actionChips: args.actionChips,
    agentInjectData: args.rawStructuredData ? {
      flightSearchParams: (args.rawStructuredData.flights as Record<string, unknown>)?.searchParams as Record<string, unknown> | undefined,
      hotelSearchParams: (args.rawStructuredData.hotels as Record<string, unknown>)?.searchParams as Record<string, unknown> | undefined,
      action: args.rawStructuredData.action as string | undefined,
    } : null,
    editorial: args.editorial ?? null,
  };
}

// ---------------------------------------------------------------------------
// Canonical meta builder
// ---------------------------------------------------------------------------

export function buildCanonicalMeta(result: CanonicalItineraryResult): Record<string, unknown> {
  const hasCombined = (result.flights as unknown[]).length > 0 || (result.hotels as unknown[]).length > 0;
  const combinedData = hasCombined
    ? {
        flights: result.flights,
        hotels: result.hotels,
        requestType: (result.flights as unknown[]).length > 0 && (result.hotels as unknown[]).length > 0
          ? 'combined'
          : (result.flights as unknown[]).length > 0 ? 'flights-only' : 'hotels-only',
      }
    : undefined;

  return {
    source: result.source,
    messageType: result.conversationTurn.messageType,
    responseMode: result.responseMode,
    ...(result.conversationTurn.normalizedMissingFields.length > 0 && {
      normalizedMissingFields: result.conversationTurn.normalizedMissingFields,
    }),
    ...(result.requestText && { requestText: result.requestText }),
    ...(result.plannerData && { plannerData: result.plannerData }),
    ...(result.itineraryData && { itineraryData: result.itineraryData }),
    ...(combinedData && { combinedData }),
    ...(result.recommendedPlaces.length > 0 && { recommendedPlaces: result.recommendedPlaces }),
    ...(result.emiliaRoute && { emiliaRoute: result.emiliaRoute }),
    ...(result.actionChips?.length && { actionChips: result.actionChips }),
    ...(result.editorial && { editorial: result.editorial }),
    conversationTurn: result.conversationTurn,
  };
}

// ---------------------------------------------------------------------------
// Unified persistence pipeline
// ---------------------------------------------------------------------------

export async function persistCanonicalResult(
  result: CanonicalItineraryResult,
  deps: {
    persistPlannerState: ((state: TripPlannerState, source: string) => Promise<void>) | null;
  },
): Promise<void> {
  // Emit pipeline metrics for observability
  console.log('📊 [PIPELINE] canonical result:', {
    branch: result.source,
    responseMode: result.responseMode,
    hasPlannerData: Boolean(result.plannerData),
    segmentCount: result.plannerData?.segments?.length ?? 0,
    recommendedPlacesCount: result.recommendedPlaces.length,
    flightsCount: result.flights.length,
    hotelsCount: result.hotels.length,
    hasEmiliaRoute: Boolean(result.emiliaRoute),
    hasActionChips: Boolean(result.actionChips?.length),
    hasEditorial: Boolean(result.editorial),
    editorialMode: result.editorial?.mode,
    editorialHighlightCount: result.editorial?.segments.reduce((s, seg) => s + seg.highlights.length, 0) ?? 0,
    editorialDayPreviewCount: result.editorial?.segments.reduce((s, seg) => s + seg.dayPreviews.length, 0) ?? 0,
  });

  if (!deps.persistPlannerState || !result.plannerData || result.responseMode === 'show_places') return;

  try {
    await deps.persistPlannerState(result.plannerData, 'chat');
  } catch (e) {
    console.warn('[PIPELINE] Failed to persist plannerData:', e);
  }
}

// ---------------------------------------------------------------------------
// Render policy
// ---------------------------------------------------------------------------

export function resolveRenderPolicy(
  responseMode?: string | null,
): typeof RESPONSE_MODE_RENDER_POLICY[ConversationResponseMode] {
  const mode = (responseMode || 'standard') as ConversationResponseMode;
  return RESPONSE_MODE_RENDER_POLICY[mode] || RESPONSE_MODE_RENDER_POLICY.standard;
}

export const RESPONSE_MODE_RENDER_POLICY: Record<ConversationResponseMode, {
  showPlannerCta: boolean;
  showRecommendedPlaces: boolean;
  showCombinedCards: boolean;
  showGaps: boolean;
}> = {
  proposal_first_plan: {
    showPlannerCta: true,
    showRecommendedPlaces: false,
    showCombinedCards: false,
    showGaps: true,
  },
  show_places: {
    showPlannerCta: false,
    showRecommendedPlaces: true,
    showCombinedCards: false,
    showGaps: false,
  },
  needs_input: {
    showPlannerCta: false,
    showRecommendedPlaces: false,
    showCombinedCards: false,
    showGaps: false,
  },
  quote_or_search: {
    showPlannerCta: false,
    showRecommendedPlaces: false,
    showCombinedCards: true,
    showGaps: false,
  },
  standard: {
    showPlannerCta: false,
    showRecommendedPlaces: false,
    showCombinedCards: true,
    showGaps: false,
  },
};

// ---------------------------------------------------------------------------
// Shared ContextState builder
// ---------------------------------------------------------------------------

export function buildTurnContextState(args: {
  requestType: 'flights' | 'hotels' | 'combined';
  flightsParams?: Record<string, unknown> | null;
  hotelsParams?: Record<string, unknown> | null;
  flightsCount: number;
  hotelsCount: number;
  previousState?: { constraintsHistory?: unknown[]; turnNumber?: number } | null;
  newConstraints?: Array<{ component: string; constraint: string; value: unknown }>;
}): Record<string, unknown> {
  const turnNumber = (args.previousState?.turnNumber || 0) + 1;
  const previousConstraints = Array.isArray(args.previousState?.constraintsHistory)
    ? args.previousState!.constraintsHistory
    : [];
  const newEntries = (args.newConstraints || []).map((c) => ({
    turn: turnNumber,
    component: c.component,
    constraint: c.constraint,
    value: c.value,
    timestamp: new Date().toISOString(),
  }));

  // ContextState quality metrics
  const flightFieldCount = args.flightsParams ? Object.keys(args.flightsParams).filter((k) => args.flightsParams![k] != null).length : 0;
  const hotelFieldCount = args.hotelsParams ? Object.keys(args.hotelsParams).filter((k) => args.hotelsParams![k] != null).length : 0;
  console.log('📊 [PIPELINE] contextState:', {
    requestType: args.requestType,
    turnNumber,
    flightFieldCount,
    hotelFieldCount,
    constraintsTotal: previousConstraints.length + newEntries.length,
    newConstraintsAdded: newEntries.length,
    resultsFound: { flights: args.flightsCount, hotels: args.hotelsCount },
  });

  return {
    lastSearch: {
      requestType: args.requestType,
      timestamp: new Date().toISOString(),
      ...(args.flightsParams && { flightsParams: args.flightsParams }),
      ...(args.hotelsParams && { hotelsParams: args.hotelsParams }),
      resultsSummary: {
        flightsCount: args.flightsCount,
        hotelsCount: args.hotelsCount,
      },
    },
    constraintsHistory: [...previousConstraints, ...newEntries],
    turnNumber,
    schemaVersion: 1,
  };
}
