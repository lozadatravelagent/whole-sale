import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, MapPin, Star } from 'lucide-react';
import type { PlannerPlaceCandidate, TripPlannerState } from '../types';
import { formatDayBlockLabel, formatDestinationLabel, formatShortDate } from '../utils';
import { getPlannerPlaceCategoryLabel, getSuggestedSlotForPlannerPlace } from '../services/plannerPlaceMapper';

interface PlannerMapPlaceAssignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plannerState: TripPlannerState | null;
  place: PlannerPlaceCandidate | null;
  initialSegmentId?: string | null;
  onConfirm: (selection: {
    segmentId: string;
    dayId: string;
    block: 'morning' | 'afternoon' | 'evening';
  }) => Promise<void> | void;
}

function pickBestDayId(
  plannerState: TripPlannerState | null,
  segmentId: string,
  block: 'morning' | 'afternoon' | 'evening',
): string | undefined {
  const segment = plannerState?.segments.find((item) => item.id === segmentId);
  if (!segment || segment.days.length === 0) return undefined;

  return [...segment.days]
    .sort((left, right) => left[block].length - right[block].length)[0]
    ?.id;
}

export default function PlannerMapPlaceAssignModal({
  open,
  onOpenChange,
  plannerState,
  place,
  initialSegmentId,
  onConfirm,
}: PlannerMapPlaceAssignModalProps) {
  const [segmentId, setSegmentId] = useState<string>('');
  const [dayId, setDayId] = useState<string>('');
  const [block, setBlock] = useState<'morning' | 'afternoon' | 'evening'>('afternoon');

  const availableSegments = useMemo(
    () => plannerState?.segments.filter((segment) => segment.days.length > 0) || [],
    [plannerState]
  );

  const hasFixedSegment = Boolean(initialSegmentId && availableSegments.some((s) => s.id === initialSegmentId));
  const selectedSegment = availableSegments.find((segment) => segment.id === segmentId) || availableSegments[0];

  useEffect(() => {
    if (!open || !place) return;

    const nextBlock = getSuggestedSlotForPlannerPlace(place);
    const nextSegmentId = availableSegments.find((segment) => segment.id === initialSegmentId)?.id || availableSegments[0]?.id || '';
    const nextDayId = pickBestDayId(plannerState, nextSegmentId, nextBlock) || '';

    setSegmentId(nextSegmentId);
    setDayId(nextDayId);
    setBlock(nextBlock);
  }, [availableSegments, initialSegmentId, open, place, plannerState]);

  useEffect(() => {
    if (!selectedSegment) {
      setDayId('');
      return;
    }

    if (!selectedSegment.days.some((day) => day.id === dayId)) {
      setDayId(pickBestDayId(plannerState, selectedSegment.id, block) || '');
    }
  }, [block, dayId, plannerState, selectedSegment]);

  if (!place) {
    return null;
  }

  const canConfirm = Boolean(segmentId && dayId);
  const photo = place.photoUrls?.[0];
  const mapsUrl = place.placeId
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.placeId}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="trip-planner-surface max-w-md overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="trip-planner-title">Sumar al itinerario</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          {/* Place preview with photo */}
          <div className="overflow-hidden rounded-2xl border border-primary/15 bg-primary/5">
            {photo && (
              <img
                src={photo}
                alt={place.name}
                className="h-40 w-full object-cover"
              />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="trip-planner-label text-base font-semibold text-foreground">{place.name}</p>
                    <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px]">
                      {getPlannerPlaceCategoryLabel(place.category)}
                    </Badge>
                  </div>
                  {place.formattedAddress && (
                    <p className="trip-planner-body mt-1.5 flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{place.formattedAddress}</span>
                    </p>
                  )}
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver en Google Maps
                    </a>
                  )}
                </div>
                {typeof place.rating === 'number' && (
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
                      <Star className="mr-1 h-3 w-3 fill-amber-400 text-amber-400" />
                      {place.rating.toFixed(1)}
                    </Badge>
                    {place.userRatingsTotal != null && (
                      <span className="text-[10px] text-muted-foreground">
                        {place.userRatingsTotal.toLocaleString()} reseñas
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Destination (fixed) + Day + Block selectors */}
          {availableSegments.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              Todavía no hay días armados para ubicar este lugar. Terminá primero el itinerario y después lo sumamos.
            </div>
          ) : (
            <div className="space-y-4">
              {hasFixedSegment && selectedSegment ? (
                <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{formatDestinationLabel(selectedSegment.city)}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="trip-planner-label text-xs uppercase tracking-[0.16em] text-muted-foreground">Destino</p>
                  <Select value={segmentId} onValueChange={setSegmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Elegí destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSegments.map((segment) => (
                        <SelectItem key={segment.id} value={segment.id}>
                          {formatDestinationLabel(segment.city)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <p className="trip-planner-label text-xs uppercase tracking-[0.16em] text-muted-foreground">Día</p>
                  <Select value={dayId} onValueChange={setDayId} disabled={!selectedSegment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Elegí día" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedSegment?.days.map((day) => (
                        <SelectItem key={day.id} value={day.id}>
                          Día {day.dayNumber}{day.date ? ` • ${formatShortDate(day.date)}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="trip-planner-label text-xs uppercase tracking-[0.16em] text-muted-foreground">Bloque</p>
                  <Select value={block} onValueChange={(value) => setBlock(value as 'morning' | 'afternoon' | 'evening')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['morning', 'afternoon', 'evening'] as const).map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {formatDayBlockLabel(slot)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) return;
              void onConfirm({ segmentId, dayId, block });
            }}
          >
            Sumar al itinerario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
