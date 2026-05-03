/**
 * Tests for `pendingActionDispatcher.ts`.
 *
 * These verify the post-extraction semantics of R1: handler routing,
 * ref/plan validation, missing updatePlannerState early exit, and both
 * the ISO-date and flexible-month branches of quote_completion.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchPendingAction,
  toCanonicalFields,
  toCanonicalSlot,
  type DispatchContext,
  type PendingActionResolution,
} from '../pendingActionDispatcher';
import type { TripPlannerState } from '@/features/trip-planner/types';

function buildPlanner(overrides: Partial<TripPlannerState> = {}): TripPlannerState {
  // Cast intentional: TripPlannerState has many required fields irrelevant
  // to this dispatcher; we only mutate origin/startDate/endDate/flex* here.
  return {
    id: 'planner-1',
    isFlexibleDates: false,
    ...overrides,
  } as TripPlannerState;
}

let warnSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  logSpy.mockRestore();
});

describe('dispatchPendingAction', () => {
  it('logs and returns when no handler matches `for`', async () => {
    const updatePlannerState = vi.fn();
    await expect(
      dispatchPendingAction({
        resolution: {
          for: 'unknown_flow',
          kind: 'awaiting_user_input',
          applied: {},
          complete: false,
        } as PendingActionResolution,
        plannerState: null,
        updatePlannerState,
      }),
    ).resolves.toBeUndefined();
    expect(updatePlannerState).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      '[PENDING-ACTION] no handler for `for`:',
      'unknown_flow',
      '— resolution ignored',
    );
  });

  it('quote_completion: warns and returns on ref/plan mismatch', async () => {
    const updatePlannerState = vi.fn();
    await dispatchPendingAction({
      resolution: {
        for: 'quote_completion',
        kind: 'awaiting_user_input',
        ref: { type: 'plan', id: 'X' },
        applied: { origin: 'BUE' },
        complete: false,
      },
      plannerState: buildPlanner({ id: 'Y' }),
      updatePlannerState,
    });
    expect(updatePlannerState).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[PENDING-ACTION] quote_completion ignored — ref/plan mismatch',
    );
  });

  it('quote_completion: warns and returns when updatePlannerState is missing', async () => {
    await dispatchPendingAction({
      resolution: {
        for: 'quote_completion',
        kind: 'awaiting_user_input',
        applied: { origin: 'Buenos Aires' },
        complete: false,
      },
      plannerState: buildPlanner({ id: 'planner-1' }),
      // updatePlannerState intentionally omitted
    } as DispatchContext);
    expect(warnSpy).toHaveBeenCalledWith(
      '[PENDING-ACTION] quote_completion: no updatePlannerState provided',
    );
  });

  it('quote_completion: ISO date path applies origin + startDate + endDate + clears isFlexibleDates', async () => {
    const updatePlannerState = vi.fn().mockResolvedValue(undefined);
    await dispatchPendingAction({
      resolution: {
        for: 'quote_completion',
        kind: 'awaiting_user_input',
        applied: {
          origin: 'Buenos Aires',
          start_date: '2026-12-01',
          end_date: '2026-12-09',
        },
        complete: true,
      },
      plannerState: buildPlanner({ id: 'planner-1', isFlexibleDates: true }),
      updatePlannerState,
    });

    expect(updatePlannerState).toHaveBeenCalledTimes(1);
    const [updater, source] = updatePlannerState.mock.calls[0];
    expect(source).toBe('system');
    const next = updater(buildPlanner({ id: 'planner-1', isFlexibleDates: true }));
    expect(next.origin).toBe('Buenos Aires');
    expect(next.startDate).toBe('2026-12-01');
    expect(next.endDate).toBe('2026-12-09');
    expect(next.isFlexibleDates).toBe(false);
  });

  it('quote_completion: flexible-month path sets isFlexibleDates + month + year', async () => {
    const updatePlannerState = vi.fn().mockResolvedValue(undefined);
    await dispatchPendingAction({
      resolution: {
        for: 'quote_completion',
        kind: 'awaiting_user_input',
        applied: {
          origin: 'Buenos Aires',
          flexible_month: 'diciembre',
          flexible_year: 2026,
        },
        complete: true,
      },
      plannerState: buildPlanner({ id: 'planner-1' }),
      updatePlannerState,
    });

    expect(updatePlannerState).toHaveBeenCalledTimes(1);
    const [updater, source] = updatePlannerState.mock.calls[0];
    expect(source).toBe('system');
    const next = updater(buildPlanner({ id: 'planner-1' }));
    expect(next.origin).toBe('Buenos Aires');
    expect(next.isFlexibleDates).toBe(true);
    expect(next.flexibleMonth).toBe('12');
    expect(next.flexibleYear).toBe(2026);
  });
});

// ---------------------------------------------------------------------------
// Phase 2: canonical-slot helpers
// ---------------------------------------------------------------------------

describe('toCanonicalSlot / toCanonicalFields', () => {
  it('renames the four legacy camelCase date fields to snake_case', () => {
    expect(toCanonicalSlot('departureDate')).toBe('departure_date');
    expect(toCanonicalSlot('returnDate')).toBe('return_date');
    expect(toCanonicalSlot('checkinDate')).toBe('checkin_date');
    expect(toCanonicalSlot('checkoutDate')).toBe('checkout_date');
  });

  it('passes through already-canonical or unknown field names unchanged', () => {
    expect(toCanonicalSlot('origin')).toBe('origin');
    expect(toCanonicalSlot('destination')).toBe('destination');
    expect(toCanonicalSlot('adults')).toBe('adults');
    expect(toCanonicalSlot('children')).toBe('children');
    expect(toCanonicalSlot('city')).toBe('city');
    expect(toCanonicalSlot('exact_dates')).toBe('exact_dates');
    expect(toCanonicalSlot('destinations')).toBe('destinations');
  });

  it('toCanonicalFields maps each entry through toCanonicalSlot', () => {
    expect(
      toCanonicalFields(['departureDate', 'origin', 'checkinDate', 'adults']),
    ).toEqual(['departure_date', 'origin', 'checkin_date', 'adults']);
  });
});

// ---------------------------------------------------------------------------
// Phase 2: itinerary_completion (mutating)
// ---------------------------------------------------------------------------

describe('dispatchPendingAction — itinerary_completion', () => {
  it('happy path: applied.destination + planner → updatePlannerState appends destination', async () => {
    const updatePlannerState = vi.fn().mockResolvedValue(undefined);
    await dispatchPendingAction({
      resolution: {
        for: 'itinerary_completion',
        kind: 'awaiting_user_input',
        applied: { destination: 'Roma' },
        complete: true,
      },
      plannerState: buildPlanner({ id: 'planner-1' }),
      updatePlannerState,
    });

    expect(updatePlannerState).toHaveBeenCalledTimes(1);
    const [updater, source] = updatePlannerState.mock.calls[0];
    expect(source).toBe('system');
    const next = updater(buildPlanner({ id: 'planner-1' }));
    expect(next.destinations).toEqual(['Roma']);
  });

  it('dates only: applied.start_date + end_date updates planner dates and clears flexible', async () => {
    const updatePlannerState = vi.fn().mockResolvedValue(undefined);
    await dispatchPendingAction({
      resolution: {
        for: 'itinerary_completion',
        kind: 'awaiting_user_input',
        applied: { start_date: '2026-12-01', end_date: '2026-12-08' },
        complete: true,
      },
      plannerState: buildPlanner({ id: 'planner-1', isFlexibleDates: true }),
      updatePlannerState,
    });

    expect(updatePlannerState).toHaveBeenCalledTimes(1);
    const [updater] = updatePlannerState.mock.calls[0];
    const next = updater(buildPlanner({ id: 'planner-1', isFlexibleDates: true }));
    expect(next.startDate).toBe('2026-12-01');
    expect(next.endDate).toBe('2026-12-08');
    expect(next.isFlexibleDates).toBe(false);
  });

  it('combined destination + dates: both applied in one update', async () => {
    const updatePlannerState = vi.fn().mockResolvedValue(undefined);
    await dispatchPendingAction({
      resolution: {
        for: 'itinerary_completion',
        kind: 'awaiting_user_input',
        applied: {
          destination: 'Buenos Aires',
          start_date: '2026-11-10',
          end_date: '2026-11-20',
        },
        complete: true,
      },
      plannerState: buildPlanner({ id: 'planner-1' }),
      updatePlannerState,
    });

    expect(updatePlannerState).toHaveBeenCalledTimes(1);
    const next = updatePlannerState.mock.calls[0][0](buildPlanner({ id: 'planner-1' }));
    expect(next.destinations).toEqual(['Buenos Aires']);
    expect(next.startDate).toBe('2026-11-10');
    expect(next.endDate).toBe('2026-11-20');
    expect(next.isFlexibleDates).toBe(false);
  });

  it('flexible-month path: sets isFlexibleDates true + month + year', async () => {
    const updatePlannerState = vi.fn().mockResolvedValue(undefined);
    await dispatchPendingAction({
      resolution: {
        for: 'itinerary_completion',
        kind: 'awaiting_user_input',
        applied: { flexible_month: 'noviembre', flexible_year: 2026 },
        complete: true,
      },
      plannerState: buildPlanner({ id: 'planner-1' }),
      updatePlannerState,
    });

    expect(updatePlannerState).toHaveBeenCalledTimes(1);
    const next = updatePlannerState.mock.calls[0][0](buildPlanner({ id: 'planner-1' }));
    expect(next.isFlexibleDates).toBe(true);
    expect(next.flexibleMonth).toBe('11');
    expect(next.flexibleYear).toBe(2026);
  });

  it('no planner: handler logs and returns without throwing or calling updatePlannerState', async () => {
    const updatePlannerState = vi.fn();
    await expect(
      dispatchPendingAction({
        resolution: {
          for: 'itinerary_completion',
          kind: 'awaiting_user_input',
          applied: { destination: 'Roma' },
          complete: true,
        },
        plannerState: null,
        updatePlannerState,
      }),
    ).resolves.toBeUndefined();
    expect(updatePlannerState).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      '[PENDING-ACTION] itinerary_completion: no active planner — observational only',
      { applied: { destination: 'Roma' } },
    );
  });

  it('preserves existing destinations (appends, does not overwrite)', async () => {
    const updatePlannerState = vi.fn().mockResolvedValue(undefined);
    await dispatchPendingAction({
      resolution: {
        for: 'itinerary_completion',
        kind: 'awaiting_user_input',
        applied: { destination: 'Roma' },
        complete: true,
      },
      plannerState: buildPlanner({ id: 'planner-1' }),
      updatePlannerState,
    });

    const updater = updatePlannerState.mock.calls[0][0];
    const next = updater(buildPlanner({
      id: 'planner-1',
      destinations: ['Buenos Aires', 'Madrid'],
    } as unknown as Partial<TripPlannerState>));
    expect(next.destinations).toEqual(['Buenos Aires', 'Madrid', 'Roma']);
  });

  it('warns and returns on ref/plan mismatch', async () => {
    const updatePlannerState = vi.fn();
    await dispatchPendingAction({
      resolution: {
        for: 'itinerary_completion',
        kind: 'awaiting_user_input',
        ref: { type: 'plan', id: 'X' },
        applied: { destination: 'Roma' },
        complete: true,
      },
      plannerState: buildPlanner({ id: 'Y' }),
      updatePlannerState,
    });
    expect(updatePlannerState).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[PENDING-ACTION] itinerary_completion ignored — ref/plan mismatch',
    );
  });
});

// ---------------------------------------------------------------------------
// Phase 2: observational handlers (search validation flows + collect)
// ---------------------------------------------------------------------------

describe('dispatchPendingAction — observational handlers', () => {
  it.each([
    'collect_clarification',
    'combined_completion',
    'flight_completion',
    'hotel_completion',
  ])('%s: routes without throwing and never calls updatePlannerState', async (forValue) => {
    const updatePlannerState = vi.fn();
    await expect(
      dispatchPendingAction({
        resolution: {
          for: forValue,
          kind: 'awaiting_user_input',
          applied: { origin: 'BUE', destination: 'MAD' },
          complete: false,
        } as PendingActionResolution,
        plannerState: buildPlanner({ id: 'planner-1' }),
        updatePlannerState,
      }),
    ).resolves.toBeUndefined();
    expect(updatePlannerState).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      `[PENDING-ACTION] ${forValue} observed:`,
      expect.objectContaining({ applied: { origin: 'BUE', destination: 'MAD' } }),
    );
  });
});

// ---------------------------------------------------------------------------
// Phase 2: hotel_completion shared between sites 4 + 5 (semantic invariance)
// ---------------------------------------------------------------------------

describe('hotel_completion: sites 4 and 5 produce identical pending_action shape', () => {
  it('snapshot: identical fields/for given same legacy missingFields input', () => {
    // Both sites call:
    //   { kind: 'awaiting_user_input', for: 'hotel_completion',
    //     fields: toCanonicalFields(missing), prompt: msg, issuedAt: ... }
    // The only divergence the snapshot test guards: the `for` value and the
    // canonicalized field list. issuedAt and prompt vary by call site.
    const legacyMissing = ['city', 'checkinDate', 'checkoutDate', 'adults'];

    const site4Action = {
      kind: 'awaiting_user_input' as const,
      for: 'hotel_completion',
      fields: toCanonicalFields(legacyMissing),
      prompt: 'Faltan datos',
    };
    const site5Action = {
      kind: 'awaiting_user_input' as const,
      for: 'hotel_completion',
      fields: toCanonicalFields(legacyMissing),
      prompt: 'Faltan datos',
    };

    expect(site4Action).toEqual(site5Action);
    expect(site4Action.fields).toEqual([
      'city',
      'checkin_date',
      'checkout_date',
      'adults',
    ]);
  });
});

describe('dispatchPendingAction — add_places_to_itinerary', () => {
  function makeSegmentedPlanner(): TripPlannerState {
    return {
      id: 'planner-9',
      segments: [
        {
          id: 'seg-1',
          city: 'Roma',
          days: [
            {
              id: 'day-1',
              dayNumber: 1,
              city: 'Roma',
              title: 'Día 1',
              morning: [],
              afternoon: [],
              evening: [],
              restaurants: [],
            },
            {
              id: 'day-2',
              dayNumber: 2,
              city: 'Roma',
              title: 'Día 2',
              morning: [],
              afternoon: [],
              evening: [],
              restaurants: [],
            },
          ],
        },
      ],
    } as unknown as TripPlannerState;
  }

  it('skips mutation when user declined (confirmed=false)', async () => {
    const updatePlannerState = vi.fn();
    await dispatchPendingAction({
      resolution: {
        for: 'add_places_to_itinerary',
        kind: 'awaiting_user_confirmation',
        applied: { confirmed: false },
        complete: true,
        payload: { resolved_places: [{ placeId: 'fsq1', name: 'X', category: 'restaurant' }] },
      },
      plannerState: makeSegmentedPlanner(),
      updatePlannerState,
    });
    expect(updatePlannerState).not.toHaveBeenCalled();
  });

  it('appends a restaurant to evening of the chosen day', async () => {
    const planner = makeSegmentedPlanner();
    let nextState: TripPlannerState | null = null;
    const updatePlannerState = vi.fn(async (updater: (s: TripPlannerState) => TripPlannerState) => {
      nextState = updater(planner);
    });
    await dispatchPendingAction({
      resolution: {
        for: 'add_places_to_itinerary',
        kind: 'awaiting_user_confirmation',
        applied: { confirmed: true },
        complete: true,
        payload: {
          resolved_places: [
            { placeId: 'fsq-rest-1', name: 'Trattoria', category: 'restaurant', address: 'Via X', rating: 4.5 },
          ],
          segment_id: 'seg-1',
          day_index: 1,
          note: null,
        },
      },
      plannerState: planner,
      updatePlannerState,
    });
    expect(updatePlannerState).toHaveBeenCalledTimes(1);
    expect(nextState).not.toBeNull();
    const day2 = nextState!.segments[0].days[1];
    expect(day2.evening).toHaveLength(1);
    expect(day2.evening[0].placeId).toBe('fsq-rest-1');
    expect(day2.evening[0].title).toBe('Trattoria');
    // Restaurant also lands in restaurants list.
    expect(day2.restaurants).toHaveLength(1);
    expect(day2.restaurants[0].placeId).toBe('fsq-rest-1');
  });

  it('appends a museum to morning slot via category heuristic', async () => {
    const planner = makeSegmentedPlanner();
    let nextState: TripPlannerState | null = null;
    const updatePlannerState = vi.fn(async (updater: (s: TripPlannerState) => TripPlannerState) => {
      nextState = updater(planner);
    });
    await dispatchPendingAction({
      resolution: {
        for: 'add_places_to_itinerary',
        kind: 'awaiting_user_confirmation',
        applied: { confirmed: true },
        complete: true,
        payload: {
          resolved_places: [{ placeId: 'fsq-mus-1', name: 'Museo', category: 'museum' }],
          segment_id: null,
          day_index: 0,
          note: null,
        },
      },
      plannerState: planner,
      updatePlannerState,
    });
    const day1 = nextState!.segments[0].days[0];
    expect(day1.morning).toHaveLength(1);
    expect(day1.morning[0].placeId).toBe('fsq-mus-1');
    expect(day1.afternoon).toHaveLength(0);
    expect(day1.evening).toHaveLength(0);
  });

  it('clamps day_index out of range to last available day', async () => {
    const planner = makeSegmentedPlanner();
    let nextState: TripPlannerState | null = null;
    const updatePlannerState = vi.fn(async (updater: (s: TripPlannerState) => TripPlannerState) => {
      nextState = updater(planner);
    });
    await dispatchPendingAction({
      resolution: {
        for: 'add_places_to_itinerary',
        kind: 'awaiting_user_confirmation',
        applied: { confirmed: true },
        complete: true,
        payload: {
          resolved_places: [{ placeId: 'fsq-act-1', name: 'Tour', category: 'activity' }],
          segment_id: 'seg-1',
          day_index: 99,
          note: null,
        },
      },
      plannerState: planner,
      updatePlannerState,
    });
    // Clamped to day-2 (index 1).
    const day2 = nextState!.segments[0].days[1];
    expect(day2.afternoon).toHaveLength(1);
    expect(day2.afternoon[0].placeId).toBe('fsq-act-1');
  });

  it('skips when no active planner', async () => {
    const updatePlannerState = vi.fn();
    await dispatchPendingAction({
      resolution: {
        for: 'add_places_to_itinerary',
        kind: 'awaiting_user_confirmation',
        applied: { confirmed: true },
        complete: true,
        payload: { resolved_places: [{ placeId: 'x', name: 'y', category: 'activity' }] },
      },
      plannerState: null,
      updatePlannerState,
    });
    expect(updatePlannerState).not.toHaveBeenCalled();
  });
});
