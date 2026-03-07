import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Hotel, MapPin } from 'lucide-react';
import type { PlannerSegment } from '../types';
import {
  formatPlannerHotelCategory,
  formatPlannerPrice,
  formatPlannerRoomLabel,
  formatRelativeValidationTime,
  getPlannerHotelDisplayId,
  getPrimaryPlannerHotelRoom,
  isEurovipsInventoryHotel,
} from '../utils';
import PlannerCircularLoadingState from './PlannerCircularLoadingState';
import PlannerHotelInventoryDetailPanel from './PlannerHotelInventoryDetailPanel';
import PlannerHotelMatchPanel from './PlannerHotelMatchPanel';

interface PlannerHotelInventorySectionProps {
  segment: PlannerSegment;
  hasExactDates: boolean;
  disabled?: boolean;
  travelers?: { adults: number; children: number; infants: number };
  statusText: string;
  onSelectHotel: (segmentId: string, hotelId: string) => Promise<void>;
  onResolveInventoryMatch: (segmentId: string) => Promise<void>;
  onConfirmInventoryHotelMatch: (segmentId: string, hotelId: string) => Promise<void>;
  onRefreshQuotedHotel: (segmentId: string) => Promise<void>;
}

export default function PlannerHotelInventorySection({
  segment,
  hasExactDates,
  disabled = false,
  travelers,
  statusText,
  onSelectHotel,
  onResolveInventoryMatch,
  onConfirmInventoryHotelMatch,
  onRefreshQuotedHotel,
}: PlannerHotelInventorySectionProps) {
  const [detailHotelId, setDetailHotelId] = useState<string | null>(null);

  const inventoryHotels = useMemo(() => {
    const eurovipsHotels = segment.hotelPlan.hotelRecommendations.filter(
      isEurovipsInventoryHotel
    );
    const confirmedHotel = segment.hotelPlan.confirmedInventoryHotel;

    if (!isEurovipsInventoryHotel(confirmedHotel)) {
      return eurovipsHotels;
    }

    const confirmedHotelId = getPlannerHotelDisplayId(confirmedHotel);
    const alreadyIncluded = eurovipsHotels.some((hotel) => getPlannerHotelDisplayId(hotel) === confirmedHotelId);

    return alreadyIncluded ? eurovipsHotels : [confirmedHotel, ...eurovipsHotels];
  }, [segment.hotelPlan.confirmedInventoryHotel, segment.hotelPlan.hotelRecommendations]);

  const detailHotel = useMemo(() => {
    if (!detailHotelId) return null;
    return inventoryHotels.find((hotel) => getPlannerHotelDisplayId(hotel) === detailHotelId) || null;
  }, [detailHotelId, inventoryHotels]);

  useEffect(() => {
    if (detailHotelId && !detailHotel) {
      setDetailHotelId(null);
    }
  }, [detailHotel, detailHotelId]);

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
                const validationRelative =
                  isSelected && segment.hotelPlan.quoteLastValidatedAt
                    ? formatRelativeValidationTime(segment.hotelPlan.quoteLastValidatedAt)
                    : undefined;

                return (
                  <button
                    key={hotelId}
                    type="button"
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-primary/50 bg-primary/5 shadow-sm'
                        : 'border-border/70 hover:border-primary/30 hover:bg-muted/30'
                    }`}
                    onClick={() => setDetailHotelId(hotelId)}
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
                          {isSelected && (
                            <Badge variant={isQuoted ? 'default' : 'outline'} className="rounded-full px-2 py-0.5 text-[10px]">
                              {isQuoted ? 'Precio real' : 'Seleccionado'}
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
                          {validationRelative && <span>Validado {validationRelative}</span>}
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

      <PlannerHotelInventoryDetailPanel
        open={Boolean(detailHotel)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailHotelId(null);
          }
        }}
        hotel={detailHotel}
        segment={segment}
        hasExactDates={hasExactDates}
        disabled={disabled}
        onSelectHotel={onSelectHotel}
        onRefreshQuotedHotel={onRefreshQuotedHotel}
      />
    </>
  );
}
