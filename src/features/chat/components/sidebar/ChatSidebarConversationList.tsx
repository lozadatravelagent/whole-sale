import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConversationWithAgency, ConversationWorkspaceMode } from '@/features/chat/types/chat';
import { ChatSidebarConversationRow } from './ChatSidebarConversationRow';

export interface ChatSidebarSection {
  key: ConversationWorkspaceMode | 'planner';
  title: string;
  items: ConversationWithAgency[];
}

interface ChatSidebarConversationListProps {
  sections: ChatSidebarSection[];
  selectedConversation: string | null;
  canArchive: boolean;
  contentSearchResults?: Map<string, string>;
  normalizedQuery: string;
  isSearching?: boolean;
  onSelect: (conversation: ConversationWithAgency) => void;
  onArchive?: (event: React.MouseEvent<HTMLButtonElement>, conversation: ConversationWithAgency) => void;
}

export function ChatSidebarConversationList({
  sections,
  selectedConversation,
  canArchive,
  contentSearchResults,
  normalizedQuery,
  isSearching,
  onSelect,
  onArchive,
}: ChatSidebarConversationListProps) {
  const { t } = useTranslation('chat');
  const allEmpty = sections.every((section) => section.items.length === 0);

  return (
    <div className="flex-1 overflow-hidden p-3">
      <div className="meridian-glass h-full overflow-y-auto rounded-3xl p-3">
        {isSearching && normalizedQuery.length >= 2 && (
          <p className="mb-3 animate-pulse text-center font-utility text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {t('sidebar.searching')}
          </p>
        )}
        {allEmpty ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
            {t('sidebar.noResults')}
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((section) => {
              if (section.items.length === 0) {
                return null;
              }

              return (
                <section key={section.key} className="space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <p className="font-utility text-[10px] font-bold uppercase tracking-[0.28em] text-accent">
                      {section.title}
                    </p>
                    <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                      {section.items.length}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {section.items.map((conversation) => {
                      const snippet =
                        normalizedQuery && contentSearchResults?.has(conversation.id)
                          ? (contentSearchResults.get(conversation.id) ?? '').slice(0, 60)
                          : undefined;
                      return (
                        <ChatSidebarConversationRow
                          key={conversation.id}
                          conversation={conversation}
                          isSelected={selectedConversation === conversation.id}
                          canArchive={canArchive}
                          searchSnippet={snippet}
                          onSelect={onSelect}
                          onArchive={onArchive}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
