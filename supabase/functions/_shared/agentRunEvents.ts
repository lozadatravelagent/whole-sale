export type AgentRunEventStatus = 'ok' | 'error' | 'timeout' | 'skipped';

export interface AgentRunEventInput {
  conversationId: string;
  agencyId: string;
  messageId?: string | null;
  runId: string;
  eventType: string;
  toolName?: string | null;
  status?: AgentRunEventStatus;
  latencyMs?: number | null;
  payload?: Record<string, unknown>;
  error?: string | null;
}

interface SupabaseInsertClient {
  from(table: string): {
    insert(values: Record<string, unknown>): Promise<{ error?: { message?: string } | null }>;
  };
}

function truncateError(error: string | null | undefined): string | null {
  if (!error) return null;
  return error.length > 1000 ? error.slice(0, 1000) : error;
}

export async function recordAgentRunEvent(
  supabase: SupabaseInsertClient,
  input: AgentRunEventInput,
): Promise<void> {
  if (!input.conversationId || !input.agencyId || !input.runId || !input.eventType) {
    return;
  }

  try {
    const { error } = await supabase
      .from('agent_run_events')
      .insert({
        conversation_id: input.conversationId,
        agency_id: input.agencyId,
        message_id: input.messageId ?? null,
        run_id: input.runId,
        event_type: input.eventType,
        tool_name: input.toolName ?? null,
        status: input.status ?? 'ok',
        latency_ms: input.latencyMs ?? null,
        payload: input.payload ?? {},
        error: truncateError(input.error),
      });

    if (error) {
      console.warn('[AGENT-RUN-EVENT] insert failed:', error.message ?? error);
    }
  } catch (err) {
    console.warn('[AGENT-RUN-EVENT] insert threw:', err);
  }
}
