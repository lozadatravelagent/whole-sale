import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleFlightSearch, handleHotelSearch } from '@/features/chat/services/searchHandlers';
import type { MessageRow } from '@/features/chat/types/chat';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { TripPlannerState } from './types';
import {
  buildPlannerGenerationPayload,
  formatDestinationLabel,
  getPlannerHotelDisplayId,
  getInclusiveDateRangeDays,
  normalizePlannerState,
} from './utils';
import { enrichPlannerWithLocations } from './services/plannerGeocoding';

function isPersistableConversationId(value: string | null): value is string {
  if (!value || value.startsWith('temp-')) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getLatestPlannerMessage(messages: MessageRow[]): MessageRow | null {
  return [...messages]
    .reverse()
    .find((message) => {
      const meta = message.meta as any;
      return message.role === 'assistant' && meta && (meta.plannerData || meta.messageType === 'trip_planner');
    }) || null;
}

function normalizeHotelPlannerError(message?: string): string | undefined {
  if (!message) return undefined;

  if (/servicio de hoteles temporalmente no disponible|servicios de b[uú]squeda de hoteles est[aá]n siendo configurados/i.test(message)) {
    return 'El buscador de hoteles no esta disponible en este momento. Podes seguir armando el viaje y volver a intentarlo mas tarde.';
  }

  return undefined;
}

function normalizeLocationLabel(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function buildPlannerHotelSearchSignature(input: {
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

function buildPlannerTransportSearchSignature(input: {
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

export default function useTripPlanner(
  conversationId: string | null,
  messages: MessageRow[],
  toast: (args: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
) {
  const [plannerState, setPlannerState] = useState<TripPlannerState | null>(null);
  const [isLoadingPlanner, setIsLoadingPlanner] = useState(false);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [activePlannerMutation, setActivePlannerMutation] = useState<{
    type: 'regen_plan' | 'regen_segment' | 'regen_day';
    segmentId?: string;
    dayId?: string;
  } | null>(null);
  const [isResolvingLocations, setIsResolvingLocations] = useState(false);
  const [plannerLocationWarning, setPlannerLocationWarning] = useState<string | null>(null);
  const resolvingSignatureRef = useRef<string | null>(null);
  const isAutoLoadingHotelsRef = useRef(false);
  const isAutoLoadingTransportRef = useRef(false);

  const persistPlannerState = useCallback(async (state: TripPlannerState, source: string) => {
    if (!isPersistableConversationId(conversationId)) return;

    const normalizedState: TripPlannerState = {
      ...state,
      conversationId,
      generationMeta: {
        ...state.generationMeta,
        source: source as TripPlannerState['generationMeta']['source'],
        updatedAt: new Date().toISOString(),
        version: (state.generationMeta?.version || 0) + (source === 'chat' ? 0 : 1),
      },
    };

    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('role', 'system')
      .contains('meta', { messageType: 'trip_planner_state' });

    if (deleteError) {
      console.warn('⚠️ [TRIP PLANNER] Could not delete old planner snapshots:', deleteError);
    }

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'system',
        content: { text: '' },
        meta: {
          messageType: 'trip_planner_state',
          plannerState: normalizedState,
          timestamp: new Date().toISOString(),
        },
      });

    if (error) {
      console.error('❌ [TRIP PLANNER] Failed to persist planner state:', error);
    }
  }, [conversationId]);

  const loadPersistedPlannerState = useCallback(async () => {
    if (!conversationId) {
      setPlannerState(null);
      setPlannerError(null);
      setIsLoadingPlanner(false);
      return;
    }

    if (!isPersistableConversationId(conversationId)) {
      setPlannerState(null);
      setPlannerError(null);
      setIsLoadingPlanner(false);
      return;
    }

    setIsLoadingPlanner(true);
    setPlannerError(null);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('role', 'system')
        .contains('meta', { messageType: 'trip_planner_state' })
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      const snapshot = data?.[0];
      const meta = snapshot?.meta as any;
      const fromSystem = meta?.plannerState ? normalizePlannerState(meta.plannerState, conversationId) : null;
      const fromMessages = getLatestPlannerMessage(messages);
      const fromAssistant = fromMessages
        ? normalizePlannerState(((fromMessages.meta as any)?.plannerData), conversationId)
        : null;

      const nextState = fromSystem || fromAssistant || null;
      setPlannerState((current) => {
        if (!current && !nextState) return current;
        if (!current || !nextState) return nextState;
        if ((current.generationMeta?.updatedAt || '') >= (nextState.generationMeta?.updatedAt || '')) {
          return current;
        }
        return nextState;
      });
    } catch (error) {
      console.error('❌ [TRIP PLANNER] Failed to load planner state:', error);
      setPlannerError('No se pudo cargar el estado del planificador.');
    } finally {
      setIsLoadingPlanner(false);
    }
  }, [conversationId, messages]);

  useEffect(() => {
    void loadPersistedPlannerState();
  }, [loadPersistedPlannerState]);

  useEffect(() => {
    if (!conversationId) return;
    const latestPlannerMessage = getLatestPlannerMessage(messages);
    const meta = latestPlannerMessage?.meta as any;
    if (!meta?.plannerData) return;

    const nextState = normalizePlannerState(meta.plannerData, conversationId);
    setPlannerState((current) => {
      if (!current) return nextState;
      if ((current.generationMeta?.updatedAt || '') >= (nextState.generationMeta?.updatedAt || '')) {
        return current;
      }
      return nextState;
    });
  }, [conversationId, messages]);

  useEffect(() => {
    if (!plannerState || plannerState.segments.length === 0) {
      setIsResolvingLocations(false);
      setPlannerLocationWarning(null);
      resolvingSignatureRef.current = null;
      return;
    }

    const pendingSegments = plannerState.segments.filter((segment) => {
      if (!segment.location) return true;
      return normalizeLocationLabel(segment.location.city) !== normalizeLocationLabel(segment.city);
    });

    if (pendingSegments.length === 0) {
      setIsResolvingLocations(false);
      setPlannerLocationWarning(null);
      return;
    }

    const signature = pendingSegments.map((segment) => `${segment.id}:${segment.city}:${segment.country || ''}`).join('|');
    if (resolvingSignatureRef.current === signature) {
      return;
    }

    resolvingSignatureRef.current = signature;
    setIsResolvingLocations(true);

    let cancelled = false;

    void enrichPlannerWithLocations(plannerState)
      .then(async ({ plannerState: nextState, changed, unresolvedCities }) => {
        if (cancelled) return;

        setPlannerLocationWarning(
          unresolvedCities.length > 0
            ? `No pudimos ubicar ${unresolvedCities.join(', ')} en el mapa por ahora.`
            : null
        );
        setIsResolvingLocations(false);

        if (!changed) {
          return;
        }

        setPlannerState(nextState);
        await persistPlannerState(nextState, 'system');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('❌ [TRIP PLANNER] Failed to resolve planner locations:', error);
        setIsResolvingLocations(false);
        setPlannerLocationWarning('No pudimos ubicar algunos destinos en el mapa por ahora.');
      });

    return () => {
      cancelled = true;
      resolvingSignatureRef.current = null;
    };
  }, [persistPlannerState, plannerState]);

  const updatePlannerState = useCallback(async (
    updater: (current: TripPlannerState) => TripPlannerState,
    source: 'ui_edit' | 'regen_day' | 'regen_segment' | 'regen_plan' = 'ui_edit'
  ) => {
    setPlannerState((current) => {
      if (!current) return current;
      const next = updater(current);
      void persistPlannerState(next, source);
      return next;
    });
  }, [persistPlannerState]);

  const invokePlannerGeneration = useCallback(async (
    payload: Record<string, unknown>,
    source: 'regen_day' | 'regen_segment' | 'regen_plan',
    mutationMeta?: {
      segmentId?: string;
      dayId?: string;
    }
  ) => {
    if (!conversationId) return;

    setIsLoadingPlanner(true);
    setActivePlannerMutation({
      type: source,
      segmentId: mutationMeta?.segmentId,
      dayId: mutationMeta?.dayId,
    });
    setPlannerError(null);

    try {
      const response = await supabase.functions.invoke('travel-itinerary', {
        body: payload,
      });

      if (response.error) {
        throw response.error;
      }

      const nextState = normalizePlannerState(response.data?.data, conversationId);
      setPlannerState(nextState);
      await persistPlannerState(nextState, source);
      toast({
        title: 'Planificador actualizado',
        description: 'El itinerario se regeneró correctamente.',
      });
    } catch (error: any) {
      console.error('❌ [TRIP PLANNER] Regeneration failed:', error);
      setPlannerError(error?.message || 'No se pudo regenerar el planificador.');
      toast({
        title: 'No se pudo actualizar el planificador',
        description: error?.message || 'No se pudo regenerar el planificador.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPlanner(false);
      setActivePlannerMutation(null);
    }
  }, [conversationId, persistPlannerState, toast]);

  const regeneratePlanner = useCallback(async () => {
    if (!plannerState) return;
    await invokePlannerGeneration(buildPlannerGenerationPayload(plannerState), 'regen_plan');
  }, [plannerState, invokePlannerGeneration]);

  const regenerateSegment = useCallback(async (segmentId: string) => {
    if (!plannerState) return;
    await invokePlannerGeneration(
      buildPlannerGenerationPayload(plannerState, {
        editIntent: {
          action: 'regenerate_segment',
          targetSegmentId: segmentId,
        },
      }),
      'regen_segment',
      { segmentId }
    );
  }, [plannerState, invokePlannerGeneration]);

  const regenerateDay = useCallback(async (segmentId: string, dayId: string) => {
    if (!plannerState) return;
    await invokePlannerGeneration(
      buildPlannerGenerationPayload(plannerState, {
        editIntent: {
          action: 'regenerate_day',
          targetSegmentId: segmentId,
          targetDayId: dayId,
        },
      }),
      'regen_day',
      { segmentId, dayId }
    );
  }, [plannerState, invokePlannerGeneration]);

  const toggleDayLock = useCallback(async (segmentId: string, dayId: string) => {
    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((segment) =>
        segment.id !== segmentId
          ? segment
          : {
              ...segment,
              days: segment.days.map((day) =>
                day.id !== dayId ? day : { ...day, locked: !day.locked }
              ),
            }
      ),
    }));
  }, [updatePlannerState]);

  const toggleActivityLock = useCallback(async (
    segmentId: string,
    dayId: string,
    block: 'morning' | 'afternoon' | 'evening',
    activityId: string
  ) => {
    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((segment) =>
        segment.id !== segmentId
          ? segment
          : {
              ...segment,
              days: segment.days.map((day) => {
                if (day.id !== dayId) return day;
                return {
                  ...day,
                  [block]: day[block].map((activity) =>
                    activity.id !== activityId ? activity : { ...activity, locked: !activity.locked }
                  ),
                };
              }),
            }
      ),
    }));
  }, [updatePlannerState]);

  const updateTripField = useCallback(async <K extends keyof TripPlannerState>(field: K, value: TripPlannerState[K]) => {
    await updatePlannerState((current) => ({
      ...current,
      [field]: value,
    }));
  }, [updatePlannerState]);

  const setExactDateRange = useCallback(async (startDate: string, endDate: string) => {
    const derivedDays = getInclusiveDateRangeDays(startDate, endDate);
    if (!derivedDays) return;

    await updatePlannerState((current) => ({
      ...current,
      startDate,
      endDate,
      days: derivedDays,
      isFlexibleDates: false,
      flexibleMonth: undefined,
      flexibleYear: undefined,
    }));
  }, [updatePlannerState]);

  const applyPlannerDateSelection = useCallback(async (selection: {
    startDate?: string;
    endDate?: string;
    isFlexibleDates: boolean;
    flexibleMonth?: string;
    flexibleYear?: number;
    days?: number;
  }) => {
    if (!plannerState) return;

    const computedDays = selection.isFlexibleDates
      ? Math.max(1, selection.days || plannerState.days || 1)
      : getInclusiveDateRangeDays(selection.startDate, selection.endDate);

    if (!computedDays) return;

    const nextState: TripPlannerState = {
      ...plannerState,
      startDate: selection.isFlexibleDates ? undefined : selection.startDate,
      endDate: selection.isFlexibleDates ? undefined : selection.endDate,
      isFlexibleDates: selection.isFlexibleDates,
      flexibleMonth: selection.isFlexibleDates ? selection.flexibleMonth : undefined,
      flexibleYear: selection.isFlexibleDates ? selection.flexibleYear : undefined,
      days: computedDays,
    };

    setPlannerState(nextState);
    await persistPlannerState(nextState, 'ui_edit');
    await invokePlannerGeneration(buildPlannerGenerationPayload(nextState), 'regen_plan');
  }, [invokePlannerGeneration, persistPlannerState, plannerState]);

  const addDestination = useCallback(async (destination: string) => {
    const normalized = destination.trim();
    if (!normalized) return;

    await updatePlannerState((current) => ({
      ...current,
      destinations: [...current.destinations, normalized],
      segments: [
        ...current.segments,
        {
          id: `segment-${normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${current.segments.length + 1}`,
          city: normalized,
          order: current.segments.length,
          summary: 'Nuevo destino agregado. Regenerá el planificador para armar los días detallados.',
          startDate: undefined,
          endDate: undefined,
          nights: 0,
          hotelPlan: {
            city: normalized,
            searchStatus: 'idle',
            hotelRecommendations: [],
          },
          transportIn: null,
          transportOut: null,
          days: [],
        },
      ],
    }));
  }, [updatePlannerState]);

  const removeDestination = useCallback(async (segmentId: string) => {
    await updatePlannerState((current) => {
      const nextSegments = current.segments
        .filter((segment) => segment.id !== segmentId)
        .map((segment, index) => ({ ...segment, order: index }));

      return {
        ...current,
        destinations: nextSegments.map((segment) => segment.city),
        segments: nextSegments,
        days: nextSegments.reduce((acc, segment) => acc + segment.days.length, 0),
      };
    });
  }, [updatePlannerState]);

  const reorderDestinations = useCallback(async (fromSegmentId: string, toSegmentId: string) => {
    if (!plannerState || fromSegmentId === toSegmentId) return;

    const fromIndex = plannerState.segments.findIndex((segment) => segment.id === fromSegmentId);
    const toIndex = plannerState.segments.findIndex((segment) => segment.id === toSegmentId);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    const nextSegments = [...plannerState.segments];
    const [movedSegment] = nextSegments.splice(fromIndex, 1);
    nextSegments.splice(toIndex, 0, movedSegment);

    const reorderedState: TripPlannerState = {
      ...plannerState,
      destinations: nextSegments.map((segment) => segment.city),
      segments: nextSegments.map((segment, index) => ({
        ...segment,
        order: index,
      })),
    };

    setPlannerState(reorderedState);
    await persistPlannerState(reorderedState, 'ui_edit');
    await invokePlannerGeneration(buildPlannerGenerationPayload(reorderedState), 'regen_plan');
  }, [invokePlannerGeneration, persistPlannerState, plannerState]);

  const getSegmentHotelSearchInput = useCallback((state: TripPlannerState, segmentId: string) => {
    const segment = state.segments.find((item) => item.id === segmentId);
    if (!segment || state.isFlexibleDates) {
      return null;
    }

    const checkinDate = segment.startDate || state.startDate || '';
    const checkoutDate = segment.endDate || state.endDate || '';
    if (!segment.city || !checkinDate || !checkoutDate) {
      return null;
    }

    return {
      city: segment.city,
      checkinDate,
      checkoutDate,
      adults: state.travelers.adults || 2,
      children: state.travelers.children || 0,
      infants: state.travelers.infants || 0,
    };
  }, []);

  const loadHotelsForSegment = useCallback(async (segmentId: string) => {
    if (!plannerState) return;
    const segment = plannerState.segments.find((item) => item.id === segmentId);
    if (!segment) return;

    const searchInput = getSegmentHotelSearchInput(plannerState, segmentId);
    if (!searchInput) {
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                hotelPlan: {
                  ...item.hotelPlan,
                  searchStatus: 'idle',
                  hotelRecommendations: [],
                  selectedHotelId: undefined,
                  linkedSearchId: undefined,
                  lastSearchSignature: undefined,
                  error: undefined,
                },
              }
        ),
      }));
      return;
    }

    const signature = buildPlannerHotelSearchSignature(searchInput);

    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((item) =>
        item.id !== segmentId
          ? item
          : {
              ...item,
              hotelPlan: {
                ...item.hotelPlan,
                checkinDate: searchInput.checkinDate,
                checkoutDate: searchInput.checkoutDate,
                searchStatus: 'loading',
                hotelRecommendations: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.hotelRecommendations
                  : [],
                selectedHotelId: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.selectedHotelId
                  : undefined,
                linkedSearchId: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.linkedSearchId
                  : undefined,
                lastSearchSignature: signature,
                error: undefined,
              },
            }
      ),
    }));

    const hotelRequest: ParsedTravelRequest = {
      requestType: 'hotels',
      hotels: {
        city: searchInput.city,
        checkinDate: searchInput.checkinDate,
        checkoutDate: searchInput.checkoutDate,
        adults: searchInput.adults,
        children: searchInput.children,
        infants: searchInput.infants,
      },
      confidence: 1,
      originalMessage: `Trip planner hotel search for ${searchInput.city}`,
    };

    try {
      const result = await handleHotelSearch(hotelRequest);
      const hotels = result.data?.combinedData?.hotels || [];
      const hotelSearchId = result.data?.combinedData?.hotelSearchId;
      const noHotels = hotels.length === 0;
      const hotelError = noHotels ? normalizeHotelPlannerError(result.response) : undefined;
      const hasServiceError = Boolean(hotelError);

      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : (() => {
                const existingSelected = item.hotelPlan.selectedHotelId;
                const selectedStillExists = existingSelected
                  ? hotels.some((hotel) => getPlannerHotelDisplayId(hotel) === existingSelected)
                  : false;

                return {
                  ...item,
                  hotelPlan: {
                    ...item.hotelPlan,
                    searchStatus: hasServiceError ? 'error' : 'ready',
                    checkinDate: searchInput.checkinDate,
                    checkoutDate: searchInput.checkoutDate,
                    hotelRecommendations: hotels,
                    linkedSearchId: hotelSearchId,
                    selectedHotelId: noHotels
                      ? undefined
                      : selectedStillExists
                        ? existingSelected
                        : getPlannerHotelDisplayId(hotels[0]),
                    lastSearchSignature: signature,
                    error: hotelError,
                  },
                };
              })()
        ),
      }));
    } catch (error: any) {
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                hotelPlan: {
                  ...item.hotelPlan,
                  searchStatus: 'error',
                  lastSearchSignature: signature,
                  error: error?.message || 'No se pudieron cargar los hoteles.',
                },
              }
        ),
      }));
    }
  }, [getSegmentHotelSearchInput, plannerState, updatePlannerState]);

  useEffect(() => {
    if (!plannerState || plannerState.isFlexibleDates || isAutoLoadingHotelsRef.current) {
      return;
    }

    const pendingSegments = plannerState.segments.filter((segment) => {
      const searchInput = getSegmentHotelSearchInput(plannerState, segment.id);
      if (!searchInput) {
        return false;
      }

      if (segment.hotelPlan.searchStatus === 'loading') {
        return false;
      }

      const signature = buildPlannerHotelSearchSignature(searchInput);
      return segment.hotelPlan.lastSearchSignature !== signature;
    });

    if (pendingSegments.length === 0) {
      return;
    }

    let cancelled = false;
    isAutoLoadingHotelsRef.current = true;

    void (async () => {
      try {
        for (const segment of pendingSegments) {
          if (cancelled) break;
          await loadHotelsForSegment(segment.id);
        }
      } finally {
        isAutoLoadingHotelsRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getSegmentHotelSearchInput, loadHotelsForSegment, plannerState]);

  const selectHotel = useCallback(async (segmentId: string, hotelId: string) => {
    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((segment) =>
        segment.id !== segmentId
          ? segment
          : {
              ...segment,
              hotelPlan: {
                ...segment.hotelPlan,
                selectedHotelId: hotelId,
              },
            }
      ),
    }));
  }, [updatePlannerState]);

  const loadTransportForSegment = useCallback(async (segmentId: string) => {
    if (!plannerState) return;
    const segmentIndex = plannerState.segments.findIndex((item) => item.id === segmentId);
    if (segmentIndex <= 0 || plannerState.isFlexibleDates) return;

    const segment = plannerState.segments[segmentIndex];
    const previousSegment = plannerState.segments[segmentIndex - 1];
    const departureDate = segment.startDate || plannerState.startDate || '';
    if (!previousSegment.city || !segment.city || !departureDate) return;

    const signature = buildPlannerTransportSearchSignature({
      origin: previousSegment.city,
      destination: segment.city,
      departureDate,
      adults: plannerState.travelers.adults || 1,
      children: plannerState.travelers.children || 0,
      infants: plannerState.travelers.infants || 0,
    });

    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((item) =>
        item.id !== segmentId
          ? item
          : {
              ...item,
              transportIn: {
                ...(item.transportIn || {
                  type: 'flight',
                  summary: `${previousSegment.city} a ${item.city}`,
                }),
                type: 'flight',
                summary: `${formatDestinationLabel(previousSegment.city)} a ${formatDestinationLabel(item.city)}`,
                origin: previousSegment.city,
                destination: item.city,
                date: item.startDate,
                searchStatus: 'loading',
                linkedSearchId: item.transportIn?.lastSearchSignature === signature ? item.transportIn?.linkedSearchId : undefined,
                selectedOptionId: item.transportIn?.lastSearchSignature === signature ? item.transportIn?.selectedOptionId : undefined,
                options: item.transportIn?.lastSearchSignature === signature ? item.transportIn?.options : [],
                lastSearchSignature: signature,
                error: undefined,
              },
            }
      ),
    }));

    const flightRequest: ParsedTravelRequest = {
      requestType: 'flights',
      flights: {
        origin: previousSegment.city,
        destination: segment.city,
        departureDate,
        adults: plannerState.travelers.adults || 1,
        children: plannerState.travelers.children || 0,
        infants: plannerState.travelers.infants || 0,
        stops: 'any',
      },
      confidence: 1,
      originalMessage: `Trip planner transport search from ${previousSegment.city} to ${segment.city}`,
    };

    try {
      const result = await handleFlightSearch(flightRequest);
      const flights = result.data?.combinedData?.flights || [];
      const flightSearchId = result.data?.combinedData?.flightSearchId;

      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
              ...item,
              transportIn: {
                type: 'flight',
                summary: `${formatDestinationLabel(previousSegment.city)} a ${formatDestinationLabel(item.city)}`,
                origin: previousSegment.city,
                destination: item.city,
                date: item.startDate,
                searchStatus: 'ready',
                linkedSearchId: flightSearchId,
                selectedOptionId: flights.length === 0
                  ? undefined
                  : flights.some((flight) => flight.id === item.transportIn?.selectedOptionId)
                    ? item.transportIn?.selectedOptionId
                    : flights[0]?.id,
                lastSearchSignature: signature,
                options: flights,
                error: flights.length === 0 ? result.response : undefined,
              },
            }
        ),
      }));
    } catch (error: any) {
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                transportIn: {
                  type: 'flight',
                  summary: `${formatDestinationLabel(previousSegment.city)} a ${formatDestinationLabel(item.city)}`,
                origin: previousSegment.city,
                destination: item.city,
                date: item.startDate,
                searchStatus: 'error',
                linkedSearchId: undefined,
                selectedOptionId: undefined,
                lastSearchSignature: signature,
                options: [],
                error: error?.message || 'No se pudieron cargar las opciones de transporte.',
              },
            }
        ),
      }));
    }
  }, [plannerState, updatePlannerState]);

  useEffect(() => {
    if (!plannerState || plannerState.isFlexibleDates || isAutoLoadingTransportRef.current) {
      return;
    }

    const pendingSegments = plannerState.segments.filter((segment, index) => {
      if (index === 0) return false;

      const previousSegment = plannerState.segments[index - 1];
      const departureDate = segment.startDate || plannerState.startDate || '';
      if (!previousSegment?.city || !segment.city || !departureDate) {
        return false;
      }

      if (segment.transportIn?.searchStatus === 'loading') {
        return false;
      }

      const signature = buildPlannerTransportSearchSignature({
        origin: previousSegment.city,
        destination: segment.city,
        departureDate,
        adults: plannerState.travelers.adults || 1,
        children: plannerState.travelers.children || 0,
        infants: plannerState.travelers.infants || 0,
      });

      return segment.transportIn?.lastSearchSignature !== signature;
    });

    if (pendingSegments.length === 0) {
      return;
    }

    let cancelled = false;
    isAutoLoadingTransportRef.current = true;

    void (async () => {
      try {
        for (const segment of pendingSegments) {
          if (cancelled) break;
          await loadTransportForSegment(segment.id);
        }
      } finally {
        isAutoLoadingTransportRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadTransportForSegment, plannerState]);

  const selectTransportOption = useCallback(async (segmentId: string, optionId: string) => {
    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((segment) =>
        segment.id !== segmentId
          ? segment
          : {
              ...segment,
              transportIn: segment.transportIn
                ? {
                    ...segment.transportIn,
                    selectedOptionId: optionId,
                  }
                : segment.transportIn,
            }
      ),
    }));
  }, [updatePlannerState]);

  const plannerSummary = useMemo(() => {
    if (!plannerState) return null;
    return {
      destinations: plannerState.destinations.length,
      segments: plannerState.segments.length,
      days: plannerState.days,
    };
  }, [plannerState]);

  return {
    plannerState,
    plannerSummary,
    isLoadingPlanner,
    activePlannerMutation,
    isResolvingLocations,
    plannerError,
    plannerLocationWarning,
    persistPlannerState,
    reloadPlannerState: loadPersistedPlannerState,
    updateTripField,
    setExactDateRange,
    applyPlannerDateSelection,
    addDestination,
    removeDestination,
    reorderDestinations,
    regeneratePlanner,
    regenerateSegment,
    regenerateDay,
    toggleDayLock,
    toggleActivityLock,
    loadHotelsForSegment,
    selectHotel,
    loadTransportForSegment,
    selectTransportOption,
  };
}
