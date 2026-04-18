import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkle, Plus, Loader2, ChevronLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import ModeSwitch from './ModeSwitch';

interface ChatHeaderProps {
  isTyping: boolean;
  isAddingToCRM: boolean;
  selectedConversation: string | null;
  messagesCount: number;
  onAddToCRM: () => void;
  onBackToList?: () => void;
  /**
   * PR 3 (C5): account type gates agent-only chrome (CRM card button, theme
   * toggle, ModeSwitch). Replaces the previous `mode: 'companion' | 'standard'`
   * prop. Same invariant: `showAgentChrome = accountType === 'agent'`.
   */
  accountType: 'consumer' | 'agent';
  /**
   * PR 3 (C5): strict chat mode for agents. Required for rendering the
   * ModeSwitch. When undefined (shouldn't happen in practice post-C5 because
   * ChatFeature always passes it for agent) the switch is suppressed.
   */
  mode?: 'agency' | 'passenger';
  /**
   * PR 3 (C6): whether the user has an agency assigned. Drives the
   * ModeSwitch's "agency" toggle disabled state + tooltip. Defaults to false
   * defensively.
   */
  hasAgency?: boolean;
  /**
   * PR 3 (C6): callback wired from ChatFeature's setChatMode. Fired when the
   * agent clicks either toggle in the ModeSwitch.
   */
  onModeChange?: (next: 'agency' | 'passenger') => void;
}

// Chat header component - memoized to prevent re-renders
const ChatHeader = React.memo(({
  isTyping,
  isAddingToCRM,
  selectedConversation,
  messagesCount,
  onAddToCRM,
  onBackToList,
  accountType,
  mode,
  hasAgency = false,
  onModeChange,
}: ChatHeaderProps) => {
  const showAgentChrome = accountType === 'agent';
  const showModeSwitch = showAgentChrome && mode !== undefined && onModeChange !== undefined;

  return (
    <div className="border-b bg-background p-3 md:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
          {/* Back button - Only visible on mobile */}
          {onBackToList && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToList}
              className="md:hidden p-1 h-8 w-8 flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <Sparkle className="h-6 w-6 md:h-8 md:w-8 text-accent flex-shrink-0" />
          <div className="min-w-0">
            <h2 className="font-semibold text-sm md:text-base truncate">Emilia</h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              {isTyping ? 'Escribiendo...' : 'En línea'}
            </p>
          </div>
        </div>

        {showAgentChrome && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* PR 3 (C6): ModeSwitch — agency/passenger toggle. First in the
                agent-only row so it reads left-to-right before the utility
                buttons. Suppressed if either `mode` or `onModeChange` is
                missing (defensive; shouldn't happen for agents post-C5). */}
            {showModeSwitch && mode && onModeChange && (
              <ModeSwitch
                mode={mode}
                hasAgency={hasAgency}
                onModeChange={onModeChange}
                className="hidden md:inline-flex"
              />
            )}

            {/* Theme Toggle - Hidden on mobile, shown on desktop */}
            <ThemeToggle variant="compact" className="hidden md:flex" />

            {/* Add to CRM button in header */}
            <Button
              onClick={onAddToCRM}
              disabled={isAddingToCRM || !selectedConversation || messagesCount === 0}
              size="sm"
              variant="outline"
              className="px-2 md:px-3"
              title="Agregar conversación al CRM"
            >
              {isAddingToCRM ? (
                <Loader2 className="h-3.5 md:h-4 w-3.5 md:w-4 animate-spin md:mr-2" />
              ) : (
                <Plus className="h-3.5 md:h-4 w-3.5 md:w-4 md:mr-2" />
              )}
              <span className="hidden md:inline">Generar card en CRM</span>
              <span className="md:hidden text-xs">CRM</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';

export default ChatHeader;
