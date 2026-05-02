/**
 * Reciprocity tests — Phase 5 invariants.
 *
 * These are NOT end-to-end tests. They exercise the integration helpers
 * (`bootstrapStateIfMissing`, `applyModeChange`, `setActiveRef`,
 * `clearActiveRef`) against the contract documented in the
 * Context Engineering spec §1 (Option A — full conversation isolation):
 *
 *   "The change of `chatMode` (passenger ↔ agency) ONLY mutates `state.mode`.
 *    It NEVER touches `state.profile`, `state.global_memory`,
 *    `state.session_memory`, or `state.active_refs`."
 *
 * Mocks `persistence` (no DB, no network).
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
  clearActiveRef,
  setActiveRef,
} from '../contextEngineeringIntegration';
import type { ContextRef, EmiliaState, MemoryNote } from '../emiliaState';

const CONV_ID = 'conv-recip-1';
const AGENCY_ID = 'agency-recip-1';
const LEAD_ID = 'lead-recip-1';

const PLAN_REF: ContextRef = {
  type: 'plan',
  id: 'plan-recip-1',
  summary1Line: '4 destinos, 12 días, mid-budget',
  lastUpdated: new Date('2026-04-25T12:00:00Z').toISOString(),
};

beforeEach(() => {
  mockLoad.mockReset();
  mockSave.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Build a fixture by routing through `bootstrapStateIfMissing` so we exercise
 * the same code path the message handler uses.
 */
async function bootstrapFresh(mode: EmiliaState['mode']): Promise<EmiliaState> {
  mockLoad.mockResolvedValueOnce(null);
  mockSave.mockResolvedValueOnce(undefined);
  return bootstrapStateIfMissing({
    conversationId: CONV_ID,
    agencyId: AGENCY_ID,
    leadId: LEAD_ID,
    mode,
  });
}

function snapshotImmutableFields(state: EmiliaState) {
  return {
    profile: structuredClone(state.profile),
    global_memory: structuredClone(state.global_memory),
    session_memory: structuredClone(state.session_memory),
    active_refs: structuredClone(state.active_refs),
    trip_history: structuredClone(state.trip_history),
    meta: structuredClone(state.meta),
    inject_session_memories_next_turn: state.inject_session_memories_next_turn,
  };
}

// ---------------------------------------------------------------------------
// Caso A — passenger → agency: ref + memory survive the mode change
// ---------------------------------------------------------------------------

describe('Caso A — passenger → agency persistence', () => {
  it('only changes `mode`; active_refs and global_memory remain intact', async () => {
    let state = await bootstrapFresh('passenger');

    // Seed a global memory note so we can assert it survives.
    const note: MemoryNote = {
      text: 'Cliente prefiere vuelos directos',
      keywords: ['flights', 'directos'],
      scope: 'planning',
      last_update_date: '2026-04-20T00:00:00Z',
    };
    state = { ...state, global_memory: { notes: [note] } };

    state = setActiveRef(state, PLAN_REF);

    const before = snapshotImmutableFields(state);

    state = applyModeChange(state, 'agency');

    expect(state.mode).toBe('agency');
    // Everything else is structurally equal to the snapshot.
    expect(state.profile).toEqual(before.profile);
    expect(state.global_memory).toEqual(before.global_memory);
    expect(state.session_memory).toEqual(before.session_memory);
    expect(state.active_refs).toEqual(before.active_refs);
    expect(state.trip_history).toEqual(before.trip_history);
    expect(state.meta).toEqual(before.meta);
    expect(state.inject_session_memories_next_turn).toBe(
      before.inject_session_memories_next_turn,
    );
  });
});

// ---------------------------------------------------------------------------
// Caso B — agency → passenger: same invariant in the reverse direction
// ---------------------------------------------------------------------------

describe('Caso B — agency → passenger persistence', () => {
  it('only changes `mode`; everything else is preserved', async () => {
    let state = await bootstrapFresh('agency');
    state = setActiveRef(state, PLAN_REF);

    const before = snapshotImmutableFields(state);

    state = applyModeChange(state, 'passenger');

    expect(state.mode).toBe('passenger');
    expect(state.profile).toEqual(before.profile);
    expect(state.global_memory).toEqual(before.global_memory);
    expect(state.session_memory).toEqual(before.session_memory);
    expect(state.active_refs).toEqual(before.active_refs);
    expect(state.trip_history).toEqual(before.trip_history);
    expect(state.meta).toEqual(before.meta);
  });
});

// ---------------------------------------------------------------------------
// Caso C — round trip: ida y vuelta y vuelta de nuevo
// ---------------------------------------------------------------------------

describe('Caso C — round trip stays coherent', () => {
  it('survives passenger → agency → passenger → agency without state drift', async () => {
    let state = await bootstrapFresh('passenger');
    state = setActiveRef(state, PLAN_REF);

    const before = snapshotImmutableFields(state);

    state = applyModeChange(state, 'agency');
    expect(state.mode).toBe('agency');
    state = applyModeChange(state, 'passenger');
    expect(state.mode).toBe('passenger');
    state = applyModeChange(state, 'agency');
    expect(state.mode).toBe('agency');

    expect(state.active_refs).toEqual(before.active_refs);
    expect(state.profile).toEqual(before.profile);
    expect(state.global_memory).toEqual(before.global_memory);
    expect(state.session_memory).toEqual(before.session_memory);
    expect(state.meta).toEqual(before.meta);
  });
});

// ---------------------------------------------------------------------------
// Caso D — explicit reset clears refs only
// ---------------------------------------------------------------------------

describe('Caso D — explicit clearActiveRef', () => {
  it('removes the plan ref and leaves mode + memory untouched', async () => {
    let state = await bootstrapFresh('agency');
    state = setActiveRef(state, PLAN_REF);

    // Seed a non-empty global memory to assert it is untouched.
    const note: MemoryNote = {
      text: 'pareja sin niños',
      keywords: ['pax'],
      scope: 'lead-context',
      last_update_date: '2026-04-21T00:00:00Z',
    };
    state = { ...state, global_memory: { notes: [note] } };

    const beforeMode = state.mode;
    const beforeMemory = structuredClone(state.global_memory);
    const beforeProfile = structuredClone(state.profile);

    state = clearActiveRef(state, 'plan');

    expect(state.active_refs).toEqual([]);
    expect(state.mode).toBe(beforeMode);
    expect(state.global_memory).toEqual(beforeMemory);
    expect(state.profile).toEqual(beforeProfile);
  });
});
