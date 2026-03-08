import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Star,
} from 'lucide-react';
import type { PlaceDetails, PlaceReview } from '../services/placesService';
import type { PlannerPlaceCandidate } from '../types';
import { getPlannerPlaceCategoryLabel } from '../services/plannerPlaceMapper';

export interface PlaceDetailData {
  place: PlannerPlaceCandidate;
  details: PlaceDetails | null;
  loading: boolean;
}

interface PlannerPlaceDetailBodyProps {
  data: PlaceDetailData;
  onAddToItinerary?: () => void;
  canAdd?: boolean;
}

export function PlannerPlaceDetailBody({ data, onAddToItinerary, canAdd = true }: PlannerPlaceDetailBodyProps) {
  const { place, details, loading } = data;
  const photos = details?.photoUrls?.length ? details.photoUrls : place.photoUrls;
  const rating = details?.rating ?? place.rating;
  const totalReviews = details?.userRatingsTotal ?? place.userRatingsTotal;
  const address = details?.formattedAddress ?? place.formattedAddress;
  const phone = details?.phoneNumber ?? place.phoneNumber;
  const website = details?.website ?? place.website;
  const hours = details?.openingHours ?? place.openingHours;
  const isOpen = details?.isOpenNow ?? place.isOpenNow;
  const reviews = details?.reviews;

  return (
    <div className="flex-1 overflow-y-auto">
      {photos.length > 0 ? (
        <div>
          <img
            src={photos[0]}
            alt={place.name}
            className="h-56 w-full object-cover"
          />
          {photos.length > 1 && (
            <div className="flex gap-0.5 bg-background p-0.5">
              {photos.slice(1, 4).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="h-20 flex-1 rounded object-cover"
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
          <MapPin className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
            {getPlannerPlaceCategoryLabel(place.category)}
          </Badge>
          {isOpen === true && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              Abierto ahora
            </span>
          )}
          {isOpen === false && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
              Cerrado
            </span>
          )}
        </div>

        <h2 className="text-xl font-semibold tracking-tight">{place.name}</h2>

        {rating != null && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.round(rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'fill-muted text-muted'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-medium">{rating.toFixed(1)}</span>
            {totalReviews != null && (
              <span className="text-sm text-muted-foreground">
                ({totalReviews.toLocaleString()})
              </span>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando detalles...
          </div>
        )}

        <div className="space-y-3">
          {address && (
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span>{address}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <a href={`tel:${phone}`} className="hover:underline">{phone}</a>
            </div>
          )}
          {website && (
            <div className="flex items-center gap-3 text-sm">
              <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
              >
                {(() => {
                  try { return new URL(website).hostname; }
                  catch { return website; }
                })()}
              </a>
            </div>
          )}
          {place.placeId && (
            <div className="flex items-center gap-3 text-sm">
              <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.placeId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Ver en Google Maps
              </a>
            </div>
          )}
        </div>

        {hours && hours.length > 0 && (
          <div className="rounded-xl border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Horarios
            </div>
            <div className="mt-2.5 space-y-1">
              {hours.map((line, i) => (
                <p key={i} className="text-[13px] text-muted-foreground">{line}</p>
              ))}
            </div>
          </div>
        )}

        {reviews && reviews.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Reseñas</p>
            {reviews.map((r, i) => (
              <div key={i} className="rounded-xl border p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium truncate">{r.authorName}</span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{r.relativeTime}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }, (_, j) => (
                    <Star
                      key={j}
                      className={`h-3 w-3 ${j < r.rating ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'}`}
                    />
                  ))}
                </div>
                {r.text && (
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{r.text}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {onAddToItinerary && (
          <Button
            type="button"
            className="w-full gap-2"
            disabled={!canAdd}
            onClick={onAddToItinerary}
          >
            <Plus className="h-4 w-4" />
            Agregar al itinerario
          </Button>
        )}
      </div>
    </div>
  );
}
