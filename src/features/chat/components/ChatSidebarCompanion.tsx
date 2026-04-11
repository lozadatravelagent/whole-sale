import React, { useMemo } from 'react';
import { MessageCirclePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ConversationWithAgency } from '@/features/chat/types/chat';
import { filterCompanionConversations } from '@/features/chat/utils/sidebarFilters';

interface ChatSidebarCompanionProps {
  conversations: ConversationWithAgency[];
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
  onCreateNewChat: () => void;
  className?: string;
}

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

const ChatSidebarCompanion = React.memo(({
  conversations,
  selectedConversation,
  onSelectConversation,
  onCreateNewChat,
  className,
}: ChatSidebarCompanionProps) => {
  const companionConversations = useMemo(
    () => filterCompanionConversations(conversations),
    [conversations]
  );

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col border-r border-border bg-background',
        className
      )}
      data-testid="chat-sidebar-companion"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Mis conversaciones</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCreateNewChat}
          aria-label="Nueva conversación"
        >
          <MessageCirclePlus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {companionConversations.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Aún no hay conversaciones.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {companionConversations.map((conversation) => {
              const isSelected = conversation.id === selectedConversation;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    className={cn(
                      'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                      isSelected && 'bg-muted'
                    )}
                  >
                    <span className="text-sm font-medium text-foreground line-clamp-1">
                      {getConversationTitle(conversation)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatConversationDate(conversation.last_message_at || conversation.created_at)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
});

ChatSidebarCompanion.displayName = 'ChatSidebarCompanion';

export default ChatSidebarCompanion;
