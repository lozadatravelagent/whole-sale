import { describe, it, expect } from 'vitest';
import { applyStructuralModification } from '../helpers';
import type { TripPlannerState, PlannerSegment } from '../types';

function makeSegment(id: string, city: string, nights = 3): PlannerSegment {
  return {
    id,
    city,
    nights,
    order: 0,
    days: [],
    hotelPlan: {
      city,
      searchStatus: 'idle',
      hotelRecommendations: [],
    },
  } as unknown as PlannerSegment;
}

function makeState(cities: string[], nightsPerCity = 3): TripPlannerState {
  return {
    id: 'test-state',
    title: 'Test Trip',
    summary: '',
    days: cities.length * nightsPerCity,
    destinations: cities,
    interests: [],
    constraints: [],
    generalTips: [],
    travelers: { adults: 2, children: 0, infants: 0 },
    segments: cities.map((city, i) => ({
      ...makeSegment(`seg-${i}`, city, nightsPerCity),
      order: i,
    })),
    generationMeta: { source: 'system' as const, updatedAt: new Date().toISOString(), version: 1 },
  } as TripPlannerState;
}

describe('applyStructuralModification — reorder', () => {
  it('reorders segments correctly', () => {
    const state = makeState(['Madrid', 'París', 'Roma']);
    const result = applyStructuralModification(state, {
      action: 'reorder_segments',
      newSegmentOrder: ['seg-2', 'seg-0', 'seg-1'],
    });
    expect(result.segments.map(s => s.city)).toEqual(['Roma', 'Madrid', 'París']);
  });

  it('preserves segment data after reorder', () => {
    const state = makeState(['Madrid', 'París']);
    state.segments[0].nights = 5;
    const result = applyStructuralModification(state, {
      action: 'reorder_segments',
      newSegmentOrder: ['seg-1', 'seg-0'],
    });
    expect(result.segments[1].nights).toBe(5);
    expect(result.segments[1].city).toBe('Madrid');
  });

  it('updates destinations array', () => {
    const state = makeState(['Madrid', 'París', 'Roma']);
    const result = applyStructuralModification(state, {
      action: 'reorder_segments',
      newSegmentOrder: ['seg-2', 'seg-0', 'seg-1'],
    });
    expect(result.destinations).toEqual(['Roma', 'Madrid', 'París']);
  });
});

describe('applyStructuralModification — extend', () => {
  it('extend +1 → segment has one more night', () => {
    const state = makeState(['Madrid']);
    const result = applyStructuralModification(state, {
      action: 'extend_segment',
      targetSegmentId: 'seg-0',
      deltaNights: 1,
    });
    expect(result.segments[0].nights).toBe(4);
  });

  it('updates total days after extend', () => {
    const state = makeState(['Madrid', 'París']);
    const result = applyStructuralModification(state, {
      action: 'extend_segment',
      targetSegmentId: 'seg-0',
      deltaNights: 2,
    });
    expect(result.days).toBe(8); // 5 + 3
  });
});

describe('applyStructuralModification — shrink', () => {
  it('shrink -1 → segment has one less night', () => {
    const state = makeState(['Madrid']);
    const result = applyStructuralModification(state, {
      action: 'shrink_segment',
      targetSegmentId: 'seg-0',
      deltaNights: -1,
    });
    expect(result.segments[0].nights).toBe(2);
  });

  it('shrink to 0 → minimum 1 night', () => {
    const state = makeState(['Madrid'], 1);
    const result = applyStructuralModification(state, {
      action: 'shrink_segment',
      targetSegmentId: 'seg-0',
      deltaNights: -5,
    });
    expect(result.segments[0].nights).toBeGreaterThanOrEqual(1);
  });
});
