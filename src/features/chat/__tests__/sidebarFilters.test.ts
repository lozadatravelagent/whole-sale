import { describe, it, expect } from 'vitest';
import {
  getChatModeFilter,
  resolveVisibleHistoryMode,
  filterCompanionConversations,
} from '../utils/sidebarFilters';
import type { ConversationWithAgency } from '../types/chat';

describe('getChatModeFilter', () => {
  it('returns standard for standard historyMode', () => {
    expect(getChatModeFilter('standard')).toBe('standard');
  });

  it('returns companion for companion historyMode', () => {
    expect(getChatModeFilter('companion')).toBe('companion');
  });

  it('returns standard for planner historyMode (planner has its own section)', () => {
    expect(getChatModeFilter('planner')).toBe('standard');
  });
});

describe('resolveVisibleHistoryMode', () => {
  it('privileged user sees whatever mode they selected', () => {
    expect(resolveVisibleHistoryMode('standard', true)).toBe('standard');
    expect(resolveVisibleHistoryMode('planner', true)).toBe('planner');
    expect(resolveVisibleHistoryMode('companion', true)).toBe('companion');
  });

  it('non-privileged user in standard mode sees standard', () => {
    expect(resolveVisibleHistoryMode('standard', false)).toBe('standard');
  });

  it('non-privileged user in companion mode sees companion', () => {
    expect(resolveVisibleHistoryMode('companion', false)).toBe('companion');
  });

  it('non-privileged user cannot see planner — falls back to standard', () => {
    expect(resolveVisibleHistoryMode('planner', false)).toBe('standard');
  });
});

describe('B2B/B2C sidebar isolation', () => {
  const conversations = [
    { workspace_mode: 'standard' as const, id: 'b2b-1' },
    { workspace_mode: 'standard' as const, id: 'b2b-2' },
    { workspace_mode: 'planner' as const, id: 'trip-1' },
    { workspace_mode: 'companion' as const, id: 'b2c-1' },
    { workspace_mode: 'companion' as const, id: 'b2c-2' },
  ];

  it('B2B user sees only standard conversations in chat section', () => {
    const targetMode = getChatModeFilter('standard');
    const result = conversations.filter(c => c.workspace_mode === targetMode);
    expect(result.map(c => c.id)).toEqual(['b2b-1', 'b2b-2']);
  });

  it('B2C user sees only companion conversations in chat section', () => {
    const targetMode = getChatModeFilter('companion');
    const result = conversations.filter(c => c.workspace_mode === targetMode);
    expect(result.map(c => c.id)).toEqual(['b2c-1', 'b2c-2']);
  });

  it('neither mode leaks planner conversations into chat section', () => {
    for (const mode of ['standard', 'companion'] as const) {
      const targetMode = getChatModeFilter(mode);
      const result = conversations.filter(c => c.workspace_mode === targetMode);
      expect(result.every(c => c.workspace_mode !== 'planner')).toBe(true);
    }
  });

  it('agent sidebar filter explicitly excludes companion even when mixed in array (defense in depth)', () => {
    const targetMode = getChatModeFilter('standard');
    const result = conversations.filter(c => c.workspace_mode === targetMode);
    // Defense in depth: even though the array contains 2 companion rows,
    // none of them leak through the B2B 'standard' filter.
    expect(result.some(c => c.workspace_mode === 'companion')).toBe(false);
    expect(result.map(c => c.id)).toEqual(['b2b-1', 'b2b-2']);
  });
});

describe('filterCompanionConversations', () => {
  function makeConv(id: string, overrides: Partial<ConversationWithAgency> = {}): ConversationWithAgency {
    return {
      id,
      external_key: `chat-${id}`,
      channel: 'web',
      state: 'active',
      workspace_mode: 'standard',
      agency_id: null,
      tenant_id: null,
      created_by: 'user-1',
      created_at: '2026-04-10T12:00:00Z',
      last_message_at: '2026-04-10T12:00:00Z',
      ...overrides,
    } as unknown as ConversationWithAgency;
  }

  it('returns only active companion conversations', () => {
    const input = [
      makeConv('c1', { workspace_mode: 'companion' }),
      makeConv('c2', { workspace_mode: 'standard' }),
      makeConv('c3', { workspace_mode: 'planner' }),
      makeConv('c4', { workspace_mode: 'companion' }),
    ];
    const result = filterCompanionConversations(input);
    expect(result.map(c => c.id)).toEqual(['c1', 'c4']);
  });

  it('excludes archived (state=closed) companion conversations', () => {
    const input = [
      makeConv('active', { workspace_mode: 'companion', state: 'active' }),
      makeConv('archived', { workspace_mode: 'companion', state: 'closed' }),
    ];
    const result = filterCompanionConversations(input);
    expect(result.map(c => c.id)).toEqual(['active']);
  });

  it('returns empty when no companion conversations exist', () => {
    const input = [
      makeConv('s1', { workspace_mode: 'standard' }),
      makeConv('p1', { workspace_mode: 'planner' }),
    ];
    expect(filterCompanionConversations(input)).toEqual([]);
  });

  it('does not leak planner or standard rows even when ids suggest otherwise', () => {
    const input = [
      makeConv('companion-like', { workspace_mode: 'standard' }),
      makeConv('really-companion', { workspace_mode: 'companion' }),
    ];
    const result = filterCompanionConversations(input);
    expect(result.map(c => c.id)).toEqual(['really-companion']);
  });
});
