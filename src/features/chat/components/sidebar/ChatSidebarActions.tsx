import { useTranslation } from 'react-i18next';
import { Compass, MessageCirclePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatSidebarActionsProps {
  canCreatePlanner: boolean;
  onCreateNewChat: () => void;
  onCreateNewPlanner?: () => void;
}

export function ChatSidebarActions({
  canCreatePlanner,
  onCreateNewChat,
  onCreateNewPlanner,
}: ChatSidebarActionsProps) {
  const { t } = useTranslation('chat');

  return (
    <div className="mt-5 space-y-1.5">
      <Button
        variant="ghost"
        onClick={onCreateNewChat}
        className="meridian-glass h-12 w-full justify-start gap-3 rounded-3xl border border-border/40 px-3 font-utility text-[12px] font-bold uppercase tracking-[0.12em] text-foreground transition-all duration-300 ease-out-expo hover:bg-foreground/5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-foreground/5 text-foreground">
          <MessageCirclePlus className="h-4 w-4" />
        </span>
        <span>{t('sidebar.newChat')}</span>
      </Button>

      {canCreatePlanner && onCreateNewPlanner && (
        <Button
          variant="ghost"
          onClick={onCreateNewPlanner}
          className="meridian-glass h-12 w-full justify-start gap-3 rounded-3xl border border-border/40 px-3 font-utility text-[12px] font-bold uppercase tracking-[0.12em] text-foreground transition-all duration-300 ease-out-expo hover:bg-foreground/5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.12] text-primary">
            <Compass className="h-4 w-4" />
          </span>
          <span>{t('sidebar.planTrip')}</span>
        </Button>
      )}
    </div>
  );
}
