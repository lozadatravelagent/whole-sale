import type { HandoffBudgetLevel, HandoffFormData } from './utils/handoffFormSchema';

export type { HandoffFormData, HandoffBudgetLevel };

/**
 * Pre-filled values for the handoff modal form, derived from the current
 * plannerState + the authenticated consumer. All fields are editable in
 * the modal; this is just the starting point.
 */
export interface HandoffFormDraft {
  name: string;
  email: string;
  phone: string;
  origin: string;
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  budgetLevel: HandoffBudgetLevel | undefined;
  comment: string;
}

/**
 * Minimal view of the authenticated user needed to build the draft.
 * Kept narrower than AuthUser to avoid coupling the feature to the full
 * auth shape.
 */
export interface HandoffUserContext {
  email: string | null | undefined;
}
