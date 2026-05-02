/**
 * Tests for the Inject-phase `renderStateForSystemPrompt`.
 *
 * Spec: docs/architecture/context-engineering-spec.md §6.1 + Appendix A
 */

import { describe, expect, it } from 'vitest';

import { renderStateForSystemPrompt, __testing } from '../renderState.ts';
import type { EmiliaState, MemoryNote } from '../emiliaStateTypes.ts';

const FIXED_NOW = new Date('2026-05-02T12:00:00.000Z');

function emptyState(): EmiliaState {
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
    meta: {
      conversation_id: 'conv-1',
      agency_id: 'ag-1',
      schema_version: 1,
      turn_count: 0,
    },
  };
}

function note(overrides: Partial<MemoryNote>): MemoryNote {
  return {
    text: 'A note.',
    last_update_date: '2026-04-30T12:00:00.000Z',
    keywords: ['k'],
    scope: 'planning',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe('renderStateForSystemPrompt — empty state', () => {
  it('still renders profile, mode, memories scaffold and instructions', () => {
    const out = renderStateForSystemPrompt(emptyState(), { now: FIXED_NOW });

    expect(out).toContain('<user_profile>');
    expect(out).toContain('agency_id: ag-1');
    expect(out).toContain('preferences: {}');
    expect(out).toContain('<current_mode>agency</current_mode>');
    // No active refs, so the block is omitted.
    expect(out).not.toContain('<active_refs>');
    // Memories scaffold is always present.
    expect(out).toContain('<memories>');
    expect(out).toContain('GLOBAL_NOTES: (none yet)');
    // Instructions are always present.
    expect(out).toContain('<memory_instructions>');
    expect(out).toContain('PRECEDENCE');
  });
});

// ---------------------------------------------------------------------------
// Profile + global notes
// ---------------------------------------------------------------------------

describe('renderStateForSystemPrompt — profile + global notes', () => {
  it('renders preferences and memory lines', () => {
    const state = emptyState();
    state.profile.lead_id = 'lead_8a1f';
    state.profile.default_origin_city = 'Buenos Aires';
    state.profile.preferences = {
      budget_band: 'mid-high',
      pace: 'balanced',
      trip_style: ['beach', 'gastronomy'],
    };
    state.global_memory.notes = [
      note({
        text: 'Prefiere vuelos directos sobre escalas largas.',
        last_update_date: '2026-04-12T00:00:00.000Z',
        scope: 'planning',
      }),
      note({
        text: 'Acepta hasta +15% por hotel céntrico.',
        last_update_date: '2026-03-30T00:00:00.000Z',
        scope: 'pricing',
      }),
    ];

    const out = renderStateForSystemPrompt(state, { now: FIXED_NOW });
    expect(out).toContain('lead_id: lead_8a1f');
    expect(out).toContain('default_origin_city: Buenos Aires');
    expect(out).toContain('budget_band: mid-high');
    expect(out).toContain('trip_style: [beach, gastronomy]');
    expect(out).toContain('GLOBAL_NOTES (most recent first):');
    expect(out).toContain('[planning] 2026-04-12 Prefiere vuelos directos');
    expect(out).toContain('[pricing] 2026-03-30 Acepta hasta +15% por hotel céntrico.');
  });

  it('orders global notes by last_update_date desc', () => {
    const state = emptyState();
    state.global_memory.notes = [
      note({ text: 'older', last_update_date: '2026-01-01T00:00:00.000Z' }),
      note({ text: 'newest', last_update_date: '2026-04-30T00:00:00.000Z' }),
      note({ text: 'middle', last_update_date: '2026-03-01T00:00:00.000Z' }),
    ];
    const out = renderStateForSystemPrompt(state, { now: FIXED_NOW });
    const newestIdx = out.indexOf('newest');
    const middleIdx = out.indexOf('middle');
    const olderIdx = out.indexOf('older');
    expect(newestIdx).toBeGreaterThan(0);
    expect(newestIdx).toBeLessThan(middleIdx);
    expect(middleIdx).toBeLessThan(olderIdx);
  });
});

// ---------------------------------------------------------------------------
// Active refs
// ---------------------------------------------------------------------------

describe('renderStateForSystemPrompt — active refs', () => {
  it('renders the active_refs block in the documented format', () => {
    const state = emptyState();
    state.active_refs = [
      {
        type: 'plan',
        id: 'plan_abc123',
        summary1Line: '4 destinos, 12 días, mid-budget',
        // 2 minutes before FIXED_NOW
        lastUpdated: '2026-05-02T11:58:00.000Z',
      },
      {
        type: 'lead',
        id: 'lead_8a1f',
        summary1Line: 'Cliente recurrente, prefiere mid-range',
        // 5 minutes before FIXED_NOW
        lastUpdated: '2026-05-02T11:55:00.000Z',
      },
    ];

    const out = renderStateForSystemPrompt(state, { now: FIXED_NOW });
    expect(out).toContain('<active_refs>');
    expect(out).toContain(
      'plan:plan_abc123 — "4 destinos, 12 días, mid-budget" (updated 2min ago)',
    );
    expect(out).toContain(
      'lead:lead_8a1f — "Cliente recurrente, prefiere mid-range" (updated 5min ago)',
    );
  });
});

// ---------------------------------------------------------------------------
// Session memory injection
// ---------------------------------------------------------------------------

describe('renderStateForSystemPrompt — session memory', () => {
  it('omits session block when the flag is false', () => {
    const state = emptyState();
    state.session_memory.notes = [note({ text: 'should not appear' })];
    const out = renderStateForSystemPrompt(state, { now: FIXED_NOW });
    expect(out).not.toContain('Session memory (this conversation)');
    expect(out).not.toContain('should not appear');
  });

  it('includes the session block when the flag is true', () => {
    const state = emptyState();
    state.inject_session_memories_next_turn = true;
    state.session_memory.notes = [
      note({ text: 'durable session fact' }),
    ];
    const out = renderStateForSystemPrompt(state, { now: FIXED_NOW });
    expect(out).toContain('## Session memory (this conversation):');
    expect(out).toContain('durable session fact');
  });
});

// ---------------------------------------------------------------------------
// Token cap
// ---------------------------------------------------------------------------

describe('renderStateForSystemPrompt — token cap', () => {
  it('trims session memory then global memory to stay under the soft cap', () => {
    const state = emptyState();
    state.inject_session_memories_next_turn = true;

    // Each note text is near the 500-char limit so even after top-k trimming
    // (6 global + 8 session = 14 notes × ~480 chars ≈ 6720 chars of body),
    // we are well above the 4000-char soft cap.
    const big = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) =>
        note({
          text: `${prefix} ${'X'.repeat(450)} #${i}`,
          last_update_date: `2026-04-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
        }),
      );
    state.global_memory.notes = big(30, 'G');
    state.session_memory.notes = big(30, 'S');

    const out = renderStateForSystemPrompt(state, { now: FIXED_NOW });
    expect(out.length).toBeLessThanOrEqual(__testing.MAX_OUTPUT_CHARS);
    // Session memory should be the first thing dropped.
    expect(out).not.toContain('## Session memory (this conversation):');
  });

  it('keeps memories present (not zero) when only modest trimming is needed', () => {
    const state = emptyState();
    // 6 global notes well within budget — the renderer should not strip them.
    state.global_memory.notes = Array.from({ length: 6 }, (_, i) =>
      note({ text: `note ${i}`, last_update_date: '2026-04-30T00:00:00.000Z' }),
    );
    const out = renderStateForSystemPrompt(state, { now: FIXED_NOW });
    expect(out).toContain('GLOBAL_NOTES (most recent first):');
    expect(out).toContain('note 0');
  });
});
