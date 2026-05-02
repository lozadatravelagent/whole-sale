/**
 * Tests for `contextEngineeringIntegration.ts`.
 *
 * Mocks `persistence.ts` so we can assert exactly when load/save are called
 * without touching Supabase. Logic-level invariants (immutability of
 * applyModeChange, replace-vs-append semantics of setActiveRef, type/id
 * filtering of clearActiveRef) are tested with no IO.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLoad, mockSave } = vi.hoisted(() => ({
  mockLoad: vi.fn(),
  mockSave: vi.fn(),
}));

vi.mock('../persistence', () => ({
  loadEmiliaState: mockLoad,
  saveEmiliaState: mockSave,
}));

import {
  applyModeChange,
  bootstrapStateIfMissing,
  buildMemoryStateBlockFromState,
  clearActiveRef,
  clearPendingAction,
  markPendingActionApplied,
  setActiveRef,
  setPendingAction,
} from '../contextEngineeringIntegration';
import {
  createInitialEmiliaState,
  type EmiliaState,
  type ContextRef,
  type PendingAction,
} from '../emiliaState';

const CONV_ID = 'conv-int-1';
const AGENCY_ID = 'agency-int-1';

function buildBaseState(overrides: Partial<EmiliaState> = {}): EmiliaState {
  const base = createInitialEmiliaState({
    conversationId: CONV_ID,
    agencyId: AGENCY_ID,
    leadId: 'lead-x',
    mode: 'passenger',
  });
  return { ...base, ...overrides };
}

beforeEach(() => {
  mockLoad.mockReset();
  mockSave.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// bootstrapStateIfMissing
// ---------------------------------------------------------------------------

describe('bootstrapStateIfMissing', () => {
  it('creates + saves + returns a fresh state when load returns null', async () => {
    mockLoad.mockResolvedValueOnce(null);
    mockSave.mockResolvedValueOnce(undefined);

    const state = await bootstrapStateIfMissing({
      conversationId: CONV_ID,
      agencyId: AGENCY_ID,
      leadId: 'lead-x',
      mode: 'agency',
    });

    expect(mockLoad).toHaveBeenCalledOnce();
    expect(mockLoad).toHaveBeenCalledWith(CONV_ID);

    expect(mockSave).toHaveBeenCalledOnce();
    const persisted = mockSave.mock.calls[0][0] as EmiliaState;
    expect(persisted.meta.conversation_id).toBe(CONV_ID);
    expect(persisted.meta.agency_id).toBe(AGENCY_ID);
    expect(persisted.profile.lead_id).toBe('lead-x');
    expect(persisted.mode).toBe('agency');

    expect(state.meta.conversation_id).toBe(CONV_ID);
    expect(state.mode).toBe('agency');
  });

  it('returns the loaded state untouched when one already exists', async () => {
    const existing = buildBaseState({ mode: 'agency' });
    mockLoad.mockResolvedValueOnce(existing);

    const state = await bootstrapStateIfMissing({
      conversationId: CONV_ID,
      agencyId: AGENCY_ID,
      leadId: 'lead-x',
      mode: 'passenger', // Different from existing — bootstrap must NOT override.
    });

    expect(state).toBe(existing);
    expect(state.mode).toBe('agency');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('propagates load errors (only no-rows is silent)', async () => {
    mockLoad.mockRejectedValueOnce(new Error('boom'));

    await expect(
      bootstrapStateIfMissing({
        conversationId: CONV_ID,
        agencyId: AGENCY_ID,
        mode: 'passenger',
      }),
    ).rejects.toThrow(/boom/);

    expect(mockSave).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyModeChange — invariants
// ---------------------------------------------------------------------------

describe('applyModeChange', () => {
  it('returns the same reference when mode does not change', () => {
    const state = buildBaseState({ mode: 'passenger' });
    const next = applyModeChange(state, 'passenger');
    expect(next).toBe(state);
  });

  it('only mutates `mode` and leaves every other field intact', () => {
    const ref: ContextRef = {
      type: 'plan',
      id: 'plan-99',
      summary1Line: 'BUE-IGR-RIO 12d',
      lastUpdated: new Date('2026-04-25T10:00:00Z').toISOString(),
    };
    const before = buildBaseState({
      mode: 'passenger',
      active_refs: [ref],
      global_memory: {
        notes: [
          {
            text: 'prefiere directos',
            keywords: ['flights', 'pref'],
            scope: 'planning',
            last_update_date: '2026-04-20T00:00:00Z',
          },
        ],
      },
      session_memory: {
        notes: [
          {
            text: 'budget mid',
            keywords: ['budget'],
            scope: 'pricing',
            last_update_date: '2026-04-25T08:00:00Z',
          },
        ],
      },
    });

    const after = applyModeChange(before, 'agency');

    expect(after.mode).toBe('agency');

    // Every other field is structurally equal to the input.
    expect(after.profile).toEqual(before.profile);
    expect(after.global_memory).toEqual(before.global_memory);
    expect(after.session_memory).toEqual(before.session_memory);
    expect(after.active_refs).toEqual(before.active_refs);
    expect(after.trip_history).toEqual(before.trip_history);
    expect(after.meta).toEqual(before.meta);
    expect(after.inject_session_memories_next_turn).toBe(
      before.inject_session_memories_next_turn,
    );

    // And it does NOT mutate the input by reference.
    expect(before.mode).toBe('passenger');
  });
});

// ---------------------------------------------------------------------------
// setActiveRef
// ---------------------------------------------------------------------------

describe('setActiveRef', () => {
  it('appends a ref when (type, id) is new', () => {
    const ref: ContextRef = {
      type: 'plan',
      id: 'plan-1',
      summary1Line: '12 días Sudamérica',
      lastUpdated: new Date().toISOString(),
    };

    const state = buildBaseState({ active_refs: [] });
    const next = setActiveRef(state, ref);

    expect(next.active_refs).toHaveLength(1);
    expect(next.active_refs[0]).toEqual(ref);
    // Original untouched.
    expect(state.active_refs).toHaveLength(0);
  });

  it('replaces in place when (type, id) already exists', () => {
    const oldRef: ContextRef = {
      type: 'plan',
      id: 'plan-1',
      summary1Line: 'old summary',
      lastUpdated: '2026-04-01T00:00:00Z',
    };
    const newRef: ContextRef = {
      type: 'plan',
      id: 'plan-1',
      summary1Line: 'new summary',
      lastUpdated: '2026-04-25T00:00:00Z',
    };

    const state = buildBaseState({ active_refs: [oldRef] });
    const next = setActiveRef(state, newRef);

    expect(next.active_refs).toHaveLength(1);
    expect(next.active_refs[0]).toEqual(newRef);
  });

  it('keeps refs of different (type, id) untouched when adding another', () => {
    const a: ContextRef = {
      type: 'plan',
      id: 'plan-1',
      summary1Line: 'plan A',
      lastUpdated: new Date().toISOString(),
    };
    const b: ContextRef = {
      type: 'quote',
      id: 'q-1',
      summary1Line: 'quote A',
      lastUpdated: new Date().toISOString(),
    };

    const state = buildBaseState({ active_refs: [a] });
    const next = setActiveRef(state, b);

    expect(next.active_refs).toHaveLength(2);
    expect(next.active_refs.map((r) => r.type).sort()).toEqual(['plan', 'quote']);
  });
});

// ---------------------------------------------------------------------------
// clearActiveRef
// ---------------------------------------------------------------------------

describe('clearActiveRef', () => {
  it('removes ALL refs of a type when no id is given', () => {
    const refs: ContextRef[] = [
      { type: 'plan', id: 'p1', summary1Line: 'a', lastUpdated: '2026-04-01' },
      { type: 'plan', id: 'p2', summary1Line: 'b', lastUpdated: '2026-04-02' },
      { type: 'quote', id: 'q1', summary1Line: 'c', lastUpdated: '2026-04-03' },
    ];

    const state = buildBaseState({ active_refs: refs });
    const next = clearActiveRef(state, 'plan');

    expect(next.active_refs).toHaveLength(1);
    expect(next.active_refs[0].type).toBe('quote');
  });

  it('removes ONLY the specific (type, id) when id is given', () => {
    const refs: ContextRef[] = [
      { type: 'plan', id: 'p1', summary1Line: 'a', lastUpdated: '2026-04-01' },
      { type: 'plan', id: 'p2', summary1Line: 'b', lastUpdated: '2026-04-02' },
    ];

    const state = buildBaseState({ active_refs: refs });
    const next = clearActiveRef(state, 'plan', 'p1');

    expect(next.active_refs).toHaveLength(1);
    expect(next.active_refs[0].id).toBe('p2');
  });

  it('returns the same reference when nothing matches', () => {
    const state = buildBaseState({ active_refs: [] });
    const next = clearActiveRef(state, 'plan');
    expect(next).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// buildMemoryStateBlockFromState
// ---------------------------------------------------------------------------

describe('buildMemoryStateBlockFromState', () => {
  it('returns a non-empty string carrying the core XML tags', () => {
    const state = buildBaseState();
    const block = buildMemoryStateBlockFromState(state);

    expect(typeof block).toBe('string');
    expect(block.length).toBeGreaterThan(0);
    expect(block).toContain('<user_profile>');
    expect(block).toContain('<current_mode>');
    expect(block).toContain('<memory_instructions>');
  });

  it('emits <pending_action> block only when state.pending_action is non-null', () => {
    // The literal `<pending_action>` token also appears inside <memory_instructions>
    // (policy text), so check for the BLOCK form (opening tag immediately followed
    // by a newline and `kind:`) which only appears when the renderer emits it.
    const stateNo = buildBaseState();
    expect(buildMemoryStateBlockFromState(stateNo)).not.toMatch(/<pending_action>\n\s*kind:/);

    const stateYes = setPendingAction(buildBaseState(), {
      kind: 'awaiting_user_input',
      for: 'quote_completion',
      fields: ['origin', 'start_date'],
      ref: { type: 'plan', id: 'plan-7' },
      prompt: 'Para avanzar necesito ciudad de salida y fechas exactas',
      issuedAt: new Date().toISOString(),
    });
    const block = buildMemoryStateBlockFromState(stateYes);
    expect(block).toMatch(/<pending_action>\n\s*kind:/);
    expect(block).toContain('kind: awaiting_user_input');
    expect(block).toContain('for: quote_completion');
    expect(block).toContain('fields: [origin, start_date]');
    expect(block).toContain('ref: plan:plan-7');
  });
});

// ---------------------------------------------------------------------------
// pending_action helpers (Phase 5 — Test 4 abstraction)
// ---------------------------------------------------------------------------

describe('setPendingAction', () => {
  it('clones state and sets pending_action', () => {
    const state = buildBaseState();
    expect(state.pending_action).toBeNull();

    const action: PendingAction = {
      kind: 'awaiting_user_input',
      for: 'quote_completion',
      fields: ['origin', 'start_date', 'end_date'],
      ref: { type: 'plan', id: 'plan-1' },
      prompt: 'Need origin and dates',
      issuedAt: new Date().toISOString(),
    };
    const next = setPendingAction(state, action);

    expect(next).not.toBe(state);
    expect(state.pending_action).toBeNull(); // immutability
    expect(next.pending_action).not.toBeNull();
    expect(next.pending_action!.for).toBe('quote_completion');
    expect(next.pending_action!.fields).toEqual(['origin', 'start_date', 'end_date']);
  });

  it('replaces an existing pending_action (single-slot semantics)', () => {
    const state = setPendingAction(buildBaseState(), {
      kind: 'awaiting_user_input',
      for: 'collect_passenger',
      fields: ['adults'],
      prompt: 'How many?',
      issuedAt: new Date().toISOString(),
    });
    const next = setPendingAction(state, {
      kind: 'awaiting_user_confirmation',
      for: 'confirm_booking',
      prompt: 'Confirm?',
      issuedAt: new Date().toISOString(),
    });
    expect(next.pending_action!.for).toBe('confirm_booking');
    expect(next.pending_action!.kind).toBe('awaiting_user_confirmation');
  });

  it('caps fields to 6 and prompt to 240 chars', () => {
    const longFields = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const longPrompt = 'x'.repeat(500);
    const next = setPendingAction(buildBaseState(), {
      kind: 'awaiting_user_input',
      for: 'collect_many',
      fields: longFields,
      prompt: longPrompt,
      issuedAt: new Date().toISOString(),
    });
    expect(next.pending_action!.fields).toHaveLength(6);
    expect(next.pending_action!.prompt.length).toBe(240);
  });
});

describe('clearPendingAction', () => {
  it('returns same reference when already null', () => {
    const state = buildBaseState();
    expect(clearPendingAction(state)).toBe(state);
  });

  it('drops pending_action when present, leaves rest intact', () => {
    const state = setPendingAction(buildBaseState(), {
      kind: 'awaiting_user_input',
      for: 'quote_completion',
      fields: ['origin'],
      prompt: 'where from?',
      issuedAt: new Date().toISOString(),
    });
    const next = clearPendingAction(state);
    expect(next.pending_action).toBeNull();
    expect(next.profile).toEqual(state.profile);
    expect(next.global_memory).toEqual(state.global_memory);
    expect(next.active_refs).toEqual(state.active_refs);
  });
});

describe('markPendingActionApplied', () => {
  it('no-ops when pending_action is null', () => {
    const state = buildBaseState();
    expect(markPendingActionApplied(state, { foo: 'bar' }, true)).toBe(state);
  });

  it('merges values onto applied and stamps complete', () => {
    const state = setPendingAction(buildBaseState(), {
      kind: 'awaiting_user_input',
      for: 'quote_completion',
      fields: ['origin', 'start_date'],
      prompt: 'where + when',
      issuedAt: new Date().toISOString(),
    });
    const partial = markPendingActionApplied(state, { origin: 'BUE' }, false);
    expect(partial.pending_action!.applied).toEqual({ origin: 'BUE' });
    expect(partial.pending_action!.complete).toBe(false);

    const full = markPendingActionApplied(partial, { start_date: '2026-12-01' }, true);
    expect(full.pending_action!.applied).toEqual({
      origin: 'BUE',
      start_date: '2026-12-01',
    });
    expect(full.pending_action!.complete).toBe(true);
  });
});
