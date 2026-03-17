import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ArchiveX,
  ArchiveRestore,
  Compass,
  MessageCirclePlus,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { ConversationWithAgency, ConversationWorkspaceMode } from '@/features/chat/types/chat';

interface ChatSidebarProps {
  conversations: ConversationWithAgency[];
  selectedConversation: string | null;
  activeTab: string;
  historyMode: ConversationWorkspaceMode;
  sidebarLimit: number;
  onSelectConversation: (id: string) => void;
  onCreateNewChat: () => void;
  onCreateNewPlanner: () => void;
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
}

const tripGradients = [
  'linear-gradient(135deg, #0f172a 0%, #2563eb 100%)',
  'linear-gradient(135deg, #134e4a 0%, #14b8a6 100%)',
  'linear-gradient(135deg, #3f3f46 0%, #84cc16 100%)',
  'linear-gradient(135deg, #4c1d95 0%, #f59e0b 100%)',
  'linear-gradient(135deg, #1d4ed8 0%, #06b6d4 100%)',
];

const formatConversationDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
  }).format(date);
};

const getConversationTitle = (conversation: ConversationWithAgency) => {
  return conversation.external_key || `Chat ${new Date(conversation.created_at).toLocaleDateString()}`;
};

const getConversationSubtitle = (conversation: ConversationWithAgency) => {
  return formatConversationDate(conversation.last_message_at || conversation.created_at);
};

const getTripGradient = (value: string) => {
  const hash = Array.from(value).reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
  return tripGradients[hash % tripGradients.length];
};

const getTitleInitials = (title: string) => {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'VB';
};

const ChatSidebar = React.memo(({
  conversations,
  selectedConversation,
  activeTab,
  historyMode,
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
}: ChatSidebarProps) => {
  const { isOwner, isSuperAdmin } = useAuth();
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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

  const visibleHistoryMode: ConversationWorkspaceMode = isOwner || isSuperAdmin ? historyMode : 'standard';
  const handleHistoryModeChange = (mode: ConversationWorkspaceMode) => {
    onHistoryModeChange?.(mode);
  };

  const normalizedQuery = query.trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    const targetState = activeTab === 'archived' ? 'closed' : 'active';

    return conversations
      .filter((conversation) => conversation.state === targetState)
      .filter((conversation) => {
        if (!normalizedQuery) {
          return true;
        }

        const title = getConversationTitle(conversation).toLowerCase();
        if (title.includes(normalizedQuery)) return true;

        return contentSearchResults?.has(conversation.id) ?? false;
      })
      .slice(0, sidebarLimit);
  }, [activeTab, conversations, normalizedQuery, sidebarLimit, contentSearchResults]);

  const tripConversations = useMemo(() => {
    if (!isOwner && !isSuperAdmin) {
      return [];
    }

    return filteredConversations.filter((conversation) => conversation.workspace_mode === 'planner');
  }, [filteredConversations, isOwner, isSuperAdmin]);

  const chatConversations = useMemo(() => {
    return filteredConversations.filter((conversation) => conversation.workspace_mode === 'standard');
  }, [filteredConversations]);

  const orderedSections = useMemo(() => {
    const sections = [
      {
        key: 'planner' as const,
        title: 'Trips',
        items: tripConversations,
        visible: isOwner || isSuperAdmin,
      },
      {
        key: 'standard' as const,
        title: 'Chats',
        items: chatConversations,
        visible: true,
      },
    ].filter((section) => section.visible);

    if (visibleHistoryMode === 'planner') {
      return sections.sort((left, right) => (left.key === 'planner' ? -1 : right.key === 'planner' ? 1 : 0));
    }

    return sections.sort((left, right) => (left.key === 'standard' ? -1 : right.key === 'standard' ? 1 : 0));
  }, [chatConversations, isOwner, isSuperAdmin, tripConversations, visibleHistoryMode]);

  const handleArchiveClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    conversationId: string,
    currentState: 'active' | 'closed' | 'pending'
  ) => {
    event.stopPropagation();

    if (!onArchiveConversation) {
      return;
    }

    onArchiveConversation(conversationId, currentState === 'active' ? 'active' : 'closed');
  };

  const renderConversationRow = (conversation: ConversationWithAgency) => {
    const title = getConversationTitle(conversation);
    const isSelected = selectedConversation === conversation.id;
    const isTrip = conversation.workspace_mode === 'planner';
    const isArchived = conversation.state === 'closed';

    return (
      <div
        key={conversation.id}
        className={cn(
          "group relative flex cursor-pointer items-center rounded-2xl px-2.5 py-2 transition",
          isTrip ? "gap-3" : "gap-0",
          isSelected
            ? "bg-foreground/6 dark:bg-white/10"
            : "hover:bg-foreground/4 dark:hover:bg-white/5"
        )}
        onClick={() => {
          handleHistoryModeChange(conversation.workspace_mode);
          onSelectConversation(conversation.id);
        }}
      >
        {isTrip ? (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
            style={{ background: getTripGradient(title) }}
          >
            {getTitleInitials(title)}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-foreground">{title}</p>
          <p className="truncate text-sm text-muted-foreground">
            {normalizedQuery && contentSearchResults?.has(conversation.id)
              ? (contentSearchResults.get(conversation.id) ?? '').slice(0, 60)
              : getConversationSubtitle(conversation)}
          </p>
        </div>

        {onArchiveConversation && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => handleArchiveClick(event, conversation.id, conversation.state)}
            className="h-8 w-8 rounded-full opacity-0 transition group-hover:opacity-100 hover:bg-background dark:hover:bg-card"
            title={isArchived ? 'Restaurar conversación' : 'Archivar conversación'}
          >
            {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <ArchiveX className="h-4 w-4" />}
          </Button>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col border-r border-border/70 bg-gradient-card shadow-card backdrop-blur-xl",
        className
      )}
    >
      <div className="border-b border-border/60 px-4 pb-4 pt-4">
        <div className="flex items-center gap-2">
          {showBackToMainMenu && onBackToMainMenu && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBackToMainMenu}
              onMouseDown={(event) => {
                if (event.button === 0) {
                  onBackToMainMenu();
                }
              }}
              className="h-11 w-11 shrink-0 rounded-full border border-border/70 bg-background/85 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground dark:bg-card/85 dark:hover:bg-card"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar..."
              className="h-12 rounded-full border-0 bg-muted/60 pl-11 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-foreground/10 focus-visible:ring-offset-0 dark:bg-background/50"
            />
          </div>
        </div>

        <div className="mt-5 space-y-1">
          <Button
            variant="ghost"
            onClick={() => {
              handleHistoryModeChange('standard');
              onCreateNewChat();
            }}
            className="h-12 w-full justify-start gap-3 rounded-2xl px-3 text-[15px] font-medium hover:bg-background dark:hover:bg-card/80"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.9rem] border border-border/60 bg-foreground/[0.03] text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.05)] dark:bg-white/[0.04]">
              <MessageCirclePlus className="h-4 w-4" />
            </span>
            <span>Nuevo Chat</span>
          </Button>

          {(isOwner || isSuperAdmin) && (
            <Button
              variant="ghost"
              onClick={() => {
                handleHistoryModeChange('planner');
                onCreateNewPlanner();
              }}
              className="h-12 w-full justify-start gap-3 rounded-2xl px-3 text-[15px] font-medium hover:bg-background dark:hover:bg-card/80"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.9rem] border border-primary/15 bg-primary/[0.08] text-primary shadow-[0_8px_20px_rgba(37,99,235,0.12)] dark:border-primary/20 dark:bg-primary/12">
                <Compass className="h-4 w-4" />
              </span>
              <span>Planifica un viaje</span>
            </Button>
          )}
        </div>

        <div className="mt-5 inline-flex rounded-full bg-muted/60 p-1 dark:bg-background/50">
          <Button
            variant="ghost"
            onClick={() => onTabChange('active')}
            className={cn(
              "h-9 rounded-full px-4 text-xs font-medium",
              activeTab === 'active' && "bg-background shadow-sm hover:bg-background dark:bg-card dark:hover:bg-card"
            )}
          >
            Activas
          </Button>
          <Button
            variant="ghost"
            onClick={() => onTabChange('archived')}
            className={cn(
              "h-9 rounded-full px-4 text-xs font-medium",
              activeTab === 'archived' && "bg-background shadow-sm hover:bg-background dark:bg-card dark:hover:bg-card"
            )}
          >
            Archivadas
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {isSearching && normalizedQuery.length >= 2 && (
          <p className="mb-3 animate-pulse text-center text-sm text-muted-foreground">Buscando...</p>
        )}
        {orderedSections.every((section) => section.items.length === 0) ? (
          <div className="rounded-3xl border border-dashed border-border bg-background/70 px-4 py-8 text-center text-sm text-muted-foreground dark:bg-card/60">
            No se encontraron conversaciones en esta vista.
          </div>
        ) : (
          <div className="space-y-6">
            {orderedSections.map((section) => {
              if (section.items.length === 0) {
                return null;
              }

              return (
                <section key={section.key} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {section.title}
                    </p>
                    <span className="text-xs text-muted-foreground">{section.items.length}</span>
                  </div>

                  <div className="space-y-1">
                    {section.items.map(renderConversationRow)}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
});

ChatSidebar.displayName = 'ChatSidebar';

export default ChatSidebar;
