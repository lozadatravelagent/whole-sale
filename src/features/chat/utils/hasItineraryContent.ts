import type { TripPlannerState } from '@/features/trip-planner/types';

/**
 * Returns true when the planner state has at least one user-facing field
 * populated, which means the ItineraryPanel should render. When false, the
 * panel collapses to null so the consumer doesn't see an empty chrome.
 *
 * Intentionally permissive: any signal from Emilia (a destination hint, a
 * proposed date, a budget) is enough to show the panel. The individual
 * blocks inside the panel remain conditional on their own fields.
 */
export function hasItineraryContent(
  state: TripPlannerState | null | undefined
): boolean {
  if (!state) return false;

  const hasDestinations =
    (state.destinations ?? []).some((d) => typeof d === 'string' && d.trim().length > 0);
  if (hasDestinations) return true;

  const hasSegments = (state.segments ?? []).some(
    (s) => typeof s?.city === 'string' && s.city.trim().length > 0
  );
  if (hasSegments) return true;

  if (state.startDate || state.endDate) return true;
  if (state.isFlexibleDates === true) return true;

  if ((state.notes ?? []).some((n) => typeof n === 'string' && n.trim().length > 0)) {
    return true;
  }

  if (state.budgetLevel) return true;
  if (state.pace) return true;

  return false;
}
