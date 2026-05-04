/**
 * Multi-step tool sequence tests.
 *
 * Validates the full discovery → proposal → confirmation flow that ships in
 * Emilia v7. Each scenario exercises the executors in the order the model
 * would call them, with state carried across calls — the same lifecycle the
 * `ai-message-parser` index.ts wrapper enforces in production.
 *
 * Two tiers:
 *
 *   1. Pure-executor sequences (most of this file). Threads `state` through
 *      `executeProposePlannerAddition` → `executeConfirmPendingAction`,
 *      asserting that `pending_action.payload.resolved_places` survives both
 *      transitions and that `complete=true` lands at the end.
 *
 *   2. Scripted runToolLoop integration (one scenario). Wraps the executors
 *      in toolHandlers and drives them via `runToolLoop` with a mocked OpenAI
 *      fetch — proving the loop handler dispatch wires up correctly.
 *
 * The pure-executor tier catches state-transition regressions (renaming a
 * field, dropping payload, breaking the awaiting_user_confirmation invariant).
 * The runToolLoop tier catches handler-dispatch regressions (renamed tool,
 * arguments shape changed, etc.).
 *
 * NOTE: This intentionally does NOT exercise the client-side dispatcher
 * (`pendingActionDispatcher.handleAddPlacesToItinerary`) — that lives in
 * `src/` and is tested separately. Here we only verify that the server hands
 * the dispatcher a well-formed payload.
 */

import { describe, expect, it } from 'vitest';

import {
  executeApplySlotValues,
  executeConfirmPendingAction,
  executeProposePlannerAddition,
  type ProposePlannerAdditionResult,
} from '../pendingActionTools.ts';
import { runToolLoop, type ChatCompletionResponse } from '../toolRunner.ts';
import type { OpenAITool, ToolContext } from '../functionTools.ts';
import type {
  DiscoveryCandidateRef,
  EmiliaState,
  PendingAction,
} from '../emiliaStateTypes.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildState(pending?: PendingAction | null): EmiliaState {
  return {
    profile: {
      agency_id: 'ag-1',
      currency: 'USD',
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

const ROME_RESTAURANTS: DiscoveryCandidateRef[] = [
  { placeId: 'fsq_1', name: 'La Pergola', category: 'restaurant', address: 'Via A. Cadlolo 101' },
  { placeId: 'fsq_2', name: 'Roscioli', category: 'restaurant', address: 'Via dei Giubbonari 21' },
  { placeId: 'fsq_3', name: 'Trattoria al Moro', category: 'restaurant', address: 'Vicolo delle Bollette 13' },
  { placeId: 'fsq_4', name: 'Il Mercato Centrale', category: 'restaurant', address: 'Via G. Giolitti 36' },
];

// ---------------------------------------------------------------------------
// Scenario A — full happy path: discover → propose → confirm(true)
// ---------------------------------------------------------------------------

describe('multi-step flow: discover → propose → confirm(true)', () => {
  it('threads payload through both transitions and lands complete=true', () => {
    let state = buildState();

    // Step 1 — `discover_places` tool ran; index.ts wrapper persisted top-N
    // into state.discovery_candidates. Simulate that side effect:
    state = { ...state, discovery_candidates: ROME_RESTAURANTS };

    // Step 2 — model calls `propose_planner_addition` referencing 2 of the 4
    // candidates with explicit segment + day.
    const propose = executeProposePlannerAddition(state, {
      place_ids: ['fsq_1', 'fsq_3'],
      segment_id: 'seg-rome',
      day_index: 1,
      note: 'great for dinner',
    });

    expect(propose.result.ok).toBe(true);
    expect(propose.result.places_count).toBe(2);
    expect(propose.result.resolved_names).toEqual(['La Pergola', 'Trattoria al Moro']);

    state = propose.nextState;
    expect(state.pending_action).not.toBeNull();
    const pa = state.pending_action!;
    expect(pa.kind).toBe('awaiting_user_confirmation');
    expect(pa.for).toBe('add_places_to_itinerary');
    expect(pa.prompt).toContain('agregar 2 lugares');
    expect(pa.prompt).toContain('día 2'); // day_index 1 → "día 2" (1-based UI)

    const payload = pa.payload as {
      resolved_places: DiscoveryCandidateRef[];
      segment_id: string | null;
      day_index: number | null;
      note: string | null;
    };
    expect(payload.resolved_places).toHaveLength(2);
    expect(payload.resolved_places.map((p) => p.placeId)).toEqual(['fsq_1', 'fsq_3']);
    expect(payload.segment_id).toBe('seg-rome');
    expect(payload.day_index).toBe(1);
    expect(payload.note).toBe('great for dinner');

    // Step 3 — user replied "sí, agregalos" → model calls `confirm_pending_action`.
    const confirm = executeConfirmPendingAction(state, {
      confirmed: true,
      notes: null,
    });
    expect(confirm.result.ok).toBe(true);
    expect(confirm.result.confirmed).toBe(true);

    const finalPa = confirm.nextState.pending_action!;
    expect(finalPa.complete).toBe(true);
    expect((finalPa.applied as { confirmed: boolean }).confirmed).toBe(true);

    // CRITICAL invariant: payload (resolved_places etc.) MUST survive the
    // confirmation. The client dispatcher reads it to mutate the planner.
    const finalPayload = finalPa.payload as { resolved_places: DiscoveryCandidateRef[] };
    expect(finalPayload.resolved_places).toHaveLength(2);
    expect(finalPayload.resolved_places[0].placeId).toBe('fsq_1');
  });

  it('preserves ordering when the user references "primero, después tercero"', () => {
    let state = buildState();
    state = { ...state, discovery_candidates: ROME_RESTAURANTS };

    // Model passes ids in user-implied order. Should round-trip in same order.
    const propose = executeProposePlannerAddition(state, {
      place_ids: ['fsq_3', 'fsq_1'], // tercero, primero
      segment_id: null,
      day_index: null,
      note: null,
    });
    expect(propose.result.ok).toBe(true);
    expect(propose.result.resolved_names).toEqual(['Trattoria al Moro', 'La Pergola']);
    const payload = propose.nextState.pending_action!.payload as {
      resolved_places: DiscoveryCandidateRef[];
    };
    expect(payload.resolved_places.map((p) => p.placeId)).toEqual(['fsq_3', 'fsq_1']);
  });

  it('drops duplicate place_ids before resolving', () => {
    let state = buildState();
    state = { ...state, discovery_candidates: ROME_RESTAURANTS };

    const propose = executeProposePlannerAddition(state, {
      place_ids: ['fsq_2', 'fsq_2', 'fsq_4', 'fsq_2'],
      segment_id: null,
      day_index: null,
      note: null,
    });
    expect(propose.result.ok).toBe(true);
    expect(propose.result.places_count).toBe(2);
    expect(propose.result.resolved_names).toEqual(['Roscioli', 'Il Mercato Centrale']);
  });
});

// ---------------------------------------------------------------------------
// Scenario B — user declines: discover → propose → confirm(false)
// ---------------------------------------------------------------------------

describe('multi-step flow: discover → propose → confirm(false)', () => {
  it('marks complete=true with confirmed=false and preserves payload for telemetry', () => {
    let state = buildState();
    state = { ...state, discovery_candidates: ROME_RESTAURANTS };

    const propose = executeProposePlannerAddition(state, {
      place_ids: ['fsq_1'],
      segment_id: 'seg-rome',
      day_index: 0,
      note: null,
    });
    state = propose.nextState;

    const confirm = executeConfirmPendingAction(state, {
      confirmed: false,
      notes: 'no me convence ese restaurante',
    });
    expect(confirm.result.confirmed).toBe(false);

    const finalPa = confirm.nextState.pending_action!;
    expect(finalPa.complete).toBe(true);
    expect((finalPa.applied as { confirmed: boolean; notes: string }).confirmed).toBe(false);
    expect((finalPa.applied as { confirmed: boolean; notes: string }).notes).toBe(
      'no me convence ese restaurante',
    );

    // Payload preserved → client can log the rejection or offer alternatives.
    const finalPayload = finalPa.payload as { resolved_places: DiscoveryCandidateRef[] };
    expect(finalPayload.resolved_places).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Scenario C — propose with bad inputs (negative cases)
// ---------------------------------------------------------------------------

describe('multi-step flow: propose with invalid arguments', () => {
  it('rejects when no place_ids match candidates (no_matching_place_ids)', () => {
    let state = buildState();
    state = { ...state, discovery_candidates: ROME_RESTAURANTS };

    const propose = executeProposePlannerAddition(state, {
      place_ids: ['fsq_999', 'fsq_888'],
      segment_id: null,
      day_index: null,
      note: null,
    });
    expect(propose.result.ok).toBe(false);
    expect((propose.result as ProposePlannerAdditionResult).error).toBe('no_matching_place_ids');
    // State unchanged → no pending_action created.
    expect(propose.nextState.pending_action).toBeNull();
  });

  it('rejects when discovery_candidates is empty (no_candidates_to_resolve)', () => {
    const state = buildState(); // no discovery_candidates set

    const propose = executeProposePlannerAddition(state, {
      place_ids: ['fsq_1'],
      segment_id: null,
      day_index: null,
      note: null,
    });
    expect(propose.result.ok).toBe(false);
    expect((propose.result as ProposePlannerAdditionResult).error).toBe(
      'no_candidates_to_resolve',
    );
    expect(propose.nextState.pending_action).toBeNull();
  });

  it('rejects when place_ids is empty (bad_arguments)', () => {
    let state = buildState();
    state = { ...state, discovery_candidates: ROME_RESTAURANTS };

    const propose = executeProposePlannerAddition(state, {
      place_ids: [],
      segment_id: null,
      day_index: null,
      note: null,
    });
    expect(propose.result.ok).toBe(false);
    expect((propose.result as ProposePlannerAdditionResult).error).toBe('bad_arguments');
  });
});

// ---------------------------------------------------------------------------
// Scenario D — partial slot fill: apply_slot_values → apply_slot_values
// ---------------------------------------------------------------------------

describe('multi-step flow: partial apply_slot_values across two turns', () => {
  it('first apply leaves remaining=non-empty, second apply completes', () => {
    let state = buildState({
      kind: 'awaiting_user_input',
      for: 'quote_completion',
      fields: ['origin', 'start_date', 'end_date'],
      ref: { type: 'plan', id: 'plan-7' },
      prompt: 'Origin and dates please',
      issuedAt: '2026-05-03T12:00:00Z',
    });

    // Turn 1 — user replies only with origin.
    const apply1 = executeApplySlotValues(state, {
      values_json: JSON.stringify({ origin: 'Buenos Aires' }),
    });
    expect(apply1.result.ok).toBe(true);
    expect(apply1.result.complete).toBe(false);
    expect(apply1.result.remaining?.sort()).toEqual(['end_date', 'start_date']);
    expect(apply1.nextState.pending_action!.applied).toEqual({ origin: 'Buenos Aires' });
    expect(apply1.nextState.pending_action!.complete).toBe(false);

    state = apply1.nextState;

    // Turn 2 — user provides both dates.
    const apply2 = executeApplySlotValues(state, {
      values_json: JSON.stringify({ start_date: '2026-12-01', end_date: '2026-12-09' }),
    });
    expect(apply2.result.ok).toBe(true);
    expect(apply2.result.complete).toBe(true);
    expect(apply2.result.remaining).toEqual([]);
    expect(apply2.nextState.pending_action!.applied).toEqual({
      origin: 'Buenos Aires',
      start_date: '2026-12-01',
      end_date: '2026-12-09',
    });
    expect(apply2.nextState.pending_action!.complete).toBe(true);
  });

  it('does not regress on a second apply that drops one field via null', () => {
    // Simulating model passing null for a field already filled — should NOT
    // un-set it.
    const state = buildState({
      kind: 'awaiting_user_input',
      for: 'quote_completion',
      fields: ['origin', 'start_date', 'end_date'],
      prompt: '...',
      issuedAt: '2026-05-03T12:00:00Z',
      applied: { origin: 'BUE' },
    });

    const apply = executeApplySlotValues(state, {
      values_json: JSON.stringify({ origin: null, start_date: '2026-12-01', end_date: '2026-12-09' }),
    });
    expect(apply.result.ok).toBe(true);
    // origin survives because null gets filtered upstream by sanitizeValues.
    expect(apply.nextState.pending_action!.applied).toEqual({
      origin: 'BUE',
      start_date: '2026-12-01',
      end_date: '2026-12-09',
    });
    expect(apply.nextState.pending_action!.complete).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scenario E — runToolLoop integration: scripted OpenAI dispatches the tools
// ---------------------------------------------------------------------------

const PROPOSE_TOOL_SCHEMA: OpenAITool = {
  type: 'function',
  function: {
    name: 'propose_planner_addition',
    description: 'test propose',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        place_ids: { type: 'array', items: { type: 'string' } },
        segment_id: { type: ['string', 'null'] },
        day_index: { type: ['integer', 'null'] },
        note: { type: ['string', 'null'] },
      },
      required: ['place_ids', 'segment_id', 'day_index', 'note'],
    },
  },
};

const CONFIRM_TOOL_SCHEMA: OpenAITool = {
  type: 'function',
  function: {
    name: 'confirm_pending_action',
    description: 'test confirm',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        confirmed: { type: 'boolean' },
        notes: { type: ['string', 'null'] },
      },
      required: ['confirmed', 'notes'],
    },
  },
};

function makeCtx(): ToolContext {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: {} as any,
    conversationId: 'conv-1',
    agencyId: 'ag-1',
  };
}

interface ScriptedTurn {
  finish_reason: string;
  content?: string | null;
  tool_calls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
}

function makeScriptedFetch(turns: ScriptedTurn[]): typeof fetch {
  let i = 0;
  return (() => {
    const turn = turns[i++] ?? turns[turns.length - 1];
    const body: ChatCompletionResponse = {
      id: `cmpl-${i}`,
      model: 'gpt-4.1-test',
      choices: [
        {
          index: 0,
          finish_reason: turn.finish_reason,
          message: {
            role: 'assistant',
            content: turn.content ?? null,
            tool_calls: turn.tool_calls?.map((c) => ({
              id: c.id,
              type: 'function' as const,
              function: { name: c.name, arguments: JSON.stringify(c.args) },
            })),
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }) as unknown as typeof fetch;
}

describe('runToolLoop integration: propose → final answer', () => {
  it('dispatches propose_planner_addition and exits on the next turn', async () => {
    // Shared mutable state — what the index.ts wrapper would carry.
    let mutableState: EmiliaState = buildState();
    mutableState = { ...mutableState, discovery_candidates: ROME_RESTAURANTS };

    const fetchImpl = makeScriptedFetch([
      // Turn 1: model calls propose_planner_addition.
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          {
            id: 'call_1',
            name: 'propose_planner_addition',
            args: {
              place_ids: ['fsq_2', 'fsq_4'],
              segment_id: 'seg-rome',
              day_index: 0,
              note: null,
            },
          },
        ],
      },
      // Turn 2: model emits a final assistant content (no more tools).
      {
        finish_reason: 'stop',
        content:
          '{"requestType":"itinerary","message":"¿Confirmás agregar Roscioli e Il Mercato al día 1?"}',
      },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1-test',
      systemPrompt: 'sys',
      userMessage: 'agregá el segundo y el cuarto al primer día',
      tools: [PROPOSE_TOOL_SCHEMA],
      toolHandlers: {
        propose_planner_addition: (args: unknown) => {
          const out = executeProposePlannerAddition(
            mutableState,
            args as Parameters<typeof executeProposePlannerAddition>[1],
          );
          mutableState = out.nextState;
          return Promise.resolve(out.result);
        },
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    // Loop exited cleanly.
    expect(result.iterationsUsed).toBe(2);
    expect(result.toolCallsTrace).toHaveLength(1);
    expect(result.toolCallsTrace[0].tool).toBe('propose_planner_addition');
    expect(result.finalMessage.content).toContain('Roscioli');

    // State mutated by the handler — pending_action set with payload.
    expect(mutableState.pending_action).not.toBeNull();
    expect(mutableState.pending_action!.kind).toBe('awaiting_user_confirmation');
    const payload = mutableState.pending_action!.payload as {
      resolved_places: DiscoveryCandidateRef[];
    };
    expect(payload.resolved_places.map((p) => p.placeId)).toEqual(['fsq_2', 'fsq_4']);
  });

  it('confirm in a second loop drives complete=true while preserving payload', async () => {
    // Continuation: state has the awaiting_user_confirmation set from above.
    let mutableState: EmiliaState = buildState({
      kind: 'awaiting_user_confirmation',
      for: 'add_places_to_itinerary',
      prompt: '¿Confirmás agregar 2 lugares al día 1?',
      issuedAt: '2026-05-03T12:00:00Z',
      payload: {
        resolved_places: [ROME_RESTAURANTS[1], ROME_RESTAURANTS[3]],
        segment_id: 'seg-rome',
        day_index: 0,
        note: null,
      },
    });

    const fetchImpl = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          {
            id: 'call_1',
            name: 'confirm_pending_action',
            args: { confirmed: true, notes: null },
          },
        ],
      },
      {
        finish_reason: 'stop',
        content: '{"requestType":"itinerary","message":"Listo, los agregué al día 1."}',
      },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1-test',
      systemPrompt: 'sys',
      userMessage: 'sí, dale',
      tools: [CONFIRM_TOOL_SCHEMA],
      toolHandlers: {
        confirm_pending_action: (args: unknown) => {
          const out = executeConfirmPendingAction(
            mutableState,
            args as Parameters<typeof executeConfirmPendingAction>[1],
          );
          mutableState = out.nextState;
          return Promise.resolve(out.result);
        },
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(result.toolCallsTrace[0].tool).toBe('confirm_pending_action');
    expect(mutableState.pending_action!.complete).toBe(true);
    expect((mutableState.pending_action!.applied as { confirmed: boolean }).confirmed).toBe(true);
    // Payload survives confirmation — dispatcher needs it.
    const payload = mutableState.pending_action!.payload as {
      resolved_places: DiscoveryCandidateRef[];
    };
    expect(payload.resolved_places).toHaveLength(2);
  });
});
