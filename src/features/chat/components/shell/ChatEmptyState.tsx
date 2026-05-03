import React from 'react';
import { AuroraBackdrop, MeridianHeading, MeridianMono } from '@/components/meridian';
import { cn } from '@/lib/utils';

interface ChatEmptyStateProps {
  /** Suggested prompt chips. Empty array hides the row. */
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}

const DEFAULT_SUGGESTIONS = [
  'Quiero 7 días en Italia con mi pareja',
  'Buscame vuelos a Cancún para julio',
  'Cotizame París para una familia',
  'Hotel boutique en Buenos Aires',
];

/**
 * Meridian chat empty-state. Aurora atmosphere + animated orbit mark +
 * gradient title + suggestion chips.
 */
const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({
  suggestions = DEFAULT_SUGGESTIONS,
  onSuggestionClick,
  title,
  subtitle,
  className,
}) => {
  return (
    <div className={cn('relative flex h-full min-h-[480px] flex-col items-center justify-center overflow-hidden px-6 py-12', className)}>
      <AuroraBackdrop intensity="full" withGrid />

      <div className="relative z-10 flex max-w-3xl flex-col items-center px-2 text-center animate-meridian-fade-up">
        <MeridianHeading as="h1" size="lg" gradient italic className="mb-4 overflow-visible px-2">
          {title ?? (
            <>
              ¿A dónde<br />vamos hoy?
            </>
          )}
        </MeridianHeading>

        <p className="mb-9 max-w-md text-sm font-light leading-relaxed text-muted-foreground">
          {subtitle ?? 'Contame qué buscás. Yo arranco la conversación con vuelos, hoteles y un itinerario listo para enviar.'}
        </p>

        {suggestions.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick?.(suggestion)}
                className={cn(
                  'meridian-glass rounded-full px-4 py-2',
                  'font-utility text-[11px] font-bold uppercase tracking-[0.06em]',
                  'text-foreground/80 transition-all duration-300 ease-out-expo',
                  'hover:-translate-y-0.5 hover:bg-foreground/[0.06] hover:text-foreground'
                )}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <MeridianMono size="xs" className="mt-12 text-muted-foreground/40">
          MERIDIAN · 2025
        </MeridianMono>
      </div>
    </div>
  );
};

export default ChatEmptyState;
