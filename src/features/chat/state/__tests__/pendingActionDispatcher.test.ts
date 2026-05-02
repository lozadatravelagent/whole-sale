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
