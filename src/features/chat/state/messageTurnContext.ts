/**
 * messageTurnContext — adapter layer between useMessageHandler and the
 * Context Engineering state primitives. Encapsulates the per-turn dance:
 * bootstrap, mode sync, planner ref registration, memoryStateBlock render,
 * turn_count bump, pending_action emit/consume.
 *
 * Each function returns the (possibly new) EmiliaState so the hook can keep
 * a fresh local reference. All persistence failures are warned, never thrown
 * — the hook stays resilient and falls back to the legacy path.
 *
 * Spec: docs/architecture/context-engineering-spec.md §1, §1.6
 */

import { supabase } from '@/integrations/supabase/client';
import {
  applyModeChange,
  bootstrapStateIfMissing,
  buildMemoryStateBlockFromState,
  clearPendingAction,
  setActiveRef,
  setPendingAction,
} from '@/features/chat/state/contextEngineeringIntegration';
import { saveEmiliaState } from '@/features/chat/state/persistence';
import {
  dispatchPendingAction,
  type PendingActionResolution,
} from '@/features/chat/state/pendingActionDispatcher';
import type { EmiliaState, PendingAction } from '@/features/chat/state/emiliaState';
import type { TripPlannerState } from '@/features/trip-planner/types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the agency_id for a conversation. Returns null when the row is
 * missing or has no agency assignment (RLS enforced — failed queries return
 * null and we fall back to the legacy path).
 *
 * Cheap one-shot select; only invoked when the Context Engineering flag is on.
 */
async function resolveAgencyIdForConversation(
  conversationId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('agency_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (error) {
      console.warn('[CTX-ENG] resolveAgencyIdForConversation failed:', error.message);
      return null;
    }
    return (data?.agency_id as string | null) ?? null;
  } catch (e) {
    console.warn('[CTX-ENG] resolveAgencyIdForConversation threw:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PreparedTurnContext {
  /** Loaded/bootstrapped EmiliaState; null when bootstrap failed (e.g., agency_id resolution error). */
  ctxEngState: EmiliaState | null;
  /** Pre-rendered memory state block for the parser; undefined when ctxEngState is null. */
  memoryStateBlock: string | undefined;
}

export interface PrepareTurnContextArgs {
  conversationId: string;
  leadId: string | null;
  chatMode: 'agency' | 'passenger' | undefined;
  plannerState: TripPlannerState | null;
}

/**
 * One-shot prep for a turn: load or bootstrap state, sync mode, register the
 * active planner ref, render the memoryStateBlock.
 *
 * On any internal error (failed agency_id resolve, supabase down), logs
 * `[CTX-ENG]` warn and returns { ctxEngState: null, memoryStateBlock: undefined }
 * — callers MUST guard on `ctxEngState` before using it (defensive guard,
 * protects against bootstrap failure).
 */
export async function prepareTurnContext(
  args: PrepareTurnContextArgs,
): Promise<PreparedTurnContext> {
  const { conversationId, leadId, chatMode, plannerState } = args;

  try {
    const ctxAgencyId = await resolveAgencyIdForConversation(conversationId);
    if (!ctxAgencyId) {
      console.warn(
        '[CTX-ENG] No agency_id resolved for conversation; skipping CE bootstrap',
      );
      return { ctxEngState: null, memoryStateBlock: undefined };
    }

    const desiredMode: 'agency' | 'passenger' =
      chatMode === 'agency' ? 'agency' : 'passenger';

    let ctxEngState: EmiliaState = await bootstrapStateIfMissing({
      conversationId,
      agencyId: ctxAgencyId,
      leadId: leadId ?? undefined,
      mode: desiredMode,
    });

    // Reciprocity: align mode without disturbing any other field.
    if (ctxEngState.mode !== desiredMode) {
      ctxEngState = applyModeChange(ctxEngState, desiredMode);
      await saveEmiliaState(ctxEngState).catch((e) =>
        console.warn('[CTX-ENG] saveEmiliaState (mode) failed:', e),
      );
    }

    // Register the active planner ref so the model sees it.
    const plannerId = plannerState?.id;
    if (plannerId) {
      const summary = (
        plannerState?.summary
        || plannerState?.title
        || `Plan ${plannerId}`
      )
        .toString()
        .slice(0, 120);
      ctxEngState = setActiveRef(ctxEngState, {
        type: 'plan',
        id: plannerId,
        summary1Line: summary,
        lastUpdated: new Date().toISOString(),
      });
      await saveEmiliaState(ctxEngState).catch((e) =>
        console.warn('[CTX-ENG] saveEmiliaState (active_ref) failed:', e),
      );
    }

    const memoryStateBlock = buildMemoryStateBlockFromState(ctxEngState);
    return { ctxEngState, memoryStateBlock };
  } catch (e) {
    console.warn('[CTX-ENG] Bootstrap failed; falling back to legacy path:', e);
    return { ctxEngState: null, memoryStateBlock: undefined };
  }
}

/**
 * Increment turn_count and persist. Failures warned, never thrown — the
 * bumped state is still returned so the in-memory caller is consistent.
 */
export async function bumpTurnCount(state: EmiliaState): Promise<EmiliaState> {
  const bumped: EmiliaState = {
    ...state,
    meta: { ...state.meta, turn_count: (state.meta.turn_count ?? 0) + 1 },
  };
  try {
    await saveEmiliaState(bumped);
  } catch (e) {
    console.warn('[CTX-ENG] saveEmiliaState (turn_count) failed:', e);
  }
  return bumped;
}

/**
 * Persist a "the assistant just asked X" pending_action. Returns the new state.
 * Save errors are warned, never thrown.
 */
export async function emitPendingAction(args: {
  ctxEngState: EmiliaState;
  action: PendingAction;
}): Promise<EmiliaState> {
  const { ctxEngState, action } = args;
  const next = setPendingAction(ctxEngState, action);
  try {
    await saveEmiliaState(next);
  } catch (e) {
    console.warn('[CTX-ENG] saveEmiliaState (pending_action) failed:', e);
  }
  return next;
}

/**
 * Apply tool resolution via dispatcher → clear pending_action → save.
 * Returns the new (cleared) state. On any dispatcher error, returns the
 * original state unchanged (no clear) so the next turn can try again.
 */
export async function consumePendingActionResolution(args: {
  ctxEngState: EmiliaState;
  resolution: PendingActionResolution;
  plannerState: TripPlannerState | null;
  updatePlannerState?: (
    updater: (current: TripPlannerState) => TripPlannerState,
    source?: 'ui_edit' | 'system',
  ) => Promise<void>;
}): Promise<EmiliaState> {
  const { ctxEngState, resolution, plannerState, updatePlannerState } = args;
  try {
    await dispatchPendingAction({
      resolution,
      plannerState,
      updatePlannerState,
    });
    const cleared = clearPendingAction(ctxEngState);
    await saveEmiliaState(cleared).catch((e) =>
      console.warn('[CTX-ENG] saveEmiliaState (clear pending_action) failed:', e),
    );
    console.log('✅ [PENDING-ACTION] Applied + cleared:', {
      for: resolution.for,
      applied: resolution.applied,
      complete: resolution.complete,
    });
    return cleared;
  } catch (e) {
    console.warn('[PENDING-ACTION] apply failed:', e);
    return ctxEngState;
  }
}
