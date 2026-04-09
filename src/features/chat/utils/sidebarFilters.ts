import type { ConversationWorkspaceMode } from '@/features/chat/types/chat';

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
