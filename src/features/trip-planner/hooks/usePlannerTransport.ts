import { useCallback, useEffect, useRef } from 'react';
import { runWithConcurrency, type CancelToken } from '@/utils/concurrencyPool';
import { handleFlightSearch } from '@/features/chat/services/searchHandlers';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import { formatDestinationLabel } from '../utils';
import { buildPlannerTransportSearchSignature, isDraftPlannerState } from '../helpers';
import type { PlannerStateAPI } from './usePlannerState';

export default function usePlannerTransport(state: PlannerStateAPI) {
  const {
    plannerState,
    updatePlannerState,
  } = state;

  const isAutoLoadingTransportRef = useRef(false);

  const loadTransportForSegment = useCallback(async (segmentId: string) => {
    if (!plannerState) return;
    const segmentIndex = plannerState.segments.findIndex((item) => item.id === segmentId);
    if (segmentIndex <= 0 || plannerState.isFlexibleDates) return;

    const segment = plannerState.segments[segmentIndex];
    const previousSegment = plannerState.segments[segmentIndex - 1];
    const departureDate = segment.startDate || plannerState.startDate || '';
    if (!previousSegment.city || !segment.city || !departureDate) return;

    const signature = buildPlannerTransportSearchSignature({
      origin: previousSegment.city,
      destination: segment.city,
      departureDate,
      adults: plannerState.travelers.adults || 1,
      children: plannerState.travelers.children || 0,
      infants: plannerState.travelers.infants || 0,
    });

    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((item) =>
        item.id !== segmentId
          ? item
          : {
              ...item,
              transportIn: {
                ...(item.transportIn || {
                  type: 'flight',
                  summary: `${previousSegment.city} a ${item.city}`,
                }),
                type: 'flight',
                summary: `${formatDestinationLabel(previousSegment.city)} a ${formatDestinationLabel(item.city)}`,
                origin: previousSegment.city,
                destination: item.city,
                date: item.startDate,
                searchStatus: 'loading',
                linkedSearchId: item.transportIn?.lastSearchSignature === signature ? item.transportIn?.linkedSearchId : undefined,
                selectedOptionId: item.transportIn?.lastSearchSignature === signature ? item.transportIn?.selectedOptionId : undefined,
                options: item.transportIn?.lastSearchSignature === signature ? item.transportIn?.options : [],
                lastSearchSignature: signature,
                error: undefined,
              },
            }
      ),
    }));

    const flightRequest: ParsedTravelRequest = {
      requestType: 'flights',
      flights: {
        origin: previousSegment.city,
        destination: segment.city,
        departureDate,
        adults: plannerState.travelers.adults || 1,
        children: plannerState.travelers.children || 0,
        infants: plannerState.travelers.infants || 0,
        stops: 'any',
      },
      confidence: 1,
      originalMessage: `Trip planner transport search from ${previousSegment.city} to ${segment.city}`,
    };

    try {
      const result = await handleFlightSearch(flightRequest);
      const flights = result.data?.combinedData?.flights || [];
      const flightSearchId = result.data?.combinedData?.flightSearchId;

      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
              ...item,
              transportIn: {
                type: 'flight',
                summary: `${formatDestinationLabel(previousSegment.city)} a ${formatDestinationLabel(item.city)}`,
                origin: previousSegment.city,
                destination: item.city,
                date: item.startDate,
                searchStatus: 'ready',
                linkedSearchId: flightSearchId,
                selectedOptionId: flights.length === 0
                  ? undefined
                  : flights.some((flight) => flight.id === item.transportIn?.selectedOptionId)
                    ? item.transportIn?.selectedOptionId
                    : flights[0]?.id,
                lastSearchSignature: signature,
                options: flights,
                error: flights.length === 0 ? result.response : undefined,
              },
            }
        ),
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudieron cargar las opciones de transporte.';
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                transportIn: {
                  type: 'flight',
                  summary: `${formatDestinationLabel(previousSegment.city)} a ${formatDestinationLabel(item.city)}`,
                origin: previousSegment.city,
                destination: item.city,
                date: item.startDate,
                searchStatus: 'error',
                linkedSearchId: undefined,
                selectedOptionId: undefined,
                lastSearchSignature: signature,
                options: [],
                error: errorMessage,
              },
            }
        ),
      }));
    }
  }, [plannerState, updatePlannerState]);

  // Auto-load transport effect
  useEffect(() => {
    if (!plannerState || plannerState.isFlexibleDates || isDraftPlannerState(plannerState) || isAutoLoadingTransportRef.current) {
      return;
    }

    const pendingSegments = plannerState.segments.filter((segment, index) => {
      if (index === 0) return false;

      const previousSegment = plannerState.segments[index - 1];
      const departureDate = segment.startDate || plannerState.startDate || '';
      if (!previousSegment?.city || !segment.city || !departureDate) {
        return false;
      }

      if (segment.transportIn?.searchStatus === 'loading') {
        return false;
      }

      const signature = buildPlannerTransportSearchSignature({
        origin: previousSegment.city,
        destination: segment.city,
        departureDate,
        adults: plannerState.travelers.adults || 1,
        children: plannerState.travelers.children || 0,
        infants: plannerState.travelers.infants || 0,
      });

      return segment.transportIn?.lastSearchSignature !== signature;
    });

    if (pendingSegments.length === 0) {
      return;
    }

    const cancelToken: CancelToken = { current: false };
    isAutoLoadingTransportRef.current = true;

    const pendingIds = new Set(pendingSegments.map((s) => s.id));
    updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((seg) =>
        !pendingIds.has(seg.id) || !seg.transportIn
          ? seg
          : { ...seg, transportIn: { ...seg.transportIn, searchStatus: 'loading' as const } }
      ),
    }));

    void (async () => {
      try {
        const tasks = pendingSegments.map(
          (segment) => () => loadTransportForSegment(segment.id),
        );
        await runWithConcurrency(tasks, 2, cancelToken);
      } finally {
        isAutoLoadingTransportRef.current = false;
      }
    })();

    return () => {
      cancelToken.current = true;
    };
  }, [loadTransportForSegment, plannerState, updatePlannerState]);

  const selectTransportOption = useCallback(async (segmentId: string, optionId: string) => {
    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((segment) =>
        segment.id !== segmentId
          ? segment
          : {
              ...segment,
              transportIn: segment.transportIn
                ? {
                    ...segment.transportIn,
                    selectedOptionId: optionId,
                  }
                : segment.transportIn,
            }
      ),
    }));
  }, [updatePlannerState]);

  return {
    loadTransportForSegment,
    selectTransportOption,
  };
}
