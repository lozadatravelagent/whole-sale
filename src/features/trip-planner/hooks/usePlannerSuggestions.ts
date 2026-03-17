import { useMemo } from 'react';
import type { PlannerSuggestion, TripPlannerState } from '../types';
import { isDraftPlannerState } from '../helpers';
import { detectPlannerGaps } from '../utils';

export default function usePlannerSuggestions(plannerState: TripPlannerState | null): PlannerSuggestion[] {
  return useMemo(() => {
    if (!plannerState || isDraftPlannerState(plannerState)) return [];
    return detectPlannerGaps(plannerState);
  }, [plannerState]);
}
