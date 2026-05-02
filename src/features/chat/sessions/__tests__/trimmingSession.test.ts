/**
 * Tests for TrimmingSession — Phase 4.1.
 *
 * Spec: docs/architecture/context-engineering-spec.md §7.1
 *
 * Cases covered:
 *   - Less than maxTurns → keeps all
 *   - Exactly maxTurns → keeps all
 *   - maxTurns + 1 → drops oldest user turn (and the assistant + tool items
 *     between it and the next kept user turn)
 *   - Tool messages mid-turn preserved
 *   - Stats update correctly across operations
 */

import { describe, expect, it } from 'vitest';
import { TrimmingSession, type ChatSessionItem } from '../trimmingSession';

interface TestItem extends ChatSessionItem {
  id: string;
  text?: string;
}

const u = (id: string): TestItem => ({ role: 'user', id });
const a = (id: string): TestItem => ({ role: 'assistant', id });
const t = (id: string): TestItem => ({ role: 'tool', id });
const s = (id: string): TestItem => ({ role: 'system', id });

describe('TrimmingSession', () => {
  it('keeps everything when buffer has fewer user turns than maxTurns', () => {
    const session = new TrimmingSession<TestItem>(6);
    session.addItems([u('u1'), a('a1'), u('u2'), a('a2'), u('u3')]);

    const items = session.getItems();
    expect(items.map((i) => i.id)).toEqual(['u1', 'a1', 'u2', 'a2', 'u3']);
    expect(session.getStats().totalItems).toBe(5);
    expect(session.getStats().droppedItems).toBe(0);
  });

  it('keeps everything when buffer has exactly maxTurns user turns', () => {
    const session = new TrimmingSession<TestItem>(3);
    session.addItems([u('u1'), a('a1'), u('u2'), a('a2'), u('u3'), a('a3')]);

    const items = session.getItems();
    expect(items.map((i) => i.id)).toEqual(['u1', 'a1', 'u2', 'a2', 'u3', 'a3']);
    expect(session.getStats().droppedItems).toBe(0);
  });

  it('drops the oldest user turn (with its assistant + tool items) when buffer exceeds maxTurns by 1', () => {
    const session = new TrimmingSession<TestItem>(2);
    // u1 is the oldest user turn; it owns a1 and t1 between itself and u2.
    // After trim with maxTurns=2 we should keep u2, u3, and everything after u2.
    session.addItems([
      u('u1'), a('a1'), t('t1'),
      u('u2'), a('a2'),
      u('u3'), a('a3'),
    ]);

    const items = session.getItems();
    expect(items.map((i) => i.id)).toEqual(['u2', 'a2', 'u3', 'a3']);
    expect(session.getStats().droppedItems).toBe(3); // u1, a1, t1 all gone
  });

  it('preserves tool messages that fall inside a kept turn', () => {
    const session = new TrimmingSession<TestItem>(2);
    session.addItems([
      u('u1'), a('a1'),
      u('u2'), t('t2a'), a('a2'), t('t2b'),
      u('u3'), a('a3'),
    ]);

    const items = session.getItems();
    // u1's window is dropped; u2's window keeps tool calls inline.
    expect(items.map((i) => i.id)).toEqual(['u2', 't2a', 'a2', 't2b', 'u3', 'a3']);
  });

  it('keeps system prompts that sit inside the kept window', () => {
    const session = new TrimmingSession<TestItem>(1);
    session.addItems([s('sys-old'), u('u1'), s('sys-mid'), a('a1')]);

    const items = session.getItems();
    // Walk-backward starts at u1, so sys-old is dropped (pre-window),
    // sys-mid is kept (post-window).
    expect(items.map((i) => i.id)).toEqual(['u1', 'sys-mid', 'a1']);
    expect(session.getStats().droppedItems).toBe(1);
  });

  it('respects an explicit limit on top of the trimmed window', () => {
    const session = new TrimmingSession<TestItem>(3);
    session.addItems([u('u1'), a('a1'), u('u2'), a('a2'), u('u3'), a('a3')]);
    const items = session.getItems(2);
    // Window keeps all 6, limit truncates to last 2.
    expect(items.map((i) => i.id)).toEqual(['u3', 'a3']);
  });

  it('clear() empties the buffer and updates stats', () => {
    const session = new TrimmingSession<TestItem>(2);
    session.addItems([u('u1'), a('a1'), u('u2'), a('a2')]);
    session.clear();
    expect(session.getItems()).toEqual([]);
    const stats = session.getStats();
    expect(stats.totalItems).toBe(0);
    expect(stats.droppedItems).toBeGreaterThanOrEqual(4);
    expect(stats.lastTrimAt).toBeTypeOf('number');
  });

  it('setMaxTurns adjusts the window dynamically', () => {
    const session = new TrimmingSession<TestItem>(3);
    session.addItems([u('u1'), a('a1'), u('u2'), a('a2'), u('u3'), a('a3')]);
    expect(session.getItems()).toHaveLength(6);

    session.setMaxTurns(1);
    const items = session.getItems();
    expect(items.map((i) => i.id)).toEqual(['u3', 'a3']);
  });

  it('handles addItems called incrementally', () => {
    const session = new TrimmingSession<TestItem>(2);
    session.addItems([u('u1')]);
    session.addItems([a('a1')]);
    session.addItems([u('u2')]);
    session.addItems([a('a2'), u('u3'), a('a3')]);

    const items = session.getItems();
    expect(items.map((i) => i.id)).toEqual(['u2', 'a2', 'u3', 'a3']);
  });
});
