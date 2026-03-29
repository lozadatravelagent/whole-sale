import { Button } from '@/components/ui/button';
import type { ChatRecommendedPlace } from '../services/conversationOrchestrator';

interface RecommendedPlacesListProps {
  places: ChatRecommendedPlace[];
  onExplore?: (place: ChatRecommendedPlace) => void;
  onAdd?: (place: ChatRecommendedPlace) => void;
  title?: string;
  subtitle?: string;
  addLabel?: string;
  exploreLabel?: string;
}

function formatSlotLabel(slot?: 'morning' | 'afternoon' | 'evening') {
  if (slot === 'morning') return 'Mañana';
  if (slot === 'afternoon') return 'Tarde';
  if (slot === 'evening') return 'Noche';
  return 'Sugerido';
}

export default function RecommendedPlacesList({ places, onExplore, onAdd, title = 'Lugares recomendados', subtitle, addLabel = 'Sumarlo', exploreLabel = 'Ver más' }: RecommendedPlacesListProps) {
  if (places.length === 0) return null;

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="px-1">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
        {places.map((place) => (
          <div key={`${place.city}-${place.name}`} className="rounded-xl border bg-card overflow-hidden w-[280px] shrink-0 snap-start">
            {place.photoUrl ? (
              <img
                src={place.photoUrl}
                alt={place.name}
                className="w-full h-28 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-28 bg-muted flex items-center justify-center text-3xl">
                📍
              </div>
            )}

            <div className="p-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm leading-snug line-clamp-2">{place.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {place.city} · {formatSlotLabel(place.suggestedSlot)}
                  </p>
                </div>
                <span className="text-[11px] shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                  {place.category}
                </span>
              </div>

              {place.description && (
                <p className="text-xs text-muted-foreground line-clamp-3">{place.description}</p>
              )}

              {(onExplore || onAdd) && (
                <div className="flex gap-2 pt-1">
                  {onAdd && (
                    <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => onAdd(place)}>
                      {addLabel}
                    </Button>
                  )}
                  {onExplore && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onExplore(place)}>
                      {exploreLabel}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
