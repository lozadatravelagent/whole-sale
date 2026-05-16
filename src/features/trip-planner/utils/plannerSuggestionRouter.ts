import type { PlannerSuggestion } from '../types';

export interface PlannerSuggestionRoute {
  /** Call the original direct action (handleSuggestionClick). */
  runDirectAction: boolean;
  /** If non-null, insert this text into the chat draft. */
  insertText: string | null;
}

/**
 * Pure routing for planner suggestion chips (hybrid behavior).
 * - confirm_field / confirm_location_dates: direct action only.
 * - select_dates: direct action (opens modal) AND seed the draft.
 * - everything else (prompt-type: search_transport/search_hotels/fill_slot/add_transfers/unknown): insert label.
 */
export function routePlannerSuggestion(suggestion: PlannerSuggestion): PlannerSuggestionRoute {
  switch (suggestion.action) {
    case 'confirm_field':
    case 'confirm_location_dates':
      return { runDirectAction: true, insertText: null };
    case 'select_dates':
      return { runDirectAction: true, insertText: 'Quiero elegir las fechas exactas del viaje.' };
    default:
      return { runDirectAction: false, insertText: suggestion.label };
  }
}
