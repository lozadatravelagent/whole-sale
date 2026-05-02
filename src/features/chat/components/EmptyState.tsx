import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUp, Loader2, Plane } from 'lucide-react';
import {
  AuroraBackdrop,
  MeridianHeading,
  MeridianMono,
  MeridianTag,
  OrbitMark,
} from '@/components/meridian';

interface EmptyStateProps {
  onSendNewMessage: (message: string) => Promise<void>;
  onCreatePlanner?: () => void;
}

// Empty state component with direct input - memoized to prevent re-renders
const EmptyState = React.memo(({ onSendNewMessage, onCreatePlanner }: EmptyStateProps) => {
  const { t } = useTranslation('chat');
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
    <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-background">
      <AuroraBackdrop intensity="full" withGrid />

      <div className="relative z-10 w-full max-w-xl px-6 py-12 text-center animate-meridian-fade-up">
        <div className="relative mb-7 inline-block">
          <OrbitMark size={88} animated />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 animate-meridian-glow-pulse"
            style={{
              background: 'radial-gradient(circle, hsl(var(--primary) / 0.3), transparent 70%)',
            }}
          />
        </div>

        <MeridianTag tone="lilac" className="mb-4">
          {t('emptyState.tag')}
        </MeridianTag>

        <MeridianHeading as="h1" size="lg" gradient italic className="mb-4">
          {t('emptyState.title')}
        </MeridianHeading>

        <p className="font-sans text-sm md:text-base font-light leading-relaxed text-muted-foreground mb-10 max-w-md mx-auto">
          {t('emptyState.subtitle')}
        </p>

        <div className="meridian-glass relative rounded-3xl p-1.5 transition-all duration-300 ease-out-expo focus-within:border-primary/40 focus-within:shadow-glow">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('emptyState.placeholder')}
            disabled={isCreatingChat}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendNewMessage()}
            className="h-12 rounded-2xl border-0 bg-transparent pl-4 pr-14 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
            autoComplete="off"
          />
          <Button
            onClick={handleSendNewMessage}
            disabled={isCreatingChat || !newMessage.trim()}
            variant="meridian"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-2xl"
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
              <div className="flex-1 h-px bg-foreground/10" />
              <MeridianMono size="xs" className="text-muted-foreground/60">{t('emptyState.or')}</MeridianMono>
              <div className="flex-1 h-px bg-foreground/10" />
            </div>

            <button
              onClick={onCreatePlanner}
              className="meridian-glass group w-full flex items-center gap-4 rounded-3xl px-5 py-4 text-left transition-all duration-300 ease-out-expo hover:bg-foreground/[0.06] hover:-translate-y-0.5"
            >
              <Plane className="h-5 w-5 text-primary shrink-0 transition-transform duration-300 ease-out-expo group-hover:translate-x-1" />
              <div>
                <div className="font-display italic text-base text-foreground">{t('emptyState.planTripLabel')}</div>
                <div className="font-sans text-sm text-muted-foreground">
                  {t('emptyState.planTripDescription')}
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
