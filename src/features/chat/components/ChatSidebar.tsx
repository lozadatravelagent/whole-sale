import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ArchiveX,
  ArchiveRestore,
  Compass,
  MessageCirclePlus,
  PanelLeftClose,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { ConversationWithAgency, ConversationWorkspaceMode } from '@/features/chat/types/chat';
import { getChatModeFilter, resolveVisibleHistoryMode } from '@/features/chat/utils/sidebarFilters';

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

// Aurora-tinted trip gradients — Meridian palette (violet / cobalt / lilac
// / coral / mint), no slate-blue legacy.
const tripGradients = [
  'linear-gradient(135deg, hsl(248 60% 12%) 0%, hsl(262 75% 55%) 100%)',
  'linear-gradient(135deg, hsl(248 50% 7%) 0%, hsl(220 70% 60%) 100%)',
  'linear-gradient(135deg, hsl(258 50% 14%) 0%, hsl(255 80% 72%) 100%)',
  'linear-gradient(135deg, hsl(252 38% 22%) 0%, hsl(14 65% 70%) 100%)',
  'linear-gradient(135deg, hsl(248 50% 10%) 0%, hsl(175 40% 60%) 100%)',
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

  const orderedSections = useMemo(() => {
    const sections = [
      {
        key: 'planner' as const,
        title: 'Trips',
        items: tripConversations,
        visible: canCreatePlanner,
      },
      {
        key: chatSectionMode,
        title: 'Chats',
        items: chatConversations,
        visible: true,
      },
    ].filter((section) => section.visible);

    if (visibleHistoryMode === 'planner') {
      return sections.sort((left, right) => (left.key === 'planner' ? -1 : right.key === 'planner' ? 1 : 0));
    }

    return sections.sort((left, right) => (left.key === chatSectionMode ? -1 : right.key === chatSectionMode ? 1 : 0));
  }, [canCreatePlanner, chatConversations, chatSectionMode, tripConversations, visibleHistoryMode]);

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
          "group relative flex cursor-pointer items-center rounded-2xl px-3 py-2.5 transition-all duration-300 ease-out-expo",
          isTrip ? "gap-3" : "gap-0",
          isSelected
            ? "bg-primary/12 border border-primary/25"
            : "border border-transparent hover:bg-foreground/5"
        )}
        onClick={() => {
          handleHistoryModeChange(conversation.workspace_mode);
          onSelectConversation(conversation.id);
        }}
      >
        {isTrip ? (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-utility text-[11px] font-bold uppercase tracking-[0.06em] text-primary-foreground shadow-md"
            style={{ background: getTripGradient(title) }}
          >
            {getTitleInitials(title)}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className={cn(
            "truncate text-[15px] font-medium",
            isSelected ? "text-primary" : "text-foreground"
          )}>{title}</p>
          <p className="truncate font-mono text-[11px] tracking-[0.05em] text-muted-foreground">
            {normalizedQuery && contentSearchResults?.has(conversation.id)
              ? (contentSearchResults.get(conversation.id) ?? '').slice(0, 60)
              : getConversationSubtitle(conversation)}
          </p>
        </div>

        {canArchiveConversations && onArchiveConversation && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => handleArchiveClick(event, conversation.id, conversation.state)}
            className="h-8 w-8 rounded-full opacity-0 transition group-hover:opacity-100 hover:bg-foreground/10"
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
        "flex h-full w-full flex-col border-r border-border/40 bg-background",
        className
      )}
    >
      <div className="border-b border-border/40 px-4 pb-4 pt-4">
        <div className="flex items-center">
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
              className="meridian-glass mr-2 h-11 w-11 shrink-0 rounded-full text-muted-foreground transition-all duration-300 ease-out-expo hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          <div className="meridian-glass relative flex-1 rounded-full transition-all duration-300 ease-out-expo focus-within:border-primary/40 focus-within:shadow-glow">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Buscar…"
              className="h-11 rounded-full border-0 bg-transparent pl-11 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
            />
          </div>

          {onCollapseSidebar && (
            <div
              aria-hidden={isSearchFocused}
              className={cn(
                "hidden overflow-hidden transition-all duration-300 ease-out-expo md:block",
                isSearchFocused
                  ? "ml-0 max-w-0 opacity-0"
                  : "ml-2 max-w-[44px] opacity-100"
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={onCollapseSidebar}
                aria-label="Colapsar historial"
                title="Colapsar historial"
                tabIndex={isSearchFocused ? -1 : 0}
                className="meridian-glass h-11 w-11 shrink-0 rounded-full text-muted-foreground transition-all duration-300 ease-out-expo hover:text-foreground"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-1.5">
          <Button
            variant="ghost"
            onClick={() => {
              handleHistoryModeChange(chatSectionMode);
              onCreateNewChat();
            }}
            className="h-12 w-full justify-start gap-3 rounded-2xl px-3 font-utility text-[12px] font-bold uppercase tracking-[0.12em] text-foreground transition-all duration-300 ease-out-expo hover:bg-foreground/5"
          >
            <span className="meridian-glass flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-foreground">
              <MessageCirclePlus className="h-4 w-4" />
            </span>
            <span>Nuevo chat</span>
          </Button>

          {canCreatePlanner && onCreateNewPlanner && (
            <Button
              variant="ghost"
              onClick={() => {
                handleHistoryModeChange('planner');
                onCreateNewPlanner();
              }}
              className="h-12 w-full justify-start gap-3 rounded-2xl px-3 font-utility text-[12px] font-bold uppercase tracking-[0.12em] text-foreground transition-all duration-300 ease-out-expo hover:bg-foreground/5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.12] text-primary">
                <Compass className="h-4 w-4" />
              </span>
              <span>Planificá un viaje</span>
            </Button>
          )}
        </div>

        <div className="meridian-glass mt-5 inline-flex rounded-full p-1">
          <Button
            variant="ghost"
            onClick={() => onTabChange('active')}
            className={cn(
              "h-9 rounded-full px-4 font-utility text-[10px] font-bold uppercase tracking-[0.18em] transition-all duration-300 ease-out-expo",
              activeTab === 'active'
                ? "bg-primary/15 text-primary hover:bg-primary/15"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            )}
          >
            Activas
          </Button>
          <Button
            variant="ghost"
            onClick={() => onTabChange('archived')}
            className={cn(
              "h-9 rounded-full px-4 font-utility text-[10px] font-bold uppercase tracking-[0.18em] transition-all duration-300 ease-out-expo",
              activeTab === 'archived'
                ? "bg-primary/15 text-primary hover:bg-primary/15"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            )}
          >
            Archivadas
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-3">
        <div className="meridian-glass h-full overflow-y-auto rounded-3xl p-3">
          {isSearching && normalizedQuery.length >= 2 && (
            <p className="mb-3 animate-pulse text-center font-utility text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Buscando…</p>
          )}
          {orderedSections.every((section) => section.items.length === 0) ? (
            <div className="rounded-2xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
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
                    <div className="flex items-center justify-between px-2">
                      <p className="font-utility text-[10px] font-bold uppercase tracking-[0.28em] text-accent">
                        {section.title}
                      </p>
                      <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground">{section.items.length}</span>
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
      </div>
    </aside>
  );
});

ChatSidebar.displayName = 'ChatSidebar';

export default ChatSidebar;
