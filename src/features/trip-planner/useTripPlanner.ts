import { useEffect } from 'react';
import type { MessageRow } from '@/features/chat/types/chat';
import usePlannerState from './hooks/usePlannerState';
import usePlannerLocations from './hooks/usePlannerLocations';
import usePlannerGeneration from './hooks/usePlannerGeneration';
import usePlannerDestinations from './hooks/usePlannerDestinations';
import usePlannerPlaces from './hooks/usePlannerPlaces';
import usePlannerHotels from './hooks/usePlannerHotels';
import usePlannerTransport from './hooks/usePlannerTransport';
import { detectUserOriginCity } from './services/plannerGeocoding';
import { isDraftPlannerState } from './helpers';
import { formatDestinationLabel } from './utils';

export default function useTripPlanner(
  conversationId: string | null,
  messages: MessageRow[],
  toast: (args: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
) {
  const state = usePlannerState(conversationId, messages, toast);
  usePlannerLocations(state);

  // Auto-detect user origin when planner state exists but has no origin
  useEffect(() => {
    if (!state.plannerState || state.plannerState.origin) return;
    if (isDraftPlannerState(state.plannerState)) return;

    let cancelled = false;
    detectUserOriginCity().then((result) => {
      if (cancelled) return;
      const city = result?.city || 'Buenos Aires';
      const country = result?.country || 'Argentina';

      state.updatePlannerState((current) => {
        if (current.origin) return current;

        const firstSegment = current.segments[0];
        const updatedSegments = firstSegment
          ? current.segments.map((seg, i) =>
              i === 0 && !seg.transportIn
                ? {
                    ...seg,
                    transportIn: {
                      type: 'flight' as const,
                      summary: `${formatDestinationLabel(city)} a ${formatDestinationLabel(seg.city)}`,
                      origin: city,
                      destination: seg.city,
                      searchStatus: 'idle' as const,
                      options: [],
                    },
                  }
                : seg
            )
          : current.segments;

        return {
          ...current,
          origin: city,
          originCountry: country,
          fieldProvenance: {
            ...current.fieldProvenance,
            origin: 'assumed' as const,
          },
          segments: updatedSegments,
        };
      });
    });

    return () => { cancelled = true; };
  }, [state.plannerState?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
