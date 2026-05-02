/**
 * EmiliaState — types shared between client (`src/features/chat/state/emiliaState.ts`)
 * and Deno edge functions.
 *
 * The client lives in bundler module-resolution mode (no `.ts` extensions allowed
 * in imports). Deno edge functions require explicit `.ts` extensions on relative
 * imports. To keep both worlds happy without coupling tsconfigs, we duplicate the
 * minimal type set here.
 *
 * KEEP IN SYNC with `src/features/chat/state/emiliaState.ts` — if either side
 * changes the shape, update both. Schema version bumps must update both files
 * and the persistence loader.
 */

export const SCHEMA_VERSION = 1;

/** Top-k cap for global memory notes injected into the prompt per turn. */
export const MAX_GLOBAL_NOTES = 6;

/** Top-k cap for session memory notes injected when re-inject flag is set. */
export const MAX_SESSION_NOTES = 8;

export interface EmiliaPreferences {
  budget_band?: 'low' | 'mid' | 'mid-high' | 'high' | 'luxury';
  pace?: 'relaxed' | 'balanced' | 'packed';
  trip_style?: Array<'beach' | 'culture' | 'gastronomy' | 'adventure' | 'family' | 'romantic'>;
  hotel_tier?: '3' | '4' | '5' | 'boutique';
  flight_class?: 'economy' | 'premium-economy' | 'business';
  dietary?: string[];
  party_composition?: {
    adults: number;
    children?: number;
    children_ages?: number[];
  };
}

export interface EmiliaProfile {
  lead_id?: string;
  agency_id: string;
  currency: 'ARS' | 'USD' | 'EUR' | 'BRL' | string;
  default_origin_city?: string;
  default_origin_country?: string;
  language: 'es' | 'en' | 'pt';
  preferences: EmiliaPreferences;
}

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

export interface ContextRef {
  type: 'plan' | 'quote' | 'lead';
  id: string;
  /** ≤120 chars. Pre-rendered one-liner injected verbatim into <active_refs>. */
  summary1Line: string;
  /** ISO 8601. Used to render the "(updated Xmin ago)" hint. */
  lastUpdated: string;
}

export interface TripSummary {
  trip_id: string;
  one_liner: string;
  ended_at: string;
}

export interface EmiliaState {
  profile: EmiliaProfile;
  /**
   * Per-conversation durable knowledge produced by the consolidate phase.
   * SCOPE: per-conversation (Option A — full isolation). The "global" name
   * reflects the LIFECYCLE position (post-consolidate, durable for THIS
   * conversation), not cross-conversation persistence. Starts empty on every
   * new conversation; never loaded from any external lead-level store.
   */
  global_memory: { notes: MemoryNote[] };
  session_memory: { notes: MemoryNote[] };
  active_refs: ContextRef[];
  mode: 'passenger' | 'agency';
  trip_history: { trips: TripSummary[] };
  inject_session_memories_next_turn: boolean;
  meta: {
    conversation_id: string;
    agency_id: string;
    schema_version: number;
    last_consolidated_at?: string;
    turn_count: number;
  };
}
