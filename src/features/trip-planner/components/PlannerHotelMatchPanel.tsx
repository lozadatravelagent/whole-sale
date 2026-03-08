import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, ShieldCheck } from 'lucide-react';
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
  travelers?: { adults: number; children: number; infants: number };
  onResolveInventoryMatch: (segmentId: string) => Promise<void>;
  onConfirmInventoryHotelMatch: (segmentId: string, hotelId: string) => Promise<void>;
  onRefreshQuotedHotel: (segmentId: string) => Promise<void>;
}

export default function PlannerHotelMatchPanel({
  segment,
  hasExactDates,
  disabled = false,
  travelers,
  onResolveInventoryMatch,
  onConfirmInventoryHotelMatch,
  onRefreshQuotedHotel,
}: PlannerHotelMatchPanelProps) {
  const { hotelPlan } = segment;
  const selectedPlace = hotelPlan.selectedPlaceCandidate;
  const confirmedHotel = hotelPlan.confirmedInventoryHotel;
  const confirmedRoom = confirmedHotel ? getPrimaryPlannerHotelRoom(confirmedHotel) : undefined;
  const confirmedPrice = hotelPlan.budgetPrice
    ? formatPlannerPrice(hotelPlan.budgetPrice, hotelPlan.budgetCurrency || confirmedRoom?.currency || 'USD')
    : confirmedRoom
      ? formatPlannerPrice(confirmedRoom.total_price, confirmedRoom.currency)
      : undefined;
  const hasBudgetPrice = Boolean(hotelPlan.budgetPrice);
  const isBusy = hotelPlan.matchStatus === 'matching_inventory' || hotelPlan.matchStatus === 'quoting';

  if (!selectedPlace && !confirmedHotel && !hotelPlan.quoteError && (hotelPlan.inventoryMatchCandidates?.length || 0) === 0) {
    return null;
  }

  const isQuoted = hotelPlan.matchStatus === 'quoted' || hotelPlan.matchStatus === 'matched' || hotelPlan.matchStatus === 'quoting';

  // --- Quoted state: clean summary only ---
  if (isQuoted && confirmedHotel) {
    const hotelCategory = formatPlannerHotelCategory(confirmedHotel.category);
    return (
      <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="trip-planner-label text-sm font-semibold text-foreground">{confirmedHotel.name}</p>
            <p className="trip-planner-body mt-1 flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{confirmedHotel.address || confirmedHotel.city}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hotelCategory && (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
                {hotelCategory}
              </Badge>
            )}
            {hasBudgetPrice ? (
              <Badge className="rounded-full px-2 py-0.5 text-[10px]">Precio final</Badge>
            ) : (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">Precio estimado</Badge>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div>
            {hotelPlan.matchStatus === 'quoting' ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Presupuestando...</span>
              </div>
            ) : (
              <p className="trip-planner-label text-lg font-bold text-primary">{confirmedPrice || 'Consultar'}</p>
            )}
            <p className="trip-planner-body mt-0.5 text-xs text-muted-foreground">
              {formatPlannerRoomLabel(confirmedHotel)}
            </p>
          </div>
        </div>

        {hotelPlan.quoteError && (
          <p className="trip-planner-body mt-3 text-xs text-destructive">{hotelPlan.quoteError}</p>
        )}
      </div>
    );
  }

  // --- Non-quoted state: show selection info + action buttons ---
  const helperText = !hasExactDates && selectedPlace
    ? 'Definí fechas exactas y te muestro si este hotel tiene precio real.'
    : selectedPlace
      ? 'Buscamos el hotel equivalente en inventario para cotizar el precio real.'
      : undefined;

  return (
    <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="trip-planner-label text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Hotel que elegiste en el mapa
            </p>
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
              Sugerencia del planner
            </Badge>
          </div>
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
          Buscar este hotel en inventario
        </Button>
      </div>

      {helperText && (
        <p className="trip-planner-body mt-3 text-xs text-muted-foreground">
          {helperText}
        </p>
      )}

      {hasExactDates && selectedPlace && !confirmedHotel && travelers && travelers.children > 0 && (
        <p className="trip-planner-body mt-2 rounded-md border border-yellow-200 bg-yellow-50 px-2.5 py-1.5 text-[11px] text-yellow-800">
          Si viajan menores, pasame las edades por chat para afinar la cotización.
        </p>
      )}

      {hotelPlan.quoteError && (
        <p className="trip-planner-body mt-3 text-xs text-destructive">{hotelPlan.quoteError}</p>
      )}

      {hotelPlan.matchStatus === 'needs_confirmation' && (hotelPlan.inventoryMatchCandidates?.length || 0) > 0 && (
        <div className="mt-3 space-y-2">
          <p className="trip-planner-label text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Elegí cuál querés cotizar
          </p>
          {selectedPlace && (
            <p className="trip-planner-body text-[11px] text-muted-foreground/70">
              Tu elección en el mapa fue {selectedPlace.name}. Estas son las opciones más parecidas en inventario:
            </p>
          )}
          {hotelPlan.inventoryMatchCandidates?.map((candidate) => {
            const room = getPrimaryPlannerHotelRoom(candidate.hotel);
            const totalPrice = room ? formatPlannerPrice(room.total_price, room.currency) : undefined;
            const candidateCategory = formatPlannerHotelCategory(candidate.hotel.category);
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
                      {[candidateCategory, ...(candidate.reasons || [])].filter(Boolean).join(' • ') || candidate.city}
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
    </div>
  );
}
