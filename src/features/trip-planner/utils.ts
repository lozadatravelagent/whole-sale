import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { FlightData, LocalHotelData } from '@/features/chat/types/chat';
import type {
  PlannerActivity,
  PlannerBudgetLevel,
  PlannerDay,
  PlannerActivityType,
  PlannerLocation,
  PlannerPace,
  PlannerRestaurant,
  PlannerSegment,
  TripPlannerState,
} from './types';
import { classifyPlannerActivityType, normalizePlannerSegmentsScheduling } from './scheduling';

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

function activityToPlannerActivity(activity: any, index: number, segmentId: string, dayNumber: number, block: string): PlannerActivity {
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
    locked: Boolean(activity?.locked),
    source: activity?.source || 'generated',
  };
}

function restaurantToPlannerRestaurant(restaurant: any, index: number, segmentId: string, dayNumber: number): PlannerRestaurant {
  return {
    id: `${segmentId}-day-${dayNumber}-restaurant-${index + 1}`,
    name: restaurant?.name || 'Restaurante',
    type: restaurant?.type,
    priceRange: restaurant?.priceRange,
  };
}

function legacyDayToPlannerDay(rawDay: any, index: number, city: string, segmentId: string): PlannerDay {
  const dayNumber = rawDay?.day || index + 1;
  return {
    id: `${segmentId}-day-${dayNumber}`,
    dayNumber,
    date: rawDay?.date,
    city: rawDay?.city || city,
    title: rawDay?.title || `Día ${dayNumber}`,
    summary: rawDay?.summary,
    locked: Boolean(rawDay?.locked),
    morning: safeArray(rawDay?.morning).map((item, itemIndex) =>
      activityToPlannerActivity(item, itemIndex, segmentId, dayNumber, 'morning')
    ),
    afternoon: safeArray(rawDay?.afternoon).map((item, itemIndex) =>
      activityToPlannerActivity(item, itemIndex, segmentId, dayNumber, 'afternoon')
    ),
    evening: safeArray(rawDay?.evening).map((item, itemIndex) =>
      activityToPlannerActivity(item, itemIndex, segmentId, dayNumber, 'evening')
    ),
    restaurants: safeArray(rawDay?.restaurants).map((item, itemIndex) =>
      restaurantToPlannerRestaurant(item, itemIndex, segmentId, dayNumber)
    ),
    travelTip: rawDay?.travelTip,
  };
}

function normalizePlannerLocation(rawLocation: any, fallbackCity: string, fallbackCountry?: string): PlannerLocation | undefined {
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

function buildSegmentFromLegacyItinerary(raw: any): PlannerSegment {
  const destinations = safeArray<string>(raw?.destinations);
  const city = destinations[0] || 'Destino';
  const segmentId = `segment-${slugify(city) || 'destination'}-1`;
  const days = safeArray<any>(raw?.itinerary).map((day, index) => legacyDayToPlannerDay(day, index, city, segmentId));

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
      hotelRecommendations: [],
      lastSearchSignature: undefined,
    },
    transportIn: null,
    transportOut: null,
    days,
  };
}

function normalizeSegment(rawSegment: any, index: number): PlannerSegment {
  const city = rawSegment?.city || rawSegment?.destination || `Destino ${index + 1}`;
  const segmentId = rawSegment?.id || `segment-${slugify(city) || 'destination'}-${index + 1}`;
  const days = safeArray<any>(rawSegment?.days).map((rawDay, dayIndex) =>
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
      selectedHotelId: rawSegment?.hotelPlan?.selectedHotelId,
      hotelRecommendations: safeArray(rawSegment?.hotelPlan?.hotelRecommendations),
      linkedSearchId: rawSegment?.hotelPlan?.linkedSearchId,
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

export function normalizePlannerState(raw: any, conversationId?: string): TripPlannerState {
  const source = raw?.plannerData || raw;
  const rawSegments = safeArray<any>(source?.segments).length > 0
    ? safeArray<any>(source?.segments).map(normalizeSegment)
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
    generationMeta: {
      source: source?.generationMeta?.source || 'system',
      updatedAt: source?.generationMeta?.updatedAt || new Date().toISOString(),
      version: source?.generationMeta?.version || 1,
    },
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
      return `${stars} estrella${stars === 1 ? '' : 's'}`;
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

export function getPlannerHotelDisplayId(hotel: LocalHotelData): string {
  return hotel.hotel_id || `${hotel.name}-${hotel.city}`;
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

export function summarizePlannerForChat(plannerState: TripPlannerState): string {
  const effectiveDays = !plannerState.isFlexibleDates
    ? getInclusiveDateRangeDays(plannerState.startDate, plannerState.endDate) || plannerState.days
    : plannerState.days;
  const segmentLines = plannerState.segments
    .map((segment) => `- ${formatDestinationLabel(segment.city)}: ${formatDateRange(segment.startDate, segment.endDate)}`)
    .join('\n');

  const tips = plannerState.generalTips.slice(0, 3).map((tip) => `- ${tip}`).join('\n');
  const paceLabel = formatPaceLabel(plannerState.pace);
  const budgetLabel = formatBudgetLevel(plannerState.budgetLevel);

  return `🧭 **${plannerState.title}**\n\n` +
    `${plannerState.summary}\n\n` +
    `**Destinos:** ${plannerState.destinations.map(formatDestinationLabel).join(', ')}\n` +
    `**Duración:** ${effectiveDays} días\n` +
    `${plannerState.isFlexibleDates
      ? `**Fechas:** ${formatFlexibleMonth(plannerState.flexibleMonth, plannerState.flexibleYear)}\n`
      : plannerState.startDate || plannerState.endDate
        ? `**Fechas:** ${formatDateRange(plannerState.startDate, plannerState.endDate)}\n`
        : ''}` +
    `${paceLabel ? `**Ritmo:** ${paceLabel}\n` : ''}` +
    `${budgetLabel ? `**Presupuesto:** ${budgetLabel}\n` : ''}` +
    `\n**Tramos**\n${segmentLines}\n` +
    `${tips ? `\n**Consejos**\n${tips}\n` : ''}` +
    `\nUsá el Planificador de Viajes para editar días, destinos, hoteles y transporte.`;
}
