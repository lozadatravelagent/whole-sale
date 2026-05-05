import { describe, expect, it, vi } from 'vitest';

import { recordAgentRunEvent } from '../agentRunEvents.ts';

function makeSupabaseMock(insertImpl: (value: Record<string, unknown>) => Promise<{ error?: { message?: string } | null }>) {
  const insert = vi.fn(insertImpl);
  const from = vi.fn(() => ({ insert }));
  return { supabase: { from }, from, insert };
}

describe('recordAgentRunEvent', () => {
  it('inserts a normalized append-only event', async () => {
    const { supabase, from, insert } = makeSupabaseMock(async () => ({ error: null }));

    await recordAgentRunEvent(supabase, {
      conversationId: '11111111-1111-1111-1111-111111111111',
      agencyId: '22222222-2222-2222-2222-222222222222',
      runId: '33333333-3333-3333-3333-333333333333',
      eventType: 'tool_result',
      toolName: 'discover_places',
      latencyMs: 42,
      payload: { iteration: 1 },
    });

    expect(from).toHaveBeenCalledWith('agent_run_events');
    expect(insert).toHaveBeenCalledWith({
      conversation_id: '11111111-1111-1111-1111-111111111111',
      agency_id: '22222222-2222-2222-2222-222222222222',
      message_id: null,
      run_id: '33333333-3333-3333-3333-333333333333',
      event_type: 'tool_result',
      tool_name: 'discover_places',
      status: 'ok',
      latency_ms: 42,
      payload: { iteration: 1 },
      error: null,
    });
  });

  it('is best-effort when insertion fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { supabase } = makeSupabaseMock(async () => ({ error: { message: 'rls denied' } }));

    await expect(recordAgentRunEvent(supabase, {
      conversationId: 'conv',
      agencyId: 'agency',
      runId: 'run',
      eventType: 'parser_start',
    })).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('skips incomplete events without touching Supabase', async () => {
    const { supabase, from } = makeSupabaseMock(async () => ({ error: null }));

    await recordAgentRunEvent(supabase, {
      conversationId: '',
      agencyId: 'agency',
      runId: 'run',
      eventType: 'parser_start',
    });

    expect(from).not.toHaveBeenCalled();
  });
});
