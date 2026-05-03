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

// ---------------------------------------------------------------------------
// Canonical-slot rename helper
// ---------------------------------------------------------------------------
// The legacy validators (validateFlightRequiredFields, validateHotelRequiredFields,
// validateItineraryRequiredFields) emit camelCase field names like `departureDate`.
// The pending_action contract uses snake_case canonical names so the model sees a
// stable vocabulary independent of internal validator naming. Any flow that wires
// validator output into pending_action.fields MUST go through `toCanonicalFields`.
const LEGACY_TO_CANONICAL: Record<string, string> = {
  departureDate: 'departure_date',
  returnDate: 'return_date',
  checkinDate: 'checkin_date',
  checkoutDate: 'checkout_date',
};

export function toCanonicalSlot(legacy: string): string {
  return LEGACY_TO_CANONICAL[legacy] ?? legacy;
}

export function toCanonicalFields(legacy: string[]): string[] {
  return legacy.map(toCanonicalSlot);
}

// Normalize flexible month: accept "12", "diciembre", "december" → "12".
// Keys are canonical (`flexible_month` etc., per getPlanQuoteMissingSlots),
// but the *value* the model emits may still be a localized month name.
const MONTH_NAMES: Record<string, string> = {
  enero: '01', january: '01', febrero: '02', february: '02', marzo: '03', march: '03',
  abril: '04', april: '04', mayo: '05', may: '05', junio: '06', june: '06',
  julio: '07', july: '07', agosto: '08', august: '08', septiembre: '09', september: '09',
  octubre: '10', october: '10', noviembre: '11', november: '11', diciembre: '12', december: '12',
};

function normalizeFlexibleMonth(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase();
    return MONTH_NAMES[lower] ?? (/^\d{1,2}$/.test(lower) ? lower.padStart(2, '0') : undefined);
  }
  if (typeof raw === 'number' && raw >= 1 && raw <= 12) {
    return String(raw).padStart(2, '0');
  }
  return undefined;
}

function normalizeFlexibleYear(raw: unknown): number | undefined {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && /^\d{4}$/.test(raw)) return parseInt(raw, 10);
  return undefined;
}

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

  // Canonical slot names — see conversationOrchestrator.getPlanQuoteMissingSlots.
  // The pending_action.fields contract guarantees the model sees these exact keys.
  const origin = typeof applied.origin === 'string' && applied.origin.trim()
    ? applied.origin.trim()
    : undefined;
  const startDate = typeof applied.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(applied.start_date)
    ? applied.start_date
    : undefined;
  const endDate = typeof applied.end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(applied.end_date)
    ? applied.end_date
    : undefined;

  // Flexible-month fallback. When the model can't pin a YYYY-MM-DD (user
  // said "diciembre 2026"), it may emit `flexible_month` instead — that
  // slot key isn't currently in pending_action.fields (parity with
  // getPlanQuoteMissingFields, which lumps both date branches together),
  // but the dispatcher still recognizes it so the state can be filled.
  const flexibleMonth = normalizeFlexibleMonth(applied.flexible_month);
  const flexibleYear = normalizeFlexibleYear(applied.flexible_year);

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

// ---------------------------------------------------------------------------
// Observational handlers (no domain mutation)
// ---------------------------------------------------------------------------
// These four flows ask the user for slot values that the next-turn parser will
// fold into a fresh `parsedRequest`. The legacy code path then re-runs the
// validators / search pipeline with the merged request. The dispatcher therefore
// only needs to LOG that the resolution was observed and clear `pending_action`
// (clearing happens in `consumePendingActionResolution`, not here).
async function handleCollectClarification(ctx: DispatchContext): Promise<void> {
  const { resolution } = ctx;
  console.log('[PENDING-ACTION] collect_clarification observed:', {
    applied: resolution.applied,
    complete: resolution.complete,
  });
}

async function handleCombinedCompletion(ctx: DispatchContext): Promise<void> {
  const { resolution } = ctx;
  console.log('[PENDING-ACTION] combined_completion observed:', {
    applied: resolution.applied,
    complete: resolution.complete,
  });
}

async function handleFlightCompletion(ctx: DispatchContext): Promise<void> {
  const { resolution } = ctx;
  console.log('[PENDING-ACTION] flight_completion observed:', {
    applied: resolution.applied,
    complete: resolution.complete,
  });
}

async function handleHotelCompletion(ctx: DispatchContext): Promise<void> {
  const { resolution } = ctx;
  console.log('[PENDING-ACTION] hotel_completion observed:', {
    applied: resolution.applied,
    complete: resolution.complete,
  });
}

// ---------------------------------------------------------------------------
// Itinerary completion (mutating)
// ---------------------------------------------------------------------------
// Mirrors handleQuoteCompletion: when a planner is active and the resolution
// carries destination(s) and/or dates, push them into the planner so the next
// turn sees the updated state. When no planner exists we log and return; the
// next-turn parser still sees `applied` and can build a fresh parsed request.
async function handleItineraryCompletion(ctx: DispatchContext): Promise<void> {
  const { resolution, plannerState, updatePlannerState } = ctx;
  const { applied, ref } = resolution;

  if (!plannerState) {
    console.log('[PENDING-ACTION] itinerary_completion: no active planner — observational only', {
      applied,
    });
    return;
  }
  if (ref && ref.type === 'plan' && ref.id !== plannerState.id) {
    console.warn('[PENDING-ACTION] itinerary_completion ignored — ref/plan mismatch');
    return;
  }
  if (!updatePlannerState) {
    console.warn('[PENDING-ACTION] itinerary_completion: no updatePlannerState provided');
    return;
  }

  // Accept either `destination` (single) or `destinations` (array). Both forms
  // come up because the model serializes whichever the user replied with.
  const destinationsToAdd: string[] = [];
  if (Array.isArray(applied.destinations)) {
    for (const d of applied.destinations) {
      if (typeof d === 'string' && d.trim()) destinationsToAdd.push(d.trim());
    }
  }
  if (typeof applied.destination === 'string' && applied.destination.trim()) {
    destinationsToAdd.push(applied.destination.trim());
  }

  const startDate = typeof applied.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(applied.start_date)
    ? applied.start_date
    : undefined;
  const endDate = typeof applied.end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(applied.end_date)
    ? applied.end_date
    : undefined;
  const flexibleMonth = normalizeFlexibleMonth(applied.flexible_month);
  const flexibleYear = normalizeFlexibleYear(applied.flexible_year);

  if (destinationsToAdd.length === 0 && !startDate && !endDate && !flexibleMonth) {
    console.warn('[PENDING-ACTION] itinerary_completion: no recognizable values in', applied);
    return;
  }

  await updatePlannerState((current) => {
    const next = { ...current };
    if (destinationsToAdd.length > 0) {
      // Preserve existing destinations — append, don't overwrite.
      const existing = Array.isArray(current.destinations) ? current.destinations : [];
      const merged = [...existing];
      for (const d of destinationsToAdd) {
        if (!merged.includes(d)) merged.push(d);
      }
      next.destinations = merged;
    }
    if (startDate) {
      next.startDate = startDate;
      next.isFlexibleDates = false;
    }
    if (endDate) next.endDate = endDate;
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
  collect_clarification: handleCollectClarification,
  combined_completion: handleCombinedCompletion,
  flight_completion: handleFlightCompletion,
  hotel_completion: handleHotelCompletion,
  itinerary_completion: handleItineraryCompletion,
};

export async function dispatchPendingAction(ctx: DispatchContext): Promise<void> {
  const handler = handlers[ctx.resolution.for];
  if (!handler) {
    console.log('[PENDING-ACTION] no handler for `for`:', ctx.resolution.for, '— resolution ignored');
    return;
  }
  await handler(ctx);
}
