import { useTranslation } from 'react-i18next';
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

export default function RecommendedPlacesList({ places, onExplore, onAdd, title, subtitle, addLabel, exploreLabel }: RecommendedPlacesListProps) {
  const { t } = useTranslation('chat');

  const formatSlotLabel = (slot?: 'morning' | 'afternoon' | 'evening') => {
    if (slot === 'morning') return t('recommendedPlaces.slots.morning');
    if (slot === 'afternoon') return t('recommendedPlaces.slots.afternoon');
    if (slot === 'evening') return t('recommendedPlaces.slots.evening');
    return t('recommendedPlaces.slots.suggested');
  };

  const formatPlaceBadge = (place: ChatRecommendedPlace) => {
    const knownBuckets = ['imperdibles', 'historia', 'museos', 'barrios', 'miradores', 'parques', 'gastronomia', 'noche'];
    if (place.bucket && knownBuckets.includes(place.bucket)) {
      return t(`recommendedPlaces.badges.${place.bucket}`);
    }
    return place.category;
  };

  const resolvedTitle = title ?? t('recommendedPlaces.title');
  const resolvedAddLabel = addLabel ?? t('recommendedPlaces.addToTrip');
  const resolvedExploreLabel = exploreLabel ?? t('recommendedPlaces.showMore');

  if (places.length === 0) return null;

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="px-1">
        <p className="text-xs font-medium text-muted-foreground">{resolvedTitle}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{subtitle}</p>}
      </div>
      <div className="relative">
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
                    {formatPlaceBadge(place)}
                  </span>
                </div>

                {place.description && (
                  <p className="text-xs text-muted-foreground line-clamp-3">{place.description}</p>
                )}

                {(onExplore || onAdd) && (
                  <div className="flex gap-2 pt-1">
                    {onAdd && (
                      <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => onAdd(place)}>
                        {resolvedAddLabel}
                      </Button>
                    )}
                    {onExplore && (
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onExplore(place)}>
                        {resolvedExploreLabel}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* C7.1.d: static gradient fade as scroll affordance. Carousel has
            overflow-x-auto + scrollbarWidth:'none' (hidden scrollbar) — without
            this cue users with mouse-only input assume the overflowing cards
            are clipped. Anchored to the wrapper's right edge; the 16px bleed
            from the carousel's `-mx-4` ends inside the messages container
            padding which is also `bg-background`, so the fade reads
            continuous. */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
