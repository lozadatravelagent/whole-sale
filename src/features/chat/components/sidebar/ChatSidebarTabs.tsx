import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatSidebarTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function ChatSidebarTabs({ activeTab, onTabChange }: ChatSidebarTabsProps) {
  const { t } = useTranslation('chat');

  const tabs: Array<{ key: 'active' | 'archived'; labelKey: 'activeTab' | 'archivedTab' }> = [
    { key: 'active', labelKey: 'activeTab' },
    { key: 'archived', labelKey: 'archivedTab' },
  ];

  return (
    <div className="meridian-glass mt-5 inline-flex rounded-full p-1">
      {tabs.map(({ key, labelKey }) => (
        <Button
          key={key}
          variant="ghost"
          onClick={() => onTabChange(key)}
          className={cn(
            'h-9 rounded-full px-4 font-utility text-[10px] font-bold uppercase tracking-[0.18em] transition-all duration-300 ease-out-expo',
            activeTab === key
              ? 'bg-primary/15 text-primary hover:bg-primary/15'
              : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
          )}
        >
          {t(`sidebar.${labelKey}`)}
        </Button>
      ))}
    </div>
  );
}
