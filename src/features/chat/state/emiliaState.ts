/**
 * EmiliaState — Type definitions and pure factories.
 *
 * Single source of truth for the structured state object that travels alongside
 * every Emilia run. Mirrors the OpenAI Agents SDK / Cookbook `TravelState` pattern,
 * adapted to the WholeSale Connect AI travel CRM domain.
 *
 * - Persisted per `conversation_id` in Postgres (`agent_states` table — Phase 1.3).
 * - Mounted into `RunContext<EmiliaState>` at the start of each turn (Phase 1.2).
 * - Mutated only through controlled mutators (`mutateState(updater)`).
 *
 * This file contains TYPES + PURE FACTORIES ONLY. No DB persistence, no React,
 * no side-effects. Persistence lives in `persistence.ts` (Phase 1.3).
 *
 * Spec: docs/architecture/context-engineering-spec.md §1
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Schema version. Bump on breaking shape changes; persistence layer reads it for migrations. */
export const SCHEMA_VERSION = 2;

/** Top-k cap for global memory notes injected into the prompt per turn. */
export const MAX_GLOBAL_NOTES = 6;

/** Top-k cap for session memory notes injected when re-inject flag is set. */
export const MAX_SESSION_NOTES = 8;

/**
 * Top-k cap for discovery candidates persisted on every `discover_places`
 * tool call. Latest call wins (the slot is OVERWRITTEN, not accumulated).
 * Phase-3 tools read this to resolve referential phrases like "el segundo
 * del listado" → concrete placeId.
 */
export const MAX_DISCOVERY_CANDIDATES = 10;

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/**
 * Belief-style preferences. Each field is a single trusted value
 * representing the agent's CURRENT belief, NOT an append-only log.
 * Conflicts are resolved by overwrite, not accumulation.
 */
export interface EmiliaPreferences {
  budget_band?: 'low' | 'mid' | 'mid-high' | 'high' | 'luxury';
  pace?: 'relaxed' | 'balanced' | 'packed';
  trip_style?: Array<'beach' | 'culture' | 'gastronomy' | 'adventure' | 'family' | 'romantic'>;
  hotel_tier?: '3' | '4' | '5' | 'boutique';
  flight_class?: 'economy' | 'premium-economy' | 'business';
  /** Free-form, ≤5 items (validated at write-time). */
  dietary?: string[];
  party_composition?: {
    adults: number;
    children?: number;
    children_ages?: number[];
  };
}

/**
 * Trusted, structured, slowly-changing fields sourced from internal systems
 * (CRM lead, agency config, IP-derived defaults).
 */
export interface EmiliaProfile {
  /** null if lead not yet created. */
  lead_id?: string;
  /** Always present (multi-tenant). */
  agency_id: string;
  currency: 'ARS' | 'USD' | 'EUR' | 'BRL' | string;
  default_origin_city?: string;
  default_origin_country?: string;
  /** UI + Emilia output language. */
  language: 'es' | 'en' | 'pt';
  preferences: EmiliaPreferences;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

/**
 * Strict shape for both `global_memory.notes` and `session_memory.notes`.
 * Cookbook constraints: durable, actionable, explicit; no PII, no speculation,
 * no instructions.
 */
export interface MemoryNote {
  /** ≤500 chars. Validated at write-time by the save_memory_note tool. */
  text: string;
  /** ISO 8601. Used for conflict resolution: most-recent wins. */
  last_update_date: string;
  /** Lower-case keywords for retrieval/dedup; 1–6 items. */
  keywords: string[];
  /** Domain bucket. Drives top-k selection per scope at inject time. */
  scope: 'planning' | 'pricing' | 'lead-context' | 'decisions';
}

// ---------------------------------------------------------------------------
// Active refs
// ---------------------------------------------------------------------------

/**
 * References the agent is currently working with this turn.
 * Cleared selectively by user intent ("olvidate del plan") via a dedicated handler.
 */
export interface ContextRef {
  type: 'plan' | 'quote' | 'lead';
  id: string;
  /** ≤120 chars. Pre-rendered one-liner injected verbatim into <active_refs>. */
  summary1Line: string;
  /** ISO 8601. Used to render the "(updated Xmin ago)" hint. */
  lastUpdated: string;
}

/**
 * A place candidate the agent surfaced to the user via `discover_places`.
 * Persisted in `EmiliaState.discovery_candidates` (top-N, latest call wins)
 * so the model can resolve referential phrases like "agregá el segundo del
 * listado" → concrete `placeId` in subsequent turns.
 *
 * Lifecycle:
 *  - Written by the `discover_places` handler on every successful call (the
 *    full slot is OVERWRITTEN; we never accumulate across calls).
 *  - Read by Phase-3 tools (e.g. `propose_planner_addition`) and by the
 *    inject layer to render a compact reference list into the system prompt.
 *  - NOT cleared by `apply_slot_values` / `confirm_pending_action`. Cleared
 *    only on the next `discover_places` call.
 *
 * KEEP IN SYNC with `supabase/functions/_shared/emiliaStateTypes.ts`.
 */
export interface DiscoveryCandidateRef {
  /** Provider place id (e.g. Foursquare fsq_id). Stable enough to round-trip. */
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  /** PlannerPlaceCategory string (kept loose to avoid a cross-module import). */
  category: string;
  rating?: number;
  /** Foursquare formatted address; useful for disambiguation in the prompt. */
  address?: string;
  photoUrl?: string;
}

// ---------------------------------------------------------------------------
// Pending action (turn-state)
// ---------------------------------------------------------------------------

/**
 * Generic "the assistant is awaiting something from the user" marker.
 *
 * Lifecycle:
 *  1. The handler that ASKS sets `pending_action` (e.g. quote_active_plan
 *     emits "ciudad de salida y fechas" — fields go here).
 *  2. The next turn renders `<pending_action>` into the system prompt so the
 *     model knows the user's reply most likely answers those fields.
 *  3. The model invokes `apply_slot_values` (or, for `awaiting_user_confirmation`,
 *     `confirm_pending_action`) — handler stamps `applied` here.
 *  4. The client consumes `applied`, mutates the underlying domain state
 *     (planner / quote / etc.), and clears `pending_action`.
 *
 * This is intentionally domain-agnostic: any flow that needs "ask, then read
 * the user's reply as an answer" plugs in by setting a fresh PendingAction.
 */
export type PendingActionKind = 'awaiting_user_input' | 'awaiting_user_confirmation';

export interface PendingAction {
  kind: PendingActionKind;
  /** Stable identifier for the flow that produced the prompt. e.g. 'quote_completion', 'collect_passenger', 'confirm_booking'. */
  for: string;
  /** When kind='awaiting_user_input': list of slot names being asked (max ~6). */
  fields?: string[];
  /** Reference the prompt is about (the active plan/quote/lead). */
  ref?: { type: 'plan' | 'quote' | 'lead'; id: string };
  /** ≤240 chars. The natural-language prompt that was shown to the user. Helps the model match user replies to slots. */
  prompt: string;
  /** ISO 8601. When the prompt was issued. */
  issuedAt: string;
  /** Slot values applied by `apply_slot_values` (cleared on the next turn after consumption). */
  applied?: Record<string, unknown>;
  /** Whether `applied` covers every required field. Set by the tool handler. */
  complete?: boolean;
  /**
   * Optional domain payload set at the same time as the pending_action by the
   * tool that ASKED the question. Distinct from `applied` (which carries the
   * USER'S reply via apply_slot_values / confirm_pending_action).
   *
   * Use case: `propose_planner_addition` resolves placeIds against
   * `state.discovery_candidates` upfront and stashes the resolved places +
   * target slot in `payload`. When the user confirms, the dispatcher reads
   * the payload to mutate the planner state. Without this slot the dispatcher
   * would have to re-resolve placeIds from a stale state, or the model would
   * have to re-emit the payload on confirmation.
   *
   * Optional so existing pending_actions persisted under schema_version=2
   * load cleanly without a migration. KEEP IN SYNC with
   * `supabase/functions/_shared/emiliaStateTypes.ts`.
   */
  payload?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Trip history
// ---------------------------------------------------------------------------

export interface TripSummary {
  trip_id: string;
  /** ≤200 chars. e.g. "Buenos Aires → Bariloche, 7 días, mid-budget, fam c/2 niños, 03/2025" */
  one_liner: string;
  /** ISO 8601. Trip end date or quote close date. */
  ended_at: string;
}

// ---------------------------------------------------------------------------
// Top-level EmiliaState
// ---------------------------------------------------------------------------

/**
 * EmiliaState — single source of truth for a single Emilia conversation.
 *
 * Persistence: stored as JSONB per conversation_id (RLS by agency_id).
 * Mutation: only through state.ts mutators; never reassign in place.
 */
export interface EmiliaState {
  /**
   * Trusted, structured, slowly-changing fields.
   * Highest "trust" precedence after user's latest message + active refs.
   */
  profile: EmiliaProfile;

  /**
   * Per-conversation durable knowledge produced by the consolidate phase.
   * Top-k (MAX_GLOBAL_NOTES) injected each turn.
   * Written ONLY by the consolidate phase from session_memory; never directly by tools.
   *
   * SCOPE: per-conversation (Option A — full conversation isolation). The "global"
   * name reflects the LIFECYCLE position (post-consolidate, durable for THIS
   * conversation), not cross-conversation persistence. Starts empty on every
   * new conversation; never loaded from any external lead-level store.
   */
  global_memory: { notes: MemoryNote[] };

  /**
   * Current-conversation, ephemeral knowledge captured this run.
   * Written by the `save_memory_note` tool (distill phase).
   * Drained into global_memory by the consolidate phase at session end.
   */
  session_memory: { notes: MemoryNote[] };

  /**
   * References the agent is currently working with this turn.
   * Highest precedence after user's latest message — overrides profile defaults.
   */
  active_refs: ContextRef[];

  /**
   * Top-N place candidates surfaced by the most recent `discover_places` call.
   * Lives at the top level (parallel to `active_refs`, NOT nested under it)
   * because `active_refs` is a `ContextRef[]` array; making it an object would
   * be a breaking refactor across the renderer, persistence and dispatcher.
   * Same conceptual lifecycle as `active_refs`: per-conversation, transient,
   * never cross-conversation.
   *
   * OVERWRITE semantics: every successful `discover_places` call replaces this
   * slot in full; never accumulated. TTL is implicit (until the next call).
   *
   * Optional so that pre-existing persisted rows (schema_version=2) load
   * cleanly without a migration. Absent ≡ no candidates yet.
   */
  discovery_candidates?: DiscoveryCandidateRef[];

  /**
   * Current chat surface mode. Persists across mode changes within a conversation.
   * Triggers different reasoning hints in MEMORY_INSTRUCTIONS but does NOT
   * clear or partition any other field.
   */
  mode: 'passenger' | 'agency';

  /**
   * Lightweight, summary-only view of past trips for the lead.
   * NOT the full plan history — fetched on-demand via get_planner_state tool.
   * Cap: last 5 trips, ≤3 lines each.
   */
  trip_history: { trips: TripSummary[] };

  /**
   * Set to `true` by the session layer when a TrimmingSession drops a turn
   * that contained newly-written session_memory notes the model has not yet
   * acknowledged. The next onTurnStart will inject session_memory inline.
   * Cleared back to false after that injection.
   */
  inject_session_memories_next_turn: boolean;

  /**
   * Generic turn-state slot. When non-null, the assistant is awaiting a
   * user reply (slot values, a confirmation, etc.). The next turn injects
   * this into the system prompt and the model invokes `apply_slot_values`
   * or `confirm_pending_action` to resolve it. See PendingAction docstring.
   */
  pending_action: PendingAction | null;

  /** Bookkeeping. Never injected into the prompt. */
  meta: {
    conversation_id: string;
    agency_id: string;
    /** Bump on breaking shape changes. */
    schema_version: number;
    /** ISO 8601. Populated by consolidate phase. */
    last_consolidated_at?: string;
    /** Monotonic, incremented at onTurnStart. */
    turn_count: number;
  };
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export interface CreateInitialEmiliaStateArgs {
  conversationId: string;
  agencyId: string;
  leadId?: string;
  mode?: EmiliaState['mode'];
  /**
   * Optional currency override. Defaults to 'USD' when not provided.
   * Pass explicitly when the agency's preferred currency is known
   * (e.g. from agency_config). See DEBT-9 in docs/architecture/tool-catalog.md.
   */
  currency?: EmiliaProfile['currency'];
  /**
   * Optional language override. Defaults to 'es' when not provided.
   * Pass explicitly when the agency's preferred UI language is known.
   */
  language?: EmiliaProfile['language'];
}

/**
 * Build a fresh EmiliaState for a brand-new conversation.
 *
 * All collections are initialized empty; profile carries only what we know
 * from the conversation creation context (agency, optional lead). Defaults
 * mirror cookbook practice: no speculation, no inferred preferences, the
 * agent fills these as it learns from the user.
 */
export function createInitialEmiliaState(args: CreateInitialEmiliaStateArgs): EmiliaState {
  const { conversationId, agencyId, leadId, mode = 'passenger' } = args;
  const currency = args.currency ?? 'USD';
  const language = args.language ?? 'es';

  return {
    profile: {
      lead_id: leadId,
      agency_id: agencyId,
      currency,
      language,
      preferences: {},
    },
    global_memory: { notes: [] },
    session_memory: { notes: [] },
    active_refs: [],
    mode,
    trip_history: { trips: [] },
    inject_session_memories_next_turn: false,
    pending_action: null,
    meta: {
      conversation_id: conversationId,
      agency_id: agencyId,
      schema_version: SCHEMA_VERSION,
      turn_count: 0,
    },
  };
}

/**
 * Deep clone an EmiliaState. The state is a strictly JSON-compatible tree
 * (no functions, no Dates, no Maps), so `structuredClone` is safe and faster
 * than JSON round-tripping. Falls back to JSON if `structuredClone` is not
 * available (very old runtimes; jsdom / Node 17+ both ship it).
 */
export function cloneEmiliaState(state: EmiliaState): EmiliaState {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state)) as EmiliaState;
}
