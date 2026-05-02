// =============================================================================
// pendingActionTools.ts — Generic turn-state resolution tools
// =============================================================================
//
// Two function tools the agent uses to resolve `state.pending_action`:
//
//   - apply_slot_values        ← when kind="awaiting_user_input"
//   - confirm_pending_action   ← when kind="awaiting_user_confirmation"
//
// These are GENERIC. They don't know about quotes, planners, or any other
// domain — they only mutate `state.pending_action.applied/complete`. The
// caller (ai-message-parser/index.ts) is responsible for batch-persisting the
// updated state at the end of the tool loop AND for shipping the resolution
// back to the client so the client can mutate the underlying domain state
// (planner, quote, etc.).
//
// This is the same shape as memoryTools.ts: schemas + a pure validator + an
// in-memory state-mutating execute function. No DB writes here.
// =============================================================================

import {
  type EmiliaState,
  type PendingAction,
} from './emiliaStateTypes.ts';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface OpenAIToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    strict: true;
    parameters: {
      type: 'object';
      additionalProperties: false;
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

export interface ApplySlotValuesArgs {
  /** key→value map. Keys SHOULD be drawn from `state.pending_action.fields`. */
  values: Record<string, unknown>;
}

export interface ConfirmPendingActionArgs {
  confirmed: boolean;
  /** Optional free-text override the user provided ("sí pero cambialo a 5 días"). ≤200 chars. */
  notes?: string | null;
}

export interface ApplySlotValuesResult {
  ok: boolean;
  applied?: Record<string, unknown>;
  remaining?: string[];
  complete?: boolean;
  /** When ok=false, why the call was rejected. */
  reason?:
    | 'no_pending_action'
    | 'wrong_kind'
    | 'empty_values'
    | 'no_recognized_fields';
}

export interface ConfirmPendingActionResult {
  ok: boolean;
  confirmed?: boolean;
  notes?: string | null;
  reason?: 'no_pending_action' | 'wrong_kind';
}

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

export const applySlotValuesToolSchema: OpenAIToolSchema = {
  type: 'function',
  function: {
    name: 'apply_slot_values',
    description:
      "Resolve a `pending_action` of kind='awaiting_user_input' by submitting parsed slot values from the user's reply. " +
      'Use when: <pending_action> is present in MEMORY STATE, kind="awaiting_user_input", and the latest user message plausibly answers any of the listed `fields`. ' +
      'Pass `values` as an object keyed by field names (snake_case is fine). Unrecognized keys are dropped server-side. ' +
      "Don't use for: greetings, off-topic messages, or replies that clearly start a new request — let the parser route normally instead.",
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        values: {
          type: 'object',
          additionalProperties: true,
          description:
            'Parsed slot values keyed by the field names from `pending_action.fields`. ' +
            'Examples: {"origin_city":"Buenos Aires","start_date":"2026-12-01","end_date":"2026-12-09"}. ' +
            'Use string for cities/places, ISO YYYY-MM-DD for dates, integers for counts.',
        },
      },
      required: ['values'],
    },
  },
};

export const confirmPendingActionToolSchema: OpenAIToolSchema = {
  type: 'function',
  function: {
    name: 'confirm_pending_action',
    description:
      "Resolve a `pending_action` of kind='awaiting_user_confirmation' with the user's yes/no answer. " +
      'Use when: <pending_action> kind="awaiting_user_confirmation" and the user replied affirmatively or negatively. ' +
      "Don't use for: ambiguous replies (let the parser handle them as new analysis).",
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'true if the user accepted, false if they declined.',
        },
        notes: {
          type: ['string', 'null'],
          description:
            'Optional free-text caveat the user added (e.g. "sí pero cambialo a 5 días"). ≤200 chars.',
        },
      },
      required: ['confirmed', 'notes'],
    },
  },
};

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

/** Coerce/clean an arbitrary `values` object: drop null/undefined, trim strings. */
function sanitizeValues(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed) out[k] = trimmed;
      continue;
    }
    out[k] = v;
  }
  return out;
}

/**
 * Filter `values` to only the keys declared in `pending_action.fields`. We do
 * a permissive match (case-insensitive, snake/camel collapse) so the model
 * isn't punished for "originCity" vs "origin_city".
 *
 * If `pending_action.fields` is undefined or empty, ALL incoming keys are
 * accepted (kind="awaiting_user_input" with free-form payload — rare but
 * supported).
 */
function intersectFields(
  values: Record<string, unknown>,
  fields?: string[],
): Record<string, unknown> {
  if (!fields || fields.length === 0) return values;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const allowed = new Map(fields.map((f) => [norm(f), f] as const));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    const canonical = allowed.get(norm(k));
    if (canonical) out[canonical] = v;
  }
  return out;
}

// -----------------------------------------------------------------------------
// Execute
// -----------------------------------------------------------------------------

/**
 * Pure: returns next state + result envelope. Caller is responsible for
 * persisting the next state (batch-save at end of tool loop).
 *
 * On success: `pending_action.applied` is merged with `values`, `complete`
 * is computed by checking that every required `field` has a non-null entry
 * in `applied`.
 */
export function executeApplySlotValues(
  state: EmiliaState,
  args: ApplySlotValuesArgs,
): { nextState: EmiliaState; result: ApplySlotValuesResult } {
  const pa = state.pending_action ?? null;
  if (!pa) {
    return {
      nextState: state,
      result: { ok: false, reason: 'no_pending_action' },
    };
  }
  if (pa.kind !== 'awaiting_user_input') {
    return {
      nextState: state,
      result: { ok: false, reason: 'wrong_kind' },
    };
  }

  const cleaned = sanitizeValues(args?.values);
  if (Object.keys(cleaned).length === 0) {
    return {
      nextState: state,
      result: { ok: false, reason: 'empty_values' },
    };
  }

  const filtered = intersectFields(cleaned, pa.fields);
  if (Object.keys(filtered).length === 0) {
    return {
      nextState: state,
      result: { ok: false, reason: 'no_recognized_fields' },
    };
  }

  const merged = { ...(pa.applied ?? {}), ...filtered };
  const requiredFields = pa.fields ?? Object.keys(merged);
  const remaining = requiredFields.filter(
    (f) => merged[f] === undefined || merged[f] === null || merged[f] === '',
  );
  const complete = remaining.length === 0;

  const nextPending: PendingAction = {
    ...pa,
    applied: merged,
    complete,
  };

  // structuredClone via JSON to keep this file Deno-friendly without globals.
  // The state is JSON-pure so this is safe.
  const nextState: EmiliaState = JSON.parse(JSON.stringify(state)) as EmiliaState;
  nextState.pending_action = nextPending;

  return {
    nextState,
    result: {
      ok: true,
      applied: filtered,
      remaining,
      complete,
    },
  };
}

export function executeConfirmPendingAction(
  state: EmiliaState,
  args: ConfirmPendingActionArgs,
): { nextState: EmiliaState; result: ConfirmPendingActionResult } {
  const pa = state.pending_action ?? null;
  if (!pa) {
    return { nextState: state, result: { ok: false, reason: 'no_pending_action' } };
  }
  if (pa.kind !== 'awaiting_user_confirmation') {
    return { nextState: state, result: { ok: false, reason: 'wrong_kind' } };
  }

  const confirmed = Boolean(args?.confirmed);
  const notes = typeof args?.notes === 'string' ? args.notes.slice(0, 200) : null;

  const nextPending: PendingAction = {
    ...pa,
    applied: { confirmed, notes },
    complete: true,
  };

  const nextState: EmiliaState = JSON.parse(JSON.stringify(state)) as EmiliaState;
  nextState.pending_action = nextPending;

  return {
    nextState,
    result: { ok: true, confirmed, notes },
  };
}

// -----------------------------------------------------------------------------
// Catalog helpers
// -----------------------------------------------------------------------------

export function getPendingActionToolSchemas(): OpenAIToolSchema[] {
  return [applySlotValuesToolSchema, confirmPendingActionToolSchema];
}

// Exported for tests.
export const __testing = {
  sanitizeValues,
  intersectFields,
};
