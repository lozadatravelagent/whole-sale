/**
 * EmiliaState persistence — Phase 1.3 (Context Engineering).
 *
 * Pure async functions (NOT React hooks) that load/save/delete the
 * EmiliaState JSONB blob in `public.agent_states`.
 *
 * Multi-tenant: writes are gated by RLS on `agency_id`; the caller
 * is responsible for ensuring `state.meta.agency_id` is the agency
 * of the currently authenticated user (the EmiliaState factory
 * enforces this — see `emiliaState.ts`).
 *
 * Spec: docs/architecture/context-engineering-spec.md §1, Appendix B.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { EmiliaState } from "./emiliaState";

/**
 * Schema version this client knows how to deserialize.
 * Bump when introducing breaking shape changes to `EmiliaState`.
 * Loads of newer rows refuse rather than silently corrupt.
 *
 * v1 → v2: added optional `pending_action: PendingAction | null` and
 * bumped MAX_GLOBAL_NOTES policy unchanged. v1 rows are forward-compatible
 * (the field defaults to `null` when missing, see migration in `loadEmiliaState`).
 */
export const EMILIA_STATE_SCHEMA_VERSION = 2;

/**
 * Postgrest "no rows returned" code from a `.single()` query.
 * We treat this as "no state yet" (returns null), not as an error.
 */
const PGRST_NO_ROWS = "PGRST116";

interface AgentStateRow {
  conversation_id: string;
  agency_id: string;
  state: Json;
  schema_version: number;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * Load the EmiliaState for a conversation.
 *
 * Returns `null` if no row exists (fresh conversation). Throws if the
 * stored schema_version is newer than this client supports — refusing
 * to load is safer than mutating an unknown shape.
 */
export async function loadEmiliaState(conversationId: string): Promise<EmiliaState | null> {
  if (!conversationId) {
    throw new Error("[EMILIA_STATE] loadEmiliaState: conversationId is required");
  }

  const { data, error } = await supabase
    .from("agent_states")
    .select("conversation_id, agency_id, state, schema_version, created_at, updated_at")
    .eq("conversation_id", conversationId)
    .single();

  if (error) {
    // Not found is a normal case — caller should bootstrap a fresh state.
    if (error.code === PGRST_NO_ROWS) {
      return null;
    }
    throw new Error(
      `[EMILIA_STATE] loadEmiliaState failed for conversation ${conversationId}: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  if (typeof data.schema_version !== "number") {
    throw new Error(
      `[EMILIA_STATE] Stored row for ${conversationId} is missing schema_version`,
    );
  }

  if (data.schema_version > EMILIA_STATE_SCHEMA_VERSION) {
    throw new Error(
      `[EMILIA_STATE] Schema version mismatch for ${conversationId}: ` +
        `stored=${data.schema_version}, client=${EMILIA_STATE_SCHEMA_VERSION}. ` +
        `This client is too old — refusing to load to avoid corruption.`,
    );
  }

  // Forward-migrate v1 rows in place: missing `pending_action` becomes null
  // and we stamp the new schema_version so subsequent saves carry it.
  const raw = data.state as unknown as EmiliaState & { pending_action?: unknown };
  if (data.schema_version < EMILIA_STATE_SCHEMA_VERSION) {
    const migrated: EmiliaState = {
      ...raw,
      pending_action:
        (raw as { pending_action?: EmiliaState['pending_action'] }).pending_action ?? null,
      meta: {
        ...raw.meta,
        schema_version: EMILIA_STATE_SCHEMA_VERSION,
      },
    };
    return migrated;
  }
  return raw as EmiliaState;
}

/**
 * Save (UPSERT) the EmiliaState for a conversation.
 *
 * The conflict target is `conversation_id` (PK), so this overwrites any
 * existing state for that conversation. `agency_id` is denormalized from
 * `state.meta.agency_id` so RLS can enforce isolation without needing to
 * parse the JSONB.
 */
export async function saveEmiliaState(state: EmiliaState): Promise<void> {
  if (!state?.meta?.conversation_id) {
    throw new Error("[EMILIA_STATE] saveEmiliaState: state.meta.conversation_id is required");
  }
  if (!state.meta.agency_id) {
    throw new Error("[EMILIA_STATE] saveEmiliaState: state.meta.agency_id is required");
  }
  if (typeof state.meta.schema_version !== "number") {
    throw new Error("[EMILIA_STATE] saveEmiliaState: state.meta.schema_version is required");
  }

  const row: AgentStateRow = {
    conversation_id: state.meta.conversation_id,
    agency_id: state.meta.agency_id,
    state: state as unknown as Json,
    schema_version: state.meta.schema_version,
  };

  const { error } = await supabase
    .from("agent_states")
    .upsert(row, { onConflict: "conversation_id" });

  if (error) {
    throw new Error(
      `[EMILIA_STATE] saveEmiliaState failed for conversation ${state.meta.conversation_id}: ${error.message}`,
    );
  }
}

/**
 * Delete the EmiliaState for a conversation.
 *
 * Idempotent: deleting a non-existent row is not an error. Mostly used
 * by tests and by the "reset conversation" admin action.
 */
export async function deleteEmiliaState(conversationId: string): Promise<void> {
  if (!conversationId) {
    throw new Error("[EMILIA_STATE] deleteEmiliaState: conversationId is required");
  }

  const { error } = await supabase
    .from("agent_states")
    .delete()
    .eq("conversation_id", conversationId);

  if (error) {
    throw new Error(
      `[EMILIA_STATE] deleteEmiliaState failed for conversation ${conversationId}: ${error.message}`,
    );
  }
}
