import { useTranslation } from 'react-i18next';
import { ChevronLeft, PanelLeftClose, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ChatSidebarSearchHeaderProps {
  query: string;
  onQueryChange: (query: string) => void;
  isSearchFocused: boolean;
  onFocusChange: (focused: boolean) => void;
  onCollapseSidebar?: () => void;
  onBackToMainMenu?: () => void;
  showBackToMainMenu?: boolean;
}

export function ChatSidebarSearchHeader({
  query,
  onQueryChange,
  isSearchFocused,
  onFocusChange,
  onCollapseSidebar,
  onBackToMainMenu,
  showBackToMainMenu = false,
}: ChatSidebarSearchHeaderProps) {
  const { t } = useTranslation('chat');

  return (
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
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          placeholder={t('sidebar.search')}
          className="h-11 rounded-full border-0 bg-transparent pl-11 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
        />
      </div>

      {onCollapseSidebar && (
        <div
          aria-hidden={isSearchFocused}
          className={cn(
            'hidden overflow-hidden transition-all duration-300 ease-out-expo md:block',
            isSearchFocused ? 'ml-0 max-w-0 opacity-0' : 'ml-2 max-w-[44px] opacity-100',
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapseSidebar}
            aria-label={t('sidebar.collapse')}
            title={t('sidebar.collapse')}
            tabIndex={isSearchFocused ? -1 : 0}
            className="meridian-glass h-11 w-11 shrink-0 rounded-full text-muted-foreground transition-all duration-300 ease-out-expo hover:text-foreground"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
