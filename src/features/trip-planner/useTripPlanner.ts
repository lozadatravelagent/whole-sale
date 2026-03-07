import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { runWithConcurrency, type CancelToken } from '@/utils/concurrencyPool';
import { supabase } from '@/integrations/supabase/client';
import { handleFlightSearch, handleHotelSearch } from '@/features/chat/services/searchHandlers';
import type { LocalHotelData } from '@/features/chat/types/chat';
import type { MessageRow } from '@/features/chat/types/chat';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import { normalizePlannerDayScheduling } from './scheduling';
import type { PlannerPlaceCandidate, PlannerPlaceHotelCandidate, TripPlannerState } from './types';
import {
  buildPlannerGenerationPayload,
  createDraftPlannerFromRequest,
  formatDestinationLabel,
  getPlannerHotelDisplayId,
  getInclusiveDateRangeDays,
  normalizePlannerState,
} from './utils';
import { enrichPlannerWithLocations } from './services/plannerGeocoding';
import { rankInventoryHotelsForPlace } from './services/plannerHotelMatcher';
import { getPlannerPlaceCategoryLabel, isFoodLikePlannerPlace } from './services/plannerPlaceMapper';
import { getPlannerStateFromCache, setPlannerStateInCache } from './services/plannerStateCache';

function isPersistableConversationId(value: string | null): value is string {
  if (!value || value.startsWith('temp-')) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getLatestPlannerMessage(messages: MessageRow[], conversationId: string | null): MessageRow | null {
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

function mergePlannerHotels(...hotelSets: LocalHotelData[][]): LocalHotelData[] {
  const merged = new Map<string, LocalHotelData>();

  hotelSets.flat().forEach((hotel) => {
    const hotelId = getPlannerHotelDisplayId(hotel);
    if (!merged.has(hotelId)) {
      merged.set(hotelId, hotel);
    }
  });

  return Array.from(merged.values());
}

function isDraftPlannerState(state: TripPlannerState | null | undefined): boolean {
  return Boolean(state?.generationMeta?.isDraft);
}

function shouldReplacePlannerState(
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

function buildGoogleMapsActivityDescription(place: PlannerPlaceCandidate): string {
  const parts = [place.formattedAddress];
  if (typeof place.rating === 'number') {
    parts.push(`Google ${place.rating.toFixed(1)}`);
  }
  if (place.isOpenNow === true) {
    parts.push('Abierto ahora');
  } else if (place.isOpenNow === false) {
    parts.push('Cerrado ahora');
  }

  return parts.filter(Boolean).join(' • ');
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
  const pendingSegmentEnrichmentRef = useRef<Set<string>>(new Set());
  const plannerConversationIdRef = useRef<string | null>(conversationId);
  const suppressNextPersistedLoadUiRef = useRef(false);
  const isCurrentPlannerConversation = useCallback((targetConversationId: string | null) => {
    return Boolean(targetConversationId && plannerConversationIdRef.current === targetConversationId);
  }, []);
  const setPlannerStateIfCurrent = useCallback((
    targetConversationId: string | null,
    updater: SetStateAction<TripPlannerState | null>
  ) => {
    if (!isCurrentPlannerConversation(targetConversationId)) {
      return;
    }

    setPlannerState(updater);
  }, [isCurrentPlannerConversation]);

  // Synchronous reset during render (React "adjusting state" pattern)
  // This runs BEFORE the component tree renders, preventing stale data flash.
  const [trackedConversationId, setTrackedConversationId] = useState(conversationId);

  if (conversationId !== trackedConversationId) {
    const isTempToRealPromotion = Boolean(
      trackedConversationId?.startsWith('temp-') &&
      isPersistableConversationId(conversationId)
    );

    suppressNextPersistedLoadUiRef.current = isTempToRealPromotion;
    setTrackedConversationId(conversationId);
    setPlannerState(null);
    setPlannerError(null);
    setPlannerLocationWarning(null);
    setIsResolvingLocations(false);
    resolvingSignatureRef.current = null;
    pendingSegmentEnrichmentRef.current.clear();
    plannerConversationIdRef.current = conversationId;

    if (conversationId && isPersistableConversationId(conversationId)) {
      setIsLoadingPlanner(!isTempToRealPromotion);
    } else {
      setIsLoadingPlanner(false);
    }
  }

  // Warn before closing browser when a planner mutation is active
  useEffect(() => {
    if (!activePlannerMutation) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activePlannerMutation]);

  const persistPlannerState = useCallback(async (
    state: TripPlannerState,
    source: TripPlannerState['generationMeta']['source']
  ) => {
    if (!isPersistableConversationId(conversationId) || !isCurrentPlannerConversation(conversationId)) return;

    const normalizedState: TripPlannerState = {
      ...state,
      conversationId,
      generationMeta: {
        ...state.generationMeta,
        source: source as TripPlannerState['generationMeta']['source'],
        updatedAt: new Date().toISOString(),
        version: (state.generationMeta?.version || 0) + (source === 'chat' ? 0 : 1),
        uiPhase: source === 'draft'
          ? (state.generationMeta?.uiPhase || 'draft_generating')
          : 'ready',
        isDraft: source === 'draft',
        draftOriginMessage: source === 'draft' ? state.generationMeta?.draftOriginMessage : undefined,
      },
    };

    // Fire-and-forget: cache in IndexedDB for instant reload
    setPlannerStateInCache(conversationId, normalizedState).catch(() => {});

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
  }, [conversationId, isCurrentPlannerConversation]);

  const loadPersistedPlannerState = useCallback(async () => {
    const requestConversationId = conversationId;

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

    const suppressLoadingUi = suppressNextPersistedLoadUiRef.current;
    if (!suppressLoadingUi) {
      setIsLoadingPlanner(true);
    }
    setPlannerError(null);

    try {
      // 1. Try IndexedDB first for instant display
      const cachedState = await getPlannerStateFromCache(conversationId);
      if (plannerConversationIdRef.current !== conversationId) return;
      if (cachedState) {
        const normalizedCached = normalizePlannerState(cachedState, conversationId);
        if (normalizedCached) {
          setPlannerState((current) => shouldReplacePlannerState(current, normalizedCached) ? normalizedCached : current);
        }
      }

      // 2. Then fetch from Supabase (source of truth)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('role', 'system')
        .contains('meta', { messageType: 'trip_planner_state' })
        .order('created_at', { ascending: false })
        .limit(1);

      if (plannerConversationIdRef.current !== conversationId) return;

      if (error) {
        throw error;
      }

      const snapshot = data?.[0];
      const meta = snapshot?.meta as any;
      const nextState = meta?.plannerState ? normalizePlannerState(meta.plannerState, conversationId) : null;

      if (nextState) {
        setPlannerState((current) => shouldReplacePlannerState(current, nextState) ? nextState : current);
        // Update IndexedDB cache with latest from Supabase
        setPlannerStateInCache(conversationId, nextState).catch(() => {});
      } else {
        setPlannerState(null);
      }
    } catch (error) {
      if (plannerConversationIdRef.current !== conversationId) return;
      console.error('❌ [TRIP PLANNER] Failed to load planner state:', error);
      setPlannerError('No se pudo cargar el estado del planificador.');
    } finally {
      if (plannerConversationIdRef.current === requestConversationId) {
        suppressNextPersistedLoadUiRef.current = false;
        setIsLoadingPlanner(false);
      }
    }
  }, [conversationId]);

  useEffect(() => {
    void loadPersistedPlannerState();
  }, [loadPersistedPlannerState]);

  useEffect(() => {
    if (!conversationId) return;
    const latestPlannerMessage = getLatestPlannerMessage(messages, conversationId);
    const meta = latestPlannerMessage?.meta as any;
    if (!meta?.plannerData) return;

    const nextState = normalizePlannerState(meta.plannerData, conversationId);
    setPlannerState((current) => shouldReplacePlannerState(current, nextState) ? nextState : current);
  }, [conversationId, messages]);

  useEffect(() => {
    if (!plannerState || plannerState.segments.length === 0 || isDraftPlannerState(plannerState)) {
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
    if (!isCurrentPlannerConversation(conversationId)) {
      return;
    }

    setPlannerState((current) => {
      if (!current) return current;
      if (!isCurrentPlannerConversation(conversationId)) {
        return current;
      }
      const next = updater(current);
      void persistPlannerState(next, source);
      return next;
    });
  }, [conversationId, isCurrentPlannerConversation, persistPlannerState]);

  const ensureSegmentEnriched = useCallback(async (segmentId: string) => {
    const requestConversationId = conversationId;
    if (!conversationId || !plannerState || isDraftPlannerState(plannerState)) {
      return;
    }

    const targetSegment = plannerState.segments.find((segment) => segment.id === segmentId);
    if (!targetSegment) {
      return;
    }

    if (targetSegment.contentStatus === 'ready' || targetSegment.contentStatus === 'loading') {
      return;
    }

    if (pendingSegmentEnrichmentRef.current.has(segmentId)) {
      return;
    }

    pendingSegmentEnrichmentRef.current.add(segmentId);

    setPlannerStateIfCurrent(requestConversationId, (current) => {
      if (!current) return current;
      return {
        ...current,
        segments: current.segments.map((segment) =>
          segment.id !== segmentId
            ? segment
            : {
                ...segment,
                contentStatus: 'loading',
                contentError: undefined,
              }
        ),
      };
    });

    try {
      const response = await supabase.functions.invoke('travel-itinerary', {
        body: buildPlannerGenerationPayload(plannerState, {
          generationMode: 'segment',
          editIntent: {
            action: 'enrich_segment',
            targetSegmentId: segmentId,
            targetCity: targetSegment.city,
          },
        }),
      });

      if (response.error) {
        throw response.error;
      }

      if (response.data?.timing) {
        console.log('⏱️ [TRIP PLANNER SEGMENT TIMING]', response.data.timing);
      }

      const nextState = normalizePlannerState(response.data?.data, conversationId);
      if (!isCurrentPlannerConversation(requestConversationId)) {
        return;
      }

      setPlannerStateIfCurrent(
        requestConversationId,
        (current) => shouldReplacePlannerState(current, nextState) ? nextState : current
      );
      await persistPlannerState(nextState, 'system');
    } catch (error: any) {
      console.error('❌ [TRIP PLANNER] Segment enrichment failed:', error);
      if (!isCurrentPlannerConversation(requestConversationId)) {
        return;
      }

      let nextErrorState: TripPlannerState | null = null;

      setPlannerStateIfCurrent(requestConversationId, (current) => {
        if (!current) return current;

        nextErrorState = {
          ...current,
          segments: current.segments.map((segment) =>
            segment.id !== segmentId
              ? segment
              : {
                  ...segment,
                  contentStatus: 'error' as const,
                  contentError: error?.message || 'No se pudo completar este tramo por ahora.',
                }
          ),
        };

        return nextErrorState;
      });

      if (nextErrorState) {
        await persistPlannerState(nextErrorState, 'system');
      }
    } finally {
      pendingSegmentEnrichmentRef.current.delete(segmentId);
    }
  }, [
    conversationId,
    isCurrentPlannerConversation,
    persistPlannerState,
    plannerState,
    setPlannerStateIfCurrent,
  ]);

  const setDraftPlannerFromRequest = useCallback((request: ParsedTravelRequest) => {
    const draftState = createDraftPlannerFromRequest(request, conversationId || undefined);
    if (!draftState) {
      return;
    }

    setPlannerState((current) => {
      if (current && !isDraftPlannerState(current)) {
        return current;
      }

      if (!current) {
        return draftState;
      }

      return {
        ...draftState,
        generationMeta: {
          ...draftState.generationMeta,
          version: current.generationMeta?.version || draftState.generationMeta.version,
        },
      };
    });
    setPlannerError(null);
    setPlannerLocationWarning(null);
  }, [conversationId]);

  const setPlannerDraftPhase = useCallback((phase: 'draft_parsing' | 'draft_generating') => {
    setPlannerState((current) => {
      if (!current || !isDraftPlannerState(current)) {
        return current;
      }

      return {
        ...current,
        generationMeta: {
          ...current.generationMeta,
          uiPhase: phase,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  const invokePlannerGeneration = useCallback(async (
    payload: Record<string, unknown>,
    source: 'regen_day' | 'regen_segment' | 'regen_plan',
    mutationMeta?: {
      segmentId?: string;
      dayId?: string;
    }
  ) => {
    const requestConversationId = conversationId;
    if (!requestConversationId) return;

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

      if (response.data?.timing) {
        console.log('⏱️ [TRIP PLANNER BACKEND TIMING]', response.data.timing);
      }

      const nextState = normalizePlannerState(response.data?.data, conversationId);
      if (!isCurrentPlannerConversation(requestConversationId)) {
        return;
      }

      setPlannerStateIfCurrent(requestConversationId, nextState);
      await persistPlannerState(nextState, source);
      toast({
        title: 'Planificador actualizado',
        description: 'El itinerario se regeneró correctamente.',
      });
    } catch (error: any) {
      console.error('❌ [TRIP PLANNER] Regeneration failed:', error);
      if (!isCurrentPlannerConversation(requestConversationId)) {
        return;
      }

      setPlannerError(error?.message || 'No se pudo regenerar el planificador.');
      toast({
        title: 'No se pudo actualizar el planificador',
        description: error?.message || 'No se pudo regenerar el planificador.',
        variant: 'destructive',
      });
    } finally {
      if (isCurrentPlannerConversation(requestConversationId)) {
        setIsLoadingPlanner(false);
        setActivePlannerMutation(null);
      }
    }
  }, [conversationId, isCurrentPlannerConversation, persistPlannerState, setPlannerStateIfCurrent, toast]);

  const regeneratePlanner = useCallback(async () => {
    if (!plannerState) return;
    await invokePlannerGeneration(buildPlannerGenerationPayload(plannerState, {
      generationMode: 'skeleton',
    }), 'regen_plan');
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

  const addPlaceToPlanner = useCallback(async (
    segmentId: string,
    input: {
      place: PlannerPlaceCandidate;
      dayId: string;
      block: 'morning' | 'afternoon' | 'evening';
    }
  ) => {
    if (!plannerState) return;

    const segment = plannerState.segments.find((item) => item.id === segmentId);
    const day = segment?.days.find((item) => item.id === input.dayId);

    if (!segment || !day) {
      toast({
        title: 'No pudimos agregar el lugar',
        description: 'Elegí un día válido del planner para ubicar esta actividad.',
        variant: 'destructive',
      });
      return;
    }

    const duplicateInBlock = day[input.block].some((activity) => activity.placeId === input.place.placeId);
    const duplicateRestaurant = day.restaurants.some((restaurant) => restaurant.placeId === input.place.placeId);
    if (duplicateInBlock || duplicateRestaurant) {
      toast({
        title: 'Ese lugar ya está en el planner',
        description: `${input.place.name} ya fue agregado en ${formatDestinationLabel(segment.city)}.`,
      });
      return;
    }

    if (day.locked) {
      toast({
        title: 'Día bloqueado',
        description: 'El lugar se agregará igual como edición manual dentro de este día.',
      });
    }

    await updatePlannerState((current) => {
      const segmentIndex = current.segments.findIndex((item) => item.id === segmentId);
      if (segmentIndex === -1) {
        return current;
      }

      const nextSegments = current.segments.map((currentSegment, currentSegmentIndex) => {
        if (currentSegment.id !== segmentId) {
          return currentSegment;
        }

        const nextDays = currentSegment.days.map((currentDay, dayIndex) => {
          if (currentDay.id !== input.dayId) {
            return currentDay;
          }

          const activityId = `gmaps-${input.place.placeId}-${input.block}`;
          const nextActivity = {
            id: activityId,
            time: undefined,
            title: input.place.name,
            description: buildGoogleMapsActivityDescription(input.place) || undefined,
            category: getPlannerPlaceCategoryLabel(input.place.category),
            activityType: input.place.activityType,
            recommendedSlot: input.block,
            neighborhood: input.place.formattedAddress,
            locked: false,
            placeId: input.place.placeId,
            formattedAddress: input.place.formattedAddress,
            rating: input.place.rating,
            userRatingsTotal: input.place.userRatingsTotal,
            photoUrls: input.place.photoUrls,
            source: 'google_maps' as const,
          };

          const nextRestaurants = isFoodLikePlannerPlace(input.place) && !currentDay.restaurants.some((restaurant) => restaurant.placeId === input.place.placeId)
            ? [
                ...currentDay.restaurants,
                {
                  id: `gmaps-restaurant-${input.place.placeId}`,
                  name: input.place.name,
                  type: input.place.category === 'cafe' ? 'Cafe' : 'Restaurante',
                  placeId: input.place.placeId,
                  formattedAddress: input.place.formattedAddress,
                  rating: input.place.rating,
                  userRatingsTotal: input.place.userRatingsTotal,
                  source: 'google_maps' as const,
                },
              ]
            : currentDay.restaurants;

          const nextDay = {
            ...currentDay,
            [input.block]: [...currentDay[input.block], nextActivity],
            restaurants: nextRestaurants,
          };

          return normalizePlannerDayScheduling(nextDay, {
            pace: current.pace,
            travelers: current.travelers,
            isTransferDay: currentSegmentIndex > 0 && dayIndex === 0 && Boolean(currentSegment.transportIn),
          });
        });

        return {
          ...currentSegment,
          days: nextDays,
        };
      });

      return {
        ...current,
        segments: nextSegments,
      };
    });

    toast({
      title: 'Lugar agregado al planner',
      description: `${input.place.name} quedó sumado en ${formatDestinationLabel(segment.city)}.`,
    });
  }, [plannerState, toast, updatePlannerState]);

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
    await invokePlannerGeneration(buildPlannerGenerationPayload(nextState, {
      generationMode: 'skeleton',
    }), 'regen_plan');
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
          contentStatus: 'skeleton',
          startDate: undefined,
          endDate: undefined,
          nights: 0,
          hotelPlan: {
            city: normalized,
            searchStatus: 'idle',
            matchStatus: 'idle',
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
    await invokePlannerGeneration(buildPlannerGenerationPayload(reorderedState, {
      generationMode: 'skeleton',
    }), 'regen_plan');
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

  const fetchInventoryHotels = useCallback(async (input: {
    city: string;
    checkinDate: string;
    checkoutDate: string;
    adults: number;
    children: number;
    infants: number;
    hotelName?: string;
  }) => {
    const hotelRequest: ParsedTravelRequest = {
      requestType: 'hotels',
      hotels: {
        city: input.city,
        checkinDate: input.checkinDate,
        checkoutDate: input.checkoutDate,
        adults: input.adults,
        children: input.children,
        infants: input.infants,
        ...(input.hotelName ? { hotelName: input.hotelName } : {}),
      },
      confidence: 1,
      originalMessage: input.hotelName
        ? `Trip planner hotel quote for ${input.hotelName} in ${input.city}`
        : `Trip planner hotel search for ${input.city}`,
    };

    const result = await handleHotelSearch(hotelRequest);
    const hotels = result.data?.combinedData?.hotels || [];
    const hotelSearchId = result.data?.combinedData?.hotelSearchId;
    const serviceError = hotels.length === 0 ? normalizeHotelPlannerError(result.response) : undefined;

    return {
      hotels,
      hotelSearchId,
      response: result.response,
      serviceError,
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
    const searchChanged = segment.hotelPlan.lastSearchSignature !== signature;

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
                matchStatus: searchChanged && item.hotelPlan.selectedPlaceCandidate
                  ? 'selected_from_map'
                  : item.hotelPlan.matchStatus || 'idle',
                hotelRecommendations: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.hotelRecommendations
                  : [],
                selectedHotelId: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.selectedHotelId
                  : undefined,
                confirmedInventoryHotel: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.confirmedInventoryHotel
                  : null,
                inventoryMatchCandidates: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.inventoryMatchCandidates
                  : [],
                linkedSearchId: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.linkedSearchId
                  : undefined,
                quoteSearchId: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.quoteSearchId
                  : undefined,
                quoteLastValidatedAt: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.quoteLastValidatedAt
                  : undefined,
                quoteError: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.quoteError
                  : item.hotelPlan.selectedPlaceCandidate
                    ? 'Las fechas cambiaron. Confirmá disponibilidad y precio para este destino.'
                    : undefined,
                lastSearchSignature: signature,
                error: undefined,
              },
            }
      ),
    }));

    try {
      const { hotels, hotelSearchId, serviceError } = await fetchInventoryHotels(searchInput);
      const noHotels = hotels.length === 0;
      const hotelError = noHotels ? serviceError : undefined;
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
                    selectedHotelId: selectedStillExists ? existingSelected : undefined,
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
  }, [fetchInventoryHotels, getSegmentHotelSearchInput, plannerState, updatePlannerState]);

  useEffect(() => {
    if (!plannerState || plannerState.isFlexibleDates || isDraftPlannerState(plannerState) || isAutoLoadingHotelsRef.current) {
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

    const cancelToken: CancelToken = { current: false };
    isAutoLoadingHotelsRef.current = true;

    const pendingIds = new Set(pendingSegments.map((s) => s.id));
    updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((seg) =>
        !pendingIds.has(seg.id)
          ? seg
          : { ...seg, hotelPlan: { ...seg.hotelPlan, searchStatus: 'loading' as const } }
      ),
    }));

    void (async () => {
      try {
        const tasks = pendingSegments.map(
          (segment) => () => loadHotelsForSegment(segment.id),
        );
        await runWithConcurrency(tasks, 2, cancelToken);
      } finally {
        isAutoLoadingHotelsRef.current = false;
      }
    })();

    return () => {
      cancelToken.current = true;
    };
  }, [getSegmentHotelSearchInput, loadHotelsForSegment, plannerState, updatePlannerState]);

  const resolveInventoryMatchForSegment = useCallback(async (
    segmentId: string,
    nextPlaceCandidate?: PlannerPlaceHotelCandidate
  ) => {
    if (!plannerState) return;

    const segment = plannerState.segments.find((item) => item.id === segmentId);
    const placeCandidate = nextPlaceCandidate || segment?.hotelPlan.selectedPlaceCandidate || null;
    if (!segment || !placeCandidate) return;

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
                  matchStatus: 'selected_from_map',
                  selectedPlaceCandidate: placeCandidate,
                  inventoryMatchCandidates: [],
                  confirmedInventoryHotel: null,
                  selectedHotelId: undefined,
                  quoteSearchId: undefined,
                  quoteLastValidatedAt: undefined,
                  quoteError: 'Elegí fechas exactas para confirmar disponibilidad y precio.',
                  error: undefined,
                },
              }
        ),
      }));
      return;
    }

    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((item) =>
        item.id !== segmentId
          ? item
          : {
              ...item,
              hotelPlan: {
                ...item.hotelPlan,
                selectedPlaceCandidate: placeCandidate,
                matchStatus: 'matching_inventory',
                inventoryMatchCandidates: [],
                confirmedInventoryHotel: null,
                selectedHotelId: undefined,
                quoteSearchId: undefined,
                quoteLastValidatedAt: undefined,
                quoteError: undefined,
                error: undefined,
              },
            }
      ),
    }));

    try {
      const narrowedResult = await fetchInventoryHotels({
        ...searchInput,
        hotelName: placeCandidate.name,
      });

      if (narrowedResult.serviceError) {
        await updatePlannerState((current) => ({
          ...current,
          segments: current.segments.map((item) =>
            item.id !== segmentId
              ? item
              : {
                  ...item,
                  hotelPlan: {
                    ...item.hotelPlan,
                    matchStatus: 'error',
                    selectedPlaceCandidate: placeCandidate,
                    inventoryMatchCandidates: [],
                    quoteError: narrowedResult.serviceError,
                    error: narrowedResult.serviceError,
                  },
                }
          ),
        }));
        return;
      }

      const narrowedMatch = rankInventoryHotelsForPlace({
        placeCandidate,
        hotels: narrowedResult.hotels,
        linkedSearchId: narrowedResult.hotelSearchId,
      });

      if (narrowedMatch.status === 'matched' && narrowedMatch.autoSelectedHotelId) {
        const matchedCandidate = narrowedMatch.candidates.find(
          (candidate) => candidate.hotelId === narrowedMatch.autoSelectedHotelId
        );

        if (matchedCandidate) {
          await updatePlannerState((current) => ({
            ...current,
            segments: current.segments.map((item) =>
              item.id !== segmentId
                ? item
                : {
                    ...item,
                    hotelPlan: {
                      ...item.hotelPlan,
                      searchStatus: 'ready',
                      matchStatus: 'quoted',
                      selectedPlaceCandidate: placeCandidate,
                      selectedHotelId: matchedCandidate.hotelId,
                      confirmedInventoryHotel: matchedCandidate.hotel,
                      inventoryMatchCandidates: narrowedMatch.candidates,
                      hotelRecommendations: mergePlannerHotels(
                        [matchedCandidate.hotel],
                        narrowedResult.hotels,
                        item.hotelPlan.hotelRecommendations
                      ),
                      linkedSearchId: narrowedResult.hotelSearchId || item.hotelPlan.linkedSearchId,
                      quoteSearchId: narrowedResult.hotelSearchId,
                      quoteLastValidatedAt: new Date().toISOString(),
                      quoteError: undefined,
                      error: undefined,
                    },
                  }
            ),
          }));
          return;
        }
      }

      if (narrowedMatch.status === 'needs_confirmation' && narrowedMatch.candidates.length > 0) {
        await updatePlannerState((current) => ({
          ...current,
          segments: current.segments.map((item) =>
            item.id !== segmentId
              ? item
              : {
                  ...item,
                  hotelPlan: {
                    ...item.hotelPlan,
                    matchStatus: 'needs_confirmation',
                    selectedPlaceCandidate: placeCandidate,
                    inventoryMatchCandidates: narrowedMatch.candidates,
                    hotelRecommendations: mergePlannerHotels(
                      narrowedResult.hotels,
                      item.hotelPlan.hotelRecommendations
                    ),
                    linkedSearchId: narrowedResult.hotelSearchId || item.hotelPlan.linkedSearchId,
                    quoteError: 'Encontramos varias coincidencias posibles. Confirmá cuál querés cotizar.',
                    error: undefined,
                  },
                }
          ),
        }));
        return;
      }

      let alternativeHotels = segment.hotelPlan.hotelRecommendations;
      let alternativeSearchId = segment.hotelPlan.linkedSearchId;

      const currentSignature = buildPlannerHotelSearchSignature(searchInput);
      const shouldRefreshAlternatives =
        segment.hotelPlan.lastSearchSignature !== currentSignature || alternativeHotels.length === 0;

      if (shouldRefreshAlternatives) {
        const broadResult = await fetchInventoryHotels(searchInput);
        alternativeHotels = broadResult.hotels;
        alternativeSearchId = broadResult.hotelSearchId;
      }

      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                hotelPlan: {
                  ...item.hotelPlan,
                  searchStatus: 'ready',
                  matchStatus: 'not_found',
                  selectedPlaceCandidate: placeCandidate,
                  inventoryMatchCandidates: narrowedMatch.candidates,
                  confirmedInventoryHotel: null,
                  selectedHotelId: undefined,
                  hotelRecommendations: mergePlannerHotels(alternativeHotels, narrowedResult.hotels),
                  linkedSearchId: alternativeSearchId || item.hotelPlan.linkedSearchId,
                  quoteSearchId: undefined,
                  quoteLastValidatedAt: undefined,
                  quoteError: 'No encontramos este hotel exacto en inventario. Elegi una alternativa real para cotizar.',
                  error: undefined,
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
                hotelPlan: {
                  ...item.hotelPlan,
                  matchStatus: 'error',
                  selectedPlaceCandidate: placeCandidate,
                  inventoryMatchCandidates: [],
                  quoteError: error?.message || 'No se pudo confirmar disponibilidad del hotel elegido.',
                  error: error?.message || 'No se pudo confirmar disponibilidad del hotel elegido.',
                },
              }
        ),
      }));
    }
  }, [fetchInventoryHotels, getSegmentHotelSearchInput, plannerState, updatePlannerState]);

  const selectHotelPlaceFromMap = useCallback(async (segmentId: string, placeCandidate: PlannerPlaceHotelCandidate) => {
    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((segment) =>
        segment.id !== segmentId
          ? segment
          : {
              ...segment,
              hotelPlan: {
                ...segment.hotelPlan,
                selectedPlaceCandidate: placeCandidate,
                matchStatus: 'selected_from_map',
                inventoryMatchCandidates: [],
                confirmedInventoryHotel: null,
                selectedHotelId: undefined,
                quoteSearchId: undefined,
                quoteLastValidatedAt: undefined,
                quoteError: undefined,
                error: undefined,
              },
            }
      ),
    }));

    await resolveInventoryMatchForSegment(segmentId, placeCandidate);
  }, [resolveInventoryMatchForSegment, updatePlannerState]);

  const confirmInventoryHotelMatch = useCallback(async (segmentId: string, hotelId: string) => {
    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((segment) => {
        if (segment.id !== segmentId) {
          return segment;
        }

        const matchedCandidate = segment.hotelPlan.inventoryMatchCandidates?.find(
          (candidate) => candidate.hotelId === hotelId
        );

        if (!matchedCandidate) {
          return segment;
        }

        return {
          ...segment,
          hotelPlan: {
            ...segment.hotelPlan,
            searchStatus: 'ready',
            matchStatus: 'quoted',
            selectedHotelId: matchedCandidate.hotelId,
            confirmedInventoryHotel: matchedCandidate.hotel,
            hotelRecommendations: mergePlannerHotels(
              [matchedCandidate.hotel],
              segment.hotelPlan.hotelRecommendations
            ),
            inventoryMatchCandidates: [],
            quoteSearchId: matchedCandidate.linkedSearchId,
            quoteLastValidatedAt: new Date().toISOString(),
            quoteError: undefined,
            error: undefined,
          },
        };
      }),
    }));
  }, [updatePlannerState]);

  const refreshQuotedHotel = useCallback(async (segmentId: string) => {
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
                  quoteError: 'Elegí fechas exactas para confirmar disponibilidad y precio.',
                },
              }
        ),
      }));
      return;
    }

    const lookupName =
      segment.hotelPlan.confirmedInventoryHotel?.name ||
      segment.hotelPlan.selectedPlaceCandidate?.name;

    if (!lookupName) {
      return;
    }

    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((item) =>
        item.id !== segmentId
          ? item
          : {
              ...item,
              hotelPlan: {
                ...item.hotelPlan,
                matchStatus: 'quoting',
                quoteError: undefined,
                error: undefined,
              },
            }
      ),
    }));

    try {
      const refreshedResult = await fetchInventoryHotels({
        ...searchInput,
        hotelName: lookupName,
      });

      if (refreshedResult.serviceError) {
        throw new Error(refreshedResult.serviceError);
      }

      const selectedHotelId = segment.hotelPlan.selectedHotelId;
      let selectedHotel = refreshedResult.hotels.find(
        (hotel) => getPlannerHotelDisplayId(hotel) === selectedHotelId
      );

      if (!selectedHotel && segment.hotelPlan.confirmedInventoryHotel) {
        const expectedName = normalizeLocationLabel(segment.hotelPlan.confirmedInventoryHotel.name);
        selectedHotel = refreshedResult.hotels.find(
          (hotel) => normalizeLocationLabel(hotel.name) === expectedName
        );
      }

      if (!selectedHotel && segment.hotelPlan.selectedPlaceCandidate) {
        const refreshedMatch = rankInventoryHotelsForPlace({
          placeCandidate: segment.hotelPlan.selectedPlaceCandidate,
          hotels: refreshedResult.hotels,
          linkedSearchId: refreshedResult.hotelSearchId,
        });

        if (refreshedMatch.status === 'needs_confirmation') {
          await updatePlannerState((current) => ({
            ...current,
            segments: current.segments.map((item) =>
              item.id !== segmentId
                ? item
                : {
                    ...item,
                    hotelPlan: {
                      ...item.hotelPlan,
                      matchStatus: 'needs_confirmation',
                      inventoryMatchCandidates: refreshedMatch.candidates,
                      hotelRecommendations: mergePlannerHotels(
                        refreshedResult.hotels,
                        item.hotelPlan.hotelRecommendations
                      ),
                      quoteError: 'La validación devolvió varias opciones. Confirmá el hotel real nuevamente.',
                    },
                  }
            ),
          }));
          return;
        }

        if (refreshedMatch.status === 'matched' && refreshedMatch.autoSelectedHotelId) {
          selectedHotel = refreshedMatch.candidates.find(
            (candidate) => candidate.hotelId === refreshedMatch.autoSelectedHotelId
          )?.hotel;
        }
      }

      if (!selectedHotel && refreshedResult.hotels.length === 1) {
        selectedHotel = refreshedResult.hotels[0];
      }

      if (!selectedHotel) {
        await resolveInventoryMatchForSegment(segmentId);
        return;
      }

      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                hotelPlan: {
                  ...item.hotelPlan,
                  searchStatus: 'ready',
                  matchStatus: 'quoted',
                  selectedHotelId: getPlannerHotelDisplayId(selectedHotel),
                  confirmedInventoryHotel: selectedHotel,
                  hotelRecommendations: mergePlannerHotels(
                    [selectedHotel],
                    refreshedResult.hotels,
                    item.hotelPlan.hotelRecommendations
                  ),
                  linkedSearchId: refreshedResult.hotelSearchId || item.hotelPlan.linkedSearchId,
                  quoteSearchId: refreshedResult.hotelSearchId,
                  quoteLastValidatedAt: new Date().toISOString(),
                  quoteError: undefined,
                  error: undefined,
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
                hotelPlan: {
                  ...item.hotelPlan,
                  matchStatus: 'error',
                  quoteError: error?.message || 'No se pudo refrescar la cotización real.',
                  error: error?.message || 'No se pudo refrescar la cotización real.',
                },
              }
        ),
      }));
    }
  }, [
    fetchInventoryHotels,
    getSegmentHotelSearchInput,
    plannerState,
    resolveInventoryMatchForSegment,
    updatePlannerState,
  ]);

  const selectHotel = useCallback(async (segmentId: string, hotelId: string) => {
    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((segment) => {
        if (segment.id !== segmentId) {
          return segment;
        }

        const selectedHotel = segment.hotelPlan.hotelRecommendations.find(
          (hotel) => getPlannerHotelDisplayId(hotel) === hotelId
        );

        return {
          ...segment,
          hotelPlan: {
            ...segment.hotelPlan,
            selectedHotelId: hotelId,
            confirmedInventoryHotel: selectedHotel || segment.hotelPlan.confirmedInventoryHotel || null,
            matchStatus: selectedHotel ? 'quoted' : (segment.hotelPlan.matchStatus || 'idle'),
            inventoryMatchCandidates: selectedHotel ? [] : segment.hotelPlan.inventoryMatchCandidates,
            quoteSearchId: selectedHotel ? segment.hotelPlan.linkedSearchId : segment.hotelPlan.quoteSearchId,
            quoteLastValidatedAt: selectedHotel
              ? new Date().toISOString()
              : segment.hotelPlan.quoteLastValidatedAt,
            quoteError: selectedHotel ? undefined : segment.hotelPlan.quoteError,
          },
        };
      })
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
    if (!plannerState || plannerState.isFlexibleDates || isDraftPlannerState(plannerState) || isAutoLoadingTransportRef.current) {
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

    const cancelToken: CancelToken = { current: false };
    isAutoLoadingTransportRef.current = true;

    const pendingIds = new Set(pendingSegments.map((s) => s.id));
    updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((seg) =>
        !pendingIds.has(seg.id) || !seg.transportIn
          ? seg
          : { ...seg, transportIn: { ...seg.transportIn, searchStatus: 'loading' as const } }
      ),
    }));

    void (async () => {
      try {
        const tasks = pendingSegments.map(
          (segment) => () => loadTransportForSegment(segment.id),
        );
        await runWithConcurrency(tasks, 2, cancelToken);
      } finally {
        isAutoLoadingTransportRef.current = false;
      }
    })();

    return () => {
      cancelToken.current = true;
    };
  }, [loadTransportForSegment, plannerState, updatePlannerState]);

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
    setDraftPlannerFromRequest,
    setPlannerDraftPhase,
    reloadPlannerState: loadPersistedPlannerState,
    ensureSegmentEnriched,
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
    addPlaceToPlanner,
    loadHotelsForSegment,
    selectHotel,
    selectHotelPlaceFromMap,
    resolveInventoryMatchForSegment,
    confirmInventoryHotelMatch,
    refreshQuotedHotel,
    loadTransportForSegment,
    selectTransportOption,
  };
}
