import React from 'react';
import { Button } from '@/components/ui/button';
import { Bot, UserPlus, Loader2 } from 'lucide-react';

interface ChatHeaderProps {
  isTyping: boolean;
  isAddingToCRM: boolean;
  selectedConversation: string | null;
  messagesCount: number;
  onAddToCRM: () => void;
}

// Chat header component - memoized to prevent re-renders
const ChatHeader = React.memo(({
  isTyping,
  isAddingToCRM,
  selectedConversation,
  messagesCount,
  onAddToCRM
}: ChatHeaderProps) => (
  <div className="border-b bg-background p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <Bot className="h-8 w-8 text-accent" />
        <div>
          <h2 className="font-semibold">Emilia - Asistente de Viajes</h2>
          <p className="text-sm text-muted-foreground">
            {isTyping ? 'Escribiendo...' : 'En línea'}
          </p>
        </div>
      </div>

      {/* Add to CRM button in header */}
      <Button
        onClick={onAddToCRM}
        disabled={isAddingToCRM || !selectedConversation || messagesCount === 0}
        size="sm"
        variant="outline"
        className="px-3"
        title="Agregar conversación al CRM"
      >
        {isAddingToCRM ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <UserPlus className="h-4 w-4 mr-2" />
        )}
        Generar card en CRM
      </Button>
    </div>
  </div>
));

ChatHeader.displayName = 'ChatHeader';

export default ChatHeader;