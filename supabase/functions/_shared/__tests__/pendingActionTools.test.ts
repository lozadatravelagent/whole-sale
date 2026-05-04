/**
 * Tests for `pendingActionTools.ts` — the generic pending_action resolution
 * tools (apply_slot_values + confirm_pending_action).
 *
 * Spec: addendum to docs/architecture/context-engineering-spec.md §1
 */

import { describe, expect, it } from 'vitest';

import {
  applySlotValuesToolSchema,
  confirmPendingActionToolSchema,
  executeApplySlotValues,
  executeConfirmPendingAction,
  getPendingActionToolSchemas,
  __testing,
} from '../pendingActionTools.ts';
import type { EmiliaState, PendingAction } from '../emiliaStateTypes.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildState(pending?: PendingAction | null): EmiliaState {
  return {
    profile: {
      agency_id: 'ag-1',
      currency: 'ARS',
      language: 'es',
      preferences: {},
    },
    global_memory: { notes: [] },
    session_memory: { notes: [] },
    active_refs: [],
    mode: 'agency',
    trip_history: { trips: [] },
    inject_session_memories_next_turn: false,
    pending_action: pending ?? null,
    meta: {
      conversation_id: 'conv-1',
      agency_id: 'ag-1',
      schema_version: 2,
      turn_count: 0,
    },
  };
}

const QUOTE_PA: PendingAction = {
  kind: 'awaiting_user_input',
  for: 'quote_completion',
  fields: ['origin', 'start_date', 'end_date'],
  ref: { type: 'plan', id: 'plan-7' },
  prompt: 'Origin and dates please',
  issuedAt: '2026-05-02T18:00:00Z',
};

const CONFIRM_PA: PendingAction = {
  kind: 'awaiting_user_confirmation',
  for: 'confirm_booking',
  ref: { type: 'quote', id: 'q-1' },
  prompt: 'Confirm purchase?',
  issuedAt: '2026-05-02T18:00:00Z',
};

// ---------------------------------------------------------------------------
// Schema sanity
// ---------------------------------------------------------------------------

describe('schemas', () => {
  it('apply_slot_values is strict and requires `values_json`', () => {
    expect(applySlotValuesToolSchema.function.strict).toBe(true);
    expect(applySlotValuesToolSchema.function.parameters.required).toEqual(['values_json']);
    expect(applySlotValuesToolSchema.function.parameters.additionalProperties).toBe(false);
    // values_json must be a string, not an object — strict mode forbids
    // additionalProperties:true on nested objects.
    const props = applySlotValuesToolSchema.function.parameters.properties as Record<string, { type: string }>;
    expect(props.values_json.type).toBe('string');
  });

  it('confirm_pending_action is strict and requires `confirmed` + `notes`', () => {
    expect(confirmPendingActionToolSchema.function.strict).toBe(true);
    expect(confirmPendingActionToolSchema.function.parameters.required.sort()).toEqual([
      'confirmed',
      'notes',
    ]);
  });

  it('catalog returns all schemas', () => {
    const all = getPendingActionToolSchemas();
    expect(all.map((s) => s.function.name).sort()).toEqual([
      'apply_slot_values',
      'confirm_pending_action',
      'propose_planner_addition',
    ]);
  });
});

// ---------------------------------------------------------------------------
// executeApplySlotValues
// ---------------------------------------------------------------------------

describe('executeApplySlotValues', () => {
  it('rejects when no pending_action', () => {
    const { result, nextState } = executeApplySlotValues(buildState(null), {
      values_json: JSON.stringify({ origin: 'BUE' }),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_pending_action');
    expect(nextState.pending_action).toBeNull();
  });

  it('rejects when wrong kind (confirmation)', () => {
    const { result } = executeApplySlotValues(buildState(CONFIRM_PA), {
      values_json: JSON.stringify({ confirmed: true }),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('wrong_kind');
  });

  it('rejects empty values', () => {
    const { result } = executeApplySlotValues(buildState(QUOTE_PA), { values_json: '{}' });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('empty_values');
  });

  it('rejects when no recognized fields (all keys outside `fields`)', () => {
    const { result } = executeApplySlotValues(buildState(QUOTE_PA), {
      values_json: JSON.stringify({ random_field: 'whatever' }),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_recognized_fields');
  });

  it('accepts partial fill, marks complete=false, lists remaining', () => {
    const { result, nextState } = executeApplySlotValues(buildState(QUOTE_PA), {
      values_json: JSON.stringify({ origin: 'Buenos Aires' }),
    });
    expect(result.ok).toBe(true);
    expect(result.applied).toEqual({ origin: 'Buenos Aires' });
    expect(result.complete).toBe(false);
    expect(result.remaining?.sort()).toEqual(['end_date', 'start_date']);
    expect(nextState.pending_action!.applied).toEqual({ origin: 'Buenos Aires' });
    expect(nextState.pending_action!.complete).toBe(false);
  });

  it('accepts full fill, marks complete=true', () => {
    const { result, nextState } = executeApplySlotValues(buildState(QUOTE_PA), {
      values_json: JSON.stringify({
        origin: 'Buenos Aires',
        start_date: '2026-12-01',
        end_date: '2026-12-09',
      }),
    });
    expect(result.ok).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.remaining).toEqual([]);
    expect(nextState.pending_action!.complete).toBe(true);
  });

  it('field-name normalization (camelCase / snake_case / spaces) maps to canonical', () => {
    const { result } = executeApplySlotValues(buildState(QUOTE_PA), {
      values_json: JSON.stringify({ Origin: 'BUE', startDate: '2026-12-01', 'end date': '2026-12-09' }),
    });
    expect(result.ok).toBe(true);
    expect(result.applied).toEqual({
      origin: 'BUE',
      start_date: '2026-12-01',
      end_date: '2026-12-09',
    });
    expect(result.complete).toBe(true);
  });

  it('drops nulls and trims string whitespace', () => {
    const { result } = executeApplySlotValues(buildState(QUOTE_PA), {
      values_json: JSON.stringify({
        origin: '  Buenos Aires  ',
        start_date: null,
        end_date: undefined,
      }),
    });
    expect(result.ok).toBe(true);
    expect(result.applied).toEqual({ origin: 'Buenos Aires' });
  });

  it('does NOT mutate the original state object', () => {
    const state = buildState(QUOTE_PA);
    const beforePA = JSON.stringify(state.pending_action);
    executeApplySlotValues(state, { values_json: JSON.stringify({ origin: 'Buenos Aires' }) });
    expect(JSON.stringify(state.pending_action)).toBe(beforePA);
  });
});

// ---------------------------------------------------------------------------
// executeConfirmPendingAction
// ---------------------------------------------------------------------------

describe('executeConfirmPendingAction', () => {
  it('rejects when no pending_action', () => {
    const { result } = executeConfirmPendingAction(buildState(null), {
      confirmed: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_pending_action');
  });

  it('rejects when wrong kind (input)', () => {
    const { result } = executeConfirmPendingAction(buildState(QUOTE_PA), {
      confirmed: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('wrong_kind');
  });

  it('records confirmed=true, complete=true', () => {
    const { result, nextState } = executeConfirmPendingAction(buildState(CONFIRM_PA), {
      confirmed: true,
      notes: null,
    });
    expect(result.ok).toBe(true);
    expect(result.confirmed).toBe(true);
    expect(nextState.pending_action!.applied).toEqual({ confirmed: true, notes: null });
    expect(nextState.pending_action!.complete).toBe(true);
  });

  it('caps notes to 200 chars', () => {
    const long = 'a'.repeat(500);
    const { nextState } = executeConfirmPendingAction(buildState(CONFIRM_PA), {
      confirmed: false,
      notes: long,
    });
    const stored = (nextState.pending_action!.applied as { notes: string }).notes;
    expect(stored.length).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Internal helpers (smoke)
// ---------------------------------------------------------------------------

describe('internal: sanitizeValues', () => {
  it('drops null/undefined and trims strings', () => {
    expect(__testing.sanitizeValues({ a: '  x  ', b: null, c: undefined, d: 1 })).toEqual({
      a: 'x',
      d: 1,
    });
  });
  it('returns {} for non-object input', () => {
    expect(__testing.sanitizeValues(null)).toEqual({});
    expect(__testing.sanitizeValues('string')).toEqual({});
    expect(__testing.sanitizeValues([1, 2])).toEqual({});
  });
});
