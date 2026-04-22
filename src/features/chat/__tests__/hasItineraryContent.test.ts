import { describe, it, expect } from 'vitest';
import { hasItineraryContent } from '../utils/hasItineraryContent';
import type { TripPlannerState } from '@/features/trip-planner/types';

function makeEmpty(overrides: Partial<TripPlannerState> = {}): TripPlannerState {
  const base: TripPlannerState = {
    id: 'trip-1',
    title: '',
    summary: '',
    days: 0,
    travelers: { adults: 0, children: 0, infants: 0 },
    interests: [],
    constraints: [],
    destinations: [],
    segments: [],
    generalTips: [],
    generationMeta: {
      source: 'chat',
      updatedAt: '2026-04-11T12:00:00Z',
      version: 0,
      uiPhase: 'template',
      isDraft: true,
    },
  };
  return { ...base, ...overrides };
}

describe('hasItineraryContent', () => {
  it('returns false for null / undefined', () => {
    expect(hasItineraryContent(null)).toBe(false);
    expect(hasItineraryContent(undefined)).toBe(false);
  });

  it('returns false for a completely empty planner', () => {
    expect(hasItineraryContent(makeEmpty())).toBe(false);
  });

  it('returns true when destinations has at least one non-empty string', () => {
    expect(hasItineraryContent(makeEmpty({ destinations: ['París'] }))).toBe(true);
  });

  it('ignores whitespace-only destinations', () => {
    expect(hasItineraryContent(makeEmpty({ destinations: ['   ', ''] }))).toBe(false);
  });

  it('returns true when segments has at least one with a city', () => {
    const state = makeEmpty({
      segments: [
        { id: 's1', city: 'Roma', order: 0, hotelPlan: {} as never, days: [] } as never,
      ],
    });
    expect(hasItineraryContent(state)).toBe(true);
  });

  it('returns true when only startDate is set', () => {
    expect(hasItineraryContent(makeEmpty({ startDate: '2026-07-15' }))).toBe(true);
  });

  it('returns true when isFlexibleDates is true', () => {
    expect(hasItineraryContent(makeEmpty({ isFlexibleDates: true }))).toBe(true);
  });

  it('returns true when only budgetLevel is set', () => {
    expect(hasItineraryContent(makeEmpty({ budgetLevel: 'mid' as never }))).toBe(true);
  });

  it('returns true when only pace is set', () => {
    expect(hasItineraryContent(makeEmpty({ pace: 'relaxed' as never }))).toBe(true);
  });

  it('returns true when notes has at least one non-empty entry', () => {
    expect(hasItineraryContent(makeEmpty({ notes: ['Queremos zona centro'] }))).toBe(true);
  });

  it('ignores whitespace-only notes', () => {
    expect(hasItineraryContent(makeEmpty({ notes: ['   ', ''] }))).toBe(false);
  });
});
