import { useCallback, useState } from 'react';
import type { PlannerSuggestion, TripPlannerState } from '../types';
import { formatDestinationLabel } from '../utils';

interface UseSuggestionActionsDeps {
  loadTransportForSegment: (segmentId: string) => void;
  loadHotelsForSegment: (segmentId: string) => Promise<void>;
  updateTripField: <K extends keyof TripPlannerState>(field: K, value: TripPlannerState[K]) => Promise<void>;
  plannerState: TripPlannerState | null;
  onSendMessage: (message: string) => void;
  onOpenDateSelector?: () => void;
}

export default function useSuggestionActions(deps: UseSuggestionActionsDeps) {
  const {
    loadTransportForSegment,
    loadHotelsForSegment,
    updateTripField,
    plannerState,
    onSendMessage,
    onOpenDateSelector,
  } = deps;

  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  const handleSuggestionClick = useCallback(async (suggestion: PlannerSuggestion) => {
    setLoadingActionId(suggestion.id);

    try {
      switch (suggestion.action) {
        case 'search_transport': {
          if (suggestion.payload.segmentId) {
            loadTransportForSegment(suggestion.payload.segmentId);
          }
          break;
        }
        case 'search_hotels': {
          if (suggestion.payload.segmentId) {
            await loadHotelsForSegment(suggestion.payload.segmentId);
          }
          break;
        }
        case 'confirm_field': {
          const field = suggestion.payload.field as keyof TripPlannerState | undefined;
          if (field && plannerState) {
            await updateTripField(field, plannerState[field]);
          }
          break;
        }
        case 'confirm_location_dates': {
          if (plannerState) {
            if (plannerState.origin) {
              await updateTripField('origin', plannerState.origin);
            }
            if (plannerState.startDate !== undefined) {
              await updateTripField('startDate', plannerState.startDate);
            }
            if (plannerState.endDate !== undefined) {
              await updateTripField('endDate', plannerState.endDate);
            }
            if (plannerState.isFlexibleDates) {
              await updateTripField('isFlexibleDates', plannerState.isFlexibleDates);
            }
          }
          break;
        }
        case 'select_dates': {
          onOpenDateSelector?.();
          break;
        }
        case 'fill_slot': {
          const slotLabel = suggestion.payload.slot === 'afternoon' ? 'la tarde' : 'la noche';
          const city = suggestion.payload.segmentCity
            ? formatDestinationLabel(suggestion.payload.segmentCity)
            : '';
          const isCouple = plannerState &&
            plannerState.travelers.adults === 2 &&
            (plannerState.travelers.children || 0) === 0 &&
            (plannerState.travelers.infants || 0) === 0;
          const prompt = isCouple && suggestion.payload.slot === 'evening'
            ? `Sugiere cenas exclusivas y experiencias románticas para la noche en ${city}`
            : `Sugiere actividades para ${slotLabel} en ${city}`;
          onSendMessage(prompt);
          break;
        }
        case 'add_transfers': {
          onSendMessage('Añadir traslados privados al plan');
          break;
        }
      }
    } finally {
      setLoadingActionId(null);
    }
  }, [loadTransportForSegment, loadHotelsForSegment, updateTripField, plannerState, onSendMessage, onOpenDateSelector]);

  return { handleSuggestionClick, loadingActionId };
}
