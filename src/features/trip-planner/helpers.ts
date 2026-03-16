import type { MessageRow } from '@/features/chat/types/chat';
import type { LocalHotelData } from '@/features/chat/types/chat';
import type { TripPlannerState } from './types';
import { getPlannerHotelDisplayId, normalizePlannerState } from './utils';

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
      const meta = message.meta as any;
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
      ...next,
      generationMeta: {
        ...current.generationMeta,
        source: 'system',
        updatedAt: new Date().toISOString(),
      },
    };
  }

  return {
    ...current,
    ...next,
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
