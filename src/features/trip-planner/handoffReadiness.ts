import type { TripPlannerState } from './types';

/**
 * Returns true when the planner state carries enough information for a
 * consumer to request a human handoff (B2C → CRM lead). Used by the
 * companion chat to show the handoff CTA banner.
 *
 * A trip is "ready" when:
 *   - It has at least one destination.
 *   - It has at least one segment, and every segment has a non-empty city.
 *   - It has concrete dates (startDate + endDate) OR is marked as flexible.
 *   - It has at least one adult traveler.
 *   - generationMeta.uiPhase === 'ready' (the planner finished generating).
 *   - generationMeta.isDraft is not true.
 *
 * Conservative criterion — intentionally avoids firing for half-formed
 * plans. If product wants more CTAs, relax uiPhase / isDraft checks.
 */
export function isTripReadyForHandoff(
  state: TripPlannerState | null | undefined
): boolean {
  if (!state) return false;

  const hasDestinations =
    (state.destinations ?? []).some((d) => typeof d === 'string' && d.trim().length > 0);

  const segments = state.segments ?? [];
  const hasSegments = segments.length > 0;
  const segmentsHaveCity = segments.every(
    (s) => typeof s?.city === 'string' && s.city.trim().length > 0
  );

  const hasConcreteDates = Boolean(state.startDate && state.endDate);
  const hasDates = Boolean(state.isFlexibleDates) || hasConcreteDates;

  const hasTravelers = (state.travelers?.adults ?? 0) >= 1;

  const readyPhase = state.generationMeta?.uiPhase === 'ready';
  const notDraft = state.generationMeta?.isDraft !== true;

  return (
    hasDestinations &&
    hasSegments &&
    segmentsHaveCity &&
    hasDates &&
    hasTravelers &&
    readyPhase &&
    notDraft
  );
}
