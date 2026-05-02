/**
 * pendingActionDispatcher — generic dispatcher for pending_action resolutions
 * coming back from the edge-function tool loop.
 *
 * Adding a new pending-action `for` flow:
 *  1. Add a handler function below (export not needed unless tested directly).
 *  2. Register it in the `handlers` map.
 *  3. The setPendingAction call upstream — that's the only other place to touch.
 *
 * Spec: docs/architecture/context-engineering-spec.md §1.6
 */

import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { TripPlannerState } from '@/features/trip-planner/types';

export type PendingActionResolution = NonNullable<ParsedTravelRequest['pendingActionResolution']>;

export interface DispatchContext {
  resolution: PendingActionResolution;
  plannerState: TripPlannerState | null;
  updatePlannerState?: (
    updater: (current: TripPlannerState) => TripPlannerState,
    source?: 'ui_edit' | 'system',
  ) => Promise<void>;
}

type Handler = (ctx: DispatchContext) => Promise<void>;

async function handleQuoteCompletion(ctx: DispatchContext): Promise<void> {
  const { resolution, plannerState, updatePlannerState } = ctx;
  const { applied, ref } = resolution;

  // Verify the resolution is targeting the active planner.
  if (!plannerState || (ref && ref.type === 'plan' && ref.id !== plannerState.id)) {
    console.warn('[PENDING-ACTION] quote_completion ignored — ref/plan mismatch');
    return;
  }
  if (!updatePlannerState) {
    console.warn('[PENDING-ACTION] quote_completion: no updatePlannerState provided');
    return;
  }
  // Field-name-tolerant extraction. The model may emit any of these
  // synonyms based on what was in pending_action.fields.
  const originRaw = applied.origin ?? applied.origin_city ?? applied['ciudad de salida']
    ?? applied.ciudad_de_salida ?? applied.from;
  const startRaw = applied.start_date ?? applied.startDate ?? applied.from_date
    ?? applied['fecha de salida'] ?? applied.fecha_de_salida ?? applied.fechas;
  const endRaw = applied.end_date ?? applied.endDate ?? applied.to_date
    ?? applied['fecha de regreso'] ?? applied.fecha_de_regreso;
  // Flexible-month fallback. When the model can't pin a YYYY-MM-DD (user
  // said "diciembre 2026"), it may emit either of these instead.
  const flexMonthRaw = applied.flexible_month ?? applied.flexibleMonth ?? applied.month;
  const flexYearRaw = applied.flexible_year ?? applied.flexibleYear ?? applied.year;

  const origin = typeof originRaw === 'string' && originRaw.trim() ? originRaw.trim() : undefined;
  const startDate = typeof startRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : undefined;
  const endDate = typeof endRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) ? endRaw : undefined;

  // Normalize flexible month: accept "12", "diciembre", "december" → "12".
  const monthNames: Record<string, string> = {
    enero: '01', january: '01', febrero: '02', february: '02', marzo: '03', march: '03',
    abril: '04', april: '04', mayo: '05', may: '05', junio: '06', june: '06',
    julio: '07', july: '07', agosto: '08', august: '08', septiembre: '09', september: '09',
    octubre: '10', october: '10', noviembre: '11', november: '11', diciembre: '12', december: '12',
  };
  let flexibleMonth: string | undefined;
  if (typeof flexMonthRaw === 'string') {
    const lower = flexMonthRaw.trim().toLowerCase();
    flexibleMonth = monthNames[lower] ?? (/^\d{1,2}$/.test(lower) ? lower.padStart(2, '0') : undefined);
  } else if (typeof flexMonthRaw === 'number' && flexMonthRaw >= 1 && flexMonthRaw <= 12) {
    flexibleMonth = String(flexMonthRaw).padStart(2, '0');
  }
  const flexibleYear = typeof flexYearRaw === 'number'
    ? flexYearRaw
    : (typeof flexYearRaw === 'string' && /^\d{4}$/.test(flexYearRaw) ? parseInt(flexYearRaw, 10) : undefined);

  if (!origin && !startDate && !endDate && !flexibleMonth) {
    console.warn('[PENDING-ACTION] quote_completion: no recognizable values in', applied);
    return;
  }

  await updatePlannerState((current) => {
    const next = { ...current };
    if (origin) next.origin = origin;
    if (startDate) {
      next.startDate = startDate;
      next.isFlexibleDates = false;
    }
    if (endDate) next.endDate = endDate;
    // Only set flexible mode when no exact date was provided, so a model
    // that emits both YYYY-MM-DD AND a month name doesn't downgrade.
    if (flexibleMonth && !startDate) {
      next.isFlexibleDates = true;
      next.flexibleMonth = flexibleMonth;
      if (flexibleYear) next.flexibleYear = flexibleYear;
    }
    return next;
  }, 'system');
}

const handlers: Record<string, Handler> = {
  quote_completion: handleQuoteCompletion,
};

export async function dispatchPendingAction(ctx: DispatchContext): Promise<void> {
  const handler = handlers[ctx.resolution.for];
  if (!handler) {
    console.log('[PENDING-ACTION] no handler for `for`:', ctx.resolution.for, '— resolution ignored');
    return;
  }
  await handler(ctx);
}
