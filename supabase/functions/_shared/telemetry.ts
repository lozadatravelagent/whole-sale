// =============================================================================
// telemetry.ts — Structured logging for Context Engineering (Phase 8.4)
// =============================================================================
//
// Authoritative spec: docs/architecture/context-engineering-spec.md §8 (telemetry)
//                     docs/architecture/tool-catalog-spec.md §6 (Telemetry hooks)
//
// Replaces ad-hoc `console.log("[CTX-*]", ...)` calls scattered across the
// edge functions with a single typed surface. Each event category has a fixed
// shape so that Phase 9 can wire these to a metrics table (or an external
// sink like Logtail / Datadog) without re-grepping the codebase.
//
// IMPORTANT: this module is PURE I/O wrapper — it does NOT compute any of the
// metrics itself. Callers (the edge function) build the event object and
// call `emitTelemetry`. The only helper exposed here is `countRedundantCalls`
// which derives a single field from a tool trace; it is pure and testable.
//
// MVP TODOs (deferred — see comments per metric):
//   - memory_conflict_rate: requires NLI/contradiction detection between
//     user turn and stored notes. Skipped for MVP.
//   - time_to_personalization: requires cross-turn correlation
//     (first invocation of get_lead_full_history OR first time a profile
//     preference visibly affects a recommendation). Skipped for MVP.
//   - dead_end_calls: requires post-hoc analysis of whether a tool result
//     contributed to the final answer. Out of scope for the runtime.
//   - amnesia_events: requires detecting when the model asks for info
//     present in trimmed history. Heuristic detection is unreliable;
//     defer to manual flag from user feedback.
//   - compaction_recall_score: requires SummarizingSession (not active yet).
// =============================================================================

// -----------------------------------------------------------------------------
// Event types — one per category. Each is a discriminated union member.
// -----------------------------------------------------------------------------

export interface CtxStateEvent {
  category: 'CTX-STATE';
  conversation_id: string;
  agency_id: string;
  turn_count: number;
  /** Approx token count of the rendered <user_profile> YAML block. */
  profile_tokens: number;
  global_notes_count: number;
  session_notes_count: number;
  active_refs_count: number;
  mode: 'passenger' | 'agency';
}

export interface CtxToolEvent {
  category: 'CTX-TOOL';
  conversation_id: string;
  agency_id: string;
  iterations: number;
  tools_called: string[];
  errors_count: number;
  hit_cap: boolean;
  hit_timeout: boolean;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  /** Same (tool, args) seen more than once within this turn's trace. */
  redundant_calls: number;
}

export interface CtxMemoryEvent {
  category: 'CTX-MEMORY';
  conversation_id: string;
  agency_id: string;
  /** Total `save_memory_note` invocations the model attempted this turn. */
  attempted: number;
  /** Validated, persisted notes. */
  accepted: number;
  /** Rejected at the validateMemoryNote step. */
  rejected: number;
  /** Map of rejection reason → count (e.g. {"speculation":1,"too_long":2}). */
  rejection_reasons: Record<string, number>;
}

/**
 * Emitted whenever the `discover_places` tool persists candidates into
 * `EmiliaState.discovery_candidates` for cross-turn referential resolution
 * (e.g. user later says "agregá el segundo del listado"). Fired exactly once
 * per successful discover_places call that yielded ≥1 persistable candidate.
 */
export interface CtxDiscoveryPersistEvent {
  category: 'CTX-DISCOVERY-PERSIST';
  conversation_id: string;
  agency_id: string;
  /** How many candidates were written (≤ MAX_DISCOVERY_CANDIDATES). */
  count: number;
  /** Distinct categories represented in the persisted slice. */
  categories: string[];
}

export type TelemetryEvent =
  | CtxStateEvent
  | CtxToolEvent
  | CtxMemoryEvent
  | CtxDiscoveryPersistEvent;

// -----------------------------------------------------------------------------
// Emitter
// -----------------------------------------------------------------------------

/**
 * Emit a structured telemetry event.
 *
 * Phase 8 implementation: writes a single line of structured JSON to
 * `console.log` prefixed with the category. Phase 9 will swap this body for
 * a write to an `agent_telemetry` table (or push to a metrics sink) without
 * touching call sites.
 *
 * The category prefix is preserved as the FIRST argument to `console.log`
 * so that existing log-grep workflows (`grep '[CTX-TOOL]'`) keep working
 * during the transition.
 */
export function emitTelemetry(event: TelemetryEvent): void {
  // Defensive copy so callers can mutate the input later without affecting
  // the serialized line. Cheap because events are small (≤20 fields).
  const payload = { ...event };
  // Keep the bracketed category prefix outside the JSON for grepability.
  console.log(`[${event.category}]`, JSON.stringify(payload));
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Count tool calls in a trace where the same `(tool, args)` pair appears
 * more than once. The first occurrence is NOT counted; only repeats are.
 *
 * Args are JSON-serialized for the comparison key. Argument-key ordering
 * affects the key — that matches OpenAI behavior (the model emits a stable
 * argument order per call), and is fine for the redundancy heuristic since
 * a re-emission with reordered keys is rare and not the failure mode we
 * want to catch (which is "called the same retrieval tool with the same
 * planner_id twice in one turn").
 *
 * Pure function: no I/O, deterministic given input. Exported for tests.
 */
export function countRedundantCalls(
  trace: Array<{ tool: string; args: unknown }>,
): number {
  const seen = new Set<string>();
  let redundant = 0;
  for (const entry of trace) {
    let argsKey: string;
    try {
      argsKey = JSON.stringify(entry.args ?? null);
    } catch {
      // Circular ref or non-serializable — treat as unique.
      argsKey = `__nonserializable__:${redundant}`;
    }
    const key = `${entry.tool}:${argsKey}`;
    if (seen.has(key)) {
      redundant += 1;
    } else {
      seen.add(key);
    }
  }
  return redundant;
}
