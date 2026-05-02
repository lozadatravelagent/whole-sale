import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatSidebarFrameProps {
  selectedConversation: string | null;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  children: ReactNode;
}

export default function ChatSidebarFrame({
  selectedConversation,
  collapsed,
  onCollapsedChange,
  children,
}: ChatSidebarFrameProps) {
  const { t } = useTranslation('chat');
  return (
    <div
      className={cn(
        selectedConversation ? 'hidden md:flex' : 'flex',
        'relative h-full min-h-0 w-full flex-col flex-shrink-0 transition-[width] duration-200 ease-out',
        collapsed ? 'md:w-14 md:border-r md:border-border md:bg-background' : 'md:w-72'
      )}
    >
      <div className={cn('h-full min-h-0 w-full', collapsed && 'md:hidden')}>
        {children}
      </div>

      {/* When expanded, the collapse trigger lives inline inside ChatSidebar's
          header (next to the search input). This floating button only appears
          when the sidebar is collapsed, so the user can re-open it. */}
      {collapsed && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="meridian-glass absolute left-1/2 top-3 z-20 hidden h-9 w-9 -translate-x-1/2 rounded-full text-muted-foreground transition-all duration-300 ease-out-expo hover:text-foreground md:flex"
          onClick={() => onCollapsedChange(false)}
          aria-label={t('sidebar.expand')}
          title={t('sidebar.expand')}
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
