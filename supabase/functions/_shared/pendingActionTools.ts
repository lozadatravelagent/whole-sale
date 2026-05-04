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
  type DiscoveryCandidateRef,
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
  /**
   * JSON-encoded key→value map. Keys SHOULD be drawn from `state.pending_action.fields`.
   * Encoded as a JSON string (not a free-form object) because OpenAI strict mode
   * requires `additionalProperties: false` on every nested object — incompatible
   * with our use case (keys vary per pending_action). The handler decodes it.
   */
  values_json: string;
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
      'Pass `values_json` as a JSON-encoded string of an object keyed by field names (snake_case is fine). Unrecognized keys are dropped server-side. ' +
      "Don't use for: greetings, off-topic messages, or replies that clearly start a new request — let the parser route normally instead.",
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        values_json: {
          type: 'string',
          description:
            'JSON-encoded object of parsed slot values keyed by the field names from `pending_action.fields`. ' +
            'Example: \'{"origin_city":"Buenos Aires","start_date":"2026-12-01","end_date":"2026-12-09"}\'. ' +
            'Use string for cities/places, ISO YYYY-MM-DD for dates, integers for counts. ' +
            'MUST be a valid JSON string parseable into an object — not a free-form object literal.',
        },
      },
      required: ['values_json'],
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

  // Decode the JSON-encoded values payload. Strict-mode forces us to model
  // free-form key/value bags as a JSON string; here we parse it back. Any
  // failure (malformed JSON, non-object, array) collapses to empty_values.
  let decoded: unknown = null;
  if (typeof args?.values_json === 'string' && args.values_json.trim()) {
    try {
      decoded = JSON.parse(args.values_json);
    } catch {
      decoded = null;
    }
  }
  const cleaned = sanitizeValues(decoded);
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
// propose_planner_addition — set a confirmation pending_action that, when
// confirmed, adds discovery candidates to the trip planner.
// -----------------------------------------------------------------------------
//
// Flow:
//   1. The model previously called `discover_places`; the result top-N was
//      persisted into `state.discovery_candidates` by the index.ts wrapper.
//   2. The user references one or more of those places ("agregá el segundo
//      al día 2"). The model resolves placeIds against discovery_candidates
//      and calls `propose_planner_addition({place_ids, segment_id?, day_index?, note?})`.
//   3. This tool resolves placeIds → DiscoveryCandidateRef[], stashes the
//      resolved payload on `pending_action.payload`, sets kind=
//      'awaiting_user_confirmation' for='add_places_to_itinerary'.
//   4. Persistence flushes the pending_action; the next turn renders it into
//      <pending_action> so the model knows the user's reply most likely is
//      a yes/no. The model then calls `confirm_pending_action`.
//   5. The server includes `payload` in the resolution envelope; the client
//      dispatcher reads `resolved_places, segment_id, day_index, note` and
//      mutates the planner via `addPlaceToPlanner` (or first-available slot).
//
// Domain payload lives in `pending_action.payload`, NOT in `applied`, because
// `applied` is reserved for the user's reply (overwritten by confirm_pending_action).
// -----------------------------------------------------------------------------

export interface ProposePlannerAdditionArgs {
  /** PlaceIds previously surfaced by `discover_places`. Must be non-empty. */
  place_ids: string[];
  /** Optional trip segment / day to add to. Asked of the user if omitted. */
  segment_id: string | null;
  /** Optional 0-based day index within the segment. Asked of the user if omitted. */
  day_index: number | null;
  /** Optional free-form note attached to the proposal. */
  note: string | null;
}

export interface ProposePlannerAdditionResult {
  ok: boolean;
  pending_action_set?: boolean;
  places_count?: number;
  segment_id?: string | null;
  day_index?: number | null;
  /** Resolution context for the model (echoed names so it can confirm in NL). */
  resolved_names?: string[];
  /** When ok=false, why the call was rejected. */
  error?:
    | 'bad_arguments'
    | 'no_candidates_to_resolve'
    | 'no_matching_place_ids';
  detail?: string;
}

export const proposePlannerAdditionToolSchema: OpenAIToolSchema = {
  type: 'function',
  function: {
    name: 'propose_planner_addition',
    description:
      'Propose adding one or more places (from a previous discover_places call) to the trip planner. ' +
      'Sets a pending_action of kind="awaiting_user_confirmation" so the user can confirm before mutation. ' +
      'Resolves place_ids against state.discovery_candidates (must be present in MEMORY STATE). ' +
      'Use when: the user references places from the most recent discovery listing — "agregá el primero al día 2", "sumá esos dos al itinerario", "el restaurante japonés a la noche del día 1". ' +
      "Don't use for: hotels (use the hotel search flow), flights, generic conceptual additions without a concrete placeId, or proposing a place the user hasn't seen yet (call discover_places first).",
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        place_ids: {
          type: 'array',
          items: { type: 'string' },
          description:
            'PlaceIds from the most recent discover_places result. Must match entries in state.discovery_candidates ' +
            "(rendered in MEMORY STATE under <discovery_candidates>). Resolve by position when the user says "
            + '"el segundo del listado" — index 0-based against the order shown.',
        },
        segment_id: {
          type: ['string', 'null'],
          description:
            'Optional. The trip segment id to add the places to. Resolve from active planner segments when the user says "al primer tramo" or names the city. Null when unknown — the user will be asked.',
        },
        day_index: {
          type: ['integer', 'null'],
          description:
            'Optional. 0-based day index within the segment. Null when not specified — the dispatcher will fall back to the first available slot in the segment.',
        },
        note: {
          type: ['string', 'null'],
          description:
            'Optional. Free-form note to attach to the proposal (e.g. "great for dinner", "if there is time"). Null when none.',
        },
      },
      required: ['place_ids', 'segment_id', 'day_index', 'note'],
    },
  },
};

/**
 * Pure: returns next state + result envelope. Caller is responsible for
 * persisting the next state (batch-save at end of tool loop). Does not
 * mutate `state`.
 *
 * Validation:
 *   - place_ids must be a non-empty array of strings.
 *   - state.discovery_candidates must be present and non-empty.
 *   - At least one place_id must match a candidate; unmatched ids are dropped.
 *   - If zero matches, returns ok=false with `no_matching_place_ids` so the
 *     model can re-discoverer rather than silently producing an empty proposal.
 *
 * On success the new pending_action OVERWRITES any prior pending_action.
 * Per the single-slot invariant the assistant only ever waits on one prompt
 * at a time; previous prompts (if any) are dropped here intentionally.
 */
export function executeProposePlannerAddition(
  state: EmiliaState,
  args: ProposePlannerAdditionArgs,
): { nextState: EmiliaState; result: ProposePlannerAdditionResult } {
  const placeIds = Array.isArray(args?.place_ids)
    ? args.place_ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];
  if (placeIds.length === 0) {
    return {
      nextState: state,
      result: {
        ok: false,
        error: 'bad_arguments',
        detail: 'place_ids must be a non-empty array of strings',
      },
    };
  }

  const candidates = state.discovery_candidates ?? [];
  if (candidates.length === 0) {
    return {
      nextState: state,
      result: {
        ok: false,
        error: 'no_candidates_to_resolve',
        detail:
          'state.discovery_candidates is empty; call discover_places before propose_planner_addition.',
      },
    };
  }

  // Build a lookup once. PlaceIds are case-sensitive provider ids; do not lowercase.
  const byId = new Map<string, DiscoveryCandidateRef>();
  for (const c of candidates) {
    if (c.placeId) byId.set(c.placeId, c);
  }

  // Preserve the order the model passed (so "el primero, después el tercero"
  // round-trips in the same order) and dedupe.
  const seen = new Set<string>();
  const resolvedPlaces: DiscoveryCandidateRef[] = [];
  for (const id of placeIds) {
    if (seen.has(id)) continue;
    const hit = byId.get(id);
    if (!hit) continue;
    seen.add(id);
    resolvedPlaces.push(hit);
  }

  if (resolvedPlaces.length === 0) {
    return {
      nextState: state,
      result: {
        ok: false,
        error: 'no_matching_place_ids',
        detail:
          'None of the supplied place_ids match state.discovery_candidates. Re-call discover_places or use ids from the latest result.',
      },
    };
  }

  const segmentId = typeof args.segment_id === 'string' && args.segment_id.trim()
    ? args.segment_id.trim()
    : null;
  const dayIndex = Number.isInteger(args.day_index as number) && (args.day_index as number) >= 0
    ? (args.day_index as number)
    : null;
  const note = typeof args.note === 'string' && args.note.trim()
    ? args.note.trim().slice(0, 240)
    : null;

  const promptCount = resolvedPlaces.length === 1
    ? `1 lugar (${resolvedPlaces[0].name})`
    : `${resolvedPlaces.length} lugares`;
  const target = dayIndex !== null
    ? `al día ${dayIndex + 1}${segmentId ? ` del tramo ${segmentId}` : ''}`
    : segmentId
      ? `al tramo ${segmentId}`
      : 'al itinerario';
  const promptText = `¿Confirmás agregar ${promptCount} ${target}?`;

  const nextPending: PendingAction = {
    kind: 'awaiting_user_confirmation',
    for: 'add_places_to_itinerary',
    prompt: promptText.slice(0, 240),
    issuedAt: new Date().toISOString(),
    payload: {
      resolved_places: resolvedPlaces,
      segment_id: segmentId,
      day_index: dayIndex,
      note,
    },
  };

  const nextState: EmiliaState = JSON.parse(JSON.stringify(state)) as EmiliaState;
  nextState.pending_action = nextPending;

  return {
    nextState,
    result: {
      ok: true,
      pending_action_set: true,
      places_count: resolvedPlaces.length,
      segment_id: segmentId,
      day_index: dayIndex,
      resolved_names: resolvedPlaces.map((p) => p.name),
    },
  };
}

// -----------------------------------------------------------------------------
// Catalog helpers
// -----------------------------------------------------------------------------

export function getPendingActionToolSchemas(): OpenAIToolSchema[] {
  return [
    applySlotValuesToolSchema,
    confirmPendingActionToolSchema,
    proposePlannerAdditionToolSchema,
  ];
}

// Exported for tests.
export const __testing = {
  sanitizeValues,
  intersectFields,
};
