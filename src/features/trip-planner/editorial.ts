/**
 * Planner Editorial Data — structured contract for rich planner responses in chat.
 *
 * Separates editorial presentation data from TripPlannerState (canonical planner state).
 * TripPlannerState feeds the workspace/map/persistence.
 * PlannerEditorialData feeds the chat UI with curated, renderable blocks.
 *
 * buildEditorialData() is a pure, deterministic function:
 *   TripPlannerState → PlannerEditorialData
 */

import type {
  TripPlannerState,
  PlannerSegment,
  PlannerActivity,
  PlannerDay,
} from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlannerEditorialMode =
  | 'multi_city_country'   // "15 días por España" — expanded from country
  | 'multi_city_region'    // "Sudeste asiático 20 días" — expanded from region
  | 'multi_country'        // "Japón y China 23 días"
  | 'single_city'          // "4 días en Shanghái"
  | 'route_refinement';    // follow-up refinement of existing plan

export interface EditorialSegmentHighlight {
  name: string;            // "Gran Muralla de Mutianyu"
  why: string;             // "Sección menos turística con vistas amplias y teleférico"
  category: string;        // "Cultura" | "Gastronomía" | "Naturaleza" | "Landmark"
}

export interface EditorialDayPreview {
  dayNumber: number;
  title: string;           // "Prado y Retiro"
  oneLiner: string;        // "Pinacoteca icónica + paseo por jardines + tortilla en Casa Dani"
}

export interface EditorialSegment {
  city: string;
  country?: string;
  nights: number;
  summary: string;
  highlights: EditorialSegmentHighlight[];
  dayPreviews: EditorialDayPreview[];
}

export interface EditorialNextAction {
  label: string;
  message: string;
  icon?: 'route' | 'hotel' | 'flight' | 'pace' | 'edit' | 'calendar';
}

export interface PlannerEditorialData {
  mode: PlannerEditorialMode;
  tripTitle: string;
  tripHook: string;
  routeOverview: string;
  segments: EditorialSegment[];
  travelLogic?: string;
  extraordinaryHighlights: string[];
  totalDays: number;
  totalCities: number;
  pace?: string;
  nextActions: EditorialNextAction[];
  metadata: {
    generatedAt: string;
    sourceSegmentCount: number;
    sourceDayCount: number;
    hasFullDayContent: boolean;
    regionalExpansion?: {
      originalInput: string;
      expandedTo: string[];
    };
  };
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BuildEditorialOptions {
  regionalExpansion?: {
    originalInput: string;
    expandedTo: string[];
  };
  requestText?: string;
}

// ---------------------------------------------------------------------------
// Generic placeholder filter (kept in sync with itineraryPipeline.ts)
// ---------------------------------------------------------------------------

const GENERIC_PREFIXES = [
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

function isGenericPlaceholder(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  if (normalized.length < 4) return true;
  return GENERIC_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function titleCase(value: string): string {
  if (!value) return '';
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function mapActivityCategory(activity: PlannerActivity): string {
  const cat = (activity.category || activity.activityType || '').toLowerCase();
  if (cat.includes('museo') || cat.includes('museum') || cat.includes('cultura') || cat.includes('culture')) return 'Cultura';
  if (cat.includes('gastrono') || cat.includes('food') || cat.includes('comida') || cat.includes('restaurant')) return 'Gastronomia';
  if (cat.includes('natur') || cat.includes('parque') || cat.includes('park') || cat.includes('viewpoint') || cat.includes('mirador')) return 'Naturaleza';
  if (cat.includes('landmark') || cat.includes('monumento') || cat.includes('templo') || cat.includes('temple')) return 'Landmark';
  if (cat.includes('mercado') || cat.includes('market') || cat.includes('shopping')) return 'Mercado';
  if (cat.includes('experience') || cat.includes('experiencia')) return 'Experiencia';
  if (cat.includes('noche') || cat.includes('nightlife') || cat.includes('bar')) return 'Vida nocturna';
  return 'Actividad';
}

function getNonGenericActivities(day: PlannerDay): PlannerActivity[] {
  const all = [...day.morning, ...day.afternoon, ...day.evening];
  return all.filter((a) => a.title && !isGenericPlaceholder(a.title));
}

function extractSegmentHighlights(segment: PlannerSegment, maxCount: number): EditorialSegmentHighlight[] {
  const seen = new Set<string>();
  const highlights: EditorialSegmentHighlight[] = [];

  for (const day of segment.days) {
    const activities = getNonGenericActivities(day);
    for (const activity of activities) {
      const key = activity.title.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      highlights.push({
        name: activity.title,
        why: activity.description || activity.tip || '',
        category: mapActivityCategory(activity),
      });

      if (highlights.length >= maxCount) return highlights;
    }

    // Also check restaurants
    for (const restaurant of day.restaurants) {
      if (!restaurant.name || isGenericPlaceholder(restaurant.name)) continue;
      const key = restaurant.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      highlights.push({
        name: restaurant.name,
        why: restaurant.type
          ? `${restaurant.type}${restaurant.priceRange ? ` · ${restaurant.priceRange}` : ''}`
          : '',
        category: 'Gastronomia',
      });

      if (highlights.length >= maxCount) return highlights;
    }
  }

  // Fallback: use segment.highlights if no day content
  if (highlights.length === 0 && segment.highlights?.length) {
    for (const h of segment.highlights.slice(0, maxCount)) {
      if (!isGenericPlaceholder(h)) {
        highlights.push({ name: h, why: '', category: 'Actividad' });
      }
    }
  }

  return highlights;
}

function isTransferDay(day: PlannerDay): boolean {
  const title = (day.title || '').toLowerCase();
  return title.startsWith('llegada a') || title.startsWith('traslado');
}

function buildDayOneLiner(day: PlannerDay): string {
  const parts: string[] = [];
  const slots = [day.morning, day.afternoon, day.evening];
  for (const slot of slots) {
    for (const activity of slot) {
      if (activity.title && !isGenericPlaceholder(activity.title)) {
        parts.push(activity.title);
        break; // one per slot
      }
    }
  }
  // Add a restaurant if we have room
  if (parts.length < 3 && day.restaurants.length > 0) {
    const r = day.restaurants.find((r) => r.name && !isGenericPlaceholder(r.name));
    if (r) parts.push(r.name);
  }
  return parts.join(' + ') || day.summary || '';
}

function extractDayPreviews(segment: PlannerSegment, maxCount: number): EditorialDayPreview[] {
  const previews: EditorialDayPreview[] = [];

  for (const day of segment.days) {
    if (isTransferDay(day)) continue;

    const oneLiner = buildDayOneLiner(day);
    if (!oneLiner) continue;

    previews.push({
      dayNumber: day.dayNumber,
      title: day.title || `Dia ${day.dayNumber}`,
      oneLiner,
    });

    if (previews.length >= maxCount) break;
  }

  // If all days were transfer days, include first non-empty anyway
  if (previews.length === 0 && segment.days.length > 0) {
    const day = segment.days[0];
    previews.push({
      dayNumber: day.dayNumber,
      title: day.title || `Dia ${day.dayNumber}`,
      oneLiner: day.summary || `Dia en ${segment.city}`,
    });
  }

  return previews;
}

function hasFullDayContent(segments: PlannerSegment[]): boolean {
  return segments.some((s) =>
    s.days.some((d) => d.morning.length > 0 || d.afternoon.length > 0 || d.evening.length > 0)
  );
}

function deriveMode(
  segments: PlannerSegment[],
  regionalExpansion?: BuildEditorialOptions['regionalExpansion'],
): PlannerEditorialMode {
  if (segments.length <= 1) return 'single_city';
  if (regionalExpansion) return 'multi_city_country';

  // Check if multiple countries
  const countries = new Set(segments.map((s) => s.country?.toLowerCase()).filter(Boolean));
  if (countries.size > 1) return 'multi_country';

  return 'multi_city_country';
}

function buildRouteOverview(segments: PlannerSegment[]): string {
  return segments
    .map((s) => `${titleCase(s.city)} (${s.nights || s.days.length}d)`)
    .join(' \u2192 ');
}

function extractExtraordinaryHighlights(segments: PlannerSegment[], maxCount: number): string[] {
  const all: Array<{ text: string; hasDescription: boolean }> = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    for (const day of segment.days) {
      const activities = getNonGenericActivities(day);
      for (const activity of activities) {
        const key = activity.title.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        // Prefer activities that have descriptions (the LLM deemed them worth describing)
        const text = activity.description
          ? `${activity.title} — ${activity.description}`
          : activity.title;
        all.push({ text, hasDescription: Boolean(activity.description) });
      }
    }
  }

  // Sort: prefer ones with descriptions, then by original order
  all.sort((a, b) => (a.hasDescription === b.hasDescription ? 0 : a.hasDescription ? -1 : 1));
  return all.slice(0, maxCount).map((item) => item.text);
}

function buildTripHook(state: TripPlannerState, segments: EditorialSegment[]): string {
  if (state.summary) return state.summary;

  const cities = segments.map((s) => s.city).join(', ');
  const days = state.days || segments.reduce((sum, s) => sum + s.nights, 0);
  return `Ruta de ${days} dias por ${cities}.`;
}

function buildNextActions(state: TripPlannerState): EditorialNextAction[] {
  const actions: EditorialNextAction[] = [];

  const hasHotels = state.segments.some((s) =>
    s.hotelPlan?.confirmedInventoryHotel || s.hotelPlan?.selectedPlaceCandidate || (s.hotelPlan?.hotelRecommendations?.length ?? 0) > 0
  );
  const hasFlights = state.segments.some((s) =>
    s.transportIn?.selectedOptionId || (s.transportIn?.options?.length ?? 0) > 0
  );

  if (!hasHotels) {
    actions.push({ label: 'Buscar hoteles', message: 'Buscame hoteles para todas las ciudades', icon: 'hotel' });
  }
  if (!hasFlights && state.segments.length > 1) {
    actions.push({ label: 'Buscar vuelos', message: 'Buscame vuelos para este recorrido', icon: 'flight' });
  }
  actions.push({ label: 'Ajustar ritmo', message: 'Hace el ritmo mas relajado', icon: 'pace' });
  actions.push({ label: 'Cambiar ciudades', message: 'Quiero cambiar el orden o las ciudades', icon: 'route' });

  return actions.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildEditorialData(
  plannerState: TripPlannerState,
  options?: BuildEditorialOptions,
): PlannerEditorialData {
  const segments = plannerState.segments;
  const fullContent = hasFullDayContent(segments);
  const highlightsPerSegment = fullContent ? 4 : 2;
  const dayPreviewsPerSegment = fullContent ? 3 : 0;

  const editorialSegments: EditorialSegment[] = segments.map((segment) => ({
    city: titleCase(segment.city),
    country: segment.country,
    nights: segment.nights || segment.days.length,
    summary: segment.summary || `Tramo por ${titleCase(segment.city)}.`,
    highlights: extractSegmentHighlights(segment, highlightsPerSegment),
    dayPreviews: fullContent ? extractDayPreviews(segment, dayPreviewsPerSegment) : [],
  }));

  const mode = deriveMode(segments, options?.regionalExpansion);
  const totalDays = plannerState.days || segments.reduce((sum, s) => sum + (s.nights || s.days.length), 0);

  const editorial: PlannerEditorialData = {
    mode,
    tripTitle: plannerState.title || `Viaje por ${segments.map((s) => titleCase(s.city)).join(', ')}`,
    tripHook: buildTripHook(plannerState, editorialSegments),
    routeOverview: buildRouteOverview(segments),
    segments: editorialSegments,
    travelLogic: segments.length > 1
      ? `Recorrido de ${segments.length} ciudades en ${totalDays} dias.`
      : undefined,
    extraordinaryHighlights: fullContent
      ? extractExtraordinaryHighlights(segments, 5)
      : (segments.flatMap((s) => s.highlights || []).filter((h) => !isGenericPlaceholder(h)).slice(0, 5)),
    totalDays,
    totalCities: segments.length,
    pace: plannerState.pace,
    nextActions: buildNextActions(plannerState),
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceSegmentCount: segments.length,
      sourceDayCount: segments.reduce((sum, s) => sum + s.days.length, 0),
      hasFullDayContent: fullContent,
      regionalExpansion: options?.regionalExpansion,
    },
  };

  // Observability log
  console.log('[EDITORIAL]', {
    mode: editorial.mode,
    totalSegments: editorial.segments.length,
    totalHighlights: editorial.segments.reduce((s, seg) => s + seg.highlights.length, 0),
    totalDayPreviews: editorial.segments.reduce((s, seg) => s + seg.dayPreviews.length, 0),
    extraordinaryCount: editorial.extraordinaryHighlights.length,
    hasRegionalExpansion: Boolean(editorial.metadata.regionalExpansion),
    hasFullDayContent: editorial.metadata.hasFullDayContent,
  });

  return editorial;
}
