/**
 * Tests for the agent-state-audit data-flow (Phase 8.6).
 *
 * Covers:
 *   - happy path: returns expected shape with state, messages, tool calls
 *   - 404: message_id not found
 *   - 403: conversation lookup denied (RLS-style empty result)
 *   - 400: missing query params
 *   - extractToolLoopFromMeta handles missing/malformed meta gracefully
 *
 * Spec: docs/architecture/context-engineering-spec.md (Phase 8.6 audit endpoint)
 */

import { describe, expect, it } from 'vitest';

import {
  buildAuditPayload,
  extractToolLoopFromMeta,
  resolveAnchorMessage,
} from '../audit.ts';
import type { EmiliaState } from '../../_shared/emiliaStateTypes.ts';

// ---------------------------------------------------------------------------
// In-memory supabase mock — supports the chained query API the code uses:
//   .from(table).select(cols).eq(...).maybeSingle()
//   .from(table).select(cols).eq(...).lt/gt(...).order(...).limit(N)
// ---------------------------------------------------------------------------

interface FixtureRow {
  table: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

interface FixtureSet {
  /** Rows returned by .from(table). */
  rows: FixtureRow[];
  /**
   * Optional per-table error to return from .single/.maybeSingle/.limit.
   * Lets us simulate RLS denial / DB errors deterministically.
   */
  errors?: Partial<Record<string, { message: string; code?: string }>>;
}

function makeSupabaseMock(fixtures: FixtureSet) {
  type FilterOp = { col: string; val: unknown; kind: 'eq' | 'lt' | 'gt' };

  function filter(rows: FixtureRow[], table: string, ops: FilterOp[]): FixtureRow[] {
    return rows
      .filter((r) => r.table === table)
      .filter((r) => {
        return ops.every((op) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const v = (r.data as any)[op.col];
          if (op.kind === 'eq') return v === op.val;
          if (op.kind === 'lt') return v < op.val;
          if (op.kind === 'gt') return v > op.val;
          return true;
        });
      });
  }

  function makeBuilder(table: string) {
    const ops: FilterOp[] = [];
    let orderField: string | null = null;
    let orderAsc = true;

    const builder = {
      select(_cols: string) {
        return builder;
      },
      eq(col: string, val: unknown) {
        ops.push({ col, val, kind: 'eq' });
        return builder;
      },
      lt(col: string, val: unknown) {
        ops.push({ col, val, kind: 'lt' });
        return builder;
      },
      gt(col: string, val: unknown) {
        ops.push({ col, val, kind: 'gt' });
        return builder;
      },
      order(field: string, opts: { ascending: boolean }) {
        orderField = field;
        orderAsc = opts.ascending;
        return builder;
      },
      limit(n: number) {
        const err = fixtures.errors?.[table];
        if (err) return Promise.resolve({ data: null, error: err });
        const matched = filter(fixtures.rows, table, ops).map((r) => r.data);
        if (orderField) {
          matched.sort((a, b) => {
            const av = a[orderField as string];
            const bv = b[orderField as string];
            if (av < bv) return orderAsc ? -1 : 1;
            if (av > bv) return orderAsc ? 1 : -1;
            return 0;
          });
        }
        return Promise.resolve({ data: matched.slice(0, n), error: null });
      },
      single() {
        const err = fixtures.errors?.[table];
        if (err) return Promise.resolve({ data: null, error: err });
        const matched = filter(fixtures.rows, table, ops);
        if (matched.length === 0) {
          return Promise.resolve({ data: null, error: { message: 'no rows', code: 'PGRST116' } });
        }
        return Promise.resolve({ data: matched[0].data, error: null });
      },
      maybeSingle() {
        const err = fixtures.errors?.[table];
        if (err) return Promise.resolve({ data: null, error: err });
        const matched = filter(fixtures.rows, table, ops);
        return Promise.resolve({ data: matched[0]?.data ?? null, error: null });
      },
    };
    return builder;
  }

  return {
    from(table: string) {
      return makeBuilder(table);
    },
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeState(overrides?: Partial<EmiliaState>): EmiliaState {
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
    meta: {
      conversation_id: 'conv-1',
      agency_id: 'ag-1',
      schema_version: 1,
      turn_count: 4,
    },
    ...(overrides ?? {}),
  };
}

function happyFixtures(): FixtureSet {
  return {
    rows: [
      // The anchor message: an assistant turn with toolLoop meta.
      {
        table: 'messages',
        data: {
          id: 'msg-anchor',
          conversation_id: 'conv-1',
          role: 'assistant',
          content: { text: 'cotización lista' },
          meta: {
            usage: { promptTokens: 1500, completionTokens: 250, totalTokens: 1750 },
            toolLoop: {
              enabled: true,
              iterations: 2,
              trace: [
                { tool: 'get_planner_state', latencyMs: 120 },
                { tool: 'get_quote', latencyMs: 80, error: 'timeout' },
              ],
            },
          },
          created_at: '2026-05-01T12:00:00.000Z',
        },
      },
      // Two messages BEFORE the anchor.
      {
        table: 'messages',
        data: {
          id: 'msg-before-1',
          conversation_id: 'conv-1',
          role: 'user',
          content: { text: 'cotizame eso' },
          meta: {},
          created_at: '2026-05-01T11:59:00.000Z',
        },
      },
      {
        table: 'messages',
        data: {
          id: 'msg-before-2',
          conversation_id: 'conv-1',
          role: 'assistant',
          content: { text: 'ok dame un seg' },
          meta: {},
          created_at: '2026-05-01T11:59:30.000Z',
        },
      },
      // One message AFTER the anchor.
      {
        table: 'messages',
        data: {
          id: 'msg-after-1',
          conversation_id: 'conv-1',
          role: 'user',
          content: { text: 'gracias' },
          meta: {},
          created_at: '2026-05-01T12:01:00.000Z',
        },
      },
      // Conversation row.
      {
        table: 'conversations',
        data: { id: 'conv-1', agency_id: 'ag-1' },
      },
      // Agent state row.
      {
        table: 'agent_states',
        data: { conversation_id: 'conv-1', state: makeState() },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// extractToolLoopFromMeta
// ---------------------------------------------------------------------------

describe('extractToolLoopFromMeta', () => {
  it('extracts trace + tokens from a populated meta', () => {
    const out = extractToolLoopFromMeta({
      usage: { promptTokens: 100, completionTokens: 30, totalTokens: 130 },
      toolLoop: {
        trace: [
          { tool: 'get_planner_state', latencyMs: 12 },
          { tool: 'get_quote', latencyMs: 80, error: 'timeout' },
        ],
      },
    });
    expect(out.tool_calls).toHaveLength(2);
    expect(out.tool_calls[0]).toEqual({ tool: 'get_planner_state', latencyMs: 12, error: undefined });
    expect(out.tool_calls[1]).toEqual({ tool: 'get_quote', latencyMs: 80, error: 'timeout' });
    expect(out.tokens).toEqual({ prompt: 100, completion: 30, total: 130 });
  });

  it('returns empty trace + null tokens when meta has no toolLoop', () => {
    const out = extractToolLoopFromMeta({});
    expect(out.tool_calls).toEqual([]);
    expect(out.tokens).toEqual({ prompt: null, completion: null, total: null });
  });

  it('returns empty trace + null tokens when meta is null', () => {
    const out = extractToolLoopFromMeta(null);
    expect(out.tool_calls).toEqual([]);
    expect(out.tokens).toEqual({ prompt: null, completion: null, total: null });
  });

  it('coerces malformed entries to safe defaults', () => {
    const out = extractToolLoopFromMeta({
      toolLoop: { trace: [{ tool: 42, latencyMs: 'abc' }] },
    });
    expect(out.tool_calls[0].tool).toBe('unknown');
    expect(out.tool_calls[0].latencyMs).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveAnchorMessage
// ---------------------------------------------------------------------------

describe('resolveAnchorMessage', () => {
  it('returns 400 when no query params provided', async () => {
    const supabase = makeSupabaseMock({ rows: [] });
    const url = new URL('https://example.com/agent-state-audit');
    const r = await resolveAnchorMessage(supabase, url);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.reason).toBe('missing_query_params');
    }
  });

  it('returns 400 when turn is invalid', async () => {
    const supabase = makeSupabaseMock({ rows: [] });
    const url = new URL('https://example.com/?conversation_id=conv-1&turn=abc');
    const r = await resolveAnchorMessage(supabase, url);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.reason).toBe('invalid_turn');
    }
  });

  it('returns 404 when message_id does not match any row', async () => {
    const supabase = makeSupabaseMock({ rows: [] });
    const url = new URL('https://example.com/?message_id=does-not-exist');
    const r = await resolveAnchorMessage(supabase, url);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(404);
      expect(r.reason).toBe('message_not_found');
    }
  });

  it('resolves by message_id when row exists', async () => {
    const supabase = makeSupabaseMock(happyFixtures());
    const url = new URL('https://example.com/?message_id=msg-anchor');
    const r = await resolveAnchorMessage(supabase, url);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.message.id).toBe('msg-anchor');
  });
});

// ---------------------------------------------------------------------------
// buildAuditPayload — happy + error paths
// ---------------------------------------------------------------------------

describe('buildAuditPayload — happy path', () => {
  it('returns the full audit payload by message_id', async () => {
    const supabase = makeSupabaseMock(happyFixtures());
    const url = new URL('https://example.com/?message_id=msg-anchor');
    const r = await buildAuditPayload(supabase, url);

    expect(r.ok).toBe(true);
    if (!r.ok) return; // type guard

    expect(r.status).toBe(200);
    expect(r.body.conversation_id).toBe('conv-1');
    expect(r.body.agency_id).toBe('ag-1');

    // State snapshot present.
    expect(r.body.state_snapshot).not.toBeNull();
    expect(r.body.state_snapshot?.meta.conversation_id).toBe('conv-1');

    // Messages: 2 before + anchor + 1 after = 4 total, in chronological order.
    expect(r.body.messages_around_turn).toHaveLength(4);
    expect(r.body.messages_around_turn[0].id).toBe('msg-before-1');
    expect(r.body.messages_around_turn[1].id).toBe('msg-before-2');
    expect(r.body.messages_around_turn[2].id).toBe('msg-anchor');
    expect(r.body.messages_around_turn[3].id).toBe('msg-after-1');

    // Tool calls + tokens recovered from meta.
    expect(r.body.tool_calls_for_turn).toHaveLength(2);
    expect(r.body.tool_calls_for_turn[0].tool).toBe('get_planner_state');
    expect(r.body.tokens_for_turn).toEqual({
      prompt: 1500,
      completion: 250,
      total: 1750,
    });

    // Rendered memory block contains the expected structural tags.
    expect(r.body.rendered_memory_block).toContain('<user_profile>');
    expect(r.body.rendered_memory_block).toContain('<current_mode>agency</current_mode>');
    expect(r.body.rendered_memory_block).toContain('<memory_instructions>');
  });

  it('returns null state_snapshot when no agent_states row exists', async () => {
    const f = happyFixtures();
    f.rows = f.rows.filter((r) => r.table !== 'agent_states');
    const supabase = makeSupabaseMock(f);
    const url = new URL('https://example.com/?message_id=msg-anchor');
    const r = await buildAuditPayload(supabase, url);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.state_snapshot).toBeNull();
    expect(r.body.rendered_memory_block).toBe('');
  });
});

describe('buildAuditPayload — errors', () => {
  it('returns 404 when message_id does not exist', async () => {
    const supabase = makeSupabaseMock({ rows: [] });
    const url = new URL('https://example.com/?message_id=nope');
    const r = await buildAuditPayload(supabase, url);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(404);
      expect(r.reason).toBe('message_not_found');
    }
  });

  it('returns 403 when the conversation lookup is denied (no row visible)', async () => {
    // Simulate RLS denial: the message row is visible (hand-crafted fixture)
    // but conversations is empty for this user.
    const f = happyFixtures();
    f.rows = f.rows.filter((r) => r.table !== 'conversations');
    const supabase = makeSupabaseMock(f);
    const url = new URL('https://example.com/?message_id=msg-anchor');
    const r = await buildAuditPayload(supabase, url);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.reason).toBe('forbidden');
    }
  });

  it('returns 403 when conversation lookup throws an error', async () => {
    const f = happyFixtures();
    f.errors = { conversations: { message: 'rls denied' } };
    const supabase = makeSupabaseMock(f);
    const url = new URL('https://example.com/?message_id=msg-anchor');
    const r = await buildAuditPayload(supabase, url);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.reason).toBe('forbidden');
    }
  });

  it('returns 400 when neither message_id nor (conversation_id+turn) provided', async () => {
    const supabase = makeSupabaseMock(happyFixtures());
    const url = new URL('https://example.com/agent-state-audit');
    const r = await buildAuditPayload(supabase, url);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.reason).toBe('missing_query_params');
    }
  });
});
