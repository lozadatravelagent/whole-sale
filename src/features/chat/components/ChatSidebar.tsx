import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { ConversationWithAgency, ConversationWorkspaceMode } from '@/features/chat/types/chat';
import { getChatModeFilter, resolveVisibleHistoryMode } from '@/features/chat/utils/sidebarFilters';
import { ChatSidebarSearchHeader } from './sidebar/ChatSidebarSearchHeader';
import { ChatSidebarActions } from './sidebar/ChatSidebarActions';
import { ChatSidebarTabs } from './sidebar/ChatSidebarTabs';
import {
  ChatSidebarConversationList,
  type ChatSidebarSection,
} from './sidebar/ChatSidebarConversationList';
import { getConversationTitle } from './sidebar/sidebarHelpers';

type ChatSidebarSurface = 'agency' | 'companion';

interface ChatSidebarCapabilities {
  canCreatePlanner: boolean;
  canArchiveConversations: boolean;
}

interface ChatSidebarProps {
  conversations: ConversationWithAgency[];
  selectedConversation: string | null;
  activeTab: string;
  historyMode: ConversationWorkspaceMode;
  surface?: ChatSidebarSurface;
  capabilities?: ChatSidebarCapabilities;
  sidebarLimit: number;
  onSelectConversation: (id: string) => void;
  onCreateNewChat: () => void;
  onCreateNewPlanner?: () => void;
  onTabChange: (tab: string) => void;
  onHistoryModeChange?: (mode: ConversationWorkspaceMode) => void;
  onArchiveConversation?: (conversationId: string, currentState: 'active' | 'closed') => void;
  onBackToMainMenu?: () => void;
  showBackToMainMenu?: boolean;
  className?: string;
  contentSearchResults?: Map<string, string>;
  isSearching?: boolean;
  onSearchMessages?: (query: string) => void;
  onClearSearch?: () => void;
  /**
   * When provided, renders an inline collapse button in the sidebar header.
   * Replaces the floating absolute button that previously overlapped search.
   */
  onCollapseSidebar?: () => void;
}

const ChatSidebar = React.memo(({
  conversations,
  selectedConversation,
  activeTab,
  historyMode,
  surface = 'agency',
  capabilities,
  sidebarLimit,
  onSelectConversation,
  onCreateNewChat,
  onCreateNewPlanner,
  onTabChange,
  onHistoryModeChange,
  onArchiveConversation,
  onBackToMainMenu,
  showBackToMainMenu = false,
  className,
  contentSearchResults,
  isSearching,
  onSearchMessages,
  onClearSearch,
  onCollapseSidebar,
}: ChatSidebarProps) => {
  const { t } = useTranslation('chat');
  const { isOwner, isSuperAdmin } = useAuth();
  const [query, setQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const isAgencySurface = surface === 'agency';
  const canCreatePlanner = capabilities?.canCreatePlanner ?? (isAgencySurface && (isOwner || isSuperAdmin));
  const canArchiveConversations = capabilities?.canArchiveConversations ?? (isAgencySurface && Boolean(onArchiveConversation));

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      onClearSearch?.();
      return;
    }

    debounceRef.current = setTimeout(() => {
      onSearchMessages?.(trimmed);
    }, 200);

    return () => clearTimeout(debounceRef.current);
  }, [query, onSearchMessages, onClearSearch]);

  const visibleHistoryMode: ConversationWorkspaceMode = isAgencySurface
    ? resolveVisibleHistoryMode(historyMode, canCreatePlanner)
    : 'companion';
  const chatSectionMode = getChatModeFilter(visibleHistoryMode);

  const handleHistoryModeChange = (mode: ConversationWorkspaceMode) => {
    onHistoryModeChange?.(mode);
  };

  const normalizedQuery = query.trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    const targetState = activeTab === 'archived' ? 'closed' : 'active';
    const visibleModes = canCreatePlanner
      ? new Set<ConversationWorkspaceMode>([chatSectionMode, 'planner'])
      : new Set<ConversationWorkspaceMode>([chatSectionMode]);

    return conversations
      .filter((conversation) => conversation.state === targetState)
      .filter((conversation) => visibleModes.has(conversation.workspace_mode))
      .filter((conversation) => {
        if (!normalizedQuery) {
          return true;
        }

        const title = getConversationTitle(conversation).toLowerCase();
        if (title.includes(normalizedQuery)) return true;

        return contentSearchResults?.has(conversation.id) ?? false;
      })
      .slice(0, sidebarLimit);
  }, [activeTab, canCreatePlanner, chatSectionMode, conversations, normalizedQuery, sidebarLimit, contentSearchResults]);

  const tripConversations = useMemo(() => {
    if (!canCreatePlanner) {
      return [];
    }

    return filteredConversations.filter((conversation) => conversation.workspace_mode === 'planner');
  }, [canCreatePlanner, filteredConversations]);

  const chatConversations = useMemo(() => {
    return filteredConversations.filter((conversation) => conversation.workspace_mode === chatSectionMode);
  }, [chatSectionMode, filteredConversations]);

  const orderedSections = useMemo<ChatSidebarSection[]>(() => {
    const sections: Array<ChatSidebarSection & { visible: boolean }> = [
      {
        key: 'planner' as const,
        title: t('sidebar.tripsTitle'),
        items: tripConversations,
        visible: canCreatePlanner,
      },
      {
        key: chatSectionMode,
        title: t('sidebar.chatsTitle'),
        items: chatConversations,
        visible: true,
      },
    ];

    const visibleSections = sections.filter((section) => section.visible);

    if (visibleHistoryMode === 'planner') {
      visibleSections.sort((left, right) => (left.key === 'planner' ? -1 : right.key === 'planner' ? 1 : 0));
    } else {
      visibleSections.sort((left, right) => (left.key === chatSectionMode ? -1 : right.key === chatSectionMode ? 1 : 0));
    }

    return visibleSections.map(({ key, title, items }) => ({ key, title, items }));
  }, [canCreatePlanner, chatConversations, chatSectionMode, tripConversations, visibleHistoryMode, t]);

  const handleSelect = (conversation: ConversationWithAgency) => {
    handleHistoryModeChange(conversation.workspace_mode);
    onSelectConversation(conversation.id);
  };

  const handleArchive = (
    event: React.MouseEvent<HTMLButtonElement>,
    conversation: ConversationWithAgency,
  ) => {
    event.stopPropagation();
    if (!onArchiveConversation) return;
    onArchiveConversation(conversation.id, conversation.state === 'active' ? 'active' : 'closed');
  };

  const handleCreateNewChat = () => {
    handleHistoryModeChange(chatSectionMode);
    onCreateNewChat();
  };

  const handleCreateNewPlanner = onCreateNewPlanner
    ? () => {
        handleHistoryModeChange('planner');
        onCreateNewPlanner();
      }
    : undefined;

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col border-r border-border/40 bg-background',
        className,
      )}
    >
      <div className="border-b border-border/40 px-4 pb-4 pt-4">
        <ChatSidebarSearchHeader
          query={query}
          onQueryChange={setQuery}
          isSearchFocused={isSearchFocused}
          onFocusChange={setIsSearchFocused}
          onCollapseSidebar={onCollapseSidebar}
          onBackToMainMenu={onBackToMainMenu}
          showBackToMainMenu={showBackToMainMenu}
        />

        <ChatSidebarActions
          canCreatePlanner={canCreatePlanner}
          onCreateNewChat={handleCreateNewChat}
          onCreateNewPlanner={handleCreateNewPlanner}
        />

        <ChatSidebarTabs activeTab={activeTab} onTabChange={onTabChange} />
      </div>

      <ChatSidebarConversationList
        sections={orderedSections}
        selectedConversation={selectedConversation}
        canArchive={canArchiveConversations}
        contentSearchResults={contentSearchResults}
        normalizedQuery={normalizedQuery}
        isSearching={isSearching}
        onSelect={handleSelect}
        onArchive={canArchiveConversations && onArchiveConversation ? handleArchive : undefined}
      />
    </aside>
  );
});

ChatSidebar.displayName = 'ChatSidebar';

export default ChatSidebar;
