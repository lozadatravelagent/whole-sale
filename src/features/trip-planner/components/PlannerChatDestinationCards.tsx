import { MapPin, Plus, Star } from 'lucide-react';
import type { PlannerPlaceCandidate } from '../types';

const TRUSTED_PHOTO_CATEGORIES = new Set<PlannerPlaceCandidate['category']>(['museum', 'sights', 'culture', 'activity', 'parks', 'restaurant', 'cafe']);

function isSyntheticPlaceId(placeId?: string): boolean {
  return /^(activity|restaurant)-/i.test(placeId || '');
}

function hasTrustedPhotoSource(place: PlannerPlaceCandidate): boolean {
  return (place.source === 'foursquare' || place.source === 'google_maps')
    && Boolean(place.placeId)
    && !isSyntheticPlaceId(place.placeId)
    && Boolean(place.photoUrls?.[0]);
}

function shouldUseCardPhoto(place: PlannerPlaceCandidate): boolean {
  return TRUSTED_PHOTO_CATEGORIES.has(place.category) && hasTrustedPhotoSource(place);
}

export function DiscoveryPlaceCard({ place, onClick, onAddClick }: { place: PlannerPlaceCandidate; onClick?: () => void; onAddClick?: () => void }) {
  const coverPhoto = shouldUseCardPhoto(place) ? place.photoUrls?.[0] : undefined;

  return (
    <div className="group relative w-40 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm transition-shadow hover:shadow-md" onClick={onClick}>
      <div className="relative">
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt={place.name}
            className="h-28 w-full object-cover"
          />
        ) : (
          <div className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <MapPin className="h-6 w-6 text-primary/40" />
          </div>
        )}
        {(onAddClick || onClick) && (
          <button
            type="button"
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); (onAddClick || onClick)?.(); }}
            title="Agregar al itinerario"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-1 text-[13px] font-semibold leading-tight text-foreground">
          {place.name}
        </p>
        {place.formattedAddress && (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{place.formattedAddress}</p>
        )}
        {place.rating != null && (
          <div className="mt-0.5 flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium text-foreground">
              {place.rating.toFixed(1)}
            </span>
            {place.userRatingsTotal != null && (
              <span className="text-[11px] text-muted-foreground">
                ({place.userRatingsTotal.toLocaleString()})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
