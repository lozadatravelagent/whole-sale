import { useMemo } from 'react';
import type { TripPlannerState } from '@/features/trip-planner/types';
import type { DiscoveryContext } from '../services/discoveryService';
import { hasItineraryContent } from '../utils/hasItineraryContent';
import { hasChatMapContent } from '../utils/chatMapModel';
import ChatMapPanel from './ChatMapPanel';
import ItineraryPanel from './ItineraryPanel';

interface ChatContextPanelProps {
  plannerState: TripPlannerState | null;
  discoveryContext?: DiscoveryContext | null;
  onRequestChanges?: () => void;
  onExportPdf?: () => Promise<void>;
}

export default function ChatContextPanel({
  plannerState,
  discoveryContext,
  onRequestChanges,
  onExportPdf,
}: ChatContextPanelProps) {
  const hasMap = useMemo(
    () => hasChatMapContent(plannerState, discoveryContext),
    [plannerState, discoveryContext],
  );
  const hasItinerary = hasItineraryContent(plannerState);

  if (!hasMap && !hasItinerary) return null;

  if (hasMap && !hasItinerary) {
    return (
      <ChatMapPanel
        plannerState={plannerState}
        discoveryContext={discoveryContext}
      />
    );
  }

  if (!hasMap && hasItinerary) {
    return (
      <ItineraryPanel
        plannerState={plannerState}
        onRequestChanges={onRequestChanges}
        onExportPdf={onExportPdf}
        className="border-l-0"
      />
    );
  }

  return (
    <ChatMapPanel
      plannerState={plannerState}
      discoveryContext={discoveryContext}
    />
  );
}
