import { supabase } from '@/integrations/supabase/client';
import type { TripPlannerState } from '@/features/trip-planner/types';
import { summarizePlannerForChat } from '@/features/trip-planner/utils';
import type { HandoffFormData, HandoffFormDraft, HandoffUserContext } from '../types';
import type { HandoffBudgetLevel } from '../utils/handoffFormSchema';

/**
 * Builds the initial form values for the handoff modal from the current
 * planner state + the authenticated consumer. Every field is editable;
 * the user can override any pre-fill.
 */
export function buildHandoffDraftFromPlanner(
  plannerState: TripPlannerState | null | undefined,
  user: HandoffUserContext | null | undefined
): HandoffFormDraft {
  const travelers = plannerState?.travelers ?? { adults: 2, children: 0, infants: 0 };
  const budgetLevel = plannerState?.budgetLevel as HandoffBudgetLevel | undefined;

  return {
    name: '',
    email: user?.email ?? '',
    phone: '',
    origin: plannerState?.origin?.trim() ?? '',
    startDate: plannerState?.startDate ?? '',
    endDate: plannerState?.endDate ?? '',
    adults: Math.max(1, travelers.adults ?? 1),
    children: Math.max(0, travelers.children ?? 0),
    budgetLevel,
    comment: '',
  };
}

/**
 * Shape of the row we INSERT into public.leads for a B2C handoff.
 * agency_id, tenant_id and assigned_user_id are NULL — the consumer
 * does not belong to any agency; an agent will claim the lead from the
 * B2C inbox later.
 *
 * The `trip` JSONB column stores a denormalized snapshot useful for
 * the CRM Kanban card; the full planner_state stays in the trips row
 * via trip_id.
 */
export interface HandoffLeadInsertPayload {
  conversation_id: string;
  trip_id: string | null;
  agency_id: null;
  tenant_id: null;
  assigned_user_id: null;
  status: 'new';
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  trip: {
    type: 'b2c_handoff';
    origin: string | null;
    destinations: string[];
    primary_city: string | null;
    start_date: string | null;
    end_date: string | null;
    is_flexible_dates: boolean;
    adults: number;
    children: number;
    budget_level: HandoffBudgetLevel | null;
  };
  description: string;
}

export function buildHandoffLeadPayload(
  formData: HandoffFormData,
  plannerState: TripPlannerState,
  conversationId: string,
  tripId: string | null
): HandoffLeadInsertPayload {
  const destinations = (plannerState.destinations ?? []).filter(
    (d) => typeof d === 'string' && d.trim().length > 0
  );
  const primaryCity = plannerState.segments?.[0]?.city?.trim() || destinations[0] || null;

  const baseSummary = summarizePlannerForChat(plannerState);
  const userComment = formData.comment?.trim() ?? '';
  const description = userComment
    ? `${userComment}\n\n---\n\n${baseSummary}`
    : baseSummary;

  return {
    conversation_id: conversationId,
    trip_id: tripId,
    agency_id: null,
    tenant_id: null,
    assigned_user_id: null,
    status: 'new',
    contact: {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
    },
    trip: {
      type: 'b2c_handoff',
      origin: formData.origin?.trim() || null,
      destinations,
      primary_city: primaryCity,
      start_date: formData.startDate || null,
      end_date: formData.endDate || null,
      is_flexible_dates: Boolean(plannerState.isFlexibleDates),
      adults: formData.adults,
      children: formData.children,
      budget_level: formData.budgetLevel ?? null,
    },
    description,
  };
}

/**
 * Looks up the trip row id for the given conversation so it can be
 * linked from the lead row. Returns null if no trip exists (which
 * shouldn't happen when the handoff banner is visible, since that
 * requires a ready plannerState that already upserted a trip).
 */
async function findTripIdForConversation(conversationId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('trips')
      .select('id')
      .eq('conversation_id', conversationId)
      .maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Submits a human-handoff request. Inserts a row into public.leads with
 * the conversation + trip context; the CRM B2B inbox will list these
 * rows so an agent can claim them. Fire-and-forget error handling: on
 * failure, logs a warning and returns null so the caller can show a
 * user-facing toast.
 */
export async function requestHumanHandoff(
  formData: HandoffFormData,
  plannerState: TripPlannerState,
  conversationId: string,
  user: HandoffUserContext | null | undefined
): Promise<{ leadId: string } | null> {
  void user;
  try {
    const tripId = await findTripIdForConversation(conversationId);
    const payload = buildHandoffLeadPayload(formData, plannerState, conversationId, tripId);

    const { data, error } = await supabase
      .from('leads')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.warn('[HANDOFF SERVICE] requestHumanHandoff error:', error.message);
      return null;
    }

    return { leadId: data.id };
  } catch (err) {
    console.warn('[HANDOFF SERVICE] requestHumanHandoff exception:', err);
    return null;
  }
}
