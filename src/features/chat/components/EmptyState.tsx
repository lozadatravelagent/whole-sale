import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUp, Loader2, Sparkles, Plane } from 'lucide-react';

interface EmptyStateProps {
  onSendNewMessage: (message: string) => Promise<void>;
  onCreatePlanner?: () => void;
}

// Empty state component with direct input - memoized to prevent re-renders
const EmptyState = React.memo(({ onSendNewMessage, onCreatePlanner }: EmptyStateProps) => {
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
      <div className="text-center max-w-xl w-full px-6">
        <Sparkles className="h-10 w-10 mx-auto mb-6 text-muted-foreground/40" />

        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4 text-foreground">
          ¿Dónde querés viajar hoy?
        </h1>
        <p className="text-lg text-muted-foreground mb-10">
          Buscá vuelos, hoteles o pedí una cotización completa.
        </p>

        <div className="relative">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Preguntale algo a Emilia..."
            disabled={isCreatingChat}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendNewMessage()}
            className="pr-14 h-14 text-base rounded-2xl"
            autoComplete="off"
          />
          <Button
            onClick={handleSendNewMessage}
            disabled={isCreatingChat || !newMessage.trim()}
            className="absolute right-1 top-1 h-12 w-12 rounded-xl p-0"
            size="sm"
          >
            {isCreatingChat ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowUp className="h-5 w-5" />
            )}
          </Button>
        </div>

        {onCreatePlanner && (
          <>
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border/70" />
              <span className="text-sm text-muted-foreground">o</span>
              <div className="flex-1 h-px bg-border/70" />
            </div>

            <button
              onClick={onCreatePlanner}
              className="w-full flex items-center gap-4 rounded-2xl border border-border/70 bg-background/80 hover:bg-muted/50 transition cursor-pointer px-5 py-4 text-left"
            >
              <Plane className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <div className="font-medium text-foreground text-sm">Planificá un viaje</div>
                <div className="text-sm text-muted-foreground">
                  Armá un itinerario día a día con destinos, hoteles y vuelos
                </div>
              </div>
            </button>
          </>
        )}
      </div>
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;