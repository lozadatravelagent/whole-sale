import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2 } from 'lucide-react';

interface EmptyStateProps {
  onSendNewMessage: (message: string) => Promise<void>;
}

// Empty state component with direct input - memoized to prevent re-renders
const EmptyState = React.memo(({ onSendNewMessage }: EmptyStateProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  const handleSendNewMessage = useCallback(async () => {
    if (!newMessage.trim() || isCreatingChat) return;

    const messageToSend = newMessage.trim();
    setIsCreatingChat(true);

    try {
      await onSendNewMessage(messageToSend);
      setNewMessage('');
    } catch (error) {
      console.error('❌ [NEW CHAT] Error creating conversation or sending message:', error);
    } finally {
      setIsCreatingChat(false);
    }
  }, [newMessage, isCreatingChat, onSendNewMessage]);

  return (
    <div className="flex-1 flex items-center justify-center bg-muted/20">
      <div className="text-center max-w-2xl w-full px-6">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-8 text-foreground">
            ¿Donde queres viajar hoy?
          </h1>
        </div>

        <div className="relative">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Pregunta lo que quieras..."
            disabled={isCreatingChat}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendNewMessage()}
            className="pr-12 h-12 text-base rounded-full"
            autoComplete="off"
          />
          <Button
            onClick={handleSendNewMessage}
            disabled={isCreatingChat || !newMessage.trim()}
            className="absolute right-1 top-1 h-10 w-10 rounded-full p-0"
            size="sm"
          >
            {isCreatingChat ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;