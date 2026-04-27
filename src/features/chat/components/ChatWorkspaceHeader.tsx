import { Calendar, Download, Loader2, MapPin, Plus, Route, Users } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { TripPlannerState } from '@/features/trip-planner/types';
import {
  formatBudgetLevel,
  formatDateRange,
  formatDestinationLabel,
  formatFlexibleMonth,
  formatPaceLabel,
} from '@/features/trip-planner/utils';
import type { DiscoveryContext } from '../services/discoveryService';
import type { ConversationWithAgency } from '../types/chat';
import type { ChatMode } from '../utils/deriveDefaultMode';
import { hasItineraryContent } from '../utils/hasItineraryContent';
import { canExportPdf } from '@/services/pdf/itineraryPdfTemplate';
import ItineraryPanel from './ItineraryPanel';
import ModeSwitch from './ModeSwitch';

interface ChatWorkspaceHeaderContextProps {
  selectedConversation: string | null;
  conversation: ConversationWithAgency | null;
  plannerState: TripPlannerState | null;
  discoveryContext?: DiscoveryContext | null;
}

interface ChatWorkspaceHeaderActionsProps {
  accountType: 'consumer' | 'agent';
  selectedConversation: string | null;
  messagesCount: number;
  plannerState: TripPlannerState | null;
  chatMode?: ChatMode;
  hasAgency?: boolean;
  isAddingToCRM: boolean;
  onModeChange?: (next: ChatMode) => void;
  onAddToCRM: () => void;
  onRequestChanges?: () => void;
  onExportPdf?: () => Promise<void>;
}

function formatTravelersText(travelers: TripPlannerState['travelers']): string | null {
  const adults = travelers?.adults ?? 0;
  const children = travelers?.children ?? 0;
  const infants = travelers?.infants ?? 0;
  if (adults + children + infants === 0) return null;

  const parts: string[] = [];
  if (adults > 0) parts.push(`${adults} ${adults === 1 ? 'adulto' : 'adultos'}`);
  if (children > 0) parts.push(`${children} ${children === 1 ? 'menor' : 'menores'}`);
  if (infants > 0) parts.push(`${infants} ${infants === 1 ? 'bebé' : 'bebés'}`);
  return parts.join(' · ');
}

function getDestinations(plannerState: TripPlannerState | null, discoveryContext?: DiscoveryContext | null): string[] {
  const segmentCities = (plannerState?.segments ?? [])
    .map((segment) => segment.city)
    .filter((city): city is string => typeof city === 'string' && city.trim().length > 0);
  if (segmentCities.length > 0) return segmentCities;

  const destinations = (plannerState?.destinations ?? [])
    .filter((destination): destination is string => typeof destination === 'string' && destination.trim().length > 0);
  if (destinations.length > 0) return destinations;

  return discoveryContext?.destination?.city ? [discoveryContext.destination.city] : [];
}

function getDateLabel(plannerState: TripPlannerState | null): string | null {
  if (!plannerState) return null;
  if (plannerState.startDate && plannerState.endDate) {
    return formatDateRange(plannerState.startDate, plannerState.endDate);
  }
  if (plannerState.isFlexibleDates) {
    return formatFlexibleMonth(plannerState.flexibleMonth, plannerState.flexibleYear);
  }
  return null;
}

function getConversationTitle(conversation: ConversationWithAgency | null, plannerState: TripPlannerState | null): string {
  if (plannerState?.title) return plannerState.title;
  if (conversation?.external_key) return conversation.external_key;
  return 'Nueva conversación';
}

export function ChatWorkspaceHeaderContext({
  selectedConversation,
  conversation,
  plannerState,
  discoveryContext,
}: ChatWorkspaceHeaderContextProps) {
  if (!selectedConversation) return null;

  const destinations = getDestinations(plannerState, discoveryContext);
  const visibleDestinations = destinations.slice(0, 3);
  const extraDestinationCount = Math.max(0, destinations.length - visibleDestinations.length);
  const dateLabel = getDateLabel(plannerState);
  const travelersLabel = plannerState ? formatTravelersText(plannerState.travelers) : null;
  const daysLabel = plannerState?.days ? `${plannerState.days} días` : null;
  const budgetLabel = plannerState?.budgetLevel ? formatBudgetLevel(plannerState.budgetLevel) : null;
  const paceLabel = plannerState?.pace ? formatPaceLabel(plannerState.pace) : null;
  const title = getConversationTitle(conversation, plannerState);

  return (
    <div className="flex min-w-0 justify-center">
      <div className="min-w-0 text-center">
        <div className="flex min-w-0 justify-center">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        </div>
        <div className="mt-1 flex min-w-0 items-center justify-center gap-1.5 overflow-hidden">
          {visibleDestinations.length > 0 ? (
            <>
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              {visibleDestinations.map((destination) => (
                <Badge key={destination} variant="secondary" className="max-w-[120px] truncate px-2 py-0 text-xs font-normal">
                  {formatDestinationLabel(destination)}
                </Badge>
              ))}
              {extraDestinationCount > 0 && (
                <Badge variant="outline" className="px-2 py-0 text-xs font-normal">
                  +{extraDestinationCount}
                </Badge>
              )}
            </>
          ) : (
            <span className="truncate text-xs text-muted-foreground">Chat de viaje</span>
          )}
          {daysLabel && (
            <span className="flex-shrink-0 text-xs text-muted-foreground">· {daysLabel}</span>
          )}
          {dateLabel && (
            <span className="hidden flex-shrink-0 items-center gap-1 text-xs text-muted-foreground xl:flex">
              <Calendar className="h-3 w-3" />
              {dateLabel}
            </span>
          )}
          {travelersLabel && (
            <span className="hidden flex-shrink-0 items-center gap-1 text-xs text-muted-foreground 2xl:flex">
              <Users className="h-3 w-3" />
              {travelersLabel}
            </span>
          )}
          {budgetLabel && (
            <span className="hidden flex-shrink-0 text-xs text-muted-foreground 2xl:inline">· {budgetLabel}</span>
          )}
          {paceLabel && (
            <span className="hidden flex-shrink-0 text-xs text-muted-foreground 2xl:inline">· {paceLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatWorkspaceHeaderActions({
  accountType,
  selectedConversation,
  messagesCount,
  plannerState,
  chatMode,
  hasAgency = false,
  isAddingToCRM,
  onModeChange,
  onAddToCRM,
  onRequestChanges,
  onExportPdf,
}: ChatWorkspaceHeaderActionsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const hasItinerary = hasItineraryContent(plannerState);
  const canExport = hasItinerary && canExportPdf(plannerState);

  const handleExport = useCallback(async () => {
    if (!onExportPdf || isExporting) return;
    setIsExporting(true);
    try {
      await onExportPdf();
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, onExportPdf]);

  const itineraryPanel = useMemo(() => (
    <ItineraryPanel
      plannerState={plannerState}
      onRequestChanges={onRequestChanges}
      onExportPdf={onExportPdf}
      className="border-l-0"
    />
  ), [plannerState, onRequestChanges, onExportPdf]);

  return (
    <>
      {hasItinerary && (
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 px-3 text-xs">
              <Route className="h-3.5 w-3.5" />
              Itinerario
            </Button>
          </DialogTrigger>
          <DialogContent className="h-[min(760px,86vh)] max-w-md overflow-hidden p-0">
            <DialogTitle className="sr-only">Itinerario del viaje</DialogTitle>
            {itineraryPanel}
          </DialogContent>
        </Dialog>
      )}

      {canExport && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          PDF
        </Button>
      )}

      {accountType === 'agent' && chatMode && onModeChange && (
        <>
          <ModeSwitch
            mode={chatMode}
            hasAgency={hasAgency}
            onModeChange={onModeChange}
            className="hidden lg:inline-flex"
          />
          <ThemeToggle variant="compact" className="hidden lg:flex" />
          <Button
            onClick={onAddToCRM}
            disabled={isAddingToCRM || !selectedConversation || messagesCount === 0}
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-3 text-xs"
            title="Agregar conversación al CRM"
          >
            {isAddingToCRM ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            CRM
          </Button>
        </>
      )}
    </>
  );
}
