import { useCallback, useMemo } from 'react';
import type { PlannerFieldProvenance, PlannerSyncingFields, TripPlannerState } from '../types';
import {
  buildPlannerGenerationPayload,
  getInclusiveDateRangeDays,
} from '../utils';
import { redistributeDaysAcrossSegments, shouldRefetch } from '../helpers';
import type { PlannerStateAPI } from './usePlannerState';

export default function usePlannerDestinations(
  state: PlannerStateAPI,
  invokePlannerGeneration: (
    payload: Record<string, unknown>,
    source: 'regen_day' | 'regen_segment' | 'regen_plan',
    mutationMeta?: { segmentId?: string; dayId?: string }
  ) => Promise<void>
) {
  const {
    plannerState,
    setPlannerState,
    updatePlannerState,
    persistPlannerState,
  } = state;

  const updateTripField = useCallback(async <K extends keyof TripPlannerState>(field: K, value: TripPlannerState[K]) => {
    const fieldStr = field as string;
    const needsRefetch = shouldRefetch(fieldStr, 'hotels') || shouldRefetch(fieldStr, 'transport');
    const syncingKey = fieldStr === 'days' || fieldStr === 'startDate' || fieldStr === 'endDate'
      ? 'dates' as const
      : fieldStr as keyof PlannerSyncingFields;

    await updatePlannerState((current) => {
      const provenanceField = field as string as keyof PlannerFieldProvenance;
      const updatedProvenance = current.fieldProvenance && (provenanceField in (current.fieldProvenance || {}))
        ? { ...current.fieldProvenance, [provenanceField]: 'confirmed' as const }
        : current.fieldProvenance;

      const updatedSyncing = needsRefetch && syncingKey in ({} as PlannerSyncingFields)
        ? { ...current.syncingFields, [syncingKey]: true }
        : needsRefetch
          ? { ...current.syncingFields, [syncingKey]: true }
          : current.syncingFields;

      return {
        ...current,
        [field]: value,
        fieldProvenance: updatedProvenance,
        syncingFields: updatedSyncing,
      };
    });
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

    // Check if segments have enriched content worth preserving
    const hasEnrichedContent = plannerState.segments.some(
      (seg) => seg.contentStatus === 'ready' && seg.days.length > 0
    );

    if (hasEnrichedContent && !selection.isFlexibleDates) {
      // Re-index days across segments instead of full regen
      const reindexedSegments = redistributeDaysAcrossSegments(
        plannerState.segments,
        computedDays,
        { startDate: selection.startDate, endDate: selection.endDate },
      );

      const nextState: TripPlannerState = {
        ...plannerState,
        startDate: selection.startDate,
        endDate: selection.endDate,
        isFlexibleDates: false,
        flexibleMonth: undefined,
        flexibleYear: undefined,
        days: computedDays,
        segments: reindexedSegments,
        syncingFields: { ...plannerState.syncingFields, dates: true },
      };

      setPlannerState(nextState);
      await persistPlannerState(nextState, 'ui_edit');
      // Auto-load effects will pick up changed signatures and fire API calls
      return;
    }

    // No enriched content — full regen via Edge Function
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
  }, [invokePlannerGeneration, persistPlannerState, plannerState, setPlannerState]);

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
          summary: 'Nuevo destino agregado. Regener\u00e1 el planificador para armar los d\u00edas detallados.',
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
  }, [invokePlannerGeneration, persistPlannerState, plannerState, setPlannerState]);

  const plannerSummary = useMemo(() => {
    if (!plannerState) return null;
    return {
      destinations: plannerState.destinations.length,
      segments: plannerState.segments.length,
      days: plannerState.days,
    };
  }, [plannerState]);

  return {
    updateTripField,
    setExactDateRange,
    applyPlannerDateSelection,
    addDestination,
    removeDestination,
    reorderDestinations,
    plannerSummary,
  };
}
