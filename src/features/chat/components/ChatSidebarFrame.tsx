import type { ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          'absolute right-2 top-2 z-20 hidden h-8 w-8 rounded-full border border-border bg-background/90 p-0 shadow-sm backdrop-blur md:flex',
          collapsed && 'left-1/2 right-auto -translate-x-1/2'
        )}
        onClick={() => onCollapsedChange(!collapsed)}
        aria-label={collapsed ? 'Expandir historial' : 'Colapsar historial'}
        title={collapsed ? 'Expandir historial' : 'Colapsar historial'}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>
    </div>
  );
}
