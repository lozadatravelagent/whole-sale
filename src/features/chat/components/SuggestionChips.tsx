import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Hotel, Loader2, MapPin, Pencil, Plane, Plus } from 'lucide-react';
import type { DiscoveryCard, PlannerSuggestion, PlannerSuggestionType } from '@/features/trip-planner/types';

const ICON_BY_TYPE: Record<PlannerSuggestionType, React.ElementType> = {
  flight: Plane,
  hotel: Hotel,
  activity: MapPin,
  edit: Pencil,
  confirm: Check,
};

interface SuggestionChipsProps {
  suggestions: PlannerSuggestion[];
  onSuggestionClick: (suggestion: PlannerSuggestion) => void;
  loadingAction?: string | null;
  discoveryCards?: DiscoveryCard[];
  onDiscoveryAdd?: (card: DiscoveryCard) => void;
}

function SuggestionChips({ suggestions, onSuggestionClick, loadingAction, discoveryCards, onDiscoveryAdd }: SuggestionChipsProps) {
  const hasChips = suggestions.length > 0;
  const hasCards = discoveryCards && discoveryCards.length > 0;

  if (!hasChips && !hasCards) return null;

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {hasChips && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => {
            const Icon = ICON_BY_TYPE[suggestion.type];
            const isLoading = loadingAction === suggestion.id;

            return (
              <Button
                key={suggestion.id}
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={() => onSuggestionClick(suggestion)}
                className="gap-1.5"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                {suggestion.label}
              </Button>
            );
          })}
        </div>
      )}

      {hasCards && onDiscoveryAdd && (
        <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {discoveryCards.map((card) => (
            <button
              key={`${card.label}-${card.city}`}
              type="button"
              className="group relative shrink-0 rounded-lg border bg-background p-3 text-left shadow-sm transition-shadow hover:shadow-md min-w-[200px] max-w-[240px]"
              onClick={() => onDiscoveryAdd(card)}
            >
              <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                <Plus className="h-3 w-3" />
              </div>
              <p className="text-sm font-semibold text-foreground line-clamp-1">{card.label}</p>
              {card.description && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{card.description}</p>
              )}
              <div className="mt-1.5 flex items-center gap-1.5">
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px]">{card.city}</Badge>
                <span className="text-[10px] text-muted-foreground capitalize">{card.type}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(SuggestionChips);
