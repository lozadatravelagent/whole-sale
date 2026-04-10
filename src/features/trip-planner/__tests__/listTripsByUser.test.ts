/**
 * Unit tests for listTripsByUser — Phase 1.1.e
 *
 * Validates the B2C read path: query shape, filters, and error handling
 * without hitting a real database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock supabase client (chainable thenable builder)
// ---------------------------------------------------------------------------

const { supabaseMock, recorded, state, resetMock } = vi.hoisted(() => {
  const recorded: { method: string; args: unknown[] }[] = [];
  const state: { response: { data: unknown; error: unknown } } = {
    response: { data: [], error: null },
  };

  const builder: Record<string, unknown> = {};
  const chainable = ['select', 'eq', 'neq', 'order', 'limit'] as const;
  for (const m of chainable) {
    builder[m] = vi.fn((...args: unknown[]) => {
      recorded.push({ method: m, args });
      return builder;
    });
  }
  // Thenable: terminates the chain when awaited
  (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve(state.response);

  const supabaseMock = {
    from: vi.fn((table: string) => {
      recorded.push({ method: 'from', args: [table] });
      return builder;
    }),
  };

  const resetMock = () => {
    recorded.length = 0;
    state.response = { data: [], error: null };
    for (const m of chainable) (builder[m] as ReturnType<typeof vi.fn>).mockClear();
    supabaseMock.from.mockClear();
  };

  return { supabaseMock, recorded, state, resetMock };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

// Import AFTER mock
import { listTripsByUser } from '../services/tripService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasCall(method: string, ...args: unknown[]): boolean {
  return recorded.some(
    (c) =>
      c.method === method &&
      c.args.length === args.length &&
      c.args.every((a, i) => JSON.stringify(a) === JSON.stringify(args[i])),
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('listTripsByUser', () => {
  beforeEach(() => {
    resetMock();
  });

  // -------------------------------------------------------------------------
  // Case 1: Consumer — filters by owner_user_id + account_type='consumer'
  // -------------------------------------------------------------------------
  it('consumer: filters by owner_user_id, account_type=consumer, excludes archived, orders by updated_at desc', async () => {
    state.response = {
      data: [
        { id: 'trip-1', status: 'exploring', title: 'My Trip' },
        { id: 'trip-2', status: 'ready', title: 'Another' },
      ],
      error: null,
    };

    const result = await listTripsByUser('user-abc', 'consumer');

    expect(supabaseMock.from).toHaveBeenCalledWith('trips');
    expect(hasCall('eq', 'owner_user_id', 'user-abc')).toBe(true);
    expect(hasCall('eq', 'account_type', 'consumer')).toBe(true);
    expect(hasCall('neq', 'status', 'archived')).toBe(true);
    expect(hasCall('order', 'updated_at', { ascending: false })).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('trip-1');
  });

  // -------------------------------------------------------------------------
  // Case 2: Agent — filters by owner_user_id + account_type='agent'
  // -------------------------------------------------------------------------
  it('agent: filters by owner_user_id, account_type=agent (complementary to listTripsByAgency)', async () => {
    state.response = {
      data: [{ id: 'agent-trip-1', status: 'draft' }],
      error: null,
    };

    const result = await listTripsByUser('agent-user-1', 'agent');

    expect(hasCall('eq', 'owner_user_id', 'agent-user-1')).toBe(true);
    expect(hasCall('eq', 'account_type', 'agent')).toBe(true);
    expect(hasCall('neq', 'status', 'archived')).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('agent-trip-1');
  });

  // -------------------------------------------------------------------------
  // Case 3: Optional status filter
  // -------------------------------------------------------------------------
  it('applies filters.status as an additional eq()', async () => {
    state.response = { data: [], error: null };

    await listTripsByUser('user-1', 'consumer', { status: 'exploring' });

    expect(hasCall('eq', 'status', 'exploring')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Case 4: Optional limit filter
  // -------------------------------------------------------------------------
  it('applies filters.limit when provided', async () => {
    state.response = { data: [], error: null };

    await listTripsByUser('user-1', 'consumer', { limit: 5 });

    expect(hasCall('limit', 5)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Case 5: Error path returns [] (no throw)
  // -------------------------------------------------------------------------
  it('returns [] when supabase returns no data (error or empty)', async () => {
    state.response = { data: null, error: { message: 'rls denied' } };

    const result = await listTripsByUser('user-x', 'consumer');

    expect(result).toEqual([]);
  });
});
