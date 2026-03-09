import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Hotel, MapPin } from 'lucide-react';
import type { PlannerPlaceHotelCandidate, PlannerSegment } from '../types';
import {
  formatHotelDistanceLabel,
  formatPlannerHotelCategory,
  formatPlannerPrice,
  formatPlannerRoomLabel,
  getHotelDistanceTag,
  getPlannerHotelDisplayId,
  getPrimaryPlannerHotelRoom,
  haversineDistanceKm,
  isEurovipsInventoryHotel,
} from '../utils';
import PlannerCircularLoadingState from './PlannerCircularLoadingState';
import PlannerHotelMatchPanel from './PlannerHotelMatchPanel';

const DISTANCE_TAG_CLASSES = {
  centro: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  cercano: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400',
  alejado: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
} as const;

interface PlannerHotelInventorySectionProps {
  segment: PlannerSegment;
  hasExactDates: boolean;
  disabled?: boolean;
  travelers?: { adults: number; children: number; infants: number };
  statusText: string;
  onOpenHotelDetail: (segmentId: string, hotelId: string) => void;
  onResolveInventoryMatch: (segmentId: string) => Promise<void>;
  onConfirmInventoryHotelMatch: (segmentId: string, hotelId: string) => Promise<void>;
  onRefreshQuotedHotel: (segmentId: string) => Promise<void>;
  hotelPlaces?: PlannerPlaceHotelCandidate[];
}

export default function PlannerHotelInventorySection({
  segment,
  hasExactDates,
  disabled = false,
  travelers,
  statusText,
  onOpenHotelDetail,
  onResolveInventoryMatch,
  onConfirmInventoryHotelMatch,
  onRefreshQuotedHotel,
  hotelPlaces,
}: PlannerHotelInventorySectionProps) {
  const inventoryHotels = useMemo(() => {
    const eurovipsHotels = segment.hotelPlan.hotelRecommendations.filter(
      isEurovipsInventoryHotel
    );
    const confirmedHotel = segment.hotelPlan.confirmedInventoryHotel;

    let hotels = eurovipsHotels;
    if (isEurovipsInventoryHotel(confirmedHotel)) {
      const confirmedHotelId = getPlannerHotelDisplayId(confirmedHotel);
      const alreadyIncluded = eurovipsHotels.some((hotel) => getPlannerHotelDisplayId(hotel) === confirmedHotelId);
      if (!alreadyIncluded) {
        hotels = [confirmedHotel, ...eurovipsHotels];
      }
    }

    if (!segment.location || !hotelPlaces?.length) {
      return hotels;
    }

    const loc = segment.location;
    return [...hotels].sort((a, b) => {
      const aName = a.name?.trim().toLowerCase();
      const bName = b.name?.trim().toLowerCase();
      const aPlace = hotelPlaces?.find((p) => p.name?.trim().toLowerCase() === aName);
      const bPlace = hotelPlaces?.find((p) => p.name?.trim().toLowerCase() === bName);
      const aDist = aPlace?.lat != null && aPlace?.lng != null
        ? haversineDistanceKm(loc, { lat: aPlace.lat, lng: aPlace.lng })
        : Infinity;
      const bDist = bPlace?.lat != null && bPlace?.lng != null
        ? haversineDistanceKm(loc, { lat: bPlace.lat, lng: bPlace.lng })
        : Infinity;
      return aDist - bDist;
    });
  }, [segment.hotelPlan.confirmedInventoryHotel, segment.hotelPlan.hotelRecommendations, segment.location, hotelPlaces]);

  const showInventoryList =
    hasExactDates &&
    segment.hotelPlan.searchStatus !== 'loading' &&
    inventoryHotels.length > 0;

  const showEmptyInventoryState =
    hasExactDates &&
    segment.hotelPlan.searchStatus === 'ready' &&
    inventoryHotels.length === 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="trip-planner-title flex items-center gap-2 text-base">
            <Hotel className="h-4 w-4 text-primary" />
            Hoteles de inventario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PlannerHotelMatchPanel
            segment={segment}
            disabled={disabled}
            hasExactDates={hasExactDates}
            travelers={travelers}
            onResolveInventoryMatch={onResolveInventoryMatch}
            onConfirmInventoryHotelMatch={onConfirmInventoryHotelMatch}
            onRefreshQuotedHotel={onRefreshQuotedHotel}
            hotelPlaces={hotelPlaces}
          />

          {segment.hotelPlan.searchStatus === 'loading' ? (
            <div className="planner-panel-fade-in">
              <PlannerCircularLoadingState
                label={`Buscando hoteles en ${segment.city}`}
                sublabel="Estamos consultando opciones reales para este destino."
              />
            </div>
          ) : (
            <div className="planner-panel-fade-in space-y-2">
              <p className="trip-planner-body text-xs text-muted-foreground">{statusText}</p>
              {segment.hotelPlan.error && (
                <p className="trip-planner-body text-xs text-destructive">{segment.hotelPlan.error}</p>
              )}
            </div>
          )}

          {showInventoryList && (
            <div className="planner-panel-fade-in space-y-2">
              {inventoryHotels.map((hotel) => {
                const hotelId = getPlannerHotelDisplayId(hotel);
                const primaryRoom = getPrimaryPlannerHotelRoom(hotel);
                const hotelCategory = formatPlannerHotelCategory(hotel.category);
                const totalPrice = formatPlannerPrice(primaryRoom?.total_price, primaryRoom?.currency);
                const nightlyPrice = formatPlannerPrice(primaryRoom?.price_per_night, primaryRoom?.currency);
                const isSelected = segment.hotelPlan.selectedHotelId === hotelId;
                const isQuoted =
                  isSelected &&
                  (segment.hotelPlan.matchStatus === 'quoted' || segment.hotelPlan.matchStatus === 'matched');
                const hotelNameNorm = hotel.name?.trim().toLowerCase();
                const matchedPlace = hotelPlaces?.find(
                  (p) => p.name?.trim().toLowerCase() === hotelNameNorm
                );
                const distanceKm =
                  matchedPlace?.lat != null && matchedPlace?.lng != null && segment.location
                    ? haversineDistanceKm(segment.location, { lat: matchedPlace.lat, lng: matchedPlace.lng })
                    : undefined;
                const distanceTag = distanceKm != null ? getHotelDistanceTag(distanceKm) : undefined;

                return (
                  <button
                    key={hotelId}
                    type="button"
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-primary/50 bg-primary/5 shadow-sm'
                        : 'border-border/70 hover:border-primary/30 hover:bg-muted/30'
                    }`}
                    onClick={() => onOpenHotelDetail(segment.id, hotelId)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="trip-planner-label text-sm font-semibold text-foreground">
                            {hotel.name}
                          </p>
                          {hotelCategory && (
                            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
                              {hotelCategory}
                            </Badge>
                          )}
                          {distanceTag && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${DISTANCE_TAG_CLASSES[distanceTag]}`}>
                              {formatHotelDistanceLabel(distanceTag)}
                            </span>
                          )}
                          {isSelected && (
                            <Badge variant={isQuoted ? 'default' : 'outline'} className="rounded-full px-2 py-0.5 text-[10px]">
                              {isQuoted ? 'Precio final' : 'Seleccionado'}
                            </Badge>
                          )}
                        </div>
                        <p className="trip-planner-body mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="truncate">{hotel.address || hotel.city}</span>
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{formatPlannerRoomLabel(hotel)}</span>
                          {typeof primaryRoom?.availability === 'number' && (
                            <span>{primaryRoom.availability} disponibles</span>
                          )}
                          {!isSelected && <span>(precio sin taxes)</span>}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="trip-planner-label text-sm font-semibold text-foreground">
                          {totalPrice || 'Consultar'}
                        </p>
                        {nightlyPrice && (
                          <p className="trip-planner-body mt-1 text-[11px] text-muted-foreground">
                            {nightlyPrice} por noche
                          </p>
                        )}
                        <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                          Ver detalle
                          <ChevronRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {showEmptyInventoryState && (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-4">
              <p className="text-sm text-muted-foreground">
                No encontramos hoteles de inventario EUROVIPS para este tramo con las fechas actuales.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
