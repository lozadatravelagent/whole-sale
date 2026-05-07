import React, { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Calendar,
  Users,
  DollarSign,
  Sparkles,
  Route,
  FileText,
  Loader2,
  Download,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { TripPlannerState } from '@/features/trip-planner/types';
import {
  formatDestinationLabel,
  formatDateRange,
  formatFlexibleMonth,
  formatBudgetLevel,
  formatPaceLabel,
} from '@/features/trip-planner/utils';
import { hasItineraryContent } from '../utils/hasItineraryContent';
import { canExportPdf } from '@/services/pdf/itineraryPdfTemplate';
import {
  getPlannerBlockCopy,
  getTravelerCopy,
  normalizeSupportedLanguage,
  type UserLanguage,
} from '@/features/chat/i18n/chatResultCopy';

interface ItineraryPanelProps {
  plannerState: TripPlannerState | null;
  onRequestChanges?: () => void;
  onExportPdf?: () => Promise<void>;
  className?: string;
}

interface BlockProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function Block({ icon, label, children }: BlockProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function formatTravelersText(travelers: TripPlannerState['travelers'], language: UserLanguage): string | null {
  const adults = travelers?.adults ?? 0;
  const children = travelers?.children ?? 0;
  const infants = travelers?.infants ?? 0;
  if (adults + children + infants === 0) return null;

  const tCopy = getTravelerCopy(language);
  const parts: string[] = [];
  if (adults > 0) parts.push(tCopy.adult(adults));
  if (children > 0) parts.push(tCopy.child(children));
  if (infants > 0) parts.push(tCopy.infant(infants));
  return parts.join(' · ');
}

const ItineraryPanel = React.memo(function ItineraryPanel({
  plannerState,
  onRequestChanges,
  onExportPdf,
  className,
}: ItineraryPanelProps) {
  const { i18n } = useTranslation();
  const language = normalizeSupportedLanguage(i18n.language);
  const copy = getPlannerBlockCopy(language);
  const travelerCopy = getTravelerCopy(language);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!onExportPdf || isExporting) return;
    setIsExporting(true);
    try {
      await onExportPdf();
    } finally {
      setIsExporting(false);
    }
  }, [onExportPdf, isExporting]);

  // Hooks must execute unconditionally — hoisted above early return.
  // canExportPdf and both filters handle null plannerState safely.
  const destinations = useMemo(
    () => (plannerState?.destinations ?? []).filter((d) => typeof d === 'string' && d.trim().length > 0),
    [plannerState?.destinations]
  );

  const segmentsWithCity = useMemo(
    () =>
      (plannerState?.segments ?? []).filter((s) => typeof s?.city === 'string' && s.city.trim().length > 0),
    [plannerState?.segments]
  );

  const shouldRender = hasItineraryContent(plannerState);
  if (!shouldRender || !plannerState) return null;

  const uiPhase = plannerState.generationMeta?.uiPhase;
  const isDraft = plannerState.generationMeta?.isDraft === true;
  const isBuilding = isDraft || (uiPhase !== undefined && uiPhase !== 'ready');

  const primaryDestination = destinations[0];
  const extraDestinations = destinations.slice(1);

  const hasConcreteDates = Boolean(plannerState.startDate && plannerState.endDate);
  const dateLabel = hasConcreteDates
    ? formatDateRange(plannerState.startDate, plannerState.endDate)
    : plannerState.isFlexibleDates
      ? formatFlexibleMonth(plannerState.flexibleMonth, plannerState.flexibleYear)
      : null;

  const travelersLabel = formatTravelersText(plannerState.travelers, language);

  const paceLabel = plannerState.pace ? formatPaceLabel(plannerState.pace) : null;
  const budgetLabelText = plannerState.budgetLevel ? formatBudgetLevel(plannerState.budgetLevel) : null;
  const notes = (plannerState.notes ?? []).filter((n) => typeof n === 'string' && n.trim().length > 0);

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col border-l border-border bg-background',
        className
      )}
      data-testid="itinerary-panel"
    >
      <div className="flex flex-col gap-1 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{copy.yourTrip}</h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isBuilding ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{copy.building}</span>
            </>
          ) : primaryDestination ? (
            <span>{formatDestinationLabel(primaryDestination)}</span>
          ) : (
            <span>{copy.inProgress}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          {destinations.length > 0 && (
            <Block icon={<MapPin className="h-3.5 w-3.5" />} label={copy.blockDestination}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">{formatDestinationLabel(primaryDestination)}</span>
                {extraDestinations.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {extraDestinations.map((d) => (
                      <Badge key={d} variant="secondary" className="text-xs font-normal">
                        {formatDestinationLabel(d)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </Block>
          )}

          {dateLabel && (
            <Block icon={<Calendar className="h-3.5 w-3.5" />} label={copy.blockDates}>
              <span>{dateLabel}</span>
            </Block>
          )}

          {travelersLabel && (
            <Block icon={<Users className="h-3.5 w-3.5" />} label={copy.blockTravelers}>
              <span>{travelersLabel}</span>
            </Block>
          )}

          {segmentsWithCity.length > 0 && (
            <Block icon={<Route className="h-3.5 w-3.5" />} label={copy.blockItinerary}>
              <ul className="flex flex-col gap-1.5">
                {segmentsWithCity.map((segment) => {
                  const nights = segment.nights ?? segment.days?.length ?? 0;
                  return (
                    <li key={segment.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{formatDestinationLabel(segment.city)}</span>
                      {nights > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {travelerCopy.night(nights)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Block>
          )}

          {paceLabel && (
            <Block icon={<Sparkles className="h-3.5 w-3.5" />} label={copy.blockTravelStyle}>
              <Badge variant="secondary" className="font-normal">
                {paceLabel}
              </Badge>
            </Block>
          )}

          {budgetLabelText && (
            <Block icon={<DollarSign className="h-3.5 w-3.5" />} label={copy.blockBudget}>
              <Badge variant="secondary" className="font-normal">
                {budgetLabelText}
              </Badge>
            </Block>
          )}

          {notes.length > 0 && (
            <Block icon={<FileText className="h-3.5 w-3.5" />} label={copy.blockNotes}>
              <ul className="flex flex-col gap-1">
                {notes.map((note, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground">
                    {note}
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </div>
      </div>

      {(onRequestChanges || (onExportPdf && canExportPdf(plannerState))) && (
        <>
          <Separator />
          <div className="flex flex-col gap-2 px-4 py-3">
            {onExportPdf && canExportPdf(plannerState) && (
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    {copy.generatingPdf}
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-3 w-3" />
                    {copy.downloadItinerary}
                  </>
                )}
              </Button>
            )}
            {onRequestChanges && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onRequestChanges}
              >
                {copy.askAdjustments}
              </Button>
            )}
          </div>
        </>
      )}
    </aside>
  );
});

export default ItineraryPanel;
