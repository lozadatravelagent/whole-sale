import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Sparkles, ArrowRight, Hotel, Plane, Gauge, Route } from 'lucide-react';
import type { PlannerEditorialData, EditorialSegment, EditorialNextAction } from '@/features/trip-planner/editorial';

interface PlannerEditorialBlockProps {
  editorial: PlannerEditorialData;
  onActionClick?: (message: string) => void;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  hotel: <Hotel className="h-3.5 w-3.5" />,
  flight: <Plane className="h-3.5 w-3.5" />,
  pace: <Gauge className="h-3.5 w-3.5" />,
  route: <Route className="h-3.5 w-3.5" />,
};

function SegmentHighlights({ segment }: { segment: EditorialSegment }) {
  if (segment.highlights.length === 0) return null;

  return (
    <ul className="mt-1.5 space-y-1">
      {segment.highlights.map((h, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
          <span>
            <span className="font-medium text-foreground">{h.name}</span>
            {h.why && <span className="text-muted-foreground"> — {h.why}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DayPreviews({ segment }: { segment: EditorialSegment }) {
  if (segment.dayPreviews.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      {segment.dayPreviews.map((day) => (
        <div key={day.dayNumber} className="text-sm">
          <span className="font-medium text-foreground">Dia {day.dayNumber}: {day.title}</span>
          <span className="text-muted-foreground"> — {day.oneLiner}</span>
        </div>
      ))}
    </div>
  );
}

function RouteFlow({ overview }: { overview: string }) {
  const parts = overview.split(' \u2192 ');

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-2">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/60" />}
          <Badge variant="secondary" className="text-xs font-medium">
            {part}
          </Badge>
        </span>
      ))}
    </div>
  );
}

function ExtraordinaryHighlights({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-amber-200/50 bg-amber-50/30 p-3">
      <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
        <Sparkles className="h-4 w-4" />
        <span>Experiencias destacadas</span>
      </div>
      <ul className="mt-2 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-amber-900/80 pl-5">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NextActions({ actions, onActionClick }: { actions: EditorialNextAction[]; onActionClick?: (message: string) => void }) {
  if (actions.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action, i) => (
        <Button
          key={i}
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => onActionClick?.(action.message)}
        >
          {action.icon && ACTION_ICONS[action.icon]}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export function PlannerEditorialBlock({ editorial, onActionClick }: PlannerEditorialBlockProps) {
  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.03] to-transparent p-4">
      {/* Title + Hook */}
      <div>
        <h3 className="text-base font-semibold text-foreground leading-tight">
          {editorial.tripTitle}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {editorial.tripHook}
        </p>
      </div>

      {/* Route Flow */}
      {editorial.segments.length > 1 && (
        <RouteFlow overview={editorial.routeOverview} />
      )}

      {/* Segments */}
      <div className="space-y-4">
        {editorial.segments.map((segment, i) => (
          <div key={i} className="border-l-2 border-primary/20 pl-3">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-foreground">
                {segment.city}
              </span>
              <span className="text-xs text-muted-foreground">
                {segment.nights} {segment.nights === 1 ? 'noche' : 'noches'}
              </span>
            </div>
            {segment.summary && (
              <p className="mt-0.5 text-sm text-muted-foreground">{segment.summary}</p>
            )}
            <SegmentHighlights segment={segment} />
            <DayPreviews segment={segment} />
          </div>
        ))}
      </div>

      {/* Travel Logic */}
      {editorial.travelLogic && editorial.segments.length > 1 && (
        <p className="text-xs text-muted-foreground italic">
          {editorial.travelLogic}
        </p>
      )}

      {/* Extraordinary Highlights */}
      <ExtraordinaryHighlights items={editorial.extraordinaryHighlights} />

      {/* Next Actions */}
      <NextActions actions={editorial.nextActions} onActionClick={onActionClick} />
    </div>
  );
}
