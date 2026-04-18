import { describe, expect, it } from 'vitest';
import { extractBridgeTurnProps } from '../utils/extractBridgeTurnProps';
import type { MessageRow } from '../types/chat';

function userMsg(text: string, id = `u-${text}`): MessageRow {
  return {
    id,
    conversation_id: 'c1',
    role: 'user',
    content: { text } as unknown as MessageRow['content'],
    meta: null,
    created_at: new Date().toISOString(),
    client_id: null,
    source: null,
  } as MessageRow;
}

function bridgeAssistantMsg(suggestedMode: 'agency' | 'passenger' | null, opts: { viaConversationTurn?: boolean } = {}): MessageRow {
  const meta = opts.viaConversationTurn
    ? {
        conversationTurn: {
          executionBranch: 'mode_bridge',
          uiMeta: { suggestedMode },
        },
      }
    : {
        messageType: 'mode_bridge',
        suggestedMode,
      };
  return {
    id: `a-bridge-${suggestedMode ?? 'none'}`,
    conversation_id: 'c1',
    role: 'assistant',
    content: { text: 'bridge title' } as unknown as MessageRow['content'],
    meta: meta as unknown as MessageRow['meta'],
    created_at: new Date().toISOString(),
    client_id: null,
    source: null,
  } as MessageRow;
}

function nonBridgeAssistantMsg(messageType: string): MessageRow {
  return {
    id: `a-${messageType}`,
    conversation_id: 'c1',
    role: 'assistant',
    content: { text: 'other' } as unknown as MessageRow['content'],
    meta: { messageType } as unknown as MessageRow['meta'],
    created_at: new Date().toISOString(),
    client_id: null,
    source: null,
  } as MessageRow;
}

describe('extractBridgeTurnProps', () => {
  it('returns null for empty history', () => {
    expect(extractBridgeTurnProps([])).toBeNull();
    expect(extractBridgeTurnProps(null)).toBeNull();
    expect(extractBridgeTurnProps(undefined)).toBeNull();
  });

  it('returns null when last message is not assistant', () => {
    expect(extractBridgeTurnProps([userMsg('hi')])).toBeNull();
  });

  it('returns null when last assistant has no bridge metadata', () => {
    expect(extractBridgeTurnProps([userMsg('hi'), nonBridgeAssistantMsg('collect_question')])).toBeNull();
    expect(extractBridgeTurnProps([userMsg('hi'), nonBridgeAssistantMsg('search_results')])).toBeNull();
  });

  it('reads bridge via direct meta: meta.messageType=mode_bridge + meta.suggestedMode', () => {
    const result = extractBridgeTurnProps([
      userMsg('cotizame vuelos BUE-MAD'),
      bridgeAssistantMsg('agency'),
    ]);
    expect(result).toEqual({
      suggestedMode: 'agency',
      originalUserText: 'cotizame vuelos BUE-MAD',
      canRender: true,
    });
  });

  it('reads bridge via conversationTurn.uiMeta fallback path', () => {
    const result = extractBridgeTurnProps([
      userMsg('armame Italia'),
      bridgeAssistantMsg('passenger', { viaConversationTurn: true }),
    ]);
    expect(result).toEqual({
      suggestedMode: 'passenger',
      originalUserText: 'armame Italia',
      canRender: true,
    });
  });

  it('orphan bridge (no preceding user message) → canRender=false', () => {
    const result = extractBridgeTurnProps([bridgeAssistantMsg('agency')]);
    expect(result).toEqual({
      suggestedMode: 'agency',
      originalUserText: '',
      canRender: false,
    });
  });

  it('returns null when bridge is present but suggestedMode is missing/invalid', () => {
    const result = extractBridgeTurnProps([
      userMsg('hi'),
      bridgeAssistantMsg(null),
    ]);
    expect(result).toBeNull();
  });

  it('finds most recent user message when multiple assistant msgs precede the bridge', () => {
    const result = extractBridgeTurnProps([
      userMsg('old user msg', 'old-u'),
      nonBridgeAssistantMsg('search_results'),
      userMsg('newer user msg', 'new-u'),
      bridgeAssistantMsg('agency'),
    ]);
    expect(result?.originalUserText).toBe('newer user msg');
  });
});
