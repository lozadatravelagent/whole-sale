import type { MessageRow } from '@/features/chat/types/chat';
import type { LocalHotelData } from '@/features/chat/types/chat';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { PlannerDay, PlannerFieldProvenance, PlannerSegment, TripPlannerState } from './types';
import { getPlannerHotelDisplayId, normalizePlannerState } from './utils';

export interface PlannerMessageMeta {
  plannerData?: unknown;
  plannerState?: unknown;
  messageType?: string;
  timestamp?: string;
}

export function isPersistableConversationId(value: string | null): value is string {
  if (!value || value.startsWith('temp-')) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function getLatestPlannerMessage(messages: MessageRow[], conversationId: string | null): MessageRow | null {
  return [...messages]
    .reverse()
    .find((message) => {
      const meta = message.meta as PlannerMessageMeta | null;
      return (
        message.conversation_id === conversationId &&
        message.role === 'assistant' &&
        meta &&
        (meta.plannerData || meta.messageType === 'trip_planner')
      );
    }) || null;
}

export function normalizeHotelPlannerError(message?: string): string | undefined {
  if (!message) return undefined;

  if (/servicio de hoteles temporalmente no disponible|servicios de b[uú]squeda de hoteles est[aá]n siendo configurados/i.test(message)) {
    return 'El buscador de hoteles no esta disponible en este momento. Podes seguir armando el viaje y volver a intentarlo mas tarde.';
  }

  return undefined;
}

export function normalizeLocationLabel(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function buildPlannerHotelSearchSignature(input: {
  city: string;
  checkinDate: string;
  checkoutDate: string;
  adults: number;
  children: number;
  infants: number;
}): string {
  return [
    normalizeLocationLabel(input.city),
    input.checkinDate,
    input.checkoutDate,
    input.adults,
    input.children,
    input.infants,
  ].join('|');
}

export function buildPlannerTransportSearchSignature(input: {
  origin: string;
  destination: string;
  departureDate: string;
  adults: number;
  children: number;
  infants: number;
}): string {
  return [
    normalizeLocationLabel(input.origin),
    normalizeLocationLabel(input.destination),
    input.departureDate,
    input.adults,
    input.children,
    input.infants,
  ].join('|');
}

export function mergePlannerHotels(...hotelSets: LocalHotelData[][]): LocalHotelData[] {
  const merged = new Map<string, LocalHotelData>();

  hotelSets.flat().forEach((hotel) => {
    const hotelId = getPlannerHotelDisplayId(hotel);
    if (!merged.has(hotelId)) {
      merged.set(hotelId, hotel);
    }
  });

  return Array.from(merged.values());
}

export function isDraftPlannerState(state: TripPlannerState | null | undefined): boolean {
  return Boolean(state?.generationMeta?.isDraft);
}

export function shouldReplacePlannerState(
  current: TripPlannerState | null,
  next: TripPlannerState | null,
): boolean {
  if (!next) return false;
  if (!current) return true;

  const currentIsDraft = isDraftPlannerState(current);
  const nextIsDraft = isDraftPlannerState(next);

  if (currentIsDraft !== nextIsDraft) {
    return currentIsDraft && !nextIsDraft;
  }

  const currentVersion = current.generationMeta?.version || 0;
  const nextVersion = next.generationMeta?.version || 0;
  if (nextVersion !== currentVersion) {
    return nextVersion > currentVersion;
  }

  return (current.generationMeta?.updatedAt || '') < (next.generationMeta?.updatedAt || '');
}

const PROTECTABLE_PLANNER_FIELDS = new Set([
  'startDate', 'endDate', 'days', 'budgetLevel', 'pace', 'travelers',
  'origin', 'originCountry', 'isFlexibleDates', 'flexibleMonth', 'flexibleYear',
]);

function stripProtectedFields(
  next: TripPlannerState,
  currentProvenance?: PlannerFieldProvenance,
): Partial<TripPlannerState> {
  if (!currentProvenance) return next;
  const filtered = { ...next } as Record<string, unknown>;
  for (const field of PROTECTABLE_PLANNER_FIELDS) {
    const source = currentProvenance[field as keyof PlannerFieldProvenance];
    if (source === 'user' || source === 'confirmed') {
      delete filtered[field];
    }
  }
  return filtered as Partial<TripPlannerState>;
}

export function mergeEnrichedSegmentState(
  current: TripPlannerState,
  next: TripPlannerState,
  segmentId: string,
): TripPlannerState {
  const enrichedSegment = next.segments.find(
    (segment) =>
      segment.id === segmentId
      || normalizeLocationLabel(segment.city) === normalizeLocationLabel(
        current.segments.find((item) => item.id === segmentId)?.city || '',
      ),
  );

  if (!enrichedSegment) {
    return {
      ...current,
      ...stripProtectedFields(next, current.fieldProvenance),
      fieldProvenance: current.fieldProvenance,
      generationMeta: {
        ...current.generationMeta,
        source: 'system',
        updatedAt: new Date().toISOString(),
      },
    };
  }

  return {
    ...current,
    ...stripProtectedFields(next, current.fieldProvenance),
    fieldProvenance: current.fieldProvenance,
    segments: current.segments.map((segment) => {
      const matches = segment.id === segmentId
        || segment.id === enrichedSegment.id
        || normalizeLocationLabel(segment.city) === normalizeLocationLabel(enrichedSegment.city);

      if (!matches) {
        return segment;
      }

      return {
        ...segment,
        ...enrichedSegment,
        contentStatus: 'ready',
        contentError: undefined,
        location: segment.location || enrichedSegment.location,
        realPlacesStatus: segment.realPlacesStatus,
        hotelPlan: {
          ...enrichedSegment.hotelPlan,
          ...segment.hotelPlan,
          city: enrichedSegment.city || segment.hotelPlan.city || segment.city,
          checkinDate: enrichedSegment.startDate || segment.hotelPlan.checkinDate,
          checkoutDate: enrichedSegment.endDate || segment.hotelPlan.checkoutDate,
        },
        transportIn: segment.transportIn ?? enrichedSegment.transportIn,
        transportOut: segment.transportOut ?? enrichedSegment.transportOut,
      };
    }),
    generationMeta: {
      ...current.generationMeta,
      source: 'system',
      updatedAt: new Date().toISOString(),
    },
  };
}

const STRUCTURAL_FIELDS = new Set(['destinations', 'startDate', 'endDate', 'days']);

export function mergePlannerFieldUpdate(
  current: TripPlannerState,
  updates: Partial<NonNullable<ParsedTravelRequest['itinerary']>>,
): {
  merged: TripPlannerState;
  fieldProvenance: PlannerFieldProvenance;
  requiresRegeneration: boolean;
} {
  const currentProvenance: PlannerFieldProvenance = { ...current.fieldProvenance };
  let requiresRegeneration = false;

  const merged = { ...current };

  if (updates.days != null && updates.days > 0) {
    merged.days = updates.days;
    currentProvenance.days = 'confirmed';
    requiresRegeneration = true;
  }

  if (updates.startDate) {
    merged.startDate = updates.startDate;
    merged.isFlexibleDates = false;
    currentProvenance.startDate = 'confirmed';
    requiresRegeneration = true;
  }

  if (updates.endDate) {
    merged.endDate = updates.endDate;
    merged.isFlexibleDates = false;
    currentProvenance.endDate = 'confirmed';
    requiresRegeneration = true;
  }

  if (updates.isFlexibleDates != null) {
    merged.isFlexibleDates = updates.isFlexibleDates;
    if (updates.flexibleMonth) merged.flexibleMonth = updates.flexibleMonth;
    if (updates.flexibleYear) merged.flexibleYear = updates.flexibleYear;
    currentProvenance.startDate = 'confirmed';
    currentProvenance.endDate = 'confirmed';
    requiresRegeneration = true;
  }

  if (updates.destinations && updates.destinations.length > 0) {
    const currentDests = current.destinations.map(d => d.toLowerCase()).sort().join(',');
    const newDests = updates.destinations.map(d => d.toLowerCase()).sort().join(',');
    if (currentDests !== newDests) {
      requiresRegeneration = true;
    }
  }

  if (updates.budgetLevel) {
    merged.budgetLevel = updates.budgetLevel as TripPlannerState['budgetLevel'];
    currentProvenance.budgetLevel = 'confirmed';
  }

  if (updates.pace) {
    merged.pace = updates.pace as TripPlannerState['pace'];
    currentProvenance.pace = 'confirmed';
  }

  if (updates.travelers?.adults != null) {
    merged.travelers = {
      adults: updates.travelers.adults ?? current.travelers.adults,
      children: updates.travelers.children ?? current.travelers.children,
      infants: updates.travelers.infants ?? current.travelers.infants,
    };
    currentProvenance.travelers = 'confirmed';
  }

  merged.fieldProvenance = currentProvenance;

  return { merged, fieldProvenance: currentProvenance, requiresRegeneration };
}

// --- Partial state update helpers ---

const HOTEL_TRIGGER_FIELDS = new Set(['startDate', 'endDate', 'days', 'travelers']);
const TRANSPORT_TRIGGER_FIELDS = new Set(['startDate', 'endDate', 'days', 'travelers']);

export function shouldRefetch(
  changedField: string,
  target: 'hotels' | 'transport',
): boolean {
  const triggers = target === 'hotels' ? HOTEL_TRIGGER_FIELDS : TRANSPORT_TRIGGER_FIELDS;
  return triggers.has(changedField);
}

function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function reindexSegmentDays(
  segment: PlannerSegment,
  newDayCount: number,
  segmentStartDate?: string,
): { days: PlannerDay[]; bufferedDays: PlannerDay[] } {
  const currentDays = segment.days;
  const existingBuffer = segment.bufferedDays || [];

  if (newDayCount === currentDays.length) {
    return { days: currentDays, bufferedDays: existingBuffer };
  }

  if (newDayCount < currentDays.length) {
    // Shrinking — trim from end, push to buffer
    const kept = currentDays.slice(0, newDayCount);
    const trimmed = currentDays.slice(newDayCount);
    const maxBuffer = Math.max(currentDays.length * 2, 4);
    const nextBuffer = [...trimmed, ...existingBuffer].slice(0, maxBuffer);

    const reindexed = kept.map((day, i) => ({
      ...day,
      id: `${segment.id}-day-${i + 1}`,
      dayNumber: i + 1,
      date: segmentStartDate ? addDaysISO(segmentStartDate, i) : day.date,
    }));

    return { days: reindexed, bufferedDays: nextBuffer };
  }

  // Expanding — restore from buffer first (LIFO: first items in buffer were last trimmed)
  const toRestore = Math.min(newDayCount - currentDays.length, existingBuffer.length);
  const restoredFromBuffer = existingBuffer.slice(0, toRestore);
  const remainingBuffer = existingBuffer.slice(toRestore);

  const baseDays = [...currentDays, ...restoredFromBuffer];

  // Fill remaining empty slots
  const emptySlots = newDayCount - baseDays.length;
  const emptyDays: PlannerDay[] = Array.from({ length: emptySlots }, (_, i) => {
    const dayNum = baseDays.length + i + 1;
    return {
      id: `${segment.id}-day-${dayNum}`,
      dayNumber: dayNum,
      date: segmentStartDate ? addDaysISO(segmentStartDate, baseDays.length + i) : undefined,
      city: segment.city,
      title: `Día ${dayNum}`,
      morning: [],
      afternoon: [],
      evening: [],
      restaurants: [],
    };
  });

  const allDays = [...baseDays, ...emptyDays];
  const reindexed = allDays.map((day, i) => ({
    ...day,
    id: `${segment.id}-day-${i + 1}`,
    dayNumber: i + 1,
    date: segmentStartDate ? addDaysISO(segmentStartDate, i) : day.date,
  }));

  const maxBuffer = Math.max(currentDays.length * 2, 4);
  return { days: reindexed, bufferedDays: remainingBuffer.slice(0, maxBuffer) };
}

export function redistributeDaysAcrossSegments(
  segments: PlannerSegment[],
  newTotalDays: number,
  dateSelection?: { startDate?: string; endDate?: string },
): PlannerSegment[] {
  if (segments.length === 0) return segments;

  // Floor division, remainder to first segments
  const baseDays = Math.floor(newTotalDays / segments.length);
  let remainder = newTotalDays - baseDays * segments.length;

  const dayAllocation = segments.map(() => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return baseDays + extra;
  });

  let runningDate = dateSelection?.startDate;

  return segments.map((segment, i) => {
    const allocatedDays = dayAllocation[i];
    const segmentStart = runningDate;
    const { days, bufferedDays } = reindexSegmentDays(segment, allocatedDays, segmentStart);

    const segmentEnd = segmentStart && allocatedDays > 0
      ? addDaysISO(segmentStart, allocatedDays - 1)
      : segment.endDate;

    if (runningDate && allocatedDays > 0) {
      runningDate = addDaysISO(runningDate, allocatedDays);
    }

    return {
      ...segment,
      days,
      bufferedDays,
      nights: Math.max(0, allocatedDays - 1),
      startDate: segmentStart,
      endDate: segmentEnd,
      hotelPlan: {
        ...segment.hotelPlan,
        checkinDate: segmentStart || segment.hotelPlan.checkinDate,
        checkoutDate: segmentEnd ? addDaysISO(segmentEnd, 1) : segment.hotelPlan.checkoutDate,
      },
    };
  });
}
