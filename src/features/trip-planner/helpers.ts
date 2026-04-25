import type { MessageRow } from '@/features/chat/types/chat';
import type { LocalHotelData } from '@/types/external';
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

// ---------------------------------------------------------------------------
// User-activity preservation during segment enrichment
// ---------------------------------------------------------------------------

type SlotName = 'morning' | 'afternoon' | 'evening';
const ACTIVITY_SLOTS: SlotName[] = ['morning', 'afternoon', 'evening'];

interface SavedUserActivity {
  activity: PlannerDay['morning'][number];
  dayNumber: number;
  slot: SlotName;
}

interface SavedUserRestaurant {
  restaurant: PlannerDay['restaurants'][number];
  dayNumber: number;
}

function isUserSourceActivity(a: { source?: string }): boolean {
  return a.source === 'user' || a.source === 'google_maps' || a.source === 'foursquare';
}

function collectUserActivities(days: PlannerDay[]): { activities: SavedUserActivity[]; restaurants: SavedUserRestaurant[] } {
  const activities: SavedUserActivity[] = [];
  const restaurants: SavedUserRestaurant[] = [];

  for (const day of days) {
    for (const slot of ACTIVITY_SLOTS) {
      for (const activity of day[slot] || []) {
        if (isUserSourceActivity(activity)) {
          activities.push({ activity, dayNumber: day.dayNumber, slot });
        }
      }
    }
    for (const restaurant of day.restaurants || []) {
      if (isUserSourceActivity(restaurant)) {
        restaurants.push({ restaurant, dayNumber: day.dayNumber });
      }
    }
  }

  return { activities, restaurants };
}

function reinsertUserActivities(
  enrichedDays: PlannerDay[],
  saved: { activities: SavedUserActivity[]; restaurants: SavedUserRestaurant[] },
): PlannerDay[] {
  if (saved.activities.length === 0 && saved.restaurants.length === 0) return enrichedDays;
  if (enrichedDays.length === 0) return enrichedDays;

  const result = enrichedDays.map((day) => ({
    ...day,
    morning: [...day.morning],
    afternoon: [...day.afternoon],
    evening: [...day.evening],
    restaurants: [...day.restaurants],
  }));

  const lastDayNumber = result[result.length - 1].dayNumber;

  for (const { activity, dayNumber, slot } of saved.activities) {
    const targetDayNum = dayNumber <= lastDayNumber ? dayNumber : lastDayNumber;
    const targetDay = result.find((d) => d.dayNumber === targetDayNum) || result[result.length - 1];

    const alreadyExists = targetDay[slot].some((a) =>
      (activity.placeId && a.placeId === activity.placeId)
      || a.id === activity.id,
    );
    if (alreadyExists) continue;

    targetDay[slot].push(activity);
  }

  for (const { restaurant, dayNumber } of saved.restaurants) {
    const targetDayNum = dayNumber <= lastDayNumber ? dayNumber : lastDayNumber;
    const targetDay = result.find((d) => d.dayNumber === targetDayNum) || result[result.length - 1];

    const alreadyExists = targetDay.restaurants.some((r) =>
      (restaurant.placeId && r.placeId === restaurant.placeId)
      || r.id === restaurant.id,
    );
    if (alreadyExists) continue;

    targetDay.restaurants.push(restaurant);
  }

  return result;
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

      // Collect user-added activities from the CURRENT segment before overwriting
      const saved = collectUserActivities(segment.days || []);
      const enrichedDays = reinsertUserActivities(enrichedSegment.days || [], saved);

      return {
        ...segment,
        ...enrichedSegment,
        days: enrichedDays,
        startDate: segment.startDate || enrichedSegment.startDate,
        endDate: segment.endDate || enrichedSegment.endDate,
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

const HOTEL_TRIGGER_FIELDS = new Set(['startDate', 'endDate', 'days', 'travelers', 'budgetLevel', 'pace']);
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
  weights?: Map<string, { weight: number; minDays: number }>,
): PlannerSegment[] {
  if (segments.length === 0) return segments;

  let dayAllocation: number[];

  if (weights && weights.size > 0) {
    // Weighted distribution
    dayAllocation = segments.map(seg => {
      const w = weights.get(seg.city.toLowerCase());
      return w ? Math.max(w.minDays, Math.round(newTotalDays * w.weight)) : Math.max(1, Math.round(newTotalDays / segments.length));
    });

    let sum = dayAllocation.reduce((a, b) => a + b, 0);
    while (sum > newTotalDays) {
      // Trim from lowest weight
      let trimIdx = -1;
      let minWeight = Infinity;
      for (let i = 0; i < segments.length; i++) {
        const w = weights.get(segments[i].city.toLowerCase());
        const minD = w?.minDays ?? 1;
        if (dayAllocation[i] > minD && (w?.weight ?? 1) < minWeight) {
          minWeight = w?.weight ?? 1;
          trimIdx = i;
        }
      }
      if (trimIdx === -1) break;
      dayAllocation[trimIdx]--;
      sum--;
    }
    while (sum < newTotalDays) {
      // Add to highest weight
      let addIdx = 0;
      let maxWeight = -1;
      for (let i = 0; i < segments.length; i++) {
        const w = weights.get(segments[i].city.toLowerCase());
        if ((w?.weight ?? 0) > maxWeight) {
          maxWeight = w?.weight ?? 0;
          addIdx = i;
        }
      }
      dayAllocation[addIdx]++;
      sum++;
    }
  } else {
    // Floor division, remainder to first segments
    const baseDays = Math.floor(newTotalDays / segments.length);
    let remainder = newTotalDays - baseDays * segments.length;

    dayAllocation = segments.map(() => {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      return baseDays + extra;
    });
  }

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

// ---------------------------------------------------------------------------
// Concurrency limiter
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Structural modifications from planner agent
// ---------------------------------------------------------------------------

export interface StructuralModification {
  action: 'reorder_segments' | 'extend_segment' | 'shrink_segment';
  newSegmentOrder?: string[];      // segment IDs in new order
  targetSegmentId?: string;
  deltaNights?: number;            // +1, -1, etc.
}

export function applyStructuralModification(
  state: TripPlannerState,
  mod: StructuralModification,
): TripPlannerState {
  const next = { ...state, segments: [...state.segments] };

  if (mod.action === 'reorder_segments' && mod.newSegmentOrder?.length) {
    const ordered: PlannerSegment[] = [];
    for (const id of mod.newSegmentOrder) {
      const seg = next.segments.find(s => s.id === id);
      if (seg) ordered.push({ ...seg, order: ordered.length });
    }
    // Add any segments not in the new order at the end
    for (const seg of next.segments) {
      if (!mod.newSegmentOrder.includes(seg.id)) {
        ordered.push({ ...seg, order: ordered.length });
      }
    }
    next.segments = ordered;
    next.destinations = ordered.map(s => s.city);

    // Recalculate dates via redistribution
    if (next.days && next.startDate) {
      next.segments = redistributeDaysAcrossSegments(
        next.segments,
        next.days,
        { startDate: next.startDate, endDate: next.endDate },
      );
    }
    return next;
  }

  if ((mod.action === 'extend_segment' || mod.action === 'shrink_segment') && mod.targetSegmentId) {
    const delta = mod.deltaNights ?? (mod.action === 'extend_segment' ? 1 : -1);
    const segIdx = next.segments.findIndex(s => s.id === mod.targetSegmentId);
    if (segIdx < 0) return next;

    const seg = { ...next.segments[segIdx] };
    const currentNights = seg.nights ?? seg.days.length ?? 1;
    const newNights = Math.max(1, currentNights + delta);

    // Reindex days for this segment
    const { days, bufferedDays } = reindexSegmentDays(seg, newNights, seg.startDate);
    seg.nights = newNights;
    seg.days = days;
    seg.bufferedDays = bufferedDays;
    next.segments[segIdx] = seg;

    // Update total days
    const totalDays = next.segments.reduce((sum, s) => sum + (s.nights ?? s.days.length ?? 1), 0);
    next.days = totalDays;

    // Recalculate dates in cascade
    if (next.startDate) {
      next.segments = redistributeDaysAcrossSegments(
        next.segments,
        totalDays,
        { startDate: next.startDate },
      );
    }

    return next;
  }

  return next;
}

export function createConcurrencyLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= maxConcurrent) {
      await new Promise<void>(resolve => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}
