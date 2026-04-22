// @vitest-environment jsdom
import React from 'react';
import { describe, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import ItineraryPanel from '../ItineraryPanel';
import type { TripPlannerState } from '@/features/trip-planner/types';

function makePopulatedState(): TripPlannerState {
  return {
    id: 'test-id',
    title: 'Viaje a Italia',
    summary: 'Un viaje por Italia',
    startDate: '2025-07-01',
    endDate: '2025-07-14',
    days: 14,
    travelers: { adults: 2, children: 0, infants: 0 },
    destinations: ['Roma', 'Florencia'],
    origin: 'Buenos Aires',
    segments: [
      {
        id: 'seg-1',
        city: 'Roma',
        country: 'Italia',
        nights: 7,
        order: 1,
        days: [
          {
            id: 'day-1',
            dayNumber: 1,
            city: 'Roma',
            title: 'Llegada',
            morning: [{ id: 'a1', title: 'Coliseo' }],
            afternoon: [],
            evening: [],
            restaurants: [],
          },
        ],
        contentStatus: 'complete',
      },
    ],
    interests: [],
    constraints: [],
    generalTips: [],
    generationMeta: { source: 'planner_agent', updatedAt: Date.now(), version: 1 },
  } as TripPlannerState;
}

// These tests verify that ItineraryPanel respects Rules of Hooks when
// plannerState transitions between null and a populated object.
// Before the fix in commit c852dd75, two useMemo calls lived below the
// early return — causing "Rendered more hooks than during the previous
// render" on the null→populated transition.
describe('ItineraryPanel — hooks order', () => {
  it('renders without error when plannerState transitions from null to populated', () => {
    const { rerender } = render(
      <ItineraryPanel plannerState={null} onExportPdf={vi.fn()} />
    );
    // If hooks order is violated, this rerender throws synchronously.
    rerender(
      <ItineraryPanel plannerState={makePopulatedState()} onExportPdf={vi.fn()} />
    );
  });

  it('renders without error when plannerState transitions from populated to null', () => {
    const { rerender } = render(
      <ItineraryPanel plannerState={makePopulatedState()} onExportPdf={vi.fn()} />
    );
    rerender(
      <ItineraryPanel plannerState={null} onExportPdf={vi.fn()} />
    );
  });

  it('renders without error when plannerState transitions between two populated shapes', () => {
    const stateA = makePopulatedState();
    const stateB = { ...makePopulatedState(), destinations: ['Venecia'] };
    const { rerender } = render(
      <ItineraryPanel plannerState={stateA} onExportPdf={vi.fn()} />
    );
    rerender(
      <ItineraryPanel plannerState={stateB} onExportPdf={vi.fn()} />
    );
  });
});
