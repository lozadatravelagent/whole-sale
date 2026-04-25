import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { MakeBudgetParams } from '@/services/hotelSearch';
import type { FlightData, LocalHotelData } from '@/types/external';
import type {
  PlannerActivity,
  PlannerBudgetLevel,
  PlannerDay,
  PlannerFieldProvenance,
  PlannerGenerationSource,
  PlannerActivityType,
  PlannerSegmentContentStatus,
  PlannerLocation,
  PlannerPace,
  PlannerPlaceCategory,
  PlannerRestaurant,
  PlannerSegment,
  PlannerSuggestion,
  TripPlannerState,
  RegionalRoute,
  RegionalExpansionResult,
} from './types';
import regionalRoutesData from '@/data/regional_routes.json';
import countryRoutesData from '@/data/country_routes.json';
import { resolveCountryToCapital } from '@/services/countryCapitalResolver';
import { classifyPlannerActivityType, normalizePlannerSegmentsScheduling } from './scheduling';
import { FALLBACK_CITY_COORDINATES_FLAT } from './services/plannerGeocoding';

// ---------------------------------------------------------------------------
// Haversine distance helpers
// ---------------------------------------------------------------------------

export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export type HotelDistanceTag = 'centro' | 'cercano' | 'alejado';

export function getHotelDistanceTag(km: number): HotelDistanceTag {
  if (km <= 2) return 'centro';
  if (km <= 5) return 'cercano';
  return 'alejado';
}

export function formatHotelDistanceLabel(tag: HotelDistanceTag): string {
  if (tag === 'centro') return 'Centro';
  if (tag === 'cercano') return 'Cercano al centro';
  return 'Alejado del centro';
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function uniqueStringList(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = value?.trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });

  return result;
}

function joinHumanList(values: string[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} y ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} y ${values[values.length - 1]}`;
}

function buildPlannerMeta(
  source: PlannerGenerationSource,
  overrides?: Partial<TripPlannerState['generationMeta']>
): TripPlannerState['generationMeta'] {
  return {
    source,
    updatedAt: overrides?.updatedAt || new Date().toISOString(),
    version: overrides?.version || 1,
    uiPhase: overrides?.uiPhase || (source === 'template' ? 'template' : source === 'draft' ? 'draft_parsing' : 'ready'),
    isDraft: overrides?.isDraft ?? (source === 'draft'),
    draftOriginMessage: overrides?.draftOriginMessage,
  };
}

function activityToPlannerActivity(activity: Record<string, unknown>, index: number, segmentId: string, dayNumber: number, block: string): PlannerActivity {
  const title = activity?.title || activity?.activity || activity?.name || 'Actividad';
  const activityType = (activity?.activityType as PlannerActivityType | undefined) || classifyPlannerActivityType(activity || {});
  return {
    id: `${segmentId}-day-${dayNumber}-${block}-${index + 1}`,
    time: activity?.time,
    title,
    description: activity?.description || activity?.detail,
    tip: activity?.tip,
    category: activity?.category,
    activityType,
    recommendedSlot: activity?.recommendedSlot || (block as 'morning' | 'afternoon' | 'evening'),
    durationMinutes: activity?.durationMinutes,
    schedulingConfidence: activity?.schedulingConfidence,
    neighborhood: activity?.neighborhood,
    source: activity?.source || 'generated',
    placeId: activity?.placeId,
    formattedAddress: activity?.formattedAddress,
    rating: typeof activity?.rating === 'number' ? activity.rating : undefined,
    userRatingsTotal: typeof activity?.userRatingsTotal === 'number' ? activity.userRatingsTotal : undefined,
    photoUrls: safeArray<string>(activity?.photoUrls),
  };
}

function restaurantToPlannerRestaurant(restaurant: Record<string, unknown>, index: number, segmentId: string, dayNumber: number): PlannerRestaurant {
  return {
    id: `${segmentId}-day-${dayNumber}-restaurant-${index + 1}`,
    name: restaurant?.name || 'Restaurante',
    type: restaurant?.type,
    priceRange: restaurant?.priceRange,
    placeId: restaurant?.placeId,
    formattedAddress: restaurant?.formattedAddress,
    rating: typeof restaurant?.rating === 'number' ? restaurant.rating : undefined,
    userRatingsTotal: typeof restaurant?.userRatingsTotal === 'number' ? restaurant.userRatingsTotal : undefined,
    photoUrls: safeArray<string>(restaurant?.photoUrls),
    source: restaurant?.source || 'generated',
  };
}

function legacyDayToPlannerDay(rawDay: Record<string, unknown>, index: number, city: string, segmentId: string): PlannerDay {
  const dayNumber = (rawDay?.day as number) || index + 1;
  return {
    id: `${segmentId}-day-${dayNumber}`,
    dayNumber,
    date: rawDay?.date as string | undefined,
    city: (rawDay?.city as string) || city,
    title: (rawDay?.title as string) || `Día ${dayNumber}`,
    summary: rawDay?.summary as string | undefined,
    morning: safeArray(rawDay?.morning as unknown[]).map((item, itemIndex) =>
      activityToPlannerActivity(item as Record<string, unknown>, itemIndex, segmentId, dayNumber, 'morning')
    ),
    afternoon: safeArray(rawDay?.afternoon as unknown[]).map((item, itemIndex) =>
      activityToPlannerActivity(item as Record<string, unknown>, itemIndex, segmentId, dayNumber, 'afternoon')
    ),
    evening: safeArray(rawDay?.evening as unknown[]).map((item, itemIndex) =>
      activityToPlannerActivity(item as Record<string, unknown>, itemIndex, segmentId, dayNumber, 'evening')
    ),
    restaurants: safeArray(rawDay?.restaurants as unknown[]).map((item, itemIndex) =>
      restaurantToPlannerRestaurant(item as Record<string, unknown>, itemIndex, segmentId, dayNumber)
    ),
    travelTip: rawDay?.travelTip as string | undefined,
  };
}

function normalizePlannerLocation(rawLocation: Record<string, unknown> | null | undefined, fallbackCity: string, fallbackCountry?: string): PlannerLocation | undefined {
  if (!rawLocation) return undefined;

  const lat = Number(rawLocation?.lat);
  const lng = Number(rawLocation?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined;
  }

  return {
    city: rawLocation?.city || fallbackCity,
    country: rawLocation?.country || fallbackCountry,
    lat,
    lng,
    placeLabel: rawLocation?.placeLabel,
    source: rawLocation?.source,
  };
}

function normalizePlannerHighlights(rawHighlights: unknown): string[] {
  return uniqueStringList(
    safeArray<unknown>(rawHighlights as unknown[]).map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        return item.title || item.name || item.label;
      }
      return undefined;
    })
  ).slice(0, 4);
}

function normalizePlannerPlaceHotelCandidate(rawCandidate: Record<string, unknown>) {
  if (!rawCandidate?.placeId || !rawCandidate?.name) {
    return null;
  }

  return {
    placeId: String(rawCandidate.placeId),
    name: String(rawCandidate.name),
    formattedAddress: rawCandidate.formattedAddress,
    rating: typeof rawCandidate.rating === 'number' ? rawCandidate.rating : undefined,
    userRatingsTotal: typeof rawCandidate.userRatingsTotal === 'number' ? rawCandidate.userRatingsTotal : undefined,
    photoUrls: safeArray<string>(rawCandidate.photoUrls),
    types: safeArray<string>(rawCandidate.types),
    lat: typeof rawCandidate.lat === 'number' ? rawCandidate.lat : undefined,
    lng: typeof rawCandidate.lng === 'number' ? rawCandidate.lng : undefined,
    website: rawCandidate.website,
    phoneNumber: rawCandidate.phoneNumber,
    openingHours: safeArray<string>(rawCandidate.openingHours),
    isOpenNow: typeof rawCandidate.isOpenNow === 'boolean' ? rawCandidate.isOpenNow : undefined,
    category: (rawCandidate.category || 'hotel') as PlannerPlaceCategory,
    activityType: rawCandidate.activityType,
    source: rawCandidate.source || 'google_maps',
    hotelId: rawCandidate.hotelId,
    hotel: rawCandidate.hotel || null,
    provider: rawCandidate.provider,
  };
}

function normalizePlannerInventoryMatchCandidates(rawCandidates: unknown) {
  return safeArray<Record<string, unknown>>(rawCandidates as Record<string, unknown>[])
    .map((candidate) => {
      const hotel = candidate?.hotel;
      if (!hotel) return null;

      return {
        hotelId: candidate?.hotelId || getPlannerHotelDisplayId(hotel),
        name: candidate?.name || hotel.name,
        city: candidate?.city || hotel.city,
        distanceKm: typeof candidate?.distanceKm === 'number' ? candidate.distanceKm : undefined,
        distanceTag: candidate?.distanceTag,
        linkedSearchId: candidate?.linkedSearchId,
        hotel,
      };
    })
    .filter(Boolean);
}

function buildSegmentFromLegacyItinerary(raw: Record<string, unknown>): PlannerSegment {
  const destinations = safeArray<string>(raw?.destinations);
  const city = destinations[0] || 'Destino';
  const segmentId = `segment-${slugify(city) || 'destination'}-1`;
  const days = safeArray<Record<string, unknown>>(raw?.itinerary as Record<string, unknown>[]).map((day, index) => legacyDayToPlannerDay(day, index, city, segmentId));

  return {
    id: segmentId,
    city,
    order: 0,
    summary: raw?.introduction,
    startDate: days[0]?.date,
    endDate: days[days.length - 1]?.date,
    nights: days.length,
    hotelPlan: {
      city,
      checkinDate: days[0]?.date,
      checkoutDate: days[days.length - 1]?.date,
      searchStatus: 'idle',
      matchStatus: 'idle',
      hotelRecommendations: [],
      lastSearchSignature: undefined,
    },
    transportIn: null,
    transportOut: null,
    days,
  };
}

function normalizeSegment(rawSegment: Record<string, unknown>, index: number): PlannerSegment {
  const city = (rawSegment?.city as string) || (rawSegment?.destination as string) || `Destino ${index + 1}`;
  const segmentId = (rawSegment?.id as string) || `segment-${slugify(city) || 'destination'}-${index + 1}`;
  const days = safeArray<Record<string, unknown>>(rawSegment?.days as Record<string, unknown>[]).map((rawDay, dayIndex) =>
    legacyDayToPlannerDay(rawDay, dayIndex, city, segmentId)
  );
  const startDate = rawSegment?.startDate || days[0]?.date;
  const endDate = rawSegment?.endDate || days[days.length - 1]?.date;

  return {
    id: segmentId,
    city,
    country: rawSegment?.country,
    location: normalizePlannerLocation(rawSegment?.location, city, rawSegment?.country),
    order: rawSegment?.order ?? index,
    summary: rawSegment?.summary,
    highlights: normalizePlannerHighlights(rawSegment?.highlights),
    contentStatus: (rawSegment?.contentStatus || 'ready') as PlannerSegmentContentStatus,
    contentError: rawSegment?.contentError,
    realPlacesStatus: rawSegment?.realPlacesStatus || 'idle',
    realPlacesError: rawSegment?.realPlacesError,
    startDate,
    endDate,
    nights: rawSegment?.nights ?? days.length,
    hotelPlan: {
      city,
      checkinDate: startDate,
      checkoutDate: endDate,
      requestedMealPlan: rawSegment?.hotelPlan?.requestedMealPlan || rawSegment?.hotelSummary?.mealPlan,
      requestedStars: rawSegment?.hotelPlan?.requestedStars,
      searchStatus: rawSegment?.hotelPlan?.searchStatus || 'idle',
      matchStatus: rawSegment?.hotelPlan?.matchStatus || 'idle',
      selectedHotelId: rawSegment?.hotelPlan?.selectedHotelId,
      selectedPlaceCandidate: normalizePlannerPlaceHotelCandidate(rawSegment?.hotelPlan?.selectedPlaceCandidate),
      inventoryMatchCandidates: normalizePlannerInventoryMatchCandidates(rawSegment?.hotelPlan?.inventoryMatchCandidates),
      confirmedInventoryHotel: rawSegment?.hotelPlan?.confirmedInventoryHotel || null,
      hotelRecommendations: safeArray(rawSegment?.hotelPlan?.hotelRecommendations),
      linkedSearchId: rawSegment?.hotelPlan?.linkedSearchId,
      quoteSearchId: rawSegment?.hotelPlan?.quoteSearchId,
      quoteLastValidatedAt: rawSegment?.hotelPlan?.quoteLastValidatedAt,
      quoteError: rawSegment?.hotelPlan?.quoteError,
      lastSearchSignature: rawSegment?.hotelPlan?.lastSearchSignature,
      error: rawSegment?.hotelPlan?.error,
    },
    transportIn: rawSegment?.transportIn
      ? {
          type: rawSegment.transportIn.type || 'manual',
          summary: rawSegment.transportIn.summary || `${city} transport`,
          origin: rawSegment.transportIn.origin,
          destination: rawSegment.transportIn.destination,
          date: rawSegment.transportIn.date,
          searchStatus: rawSegment.transportIn.searchStatus || 'idle',
          linkedSearchId: rawSegment.transportIn.linkedSearchId,
          selectedOptionId: rawSegment.transportIn.selectedOptionId,
          lastSearchSignature: rawSegment.transportIn.lastSearchSignature,
          options: safeArray(rawSegment.transportIn.options),
          error: rawSegment.transportIn.error,
        }
      : null,
    transportOut: rawSegment?.transportOut
      ? {
          type: rawSegment.transportOut.type || 'manual',
          summary: rawSegment.transportOut.summary || `${city} transport`,
          origin: rawSegment.transportOut.origin,
          destination: rawSegment.transportOut.destination,
          date: rawSegment.transportOut.date,
          searchStatus: rawSegment.transportOut.searchStatus || 'idle',
          linkedSearchId: rawSegment.transportOut.linkedSearchId,
          selectedOptionId: rawSegment.transportOut.selectedOptionId,
          lastSearchSignature: rawSegment.transportOut.lastSearchSignature,
          options: safeArray(rawSegment.transportOut.options),
          error: rawSegment.transportOut.error,
        }
      : null,
    days,
  };
}

function buildDraftSegment(
  city: string,
  index: number,
  destinations: string[],
): PlannerSegment {
  const previousCity = index > 0 ? destinations[index - 1] : undefined;

  return {
    id: `segment-${slugify(city) || 'destination'}-${index + 1}`,
    city,
    order: index,
    summary: index === 0
      ? 'Preparando la propuesta base para este destino.'
      : `Organizando el tramo desde ${formatDestinationLabel(previousCity || '')} hacia ${formatDestinationLabel(city)}.`,
    contentStatus: 'loading',
    realPlacesStatus: 'idle',
    startDate: undefined,
    endDate: undefined,
    nights: undefined,
    hotelPlan: {
      city,
      searchStatus: 'idle',
      matchStatus: 'idle',
      hotelRecommendations: [],
    },
    transportIn: previousCity
      ? {
          type: 'flight',
          summary: `${formatDestinationLabel(previousCity)} a ${formatDestinationLabel(city)}`,
          origin: previousCity,
          destination: city,
          searchStatus: 'idle',
          options: [],
        }
      : null,
    transportOut: null,
    days: [],
  };
}

function buildDraftPlannerTitle(destinations: string[]): string {
  const formatted = destinations.map(formatDestinationLabel);

  if (formatted.length === 0) {
    return 'Nuevo viaje';
  }

  if (formatted.length === 1) {
    return `Viaje a ${formatted[0]}`;
  }

  return `Viaje por ${joinHumanList(formatted)}`;
}

function buildDraftPlannerSummary(
  itinerary: NonNullable<ParsedTravelRequest['itinerary']>,
  destinations: string[],
  days: number
): string {
  const formattedDestinations = destinations.map(formatDestinationLabel);
  const interests = uniqueStringList([
    ...safeArray(itinerary.interests),
    ...safeArray(itinerary.travelStyle),
  ]);
  const budgetLabel = formatBudgetLevel(itinerary.budgetLevel as PlannerBudgetLevel | undefined).toLowerCase();
  const paceLabel = formatPaceLabel(itinerary.pace as PlannerPace | undefined).toLowerCase();
  const dateLabel = itinerary.isFlexibleDates
    ? formatFlexibleMonth(itinerary.flexibleMonth, itinerary.flexibleYear)
    : formatDateRange(itinerary.startDate, itinerary.endDate);

  const parts = [
    formattedDestinations.length > 0
      ? `Armando una propuesta inicial para ${joinHumanList(formattedDestinations)}`
      : 'Armando una propuesta inicial para tu viaje',
    days > 0 ? `de ${days} días` : undefined,
    budgetLabel ? `con presupuesto ${budgetLabel}` : undefined,
    paceLabel ? `y ritmo ${paceLabel}` : undefined,
  ].filter(Boolean);

  const interestText = interests.length > 0
    ? ` Priorizamos ${joinHumanList(interests.map((interest) => interest.toLowerCase()))}.`
    : '';
  const dateText = dateLabel ? ` ${dateLabel}.` : '.';

  return `${parts.join(' ')}.${dateText}${interestText}`.replace(/\.\./g, '.');
}

export function createDraftPlannerFromRequest(
  request: ParsedTravelRequest,
  conversationId?: string,
  fieldProvenance?: PlannerFieldProvenance,
): TripPlannerState | null {
  if (request.requestType !== 'itinerary' || !request.itinerary) {
    return null;
  }

  const itinerary = request.itinerary;
  const rawDestinations = uniqueStringList(safeArray(itinerary.destinations));
  console.log('🌍 [GEO-TRACE-3] createDraftPlannerFromRequest input destinations:', rawDestinations);
  if (rawDestinations.length === 0) {
    return null;
  }

  const exactDays = !itinerary.isFlexibleDates
    ? getInclusiveDateRangeDays(itinerary.startDate, itinerary.endDate)
    : undefined;
  const days = exactDays || itinerary.days || rawDestinations.length || 1;

  // Regional expansion
  const targetMonth = itinerary.flexibleMonth
    ? new Date(`${itinerary.flexibleMonth} 1, 2000`).getMonth() + 1
    : itinerary.startDate
      ? new Date(itinerary.startDate).getMonth() + 1
      : undefined;
  const { expandedDestinations, regionalMeta, seasonalityAlert, cityWeights } =
    expandDestinationsIfRegional(rawDestinations, days, targetMonth);
  const destinations = expandedDestinations;
  // User's explicit days are preserved — never overridden by regional suggestedDays

  const interests = uniqueStringList([
    ...safeArray(itinerary.interests),
    ...safeArray(itinerary.travelStyle),
  ]);

  const notes: string[] = [];
  if (!itinerary.startDate && !itinerary.endDate && !itinerary.isFlexibleDates) {
    notes.push('Definí fechas para habilitar cotización real de hoteles y transporte.');
  }
  if (seasonalityAlert) {
    notes.push(seasonalityAlert);
  }

  // Build segments with weighted day distribution if regional
  let segments: PlannerSegment[];
  if (cityWeights && cityWeights.size > 0) {
    segments = destinations.map((city, index) => {
      const w = cityWeights.get(city.toLowerCase());
      const seg = buildDraftSegment(city, index, destinations);
      if (w) {
        // Weighted days will be applied after full generation
        seg.nights = Math.max(0, w.minDays - 1);
      }
      return seg;
    });
  } else {
    segments = destinations.map((city, index) => buildDraftSegment(city, index, destinations));
  }

  return {
    id: `planner-draft-${slugify(destinations.join('-') || 'trip')}`,
    conversationId,
    title: buildDraftPlannerTitle(destinations),
    summary: buildDraftPlannerSummary(itinerary, destinations, days),
    startDate: itinerary.isFlexibleDates ? undefined : itinerary.startDate,
    endDate: itinerary.isFlexibleDates ? undefined : itinerary.endDate,
    isFlexibleDates: Boolean(itinerary.isFlexibleDates),
    flexibleMonth: itinerary.isFlexibleDates ? itinerary.flexibleMonth : undefined,
    flexibleYear: itinerary.isFlexibleDates ? itinerary.flexibleYear : undefined,
    days,
    budgetLevel: itinerary.budgetLevel as PlannerBudgetLevel | undefined,
    budgetAmount: itinerary.budgetAmount,
    pace: itinerary.pace as PlannerPace | undefined,
    travelers: {
      adults: itinerary.travelers?.adults ?? 2,
      children: itinerary.travelers?.children ?? 0,
      infants: itinerary.travelers?.infants ?? 0,
    },
    interests,
    constraints: safeArray(itinerary.constraints),
    destinations,
    segments,
    notes,
    generalTips: [
      'Tomamos tu prompt para preparar una primera versión del recorrido.',
      'Los hoteles y transportes reales se habilitan cuando el plan final queda generado.',
    ],
    seasonalityAlert: seasonalityAlert || undefined,
    regionalExpansion: regionalMeta || undefined,
    generationMeta: buildPlannerMeta('draft', {
      uiPhase: 'draft_parsing',
      isDraft: true,
      draftOriginMessage: request.originalMessage,
    }),
    fieldProvenance,
  };
}

// ---------------------------------------------------------------------------
// Smart defaults for progressive enrichment
// ---------------------------------------------------------------------------

const ARGENTINA_CITIES = new Set([
  'mendoza', 'bariloche', 'cordoba', 'salta', 'ushuaia', 'el calafate',
  'iguazu', 'puerto iguazu', 'mar del plata', 'san martin de los andes',
  'villa la angostura', 'jujuy', 'purmamarca', 'tilcara', 'tucuman',
  'rosario', 'neuquen', 'trelew', 'puerto madryn', 'el bolson',
  'cafayate', 'cachi', 'la rioja', 'san juan', 'san rafael',
  'villa carlos paz', 'merlo', 'mina clavero', 'tandil',
  'buenos aires', 'caba', 'capital federal',
]);

const WINTER_KEYWORDS = ['esquí', 'esqui', 'ski', 'nieve', 'snow', 'invierno', 'winter', 'aurora boreal', 'snowboard'];
const SUMMER_KEYWORDS = ['playa', 'beach', 'sol', 'verano', 'summer', 'buceo', 'diving', 'snorkel', 'surf'];

type SeasonHint = 'winter' | 'summer' | null;

function detectSeasonHint(interests: string[], travelStyle: string[]): SeasonHint {
  const all = [...interests, ...travelStyle].map(s => s.toLowerCase());
  if (all.some(k => WINTER_KEYWORDS.some(w => k.includes(w)))) return 'winter';
  if (all.some(k => SUMMER_KEYWORDS.some(w => k.includes(w)))) return 'summer';
  return null;
}

function pickSeasonalMonth(
  seasonHint: SeasonHint,
  destinationLat: number | null,
): { month: number; year: number } {
  const now = new Date();
  if (!seasonHint) {
    const future = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    return { month: future.getMonth(), year: future.getFullYear() };
  }

  const isSouthern = destinationLat !== null && destinationLat < 0;
  let targetMonths: number[];
  if (seasonHint === 'winter') {
    targetMonths = isSouthern ? [5, 6, 7] : [11, 0, 1];
  } else {
    targetMonths = isSouthern ? [11, 0, 1] : [5, 6, 7];
  }

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  for (let offset = 1; offset <= 12; offset++) {
    const candidateMonth = (currentMonth + offset) % 12;
    const candidateYear = currentYear + Math.floor((currentMonth + offset) / 12);
    if (targetMonths.includes(candidateMonth)) {
      return { month: candidateMonth, year: candidateYear };
    }
  }
  return { month: targetMonths[0], year: currentYear + (targetMonths[0] <= currentMonth ? 1 : 0) };
}

function isDomesticDestination(destination: string): boolean {
  const normalized = destination.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ARGENTINA_CITIES.has(normalized);
}

export function applySmartDefaults(
  itinerary: ParsedTravelRequest['itinerary'],
): {
  enrichedItinerary: NonNullable<ParsedTravelRequest['itinerary']>;
  fieldProvenance: PlannerFieldProvenance;
} {
  const base = itinerary || { destinations: [] };
  const destinations = base.destinations || [];
  const provenance: PlannerFieldProvenance = {};

  const allDomestic = destinations.length > 0 && destinations.every(isDomesticDestination);

  // --- regional detection for smart defaults ---
  const firstRegional = destinations.length > 0 ? detectRegionalTerm(destinations[0]) : null;

  // --- days ---
  let days = base.days;
  if (days && days > 0) {
    provenance.days = 'user';
  } else {
    if (firstRegional) {
      days = firstRegional.route.suggested_duration_range[0];
    } else if (destinations.length > 1) {
      days = 3 * destinations.length;
    } else {
      days = allDomestic ? 5 : 7;
    }
    provenance.days = 'assumed';
  }

  // --- budgetLevel ---
  let budgetLevel = base.budgetLevel;
  if (budgetLevel) {
    provenance.budgetLevel = 'user';
  } else {
    budgetLevel = 'mid';
    provenance.budgetLevel = 'assumed';
  }

  // --- pace ---
  let pace = base.pace;
  if (pace) {
    provenance.pace = 'user';
  } else {
    pace = firstRegional?.route.default_pace || 'balanced';
    provenance.pace = 'assumed';
  }

  // --- travelers ---
  let travelers = base.travelers;
  if (travelers?.adults) {
    provenance.travelers = 'user';
  } else {
    travelers = { adults: 2, children: 0, infants: 0 };
    provenance.travelers = 'assumed';
  }

  // --- dates ---
  let { startDate, endDate, isFlexibleDates, flexibleMonth, flexibleYear } = base;
  if (startDate && endDate) {
    provenance.startDate = 'user';
    provenance.endDate = 'user';
  } else if (isFlexibleDates && flexibleMonth) {
    provenance.startDate = 'user';
    provenance.endDate = 'user';
  } else {
    isFlexibleDates = true;

    const interests = safeArray<string>(base.interests);
    const travelStyle = safeArray<string>(base.travelStyle);
    const seasonHint = detectSeasonHint(interests, travelStyle);

    let targetMonth: number;
    let targetYear: number;

    if (seasonHint && destinations.length > 0) {
      const firstDest = destinations[0].toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const fallback = FALLBACK_CITY_COORDINATES_FLAT[firstDest];
      const destLat = fallback?.lat ?? null;
      const picked = pickSeasonalMonth(seasonHint, destLat);
      targetMonth = picked.month;
      targetYear = picked.year;
    } else {
      const now = new Date();
      const monthsAhead = allDomestic ? 1 : 2;
      const futureDate = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);
      targetMonth = futureDate.getMonth();
      targetYear = futureDate.getFullYear();
    }

    const dateForLocale = new Date(targetYear, targetMonth, 1);
    flexibleMonth = dateForLocale.toLocaleString('es-AR', { month: 'long' });
    flexibleYear = targetYear;
    startDate = undefined;
    endDate = undefined;
    provenance.startDate = 'assumed';
    provenance.endDate = 'assumed';
  }

  return {
    enrichedItinerary: {
      ...base,
      destinations,
      days,
      budgetLevel,
      pace,
      travelers,
      startDate,
      endDate,
      isFlexibleDates,
      flexibleMonth,
      flexibleYear,
    },
    fieldProvenance: provenance,
  };
}

// ---------------------------------------------------------------------------
// Regional expansion engine
// ---------------------------------------------------------------------------

const REGIONAL_ROUTES = regionalRoutesData as Record<string, RegionalRoute>;
const COUNTRY_ROUTES = countryRoutesData as Record<string, RegionalRoute>;

const COUNTRY_ROUTE_ALIASES: Record<string, string> = {
  espana: 'spain',
  spain: 'spain',
  italia: 'italy',
  italy: 'italy',
  japon: 'japan',
  japan: 'japan',
  francia: 'france',
  france: 'france',
  grecia: 'greece',
  greece: 'greece',
  china: 'china',
  tailandia: 'thailand',
  thailand: 'thailand',
  turquia: 'turkey',
  turkey: 'turkey',
  mexico: 'mexico',
  'reino unido': 'uk',
  uk: 'uk',
  'united kingdom': 'uk',
  alemania: 'germany',
  germany: 'germany',
  portugal: 'portugal',
  india: 'india',
  vietnam: 'vietnam',
};

const REGION_ALIASES: Record<string, string> = {
  europa: 'europe_classic',
  europe: 'europe_classic',
  'europa clasica': 'europe_classic',
  'europa clásica': 'europe_classic',
  'sudeste asiatico': 'southeast_asia',
  'sudeste asiático': 'southeast_asia',
  asia: 'southeast_asia',
  'southeast asia': 'southeast_asia',
  'costa oeste': 'us_west_coast',
  'usa west': 'us_west_coast',
  'west coast': 'us_west_coast',
  patagonia: 'patagonia_ar',
  'patagonia argentina': 'patagonia_ar',
  caribe: 'caribbean_mix',
  caribbean: 'caribbean_mix',
};

function normalizeRegionString(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function detectRegionalTerm(destination: string): { regionKey: string; route: RegionalRoute } | null {
  const normalized = normalizeRegionString(destination);

  // Check aliases first
  const aliasKey = REGION_ALIASES[normalized];
  if (aliasKey && REGIONAL_ROUTES[aliasKey]) {
    return { regionKey: aliasKey, route: REGIONAL_ROUTES[aliasKey] };
  }

  // Check by region_name
  for (const [key, route] of Object.entries(REGIONAL_ROUTES)) {
    if (normalizeRegionString(route.region_name) === normalized) {
      return { regionKey: key, route };
    }
  }

  // Partial match on aliases
  for (const [alias, key] of Object.entries(REGION_ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      const route = REGIONAL_ROUTES[key];
      if (route) return { regionKey: key, route };
    }
  }

  return null;
}

export function detectCountryRoute(destination: string): { countryKey: string; route: RegionalRoute } | null {
  const normalized = normalizeRegionString(destination);

  const aliasKey = COUNTRY_ROUTE_ALIASES[normalized];
  if (aliasKey && COUNTRY_ROUTES[aliasKey]) {
    return { countryKey: aliasKey, route: COUNTRY_ROUTES[aliasKey] };
  }

  for (const [key, route] of Object.entries(COUNTRY_ROUTES)) {
    if (normalizeRegionString(route.region_name) === normalized) {
      return { countryKey: key, route };
    }
  }

  return null;
}

export function getSeasonalityScore(route: RegionalRoute, month: number): number {
  return route.seasonality[String(month)] ?? 7;
}

/**
 * Select a compatible subroute when the user's requested days are below
 * the route's minimum suggested duration. Picks the top cities by weight
 * and distributes exactly `requestedDays` among them.
 */
export function selectRegionalSubroute(
  route: RegionalRoute,
  requestedDays: number,
): { name: string; days: number; weight: number }[] {
  const maxCities =
    requestedDays <= 5 ? 1 :
    requestedDays <= 8 ? 2 :
    requestedDays <= 12 ? 3 :
    requestedDays <= 16 ? 4 : 5;

  const ranked = [...route.cities].sort((a, b) => b.weight - a.weight);
  const chosen = ranked.slice(0, Math.min(maxCities, ranked.length));

  // Proportional distribution with min 1 per city
  const totalWeight = chosen.reduce((s, c) => s + c.weight, 0);
  const cities = chosen.map(c => ({
    name: c.name,
    days: Math.max(1, Math.round(requestedDays * (c.weight / totalWeight))),
    weight: c.weight,
  }));

  // Adjust sum to match exactly requestedDays
  let sum = cities.reduce((s, c) => s + c.days, 0);
  while (sum > requestedDays) {
    const sortedAsc = [...cities].sort((a, b) => a.days - b.days || a.weight - b.weight);
    let trimmed = false;
    for (const city of sortedAsc) {
      if (city.days > 1) {
        city.days--;
        sum--;
        trimmed = true;
        break;
      }
    }
    if (!trimmed) break;
  }
  while (sum < requestedDays) {
    const sortedDesc = [...cities].sort((a, b) => b.weight - a.weight);
    sortedDesc[0].days++;
    sum++;
  }

  return cities;
}

export function expandRegionalDestination(
  regionKey: string,
  totalDays: number,
  targetMonth?: number,
  routesMap: Record<string, RegionalRoute> = REGIONAL_ROUTES,
): RegionalExpansionResult {
  const route = routesMap[regionKey];
  if (!route) {
    return { expanded: false, regionKey: null, regionName: null, cities: [], seasonalityScore: null, seasonalityAlert: null, suggestedDays: totalDays, suggestedPace: null };
  }

  const [minDays, maxDays] = route.suggested_duration_range;
  const cityMinDaysSum = route.cities.reduce((s, c) => s + c.min_days, 0);

  let cities: { name: string; days: number; weight: number }[];

  if (totalDays < minDays || totalDays < cityMinDaysSum) {
    // User requested fewer days than the full route needs — pick a compatible subroute
    cities = selectRegionalSubroute(route, totalDays);
  } else {
    // Full route fits within user's duration — distribute across all cities
    const effectiveDays = Math.min(maxDays, totalDays);

    cities = route.cities.map(city => ({
      name: city.name,
      days: Math.max(city.min_days, Math.round(effectiveDays * city.weight)),
      weight: city.weight,
    }));

    // Adjust sum to match effectiveDays
    let sum = cities.reduce((acc, c) => acc + c.days, 0);
    while (sum > effectiveDays) {
      const sortedAsc = [...cities].sort((a, b) => a.weight - b.weight);
      let trimmed = false;
      for (const city of sortedAsc) {
        const routeCity = route.cities.find(rc => rc.name === city.name);
        if (city.days > (routeCity?.min_days ?? 1)) {
          city.days--;
          sum--;
          trimmed = true;
          break;
        }
      }
      if (!trimmed) break;
    }
    while (sum < effectiveDays) {
      const sortedDesc = [...cities].sort((a, b) => b.weight - a.weight);
      sortedDesc[0].days++;
      sum++;
    }
  }

  let seasonalityScore: number | null = null;
  let seasonalityAlert: string | null = null;
  if (targetMonth != null) {
    seasonalityScore = getSeasonalityScore(route, targetMonth);
    if (seasonalityScore < 6) {
      seasonalityAlert = route.alert;
    }
  }

  return {
    expanded: true,
    regionKey,
    regionName: route.region_name,
    cities,
    seasonalityScore,
    seasonalityAlert,
    suggestedDays: totalDays,
    suggestedPace: route.default_pace,
  };
}

export function expandDestinationsIfRegional(
  destinations: string[],
  days: number,
  targetMonth?: number,
): {
  expandedDestinations: string[];
  regionalMeta: { regionKey: string; regionName: string; expandedFrom: string } | null;
  seasonalityAlert: string | null;
  suggestedDays: number;
  suggestedPace: PlannerPace | null;
  cityWeights: Map<string, { weight: number; minDays: number }> | null;
} {
  console.log('🌍 [GEO-TRACE-4] expandDestinationsIfRegional INPUT:', destinations, 'days:', days);
  for (const dest of destinations) {
    const detected = detectRegionalTerm(dest);
    console.log('🌍 [GEO-TRACE-4] Pass 1 (region):', dest, '→', detected ? detected.regionKey : 'null');
    if (detected) {
      const result = expandRegionalDestination(detected.regionKey, days, targetMonth);
      if (result.expanded) {
        const otherDests = destinations.filter(d => d !== dest);
        const expandedNames = result.cities.map(c => c.name);
        const weights = new Map<string, { weight: number; minDays: number }>();
        for (const city of result.cities) {
          const routeCity = detected.route.cities.find(rc => rc.name === city.name);
          weights.set(city.name.toLowerCase(), { weight: city.weight, minDays: routeCity?.min_days ?? 1 });
        }
        console.log('🌍 [GEO-TRACE-4] Pass 1 EXPANDED:', expandedNames);
        return {
          expandedDestinations: [...expandedNames, ...otherDests],
          regionalMeta: {
            regionKey: detected.regionKey,
            regionName: result.regionName!,
            expandedFrom: dest,
          },
          seasonalityAlert: result.seasonalityAlert,
          suggestedDays: result.suggestedDays,
          suggestedPace: result.suggestedPace,
          cityWeights: weights,
        };
      }
    }
  }

  // --- Pass 2: Country route expansion ---
  for (const dest of destinations) {
    const detected = detectCountryRoute(dest);
    console.log('🌍 [GEO-TRACE-4] Pass 2 (country):', dest, '→', detected ? detected.countryKey : 'null');
    if (detected) {
      const result = expandRegionalDestination(detected.countryKey, days, targetMonth, COUNTRY_ROUTES);
      if (result.expanded) {
        const otherDests = destinations.filter(d => d !== dest);
        const expandedNames = result.cities.map(c => c.name);
        const weights = new Map<string, { weight: number; minDays: number }>();
        for (const city of result.cities) {
          const routeCity = detected.route.cities.find(rc => rc.name === city.name);
          weights.set(city.name.toLowerCase(), { weight: city.weight, minDays: routeCity?.min_days ?? 1 });
        }
        return {
          expandedDestinations: [...expandedNames, ...otherDests],
          regionalMeta: {
            regionKey: detected.countryKey,
            regionName: result.regionName!,
            expandedFrom: dest,
          },
          seasonalityAlert: result.seasonalityAlert,
          suggestedDays: result.suggestedDays,
          suggestedPace: result.suggestedPace,
          cityWeights: weights,
        };
      }
    }
  }

  // --- Pass 3: Capital fallback for countries without route data ---
  let hasCountryFallback = false;
  const fallbackDestinations = destinations.map(dest => {
    const capital = resolveCountryToCapital(dest);
    if (capital) {
      hasCountryFallback = true;
      return capital;
    }
    return dest;
  });

  const finalResult = hasCountryFallback ? fallbackDestinations : destinations;
  console.log('🌍 [GEO-TRACE-4] Pass 3 (capital fallback):', hasCountryFallback, 'result:', finalResult);
  return {
    expandedDestinations: finalResult,
    regionalMeta: null,
    seasonalityAlert: null,
    suggestedDays: days,
    suggestedPace: null,
    cityWeights: null,
  };
}

export function normalizePlannerState(raw: Record<string, unknown>, conversationId?: string): TripPlannerState {
  const source = (raw?.plannerData as Record<string, unknown>) || raw;
  const rawSegments = safeArray<Record<string, unknown>>(source?.segments as Record<string, unknown>[]).length > 0
    ? safeArray<Record<string, unknown>>(source?.segments as Record<string, unknown>[]).map(normalizeSegment)
    : [buildSegmentFromLegacyItinerary(source)];
  const segments = normalizePlannerSegmentsScheduling(rawSegments, {
    pace: source?.pace,
    travelers: source?.travelers,
  });

  const destinations = source?.destinations && source.destinations.length > 0
    ? source.destinations
    : segments.map((segment) => segment.city);

  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  return {
    id: source?.id || `planner-${slugify(destinations.join('-') || 'trip')}`,
    conversationId,
    title: source?.title || `Viaje por ${destinations.join(', ')}`,
    summary: source?.summary || source?.introduction || 'Planificador listo.',
    startDate: source?.startDate || firstSegment?.startDate,
    endDate: source?.endDate || lastSegment?.endDate,
    isFlexibleDates: Boolean(source?.isFlexibleDates),
    flexibleMonth: source?.flexibleMonth,
    flexibleYear: source?.flexibleYear,
    days: source?.days || segments.reduce((acc, segment) => acc + segment.days.length, 0),
    budgetLevel: source?.budgetLevel,
    budgetAmount: source?.budgetAmount,
    pace: source?.pace as PlannerPace | undefined,
    travelers: {
      adults: source?.travelers?.adults ?? 2,
      children: source?.travelers?.children ?? 0,
      infants: source?.travelers?.infants ?? 0,
    },
    interests: safeArray(source?.interests),
    constraints: safeArray(source?.constraints),
    destinations,
    segments,
    notes: safeArray(source?.notes),
    generalTips: safeArray(source?.generalTips),
    fieldProvenance: source?.fieldProvenance as PlannerFieldProvenance | undefined,
    generationMeta: buildPlannerMeta(source?.generationMeta?.source || 'system', {
      updatedAt: source?.generationMeta?.updatedAt,
      version: source?.generationMeta?.version || 1,
      uiPhase: source?.generationMeta?.uiPhase,
      isDraft: Boolean(source?.generationMeta?.isDraft),
      draftOriginMessage: source?.generationMeta?.draftOriginMessage,
    }),
  };
}

export function formatBudgetLevel(value?: PlannerBudgetLevel): string {
  switch (value) {
    case 'low':
      return 'Bajo';
    case 'mid':
      return 'Medio';
    case 'high':
      return 'Alto';
    case 'luxury':
      return 'Lujo';
    default:
      return '';
  }
}

export function formatPaceLabel(value?: PlannerPace): string {
  switch (value) {
    case 'relaxed':
      return 'Relajado';
    case 'balanced':
      return 'Equilibrado';
    case 'fast':
      return 'Intenso';
    default:
      return '';
  }
}

export function formatDayBlockLabel(value: 'morning' | 'afternoon' | 'evening'): string {
  switch (value) {
    case 'morning':
      return 'Mañana';
    case 'afternoon':
      return 'Tarde';
    case 'evening':
      return 'Noche';
    default:
      return value;
  }
}

export function formatDestinationLabel(value: string): string {
  if (!value) return '';
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function formatShortDate(value?: string): string {
  if (!value) return 'Por definir';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    .replace(/\./g, '')
    .toLowerCase();
}

export function formatDateRange(start?: string, end?: string): string {
  if (!start && !end) return 'Fechas pendientes';
  if (!start) return formatShortDate(end);
  if (!end) return formatShortDate(start);
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

export function formatFlexibleMonth(month?: string, year?: number): string {
  if (!month && !year) return 'Mes flexible';
  const monthDate = month ? new Date(`${year || new Date().getFullYear()}-${month}-01T00:00:00`) : null;
  const monthLabel = monthDate && !Number.isNaN(monthDate.getTime())
    ? monthDate.toLocaleDateString('es-ES', { month: 'long' })
    : month;

  if (!monthLabel) return 'Mes flexible';
  return `Flexible en ${monthLabel}${year ? ` de ${year}` : ''}`;
}

export function formatPlannerHotelCategory(category?: string): string | undefined {
  if (!category) return undefined;

  const match = category.match(/(\d+(?:[.,]\d+)?)/);
  if (match) {
    const stars = Math.round(Number(match[1].replace(',', '.')));
    if (Number.isFinite(stars) && stars > 0) {
      return '⭐'.repeat(Math.max(1, Math.min(5, stars)));
    }
  }

  return category.trim();
}

export function formatPlannerPrice(amount?: number, currency?: string): string | undefined {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return undefined;

  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount.toFixed(2)}`;
  }
}

export function getPrimaryPlannerHotelRoom(hotel: LocalHotelData) {
  return safeArray(hotel.rooms)[0];
}

export function formatRelativeValidationTime(isoTimestamp: string): string | undefined {
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return undefined;
  const diffMs = Date.now() - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'hace instantes';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `hace ${diffHrs}h`;
  return `hace más de 24h`;
}

export function getValidationFreshnessColor(isoTimestamp: string): string {
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return 'text-muted-foreground';
  const diffMin = Math.floor((Date.now() - then) / 60000);

  if (diffMin < 5) return 'text-green-600';
  if (diffMin < 60) return 'text-yellow-600';
  return 'text-red-500';
}

export type PriceConfidenceLevel = 'confirmed' | 'estimated' | 'expired';

export function getPriceConfidenceLevel(isoTimestamp?: string): PriceConfidenceLevel {
  if (!isoTimestamp) return 'expired';
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return 'expired';
  const diffMin = Math.floor((Date.now() - then) / 60000);

  if (diffMin < 5) return 'confirmed';
  if (diffMin < 60) return 'estimated';
  return 'expired';
}

export function getPriceConfidenceLabel(level: PriceConfidenceLevel): string {
  switch (level) {
    case 'confirmed':
      return 'Precio confirmado';
    case 'estimated':
      return 'Precio estimado — confirmar de nuevo';
    case 'expired':
      return 'Precio expirado — confirmar disponibilidad';
  }
}

export function getPriceConfidenceBadgeClass(level: PriceConfidenceLevel): string {
  switch (level) {
    case 'confirmed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'estimated':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'expired':
      return 'bg-red-100 text-red-800 border-red-200';
  }
}

export function getPlannerHotelDisplayId(hotel: LocalHotelData): string {
  return hotel.hotel_id || `${hotel.name}-${hotel.city}`;
}

export function buildMakeBudgetOccupancies(
  room: { occupancy_id?: string; xml_occupancy_id?: string },
  travelers: { adults: number; children: number; infants: number },
  childrenAges?: number[]
): MakeBudgetParams['occupancies'] {
  const occupancyId = room.occupancy_id || room.xml_occupancy_id || '1';
  const passengers: Array<{ type: 'ADT' | 'CHD' | 'CNN' | 'INF'; age?: number }> = [];

  for (let i = 0; i < (travelers.adults || 2); i++) {
    passengers.push({ type: 'ADT' });
  }
  for (let i = 0; i < (travelers.children || 0); i++) {
    passengers.push({ type: 'CNN', age: childrenAges?.[i] || 8 });
  }
  for (let i = 0; i < (travelers.infants || 0); i++) {
    passengers.push({ type: 'INF', age: 1 });
  }

  return [{ occupancyId, passengers }];
}

export function formatPlannerTravelerSummary(hotel: LocalHotelData): string | undefined {
  const adults = hotel.search_adults || 0;
  const children = hotel.search_children || 0;
  const infants = hotel.search_infants || 0;
  const parts: string[] = [];

  if (adults > 0) {
    parts.push(`${adults} adulto${adults === 1 ? '' : 's'}`);
  }
  if (children > 0) {
    parts.push(`${children} menor${children === 1 ? '' : 'es'}`);
  }
  if (infants > 0) {
    parts.push(`${infants} infante${infants === 1 ? '' : 's'}`);
  }

  return parts.length > 0 ? parts.join(', ') : undefined;
}

export function isEurovipsInventoryHotel(hotel?: LocalHotelData | null): hotel is LocalHotelData {
  return Boolean(hotel) && hotel.provider !== 'HOTELBEDS';
}

export function formatPlannerRoomLabel(hotel: LocalHotelData): string {
  const room = getPrimaryPlannerHotelRoom(hotel);
  if (!room) return 'Habitacion disponible';

  if (room.type && room.description && room.description.toLowerCase() !== room.type.toLowerCase()) {
    return `${room.type} · ${room.description}`;
  }

  return room.type || room.description || 'Habitacion disponible';
}

export function formatPlannerFlightPrice(flight: FlightData): string | undefined {
  return formatPlannerPrice(flight.price?.amount, flight.price?.currency);
}

export function formatPlannerFlightStops(flight: FlightData): string {
  if (flight.stops?.direct) {
    return 'Directo';
  }

  const count = flight.stops?.count ?? flight.stops?.connections ?? 0;
  if (!count) {
    return 'Sin dato de escalas';
  }

  return `${count} escala${count === 1 ? '' : 's'}`;
}

export function formatPlannerFlightDuration(flight: FlightData): string | undefined {
  if (flight.duration?.formatted) {
    return flight.duration.formatted;
  }

  const totalMinutes = flight.duration?.total;
  if (!totalMinutes || !Number.isFinite(totalMinutes)) {
    return undefined;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function getPlannerFlightRoute(flight: FlightData): string | undefined {
  const firstLeg = flight.legs?.[0];
  const firstOption = firstLeg?.options?.[0];
  const firstSegment = firstOption?.segments?.[0];
  const lastSegment = firstOption?.segments?.[firstOption.segments.length - 1];

  if (!firstSegment?.departure?.airportCode || !lastSegment?.arrival?.airportCode) {
    return undefined;
  }

  return `${firstSegment.departure.airportCode} - ${lastSegment.arrival.airportCode}`;
}

export function formatPlannerFlightTimeRange(flight: FlightData): string | undefined {
  const departureTime = flight.departure_time;
  const arrivalTime = flight.arrival_time;

  if (!departureTime && !arrivalTime) {
    return undefined;
  }

  if (departureTime && arrivalTime) {
    return `${departureTime} - ${arrivalTime}`;
  }

  return departureTime || arrivalTime;
}

export function formatPlannerFlightCabin(flight: FlightData): string | undefined {
  if (flight.cabin?.brandName && flight.cabin?.class) {
    return `${flight.cabin.brandName} · ${flight.cabin.class}`;
  }

  return flight.cabin?.brandName || flight.cabin?.class;
}

export function formatPlannerFlightBaggage(flight: FlightData): string | undefined {
  if (flight.baggage?.details) {
    return flight.baggage.details;
  }

  if (flight.baggage?.carryOn) {
    return `Cabina: ${flight.baggage.carryOn}`;
  }

  return undefined;
}

export function getPlannerFlightSegments(flight: FlightData) {
  return flight.legs?.[0]?.options?.[0]?.segments || [];
}

export function getInclusiveDateRangeDays(startDate?: string, endDate?: string): number | undefined {
  if (!startDate || !endDate) return undefined;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return undefined;
  }

  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function buildPlannerPromptContext(plannerState: TripPlannerState): ParsedTravelRequest {
  const exactDays = !plannerState.isFlexibleDates
    ? getInclusiveDateRangeDays(plannerState.startDate, plannerState.endDate)
    : undefined;

  return {
    requestType: 'itinerary',
    itinerary: {
      destinations: plannerState.destinations,
      days: exactDays || plannerState.days,
      startDate: plannerState.startDate,
      endDate: plannerState.endDate,
      isFlexibleDates: plannerState.isFlexibleDates,
      flexibleMonth: plannerState.flexibleMonth,
      flexibleYear: plannerState.flexibleYear,
      budgetLevel: plannerState.budgetLevel,
      budgetAmount: plannerState.budgetAmount,
      interests: plannerState.interests,
      pace: plannerState.pace,
      travelers: plannerState.travelers,
      constraints: plannerState.constraints,
      currentPlanSummary: plannerState.summary,
    },
    confidence: 1,
    originalMessage: plannerState.summary,
  } as ParsedTravelRequest;
}

export function buildPlannerGenerationPayload(
  plannerState: TripPlannerState,
  overrides?: Record<string, unknown>
) {
  const exactDays = !plannerState.isFlexibleDates
    ? getInclusiveDateRangeDays(plannerState.startDate, plannerState.endDate)
    : undefined;

  return {
    destinations: plannerState.destinations,
    days: exactDays || plannerState.days,
    startDate: plannerState.startDate,
    endDate: plannerState.endDate,
    isFlexibleDates: plannerState.isFlexibleDates,
    flexibleMonth: plannerState.flexibleMonth,
    flexibleYear: plannerState.flexibleYear,
    budgetLevel: plannerState.budgetLevel,
    budgetAmount: plannerState.budgetAmount,
    interests: plannerState.interests,
    pace: plannerState.pace,
    travelers: plannerState.travelers,
    constraints: plannerState.constraints,
    existingPlannerState: plannerState,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Gap detection for proactive suggestion chips
// ---------------------------------------------------------------------------

const MAX_SUGGESTIONS = 4;

export function detectPlannerGaps(plannerState: TripPlannerState): PlannerSuggestion[] {
  const suggestions: PlannerSuggestion[] = [];
  const seen = new Set<string>();

  const add = (s: Omit<PlannerSuggestion, 'id'>) => {
    const key = `${s.action}:${s.payload.segmentId ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push({ ...s, id: `sug-${key}` });
  };

  // P0: Flexible dates without start date
  if (plannerState.isFlexibleDates && !plannerState.startDate) {
    add({
      label: 'Seleccionar fechas exactas',
      action: 'select_dates',
      type: 'edit',
      payload: {},
      priority: 0,
    });
  }

  // P0.5: Combined origin + dates confirmation chip
  if (plannerState.fieldProvenance) {
    const originAssumed = plannerState.fieldProvenance.origin === 'assumed' && plannerState.origin;
    const datesAssumed = plannerState.fieldProvenance.startDate === 'assumed';

    if (originAssumed && datesAssumed) {
      const dateLabel = plannerState.isFlexibleDates && plannerState.flexibleMonth
        ? `${plannerState.flexibleMonth} ${plannerState.flexibleYear || ''}`
        : plannerState.startDate || 'fechas';
      add({
        label: `Confirmar: desde ${formatDestinationLabel(plannerState.origin!)} en ${dateLabel.trim()}`,
        action: 'confirm_location_dates',
        type: 'confirm',
        payload: {},
        priority: 0.5,
      });
    } else if (originAssumed) {
      add({
        label: `Confirmar origen: ${formatDestinationLabel(plannerState.origin!)}`,
        action: 'confirm_field',
        type: 'confirm',
        payload: { field: 'origin' },
        priority: 1,
      });
    }
  }

  // P1: Assumed fields needing confirmation
  if (plannerState.fieldProvenance) {
    const fieldLabels: Record<string, string> = {
      days: `${plannerState.days} días`,
      budgetLevel: formatBudgetLevel(plannerState.budgetLevel)?.toLowerCase() ?? 'medio',
      pace: formatPaceLabel(plannerState.pace)?.toLowerCase() ?? 'equilibrado',
      travelers: `${plannerState.travelers.adults} adulto${plannerState.travelers.adults !== 1 ? 's' : ''}`,
      origin: plannerState.origin ? formatDestinationLabel(plannerState.origin) : '',
    };
    for (const [field, source] of Object.entries(plannerState.fieldProvenance)) {
      if (source !== 'assumed') continue;
      if (field === 'startDate' || field === 'endDate' || field === 'origin') continue;
      const label = fieldLabels[field];
      if (!label) continue;
      add({
        label: `Confirmar: ${label}`,
        action: 'confirm_field',
        type: 'confirm',
        payload: { field },
        priority: 1,
      });
    }
  }

  const isFlexible = Boolean(plannerState.isFlexibleDates);

  // P2: Transport search needed (skip first segment, skip if flexible dates)
  if (!isFlexible) {
    for (const segment of plannerState.segments) {
      if (segment.order === 0) continue;
      const transport = segment.transportIn;
      if (!transport || transport.searchStatus === 'idle') {
        add({
          label: `Buscar vuelos a ${formatDestinationLabel(segment.city)}`,
          action: 'search_transport',
          type: 'flight',
          payload: { segmentId: segment.id, segmentCity: segment.city },
          priority: 2,
        });
      }
    }
  }

  // P3: Hotel search needed (context-aware: include stars if requested)
  if (!isFlexible) {
    for (const segment of plannerState.segments) {
      const status = segment.hotelPlan.searchStatus;
      if (status === 'idle' || status === 'error') {
        const stars = segment.hotelPlan.requestedStars;
        const cityLabel = formatDestinationLabel(segment.city);
        add({
          label: stars
            ? `Buscar hoteles ${stars}\u2605 en ${cityLabel}`
            : `Ver hoteles en ${cityLabel}`,
          action: 'search_hotels',
          type: 'hotel',
          payload: { segmentId: segment.id, segmentCity: segment.city },
          priority: 3,
        });
      }
    }
  }

  // Couple detection: 2 adults, no children/infants
  const isCouple =
    plannerState.travelers.adults === 2 &&
    (plannerState.travelers.children || 0) === 0 &&
    (plannerState.travelers.infants || 0) === 0;

  // P4: Empty activity slots (max 2) — couple-aware labels
  let activityCount = 0;
  for (const segment of plannerState.segments) {
    if (activityCount >= 2) break;
    for (const day of segment.days) {
      if (activityCount >= 2) break;
      if (day.afternoon.length === 0 || day.evening.length === 0) {
        const slot = day.afternoon.length === 0 ? 'afternoon' : 'evening';
        const cityLabel = formatDestinationLabel(segment.city);
        const label = isCouple && slot === 'evening'
          ? `Cena exclusiva en ${cityLabel}`
          : `Explorar actividades en ${cityLabel}`;
        add({
          label,
          action: 'fill_slot',
          type: 'activity',
          payload: { segmentId: segment.id, segmentCity: segment.city, dayNumber: day.dayNumber, slot },
          priority: 4,
        });
        activityCount++;
      }
    }
  }

  // P5: Luxury budget without transfers
  if (plannerState.budgetLevel === 'luxury') {
    const hasTransfer = plannerState.segments.some((seg) =>
      seg.transportIn?.type === 'transfer' || seg.transportOut?.type === 'transfer'
    );
    if (!hasTransfer) {
      add({
        label: 'Añadir traslados privados',
        action: 'add_transfers',
        type: 'edit',
        payload: {},
        priority: 5,
      });
    }
  }

  return suggestions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_SUGGESTIONS);
}

export function summarizePlannerForChat(plannerState: TripPlannerState): string {
  const effectiveDays = !plannerState.isFlexibleDates
    ? getInclusiveDateRangeDays(plannerState.startDate, plannerState.endDate) || plannerState.days
    : plannerState.days;

  const destList = plannerState.destinations.map(formatDestinationLabel).join(', ');

  const routeProposal = plannerState.segments
    .map((segment) => `${formatDestinationLabel(segment.city)} (${segment.nights || segment.days.length || '?'})`)
    .join(' → ');

  const assumedFields = plannerState.fieldProvenance
    ? Object.entries(plannerState.fieldProvenance)
        .filter(([, source]) => source === 'assumed')
        .map(([field]) => field)
    : [];

  const assumedSuffix = assumedFields.length > 0
    ? (() => {
        const fieldMap: Record<string, string> = {
          days: `Duración: ${plannerState.days} días`,
          startDate: 'Fechas: flexibles',
          endDate: 'Fechas: flexibles',
          budgetLevel: `Presupuesto: ${formatBudgetLevel(plannerState.budgetLevel)?.toLowerCase()}`,
          pace: `Ritmo: ${formatPaceLabel(plannerState.pace)?.toLowerCase()}`,
          travelers: `Viajeros: ${plannerState.travelers.adults} adulto${plannerState.travelers.adults !== 1 ? 's' : ''}`,
        };
        const lines = [...new Set(assumedFields.map(f => fieldMap[f]).filter(Boolean))];
        return lines.length > 0
          ? `\n> ⚠️ Datos supuestos (podés confirmarlos o cambiarlos):\n${lines.map(l => `> - ${l}`).join('\n')}\n`
          : '';
      })()
    : '';

  const ctaLine = 'Si querés, te lo ajusto con otro enfoque, cambiamos ciudades o sumamos detalles.';

  return `Como primera idea para **${effectiveDays} días** por ${destList}, te propongo: ${routeProposal}.\n` +
    `${assumedSuffix}` +
    `\n${ctaLine}`;
}

export function buildPlannerPdfHtml(plannerState: TripPlannerState): string {
  const effectiveDays = !plannerState.isFlexibleDates
    ? getInclusiveDateRangeDays(plannerState.startDate, plannerState.endDate) || plannerState.days
    : plannerState.days;

  const dateLabel = plannerState.isFlexibleDates
    ? formatFlexibleMonth(plannerState.flexibleMonth, plannerState.flexibleYear)
    : formatDateRange(plannerState.startDate, plannerState.endDate);

  const paceLabel = formatPaceLabel(plannerState.pace);
  const budgetLabel = formatBudgetLevel(plannerState.budgetLevel);
  const destinationsList = plannerState.destinations.map(formatDestinationLabel).join(', ');

  const travelersText = (() => {
    const { adults, children, infants } = plannerState.travelers;
    const parts: string[] = [];
    if (adults > 0) parts.push(`${adults} adulto${adults === 1 ? '' : 's'}`);
    if (children > 0) parts.push(`${children} menor${children === 1 ? '' : 'es'}`);
    if (infants > 0) parts.push(`${infants} infante${infants === 1 ? '' : 's'}`);
    return parts.join(', ') || '';
  })();

  function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderActivities(activities: PlannerActivity[], blockLabel: string): string {
    if (activities.length === 0) return '';
    const items = activities.map((a) => {
      let html = `<li><strong>${escapeHtml(a.title)}</strong>`;
      if (a.time) html += ` <span style="color:#6b7280;font-size:0.85em;">(${escapeHtml(a.time)})</span>`;
      if (a.description) html += `<br/><span style="color:#4b5563;">${escapeHtml(a.description)}</span>`;
      if (a.tip) html += `<br/><em style="color:#6b7280;font-size:0.9em;">Tip: ${escapeHtml(a.tip)}</em>`;
      html += '</li>';
      return html;
    }).join('');
    return `<h4 style="margin:10px 0 4px;color:#2563eb;font-size:0.95em;">${escapeHtml(blockLabel)}</h4><ul style="margin:0 0 8px;padding-left:20px;">${items}</ul>`;
  }

  function renderRestaurants(restaurants: PlannerRestaurant[]): string {
    if (restaurants.length === 0) return '';
    const items = restaurants.map((r) => {
      let label = escapeHtml(r.name);
      if (r.type) label += ` <span style="color:#6b7280;">(${escapeHtml(r.type)})</span>`;
      if (r.priceRange) label += ` · ${escapeHtml(r.priceRange)}`;
      return `<li>${label}</li>`;
    }).join('');
    return `<h4 style="margin:10px 0 4px;color:#2563eb;font-size:0.95em;">Restaurantes</h4><ul style="margin:0 0 8px;padding-left:20px;">${items}</ul>`;
  }

  function renderHotelInfo(segment: PlannerSegment): string {
    const hotel = segment.hotelPlan.confirmedInventoryHotel
      || (!segment.hotelPlan.selectedPlaceCandidate ? segment.hotelPlan.hotelRecommendations[0] : null);

    const placeCandidate = segment.hotelPlan.selectedPlaceCandidate;

    if (!hotel && !placeCandidate) return '';

    if (hotel) {
      const room = getPrimaryPlannerHotelRoom(hotel);
      const category = formatPlannerHotelCategory(hotel.category);
      const price = formatPlannerPrice(room?.price, room?.currency);
      const roomLabel = formatPlannerRoomLabel(hotel);
      const travelers = formatPlannerTravelerSummary(hotel);
      const isConfirmedInventory = Boolean(segment.hotelPlan.confirmedInventoryHotel);
      const labelTag = isConfirmedInventory
        ? '<span style="display:inline-block;background:#166534;color:#fff;font-size:0.75em;padding:1px 8px;border-radius:9999px;margin-left:8px;">Precio de inventario</span>'
        : '<span style="display:inline-block;background:#6b7280;color:#fff;font-size:0.75em;padding:1px 8px;border-radius:9999px;margin-left:8px;">Sugerencia del planner</span>';

      let html = `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;margin:8px 0;">`;
      html += `<strong>🏨 ${escapeHtml(hotel.name)}</strong>${labelTag}`;
      if (category) html += ` · ${escapeHtml(category)}`;
      html += `<br/><span style="font-size:0.9em;color:#4b5563;">${escapeHtml(roomLabel)}</span>`;
      if (price) html += ` · <strong>${escapeHtml(price)}</strong>`;
      if (travelers) html += `<br/><span style="font-size:0.85em;color:#6b7280;">${escapeHtml(travelers)}</span>`;
      html += '</div>';
      return html;
    }

    if (placeCandidate) {
      let html = `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;margin:8px 0;">`;
      html += `<strong>🏨 ${escapeHtml(placeCandidate.name)}</strong>`;
      html += '<span style="display:inline-block;background:#6b7280;color:#fff;font-size:0.75em;padding:1px 8px;border-radius:9999px;margin-left:8px;">Sugerencia del planner</span>';
      if (placeCandidate.rating) html += ` · ⭐ ${placeCandidate.rating}`;
      if (placeCandidate.formattedAddress) html += `<br/><span style="font-size:0.85em;color:#6b7280;">${escapeHtml(placeCandidate.formattedAddress)}</span>`;
      html += '</div>';
      return html;
    }

    return '';
  }

  function renderTransportInfo(transport: PlannerTransport | null | undefined, label: string): string {
    if (!transport) return '';

    if (transport.type === 'flight' && transport.options?.length) {
      const selected = transport.selectedOptionId
        ? transport.options.find((o) => o.id === transport.selectedOptionId)
        : transport.options[0];

      if (selected) {
        const route = getPlannerFlightRoute(selected);
        const duration = formatPlannerFlightDuration(selected);
        const stops = formatPlannerFlightStops(selected);
        const timeRange = formatPlannerFlightTimeRange(selected);
        const price = formatPlannerPrice(selected.price?.amount, selected.price?.currency);

        let html = `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;margin:8px 0;">`;
        html += `<strong>✈️ ${escapeHtml(label)}</strong>`;
        if (route) html += ` · ${escapeHtml(route)}`;
        const details: string[] = [];
        if (timeRange) details.push(timeRange);
        if (duration) details.push(duration);
        if (stops) details.push(stops);
        if (price) details.push(price);
        if (details.length) html += `<br/><span style="font-size:0.9em;color:#4b5563;">${details.map(escapeHtml).join(' · ')}</span>`;
        html += '</div>';
        return html;
      }
    }

    return `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;margin:8px 0;"><strong>🚗 ${escapeHtml(label)}</strong>: ${escapeHtml(transport.summary)}</div>`;
  }

  // Build segments HTML
  const segmentsHtml = plannerState.segments.map((segment) => {
    const segmentDateRange = formatDateRange(segment.startDate, segment.endDate);
    const nightsLabel = segment.nights ? `${segment.nights} noche${segment.nights === 1 ? '' : 's'}` : '';

    let sectionHtml = `<div style="page-break-inside:avoid;margin-bottom:24px;">`;
    sectionHtml += `<h2 style="color:#1e40af;border-bottom:2px solid #93c5fd;padding-bottom:6px;margin:24px 0 8px;">📍 ${escapeHtml(formatDestinationLabel(segment.city))}${segment.country ? `, ${escapeHtml(segment.country)}` : ''}</h2>`;
    sectionHtml += `<p style="color:#6b7280;font-size:0.9em;margin:0 0 8px;">${escapeHtml(segmentDateRange)}${nightsLabel ? ` · ${escapeHtml(nightsLabel)}` : ''}</p>`;
    if (segment.summary) sectionHtml += `<p style="margin:0 0 12px;">${escapeHtml(segment.summary)}</p>`;

    sectionHtml += renderHotelInfo(segment);
    sectionHtml += renderTransportInfo(segment.transportIn, 'Llegada');
    sectionHtml += renderTransportInfo(segment.transportOut, 'Salida');

    // Days
    segment.days.forEach((day) => {
      sectionHtml += `<div style="margin:16px 0;padding:12px;background:#fafafa;border-radius:8px;border:1px solid #e5e7eb;page-break-inside:avoid;">`;
      sectionHtml += `<h3 style="margin:0 0 8px;color:#1f2937;">${escapeHtml(day.title)}`;
      if (day.date) sectionHtml += ` <span style="font-weight:normal;color:#6b7280;font-size:0.85em;">(${escapeHtml(formatShortDate(day.date))})</span>`;
      sectionHtml += '</h3>';
      if (day.summary) sectionHtml += `<p style="color:#4b5563;margin:0 0 8px;font-size:0.9em;">${escapeHtml(day.summary)}</p>`;

      sectionHtml += renderActivities(day.morning, formatDayBlockLabel('morning'));
      sectionHtml += renderActivities(day.afternoon, formatDayBlockLabel('afternoon'));
      sectionHtml += renderActivities(day.evening, formatDayBlockLabel('evening'));
      sectionHtml += renderRestaurants(day.restaurants);

      if (day.travelTip) {
        sectionHtml += `<p style="margin:8px 0 0;padding:8px;background:#ecfdf5;border-radius:6px;font-size:0.85em;color:#065f46;">💡 ${escapeHtml(day.travelTip)}</p>`;
      }

      sectionHtml += '</div>';
    });

    sectionHtml += '</div>';
    return sectionHtml;
  }).join('');

  // General tips
  const tipsHtml = plannerState.generalTips.length > 0
    ? `<div style="margin-top:24px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;page-break-inside:avoid;"><h3 style="margin:0 0 8px;color:#166534;">Consejos generales</h3><ul style="margin:0;padding-left:20px;">${plannerState.generalTips.map((tip) => `<li style="margin-bottom:4px;">${escapeHtml(tip)}</li>`).join('')}</ul></div>`
    : '';

  // Header meta
  const metaItems: string[] = [];
  metaItems.push(`${effectiveDays} días`);
  if (dateLabel && dateLabel !== 'Fechas pendientes') metaItems.push(dateLabel);
  if (budgetLabel) metaItems.push(`Presupuesto: ${budgetLabel}`);
  if (paceLabel) metaItems.push(`Ritmo: ${paceLabel}`);
  if (travelersText) metaItems.push(travelersText);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(plannerState.title)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:"Inter","Segoe UI",system-ui,-apple-system,sans-serif;color:#1f2937;line-height:1.6;padding:32px;max-width:900px;margin:0 auto;font-size:14px;}
  h1{font-size:1.8em;color:#1e3a5f;margin-bottom:4px;}
  h2{font-size:1.3em;}
  h3{font-size:1.1em;}
  ul{list-style-type:disc;}
  @media print{body{padding:16px;font-size:12px;} h1{font-size:1.5em;}}
</style>
</head>
<body>
<h1>${escapeHtml(plannerState.title)}</h1>
<p style="color:#4b5563;margin-bottom:12px;">${escapeHtml(plannerState.summary)}</p>
<p style="color:#6b7280;font-size:0.9em;margin-bottom:4px;"><strong>Destinos:</strong> ${escapeHtml(destinationsList)}</p>
<p style="color:#6b7280;font-size:0.9em;margin-bottom:20px;">${metaItems.map(escapeHtml).join(' · ')}</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:20px;"/>
${segmentsHtml}
${tipsHtml}
<div style="margin-top:24px;padding:12px 16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;font-size:0.8em;color:#854d0e;">⚠️ Precios netos de agencia. Impuestos locales, tasas turísticas y cargos adicionales del destino no están incluidos. Sujeto a disponibilidad y condiciones del proveedor al momento de la reserva.</div>
<footer style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:0.8em;text-align:center;">Generado con VBOOK · ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</footer>
</body>
</html>`;
}
