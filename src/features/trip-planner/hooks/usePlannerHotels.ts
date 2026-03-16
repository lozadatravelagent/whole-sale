import { useCallback, useEffect, useRef } from 'react';
import { runWithConcurrency, type CancelToken } from '@/utils/concurrencyPool';
import { handleHotelSearch } from '@/features/chat/services/searchHandlers';
import { makeBudget } from '@/services/hotelSearch';
import type { LocalHotelData } from '@/features/chat/types/chat';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { PlannerPlaceHotelCandidate, TripPlannerState } from '../types';
import {
  buildMakeBudgetOccupancies,
  getPlannerHotelDisplayId,
} from '../utils';
import { rankInventoryHotelsForPlace } from '../services/plannerHotelMatcher';
import {
  buildPlannerHotelSearchSignature,
  isDraftPlannerState,
  mergePlannerHotels,
  normalizeHotelPlannerError,
  normalizeLocationLabel,
} from '../helpers';
import type { PlannerStateAPI } from './usePlannerState';

export default function usePlannerHotels(state: PlannerStateAPI) {
  const {
    plannerState,
    updatePlannerState,
  } = state;

  const isAutoLoadingHotelsRef = useRef(false);
  const lastCompletedHotelSignatureRef = useRef<string | null>(null);

  const getSegmentHotelSearchInput = useCallback((searchState: TripPlannerState, segmentId: string) => {
    const segment = searchState.segments.find((item) => item.id === segmentId);
    if (!segment || searchState.isFlexibleDates) {
      return null;
    }

    const checkinDate = segment.startDate || searchState.startDate || '';
    const checkoutDate = segment.endDate || searchState.endDate || '';
    if (!segment.city || !checkinDate || !checkoutDate) {
      return null;
    }

    return {
      city: segment.city,
      checkinDate,
      checkoutDate,
      adults: searchState.travelers.adults || 2,
      children: searchState.travelers.children || 0,
      infants: searchState.travelers.infants || 0,
    };
  }, []);

  const fetchInventoryHotels = useCallback(async (input: {
    city: string;
    checkinDate: string;
    checkoutDate: string;
    adults: number;
    children: number;
    infants: number;
    hotelName?: string;
  }) => {
    const hotelRequest: ParsedTravelRequest = {
      requestType: 'hotels',
      hotels: {
        city: input.city,
        checkinDate: input.checkinDate,
        checkoutDate: input.checkoutDate,
        adults: input.adults,
        children: input.children,
        infants: input.infants,
        ...(input.hotelName ? { hotelName: input.hotelName } : {}),
      },
      confidence: 1,
      originalMessage: input.hotelName
        ? `Trip planner hotel quote for ${input.hotelName} in ${input.city}`
        : `Trip planner hotel search for ${input.city}`,
    };

    const result = await handleHotelSearch(hotelRequest);
    const hotels = result.data?.combinedData?.hotels || [];
    const hotelSearchId = result.data?.combinedData?.hotelSearchId;
    const serviceError = hotels.length === 0 ? normalizeHotelPlannerError(result.response) : undefined;

    return {
      hotels,
      hotelSearchId,
      response: result.response,
      serviceError,
    };
  }, []);

  const loadHotelsForSegment = useCallback(async (segmentId: string, signal?: AbortSignal) => {
    if (!plannerState) return;
    const segment = plannerState.segments.find((item) => item.id === segmentId);
    if (!segment) return;

    const searchInput = getSegmentHotelSearchInput(plannerState, segmentId);
    if (!searchInput) {
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                hotelPlan: {
                  ...item.hotelPlan,
                  searchStatus: 'idle',
                  hotelRecommendations: [],
                  selectedHotelId: undefined,
                  linkedSearchId: undefined,
                  lastSearchSignature: undefined,
                  error: undefined,
                },
              }
        ),
      }));
      return;
    }

    const signature = buildPlannerHotelSearchSignature(searchInput);
    const searchChanged = segment.hotelPlan.lastSearchSignature !== signature;

    if (signal?.aborted) return;

    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((item) =>
        item.id !== segmentId
          ? item
          : {
              ...item,
              hotelPlan: {
                ...item.hotelPlan,
                checkinDate: searchInput.checkinDate,
                checkoutDate: searchInput.checkoutDate,
                searchStatus: 'loading',
                matchStatus: searchChanged && item.hotelPlan.selectedPlaceCandidate
                  ? 'selected_from_map'
                  : item.hotelPlan.matchStatus || 'idle',
                hotelRecommendations: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.hotelRecommendations
                  : [],
                selectedHotelId: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.selectedHotelId
                  : undefined,
                confirmedInventoryHotel: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.confirmedInventoryHotel
                  : null,
                inventoryMatchCandidates: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.inventoryMatchCandidates
                  : [],
                linkedSearchId: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.linkedSearchId
                  : undefined,
                quoteSearchId: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.quoteSearchId
                  : undefined,
                quoteLastValidatedAt: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.quoteLastValidatedAt
                  : undefined,
                quoteError: item.hotelPlan.lastSearchSignature === signature
                  ? item.hotelPlan.quoteError
                  : item.hotelPlan.selectedPlaceCandidate
                    ? 'Las fechas cambiaron. Confirm\u00e1 disponibilidad y precio para este destino.'
                    : undefined,
                lastSearchSignature: signature,
                error: undefined,
              },
            }
      ),
    }));

    if (signal?.aborted) return;

    try {
      const { hotels, hotelSearchId, serviceError } = await fetchInventoryHotels(searchInput);
      if (signal?.aborted) return;
      const noHotels = hotels.length === 0;
      const hotelError = noHotels ? serviceError : undefined;
      const hasServiceError = Boolean(hotelError);

      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : (() => {
                const existingSelected = item.hotelPlan.selectedHotelId;
                const selectedStillExists = existingSelected
                  ? hotels.some((hotel) => getPlannerHotelDisplayId(hotel) === existingSelected)
                  : false;

                return {
                  ...item,
                  hotelPlan: {
                    ...item.hotelPlan,
                    searchStatus: hasServiceError ? 'error' : 'ready',
                    checkinDate: searchInput.checkinDate,
                    checkoutDate: searchInput.checkoutDate,
                    hotelRecommendations: hotels,
                    linkedSearchId: hotelSearchId,
                    selectedHotelId: selectedStillExists ? existingSelected : undefined,
                    lastSearchSignature: signature,
                    error: hotelError,
                  },
                };
              })()
        ),
      }));
    } catch (error: unknown) {
      if (signal?.aborted) return;
      const errorMessage = error instanceof Error ? error.message : 'No se pudieron cargar los hoteles.';
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                hotelPlan: {
                  ...item.hotelPlan,
                  searchStatus: 'error',
                  lastSearchSignature: signature,
                  error: errorMessage,
                },
              }
        ),
      }));
    }
  }, [fetchInventoryHotels, getSegmentHotelSearchInput, plannerState, updatePlannerState]);

  // Auto-load hotels effect
  useEffect(() => {
    if (!plannerState || plannerState.isFlexibleDates || isDraftPlannerState(plannerState) || isAutoLoadingHotelsRef.current) {
      return;
    }

    const pendingSegments = plannerState.segments.filter((segment) => {
      const searchInput = getSegmentHotelSearchInput(plannerState, segment.id);
      if (!searchInput) {
        return false;
      }

      if (segment.hotelPlan.searchStatus === 'loading') {
        return false;
      }

      const signature = buildPlannerHotelSearchSignature(searchInput);
      return segment.hotelPlan.lastSearchSignature !== signature;
    });

    if (pendingSegments.length === 0) {
      return;
    }

    const batchSignature = pendingSegments
      .map((s) => {
        const input = getSegmentHotelSearchInput(plannerState, s.id)!;
        return `${s.id}|${buildPlannerHotelSearchSignature(input)}`;
      })
      .join('::');

    if (lastCompletedHotelSignatureRef.current === batchSignature) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    const cancelToken: CancelToken = { current: false };
    isAutoLoadingHotelsRef.current = true;

    const pendingIds = new Set(pendingSegments.map((s) => s.id));
    updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((seg) =>
        !pendingIds.has(seg.id)
          ? seg
          : { ...seg, hotelPlan: { ...seg.hotelPlan, searchStatus: 'loading' as const } }
      ),
    }));

    void (async () => {
      try {
        const tasks = pendingSegments.map(
          (segment) => () => {
            if (signal.aborted) return Promise.resolve();
            return loadHotelsForSegment(segment.id, signal);
          },
        );
        await runWithConcurrency(tasks, 2, cancelToken);
        if (!signal.aborted) {
          lastCompletedHotelSignatureRef.current = batchSignature;
        }
      } finally {
        isAutoLoadingHotelsRef.current = false;
      }
    })();

    return () => {
      controller.abort();
      cancelToken.current = true;
    };
  }, [getSegmentHotelSearchInput, loadHotelsForSegment, plannerState, updatePlannerState]);

  const resolveInventoryMatchForSegment = useCallback(async (
    segmentId: string,
    nextPlaceCandidate?: PlannerPlaceHotelCandidate
  ) => {
    if (!plannerState) return;

    const segment = plannerState.segments.find((item) => item.id === segmentId);
    const placeCandidate = nextPlaceCandidate || segment?.hotelPlan.selectedPlaceCandidate || null;
    if (!segment || !placeCandidate) return;

    const searchInput = getSegmentHotelSearchInput(plannerState, segmentId);
    if (!searchInput) {
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                hotelPlan: {
                  ...item.hotelPlan,
                  matchStatus: 'selected_from_map',
                  selectedPlaceCandidate: placeCandidate,
                  inventoryMatchCandidates: [],
                  confirmedInventoryHotel: null,
                  selectedHotelId: undefined,
                  quoteSearchId: undefined,
                  quoteLastValidatedAt: undefined,
                  quoteError: 'Eleg\u00ed fechas exactas para confirmar disponibilidad y precio.',
                  error: undefined,
                },
              }
        ),
      }));
      return;
    }

    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((item) =>
        item.id !== segmentId
          ? item
          : {
              ...item,
              hotelPlan: {
                ...item.hotelPlan,
                selectedPlaceCandidate: placeCandidate,
                matchStatus: 'matching_inventory',
                inventoryMatchCandidates: [],
                confirmedInventoryHotel: null,
                selectedHotelId: undefined,
                quoteSearchId: undefined,
                quoteLastValidatedAt: undefined,
                quoteError: undefined,
                error: undefined,
              },
            }
      ),
    }));

    try {
      const narrowedResult = await fetchInventoryHotels({
        ...searchInput,
        hotelName: placeCandidate.name,
      });

      if (narrowedResult.serviceError) {
        await updatePlannerState((current) => ({
          ...current,
          segments: current.segments.map((item) =>
            item.id !== segmentId
              ? item
              : {
                  ...item,
                  hotelPlan: {
                    ...item.hotelPlan,
                    matchStatus: 'error',
                    selectedPlaceCandidate: placeCandidate,
                    inventoryMatchCandidates: [],
                    quoteError: narrowedResult.serviceError,
                    error: narrowedResult.serviceError,
                  },
                }
          ),
        }));
        return;
      }

      const narrowedMatch = rankInventoryHotelsForPlace({
        placeCandidate,
        hotels: narrowedResult.hotels,
        linkedSearchId: narrowedResult.hotelSearchId,
      });

      if (narrowedMatch.status === 'matched' && narrowedMatch.autoSelectedHotelId) {
        const matchedCandidate = narrowedMatch.candidates.find(
          (candidate) => candidate.hotelId === narrowedMatch.autoSelectedHotelId
        );

        if (matchedCandidate) {
          await updatePlannerState((current) => ({
            ...current,
            segments: current.segments.map((item) =>
              item.id !== segmentId
                ? item
                : {
                    ...item,
                    hotelPlan: {
                      ...item.hotelPlan,
                      searchStatus: 'ready',
                      matchStatus: 'quoted',
                      selectedPlaceCandidate: placeCandidate,
                      selectedHotelId: matchedCandidate.hotelId,
                      confirmedInventoryHotel: matchedCandidate.hotel,
                      inventoryMatchCandidates: narrowedMatch.candidates,
                      hotelRecommendations: mergePlannerHotels(
                        [matchedCandidate.hotel],
                        narrowedResult.hotels,
                        item.hotelPlan.hotelRecommendations
                      ),
                      linkedSearchId: narrowedResult.hotelSearchId || item.hotelPlan.linkedSearchId,
                      quoteSearchId: narrowedResult.hotelSearchId,
                      quoteLastValidatedAt: new Date().toISOString(),
                      quoteError: undefined,
                      error: undefined,
                    },
                  }
            ),
          }));
          return;
        }
      }

      if (narrowedMatch.status === 'needs_confirmation' && narrowedMatch.candidates.length > 0) {
        await updatePlannerState((current) => ({
          ...current,
          segments: current.segments.map((item) =>
            item.id !== segmentId
              ? item
              : {
                  ...item,
                  hotelPlan: {
                    ...item.hotelPlan,
                    matchStatus: 'needs_confirmation',
                    selectedPlaceCandidate: placeCandidate,
                    inventoryMatchCandidates: narrowedMatch.candidates,
                    hotelRecommendations: mergePlannerHotels(
                      narrowedResult.hotels,
                      item.hotelPlan.hotelRecommendations
                    ),
                    linkedSearchId: narrowedResult.hotelSearchId || item.hotelPlan.linkedSearchId,
                    quoteError: 'Encontramos varias coincidencias posibles. Confirm\u00e1 cu\u00e1l quer\u00e9s cotizar.',
                    error: undefined,
                  },
                }
          ),
        }));
        return;
      }

      let alternativeHotels = segment.hotelPlan.hotelRecommendations;
      let alternativeSearchId = segment.hotelPlan.linkedSearchId;

      const currentSignature = buildPlannerHotelSearchSignature(searchInput);
      const shouldRefreshAlternatives =
        segment.hotelPlan.lastSearchSignature !== currentSignature || alternativeHotels.length === 0;

      if (shouldRefreshAlternatives) {
        const broadResult = await fetchInventoryHotels(searchInput);
        alternativeHotels = broadResult.hotels;
        alternativeSearchId = broadResult.hotelSearchId;
      }

      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                hotelPlan: {
                  ...item.hotelPlan,
                  searchStatus: 'ready',
                  matchStatus: 'not_found',
                  selectedPlaceCandidate: placeCandidate,
                  inventoryMatchCandidates: narrowedMatch.candidates,
                  confirmedInventoryHotel: null,
                  selectedHotelId: undefined,
                  hotelRecommendations: mergePlannerHotels(alternativeHotels, narrowedResult.hotels),
                  linkedSearchId: alternativeSearchId || item.hotelPlan.linkedSearchId,
                  quoteSearchId: undefined,
                  quoteLastValidatedAt: undefined,
                  quoteError: 'No encontramos este hotel exacto en inventario. Elegi una alternativa real para cotizar.',
                  error: undefined,
                },
              }
        ),
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo confirmar disponibilidad del hotel elegido.';
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                hotelPlan: {
                  ...item.hotelPlan,
                  matchStatus: 'error',
                  selectedPlaceCandidate: placeCandidate,
                  inventoryMatchCandidates: [],
                  quoteError: errorMessage,
                  error: errorMessage,
                },
              }
        ),
      }));
    }
  }, [fetchInventoryHotels, getSegmentHotelSearchInput, plannerState, updatePlannerState]);

  const selectHotelPlaceFromMap = useCallback(async (segmentId: string, placeCandidate: PlannerPlaceHotelCandidate) => {
    if (placeCandidate.source === 'inventory' && placeCandidate.hotel && placeCandidate.hotelId) {
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((segment) =>
          segment.id !== segmentId
            ? segment
            : {
                ...segment,
                hotelPlan: {
                  ...segment.hotelPlan,
                  searchStatus: 'ready',
                  selectedPlaceCandidate: placeCandidate,
                  matchStatus: 'quoted',
                  inventoryMatchCandidates: [],
                  confirmedInventoryHotel: placeCandidate.hotel,
                  selectedHotelId: placeCandidate.hotelId,
                  hotelRecommendations: mergePlannerHotels(
                    [placeCandidate.hotel],
                    segment.hotelPlan.hotelRecommendations
                  ),
                  quoteSearchId: segment.hotelPlan.linkedSearchId,
                  quoteLastValidatedAt: new Date().toISOString(),
                  quoteError: undefined,
                  error: undefined,
                },
              }
        ),
      }));
      return;
    }

    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((segment) =>
        segment.id !== segmentId
          ? segment
          : {
              ...segment,
              hotelPlan: {
                ...segment.hotelPlan,
                selectedPlaceCandidate: placeCandidate,
                matchStatus: 'selected_from_map',
                inventoryMatchCandidates: [],
                confirmedInventoryHotel: null,
                selectedHotelId: undefined,
                quoteSearchId: undefined,
                quoteLastValidatedAt: undefined,
                quoteError: undefined,
                error: undefined,
              },
            }
      ),
    }));

    await resolveInventoryMatchForSegment(segmentId, placeCandidate);
  }, [resolveInventoryMatchForSegment, updatePlannerState]);

  const confirmInventoryHotelMatch = useCallback(async (segmentId: string, hotelId: string) => {
    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((segment) => {
        if (segment.id !== segmentId) {
          return segment;
        }

        const matchedCandidate = segment.hotelPlan.inventoryMatchCandidates?.find(
          (candidate) => candidate.hotelId === hotelId
        );

        if (!matchedCandidate) {
          return segment;
        }

        return {
          ...segment,
          hotelPlan: {
            ...segment.hotelPlan,
            searchStatus: 'ready',
            matchStatus: 'quoted',
            selectedHotelId: matchedCandidate.hotelId,
            confirmedInventoryHotel: matchedCandidate.hotel,
            hotelRecommendations: mergePlannerHotels(
              [matchedCandidate.hotel],
              segment.hotelPlan.hotelRecommendations
            ),
            inventoryMatchCandidates: [],
            quoteSearchId: matchedCandidate.linkedSearchId,
            quoteLastValidatedAt: new Date().toISOString(),
            quoteError: undefined,
            error: undefined,
          },
        };
      }),
    }));
  }, [updatePlannerState]);

  const refreshQuotedHotel = useCallback(async (segmentId: string) => {
    if (!plannerState) return;

    const segment = plannerState.segments.find((item) => item.id === segmentId);
    if (!segment) return;

    const searchInput = getSegmentHotelSearchInput(plannerState, segmentId);
    if (!searchInput) {
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                hotelPlan: {
                  ...item.hotelPlan,
                  quoteError: 'Eleg\u00ed fechas exactas para confirmar disponibilidad y precio.',
                },
              }
        ),
      }));
      return;
    }

    const lookupName =
      segment.hotelPlan.confirmedInventoryHotel?.name ||
      segment.hotelPlan.selectedPlaceCandidate?.name;

    if (!lookupName) {
      return;
    }

    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((item) =>
        item.id !== segmentId
          ? item
          : {
              ...item,
              hotelPlan: {
                ...item.hotelPlan,
                matchStatus: 'quoting',
                quoteError: undefined,
                error: undefined,
              },
            }
      ),
    }));

    try {
      const refreshedResult = await fetchInventoryHotels({
        ...searchInput,
        hotelName: lookupName,
      });

      if (refreshedResult.serviceError) {
        throw new Error(refreshedResult.serviceError);
      }

      const selectedHotelId = segment.hotelPlan.selectedHotelId;
      let selectedHotel = refreshedResult.hotels.find(
        (hotel) => getPlannerHotelDisplayId(hotel) === selectedHotelId
      );

      if (!selectedHotel && segment.hotelPlan.confirmedInventoryHotel) {
        const expectedName = normalizeLocationLabel(segment.hotelPlan.confirmedInventoryHotel.name);
        selectedHotel = refreshedResult.hotels.find(
          (hotel) => normalizeLocationLabel(hotel.name) === expectedName
        );
      }

      if (!selectedHotel && segment.hotelPlan.selectedPlaceCandidate) {
        const refreshedMatch = rankInventoryHotelsForPlace({
          placeCandidate: segment.hotelPlan.selectedPlaceCandidate,
          hotels: refreshedResult.hotels,
          linkedSearchId: refreshedResult.hotelSearchId,
        });

        if (refreshedMatch.status === 'needs_confirmation') {
          await updatePlannerState((current) => ({
            ...current,
            segments: current.segments.map((item) =>
              item.id !== segmentId
                ? item
                : {
                    ...item,
                    hotelPlan: {
                      ...item.hotelPlan,
                      matchStatus: 'needs_confirmation',
                      inventoryMatchCandidates: refreshedMatch.candidates,
                      hotelRecommendations: mergePlannerHotels(
                        refreshedResult.hotels,
                        item.hotelPlan.hotelRecommendations
                      ),
                      quoteError: 'La validaci\u00f3n devolvi\u00f3 varias opciones. Confirm\u00e1 el hotel real nuevamente.',
                    },
                  }
            ),
          }));
          return;
        }

        if (refreshedMatch.status === 'matched' && refreshedMatch.autoSelectedHotelId) {
          selectedHotel = refreshedMatch.candidates.find(
            (candidate) => candidate.hotelId === refreshedMatch.autoSelectedHotelId
          )?.hotel;
        }
      }

      if (!selectedHotel && refreshedResult.hotels.length === 1) {
        selectedHotel = refreshedResult.hotels[0];
      }

      if (!selectedHotel) {
        await resolveInventoryMatchForSegment(segmentId);
        return;
      }

      const refreshedHotelId = getPlannerHotelDisplayId(selectedHotel);

      // Update state with refreshed hotel data (still quoting)
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                hotelPlan: {
                  ...item.hotelPlan,
                  searchStatus: 'ready',
                  matchStatus: 'quoting',
                  selectedHotelId: refreshedHotelId,
                  confirmedInventoryHotel: selectedHotel,
                  hotelRecommendations: mergePlannerHotels(
                    [selectedHotel],
                    refreshedResult.hotels,
                    item.hotelPlan.hotelRecommendations
                  ),
                  linkedSearchId: refreshedResult.hotelSearchId || item.hotelPlan.linkedSearchId,
                  quoteSearchId: refreshedResult.hotelSearchId,
                  quoteError: undefined,
                  error: undefined,
                  budgetId: undefined,
                  budgetPrice: undefined,
                  budgetCurrency: undefined,
                  budgetAgencyPricing: undefined,
                },
              }
        ),
      }));

      // Call makeBudget for exact pricing
      const roomIdx = segment.hotelPlan.selectedRoomIndex ?? 0;
      const budgetRoom = selectedHotel.rooms?.[roomIdx] || selectedHotel.rooms?.[0];

      if (selectedHotel.unique_id && budgetRoom?.fare_id_broker && searchInput) {
        try {
          const budgetResult = await makeBudget({
            fareId: selectedHotel.unique_id,
            fareIdBroker: budgetRoom.fare_id_broker,
            checkinDate: searchInput.checkinDate,
            checkoutDate: searchInput.checkoutDate,
            occupancies: buildMakeBudgetOccupancies(budgetRoom, {
              adults: searchInput.adults,
              children: searchInput.children,
              infants: searchInput.infants,
            }),
          });

          await updatePlannerState((current) => ({
            ...current,
            segments: current.segments.map((item) =>
              item.id !== segmentId
                ? item
                : {
                    ...item,
                    hotelPlan: {
                      ...item.hotelPlan,
                      matchStatus: 'quoted',
                      quoteLastValidatedAt: new Date().toISOString(),
                      budgetId: budgetResult.budgetId,
                      budgetPrice: budgetResult.subTotalAmount,
                      budgetCurrency: budgetResult.currency,
                      budgetAgencyPricing: budgetResult.agencyPricing,
                      quoteError: budgetResult.success ? undefined : (budgetResult.error || 'Error al presupuestar'),
                    },
                  }
            ),
          }));
        } catch (budgetErr: unknown) {
          const budgetErrMessage = budgetErr instanceof Error ? budgetErr.message : 'Error desconocido';
          await updatePlannerState((current) => ({
            ...current,
            segments: current.segments.map((item) =>
              item.id !== segmentId
                ? item
                : {
                    ...item,
                    hotelPlan: {
                      ...item.hotelPlan,
                      matchStatus: 'quoted',
                      quoteLastValidatedAt: new Date().toISOString(),
                      quoteError: `No se pudo obtener precio final: ${budgetErrMessage}`,
                    },
                  }
            ),
          }));
        }
      } else {
        // No data for makeBudget -- mark as quoted with search price
        await updatePlannerState((current) => ({
          ...current,
          segments: current.segments.map((item) =>
            item.id !== segmentId
              ? item
              : {
                  ...item,
                  hotelPlan: {
                    ...item.hotelPlan,
                    matchStatus: 'quoted',
                    quoteLastValidatedAt: new Date().toISOString(),
                  },
                }
          ),
        }));
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo refrescar la cotización real.';
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((item) =>
          item.id !== segmentId
            ? item
            : {
                ...item,
                hotelPlan: {
                  ...item.hotelPlan,
                  matchStatus: 'error',
                  quoteError: errorMessage,
                  error: errorMessage,
                },
              }
        ),
      }));
    }
  }, [
    fetchInventoryHotels,
    getSegmentHotelSearchInput,
    plannerState,
    resolveInventoryMatchForSegment,
    updatePlannerState,
  ]);

  const selectHotel = useCallback(async (segmentId: string, hotelId: string, roomIndex?: number) => {
    if (!plannerState) return;

    const segment = plannerState.segments.find(s => s.id === segmentId);
    if (!segment) return;

    const selectedHotel = segment.hotelPlan.hotelRecommendations.find(
      (hotel) => getPlannerHotelDisplayId(hotel) === hotelId
    );

    // 1) Mark hotel as selected with "quoting" state
    await updatePlannerState((current) => ({
      ...current,
      segments: current.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;
        return {
          ...seg,
          hotelPlan: {
            ...seg.hotelPlan,
            selectedHotelId: hotelId,
            confirmedInventoryHotel: selectedHotel || seg.hotelPlan.confirmedInventoryHotel || null,
            matchStatus: 'quoting',
            inventoryMatchCandidates: selectedHotel ? [] : seg.hotelPlan.inventoryMatchCandidates,
            quoteSearchId: selectedHotel ? seg.hotelPlan.linkedSearchId : seg.hotelPlan.quoteSearchId,
            quoteError: undefined,
            selectedRoomIndex: roomIndex ?? 0,
            budgetId: undefined,
            budgetPrice: undefined,
            budgetCurrency: undefined,
            budgetAgencyPricing: undefined,
          },
        };
      }),
    }));

    // 2) Attempt makeBudget
    const hotel = selectedHotel || segment.hotelPlan.confirmedInventoryHotel;
    const room = hotel?.rooms?.[roomIndex ?? 0];
    const searchInput = getSegmentHotelSearchInput(plannerState, segmentId);

    if (hotel?.unique_id && room?.fare_id_broker && searchInput) {
      try {
        const budgetResult = await makeBudget({
          fareId: hotel.unique_id,
          fareIdBroker: room.fare_id_broker,
          checkinDate: searchInput.checkinDate,
          checkoutDate: searchInput.checkoutDate,
          occupancies: buildMakeBudgetOccupancies(room, {
            adults: searchInput.adults,
            children: searchInput.children,
            infants: searchInput.infants,
          }),
        });

        await updatePlannerState((current) => ({
          ...current,
          segments: current.segments.map((seg) => {
            if (seg.id !== segmentId) return seg;
            return {
              ...seg,
              hotelPlan: {
                ...seg.hotelPlan,
                matchStatus: 'quoted',
                quoteLastValidatedAt: new Date().toISOString(),
                budgetId: budgetResult.budgetId,
                budgetPrice: budgetResult.subTotalAmount,
                budgetCurrency: budgetResult.currency,
                budgetAgencyPricing: budgetResult.agencyPricing,
                quoteError: budgetResult.success ? undefined : (budgetResult.error || 'Error al presupuestar'),
              },
            };
          }),
        }));
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : 'Error desconocido';
        await updatePlannerState((current) => ({
          ...current,
          segments: current.segments.map((seg) => {
            if (seg.id !== segmentId) return seg;
            return {
              ...seg,
              hotelPlan: {
                ...seg.hotelPlan,
                matchStatus: 'quoted',
                quoteLastValidatedAt: new Date().toISOString(),
                quoteError: `No se pudo obtener precio final: ${errMessage}`,
              },
            };
          }),
        }));
      }
    } else {
      // Not enough data for makeBudget -- mark as quoted with search price
      await updatePlannerState((current) => ({
        ...current,
        segments: current.segments.map((seg) => {
          if (seg.id !== segmentId) return seg;
          return {
            ...seg,
            hotelPlan: {
              ...seg.hotelPlan,
              matchStatus: 'quoted',
              quoteLastValidatedAt: new Date().toISOString(),
            },
          };
        }),
      }));
    }
  }, [getSegmentHotelSearchInput, plannerState, updatePlannerState]);

  return {
    loadHotelsForSegment,
    selectHotel,
    selectHotelPlaceFromMap,
    resolveInventoryMatchForSegment,
    confirmInventoryHotelMatch,
    refreshQuotedHotel,
  };
}
