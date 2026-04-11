/**
 * Unit tests for upsertTrip adapter — Phase 1.1.b
 *
 * Validates the accountType-aware signature, field mapping,
 * and pre-DB validation without hitting a real database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock supabase client
// ---------------------------------------------------------------------------

const { mockMaybeSingle, mockSingle, mockSelect, mockUpsert, mockEq, mockFrom } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockSingle = vi.fn();
  const mockSelect = vi.fn();
  const mockUpsert = vi.fn();
  const mockEq = vi.fn();
  const mockFrom = vi.fn();
  return { mockMaybeSingle, mockSingle, mockSelect, mockUpsert, mockEq, mockFrom };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

// Import AFTER mock
import { upsertTrip } from '../services/tripService';
import type { TripPlannerState } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const basePlannerState: TripPlannerState = {
  title: 'Test Trip',
  summary: null,
  segments: [],
  generationMeta: { source: 'chat', version: 1, updatedAt: new Date().toISOString(), uiPhase: 'ready', isDraft: false },
} as unknown as TripPlannerState;

const CONV_ID = 'conv-abc-123';
const USER_ID = 'user-abc-123';
const AGENCY_ID = 'agency-abc-123';
const TENANT_ID = 'tenant-abc-123';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the first argument (tripData) passed to supabase.from('trips').upsert() */
function getUpsertPayload() {
  return mockUpsert.mock.calls[0]?.[0];
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('upsertTrip adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({ data: { id: 'trip-1' }, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockUpsert.mockReturnValue({ select: mockSelect });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'trips') {
        return {
          select: vi.fn().mockReturnValue({ eq: mockEq }),
          upsert: mockUpsert,
        };
      }
      return {
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });
  });

  // -------------------------------------------------------------------------
  // Case 1: Agent default (accountType omitted)
  // -------------------------------------------------------------------------
  it('defaults to agent and sets owner_user_id, account_type, agency_id, tenant_id', async () => {
    const result = await upsertTrip(basePlannerState, CONV_ID, USER_ID, AGENCY_ID, TENANT_ID);

    expect(result).toBe('trip-1');
    const payload = getUpsertPayload();
    expect(payload).toMatchObject({
      owner_user_id: USER_ID,
      account_type: 'agent',
      agency_id: AGENCY_ID,
      tenant_id: TENANT_ID,
      created_by: USER_ID,
    });
  });

  // -------------------------------------------------------------------------
  // Case 2: Agent explicit
  // -------------------------------------------------------------------------
  it('agent explicit sets same fields as default', async () => {
    await upsertTrip(basePlannerState, CONV_ID, USER_ID, AGENCY_ID, TENANT_ID, 'agent');

    const payload = getUpsertPayload();
    expect(payload).toMatchObject({
      owner_user_id: USER_ID,
      account_type: 'agent',
      agency_id: AGENCY_ID,
      tenant_id: TENANT_ID,
    });
  });

  // -------------------------------------------------------------------------
  // Case 3: Consumer valid
  // -------------------------------------------------------------------------
  it('consumer sets owner_user_id and nulls agency_id/tenant_id', async () => {
    await upsertTrip(basePlannerState, CONV_ID, USER_ID, null, null, 'consumer');

    const payload = getUpsertPayload();
    expect(payload).toMatchObject({
      owner_user_id: USER_ID,
      account_type: 'consumer',
      agency_id: null,
      tenant_id: null,
      created_by: USER_ID,
    });
  });

  // -------------------------------------------------------------------------
  // Case 4: Agent without agency (must fail before DB)
  // -------------------------------------------------------------------------
  it('agent without agencyId returns null without calling supabase', async () => {
    const result = await upsertTrip(basePlannerState, CONV_ID, USER_ID, null, null, 'agent');

    expect(result).toBeNull();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 5: accountType undefined simulates prod without D12
  // -------------------------------------------------------------------------
  it('undefined accountType defaults to agent (prod without D12 compat)', async () => {
    // Simulate call from usePlannerState where accountType might be undefined
    // because AuthUser.accountType falls back to 'agent' via || 'agent',
    // but even if the caller omits it entirely, the default param handles it.
    const result = await upsertTrip(basePlannerState, CONV_ID, USER_ID, AGENCY_ID, TENANT_ID, undefined as unknown as 'agent' | 'consumer');

    expect(result).toBe('trip-1');
    const payload = getUpsertPayload();
    expect(payload).toMatchObject({
      owner_user_id: USER_ID,
      account_type: 'agent',
      agency_id: AGENCY_ID,
      tenant_id: TENANT_ID,
    });
  });

  // -------------------------------------------------------------------------
  // Case 6: Consumer with residual agencyId gets it nulled
  // -------------------------------------------------------------------------
  it('consumer with agencyId passed gets it nulled in tripData', async () => {
    await upsertTrip(basePlannerState, CONV_ID, USER_ID, AGENCY_ID, TENANT_ID, 'consumer');

    const payload = getUpsertPayload();
    expect(payload.agency_id).toBeNull();
    expect(payload.tenant_id).toBeNull();
    expect(payload.account_type).toBe('consumer');
    expect(payload.owner_user_id).toBe(USER_ID);
  });

  // -------------------------------------------------------------------------
  // Case 7: Consumer with empty segments → status='exploring' (1.1.f)
  // -------------------------------------------------------------------------
  it('consumer with empty segments sets status=exploring', async () => {
    await upsertTrip(basePlannerState, CONV_ID, USER_ID, null, null, 'consumer');

    const payload = getUpsertPayload();
    expect(payload.status).toBe('exploring');
  });

  // -------------------------------------------------------------------------
  // Case 8: Agent with empty segments → status='draft' (B2B regression)
  // -------------------------------------------------------------------------
  it('agent with empty segments sets status=draft (B2B regression)', async () => {
    await upsertTrip(basePlannerState, CONV_ID, USER_ID, AGENCY_ID, TENANT_ID, 'agent');

    const payload = getUpsertPayload();
    expect(payload.status).toBe('draft');
  });
});
