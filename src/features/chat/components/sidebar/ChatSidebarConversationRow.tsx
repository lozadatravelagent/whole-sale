import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArchiveRestore, ArchiveX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ConversationWithAgency } from '@/features/chat/types/chat';
import {
  getConversationSubtitle,
  getConversationTitle,
  getTitleInitials,
  getTripGradient,
} from './sidebarHelpers';

interface ChatSidebarConversationRowProps {
  conversation: ConversationWithAgency;
  isSelected: boolean;
  canArchive: boolean;
  searchSnippet?: string;
  onSelect: (conversation: ConversationWithAgency) => void;
  onArchive?: (event: React.MouseEvent<HTMLButtonElement>, conversation: ConversationWithAgency) => void;
}

export function ChatSidebarConversationRow({
  conversation,
  isSelected,
  canArchive,
  searchSnippet,
  onSelect,
  onArchive,
}: ChatSidebarConversationRowProps) {
  const { t } = useTranslation('chat');

  const title = getConversationTitle(conversation);
  const isTrip = conversation.workspace_mode === 'planner';
  const isArchived = conversation.state === 'closed';

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer items-center rounded-2xl px-3 py-2.5 transition-all duration-300 ease-out-expo',
        isTrip ? 'gap-3' : 'gap-0',
        isSelected
          ? 'bg-primary/12 border border-primary/25'
          : 'border border-transparent hover:bg-foreground/5',
      )}
      onClick={() => onSelect(conversation)}
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
        <p
          className={cn(
            'truncate text-[15px] font-medium',
            isSelected ? 'text-primary' : 'text-foreground',
          )}
        >
          {title}
        </p>
        <p className="truncate font-mono text-[11px] tracking-[0.05em] text-muted-foreground">
          {searchSnippet ?? getConversationSubtitle(conversation)}
        </p>
      </div>

      {canArchive && onArchive && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(event) => onArchive(event, conversation)}
          className="h-8 w-8 rounded-full opacity-0 transition group-hover:opacity-100 hover:bg-foreground/10"
          title={isArchived ? t('sidebar.restore') : t('sidebar.archive')}
        >
          {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <ArchiveX className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}
