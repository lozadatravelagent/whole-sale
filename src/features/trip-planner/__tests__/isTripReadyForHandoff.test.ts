import { describe, it, expect } from 'vitest';
import { isTripReadyForHandoff } from '../handoffReadiness';
import type { TripPlannerState } from '../types';

function makeState(overrides: Partial<TripPlannerState> = {}): TripPlannerState {
  const base: TripPlannerState = {
    id: 'trip-1',
    title: 'Viaje a París',
    summary: '',
    startDate: '2026-07-15',
    endDate: '2026-07-22',
    days: 7,
    travelers: { adults: 2, children: 0, infants: 0 },
    interests: [],
    constraints: [],
    destinations: ['París'],
    segments: [
      {
        id: 'seg-1',
        city: 'París',
        order: 0,
        hotelPlan: {} as never,
        days: [],
      } as never,
    ],
    generalTips: [],
    generationMeta: {
      source: 'chat',
      updatedAt: '2026-04-11T12:00:00Z',
      version: 1,
      uiPhase: 'ready',
      isDraft: false,
    },
  };
  return { ...base, ...overrides } as TripPlannerState;
}

describe('isTripReadyForHandoff', () => {
  it('returns false for null / undefined', () => {
    expect(isTripReadyForHandoff(null)).toBe(false);
    expect(isTripReadyForHandoff(undefined)).toBe(false);
  });

  it('returns true for a complete, ready, non-draft trip', () => {
    expect(isTripReadyForHandoff(makeState())).toBe(true);
  });

  it('returns false when destinations array is empty', () => {
    expect(isTripReadyForHandoff(makeState({ destinations: [] }))).toBe(false);
  });

  it('returns false when destinations contains only whitespace', () => {
    expect(isTripReadyForHandoff(makeState({ destinations: ['   ', ''] }))).toBe(false);
  });

  it('returns false when there are no segments', () => {
    expect(isTripReadyForHandoff(makeState({ segments: [] }))).toBe(false);
  });

  it('returns false when a segment has an empty city', () => {
    const state = makeState({
      segments: [
        { id: 'seg-1', city: '', order: 0, hotelPlan: {} as never, days: [] } as never,
      ],
    });
    expect(isTripReadyForHandoff(state)).toBe(false);
  });

  it('returns false when there are no concrete dates and no flexible flag', () => {
    expect(
      isTripReadyForHandoff(
        makeState({ startDate: undefined, endDate: undefined, isFlexibleDates: false })
      )
    ).toBe(false);
  });

  it('accepts flexible dates even without startDate/endDate', () => {
    expect(
      isTripReadyForHandoff(
        makeState({
          startDate: undefined,
          endDate: undefined,
          isFlexibleDates: true,
          flexibleMonth: 'julio',
          flexibleYear: 2026,
        })
      )
    ).toBe(true);
  });

  it('returns false when there are zero adult travelers', () => {
    expect(
      isTripReadyForHandoff(makeState({ travelers: { adults: 0, children: 2, infants: 0 } }))
    ).toBe(false);
  });

  it('returns false when uiPhase !== "ready" (still generating)', () => {
    expect(
      isTripReadyForHandoff(
        makeState({
          generationMeta: {
            source: 'chat',
            updatedAt: '2026-04-11T12:00:00Z',
            version: 1,
            uiPhase: 'draft_generating',
            isDraft: false,
          },
        })
      )
    ).toBe(false);
  });

  it('returns false when isDraft === true', () => {
    expect(
      isTripReadyForHandoff(
        makeState({
          generationMeta: {
            source: 'draft',
            updatedAt: '2026-04-11T12:00:00Z',
            version: 1,
            uiPhase: 'ready',
            isDraft: true,
          },
        })
      )
    ).toBe(false);
  });
});
