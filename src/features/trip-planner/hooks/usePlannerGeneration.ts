import { useCallback } from 'react';
import { createDebugTimer } from '@/utils/debugTiming';
import { supabase } from '@/integrations/supabase/client';
import type { TripPlannerState } from '../types';
import {
  buildPlannerGenerationPayload,
  normalizePlannerState,
} from '../utils';
import { isDraftPlannerState, mergeEnrichedSegmentState } from '../helpers';
import type { PlannerStateAPI } from './usePlannerState';

export default function usePlannerGeneration(state: PlannerStateAPI) {
  const {
    conversationId,
    plannerState,
    isCurrentPlannerConversation,
    setPlannerStateIfCurrent,
    persistPlannerState,
    setIsLoadingPlanner,
    setActivePlannerMutation,
    setPlannerError,
    pendingSegmentEnrichmentRef,
    toast,
  } = state;

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

    const timer = createDebugTimer('segment-enrich', { segmentId, city: targetSegment.city });

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

      timer.checkpoint('edge-function-response', response.data?.timing ? { serverTiming: response.data.timing } : undefined);

      const nextState = normalizePlannerState(response.data?.data, conversationId);
      if (!isCurrentPlannerConversation(requestConversationId)) {
        return;
      }

      let mergedState: TripPlannerState | null = null;
      setPlannerStateIfCurrent(requestConversationId, (current) => {
        if (!current) {
          mergedState = nextState;
          return nextState;
        }

        mergedState = mergeEnrichedSegmentState(current, nextState, segmentId);
        return mergedState;
      });

      if (mergedState) {
        await persistPlannerState(mergedState, 'system');
      }
      timer.end('enriched', { days: mergedState?.segments.find((s) => s.id === segmentId)?.days.length });
    } catch (error: unknown) {
      timer.fail('enrichment-failed', error);
      console.error('\u274c [TRIP PLANNER] Segment enrichment failed:', error);
      if (!isCurrentPlannerConversation(requestConversationId)) {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'No se pudo completar este tramo por ahora.';
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
                  contentError: errorMessage,
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
    pendingSegmentEnrichmentRef,
  ]);

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
        console.log('\u23f1\ufe0f [TRIP PLANNER BACKEND TIMING]', response.data.timing);
      }

      const nextState = normalizePlannerState(response.data?.data, conversationId);
      if (!isCurrentPlannerConversation(requestConversationId)) {
        return;
      }

      setPlannerStateIfCurrent(requestConversationId, nextState);
      await persistPlannerState(nextState, source);
      toast({
        title: 'Planificador actualizado',
        description: 'El itinerario se regener\u00f3 correctamente.',
      });
    } catch (error: unknown) {
      console.error('\u274c [TRIP PLANNER] Regeneration failed:', error);
      if (!isCurrentPlannerConversation(requestConversationId)) {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'No se pudo regenerar el planificador.';
      setPlannerError(errorMessage);
      toast({
        title: 'No se pudo actualizar el planificador',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      if (isCurrentPlannerConversation(requestConversationId)) {
        setIsLoadingPlanner(false);
        setActivePlannerMutation(null);
      }
    }
  }, [conversationId, isCurrentPlannerConversation, persistPlannerState, setPlannerStateIfCurrent, toast, setIsLoadingPlanner, setActivePlannerMutation, setPlannerError]);

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

  return {
    ensureSegmentEnriched,
    invokePlannerGeneration,
    regeneratePlanner,
    regenerateSegment,
    regenerateDay,
  };
}
