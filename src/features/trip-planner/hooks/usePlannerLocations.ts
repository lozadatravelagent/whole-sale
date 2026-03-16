import { useEffect } from 'react';
import { enrichPlannerWithLocations } from '../services/plannerGeocoding';
import { isDraftPlannerState, normalizeLocationLabel } from '../helpers';
import type { PlannerStateAPI } from './usePlannerState';

export default function usePlannerLocations(state: PlannerStateAPI) {
  const {
    plannerState,
    setIsResolvingLocations,
    setPlannerLocationWarning,
    resolvingSignatureRef,
    setPlannerState,
    persistPlannerState,
  } = state;

  useEffect(() => {
    const isDraftStillGenerating = isDraftPlannerState(plannerState)
      && plannerState?.generationMeta?.uiPhase === 'draft_generating';
    if (!plannerState || plannerState.segments.length === 0 || isDraftStillGenerating) {
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
        await persistPlannerState(nextState, isDraftPlannerState(plannerState) ? 'draft' : 'system');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('\u274c [TRIP PLANNER] Failed to resolve planner locations:', error);
        setIsResolvingLocations(false);
        setPlannerLocationWarning('No pudimos ubicar algunos destinos en el mapa por ahora.');
      });

    return () => {
      cancelled = true;
      resolvingSignatureRef.current = null;
    };
  }, [persistPlannerState, plannerState, setIsResolvingLocations, setPlannerLocationWarning, setPlannerState, resolvingSignatureRef]);
}
