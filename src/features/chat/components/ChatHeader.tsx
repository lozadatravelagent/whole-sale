import React from 'react';
import { Button } from '@/components/ui/button';
import { Bot, UserPlus, Loader2, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface ChatHeaderProps {
  isTyping: boolean;
  isAddingToCRM: boolean;
  selectedConversation: string | null;
  messagesCount: number;
  onAddToCRM: () => void;
  onBackToList?: () => void;
}

// Chat header component - memoized to prevent re-renders
const ChatHeader = React.memo(({
  isTyping,
  isAddingToCRM,
  selectedConversation,
  messagesCount,
  onAddToCRM,
  onBackToList
}: ChatHeaderProps) => (
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
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Bot className="h-6 w-6 md:h-8 md:w-8 text-accent flex-shrink-0" />
        <div className="min-w-0">
          <h2 className="font-semibold text-sm md:text-base truncate">Emilia - Asistente de Viajes</h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            {isTyping ? 'Escribiendo...' : 'En línea'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Theme Toggle */}
        <ThemeToggle variant="compact" />

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
            <UserPlus className="h-3.5 md:h-4 w-3.5 md:w-4 md:mr-2" />
          )}
          <span className="hidden md:inline">Generar card en CRM</span>
          <span className="md:hidden text-xs">CRM</span>
        </Button>
      </div>
    </div>
  </div>
));

ChatHeader.displayName = 'ChatHeader';

export default ChatHeader;