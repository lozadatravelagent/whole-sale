/**
 * Unit tests for the retrieval tool catalog (Phase 3.2).
 *
 * Spec: docs/architecture/tool-catalog-spec.md §2
 *
 * Validates:
 *   - schema strictness for all 4 retrieval tools (§1.2)
 *   - happy-path queries return compact JSON
 *   - error/empty paths return model-friendly { error, detail }
 *   - executeRetrievalTool dispatches correctly + reports unknown tools
 */

import { describe, expect, it } from 'vitest';

import {
  executeRetrievalTool,
  extractDiscoveryCandidates,
  getRetrievalToolHandlers,
  getRetrievalToolSchemas,
  retrievalTools,
  type ToolContext,
} from '../functionTools.ts';
import { MAX_DISCOVERY_CANDIDATES } from '../emiliaStateTypes.ts';

// ---------------------------------------------------------------------------
// Mock Supabase — chainable query builder over an in-memory fixture map.
// ---------------------------------------------------------------------------

interface QueryState {
  table: string;
  filters: Array<{ col: string; val: unknown }>;
  orderBy?: { col: string; ascending: boolean };
  limit?: number;
}

function makeMockSupabase(
  fixtures: Record<string, Array<Record<string, unknown>>>,
) {
  function fromTable(table: string) {
    const state: QueryState = { table, filters: [] };

    function applyFilters(
      rows: Array<Record<string, unknown>>,
    ): Array<Record<string, unknown>> {
      let out = rows;
      for (const f of state.filters) {
        out = out.filter((r) => r[f.col] === f.val);
      }
      if (state.orderBy) {
        const { col, ascending } = state.orderBy;
        out = [...out].sort((a, b) => {
          const av = a[col] as string;
          const bv = b[col] as string;
          if (av === bv) return 0;
          return (ascending ? av < bv : av > bv) ? -1 : 1;
        });
      }
      if (state.limit !== undefined) out = out.slice(0, state.limit);
      return out;
    }

    const q = {
      select(_cols: string) {
        return q;
      },
      eq(col: string, val: unknown) {
        state.filters.push({ col, val });
        return q;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        state.orderBy = { col, ascending: opts?.ascending ?? true };
        return q;
      },
      limit(n: number) {
        state.limit = n;
        return q;
      },
      maybeSingle() {
        const rows = applyFilters(fixtures[table] ?? []);
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      single() {
        const rows = applyFilters(fixtures[table] ?? []);
        return Promise.resolve({
          data: rows[0] ?? null,
          error: rows[0] ? null : { message: 'no rows' },
        });
      },
      // The handlers `await` the builder directly when no terminal method is
      // called (e.g. `.order().limit()` then awaited). Make `q` thenable.
      then<TResult1, TResult2>(
        onfulfilled?:
          | ((v: { data: Array<Record<string, unknown>>; error: null }) => TResult1)
          | null,
        onrejected?: ((err: unknown) => TResult2) | null,
      ): Promise<TResult1 | TResult2> {
        return Promise.resolve({
          data: applyFilters(fixtures[table] ?? []),
          error: null,
        }).then(
          onfulfilled ?? undefined,
          onrejected ?? undefined,
        );
      },
    };
    return q;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: fromTable } as any;
}

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    supabase: makeMockSupabase({}),
    conversationId: 'conv-1',
    agencyId: 'agency-1',
    leadId: 'lead-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Schema strictness
// ---------------------------------------------------------------------------

describe('getRetrievalToolSchemas', () => {
  it('returns exactly the 4 retrieval tools', () => {
    const schemas = getRetrievalToolSchemas();
    expect(schemas).toHaveLength(4);
    expect(schemas.map((s) => s.function.name).sort()).toEqual([
      'discover_places',
      'get_lead_full_history',
      'get_planner_state',
      'get_recent_searches',
    ]);
  });

  it('every schema obeys strict-mode + description-quality rules', () => {
    for (const tool of getRetrievalToolSchemas()) {
      expect(tool.type).toBe('function');
      expect(tool.function.strict).toBe(true);

      const p = tool.function.parameters;
      expect(p.type).toBe('object');
      expect(p.additionalProperties).toBe(false);

      // ≥30 chars + Use when / Don't use for clauses (spec §1.1).
      expect(tool.function.description.length).toBeGreaterThanOrEqual(30);
      expect(tool.function.description).toContain('Use when:');
      expect(tool.function.description).toContain("Don't use for:");

      // Every property must be in `required` (spec §1.2).
      const props = Object.keys(p.properties);
      expect([...p.required].sort()).toEqual([...props].sort());
    }
  });
});

// ---------------------------------------------------------------------------
// get_planner_state
// ---------------------------------------------------------------------------

describe('get_planner_state', () => {
  it('returns compact plan on happy path', async () => {
    const ctx = makeCtx({
      supabase: makeMockSupabase({
        trips: [
          {
            id: 'plan-1',
            agency_id: 'agency-1',
            title: 'Sudamérica 12 días',
            status: 'draft',
            start_date: '2026-09-10',
            end_date: '2026-09-22',
            total_nights: 12,
            budget_level: 'mid',
            pace: 'balanced',
            travelers: { adults: 2, children: 0 },
            destination_cities: ['Buenos Aires', 'Rio'],
            destination_countries: ['AR', 'BR'],
            planner_state: {},
            lead_id: 'lead-1',
            updated_at: '2026-04-25T18:42:00Z',
          },
        ],
        trip_segments: [
          {
            trip_id: 'plan-1',
            segment_index: 0,
            city: 'Buenos Aires',
            country: 'AR',
            start_date: '2026-09-10',
            end_date: '2026-09-14',
            nights: 4,
            hotel_name: 'Alvear Art',
            hotel_price_per_night: 400,
            flight_price_per_person: null,
          },
        ],
      }),
    });

    const result = (await retrievalTools.get_planner_state.handler(
      { planner_id: 'plan-1' },
      ctx,
    )) as Record<string, unknown>;

    expect(result.planner_id).toBe('plan-1');
    expect(result.title).toBe('Sudamérica 12 días');
    expect(Array.isArray(result.destinations)).toBe(true);
    expect(Array.isArray(result.hotels)).toBe(true);
    expect((result.hotels as unknown[])).toHaveLength(1);
  });

  it('returns not_found when planner does not exist', async () => {
    const ctx = makeCtx({
      supabase: makeMockSupabase({ trips: [], trip_segments: [] }),
    });
    const result = (await retrievalTools.get_planner_state.handler(
      { planner_id: 'nope' },
      ctx,
    )) as Record<string, unknown>;
    expect(result.error).toBe('not_found');
  });

  it('returns bad_arguments when planner_id is missing', async () => {
    const ctx = makeCtx();
    const result = (await retrievalTools.get_planner_state.handler(
      {} as unknown as { planner_id: string },
      ctx,
    )) as Record<string, unknown>;
    expect(result.error).toBe('bad_arguments');
  });
});


// ---------------------------------------------------------------------------
// get_recent_searches
// ---------------------------------------------------------------------------

describe('get_recent_searches', () => {
  it('filters by meta.searchResults presence', async () => {
    const ctx = makeCtx({
      conversationId: 'conv-1',
      supabase: makeMockSupabase({
        messages: [
          {
            id: 'm1',
            conversation_id: 'conv-1',
            role: 'assistant',
            meta: {
              searchResults: {
                kind: 'hotels',
                params: { city: 'Rio', checkin: '2026-09-16' },
                top: [{ name: 'Copacabana Palace', rate_usd: 700 }],
              },
              searchKind: 'hotels',
            },
            created_at: '2026-04-25T18:30:00Z',
          },
          {
            id: 'm2',
            conversation_id: 'conv-1',
            role: 'assistant',
            meta: { status: 'sent' }, // no searchResults
            created_at: '2026-04-25T18:31:00Z',
          },
        ],
      }),
    });

    const result = (await retrievalTools.get_recent_searches.handler(
      { limit: 5, kind: null },
      ctx,
    )) as { searches: Array<Record<string, unknown>> };

    expect(result.searches).toHaveLength(1);
    expect(result.searches[0].kind).toBe('hotels');
    expect(result.searches[0].id).toBe('m1');
  });

  it('narrows results by kind filter', async () => {
    const ctx = makeCtx({
      supabase: makeMockSupabase({
        messages: [
          {
            id: 'm1',
            conversation_id: 'conv-1',
            meta: { searchResults: { kind: 'hotels' }, searchKind: 'hotels' },
            created_at: '2026-04-25T18:30:00Z',
          },
          {
            id: 'm2',
            conversation_id: 'conv-1',
            meta: { searchResults: { kind: 'flights' }, searchKind: 'flights' },
            created_at: '2026-04-25T18:31:00Z',
          },
        ],
      }),
    });
    const result = (await retrievalTools.get_recent_searches.handler(
      { limit: 10, kind: 'flights' },
      ctx,
    )) as { searches: Array<Record<string, unknown>> };

    expect(result.searches).toHaveLength(1);
    expect(result.searches[0].kind).toBe('flights');
  });

  it('returns empty array for empty conversation', async () => {
    const ctx = makeCtx({ supabase: makeMockSupabase({ messages: [] }) });
    const result = (await retrievalTools.get_recent_searches.handler(
      { limit: null, kind: null },
      ctx,
    )) as { searches: unknown[] };
    expect(result.searches).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// get_lead_full_history
// ---------------------------------------------------------------------------

describe('get_lead_full_history', () => {
  it('aggregates lead + ai_profile + trips', async () => {
    const ctx = makeCtx({
      supabase: makeMockSupabase({
        leads: [
          {
            id: 'lead-1',
            agency_id: 'agency-1',
            contact: { name: 'Carla Méndez', phone: '+5491100000' },
            trip: { destination: 'Asia', pax: 2 },
            status: 'active',
            created_at: '2023-02-11T00:00:00Z',
            updated_at: '2026-03-30T00:00:00Z',
          },
        ],
        lead_ai_profiles: [
          {
            lead_id: 'lead-1',
            agency_id: 'agency-1',
            profile_json: { preferences: { budget: 'mid-high' } },
            summary_text: 'Cliente recurrente, prefiere mid-high budget.',
            updated_at: '2026-04-01T00:00:00Z',
          },
        ],
        trips: [
          {
            id: 't-1',
            lead_id: 'lead-1',
            agency_id: 'agency-1',
            title: 'París + Roma',
            status: 'confirmed',
            start_date: '2024-05-01',
            end_date: '2024-05-15',
            destination_cities: ['Paris', 'Rome'],
            budget_level: 'mid',
            travelers: { adults: 2 },
            updated_at: '2024-05-15T00:00:00Z',
          },
        ],
      }),
    });

    const result = (await retrievalTools.get_lead_full_history.handler(
      { lead_id: 'lead-1' },
      ctx,
    )) as Record<string, unknown>;

    expect(result.lead_id).toBe('lead-1');
    expect(result.trip_count).toBe(1);
    expect((result.trips as unknown[])).toHaveLength(1);
    expect(result.ai_profile).toBeTruthy();
    expect(result.ai_summary).toBeTruthy();
  });

  it('returns not_found for unknown lead', async () => {
    const ctx = makeCtx({
      supabase: makeMockSupabase({
        leads: [],
        lead_ai_profiles: [],
        trips: [],
      }),
    });
    const result = (await retrievalTools.get_lead_full_history.handler(
      { lead_id: 'nope' },
      ctx,
    )) as Record<string, unknown>;
    expect(result.error).toBe('not_found');
  });
});

// ---------------------------------------------------------------------------
// executeRetrievalTool dispatcher
// ---------------------------------------------------------------------------

describe('executeRetrievalTool', () => {
  it('dispatches to the named tool', async () => {
    const ctx = makeCtx({ supabase: makeMockSupabase({ trips: [], trip_segments: [] }) });
    const result = (await executeRetrievalTool(
      'get_planner_state',
      { planner_id: 'nonexistent' },
      ctx,
    )) as Record<string, unknown>;
    expect(result.error).toBe('not_found');
  });

  it('returns unknown_tool for missing names with the available list', async () => {
    const ctx = makeCtx();
    const result = (await executeRetrievalTool(
      'search_flights',
      {},
      ctx,
    )) as Record<string, unknown>;
    expect(result.error).toBe('unknown_tool');
    expect(Array.isArray(result.available)).toBe(true);
  });
});

describe('getRetrievalToolHandlers', () => {
  it('returns one handler per schema, all callable', () => {
    const handlers = getRetrievalToolHandlers();
    const names = getRetrievalToolSchemas().map((s) => s.function.name);
    expect(Object.keys(handlers).sort()).toEqual([...names].sort());
    for (const name of names) {
      expect(typeof handlers[name]).toBe('function');
    }
  });
});

// ---------------------------------------------------------------------------
// extractDiscoveryCandidates — pure helper consumed by the index.ts wrapper
// to persist the top-N place candidates into EmiliaState.discovery_candidates
// after every successful discover_places call.
// ---------------------------------------------------------------------------

describe('extractDiscoveryCandidates', () => {
  // Compact place shape returned by the discover_places handler after Agent D trimming.
  function makePlace(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 'p_default',
      name: 'Place Default',
      category: 'restaurant',
      coordinates: { lat: -34.6, lng: -58.4 },
      rating: 4.5,
      address: 'Av. Corrientes 123',
      ...overrides,
    };
  }

  it('returns null for non-ok results', () => {
    expect(extractDiscoveryCandidates({ ok: false, error: 'no_places_found' })).toBeNull();
    expect(extractDiscoveryCandidates(null)).toBeNull();
    expect(extractDiscoveryCandidates({})).toBeNull();
    expect(extractDiscoveryCandidates({ ok: true })).toBeNull();
    expect(extractDiscoveryCandidates({ ok: true, places: [] })).toBeNull();
  });

  it('preserves order of the places array (UI-visible "the second one" must match)', () => {
    const result = {
      ok: true,
      places: [
        makePlace({ id: 'p1', name: 'First', category: 'sights' }),
        makePlace({ id: 'p2', name: 'Second', category: 'museum' }),
        makePlace({ id: 'p3', name: 'Third', category: 'restaurant' }),
      ],
    };
    const candidates = extractDiscoveryCandidates(result);
    expect(candidates).not.toBeNull();
    expect(candidates!.map((c) => c.placeId)).toEqual(['p1', 'p2', 'p3']);
    expect(candidates![1].name).toBe('Second');
  });

  it('caps the persisted slice at MAX_DISCOVERY_CANDIDATES', () => {
    const places = Array.from({ length: 25 }, (_, i) =>
      makePlace({ id: `p_${i}`, name: `Place ${i}` }),
    );
    const candidates = extractDiscoveryCandidates({ ok: true, places });
    expect(candidates!.length).toBe(MAX_DISCOVERY_CANDIDATES);
    expect(candidates![MAX_DISCOVERY_CANDIDATES - 1].placeId).toBe(`p_${MAX_DISCOVERY_CANDIDATES - 1}`);
  });

  it('drops entries missing required fields (id / name / coordinates / category)', () => {
    const result = {
      ok: true,
      places: [
        makePlace({ id: 'p_ok' }),
        makePlace({ id: '', name: 'no id' }),                        // dropped: empty id
        makePlace({ id: 'p_no_name', name: '' }),                    // dropped: empty name
        makePlace({ id: 'p_no_coords', coordinates: null }),         // dropped: no coordinates
        makePlace({ id: 'p_bad_lat', coordinates: { lat: null, lng: -58.4 } }), // dropped: lat null
        makePlace({ id: 'p_no_cat', category: null }),               // dropped: category null
        makePlace({ id: 'p_ok2' }),
      ],
    };
    const candidates = extractDiscoveryCandidates(result);
    expect(candidates!.map((c) => c.placeId)).toEqual(['p_ok', 'p_ok2']);
  });

  it('maps optional fields verbatim (rating / address)', () => {
    const result = {
      ok: true,
      places: [
        makePlace({ id: 'p1', rating: 4.7, address: 'Av. 9 de Julio 1000' }),
        makePlace({ id: 'p2', rating: undefined, address: undefined }),
      ],
    };
    const [c1, c2] = extractDiscoveryCandidates(result)!;
    expect(c1.rating).toBe(4.7);
    expect(c1.address).toBe('Av. 9 de Julio 1000');
    // Optional fields stay absent when source data is missing/empty.
    expect(c2.rating).toBeUndefined();
    expect(c2.address).toBeUndefined();
  });

  it('returns a candidate shape free of internal fields (no source, no userRatingsTotal, no photoUrl)', () => {
    const candidates = extractDiscoveryCandidates({
      ok: true,
      places: [makePlace({ id: 'p1' })],
    });
    const c = candidates![0];
    // Allow-list of the persistable fields (compact shape post Agent-D trimming).
    const allowedKeys = new Set(['placeId', 'name', 'lat', 'lng', 'category', 'rating', 'address']);
    for (const k of Object.keys(c)) {
      expect(allowedKeys.has(k)).toBe(true);
    }
  });
});
