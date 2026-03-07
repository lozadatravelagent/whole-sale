import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, RefreshCcw, ShieldCheck } from 'lucide-react';
import type { PlannerSegment } from '../types';
import {
  formatPlannerHotelCategory,
  formatPlannerPrice,
  formatPlannerRoomLabel,
  formatRelativeValidationTime,
  getValidationFreshnessColor,
  getPriceConfidenceLevel,
  getPriceConfidenceLabel,
  getPriceConfidenceBadgeClass,
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
  const confirmedPrice = confirmedRoom
    ? formatPlannerPrice(confirmedRoom.total_price, confirmedRoom.currency)
    : undefined;
  const isBusy = hotelPlan.matchStatus === 'matching_inventory' || hotelPlan.matchStatus === 'quoting';

  if (!selectedPlace && !confirmedHotel && !hotelPlan.quoteError && (hotelPlan.inventoryMatchCandidates?.length || 0) === 0) {
    return null;
  }

  const isQuoted = hotelPlan.matchStatus === 'quoted' || hotelPlan.matchStatus === 'matched';
  const sourceLabel = isQuoted ? 'Precio de inventario' : 'Sugerencia del planner';
  const sourceBadgeVariant = isQuoted ? 'default' : 'secondary';

  const validationRelative = hotelPlan.quoteLastValidatedAt
    ? formatRelativeValidationTime(hotelPlan.quoteLastValidatedAt)
    : undefined;
  const validationColor = hotelPlan.quoteLastValidatedAt
    ? getValidationFreshnessColor(hotelPlan.quoteLastValidatedAt)
    : undefined;

  const confidenceLevel = isQuoted ? getPriceConfidenceLevel(hotelPlan.quoteLastValidatedAt) : undefined;
  const confidenceLabel = confidenceLevel ? getPriceConfidenceLabel(confidenceLevel) : undefined;
  const confidenceBadgeClass = confidenceLevel ? getPriceConfidenceBadgeClass(confidenceLevel) : undefined;
  const helperText = !hasExactDates && selectedPlace
    ? 'Definí fechas exactas y te muestro si este hotel tiene precio real.'
    : confirmedHotel
      ? 'Ya encontramos una opción real en inventario. Si querés, podés volver a actualizar el precio.'
      : selectedPlace
        ? 'Primero busco el hotel equivalente en inventario. Después podés volver a actualizar el precio.'
        : undefined;

  return (
    <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="trip-planner-label text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Hotel que elegiste en el mapa
            </p>
            <Badge variant={sourceBadgeVariant} className="rounded-full px-2 py-0.5 text-[10px]">
              {sourceLabel}
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
          Actualizar precio real
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
              {selectedPlace && selectedPlace.name !== confirmedHotel.name && (
                <p className="trip-planner-body mt-1 text-[11px] text-muted-foreground/70">
                  Elegiste en mapa: {selectedPlace.name} · En inventario aparece como: {confirmedHotel.name}
                  {formatPlannerHotelCategory(confirmedHotel.category) ? ` · ${formatPlannerHotelCategory(confirmedHotel.category)}` : ''}
                </p>
              )}
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
                Precio real de inventario
              </p>
              <p className="trip-planner-label text-sm font-semibold text-foreground">{confirmedPrice || 'Consultar'}</p>
              {confidenceLabel && confidenceBadgeClass && (
                <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${confidenceBadgeClass}`}>
                  {confidenceLabel}
                  {validationRelative ? ` (${validationRelative})` : ''}
                </span>
              )}
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

      {confirmedHotel && hotelPlan.quoteLastValidatedAt && validationRelative && !confidenceLabel && (
        <p className={`trip-planner-body mt-3 text-[11px] ${validationColor}`}>
          Ultima consulta de precio: {validationRelative}
        </p>
      )}
    </div>
  );
}
