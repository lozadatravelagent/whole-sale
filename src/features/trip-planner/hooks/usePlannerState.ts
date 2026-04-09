import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MessageRow } from '@/features/chat/types/chat';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { PlannerFieldProvenance, TripPlannerState } from '../types';
import {
  createDraftPlannerFromRequest,
  normalizePlannerState,
} from '../utils';
import { getPlannerStateFromCache, setPlannerStateInCache } from '../services/plannerStateCache';
import { upsertTrip } from '../services/tripService';
import { useAuth } from '@/contexts/AuthContext';
import {
  getLatestPlannerMessage,
  isDraftPlannerState,
  isPersistableConversationId,
  shouldReplacePlannerState,
  type PlannerMessageMeta,
} from '../helpers';

export default function usePlannerState(
  conversationId: string | null,
  messages: MessageRow[],
  toast: (args: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
) {
  const { user } = useAuth();
  const [plannerState, setPlannerState] = useState<TripPlannerState | null>(null);
  const [isLoadingPlanner, setIsLoadingPlanner] = useState(false);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const lastTripUpsertRef = useRef(0);
  const [activePlannerMutation, setActivePlannerMutation] = useState<{
    type: 'regen_plan' | 'regen_segment' | 'regen_day';
    segmentId?: string;
    dayId?: string;
  } | null>(null);
  const [isResolvingLocations, setIsResolvingLocations] = useState(false);
  const [plannerLocationWarning, setPlannerLocationWarning] = useState<string | null>(null);
  const resolvingSignatureRef = useRef<string | null>(null);
  const plannerConversationIdRef = useRef<string | null>(conversationId);
  const suppressNextPersistedLoadUiRef = useRef(false);
  const pendingSegmentEnrichmentRef = useRef<Set<string>>(new Set());
  const pendingRealPlacesHydrationRef = useRef<Set<string>>(new Set());

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
    pendingRealPlacesHydrationRef.current.clear();
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

    const { syncingFields: _ephemeral, ...stateForPersistence } = state;
    const normalizedState: TripPlannerState = {
      ...stateForPersistence,
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
      console.warn('\u26a0\ufe0f [TRIP PLANNER] Could not delete old planner snapshots:', deleteError);
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
      console.error('\u274c [TRIP PLANNER] Failed to persist planner state:', error);
    }

    // Fire-and-forget: sync to trips table (throttled: max 1 per 5s)
    const now = Date.now();
    const isConsumer = user?.accountType === 'consumer';
    const canPersist = isConsumer
      ? Boolean(user?.id)
      : Boolean(user?.id && user?.agency_id && user?.tenant_id);
    if (canPersist && now - lastTripUpsertRef.current > 5000) {
      lastTripUpsertRef.current = now;
      const at = isConsumer ? 'consumer' as const : 'agent' as const;
      upsertTrip(normalizedState, conversationId, user!.id, user!.agency_id ?? null, user!.tenant_id ?? null, at).catch(() => {});
    }
  }, [conversationId, isCurrentPlannerConversation, user]);

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
      const meta = snapshot?.meta as PlannerMessageMeta | null;
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
      console.error('\u274c [TRIP PLANNER] Failed to load planner state:', error);
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
    const meta = latestPlannerMessage?.meta as PlannerMessageMeta | null;
    if (!meta?.plannerData) return;

    const nextState = normalizePlannerState(meta.plannerData, conversationId);
    setPlannerState((current) => shouldReplacePlannerState(current, nextState) ? nextState : current);
  }, [conversationId, messages]);

  const updatePlannerState = useCallback(async (
    updater: (current: TripPlannerState) => TripPlannerState,
    source: 'ui_edit' | 'regen_day' | 'regen_segment' | 'regen_plan' | 'system' = 'ui_edit'
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

  const setDraftPlannerFromRequest = useCallback((request: ParsedTravelRequest, fieldProvenance?: PlannerFieldProvenance) => {
    const draftState = createDraftPlannerFromRequest(request, conversationId || undefined, fieldProvenance);
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

  return {
    plannerState,
    setPlannerState,
    isLoadingPlanner,
    setIsLoadingPlanner,
    plannerError,
    setPlannerError,
    activePlannerMutation,
    setActivePlannerMutation,
    isResolvingLocations,
    setIsResolvingLocations,
    plannerLocationWarning,
    setPlannerLocationWarning,
    resolvingSignatureRef,
    plannerConversationIdRef,
    pendingSegmentEnrichmentRef,
    pendingRealPlacesHydrationRef,
    isCurrentPlannerConversation,
    setPlannerStateIfCurrent,
    persistPlannerState,
    loadPersistedPlannerState,
    updatePlannerState,
    setDraftPlannerFromRequest,
    setPlannerDraftPhase,
    conversationId,
    toast,
  };
}

export type PlannerStateAPI = ReturnType<typeof usePlannerState>;
