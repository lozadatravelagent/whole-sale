import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, Hotel, Loader2, MapPin, Pencil, Plane } from 'lucide-react';
import type { PlannerSuggestion, PlannerSuggestionType } from '@/features/trip-planner/types';

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
}

function SuggestionChips({ suggestions, onSuggestionClick, loadingAction }: SuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
  );
}

export default React.memo(SuggestionChips);
