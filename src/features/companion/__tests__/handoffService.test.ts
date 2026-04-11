/**
 * Unit tests for handoffService — Paso 2 human handoff modal.
 *
 * Covers the pure builders (buildHandoffDraftFromPlanner,
 * buildHandoffLeadPayload) and the insert flow (requestHumanHandoff)
 * with a mocked supabase client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock supabase client
// ---------------------------------------------------------------------------

const { supabaseMock, state } = vi.hoisted(() => {
  const state: {
    tripLookupResponse: { data: unknown; error: unknown };
    insertResponse: { data: unknown; error: unknown };
    lastInsertPayload: unknown;
  } = {
    tripLookupResponse: { data: { id: 'trip-123' }, error: null },
    insertResponse: { data: { id: 'lead-456' }, error: null },
    lastInsertPayload: null,
  };

  const tripsBuilder = {
    select: vi.fn(() => tripsBuilder),
    eq: vi.fn(() => tripsBuilder),
    maybeSingle: vi.fn(() => Promise.resolve(state.tripLookupResponse)),
  };

  const leadsInsertBuilder = {
    select: vi.fn(() => leadsInsertBuilder),
    single: vi.fn(() => Promise.resolve(state.insertResponse)),
  };

  const leadsBuilder = {
    insert: vi.fn((payload: unknown) => {
      state.lastInsertPayload = payload;
      return leadsInsertBuilder;
    }),
  };

  const supabaseMock = {
    from: vi.fn((table: string) => {
      if (table === 'trips') return tripsBuilder;
      if (table === 'leads') return leadsBuilder;
      return {};
    }),
  };

  return { supabaseMock, state };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

// Import after mock
import {
  buildHandoffDraftFromPlanner,
  buildHandoffLeadPayload,
  requestHumanHandoff,
} from '../services/handoffService';
import type { TripPlannerState } from '@/features/trip-planner/types';
import type { HandoffFormData } from '../utils/handoffFormSchema';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePlanner(overrides: Partial<TripPlannerState> = {}): TripPlannerState {
  return {
    id: 'trip-1',
    title: 'Viaje a París',
    summary: '',
    startDate: '2026-07-15',
    endDate: '2026-07-22',
    days: 7,
    travelers: { adults: 2, children: 1, infants: 0 },
    interests: [],
    constraints: [],
    destinations: ['París', 'Roma'],
    origin: 'Buenos Aires',
    budgetLevel: 'mid' as never,
    segments: [
      { id: 's1', city: 'París', order: 0, hotelPlan: {} as never, days: [] } as never,
      { id: 's2', city: 'Roma', order: 1, hotelPlan: {} as never, days: [] } as never,
    ],
    generalTips: [],
    generationMeta: {
      source: 'chat',
      updatedAt: '2026-04-11T12:00:00Z',
      version: 1,
      uiPhase: 'ready',
      isDraft: false,
    },
    ...overrides,
  } as TripPlannerState;
}

const validFormData: HandoffFormData = {
  name: 'Ana Pérez',
  email: 'ana@example.com',
  phone: '+54 11 5555-1234',
  origin: 'Buenos Aires',
  startDate: '2026-07-15',
  endDate: '2026-07-22',
  adults: 2,
  children: 1,
  budgetLevel: 'mid',
  comment: 'Preferimos hoteles 4 estrellas en el centro.',
} as HandoffFormData;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('buildHandoffDraftFromPlanner', () => {
  it('prefills from plannerState + user email', () => {
    const draft = buildHandoffDraftFromPlanner(makePlanner(), { email: 'consumer@example.com' });

    expect(draft).toMatchObject({
      email: 'consumer@example.com',
      origin: 'Buenos Aires',
      startDate: '2026-07-15',
      endDate: '2026-07-22',
      adults: 2,
      children: 1,
      budgetLevel: 'mid',
    });
    expect(draft.name).toBe('');
    expect(draft.phone).toBe('');
    expect(draft.comment).toBe('');
  });

  it('returns safe empty defaults when plannerState is null', () => {
    const draft = buildHandoffDraftFromPlanner(null, { email: 'consumer@example.com' });

    expect(draft.adults).toBeGreaterThanOrEqual(1);
    expect(draft.origin).toBe('');
    expect(draft.startDate).toBe('');
    expect(draft.endDate).toBe('');
    expect(draft.budgetLevel).toBeUndefined();
  });

  it('coerces adults to at least 1 even when planner has 0', () => {
    const planner = makePlanner({ travelers: { adults: 0, children: 0, infants: 0 } });
    const draft = buildHandoffDraftFromPlanner(planner, { email: null });
    expect(draft.adults).toBe(1);
  });
});

describe('buildHandoffLeadPayload', () => {
  it('produces a fully-shaped payload for consumer insert (agency/tenant null)', () => {
    const payload = buildHandoffLeadPayload(validFormData, makePlanner(), 'conv-abc', 'trip-123');

    expect(payload).toMatchObject({
      conversation_id: 'conv-abc',
      trip_id: 'trip-123',
      agency_id: null,
      tenant_id: null,
      assigned_user_id: null,
      status: 'new',
    });
  });

  it('normalizes contact fields (trim whitespace)', () => {
    const messyForm: HandoffFormData = {
      ...validFormData,
      name: '  Ana Pérez  ',
      email: '  ana@example.com  ',
      phone: '  +54 11 5555-1234  ',
    };
    const payload = buildHandoffLeadPayload(messyForm, makePlanner(), 'conv-abc', null);

    expect(payload.contact).toEqual({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      phone: '+54 11 5555-1234',
    });
  });

  it('denormalizes trip snapshot into trip JSONB', () => {
    const payload = buildHandoffLeadPayload(validFormData, makePlanner(), 'conv-abc', 'trip-123');

    expect(payload.trip).toMatchObject({
      type: 'b2c_handoff',
      origin: 'Buenos Aires',
      destinations: ['París', 'Roma'],
      primary_city: 'París',
      start_date: '2026-07-15',
      end_date: '2026-07-22',
      adults: 2,
      children: 1,
      budget_level: 'mid',
    });
  });

  it('includes user comment + summarizePlannerForChat in description', () => {
    const payload = buildHandoffLeadPayload(validFormData, makePlanner(), 'conv-abc', 'trip-123');

    // User comment appears at the top
    expect(payload.description).toContain('hoteles 4 estrellas');
    // Separator
    expect(payload.description).toContain('---');
    // summarizePlannerForChat output mentions destinations
    expect(payload.description.toLowerCase()).toContain('parís');
  });

  it('handles empty comment gracefully (description = summary only)', () => {
    const payload = buildHandoffLeadPayload(
      { ...validFormData, comment: '' } as HandoffFormData,
      makePlanner(),
      'conv-abc',
      null
    );

    expect(payload.description).not.toContain('---');
    expect(payload.description.length).toBeGreaterThan(0);
  });

  it('sets trip_id to null when no trip row linked', () => {
    const payload = buildHandoffLeadPayload(validFormData, makePlanner(), 'conv-abc', null);
    expect(payload.trip_id).toBeNull();
  });

  it('falls back to first destination when no segments exist', () => {
    const planner = makePlanner({ segments: [] });
    const payload = buildHandoffLeadPayload(validFormData, planner, 'conv-abc', null);
    expect(payload.trip.primary_city).toBe('París');
  });
});

describe('requestHumanHandoff', () => {
  beforeEach(() => {
    state.tripLookupResponse = { data: { id: 'trip-123' }, error: null };
    state.insertResponse = { data: { id: 'lead-456' }, error: null };
    state.lastInsertPayload = null;
    supabaseMock.from.mockClear();
  });

  it('inserts a lead with linked trip_id and returns the lead id', async () => {
    const result = await requestHumanHandoff(
      validFormData,
      makePlanner(),
      'conv-abc',
      { email: 'consumer@example.com' }
    );

    expect(result).toEqual({ leadId: 'lead-456' });
    expect(supabaseMock.from).toHaveBeenCalledWith('trips');
    expect(supabaseMock.from).toHaveBeenCalledWith('leads');
    expect((state.lastInsertPayload as { trip_id: string }).trip_id).toBe('trip-123');
  });

  it('still inserts when trip lookup returns no row (trip_id = null)', async () => {
    state.tripLookupResponse = { data: null, error: null };

    const result = await requestHumanHandoff(
      validFormData,
      makePlanner(),
      'conv-abc',
      { email: 'consumer@example.com' }
    );

    expect(result).toEqual({ leadId: 'lead-456' });
    expect((state.lastInsertPayload as { trip_id: string | null }).trip_id).toBeNull();
  });

  it('returns null when the insert errors', async () => {
    state.insertResponse = { data: null, error: { message: 'rls denied' } };

    const result = await requestHumanHandoff(
      validFormData,
      makePlanner(),
      'conv-abc',
      { email: 'consumer@example.com' }
    );

    expect(result).toBeNull();
  });
});
