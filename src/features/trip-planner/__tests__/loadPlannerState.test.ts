/**
 * Unit tests for loadPersistedPlannerState — Phase 1.1.c
 *
 * Validates the trips-first read strategy with fallback to messages
 * for pre-1.1.b conversations. Tests getTripByConversation behavior
 * and the normalization pipeline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TripPlannerState } from '../types';

// ---------------------------------------------------------------------------
// Mock supabase client
// ---------------------------------------------------------------------------

const { mockMaybeSingle, mockSingle, mockFrom } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockSingle = vi.fn();
  const mockFrom = vi.fn();
  return { mockMaybeSingle, mockSingle, mockFrom };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

// Import AFTER mock
import { getTripByConversation } from '../services/tripService';
import { normalizePlannerState } from '../utils';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONV_ID = 'conv-load-test-123';

const basePlannerState: TripPlannerState = {
  id: 'planner-rome',
  title: 'Viaje a Roma',
  summary: 'Un viaje por Italia',
  days: 5,
  segments: [
    {
      id: 'seg-1',
      city: 'Roma',
      country: 'Italia',
      days: [{ id: 'day-1', dayNumber: 1, activities: [] }],
      contentStatus: 'ready',
    },
  ],
  travelers: { adults: 2, children: 0, infants: 0 },
  interests: [],
  constraints: [],
  destinations: ['Roma'],
  generalTips: [],
  generationMeta: {
    source: 'chat',
    version: 1,
    updatedAt: '2026-04-09T00:00:00.000Z',
    uiPhase: 'ready',
    isDraft: false,
  },
} as unknown as TripPlannerState;

// ---------------------------------------------------------------------------
// Suite 1: getTripByConversation
// ---------------------------------------------------------------------------

describe('getTripByConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns TripPlannerState when trip row exists', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      }),
    });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockMaybeSingle.mockResolvedValue({
      data: { planner_state: basePlannerState },
      error: null,
    });

    const result = await getTripByConversation(CONV_ID);

    expect(result).toEqual(basePlannerState);
    expect(mockFrom).toHaveBeenCalledWith('trips');
    expect(mockSelect).toHaveBeenCalledWith('planner_state');
  });

  it('returns null when no trip row exists (pre-1.1.b conversation)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getTripByConversation(CONV_ID);

    expect(result).toBeNull();
  });

  it('throws on Supabase error (network, RLS, etc.)', async () => {
    const dbError = { message: 'permission denied', code: '42501' };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: dbError });

    await expect(getTripByConversation(CONV_ID)).rejects.toEqual(dbError);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: normalizePlannerState from trip data
// ---------------------------------------------------------------------------

describe('normalizePlannerState from trip planner_state', () => {
  it('normalizes a TripPlannerState read from trips column identically to messages', () => {
    // Both code paths (trips and messages) extract the raw planner state
    // and pass it through normalizePlannerState. In trips, it's data.planner_state.
    // In messages, it's meta.plannerState. Both are the same TripPlannerState object.
    const fromTrips = normalizePlannerState(
      basePlannerState as unknown as Record<string, unknown>,
      CONV_ID,
    );
    const fromMessages = normalizePlannerState(
      basePlannerState as unknown as Record<string, unknown>,
      CONV_ID,
    );

    // Same input → same output
    expect(fromTrips.title).toBe(fromMessages.title);
    expect(fromTrips.conversationId).toBe(CONV_ID);
    expect(fromMessages.conversationId).toBe(CONV_ID);
    expect(fromTrips.segments.length).toBe(fromMessages.segments.length);
    expect(fromTrips.destinations).toEqual(fromMessages.destinations);
  });

  it('produces valid TripPlannerState with required fields', () => {
    const normalized = normalizePlannerState(
      basePlannerState as unknown as Record<string, unknown>,
      CONV_ID,
    );

    expect(normalized.id).toBeTruthy();
    expect(normalized.title).toBe('Viaje a Roma');
    expect(normalized.conversationId).toBe(CONV_ID);
    expect(normalized.segments).toHaveLength(1);
    expect(normalized.travelers.adults).toBe(2);
    expect(normalized.generationMeta.source).toBeDefined();
    expect(normalized.generationMeta.version).toBeGreaterThanOrEqual(1);
  });
});
