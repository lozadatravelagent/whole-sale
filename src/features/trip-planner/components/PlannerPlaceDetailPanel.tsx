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
  const mapsQuery = [place.name, address].filter(Boolean).join(' ');

  const hasContactInfo = address || phone || website || mapsQuery;

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {/* Hero image with overlay */}
        {photos.length > 0 ? (
          <div>
            <div className="relative">
              <img
                src={photos[0]}
                alt={place.name}
                className="h-64 w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border-0 bg-white/20 px-3 py-1 text-xs text-white backdrop-blur-sm">
                    {getPlannerPlaceCategoryLabel(place.category)}
                  </Badge>
                  {isOpen === true && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-200 backdrop-blur-sm">
                      Abierto ahora
                    </span>
                  )}
                  {isOpen === false && (
                    <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-medium text-rose-200 backdrop-blur-sm">
                      Cerrado
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">{place.name}</h2>
              </div>
            </div>
            {photos.length > 1 && (
              <div className="flex gap-1 bg-background p-1">
                {photos.slice(1, 4).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="h-20 flex-1 rounded-xl object-cover"
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
          {/* Rating prominent */}
          {rating != null && (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">{rating.toFixed(1)}</span>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`h-[18px] w-[18px] ${
                        i < Math.round(rating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-muted text-muted'
                      }`}
                    />
                  ))}
                </div>
                {totalReviews != null && (
                  <span className="text-xs text-muted-foreground">
                    {totalReviews.toLocaleString()} reseñas
                  </span>
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando detalles...
            </div>
          )}

          {/* Contact info grouped card */}
          {hasContactInfo && (
            <div className="overflow-hidden rounded-2xl border bg-card/80">
              <div className="divide-y divide-border/60">
                {address && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted/60">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="self-center text-sm">{address}</span>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted/60">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <a href={`tel:${phone}`} className="text-sm hover:underline">{phone}</a>
                  </div>
                )}
                {website && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted/60">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm text-primary hover:underline"
                    >
                      {(() => {
                        try { return new URL(website).hostname; }
                        catch { return website; }
                      })()}
                    </a>
                  </div>
                )}
                {mapsQuery && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted/60">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery || place.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Ver en Google Maps
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Opening hours */}
          {hours && hours.length > 0 && (
            <div className="rounded-2xl border p-4">
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted/60">
                  <Clock className="h-4 w-4" />
                </div>
                Horarios
              </div>
              <div className="mt-3 space-y-1 pl-[42px]">
                {hours.map((line, i) => (
                  <p key={i} className="text-[13px] text-muted-foreground">{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {reviews && reviews.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Reseñas</p>
              {reviews.map((r, i) => (
                <div key={i} className="rounded-2xl border p-4 space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {r.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate">{r.authorName}</p>
                      <p className="text-[11px] text-muted-foreground">{r.relativeTime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, j) => (
                      <Star
                        key={j}
                        className={`h-3.5 w-3.5 ${j < r.rating ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'}`}
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
        </div>
      </div>

      {/* Sticky bottom button */}
      {onAddToItinerary && (
        <div className="border-t border-border/70 bg-background px-5 py-3">
          <Button
            type="button"
            className="w-full gap-2"
            disabled={!canAdd}
            onClick={onAddToItinerary}
          >
            <Plus className="h-4 w-4" />
            Agregar al itinerario
          </Button>
        </div>
      )}
    </>
  );
}
