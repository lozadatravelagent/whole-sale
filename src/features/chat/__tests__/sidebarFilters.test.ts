import { describe, it, expect } from 'vitest';
import { getChatModeFilter, resolveVisibleHistoryMode } from '../utils/sidebarFilters';

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
});
