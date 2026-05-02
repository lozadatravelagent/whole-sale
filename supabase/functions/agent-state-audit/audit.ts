// =============================================================================
// agent-state-audit / audit.ts — pure orchestration (Phase 8.6)
// =============================================================================
//
// Extracted from `index.ts` so vitest can import the data-flow without pulling
// in Deno-only `serve` and `std/http` URL imports. The HTTP entry point in
// `index.ts` is responsible only for:
//   - CORS / OPTIONS
//   - JWT extraction + validation
//   - Building the supabase client (RLS-bound or service-role)
//   - Calling `buildAuditPayload` and serializing the response
//
// This file is the deterministic, data-only core: given a supabase client and
// a parsed URL, produce the audit payload or a structured error.
// =============================================================================

import { renderStateForSystemPrompt } from "../_shared/renderState.ts";
import type { EmiliaState } from "../_shared/emiliaStateTypes.ts";

// -----------------------------------------------------------------------------
// Public response shape
// -----------------------------------------------------------------------------

export interface AgentStateAuditResponse {
  conversation_id: string;
  agency_id: string;
  /** Full EmiliaState JSON. May be null if no agent_states row exists yet. */
  state_snapshot: EmiliaState | null;
  /** Up to 3 messages before + 1 message after the anchor message. */
  messages_around_turn: Array<{
    id: string;
    role: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    meta: any;
    created_at: string;
  }>;
  /**
   * Tool calls extracted from the anchor message's `meta.toolLoop.trace`.
   * Empty array when the parser was invoked in legacy single-shot mode.
   */
  tool_calls_for_turn: Array<{
    tool: string;
    latencyMs?: number;
    error?: string;
  }>;
  tokens_for_turn: {
    prompt: number | null;
    completion: number | null;
    total: number | null;
  };
  /** Output of `renderStateForSystemPrompt(state_snapshot)` or empty string. */
  rendered_memory_block: string;
}

// -----------------------------------------------------------------------------
// resolveAnchorMessage
// -----------------------------------------------------------------------------

/**
 * Resolve the anchor message and conversation_id given the query params.
 *
 * Two modes:
 *   - `?message_id=...`        → anchor is that exact message
 *   - `?conversation_id=...&turn=N` → anchor is the Nth assistant message
 *     (1-indexed) in that conversation, ordered by created_at asc.
 *
 * Throws on RLS / DB errors so the caller can map to 5xx.
 */
export async function resolveAnchorMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  url: URL,
): Promise<
  | { ok: true; message: { id: string; conversation_id: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      meta: any; role: string; created_at: string } }
  | { ok: false; status: 400 | 404; reason: string }
> {
  const messageId = url.searchParams.get('message_id');
  const conversationId = url.searchParams.get('conversation_id');
  const turnRaw = url.searchParams.get('turn');

  if (messageId) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, role, content, meta, created_at')
      .eq('id', messageId)
      .maybeSingle();

    if (error) throw new Error(`messages_lookup_failed: ${error.message}`);
    if (!data) return { ok: false, status: 404, reason: 'message_not_found' };
    return { ok: true, message: data };
  }

  if (conversationId && turnRaw) {
    const turn = Number.parseInt(turnRaw, 10);
    if (!Number.isFinite(turn) || turn < 1) {
      return { ok: false, status: 400, reason: 'invalid_turn' };
    }

    // Walk assistant messages in order, picking the Nth.
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, role, content, meta, created_at')
      .eq('conversation_id', conversationId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: true })
      .limit(Math.max(turn, 50));

    if (error) throw new Error(`messages_lookup_failed: ${error.message}`);
    const list = (data ?? []) as Array<{
      id: string; conversation_id: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      meta: any; role: string; created_at: string;
    }>;
    if (list.length < turn) {
      return { ok: false, status: 404, reason: 'turn_not_found' };
    }
    return { ok: true, message: list[turn - 1] };
  }

  return {
    ok: false,
    status: 400,
    reason: 'missing_query_params',
  };
}

// -----------------------------------------------------------------------------
// extractToolLoopFromMeta
// -----------------------------------------------------------------------------

/**
 * Pull the trace + usage block out of `messages.meta.toolLoop` written by
 * `ai-message-parser`. Falls back to empty/null when the field is absent
 * (legacy single-shot turns or non-parser messages).
 */
export function extractToolLoopFromMeta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta: any,
): {
  tool_calls: AgentStateAuditResponse['tool_calls_for_turn'];
  tokens: AgentStateAuditResponse['tokens_for_turn'];
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolLoop = meta?.toolLoop as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usage = meta?.usage as any;

  const trace = Array.isArray(toolLoop?.trace) ? toolLoop.trace : [];
  return {
    tool_calls: trace.map((t: { tool?: unknown; latencyMs?: unknown; error?: unknown }) => ({
      tool: typeof t.tool === 'string' ? t.tool : 'unknown',
      latencyMs: typeof t.latencyMs === 'number' ? t.latencyMs : undefined,
      error: typeof t.error === 'string' ? t.error : undefined,
    })),
    tokens: {
      prompt: typeof usage?.promptTokens === 'number' ? usage.promptTokens : null,
      completion: typeof usage?.completionTokens === 'number' ? usage.completionTokens : null,
      total: typeof usage?.totalTokens === 'number' ? usage.totalTokens : null,
    },
  };
}

// -----------------------------------------------------------------------------
// buildAuditPayload — the single orchestration function
// -----------------------------------------------------------------------------

/**
 * Pure orchestration: takes a supabase client (already JWT-bound for RLS) and
 * a parsed URL, and returns either an audit payload or a structured error.
 *
 * No I/O outside the supabase client; safe to test with an in-memory mock.
 */
export async function buildAuditPayload(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  url: URL,
): Promise<
  | { ok: true; status: 200; body: AgentStateAuditResponse }
  | { ok: false; status: 400 | 403 | 404; reason: string }
> {
  const anchor = await resolveAnchorMessage(supabase, url);
  if (!anchor.ok) return anchor;

  const conversationId = anchor.message.conversation_id;
  const anchorCreatedAt = anchor.message.created_at;

  // Fetch the conversation to recover agency_id (and to confirm RLS access).
  const { data: convRow, error: convErr } = await supabase
    .from('conversations')
    .select('id, agency_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (convErr) {
    // RLS denial typically surfaces as PGRST116-ish or empty result, not error.
    // Treat any error here as forbidden (don't leak details).
    return { ok: false, status: 403, reason: 'forbidden' };
  }
  if (!convRow) {
    return { ok: false, status: 403, reason: 'forbidden' };
  }

  const agencyId = convRow.agency_id as string;

  // Fetch state snapshot (may legitimately be null).
  const { data: stateRow, error: stateErr } = await supabase
    .from('agent_states')
    .select('state')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (stateErr && stateErr.code !== 'PGRST116') {
    return { ok: false, status: 403, reason: 'forbidden' };
  }
  const stateSnapshot = (stateRow?.state ?? null) as EmiliaState | null;

  // Fetch up to 3 messages before + 1 after the anchor.
  // We do two queries to avoid an OR with mixed orderings.
  const { data: beforeData, error: beforeErr } = await supabase
    .from('messages')
    .select('id, role, content, meta, created_at')
    .eq('conversation_id', conversationId)
    .lt('created_at', anchorCreatedAt)
    .order('created_at', { ascending: false })
    .limit(3);

  if (beforeErr) {
    return { ok: false, status: 403, reason: 'forbidden' };
  }

  const { data: afterData, error: afterErr } = await supabase
    .from('messages')
    .select('id, role, content, meta, created_at')
    .eq('conversation_id', conversationId)
    .gt('created_at', anchorCreatedAt)
    .order('created_at', { ascending: true })
    .limit(1);

  if (afterErr) {
    return { ok: false, status: 403, reason: 'forbidden' };
  }

  // Reverse the "before" rows so the final array reads chronologically.
  const before = ((beforeData ?? []) as Array<{
    id: string; role: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    meta: any; created_at: string;
  }>).slice().reverse();
  const messagesAround = [
    ...before,
    {
      id: anchor.message.id,
      role: anchor.message.role,
      content: anchor.message.content,
      meta: anchor.message.meta,
      created_at: anchor.message.created_at,
    },
    ...((afterData ?? []) as Array<{
      id: string; role: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      meta: any; created_at: string;
    }>),
  ];

  const { tool_calls, tokens } = extractToolLoopFromMeta(anchor.message.meta);

  const renderedMemoryBlock = stateSnapshot
    ? renderStateForSystemPrompt(stateSnapshot)
    : '';

  return {
    ok: true,
    status: 200,
    body: {
      conversation_id: conversationId,
      agency_id: agencyId,
      state_snapshot: stateSnapshot,
      messages_around_turn: messagesAround,
      tool_calls_for_turn: tool_calls,
      tokens_for_turn: tokens,
      rendered_memory_block: renderedMemoryBlock,
    },
  };
}
