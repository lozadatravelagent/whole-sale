import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, RefreshCcw, ShieldCheck } from 'lucide-react';
import type { PlannerSegment } from '../types';
import {
  formatPlannerHotelCategory,
  formatPlannerPrice,
  formatPlannerRoomLabel,
  getPrimaryPlannerHotelRoom,
} from '../utils';

interface PlannerHotelMatchPanelProps {
  segment: PlannerSegment;
  hasExactDates: boolean;
  disabled?: boolean;
  onResolveInventoryMatch: (segmentId: string) => Promise<void>;
  onConfirmInventoryHotelMatch: (segmentId: string, hotelId: string) => Promise<void>;
  onRefreshQuotedHotel: (segmentId: string) => Promise<void>;
}

export default function PlannerHotelMatchPanel({
  segment,
  hasExactDates,
  disabled = false,
  onResolveInventoryMatch,
  onConfirmInventoryHotelMatch,
  onRefreshQuotedHotel,
}: PlannerHotelMatchPanelProps) {
  const { hotelPlan } = segment;
  const selectedPlace = hotelPlan.selectedPlaceCandidate;
  const confirmedHotel = hotelPlan.confirmedInventoryHotel;
  const confirmedRoom = confirmedHotel ? getPrimaryPlannerHotelRoom(confirmedHotel) : undefined;
  const confirmedPrice = confirmedRoom
    ? formatPlannerPrice(confirmedRoom.total_price, confirmedRoom.currency)
    : undefined;
  const isBusy = hotelPlan.matchStatus === 'matching_inventory' || hotelPlan.matchStatus === 'quoting';

  if (!selectedPlace && !confirmedHotel && !hotelPlan.quoteError && (hotelPlan.inventoryMatchCandidates?.length || 0) === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="trip-planner-label text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Hotel del mapa
          </p>
          {selectedPlace ? (
            <>
              <p className="trip-planner-label mt-1 text-sm font-semibold text-foreground">{selectedPlace.name}</p>
              {selectedPlace.formattedAddress && (
                <p className="trip-planner-body mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{selectedPlace.formattedAddress}</span>
                </p>
              )}
            </>
          ) : confirmedHotel ? (
            <p className="trip-planner-label mt-1 text-sm font-semibold text-foreground">{confirmedHotel.name}</p>
          ) : null}
        </div>
        {selectedPlace?.rating && (
          <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px]">
            {selectedPlace.rating.toFixed(1)} Google
          </Badge>
        )}
      </div>

      <div className="mt-3 grid gap-2">
        <Button
          type="button"
          size="sm"
          className="justify-center"
          disabled={disabled || !selectedPlace || !hasExactDates || isBusy}
          onClick={() => void onResolveInventoryMatch(segment.id)}
        >
          {hotelPlan.matchStatus === 'matching_inventory' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 h-4 w-4" />
          )}
          Cotizar hotel elegido
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || (!selectedPlace && !confirmedHotel) || !hasExactDates || isBusy}
          onClick={() => void onRefreshQuotedHotel(segment.id)}
        >
          {hotelPlan.matchStatus === 'quoting' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          Validar hotel real
        </Button>
      </div>

      {!hasExactDates && selectedPlace && (
        <p className="trip-planner-body mt-3 text-xs text-muted-foreground">
          Elegí fechas exactas para poder buscar precio real del hotel.
        </p>
      )}

      {hotelPlan.quoteError && (
        <p className="trip-planner-body mt-3 text-xs text-muted-foreground">{hotelPlan.quoteError}</p>
      )}

      {confirmedHotel && (
        <div className="mt-3 rounded-lg border bg-background/80 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="trip-planner-label text-sm font-semibold text-foreground">{confirmedHotel.name}</p>
              <p className="trip-planner-body mt-1 text-xs text-muted-foreground">
                {confirmedHotel.address || confirmedHotel.city}
              </p>
            </div>
            {formatPlannerHotelCategory(confirmedHotel.category) && (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
                {formatPlannerHotelCategory(confirmedHotel.category)}
              </Badge>
            )}
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="trip-planner-label text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Hotel confirmado
              </p>
              <p className="trip-planner-label text-sm font-semibold text-foreground">{confirmedPrice || 'Consultar'}</p>
            </div>
            <p className="trip-planner-body text-xs text-muted-foreground">
              {formatPlannerRoomLabel(confirmedHotel)}
            </p>
          </div>
        </div>
      )}

      {hotelPlan.matchStatus === 'needs_confirmation' && (hotelPlan.inventoryMatchCandidates?.length || 0) > 0 && (
        <div className="mt-3 space-y-2">
          <p className="trip-planner-label text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Confirmar hotel real
          </p>
          {hotelPlan.inventoryMatchCandidates?.map((candidate) => {
            const room = getPrimaryPlannerHotelRoom(candidate.hotel);
            const totalPrice = room ? formatPlannerPrice(room.total_price, room.currency) : undefined;
            return (
              <button
                key={candidate.hotelId}
                type="button"
                className="w-full rounded-lg border bg-background/80 p-3 text-left transition hover:border-primary/50 hover:bg-primary/5"
                disabled={disabled}
                onClick={() => void onConfirmInventoryHotelMatch(segment.id, candidate.hotelId)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="trip-planner-label text-sm font-semibold text-foreground">{candidate.name}</p>
                    <p className="trip-planner-body mt-1 text-xs text-muted-foreground">
                      {(candidate.reasons || []).join(' • ') || candidate.city}
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px]">
                    {(candidate.score * 100).toFixed(0)}%
                  </Badge>
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <span className="trip-planner-body text-xs text-muted-foreground">
                    {formatPlannerRoomLabel(candidate.hotel)}
                  </span>
                  <span className="trip-planner-label text-sm font-semibold text-foreground">
                    {totalPrice || 'Consultar'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {confirmedHotel && hotelPlan.quoteLastValidatedAt && (
        <p className="trip-planner-body mt-3 text-[11px] text-muted-foreground">
          Ultima validacion: {new Date(hotelPlan.quoteLastValidatedAt).toLocaleString('es-AR')}
        </p>
      )}
    </div>
  );
}
