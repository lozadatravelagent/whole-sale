import { describe, it, expect } from 'vitest';
import { buildConversationsQuery, normalizeConversation } from '@/hooks/useChat';

describe('buildConversationsQuery', () => {
  it('agent account → RPC path preserving B2B visibility expansion', () => {
    const descriptor = buildConversationsQuery('agent', 'uid-agent');

    expect(descriptor).toEqual({
      kind: 'rpc',
      rpcName: 'get_conversations_with_agency',
      orderBy: { column: 'last_message_at', ascending: false },
    });
  });

  it('undefined accountType falls back to RPC path (safe default for B2B)', () => {
    const descriptor = buildConversationsQuery(undefined, undefined);

    expect(descriptor.kind).toBe('rpc');
  });

  it('consumer with userId → direct conversations select filtered by created_by', () => {
    const descriptor = buildConversationsQuery('consumer', 'uid-42');

    expect(descriptor).toEqual({
      kind: 'table',
      table: 'conversations',
      select: '*',
      eq: { column: 'created_by', value: 'uid-42' },
      orderBy: { column: 'last_message_at', ascending: false },
    });
  });

  it('consumer without userId (null or undefined) → direct select without eq, no crash', () => {
    for (const userId of [null, undefined] as const) {
      const descriptor = buildConversationsQuery('consumer', userId);

      expect(descriptor.kind).toBe('table');
      expect(descriptor).toMatchObject({
        kind: 'table',
        table: 'conversations',
        select: '*',
        eq: null,
        orderBy: { column: 'last_message_at', ascending: false },
      });
    }
  });
});

describe('normalizeConversation', () => {
  it('preserves workspace_mode="companion" (not downgraded to "standard")', () => {
    const input = {
      id: 'conv-companion-1',
      workspace_mode: 'companion' as const,
      external_key: 'Mi viaje',
      state: 'active' as const,
    };

    const result = normalizeConversation(input);

    expect(result.workspace_mode).toBe('companion');
  });

  it('still resolves workspace_mode="standard" as "standard" (regression guard)', () => {
    const input = {
      id: 'conv-standard-1',
      workspace_mode: 'standard' as const,
      external_key: 'Chat 01/01/2026',
    };

    const result = normalizeConversation(input);

    expect(result.workspace_mode).toBe('standard');
  });
});
