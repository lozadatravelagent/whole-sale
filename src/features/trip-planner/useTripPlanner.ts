import type { MessageRow } from '@/features/chat/types/chat';
import usePlannerState from './hooks/usePlannerState';
import usePlannerLocations from './hooks/usePlannerLocations';
import usePlannerGeneration from './hooks/usePlannerGeneration';
import usePlannerDestinations from './hooks/usePlannerDestinations';
import usePlannerPlaces from './hooks/usePlannerPlaces';
import usePlannerHotels from './hooks/usePlannerHotels';
import usePlannerTransport from './hooks/usePlannerTransport';

export default function useTripPlanner(
  conversationId: string | null,
  messages: MessageRow[],
  toast: (args: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
) {
  const state = usePlannerState(conversationId, messages, toast);
  usePlannerLocations(state);

  const generation = usePlannerGeneration(state);
  const destinations = usePlannerDestinations(state, generation.invokePlannerGeneration);
  const places = usePlannerPlaces(state);
  const hotels = usePlannerHotels(state);
  const transport = usePlannerTransport(state);

  return {
    plannerState: state.plannerState,
    plannerSummary: destinations.plannerSummary,
    isLoadingPlanner: state.isLoadingPlanner,
    activePlannerMutation: state.activePlannerMutation,
    isResolvingLocations: state.isResolvingLocations,
    plannerError: state.plannerError,
    plannerLocationWarning: state.plannerLocationWarning,
    persistPlannerState: state.persistPlannerState,
    setDraftPlannerFromRequest: state.setDraftPlannerFromRequest,
    setPlannerDraftPhase: state.setPlannerDraftPhase,
    reloadPlannerState: state.loadPersistedPlannerState,
    ensureSegmentEnriched: generation.ensureSegmentEnriched,
    updateTripField: destinations.updateTripField,
    setExactDateRange: destinations.setExactDateRange,
    applyPlannerDateSelection: destinations.applyPlannerDateSelection,
    addDestination: destinations.addDestination,
    removeDestination: destinations.removeDestination,
    reorderDestinations: destinations.reorderDestinations,
    regeneratePlanner: generation.regeneratePlanner,
    regenerateSegment: generation.regenerateSegment,
    regenerateDay: generation.regenerateDay,
    addPlaceToPlanner: places.addPlaceToPlanner,
    addPlaceToFirstAvailableSlot: places.addPlaceToFirstAvailableSlot,
    autoFillSegmentWithRealPlaces: places.autoFillSegmentWithRealPlaces,
    loadHotelsForSegment: hotels.loadHotelsForSegment,
    selectHotel: hotels.selectHotel,
    selectHotelPlaceFromMap: hotels.selectHotelPlaceFromMap,
    resolveInventoryMatchForSegment: hotels.resolveInventoryMatchForSegment,
    confirmInventoryHotelMatch: hotels.confirmInventoryHotelMatch,
    refreshQuotedHotel: hotels.refreshQuotedHotel,
    loadTransportForSegment: transport.loadTransportForSegment,
    selectTransportOption: transport.selectTransportOption,
  };
}
