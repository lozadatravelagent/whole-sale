/**
 * contextEngineeringIntegration — pure functions that bridge the EmiliaState
 * layer (factories + persistence + render) into the message-handler flow.
 *
 * These are NOT React hooks. They are intentionally thin and side-effect-free
 * except for `bootstrapStateIfMissing`, which performs a single Postgres
 * load + (conditional) save.
 *
 * Spec: docs/architecture/context-engineering-spec.md §1 (Option A — full
 * conversation isolation), §3 (precedence), §6 (lifecycle).
 *
 * Decision invariants enforced here:
 * - `applyModeChange` ONLY mutates `state.mode`. Never touches profile,
 *   memory, refs, or trip_history. This is the heart of the Phase 5
 *   reciprocity contract.
 * - `bootstrapStateIfMissing` is the single bootstrap path. Brand-new
 *   conversations get a fresh state via `createInitialEmiliaState`; existing
 *   ones load whatever the persistence layer returns. No cross-conversation
 *   merging, no lead-profile bootstrap (per Option A).
 */

import {
  type EmiliaState,
  type ContextRef,
  type PendingAction,
  cloneEmiliaState,
  createInitialEmiliaState,
} from './emiliaState';
import { loadEmiliaState, saveEmiliaState } from './persistence';
import { renderStateForSystemPrompt } from './renderClientState';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export interface BootstrapStateArgs {
  conversationId: string;
  agencyId: string;
  leadId?: string;
  mode: EmiliaState['mode'];
  /**
   * Optional currency override forwarded to `createInitialEmiliaState`.
   * Only used when no persisted state exists yet for the conversation.
   */
  currency?: EmiliaState['profile']['currency'];
  /**
   * Optional language override forwarded to `createInitialEmiliaState`.
   * Only used when no persisted state exists yet for the conversation.
   */
  language?: EmiliaState['profile']['language'];
}

/**
 * Load (or create + save) the EmiliaState for a conversation.
 *
 * Behavior:
 * 1. `loadEmiliaState(conversationId)` — fetch any existing row.
 * 2. If null (no row yet) → build a fresh state with
 *    `createInitialEmiliaState`, persist it, and return the fresh state.
 * 3. If a row exists → return the loaded state untouched.
 * 4. If load throws (any non-no-rows error) → propagate. Caller decides
 *    whether to fall back to legacy behavior.
 *
 * IMPORTANT (Option A): we DO NOT load anything from prior conversations
 * of the same lead. Each conversation is a fresh slate; `leadId` is stored
 * only as CRM linkage on the profile.
 */
export async function bootstrapStateIfMissing(
  args: BootstrapStateArgs,
): Promise<EmiliaState> {
  const { conversationId, agencyId, leadId, mode, currency, language } = args;

  const existing = await loadEmiliaState(conversationId);
  if (existing) {
    return existing;
  }

  // TODO: read currency/language from agency_config table when caller has access.
  // For now defaults are USD/es. Pass explicitly if known.
  const fresh = createInitialEmiliaState({
    conversationId,
    agencyId,
    leadId,
    mode,
    currency,
    language,
  });

  await saveEmiliaState(fresh);
  return fresh;
}

// ---------------------------------------------------------------------------
// Mode change (the Phase 5 reciprocity invariant)
// ---------------------------------------------------------------------------

/**
 * Return a new state with `mode` updated. Nothing else changes.
 *
 * If `newMode` already equals `state.mode`, the same reference is returned
 * to keep React identity checks cheap.
 *
 * This is the ONLY supported way to change mode against a state. Direct
 * assignment risks collateral mutations and breaks the "mode change does
 * not partition state" contract.
 */
export function applyModeChange(
  state: EmiliaState,
  newMode: EmiliaState['mode'],
): EmiliaState {
  if (state.mode === newMode) return state;

  const next = cloneEmiliaState(state);
  next.mode = newMode;
  return next;
}

// ---------------------------------------------------------------------------
// Active refs
// ---------------------------------------------------------------------------

/**
 * Add (or replace) an active ref. Replacement matches on `(type, id)` —
 * if a ref of the same type+id already exists, it is overwritten with the
 * new summary/lastUpdated; otherwise the ref is appended.
 *
 * Returns a new state. The original is not mutated.
 */
export function setActiveRef(state: EmiliaState, ref: ContextRef): EmiliaState {
  const next = cloneEmiliaState(state);
  const refs = next.active_refs ?? [];

  const existingIdx = refs.findIndex((r) => r.type === ref.type && r.id === ref.id);
  if (existingIdx >= 0) {
    refs[existingIdx] = { ...ref };
  } else {
    refs.push({ ...ref });
  }

  next.active_refs = refs;
  return next;
}

/**
 * Remove active refs by type, optionally narrowed by id.
 *
 * - `clearActiveRef(state, 'plan')` → removes ALL plan refs.
 * - `clearActiveRef(state, 'plan', planId)` → removes only the matching ref.
 *
 * Returns a new state. If nothing matches, the state is returned unchanged
 * (same reference) to keep React identity checks cheap.
 */
export function clearActiveRef(
  state: EmiliaState,
  type: ContextRef['type'],
  id?: string,
): EmiliaState {
  const refs = state.active_refs ?? [];
  const filtered = refs.filter((r) => {
    if (r.type !== type) return true;
    if (id !== undefined && r.id !== id) return true;
    return false;
  });

  if (filtered.length === refs.length) return state;

  const next = cloneEmiliaState(state);
  next.active_refs = filtered;
  return next;
}

// ---------------------------------------------------------------------------
// Pending action (turn-state)
// ---------------------------------------------------------------------------

/**
 * Set or replace the pending_action. The previous pending action (if any) is
 * dropped — the assistant only ever waits on one prompt at a time.
 *
 * Trims `prompt` to 240 chars and `fields` to 6 entries to keep the rendered
 * block within the token budget.
 *
 * Returns a new state. Original is not mutated.
 */
export function setPendingAction(
  state: EmiliaState,
  action: PendingAction,
): EmiliaState {
  const safe: PendingAction = {
    kind: action.kind,
    for: action.for,
    fields: action.fields ? action.fields.slice(0, 6) : undefined,
    ref: action.ref ? { type: action.ref.type, id: action.ref.id } : undefined,
    prompt: (action.prompt ?? '').slice(0, 240),
    issuedAt: action.issuedAt || new Date().toISOString(),
    applied: action.applied ? { ...action.applied } : undefined,
    complete: action.complete,
    payload: action.payload ? { ...action.payload } : undefined,
  };
  const next = cloneEmiliaState(state);
  next.pending_action = safe;
  return next;
}

/**
 * Clear pending_action. Returns the same reference if already null to keep
 * React identity checks cheap.
 */
export function clearPendingAction(state: EmiliaState): EmiliaState {
  if (state.pending_action == null) return state;
  const next = cloneEmiliaState(state);
  next.pending_action = null;
  return next;
}

/**
 * Stamp `applied` values onto the current pending_action without losing the
 * prompt/fields/ref. Use this when a tool handler resolves part of the
 * pending request but more turns may still be needed (`complete=false`).
 *
 * No-op (returns same reference) if there is no pending_action.
 */
export function markPendingActionApplied(
  state: EmiliaState,
  applied: Record<string, unknown>,
  complete: boolean,
): EmiliaState {
  if (state.pending_action == null) return state;
  const next = cloneEmiliaState(state);
  next.pending_action = {
    ...next.pending_action!,
    applied: { ...(next.pending_action!.applied ?? {}), ...applied },
    complete,
  };
  return next;
}

// ---------------------------------------------------------------------------
// System prompt render
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper: render the state-injection block from a state.
 * Identical contract to the edge-function side; see `renderClientState.ts`
 * for the duplication note.
 */
export function buildMemoryStateBlockFromState(state: EmiliaState): string {
  return renderStateForSystemPrompt(state);
}
