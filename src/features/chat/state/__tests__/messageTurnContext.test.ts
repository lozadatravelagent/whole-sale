/**
 * Tests for `messageTurnContext.ts` — the per-turn adapter that wraps the
 * Context Engineering primitives for `useMessageHandler`.
 *
 * These tests pin the four public helpers (prepareTurnContext, bumpTurnCount,
 * emitPendingAction, consumePendingActionResolution) against their R1/R2
 * post-extraction contracts. Persistence, dispatcher, the integration helpers
 * and Supabase are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockSave,
  mockDispatch,
  mockBootstrap,
  mockApplyModeChange,
  mockSetActiveRef,
  mockClearPendingAction,
  mockSetPendingAction,
  mockBuildBlock,
  supabaseMock,
} = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return {
    mockSave: vi.fn(),
    mockDispatch: vi.fn(),
    mockBootstrap: vi.fn(),
    mockApplyModeChange: vi.fn(),
    mockSetActiveRef: vi.fn(),
    mockClearPendingAction: vi.fn(),
    mockSetPendingAction: vi.fn(),
    mockBuildBlock: vi.fn(),
    supabaseMock: { from, _select: select, _eq: eq, _maybeSingle: maybeSingle },
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: supabaseMock.from },
}));

vi.mock('../persistence', () => ({
  saveEmiliaState: mockSave,
}));

vi.mock('../pendingActionDispatcher', () => ({
  dispatchPendingAction: mockDispatch,
}));

vi.mock('../contextEngineeringIntegration', () => ({
  bootstrapStateIfMissing: mockBootstrap,
  applyModeChange: mockApplyModeChange,
  setActiveRef: mockSetActiveRef,
  clearPendingAction: mockClearPendingAction,
  setPendingAction: mockSetPendingAction,
  buildMemoryStateBlockFromState: mockBuildBlock,
}));

import {
  bumpTurnCount,
  consumePendingActionResolution,
  emitPendingAction,
  prepareTurnContext,
} from '../messageTurnContext';
import {
  createInitialEmiliaState,
  type EmiliaState,
  type PendingAction,
} from '../emiliaState';
import type { TripPlannerState } from '@/features/trip-planner/types';
import type { PendingActionResolution } from '../pendingActionDispatcher';

const CONV_ID = 'conv-mtc-1';
const AGENCY_ID = 'agency-mtc-1';

function buildState(overrides: Partial<EmiliaState> = {}): EmiliaState {
  const base = createInitialEmiliaState({
    conversationId: CONV_ID,
    agencyId: AGENCY_ID,
    leadId: 'lead-1',
    mode: 'passenger',
  });
  return { ...base, ...overrides };
}

function buildPlanner(overrides: Partial<TripPlannerState> = {}): TripPlannerState {
  return {
    id: 'plan-mtc-1',
    title: 'Trip',
    summary: 'A nice plan',
    isFlexibleDates: false,
    ...overrides,
  } as TripPlannerState;
}

let warnSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockSave.mockReset();
  mockSave.mockResolvedValue(undefined);
  mockDispatch.mockReset();
  mockDispatch.mockResolvedValue(undefined);
  mockBootstrap.mockReset();
  mockApplyModeChange.mockReset();
  // Default identity behavior for the mode/ref helpers — return the input.
  mockApplyModeChange.mockImplementation((state: EmiliaState, mode: EmiliaState['mode']) => ({
    ...state,
    mode,
  }));
  mockSetActiveRef.mockReset();
  mockSetActiveRef.mockImplementation((state: EmiliaState, ref) => ({
    ...state,
    active_refs: [...(state.active_refs ?? []), ref],
  }));
  mockClearPendingAction.mockReset();
  mockClearPendingAction.mockImplementation((state: EmiliaState) => ({
    ...state,
    pending_action: null,
  }));
  mockSetPendingAction.mockReset();
  mockSetPendingAction.mockImplementation((state: EmiliaState, action: PendingAction) => ({
    ...state,
    pending_action: { ...action },
  }));
  mockBuildBlock.mockReset();
  mockBuildBlock.mockReturnValue('<state-block/>');

  supabaseMock.from.mockClear();
  supabaseMock._select.mockClear();
  supabaseMock._eq.mockClear();
  supabaseMock._maybeSingle.mockReset();

  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  logSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// prepareTurnContext
// ---------------------------------------------------------------------------

describe('prepareTurnContext', () => {
  it('bootstraps a fresh state when none exists and renders memoryStateBlock', async () => {
    supabaseMock._maybeSingle.mockResolvedValueOnce({
      data: { agency_id: AGENCY_ID },
      error: null,
    });
    const fresh = buildState({ mode: 'passenger' });
    mockBootstrap.mockResolvedValueOnce(fresh);

    const result = await prepareTurnContext({
      conversationId: CONV_ID,
      leadId: 'lead-1',
      chatMode: 'passenger',
      plannerState: null,
    });

    expect(mockBootstrap).toHaveBeenCalledWith({
      conversationId: CONV_ID,
      agencyId: AGENCY_ID,
      leadId: 'lead-1',
      mode: 'passenger',
    });
    expect(result.ctxEngState).toBe(fresh);
    expect(result.memoryStateBlock).toBe('<state-block/>');
    expect(mockBuildBlock).toHaveBeenCalledWith(fresh);
    // No mode change (mode already matches), no planner ref → no save.
    expect(mockApplyModeChange).not.toHaveBeenCalled();
    expect(mockSetActiveRef).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('applies mode change when existing state has different mode (and saves)', async () => {
    supabaseMock._maybeSingle.mockResolvedValueOnce({
      data: { agency_id: AGENCY_ID },
      error: null,
    });
    const existing = buildState({ mode: 'agency' });
    mockBootstrap.mockResolvedValueOnce(existing);

    const result = await prepareTurnContext({
      conversationId: CONV_ID,
      leadId: 'lead-1',
      chatMode: 'passenger', // ← differs from existing 'agency'
      plannerState: null,
    });

    expect(mockApplyModeChange).toHaveBeenCalledTimes(1);
    expect(mockApplyModeChange).toHaveBeenCalledWith(existing, 'passenger');
    expect(result.ctxEngState).not.toBeNull();
    expect(result.ctxEngState!.mode).toBe('passenger');
    // Mode change triggers a save (active_refs save would be a second call).
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('registers a planner active_ref when plannerState has an id', async () => {
    supabaseMock._maybeSingle.mockResolvedValueOnce({
      data: { agency_id: AGENCY_ID },
      error: null,
    });
    const existing = buildState({ mode: 'passenger' });
    mockBootstrap.mockResolvedValueOnce(existing);

    const planner = buildPlanner({ id: 'plan-99', summary: 'BUE-IGR-RIO 12d' });
    const result = await prepareTurnContext({
      conversationId: CONV_ID,
      leadId: null,
      chatMode: 'passenger',
      plannerState: planner,
    });

    expect(mockSetActiveRef).toHaveBeenCalledTimes(1);
    const [, refArg] = mockSetActiveRef.mock.calls[0];
    expect(refArg).toMatchObject({
      type: 'plan',
      id: 'plan-99',
      summary1Line: 'BUE-IGR-RIO 12d',
    });
    expect(refArg.lastUpdated).toBeTruthy();
    expect(result.ctxEngState).not.toBeNull();
    // Save invoked (active_ref persistence).
    expect(mockSave).toHaveBeenCalled();
  });

  it('returns null gracefully when agency_id cannot be resolved', async () => {
    supabaseMock._maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await prepareTurnContext({
      conversationId: CONV_ID,
      leadId: null,
      chatMode: 'passenger',
      plannerState: null,
    });

    expect(result).toEqual({ ctxEngState: null, memoryStateBlock: undefined });
    expect(mockBootstrap).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[CTX-ENG] No agency_id resolved for conversation; skipping CE bootstrap',
    );
  });
});

// ---------------------------------------------------------------------------
// bumpTurnCount
// ---------------------------------------------------------------------------

describe('bumpTurnCount', () => {
  it('increments meta.turn_count and persists', async () => {
    const state = buildState();
    state.meta.turn_count = 5;

    const next = await bumpTurnCount(state);

    expect(next.meta.turn_count).toBe(6);
    expect(mockSave).toHaveBeenCalledTimes(1);
    const persisted = mockSave.mock.calls[0][0] as EmiliaState;
    expect(persisted.meta.turn_count).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// emitPendingAction
// ---------------------------------------------------------------------------

describe('emitPendingAction', () => {
  it('sets pending_action on the state and saves', async () => {
    const state = buildState();
    expect(state.pending_action).toBeNull();

    const action: PendingAction = {
      kind: 'awaiting_user_input',
      for: 'quote_completion',
      fields: ['origin', 'start_date'],
      ref: { type: 'plan', id: 'plan-99' },
      prompt: 'Necesito ciudad de salida y fechas',
      issuedAt: new Date().toISOString(),
    };

    const next = await emitPendingAction({ ctxEngState: state, action });

    expect(mockSetPendingAction).toHaveBeenCalledWith(state, action);
    expect(next.pending_action).not.toBeNull();
    expect(next.pending_action!.for).toBe('quote_completion');
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// consumePendingActionResolution
// ---------------------------------------------------------------------------

describe('consumePendingActionResolution', () => {
  it('dispatches, clears pending_action, and saves the cleared state', async () => {
    const state = buildState();
    state.pending_action = {
      kind: 'awaiting_user_input',
      for: 'quote_completion',
      fields: ['origin'],
      prompt: 'where from?',
      issuedAt: new Date().toISOString(),
    };

    const resolution: PendingActionResolution = {
      kind: 'awaiting_user_input',
      for: 'quote_completion',
      applied: { origin: 'BUE' },
      complete: true,
    };

    const next = await consumePendingActionResolution({
      ctxEngState: state,
      resolution,
      plannerState: buildPlanner(),
    });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockClearPendingAction).toHaveBeenCalledWith(state);
    expect(next.pending_action).toBeNull();
    expect(mockSave).toHaveBeenCalledTimes(1);
    const persisted = mockSave.mock.calls[0][0] as EmiliaState;
    expect(persisted.pending_action).toBeNull();
  });
});
