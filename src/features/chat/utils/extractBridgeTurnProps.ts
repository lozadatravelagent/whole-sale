import type { MessageRow } from '../types/chat';

export type BridgeChatMode = 'agency' | 'passenger';

export interface BridgeTurnProps {
  suggestedMode: BridgeChatMode;
  originalUserText: string;
  canRender: boolean;
}

// PR 3 (C4): given a conversation's messages array, detect whether the last
// assistant turn is a `mode_bridge` turn and extract the data the chip block
// needs to render. Returns null when the last turn isn't a bridge; returns a
// `canRender: false` result when the bridge turn exists but there's no
// preceding user message to replay (defensive — shouldn't happen in practice
// because bridge turns are persisted in response to a user message).
export function extractBridgeTurnProps(messages: MessageRow[] | null | undefined): BridgeTurnProps | null {
  if (!messages || messages.length === 0) return null;

  const last = messages[messages.length - 1];
  if (last.role !== 'assistant') return null;

  const meta = (last.meta as Record<string, unknown> | null | undefined) || undefined;
  if (!meta) return null;

  const conversationTurn = meta.conversationTurn as
    | { executionBranch?: string; uiMeta?: { suggestedMode?: BridgeChatMode } }
    | undefined;

  const isBridge =
    meta.messageType === 'mode_bridge' || conversationTurn?.executionBranch === 'mode_bridge';
  if (!isBridge) return null;

  const suggestedMode =
    (meta.suggestedMode as BridgeChatMode | undefined) ||
    conversationTurn?.uiMeta?.suggestedMode;
  if (suggestedMode !== 'agency' && suggestedMode !== 'passenger') return null;

  let originalUserText = '';
  for (let i = messages.length - 2; i >= 0; i--) {
    if (messages[i].role === 'user') {
      const content = messages[i].content;
      if (typeof content === 'string') {
        originalUserText = content;
      } else if (content && typeof content === 'object' && 'text' in content) {
        const textField = (content as { text?: unknown }).text;
        originalUserText = typeof textField === 'string' ? textField : '';
      }
      break;
    }
  }

  return {
    suggestedMode,
    originalUserText,
    canRender: originalUserText.length > 0,
  };
}
