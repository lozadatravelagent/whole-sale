import { useCallback, useEffect, useMemo, useRef } from 'react';
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
  const lastCompletedTransportSignatureRef = useRef<string | null>(null);
  const autoLoadTransportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const plannerStateRef = useRef(plannerState);
  plannerStateRef.current = plannerState;

  const transportSearchInputSignature = useMemo(() => {
    if (!plannerState || plannerState.isFlexibleDates || isDraftPlannerState(plannerState)) return null;
    return plannerState.segments
      .map((s, index) => {
        if (index === 0) return '';
        const prev = plannerState.segments[index - 1];
        const departureDate = s.startDate || plannerState.startDate || '';
        if (!prev.city || !s.city || !departureDate) return '';
        return `${s.id}|${buildPlannerTransportSearchSignature({
          origin: prev.city,
          destination: s.city,
          departureDate,
          adults: plannerState.travelers.adults || 1,
          children: plannerState.travelers.children || 0,
          infants: plannerState.travelers.infants || 0,
        })}`;
      })
      .join('::');
  }, [plannerState]);

  const loadTransportForSegment = useCallback(async (segmentId: string, signal?: AbortSignal) => {
    const currentState = plannerStateRef.current;
    if (!currentState) return;
    const segmentIndex = currentState.segments.findIndex((item) => item.id === segmentId);
    if (segmentIndex <= 0 || currentState.isFlexibleDates) return;

    const segment = currentState.segments[segmentIndex];
    const previousSegment = currentState.segments[segmentIndex - 1];
    const departureDate = segment.startDate || currentState.startDate || '';
    if (!previousSegment.city || !segment.city || !departureDate) return;

    const signature = buildPlannerTransportSearchSignature({
      origin: previousSegment.city,
      destination: segment.city,
      departureDate,
      adults: currentState.travelers.adults || 1,
      children: currentState.travelers.children || 0,
      infants: currentState.travelers.infants || 0,
    });

    if (signal?.aborted) return;

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
        adults: currentState.travelers.adults || 1,
        children: currentState.travelers.children || 0,
        infants: currentState.travelers.infants || 0,
        stops: 'any',
      },
      confidence: 1,
      originalMessage: `Trip planner transport search from ${previousSegment.city} to ${segment.city}`,
    };

    if (signal?.aborted) {
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId ? item : {
            ...item,
            transportIn: item.transportIn
              ? { ...item.transportIn, searchStatus: 'idle' }
              : item.transportIn,
          }
        ),
      }));
      return;
    }

    try {
      const result = await handleFlightSearch(flightRequest);
      if (signal?.aborted) {
        await updatePlannerState((current) => ({
          ...current,
          segments: current.segments.map((item) =>
            item.id !== segmentId ? item : {
              ...item,
              transportIn: item.transportIn
                ? { ...item.transportIn, searchStatus: 'idle' }
                : item.transportIn,
            }
          ),
        }));
        return;
      }
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
      if (signal?.aborted) {
        await updatePlannerState((current) => ({
          ...current,
          segments: current.segments.map((item) =>
            item.id !== segmentId ? item : {
              ...item,
              transportIn: item.transportIn
                ? { ...item.transportIn, searchStatus: 'idle' }
                : item.transportIn,
            }
          ),
        }));
        return;
      }
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
  }, [updatePlannerState]);

  // Auto-load transport effect (800ms debounce)
  useEffect(() => {
    const currentState = plannerStateRef.current;
    if (!currentState || !transportSearchInputSignature || isAutoLoadingTransportRef.current) {
      return;
    }

    const pendingSegments = currentState.segments.filter((segment, index) => {
      if (index === 0) return false;

      const previousSegment = currentState.segments[index - 1];
      const departureDate = segment.startDate || currentState.startDate || '';
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
        adults: currentState.travelers.adults || 1,
        children: currentState.travelers.children || 0,
        infants: currentState.travelers.infants || 0,
      });

      return segment.transportIn?.lastSearchSignature !== signature;
    });

    if (pendingSegments.length === 0) {
      return;
    }

    const batchSignature = pendingSegments
      .map((s) => {
        const idx = currentState.segments.findIndex((seg) => seg.id === s.id);
        const prev = currentState.segments[idx - 1];
        const departureDate = s.startDate || currentState.startDate || '';
        return `${s.id}|${buildPlannerTransportSearchSignature({
          origin: prev.city,
          destination: s.city,
          departureDate,
          adults: currentState.travelers.adults || 1,
          children: currentState.travelers.children || 0,
          infants: currentState.travelers.infants || 0,
        })}`;
      })
      .join('::');

    if (lastCompletedTransportSignatureRef.current === batchSignature) {
      return;
    }

    // Clear previous debounce timer
    if (autoLoadTransportDebounceRef.current) {
      clearTimeout(autoLoadTransportDebounceRef.current);
    }

    const controller = new AbortController();
    const { signal } = controller;
    const cancelToken: CancelToken = { current: false };

    autoLoadTransportDebounceRef.current = setTimeout(() => {
      autoLoadTransportDebounceRef.current = null;
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

      if (signal.aborted) {
        console.error('[usePlannerTransport] Signal already aborted before task launch');
        updatePlannerState((current) => ({
          ...current,
          segments: current.segments.map((seg) =>
            !pendingIds.has(seg.id) || !seg.transportIn ? seg : {
              ...seg, transportIn: { ...seg.transportIn, searchStatus: 'idle' as const },
            }
          ),
        }));
        isAutoLoadingTransportRef.current = false;
        return;
      }

      void (async () => {
        const safetyTimeout = setTimeout(() => {
          console.error('[usePlannerTransport] Safety timeout (45s) — forcing error state');
          updatePlannerState((current) => ({
            ...current,
            segments: current.segments.map((seg) =>
              !pendingIds.has(seg.id) || !seg.transportIn ? seg : {
                ...seg,
                transportIn: {
                  ...seg.transportIn,
                  searchStatus: seg.transportIn.searchStatus === 'loading' ? 'error' : seg.transportIn.searchStatus,
                  error: seg.transportIn.searchStatus === 'loading'
                    ? 'La búsqueda tardó demasiado. Intentá de nuevo.'
                    : seg.transportIn.error,
                },
              }
            ),
          }));
        }, 45_000);

        try {
          const tasks = pendingSegments.map(
            (segment) => () => {
              if (signal.aborted) return Promise.resolve();
              return loadTransportForSegment(segment.id, signal);
            },
          );
          await runWithConcurrency(tasks, 2, cancelToken);
          if (!signal.aborted) {
            lastCompletedTransportSignatureRef.current = batchSignature;
          }
        } finally {
          clearTimeout(safetyTimeout);
          isAutoLoadingTransportRef.current = false;
          // Clear syncing fields related to transport
          if (!signal.aborted) {
            updatePlannerState((current) => {
              if (!current.syncingFields) return current;
              const { dates, travelers, ...rest } = current.syncingFields;
              const hasRemaining = Object.values(rest).some(Boolean);
              return {
                ...current,
                syncingFields: hasRemaining ? rest : undefined,
              };
            });
          }
        }
      })();
    }, 800);

    return () => {
      if (autoLoadTransportDebounceRef.current) {
        clearTimeout(autoLoadTransportDebounceRef.current);
        autoLoadTransportDebounceRef.current = null;
      }
      controller.abort();
      cancelToken.current = true;
    };
  }, [transportSearchInputSignature, loadTransportForSegment, updatePlannerState]);

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
