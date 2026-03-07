import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rateLimit.ts";
import { normalizePlannerSegmentsScheduling } from "../../../src/features/trip-planner/scheduling.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface PlannerRequest {
  destinations: string[];
  days?: number;
  startDate?: string;
  endDate?: string;
  isFlexibleDates?: boolean;
  flexibleMonth?: string;
  flexibleYear?: number;
  budgetLevel?: string;
  budgetAmount?: number;
  interests?: string[];
  pace?: string;
  travelers?: {
    adults?: number;
    children?: number;
    infants?: number;
  };
  constraints?: string[];
  hotelCategory?: string;
  generationMode?: PlannerGenerationMode;
  existingPlannerState?: unknown;
  editIntent?: {
    action?: string;
    targetSegmentId?: string;
    targetDayId?: string;
    targetCity?: string;
  };
}

type PlannerGenerationMode = 'skeleton' | 'segment' | 'full';
type TimingDetails = Record<string, unknown>;

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function nowMs(): number {
  return performance.now();
}

function logTimingStep(scope: string, label: string, startedAtMs: number, details: TimingDetails = {}) {
  const durationMs = Math.round(nowMs() - startedAtMs);
  if (Object.keys(details).length > 0) {
    console.log(`[TIMING] ${scope} · ${label}: ${durationMs}ms`, details);
  } else {
    console.log(`[TIMING] ${scope} · ${label}: ${durationMs}ms`);
  }
  return durationMs;
}

function createTimingLogger(scope: string, baseDetails: TimingDetails = {}) {
  const startedAtMs = nowMs();
  console.log(`[TIMING] ${scope} · started`, baseDetails);

  return {
    step(label: string, stepStartedAtMs: number, details: TimingDetails = {}) {
      return logTimingStep(scope, label, stepStartedAtMs, {
        ...baseDetails,
        ...details,
      });
    },
    end(label = 'total', details: TimingDetails = {}) {
      return logTimingStep(scope, label, startedAtMs, {
        ...baseDetails,
        ...details,
      });
    },
    fail(label: string, error: unknown, details: TimingDetails = {}) {
      return logTimingStep(scope, `${label} (failed)`, startedAtMs, {
        ...baseDetails,
        ...details,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  };
}

function calculateDays(startDate?: string, endDate?: string, explicitDays?: number): number {
  if (startDate && endDate) {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(1, Math.round(diff / 86400000) + 1);
  }
  if (explicitDays && explicitDays > 0) return explicitDays;
  return 0;
}

function shouldKeepGeneratedDates(input: PlannerRequest): boolean {
  return Boolean(input.startDate && input.endDate);
}

function formatFlexibleMonth(month?: string, year?: number): string {
  if (!month && !year) return 'Mes flexible';
  const monthDate = month ? new Date(`${year || new Date().getFullYear()}-${month}-01T00:00:00`) : null;
  const monthLabel = monthDate && !Number.isNaN(monthDate.getTime())
    ? monthDate.toLocaleDateString('es-ES', { month: 'long' })
    : month;

  if (!monthLabel) return 'Mes flexible';
  return `${monthLabel}${year ? ` de ${year}` : ''}`;
}

function stripGeneratedDates(rawSegments: any[]): any[] {
  return safeArray(rawSegments).map((segment) => ({
    ...segment,
    startDate: undefined,
    endDate: undefined,
    transportIn: segment?.transportIn
      ? {
          ...segment.transportIn,
          date: undefined,
        }
      : segment?.transportIn,
    transportOut: segment?.transportOut
      ? {
          ...segment.transportOut,
          date: undefined,
        }
      : segment?.transportOut,
    hotelPlan: segment?.hotelPlan
      ? {
          ...segment.hotelPlan,
          checkinDate: undefined,
          checkoutDate: undefined,
        }
      : segment?.hotelPlan,
    days: safeArray(segment?.days).map((day) => ({
      ...day,
      date: undefined,
    })),
  }));
}

function normalizeScheduling(raw: any, input: PlannerRequest, debugContext: TimingDetails = {}) {
  const schedulingStart = nowMs();
  const sourceSegments = safeArray<any>(raw?.segments);
  const nextSegments = normalizePlannerSegmentsScheduling(sourceSegments, {
    pace: raw?.pace || input.pace,
    travelers: raw?.travelers || input.travelers,
  });
  logTimingStep('TRAVEL-ITINERARY', 'normalizePlannerSegmentsScheduling', schedulingStart, {
    ...debugContext,
    inputSegments: sourceSegments.length,
    outputSegments: nextSegments.length,
  });

  return {
    ...raw,
    segments: nextSegments,
    itinerary: nextSegments.flatMap((segment: any) => safeArray<any>(segment?.days)),
  };
}

function inferTravelerProfile(input: PlannerRequest): string {
  const travelers = input.travelers || { adults: 2, children: 0, infants: 0 };
  const interests = safeArray(input.interests).map((i) => i.toLowerCase());

  if ((travelers.children || 0) > 0 || (travelers.infants || 0) > 0) return 'familia';
  if (interests.some((i) => i.includes('aventura') || i.includes('trekking') || i.includes('deporte'))) return 'aventura';
  if (interests.some((i) => i.includes('negocio') || i.includes('corporativo') || i.includes('business'))) return 'negocios';
  if ((travelers.adults || 0) === 2 && interests.some((i) => i.includes('romantico') || i.includes('pareja') || i.includes('luna de miel'))) return 'pareja';
  if ((travelers.adults || 0) >= 3) return 'amigos';
  return 'general';
}

function buildProfileGuidelines(profile: string): string {
  switch (profile) {
    case 'familia':
      return 'Kid-friendly activities, moderate walking, downtime after lunch, and quiet evenings.';
    case 'pareja':
      return 'Romantic and atmospheric plans, sunset spots, culture, and dinners with ambiance.';
    case 'aventura':
      return 'Active outdoor plans, early starts, practical logistics, and authentic casual food.';
    case 'amigos':
      return 'Mix culture, food, and social plans with group-friendly venues and lively neighborhoods.';
    case 'negocios':
      return 'Flexible mornings, efficient logistics, and after-office plans near convenient areas.';
    default:
      return 'Balanced culture, food, and easy logistics.';
  }
}

function resolveGenerationMode(input: PlannerRequest): PlannerGenerationMode {
  if (input.generationMode === 'skeleton' || input.generationMode === 'segment' || input.generationMode === 'full') {
    return input.generationMode;
  }

  if (input.editIntent?.action === 'enrich_segment') {
    return 'segment';
  }

  return 'full';
}

function truncateText(value: unknown, maxLength = 80): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function compactPromptValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const next = value
      .map((item) => compactPromptValue(item))
      .filter((item) => item !== undefined);
    return next.length > 0 ? next : undefined;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, innerValue]) => [key, compactPromptValue(innerValue)] as const)
      .filter(([, innerValue]) => innerValue !== undefined);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  return value;
}

function summarizePromptActivity(activity: any): unknown {
  return compactPromptValue({
    time: activity?.time,
    title: truncateText(activity?.title, 48),
    category: truncateText(activity?.category, 24),
  });
}

function summarizePromptDay(day: any, includeDetails = false): unknown {
  const base = compactPromptValue({
    id: day?.id,
    dayNumber: typeof day?.dayNumber === 'number' ? day.dayNumber : day?.day,
    date: day?.date,
    city: day?.city,
    title: truncateText(day?.title, 48),
    summary: truncateText(day?.summary, 72),
  });

  if (!includeDetails || !base || typeof base !== 'object') {
    return base;
  }

  return compactPromptValue({
    ...(base as Record<string, unknown>),
    morning: safeArray<any>(day?.morning).slice(0, 2).map(summarizePromptActivity),
    afternoon: safeArray<any>(day?.afternoon).slice(0, 2).map(summarizePromptActivity),
    evening: safeArray<any>(day?.evening).slice(0, 2).map(summarizePromptActivity),
    restaurants: safeArray<any>(day?.restaurants).slice(0, 1).map((restaurant) =>
      compactPromptValue({
        name: truncateText(restaurant?.name, 40),
        type: truncateText(restaurant?.type, 24),
        priceRange: restaurant?.priceRange,
      })
    ),
    travelTip: truncateText(day?.travelTip, 60),
  });
}

function summarizeEditIntent(editIntent?: PlannerRequest['editIntent']): unknown {
  return compactPromptValue({
    action: editIntent?.action,
    targetSegmentId: editIntent?.targetSegmentId,
    targetDayId: editIntent?.targetDayId,
    targetCity: editIntent?.targetCity,
  });
}

function summarizeExistingPlannerState(
  existingPlannerState: unknown,
  editIntent?: PlannerRequest['editIntent'],
): unknown {
  if (!existingPlannerState || typeof existingPlannerState !== 'object') {
    return null;
  }

  const state = existingPlannerState as Record<string, any>;
  const targetSegmentId = editIntent?.targetSegmentId;
  const targetDayId = editIntent?.targetDayId;
  const includeDetailedSegments = Boolean(editIntent?.action);

  return compactPromptValue({
    title: truncateText(state.title, 80),
    summary: truncateText(state.summary, 120),
    destinations: safeArray<string>(state.destinations),
    days: typeof state.days === 'number' ? state.days : undefined,
    startDate: state.startDate,
    endDate: state.endDate,
    isFlexibleDates: state.isFlexibleDates,
    budgetLevel: state.budgetLevel,
    budgetAmount: state.budgetAmount,
    pace: state.pace,
    travelers: compactPromptValue(state.travelers),
    interests: safeArray<string>(state.interests).slice(0, 8),
    constraints: safeArray<string>(state.constraints).slice(0, 8),
    segments: safeArray<any>(state.segments).map((segment) => {
      const days = safeArray<any>(segment?.days);
      const includeDetails = includeDetailedSegments && (
        segment?.id === targetSegmentId || days.some((day) => day?.id === targetDayId)
      );

      return compactPromptValue({
        id: segment?.id,
        city: segment?.city,
        country: segment?.country,
        startDate: segment?.startDate,
        endDate: segment?.endDate,
        nights: segment?.nights,
        order: segment?.order,
        summary: truncateText(segment?.summary, 72),
        highlights: safeArray<string>(segment?.highlights).slice(0, 4),
        transportIn: segment?.transportIn
          ? compactPromptValue({
              type: segment.transportIn.type,
              summary: truncateText(segment.transportIn.summary, 60),
              origin: segment.transportIn.origin,
              destination: segment.transportIn.destination,
              date: segment.transportIn.date,
            })
          : null,
        hotelPlan: segment?.hotelPlan
          ? compactPromptValue({
              city: segment.hotelPlan.city,
              requestedStars: segment.hotelPlan.requestedStars,
              requestedMealPlan: segment.hotelPlan.requestedMealPlan,
              selectedHotelName:
                segment.hotelPlan.confirmedInventoryHotel?.name
                || segment.hotelPlan.selectedPlaceCandidate?.name,
            })
          : undefined,
        dayCount: days.length > 0 ? days.length : undefined,
        days: includeDetailedSegments
          ? days.map((day) =>
              summarizePromptDay(day, includeDetails || day?.id === targetDayId)
            )
          : undefined,
      });
    }),
  });
}

interface SegmentBlueprint {
  segmentId: string;
  city: string;
  order: number;
  dayCount: number;
  startDate?: string;
  endDate?: string;
  previousCity?: string;
  existingSegment?: any;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeLabel(value: string | undefined | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseIsoDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function addIsoDays(value: string, offset: number): string | undefined {
  const date = parseIsoDate(value);
  if (!date) return undefined;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().split('T')[0];
}

function getExistingSegments(existingPlannerState: unknown): any[] {
  if (!existingPlannerState || typeof existingPlannerState !== 'object') {
    return [];
  }

  return safeArray<any>((existingPlannerState as Record<string, any>)?.segments);
}

function mapExistingSegmentsByDestination(destinations: string[], existingSegments: any[]): Array<any | null> {
  const used = new Set<number>();

  return destinations.map((destination, index) => {
    const normalizedDestination = normalizeLabel(destination);
    let matchIndex = existingSegments.findIndex((segment, segmentIndex) =>
      !used.has(segmentIndex) && normalizeLabel(segment?.city) === normalizedDestination
    );

    if (matchIndex < 0 && index < existingSegments.length && !used.has(index)) {
      matchIndex = index;
    }

    if (matchIndex < 0) {
      matchIndex = existingSegments.findIndex((_, segmentIndex) => !used.has(segmentIndex));
    }

    if (matchIndex < 0) {
      return null;
    }

    used.add(matchIndex);
    return existingSegments[matchIndex];
  });
}

function getExistingSegmentDayWeight(segment: any): number {
  const dayCount = safeArray<any>(segment?.days).length;
  if (dayCount > 0) return dayCount;

  const nights = typeof segment?.nights === 'number' ? Math.round(segment.nights) : 0;
  if (nights > 0) return nights;

  return 1;
}

function distributeDaysByWeights(totalDays: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (totalDays <= 0) return weights.map(() => 0);

  const normalizedWeights = weights.map((weight) => (weight > 0 ? weight : 1));
  const orderedIndices = normalizedWeights
    .map((weight, index) => ({ weight, index }))
    .sort((left, right) => right.weight - left.weight || left.index - right.index);

  const counts = normalizedWeights.map(() => 0);
  let remainingDays = totalDays;

  for (const { index } of orderedIndices) {
    if (remainingDays <= 0) break;
    counts[index] += 1;
    remainingDays -= 1;
  }

  if (remainingDays <= 0) {
    return counts;
  }

  const totalWeight = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  const remainders = normalizedWeights.map((weight, index) => {
    const proportional = (remainingDays * weight) / totalWeight;
    const floorValue = Math.floor(proportional);
    counts[index] += floorValue;
    return {
      index,
      remainder: proportional - floorValue,
    };
  });

  const allocated = counts.reduce((sum, count) => sum + count, 0);
  let leftover = totalDays - allocated;

  remainders
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .forEach(({ index }) => {
      if (leftover <= 0) return;
      counts[index] += 1;
      leftover -= 1;
    });

  return counts;
}

function buildSegmentBlueprints(input: PlannerRequest): SegmentBlueprint[] {
  const destinations = safeArray<string>(input.destinations);
  const totalDays = calculateDays(input.startDate, input.endDate, input.days);
  const existingSegments = getExistingSegments(input.existingPlannerState);
  const mappedExistingSegments = mapExistingSegmentsByDestination(destinations, existingSegments);
  const existingWeights = mappedExistingSegments.map(getExistingSegmentDayWeight);
  const dayCounts = distributeDaysByWeights(totalDays, existingWeights.length > 0 ? existingWeights : destinations.map(() => 1));

  let currentOffset = 0;

  return destinations.map((city, index) => {
    const dayCount = dayCounts[index] ?? 0;
    const startDate = shouldKeepGeneratedDates(input) && input.startDate
      ? addIsoDays(input.startDate, currentOffset)
      : undefined;
    const endDate = startDate && dayCount > 0
      ? addIsoDays(startDate, dayCount - 1)
      : undefined;

    currentOffset += dayCount;

    return {
      segmentId: mappedExistingSegments[index]?.id || `segment-${slugify(city) || 'destination'}-${index + 1}`,
      city,
      order: index,
      dayCount,
      startDate,
      endDate,
      previousCity: index > 0 ? destinations[index - 1] : undefined,
      existingSegment: mappedExistingSegments[index] || null,
    };
  });
}

function getTargetSegmentBlueprint(input: PlannerRequest, blueprints: SegmentBlueprint[]): SegmentBlueprint | null {
  const targetSegmentId = input.editIntent?.targetSegmentId;
  const targetCity = input.editIntent?.targetCity;

  if (targetSegmentId) {
    const byId = blueprints.find((blueprint) => blueprint.segmentId === targetSegmentId || blueprint.existingSegment?.id === targetSegmentId);
    if (byId) return byId;
  }

  if (targetCity) {
    const normalizedTargetCity = normalizeLabel(targetCity);
    const byCity = blueprints.find((blueprint) => normalizeLabel(blueprint.city) === normalizedTargetCity);
    if (byCity) return byCity;
  }

  return blueprints[0] || null;
}

function normalizeCompactActivityItem(item: any): any | null {
  if (typeof item === 'string') {
    const title = truncateText(item, 72);
    return title ? { title } : null;
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  const title = truncateText(item?.title || item?.name || item?.activity, 72);
  if (!title) {
    return null;
  }

  return compactPromptValue({
    title,
    category: truncateText(item?.category, 24),
    description: truncateText(item?.description || item?.detail, 96),
    tip: truncateText(item?.tip, 96),
  });
}

function normalizeCompactRestaurantItem(item: any): any | null {
  if (typeof item === 'string') {
    const name = truncateText(item, 48);
    return name ? { name } : null;
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  const name = truncateText(item?.name || item?.title, 48);
  if (!name) {
    return null;
  }

  return compactPromptValue({
    name,
    type: truncateText(item?.type, 24),
    priceRange: truncateText(item?.priceRange, 6),
  });
}

function normalizeCompactHighlightItem(item: any): string | null {
  if (typeof item === 'string') {
    return truncateText(item, 40) || null;
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  return truncateText(item?.title || item?.name || item?.label || item?.activity, 40) || null;
}

function isGenericSegmentHighlight(value: string): boolean {
  const normalized = normalizeLabel(value);
  return normalized.startsWith('dia ')
    || normalized.startsWith('llegada a ')
    || normalized.startsWith('esenciales de ');
}

function normalizeCompactHighlights(items: any, fallbackTitles: Array<string | undefined> = []): string[] {
  const seen = new Set<string>();
  const candidates = [
    ...safeArray<any>(items).map(normalizeCompactHighlightItem).filter(Boolean),
    ...fallbackTitles.map(normalizeCompactHighlightItem).filter(Boolean),
  ];

  return candidates.filter((item): item is string => {
    if (!item || isGenericSegmentHighlight(item)) return false;
    const key = normalizeLabel(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

function deriveCompactDayTitle(day: any, city: string, index: number): string {
  return (
    truncateText(day?.title, 64)
    || truncateText(day?.summary, 64)
    || truncateText(day?.morning?.[0]?.title || day?.afternoon?.[0]?.title || day?.evening?.[0]?.title, 64)
    || `Día ${index + 1} en ${city}`
  );
}

function buildFallbackCompactDay(
  city: string,
  dayIndex: number,
  isTransferDay: boolean,
  mode: PlannerGenerationMode,
): any {
  if (mode === 'skeleton') {
    return {
      title: isTransferDay ? `Llegada a ${city}` : `Día ${dayIndex + 1} en ${city}`,
      summary: isTransferDay
        ? `Día de llegada y primer contacto con ${city}.`
        : `Base del recorrido para completar ${city}.`,
    };
  }

  if (isTransferDay) {
    return {
      title: `Llegada a ${city}`,
      summary: `Día liviano para instalarse y empezar a conocer ${city}.`,
      morning: [{ title: `Traslado hacia ${city}`, category: 'Traslado' }],
      afternoon: [{ title: `Paseo inicial por ${city}`, category: 'Paseo' }],
      evening: [{ title: 'Cena tranquila en zona local', category: 'Gastronomia' }],
      restaurants: [],
      travelTip: 'Dejá margen para traslados y check-in.',
    };
  }

  return {
    title: `Esenciales de ${city}`,
    summary: `Jornada equilibrada para disfrutar ${city}.`,
    morning: [{ title: `Recorrido cultural por ${city}`, category: 'Cultura' }],
    afternoon: [{ title: 'Paseo por barrio emblemático', category: 'Paseo' }],
    evening: [{ title: 'Cena recomendada en zona local', category: 'Gastronomia' }],
    restaurants: [],
    travelTip: 'Reservá con antelación los puntos más populares.',
  };
}

function normalizeCompactDay(
  day: any,
  city: string,
  index: number,
  isTransferDay: boolean,
  mode: PlannerGenerationMode,
): any | null {
  if (!day || typeof day !== 'object') {
    return buildFallbackCompactDay(city, index, isTransferDay, mode);
  }

  if (mode === 'skeleton') {
    const normalized = compactPromptValue({
      title: deriveCompactDayTitle(day, city, index),
      summary: truncateText(day?.summary, 120),
    });

    if (!normalized || typeof normalized !== 'object') {
      return buildFallbackCompactDay(city, index, isTransferDay, mode);
    }

    return normalized;
  }

  const morning = safeArray<any>(day?.morning).map(normalizeCompactActivityItem).filter(Boolean);
  const afternoon = safeArray<any>(day?.afternoon).map(normalizeCompactActivityItem).filter(Boolean);
  const evening = safeArray<any>(day?.evening).map(normalizeCompactActivityItem).filter(Boolean);
  const restaurants = safeArray<any>(day?.restaurants).map(normalizeCompactRestaurantItem).filter(Boolean);

  const normalized = compactPromptValue({
    title: deriveCompactDayTitle(day, city, index),
    summary: truncateText(day?.summary, 120),
    morning: morning.slice(0, 1),
    afternoon: afternoon.slice(0, 1),
    evening: evening.slice(0, 1),
    restaurants: restaurants.slice(0, 1),
    travelTip: truncateText(day?.travelTip, 100),
  });

  if (!normalized || typeof normalized !== 'object') {
    return buildFallbackCompactDay(city, index, isTransferDay, mode);
  }

  const hasContent = ['morning', 'afternoon', 'evening', 'restaurants', 'travelTip', 'summary']
    .some((key) => Boolean((normalized as Record<string, unknown>)[key]));

  return hasContent ? normalized : buildFallbackCompactDay(city, index, isTransferDay, mode);
}

function fitCompactDaysToTarget(rawDays: any[], blueprint: SegmentBlueprint, mode: PlannerGenerationMode): any[] {
  const normalizedDays = rawDays
    .map((day, index) => normalizeCompactDay(day, blueprint.city, index, blueprint.order > 0 && index === 0, mode))
    .filter(Boolean);

  const trimmedDays = normalizedDays.slice(0, blueprint.dayCount);
  while (trimmedDays.length < blueprint.dayCount) {
    trimmedDays.push(
      buildFallbackCompactDay(
        blueprint.city,
        trimmedDays.length,
        blueprint.order > 0 && trimmedDays.length === 0,
        mode,
      )
    );
  }

  return trimmedDays;
}

function matchRawSegmentsToBlueprints(rawSegments: any[], blueprints: SegmentBlueprint[]): Array<any | null> {
  const used = new Set<number>();

  return blueprints.map((blueprint, index) => {
    const normalizedCity = normalizeLabel(blueprint.city);
    let matchIndex = rawSegments.findIndex((segment, rawIndex) =>
      !used.has(rawIndex) && normalizeLabel(segment?.city) === normalizedCity
    );

    if (matchIndex < 0 && index < rawSegments.length && !used.has(index)) {
      matchIndex = index;
    }

    if (matchIndex < 0) {
      matchIndex = rawSegments.findIndex((_, rawIndex) => !used.has(rawIndex));
    }

    if (matchIndex < 0) {
      return null;
    }

    used.add(matchIndex);
    return rawSegments[matchIndex];
  });
}

function expandCompactPlannerResponse(
  raw: any,
  input: PlannerRequest,
  blueprints: SegmentBlueprint[],
  mode: PlannerGenerationMode,
): any {
  const rawSegments = safeArray<any>(raw?.segments);
  const matchedSegments = matchRawSegmentsToBlueprints(rawSegments, blueprints);

  const segments = blueprints.map((blueprint, index) => {
    const rawSegment = matchedSegments[index] || {};
    const compactDays = fitCompactDaysToTarget(safeArray<any>(rawSegment?.days), blueprint, mode);
    const segmentId = blueprint.segmentId;
    const highlights = normalizeCompactHighlights(
      rawSegment?.highlights,
      compactDays.map((day) => day?.title),
    );

    const expandedDays = compactDays.map((day, dayIndex) => ({
      day: dayIndex + 1,
      dayNumber: dayIndex + 1,
      date: blueprint.startDate ? addIsoDays(blueprint.startDate, dayIndex) : undefined,
      city: blueprint.city,
      title: day?.title || `Día ${dayIndex + 1} en ${blueprint.city}`,
      summary: day?.summary,
      morning: safeArray<any>(day?.morning),
      afternoon: safeArray<any>(day?.afternoon),
      evening: safeArray<any>(day?.evening),
      restaurants: safeArray<any>(day?.restaurants),
      travelTip: day?.travelTip,
    }));

    return {
      id: segmentId,
      city: blueprint.city,
      country: rawSegment?.country || blueprint.existingSegment?.country,
      startDate: blueprint.startDate,
      endDate: blueprint.endDate,
      nights: blueprint.dayCount || undefined,
      order: blueprint.order,
      summary: truncateText(rawSegment?.summary, 120) || blueprint.existingSegment?.summary || `Recorrido por ${blueprint.city}.`,
      highlights,
      contentStatus: mode === 'skeleton' ? 'skeleton' : 'ready',
      contentError: undefined,
      transportIn: blueprint.order === 0
        ? null
        : {
            type: blueprint.existingSegment?.transportIn?.type || 'flight',
            summary: blueprint.existingSegment?.transportIn?.summary || `${blueprint.previousCity || ''} a ${blueprint.city}`.trim(),
            origin: blueprint.previousCity,
            destination: blueprint.city,
            date: blueprint.startDate,
          },
      transportOut: null,
      hotelPlan: {
        city: blueprint.city,
        checkinDate: blueprint.startDate,
        checkoutDate: blueprint.endDate,
        requestedMealPlan: blueprint.existingSegment?.hotelPlan?.requestedMealPlan,
        requestedStars: blueprint.existingSegment?.hotelPlan?.requestedStars,
        searchStatus: 'idle',
        hotelRecommendations: [],
      },
      days: expandedDays,
    };
  });

  return {
    title: raw?.title,
    summary: raw?.summary,
    destinations: input.destinations,
    days: blueprints.reduce((sum, blueprint) => sum + blueprint.dayCount, 0),
    startDate: input.startDate,
    endDate: input.endDate,
    isFlexibleDates: Boolean(input.isFlexibleDates),
    flexibleMonth: input.flexibleMonth,
    flexibleYear: input.flexibleYear,
    budgetLevel: input.budgetLevel,
    budgetAmount: input.budgetAmount,
    interests: safeArray(input.interests),
    pace: input.pace,
    travelers: input.travelers,
    constraints: safeArray(input.constraints),
    generalTips: safeArray(raw?.generalTips).slice(0, 3),
    segments,
  };
}

function isCompactPlannerResponse(raw: any): boolean {
  const segments = safeArray<any>(raw?.segments);
  if (segments.length === 0) return false;
  const firstSegment = segments[0];
  return !firstSegment?.hotelPlan && !firstSegment?.transportIn && !firstSegment?.transportOut;
}

function expandCompactTargetSegment(
  raw: any,
  input: PlannerRequest,
  blueprint: SegmentBlueprint,
): any | null {
  const targetSegment = raw?.segment || safeArray<any>(raw?.segments)[0];
  if (!targetSegment) {
    return null;
  }

  const expanded = expandCompactPlannerResponse(
    { segments: [targetSegment] },
    input,
    [blueprint],
    'full',
  );

  return safeArray<any>(expanded?.segments)[0] || null;
}

function mergeEnrichedSegmentIntoExistingPlanner(
  existingPlannerState: unknown,
  enrichedSegment: any,
  blueprints: SegmentBlueprint[],
): any {
  if (!existingPlannerState || typeof existingPlannerState !== 'object') {
    return {
      segments: [enrichedSegment],
      days: blueprints.reduce((sum, blueprint) => sum + blueprint.dayCount, 0),
    };
  }

  const existing = existingPlannerState as Record<string, any>;
  let replaced = false;
  const nextSegments = safeArray<any>(existing?.segments).map((segment) => {
    const matches = segment?.id === enrichedSegment?.id
      || normalizeLabel(segment?.city) === normalizeLabel(enrichedSegment?.city);

    if (!matches) {
      return segment;
    }

    replaced = true;
    return {
      ...segment,
      ...enrichedSegment,
      contentStatus: 'ready',
      contentError: undefined,
      hotelPlan: {
        ...enrichedSegment?.hotelPlan,
        ...segment?.hotelPlan,
        city: enrichedSegment?.city || segment?.hotelPlan?.city || segment?.city,
        checkinDate: enrichedSegment?.startDate || segment?.hotelPlan?.checkinDate,
        checkoutDate: enrichedSegment?.endDate || segment?.hotelPlan?.checkoutDate,
      },
      transportIn: segment?.transportIn ?? enrichedSegment?.transportIn,
      transportOut: segment?.transportOut ?? enrichedSegment?.transportOut,
    };
  });

  if (!replaced) {
    nextSegments.push(enrichedSegment);
  }

  return {
    ...existing,
    days: blueprints.reduce((sum, blueprint) => sum + blueprint.dayCount, 0),
    segments: nextSegments,
  };
}

function buildPlannerRequestContext(input: PlannerRequest, blueprints: SegmentBlueprint[]) {
  const destinationsText = input.destinations.join(', ');
  const currentDate = new Date().toISOString().split('T')[0];
  const travelerProfile = inferTravelerProfile(input);
  const profileGuidelines = buildProfileGuidelines(travelerProfile);
  const requestContext = compactPromptValue({
    currentDate,
    destinations: input.destinations,
    days: blueprints.reduce((sum, blueprint) => sum + blueprint.dayCount, 0),
    startDate: input.startDate,
    endDate: input.endDate,
    isFlexibleDates: Boolean(input.isFlexibleDates),
    flexibleMonth: input.flexibleMonth,
    flexibleYear: input.flexibleYear,
    budgetLevel: input.budgetLevel,
    budgetAmount: input.budgetAmount,
    interests: safeArray(input.interests),
    pace: input.pace || 'balanced',
    hotelCategory: input.hotelCategory,
    travelers: input.travelers || { adults: 2, children: 0, infants: 0 },
    constraints: safeArray(input.constraints),
    travelerProfile,
    editIntent: summarizeEditIntent(input.editIntent),
    targetSegments: blueprints.map((blueprint) => compactPromptValue({
      city: blueprint.city,
      dayCount: blueprint.dayCount,
      startDate: blueprint.startDate,
      endDate: blueprint.endDate,
      previousCity: blueprint.previousCity,
    })),
    existingState: summarizeExistingPlannerState(input.existingPlannerState, input.editIntent),
  });
  const requestContextJson = JSON.stringify(requestContext ?? null);

  return {
    currentDate,
    travelerProfile,
    profileGuidelines,
    requestContextJson,
    destinationsText,
  };
}

function buildDetailedPlannerPrompt(input: PlannerRequest, blueprints: SegmentBlueprint[]): string {
  const { travelerProfile, profileGuidelines, requestContextJson, destinationsText } = buildPlannerRequestContext(input, blueprints);

  return `You create compact Spanish JSON for a travel planner.
Return ONLY valid JSON matching OUTPUT_TEMPLATE. No markdown. No commentary.

TASK:
Create or update a realistic travel plan for ${destinationsText}.

IMPORTANT:
- The server will generate ids, exact dates per day, hotel placeholders, transport placeholders, top-level destinations, days, travelers, budget, and activity times.
- Do NOT output those deterministic fields.
- You only provide the human content of the plan.

MUST FOLLOW:
- Return exactly ${blueprints.length} segments in the exact order from REQUEST_CONTEXT.targetSegments.
- Each segment must contain exactly the requested dayCount.
- Respect the traveler profile "${travelerProfile}": ${profileGuidelines}
- If editIntent exists, preserve unaffected structure and modify only what the request implies.
- First day of each segment after the first should feel lighter because it is a transfer day.

OUTPUT LIMITS:
- title: short.
- title should feel specific to the actual destination(s) or route, not just to a mood.
- summary: max 22 words.
- generalTips: 0 to 3 items total.
- segment summary: max 18 words.
- day title: max 8 words.
- day summary: max 16 words.
- morning, afternoon, evening: 0 to 1 activity each.
- Activity objects should usually include only "title" and optional "category".
- Omit times unless absolutely necessary; the server adds times.
- restaurants: 0 to 1 item per day.
- travelTip: optional, max 12 words.
- No prices, ticket costs, exact opening hours, or stale details.

REQUEST_CONTEXT:
${requestContextJson}

OUTPUT_TEMPLATE:
{
  "title": "Trip title",
  "summary": "Short overview",
  "generalTips": ["tip 1", "tip 2"],
  "segments": [
    {
      "city": "Madrid",
      "country": "Spain",
      "summary": "Short segment summary",
      "days": [
        {
          "title": "Prado y Retiro",
          "summary": "Arte y paseo clásico",
          "morning": [{ "title": "Museo del Prado", "category": "Museo" }],
          "afternoon": [{ "title": "Parque del Retiro", "category": "Paseo" }],
          "evening": [{ "title": "Tapas en La Latina", "category": "Gastronomia" }],
          "restaurants": [{ "name": "Casa Dani", "type": "Tapas", "priceRange": "$$" }],
          "travelTip": "Conviene moverse en metro."
        }
      ]
    }
  ]
}`;
}

function buildSkeletonPlannerPrompt(input: PlannerRequest, blueprints: SegmentBlueprint[]): string {
  const { travelerProfile, profileGuidelines, requestContextJson, destinationsText } = buildPlannerRequestContext(input, blueprints);

  return `You create concise Spanish JSON for the first draft of a travel planner.
Return ONLY valid JSON matching OUTPUT_TEMPLATE. No markdown. No commentary.

TASK:
Create a fast skeleton plan for ${destinationsText}.

IMPORTANT:
- This is a skeleton-first pass. Keep it short.
- The server will later enrich segments on demand.
- Do NOT output ids, exact dates per day, hotel placeholders, transport placeholders, prices, opening hours, or long descriptions.

MUST FOLLOW:
- Return exactly ${blueprints.length} segments in the exact order from REQUEST_CONTEXT.targetSegments.
- Each segment must contain exactly the requested dayCount.
- Respect the traveler profile "${travelerProfile}": ${profileGuidelines}
- First day of each segment after the first should feel lighter because it is a transfer day.

OUTPUT LIMITS:
- title: short.
- title should feel specific to the actual destination(s) or route, not just to a mood.
- summary: max 18 words.
- generalTips: 0 to 2 items total.
- segment summary: max 14 words.
- segment highlights: 2 to 4 items, max 4 words each.
- day title: max 7 words.
- day summary: max 12 words.
- Each segment should include highlights with the main must-see activities, neighborhoods, or anchor experiences for that destination.
- Do not include morning, afternoon, evening, restaurants, or travelTip in this pass.

REQUEST_CONTEXT:
${requestContextJson}

OUTPUT_TEMPLATE:
{
  "title": "Trip title",
  "summary": "Short overview",
  "generalTips": ["tip 1"],
  "segments": [
    {
      "city": "Madrid",
      "country": "Spain",
      "summary": "Short segment summary",
      "highlights": ["Museo del Prado", "Parque del Retiro", "Gran Via"],
      "days": [
        {
          "title": "Prado y Retiro",
          "summary": "Arte y paseo"
        }
      ]
    }
  ]
}`;
}

function buildSegmentEnrichmentPrompt(input: PlannerRequest, blueprints: SegmentBlueprint[]): string {
  const targetBlueprint = getTargetSegmentBlueprint(input, blueprints);
  if (!targetBlueprint) {
    throw new Error('Target segment is required for segment enrichment');
  }

  const { travelerProfile, profileGuidelines, requestContextJson } = buildPlannerRequestContext(input, blueprints);
  const targetContext = JSON.stringify(compactPromptValue({
    city: targetBlueprint.city,
    segmentId: targetBlueprint.segmentId,
    dayCount: targetBlueprint.dayCount,
    startDate: targetBlueprint.startDate,
    endDate: targetBlueprint.endDate,
    previousCity: targetBlueprint.previousCity,
    existingSegment: targetBlueprint.existingSegment
      ? compactPromptValue({
          id: targetBlueprint.existingSegment.id,
          city: targetBlueprint.existingSegment.city,
          summary: truncateText(targetBlueprint.existingSegment.summary, 72),
          days: safeArray<any>(targetBlueprint.existingSegment.days).map((day) =>
            compactPromptValue({
              id: day?.id,
              dayNumber: day?.dayNumber,
              title: truncateText(day?.title, 64),
              summary: truncateText(day?.summary, 96),
            })
          ),
        })
      : undefined,
  }) ?? null);

  return `You create compact Spanish JSON for ONE segment of a travel planner.
Return ONLY valid JSON matching OUTPUT_TEMPLATE. No markdown. No commentary.

TASK:
Enrich the target segment with a more useful day-by-day plan.

IMPORTANT:
- Only return ONE segment, the target segment from TARGET_SEGMENT.
- Keep the same city and exactly the same dayCount.
- Preserve the skeleton intent when reasonable, but improve it with realistic content.
- Do NOT output ids, exact dates, hotel placeholders, or transport placeholders.

MUST FOLLOW:
- Respect the traveler profile "${travelerProfile}": ${profileGuidelines}
- Morning, afternoon, evening: 0 to 1 activity each.
- Restaurants: 0 to 1 item per day.
- travelTip: optional, max 12 words.
- No prices, opening hours, or stale details.

REQUEST_CONTEXT:
${requestContextJson}

TARGET_SEGMENT:
${targetContext}

OUTPUT_TEMPLATE:
{
  "segments": [
    {
      "city": "Madrid",
      "country": "Spain",
      "summary": "Short segment summary",
      "days": [
        {
          "title": "Prado y Retiro",
          "summary": "Arte y paseo clásico",
          "morning": [{ "title": "Museo del Prado", "category": "Museo" }],
          "afternoon": [{ "title": "Parque del Retiro", "category": "Paseo" }],
          "evening": [{ "title": "Tapas en La Latina", "category": "Gastronomia" }],
          "restaurants": [{ "name": "Casa Dani", "type": "Tapas", "priceRange": "$$" }],
          "travelTip": "Conviene moverse en metro."
        }
      ]
    }
  ]
}`;
}

function buildPlannerPrompt(
  input: PlannerRequest,
  blueprints: SegmentBlueprint[],
  mode: PlannerGenerationMode,
): string {
  if (mode === 'skeleton') {
    return buildSkeletonPlannerPrompt(input, blueprints);
  }

  if (mode === 'segment') {
    return buildSegmentEnrichmentPrompt(input, blueprints);
  }

  return buildDetailedPlannerPrompt(input, blueprints);
}

function buildPlannerUserMessage(
  input: PlannerRequest,
  blueprints: SegmentBlueprint[],
  mode: PlannerGenerationMode,
): string {
  if (mode === 'segment') {
    const targetBlueprint = getTargetSegmentBlueprint(input, blueprints);
    return `Enrich only the segment for ${targetBlueprint?.city || 'the target city'} and keep exactly ${targetBlueprint?.dayCount || 1} days.`;
  }

  if (mode === 'skeleton') {
    return `Generate only the fast skeleton planner for ${input.destinations.join(', ')} with ${blueprints.reduce((sum, blueprint) => sum + blueprint.dayCount, 0)} days.`;
  }

  return `Generate the planner now for ${input.destinations.join(', ')} with ${blueprints.reduce((sum, blueprint) => sum + blueprint.dayCount, 0)} days. Keep the JSON compact and follow REQUEST_CONTEXT exactly.`;
}

function extractJsonCandidate(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : raw;
}

function sanitizeJsonCandidate(raw: string): string {
  return raw
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

function getParseErrorContext(raw: string, parseError: unknown): { position?: number; snippet?: string } {
  const message = parseError instanceof Error ? parseError.message : String(parseError);
  const positionMatch = message.match(/position\s+(\d+)/i);
  const position = positionMatch ? Number(positionMatch[1]) : undefined;

  if (position === undefined || Number.isNaN(position)) {
    return {};
  }

  const start = Math.max(0, position - 120);
  const end = Math.min(raw.length, position + 120);
  return {
    position,
    snippet: raw.slice(start, end),
  };
}

async function repairPlannerJsonWithOpenAi(
  malformedJson: string,
  openaiApiKey: string,
): Promise<{ repairedJson: string; finishReason: string | null }> {
  const repairMaxTokens = Math.min(3800, Math.max(1400, Math.round(malformedJson.length * 0.45)));
  const repairResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You repair malformed JSON. Return only valid JSON. Preserve structure and values when possible. Do not add explanations.',
        },
        {
          role: 'user',
          content: malformedJson,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: repairMaxTokens,
    }),
  });

  if (!repairResponse.ok) {
    const errorText = await repairResponse.text();
    throw new Error(`OpenAI repair failed: ${repairResponse.status} ${errorText}`);
  }

  const repairData = await repairResponse.json();
  const repairedJson = repairData?.choices?.[0]?.message?.content?.trim();
  if (!repairedJson) {
    throw new Error('OpenAI repair returned empty content');
  }

  return {
    repairedJson,
    finishReason: repairData?.choices?.[0]?.finish_reason ?? null,
  };
}

async function requestPlannerCompletion(
  openaiApiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<any> {
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });

  if (!openaiResponse.ok) {
    const errorData = await openaiResponse.text();
    console.error('❌ OpenAI API error:', errorData);
    throw new Error(`OpenAI API error: ${openaiResponse.status}`);
  }

  return await openaiResponse.json();
}

function normalizePlannerResponse(
  raw: any,
  input: PlannerRequest,
  blueprints: SegmentBlueprint[],
  mode: PlannerGenerationMode,
  debugContext: TimingDetails = {},
) {
  const days = calculateDays(input.startDate, input.endDate, input.days);
  const targetDays = blueprints.reduce((sum, blueprint) => sum + blueprint.dayCount, 0) || days;
  const preserveDates = shouldKeepGeneratedDates(input);
  const compactExpansionStart = nowMs();
  const sourceRaw = isCompactPlannerResponse(raw)
    ? expandCompactPlannerResponse(raw, input, blueprints, mode)
    : raw;
  logTimingStep('TRAVEL-ITINERARY', 'expand compact planner response', compactExpansionStart, {
    ...debugContext,
    usedCompactExpansion: sourceRaw !== raw,
    segmentCount: safeArray<any>(sourceRaw?.segments).length,
  });

  const datesStart = nowMs();
  const segments = preserveDates
    ? safeArray<any>(sourceRaw?.segments)
    : stripGeneratedDates(safeArray<any>(sourceRaw?.segments));
  logTimingStep('TRAVEL-ITINERARY', preserveDates ? 'preserve generated dates' : 'strip generated dates', datesStart, {
    ...debugContext,
    segmentCount: segments.length,
  });

  const schedulingStart = nowMs();
  const scheduledRaw = normalizeScheduling({ ...sourceRaw, segments }, input, debugContext);
  const scheduledSegments = safeArray<any>(scheduledRaw?.segments);
  const itinerary = scheduledSegments.flatMap((segment) => safeArray<any>(segment?.days));
  logTimingStep('TRAVEL-ITINERARY', 'apply scheduling to normalized response', schedulingStart, {
    ...debugContext,
    segmentCount: scheduledSegments.length,
    itineraryDays: itinerary.length,
  });

  return {
    title: sourceRaw?.title || `Viaje por ${input.destinations.join(', ')}`,
    summary: sourceRaw?.summary || sourceRaw?.introduction || (input.isFlexibleDates
      ? `Un recorrido flexible de ${days} días por ${input.destinations.join(', ')} en ${formatFlexibleMonth(input.flexibleMonth, input.flexibleYear)}.`
      : 'Plan de viaje generado.'),
    destinations: safeArray(sourceRaw?.destinations).length > 0 ? sourceRaw.destinations : input.destinations,
    days: targetDays,
    startDate: preserveDates ? (input.startDate || sourceRaw?.startDate) : undefined,
    endDate: preserveDates ? (input.endDate || sourceRaw?.endDate) : undefined,
    isFlexibleDates: Boolean(input.isFlexibleDates),
    flexibleMonth: input.flexibleMonth,
    flexibleYear: input.flexibleYear,
    budgetLevel: sourceRaw?.budgetLevel || input.budgetLevel,
    budgetAmount: sourceRaw?.budgetAmount ?? input.budgetAmount ?? null,
    interests: safeArray(sourceRaw?.interests).length > 0 ? sourceRaw.interests : safeArray(input.interests),
    pace: sourceRaw?.pace || input.pace,
    travelers: sourceRaw?.travelers || input.travelers || { adults: 2, children: 0, infants: 0 },
    constraints: safeArray(sourceRaw?.constraints).length > 0 ? sourceRaw.constraints : safeArray(input.constraints),
    generalTips: safeArray(sourceRaw?.generalTips),
    segments: scheduledSegments,
    itinerary,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  return await withRateLimit(
    req,
    supabase,
    { action: 'api_call', resource: 'travel-itinerary' },
    async () => {
      const requestId = crypto.randomUUID().slice(0, 8);
      const timer = createTimingLogger('TRAVEL-ITINERARY', { requestId });
      try {
        const requestParseStart = nowMs();
        const body = await req.json() as PlannerRequest;
        const parseRequestMs = timer.step('parse request body', requestParseStart, {
          destinationCount: safeArray(body.destinations).length,
          hasExistingPlannerState: Boolean(body.existingPlannerState),
          editAction: body.editIntent?.action ?? null,
        });

        const validationStart = nowMs();
        const days = calculateDays(body.startDate, body.endDate, body.days);

        if (!body.destinations || !Array.isArray(body.destinations) || body.destinations.length === 0) {
          throw new Error('Destinations array is required');
        }

        if (!days || days < 1) {
          throw new Error('Days must be a positive number or derivable from startDate/endDate');
        }

        const generationMode = resolveGenerationMode(body);
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiApiKey) throw new Error('OpenAI API key not configured');
        const segmentBlueprints = buildSegmentBlueprints(body);
        const targetBlueprint = generationMode === 'segment'
          ? getTargetSegmentBlueprint(body, segmentBlueprints)
          : null;

        if (generationMode === 'segment') {
          if (!body.existingPlannerState || typeof body.existingPlannerState !== 'object') {
            throw new Error('existingPlannerState is required for segment enrichment');
          }

          if (!targetBlueprint) {
            throw new Error('Target segment is required for segment enrichment');
          }
        }

        const validateRequestMs = timer.step('validate request', validationStart, {
          destinationCount: body.destinations.length,
          days,
          isFlexibleDates: Boolean(body.isFlexibleDates),
          generationMode,
        });
        const promptStart = nowMs();
        const systemPrompt = buildPlannerPrompt(body, segmentBlueprints, generationMode);
        const userMessage = buildPlannerUserMessage(body, segmentBlueprints, generationMode);
        const buildPromptMs = timer.step('build planner prompt', promptStart, {
          days,
          destinationCount: body.destinations.length,
          blueprintDays: segmentBlueprints.reduce((sum, blueprint) => sum + blueprint.dayCount, 0),
          generationMode,
          promptChars: systemPrompt.length,
        });
        const targetDays = targetBlueprint?.dayCount || days;
        let maxCompletionTokens = generationMode === 'skeleton'
          ? Math.min(2000, Math.max(900, days * 55 + body.destinations.length * 80 + 180))
          : generationMode === 'segment'
            ? Math.min(2400, Math.max(1200, targetDays * 160 + 380))
            : Math.min(4200, Math.max(2200, days * 200 + body.destinations.length * 240 + 300));

        const openaiFetchStart = nowMs();
        let openaiData = await requestPlannerCompletion(
          openaiApiKey,
          systemPrompt,
          userMessage,
          maxCompletionTokens,
        );
        let openaiUsage = openaiData?.usage || {};
        let openaiFinishReason = openaiData?.choices?.[0]?.finish_reason ?? null;
        const callOpenAiMs = timer.step('call OpenAI', openaiFetchStart, {
          model: 'gpt-4o-mini',
          maxCompletionTokens,
          finishReason: openaiFinishReason,
          promptTokens: openaiUsage.prompt_tokens ?? null,
          completionTokens: openaiUsage.completion_tokens ?? null,
          totalTokens: openaiUsage.total_tokens ?? null,
        });
        let retryOpenAiMs: number | null = null;

        if (openaiFinishReason === 'length') {
          const retryMaxCompletionTokens = generationMode === 'skeleton'
            ? Math.min(2600, Math.max(maxCompletionTokens + 400, Math.round(maxCompletionTokens * 1.35)))
            : generationMode === 'segment'
              ? Math.min(3200, Math.max(maxCompletionTokens + 700, Math.round(maxCompletionTokens * 1.4)))
              : Math.min(5200, Math.max(maxCompletionTokens + 1200, Math.round(maxCompletionTokens * 1.5)));
          const retryStart = nowMs();
          openaiData = await requestPlannerCompletion(
            openaiApiKey,
            systemPrompt,
            userMessage,
            retryMaxCompletionTokens,
          );
          openaiUsage = openaiData?.usage || {};
          openaiFinishReason = openaiData?.choices?.[0]?.finish_reason ?? null;
          retryOpenAiMs = timer.step('retry OpenAI after length finish', retryStart, {
            previousMaxCompletionTokens: maxCompletionTokens,
            retryMaxCompletionTokens,
            finishReason: openaiFinishReason,
            promptTokens: openaiUsage.prompt_tokens ?? null,
            completionTokens: openaiUsage.completion_tokens ?? null,
            totalTokens: openaiUsage.total_tokens ?? null,
          });
          maxCompletionTokens = retryMaxCompletionTokens;
        }

        const openaiPayloadStart = nowMs();
        const parseOpenAiPayloadMs = timer.step('parse OpenAI payload', openaiPayloadStart, {
          model: openaiData?.model ?? 'gpt-4o-mini',
          promptTokens: openaiUsage.prompt_tokens ?? null,
          completionTokens: openaiUsage.completion_tokens ?? null,
          totalTokens: openaiUsage.total_tokens ?? null,
          finishReason: openaiFinishReason,
        });

        const extractContentStart = nowMs();
        const aiResponse = openaiData.choices[0]?.message?.content;

        if (!aiResponse) {
          throw new Error('No response from OpenAI');
        }

        const cleanedResponse = aiResponse.trim()
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/gi, '')
          .replace(/^\uFEFF/, '');
        const extractAiContentMs = timer.step('extract AI content', extractContentStart, {
          cleanedChars: cleanedResponse.length,
        });

        let parsed;
        let parseStrategy = 'direct';
        const parsePlannerJsonStart = nowMs();
        try {
          parsed = JSON.parse(cleanedResponse);
        } catch (parseError) {
          const extractedCandidate = extractJsonCandidate(cleanedResponse);
          try {
            if (extractedCandidate !== cleanedResponse) {
              parseStrategy = 'regex_extract';
              parsed = JSON.parse(extractedCandidate);
            } else {
              throw parseError;
            }
          } catch {
            const sanitizedCandidate = sanitizeJsonCandidate(extractedCandidate);
            try {
              parseStrategy = 'sanitized';
              parsed = JSON.parse(sanitizedCandidate);
            } catch (sanitizedParseError) {
              const parseErrorContext = getParseErrorContext(sanitizedCandidate, sanitizedParseError);
              console.warn('⚠️ Failed to parse planner JSON, attempting repair', {
                requestId,
                finishReason: openaiFinishReason,
                cleanedChars: cleanedResponse.length,
                ...parseErrorContext,
              });

              const repairStart = nowMs();
              const { repairedJson, finishReason: repairFinishReason } = await repairPlannerJsonWithOpenAi(
                sanitizedCandidate,
                openaiApiKey,
              );
              timer.step('repair planner JSON via OpenAI', repairStart, {
                inputChars: sanitizedCandidate.length,
                outputChars: repairedJson.length,
                finishReason: repairFinishReason,
              });

              parseStrategy = 'openai_repair';
              parsed = JSON.parse(sanitizeJsonCandidate(repairedJson));
            }
          }
        }
        const parsePlannerJsonMs = timer.step('parse planner JSON', parsePlannerJsonStart, {
          parseStrategy,
          segmentCount: safeArray<any>(parsed?.segments).length,
          finishReason: openaiFinishReason,
        });

        const normalizeStart = nowMs();
        let rawForNormalization = parsed;
        if (generationMode === 'segment') {
          if (!targetBlueprint) {
            throw new Error('Target segment blueprint missing during segment enrichment');
          }

          const enrichedSegment = expandCompactTargetSegment(parsed, body, targetBlueprint);
          if (!enrichedSegment) {
            throw new Error('Could not expand enriched segment');
          }

          rawForNormalization = mergeEnrichedSegmentIntoExistingPlanner(
            body.existingPlannerState,
            enrichedSegment,
            segmentBlueprints,
          );
        }

        const normalized = normalizePlannerResponse(rawForNormalization, body, segmentBlueprints, generationMode, {
          requestId,
          generationMode,
        });
        const normalizePlannerMs = timer.step('normalize planner response', normalizeStart, {
          segmentCount: safeArray<any>(normalized?.segments).length,
          itineraryDays: safeArray<any>(normalized?.itinerary).length,
          generationMode,
        });

        const totalMs = timer.end('total', {
          segmentCount: safeArray<any>(normalized?.segments).length,
          itineraryDays: safeArray<any>(normalized?.itinerary).length,
        });

        const timing = {
          requestId,
          totalMs,
          steps: {
            parseRequestMs,
            validateRequestMs,
            buildPromptMs,
            callOpenAiMs,
            retryOpenAiMs,
            parseOpenAiPayloadMs,
            extractAiContentMs,
            parsePlannerJsonMs,
            normalizePlannerMs,
          },
          openai: {
            model: openaiData?.model ?? 'gpt-4o-mini',
            promptTokens: openaiUsage.prompt_tokens ?? null,
            completionTokens: openaiUsage.completion_tokens ?? null,
            totalTokens: openaiUsage.total_tokens ?? null,
            finishReason: openaiFinishReason,
          },
        };

        return new Response(JSON.stringify({
          success: true,
          data: normalized,
          timing,
          requestId,
          timestamp: new Date().toISOString()
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } catch (error: any) {
        timer.fail('total', error);
        console.error('❌ Travel Itinerary Generator error:', error);
        const errorMessage = error?.message || 'Unknown error occurred';
        const statusCode = errorMessage.includes('OpenAI') ? 502 : 500;

        return new Response(JSON.stringify({
          success: false,
          error: errorMessage,
          errorType: error?.constructor?.name || 'Error',
          requestId,
          timestamp: new Date().toISOString()
        }), {
          status: statusCode,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
  );
});
