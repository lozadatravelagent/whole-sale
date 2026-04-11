import type { ConversationWithAgency, ConversationWorkspaceMode } from '@/features/chat/types/chat';

export function getChatModeFilter(visibleHistoryMode: ConversationWorkspaceMode): ConversationWorkspaceMode {
  return visibleHistoryMode === 'companion' ? 'companion' : 'standard';
}

export function resolveVisibleHistoryMode(
  historyMode: ConversationWorkspaceMode,
  isPrivileged: boolean
): ConversationWorkspaceMode {
  if (isPrivileged) return historyMode;
  if (historyMode === 'companion') return 'companion';
  return 'standard';
}

/**
 * Strict companion sidebar filter — returns only active conversations with
 * workspace_mode === 'companion'. Used by ChatSidebarCompanion to guarantee
 * no cross-mode leakage into the B2C surface.
 */
export function filterCompanionConversations(
  conversations: ConversationWithAgency[]
): ConversationWithAgency[] {
  return conversations.filter(
    (conversation) => conversation.workspace_mode === 'companion' && conversation.state === 'active'
  );
}
