import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star } from 'lucide-react';
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

  const unlocked = segment.days.filter((day) => !day.locked);
  const candidates = unlocked.length > 0 ? unlocked : segment.days;

  return [...candidates]
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

  const selectedSegment = availableSegments.find((segment) => segment.id === segmentId) || availableSegments[0];
  const selectedDay = selectedSegment?.days.find((day) => day.id === dayId);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="trip-planner-surface max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="trip-planner-title">Agregar lugar al planner</DialogTitle>
          <DialogDescription className="trip-planner-body">
            Elegí dónde querés ubicar este lugar dentro del itinerario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="trip-planner-label text-base font-semibold text-foreground">{place.name}</p>
                  <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px]">
                    {getPlannerPlaceCategoryLabel(place.category)}
                  </Badge>
                </div>
                {place.formattedAddress && (
                  <p className="trip-planner-body mt-2 flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{place.formattedAddress}</span>
                  </p>
                )}
              </div>
              {typeof place.rating === 'number' && (
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px]">
                  <Star className="mr-1 h-3 w-3 fill-amber-400 text-amber-400" />
                  {place.rating.toFixed(1)}
                </Badge>
              )}
            </div>
          </div>

          {availableSegments.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              Este planner todavía no tiene días generados para ubicar actividades. Generá primero el itinerario final.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
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

              <div className="space-y-2">
                <p className="trip-planner-label text-xs uppercase tracking-[0.16em] text-muted-foreground">Día</p>
                <Select value={dayId} onValueChange={setDayId} disabled={!selectedSegment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí día" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedSegment?.days.map((day) => (
                      <SelectItem key={day.id} value={day.id}>
                        Día {day.dayNumber}{day.date ? ` • ${formatShortDate(day.date)}` : ''}{day.locked ? ' • bloqueado' : ''}
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
          )}

          {selectedDay?.locked && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Este día está bloqueado. El lugar se agregará igual como edición manual.
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
            Agregar al planner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
