import { useCallback } from 'react';
import { createDebugTimer } from '@/utils/debugTiming';
import { normalizePlannerDayScheduling } from '../scheduling';
import type { PlannerPlaceCandidate } from '../types';
import {
  buildEmptyPlannerState,
  createSegmentFromCity,
  findSegmentByCity,
  formatDestinationLabel,
} from '../utils';
import { getPlannerPlaceCategoryLabel, isFoodLikePlannerPlace } from '../services/plannerPlaceMapper';
import { isDraftPlannerState } from '../helpers';
import {
  buildGoogleMapsActivityDescription,
  buildRealPlaceDayTitle,
  buildRealPlaceDaySummary,
  buildRealPlaceHighlights,
  buildSegmentRealPlaceSequence,
  getRealPlacesCandidatePool,
  pickPlaceForPlannerDay,
  shouldPromoteRealPlaceToDayTitle,
  shouldPromoteRealPlaceToDaySummary,
  type PlannerRealPlacesBundle,
} from '../placeScoring';
import type { PlannerStateAPI } from './usePlannerState';

export default function usePlannerPlaces(state: PlannerStateAPI) {
  const {
    conversationId,
    plannerState,
    updatePlannerState,
    ensureAndUpdatePlannerState,
    pendingRealPlacesHydrationRef,
    toast,
  } = state;

  const addPlaceToPlanner = useCallback(async (
    segmentId: string,
    input: {
      place: PlannerPlaceCandidate;
      dayId: string;
      block: 'morning' | 'afternoon' | 'evening';
    }
  ) => {
    if (!plannerState) return;

    const segment = plannerState.segments.find((item) => item.id === segmentId);
    const day = segment?.days.find((item) => item.id === input.dayId);

    if (!segment || !day) {
      toast({
        title: 'No pudimos agregar el lugar',
        description: 'Eleg\u00ed un d\u00eda v\u00e1lido del planner para ubicar esta actividad.',
        variant: 'destructive',
      });
      return;
    }

    const duplicateInBlock = day[input.block].some((activity) => activity.placeId === input.place.placeId);
    const duplicateRestaurant = day.restaurants.some((restaurant) => restaurant.placeId === input.place.placeId);
    if (duplicateInBlock || duplicateRestaurant) {
      toast({
        title: 'Ese lugar ya est\u00e1 en el planner',
        description: `${input.place.name} ya fue agregado en ${formatDestinationLabel(segment.city)}.`,
      });
      return;
    }

    await updatePlannerState((current) => {
      const segmentIndex = current.segments.findIndex((item) => item.id === segmentId);
      if (segmentIndex === -1) {
        return current;
      }

      const nextSegments = current.segments.map((currentSegment, currentSegmentIndex) => {
        if (currentSegment.id !== segmentId) {
          return currentSegment;
        }

        const nextDays = currentSegment.days.map((currentDay, dayIndex) => {
          if (currentDay.id !== input.dayId) {
            return currentDay;
          }

          const activityId = `gmaps-${input.place.placeId}-${input.block}`;
          const nextActivity = {
            id: activityId,
            time: undefined,
            title: input.place.name,
            description: buildGoogleMapsActivityDescription(input.place) || undefined,
            category: getPlannerPlaceCategoryLabel(input.place.category),
            activityType: input.place.activityType,
            recommendedSlot: input.block,
            neighborhood: input.place.formattedAddress,
            placeId: input.place.placeId,
            formattedAddress: input.place.formattedAddress,
            rating: input.place.rating,
            userRatingsTotal: input.place.userRatingsTotal,
            photoUrls: input.place.photoUrls,
            source: 'google_maps' as const,
          };

          const nextRestaurants = isFoodLikePlannerPlace(input.place) && !currentDay.restaurants.some((restaurant) => restaurant.placeId === input.place.placeId)
            ? [
                ...currentDay.restaurants,
                {
                  id: `gmaps-restaurant-${input.place.placeId}`,
                  name: input.place.name,
                  type: input.place.category === 'cafe' ? 'Cafe' : 'Restaurante',
                  placeId: input.place.placeId,
                  formattedAddress: input.place.formattedAddress,
                  rating: input.place.rating,
                  userRatingsTotal: input.place.userRatingsTotal,
                  source: 'google_maps' as const,
                },
              ]
            : currentDay.restaurants;

          const nextDay = {
            ...currentDay,
            [input.block]: [...currentDay[input.block], nextActivity],
            restaurants: nextRestaurants,
          };

          return normalizePlannerDayScheduling(nextDay, {
            pace: current.pace,
            travelers: current.travelers,
            isTransferDay: currentSegmentIndex > 0 && dayIndex === 0 && Boolean(currentSegment.transportIn),
          });
        });

        return {
          ...currentSegment,
          days: nextDays,
        };
      });

      return {
        ...current,
        segments: nextSegments,
      };
    });

    toast({
      title: 'Lugar agregado al planner',
      description: `${input.place.name} qued\u00f3 sumado en ${formatDestinationLabel(segment.city)}.`,
    });
  }, [plannerState, toast, updatePlannerState]);

  const addPlaceToFirstAvailableSlot = useCallback(async (
    place: {
      name: string;
      description?: string;
      category: string;
      suggestedSlot: 'morning' | 'afternoon' | 'evening';
      segmentCity: string;
    }
  ) => {
    if (!plannerState) return;

    // Map category string to PlannerPlaceCategory
    const mapCategory = (cat: string): PlannerPlaceCandidate['category'] => {
      const lower = cat.toLowerCase();
      if (/museo|museum/.test(lower)) return 'museum';
      if (/restaurante|gastronom|cena|almuerzo/.test(lower)) return 'restaurant';
      if (/cafe|cafeter/.test(lower)) return 'cafe';
      return 'activity';
    };

    // Build PlannerPlaceCandidate
    const placeCandidate: PlannerPlaceCandidate = {
      placeId: `recommended-${place.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: place.name,
      description: place.description,
      photoUrls: [],
      category: mapCategory(place.category),
    };

    // Normalize city for comparison (strip accents, lowercase)
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    const targetCity = normalize(place.segmentCity);

    // Find matching segment by city
    const segment = plannerState.segments.find(
      (s) => normalize(s.city) === targetCity || normalize(s.city).includes(targetCity) || targetCity.includes(normalize(s.city))
    );
    if (!segment) {
      toast({ title: 'Ciudad no encontrada en el itinerario', description: `No hay un tramo para "${place.segmentCity}".`, variant: 'destructive' });
      return;
    }

    const slotOrder: ('morning' | 'afternoon' | 'evening')[] = ['morning', 'afternoon', 'evening'];
    // Prefer suggestedSlot first, then others
    const orderedSlots = [place.suggestedSlot, ...slotOrder.filter((s) => s !== place.suggestedSlot)];

    for (const day of segment.days) {
      for (const slot of orderedSlots) {
        const activities = day[slot];
        const isAvailable = activities.length === 0 || activities.every((a) => a.source === 'generated');
        if (isAvailable) {
          await addPlaceToPlanner(segment.id, { place: placeCandidate, dayId: day.id, block: slot });
          return;
        }
      }
    }

    toast({ title: 'No hay espacio disponible', description: 'Todos los bloques están ocupados.', variant: 'destructive' });
  }, [plannerState, toast, addPlaceToPlanner]);

  const autoFillSegmentWithRealPlaces = useCallback(async (
    segmentId: string,
    placesByCategory: PlannerRealPlacesBundle,
  ) => {
    if (!conversationId || !plannerState || isDraftPlannerState(plannerState)) {
      return;
    }

    const targetSegment = plannerState.segments.find((segment) => segment.id === segmentId);
    if (!targetSegment || targetSegment.contentStatus !== 'ready') {
      return;
    }

    if (targetSegment.realPlacesStatus === 'ready' || targetSegment.realPlacesStatus === 'loading') {
      return;
    }

    if (pendingRealPlacesHydrationRef.current.has(segmentId)) {
      return;
    }

    pendingRealPlacesHydrationRef.current.add(segmentId);
    const timer = createDebugTimer('auto-fill-places', { segmentId, city: targetSegment.city });

    let insertedCount = 0;

    try {
      await updatePlannerState((current) => {
        const segmentIndex = current.segments.findIndex((segment) => segment.id === segmentId);
        if (segmentIndex === -1) {
          return current;
        }

        const segment = current.segments[segmentIndex];
        if (
          segment.contentStatus !== 'ready'
          || segment.realPlacesStatus === 'ready'
          || segment.realPlacesStatus === 'loading'
        ) {
          return current;
        }

        const candidatePool = getRealPlacesCandidatePool(placesByCategory, segment.days.length);
        if (candidatePool.length === 0) {
          return {
            ...current,
            segments: current.segments.map((currentSegment) =>
              currentSegment.id !== segmentId
                ? currentSegment
                : {
                    ...currentSegment,
                    realPlacesStatus: 'ready',
                    realPlacesError: undefined,
                  }
            ),
          };
        }

        const sequence = buildSegmentRealPlaceSequence(
          `${current.conversationId || conversationId || 'planner'}:${segment.id}:${segment.city}`,
          candidatePool,
          segment.days.length,
        );
        const usedPlaceIds = new Set<string>();
        insertedCount = 0;

        const nextDays = segment.days.map((day, dayIndex) => {
          const nextDay = {
            ...day,
            morning: [...day.morning],
            afternoon: [...day.afternoon],
            evening: [...day.evening],
            restaurants: [...day.restaurants],
          };

          const isTransferDay = segmentIndex > 0 && dayIndex === 0 && Boolean(segment.transportIn);
          const slotsToFill: ('morning' | 'afternoon' | 'evening')[] = isTransferDay
            ? ['afternoon', 'evening']
            : ['morning', 'afternoon', 'evening'];
          let titleDonor: PlannerPlaceCandidate | null = null;

          for (const targetSlot of slotsToFill) {
            const slotHasReal = nextDay[targetSlot].some((a) => a.source === 'google_maps');
            if (slotHasReal) continue;

            const selectedPlace = pickPlaceForPlannerDay(sequence, usedPlaceIds, `${segment.id}:${day.id}:${dayIndex}:${targetSlot}`);
            if (!selectedPlace) continue;

            const anchorActivity = {
              id: `gmaps-auto-${selectedPlace.placeId}-${targetSlot}`,
              time: undefined,
              title: selectedPlace.name,
              description: buildGoogleMapsActivityDescription(selectedPlace) || undefined,
              category: getPlannerPlaceCategoryLabel(selectedPlace.category),
              activityType: selectedPlace.activityType,
              recommendedSlot: targetSlot,
              neighborhood: selectedPlace.formattedAddress,
              placeId: selectedPlace.placeId,
              formattedAddress: selectedPlace.formattedAddress,
              rating: selectedPlace.rating,
              userRatingsTotal: selectedPlace.userRatingsTotal,
              photoUrls: selectedPlace.photoUrls,
              source: 'google_maps' as const,
            };

            const existing = nextDay[targetSlot];
            const replaceable = existing.length > 0 && existing.every((a) => a.source !== 'user' && a.source !== 'google_maps');
            nextDay[targetSlot] = replaceable
              ? [anchorActivity, ...existing.slice(1)]
              : [...existing, anchorActivity];

            if (!isFoodLikePlannerPlace(selectedPlace) && !titleDonor) {
              titleDonor = selectedPlace;
            }

            if (isFoodLikePlannerPlace(selectedPlace) && !nextDay.restaurants.some((r) => r.placeId === selectedPlace.placeId)) {
              nextDay.restaurants = [
                ...nextDay.restaurants,
                {
                  id: `gmaps-auto-restaurant-${selectedPlace.placeId}`,
                  name: selectedPlace.name,
                  type: selectedPlace.category === 'cafe' ? 'Cafe' : 'Restaurante',
                  placeId: selectedPlace.placeId,
                  formattedAddress: selectedPlace.formattedAddress,
                  rating: selectedPlace.rating,
                  userRatingsTotal: selectedPlace.userRatingsTotal,
                  photoUrls: selectedPlace.photoUrls,
                  source: 'google_maps' as const,
                },
              ];
            }

            usedPlaceIds.add(selectedPlace.placeId);
            insertedCount += 1;
          }

          // Guarantee at least one food place per day for gastronomic variety
          const dayHasFood = nextDay.restaurants.some((r) => r.source === 'google_maps');
          if (!dayHasFood) {
            const foodCandidate = sequence.find(
              (c) => !usedPlaceIds.has(c.placeId) && isFoodLikePlannerPlace(c)
            );
            if (foodCandidate) {
              const foodSlot = isTransferDay ? 'evening' : 'afternoon';
              const foodActivity = {
                id: `gmaps-auto-${foodCandidate.placeId}-food`,
                time: undefined,
                title: foodCandidate.name,
                description: buildGoogleMapsActivityDescription(foodCandidate) || undefined,
                category: getPlannerPlaceCategoryLabel(foodCandidate.category),
                activityType: foodCandidate.activityType,
                recommendedSlot: foodSlot,
                neighborhood: foodCandidate.formattedAddress,
                placeId: foodCandidate.placeId,
                formattedAddress: foodCandidate.formattedAddress,
                rating: foodCandidate.rating,
                userRatingsTotal: foodCandidate.userRatingsTotal,
                photoUrls: foodCandidate.photoUrls,
                source: 'google_maps' as const,
              };
              nextDay[foodSlot] = [...nextDay[foodSlot], foodActivity];
              nextDay.restaurants = [
                ...nextDay.restaurants,
                {
                  id: `gmaps-auto-restaurant-${foodCandidate.placeId}`,
                  name: foodCandidate.name,
                  type: foodCandidate.category === 'cafe' ? 'Cafe' : 'Restaurante',
                  placeId: foodCandidate.placeId,
                  formattedAddress: foodCandidate.formattedAddress,
                  rating: foodCandidate.rating,
                  userRatingsTotal: foodCandidate.userRatingsTotal,
                  photoUrls: foodCandidate.photoUrls,
                  source: 'google_maps' as const,
                },
              ];
              usedPlaceIds.add(foodCandidate.placeId);
              insertedCount += 1;
            }
          }

          if (titleDonor && shouldPromoteRealPlaceToDayTitle(nextDay)) {
            nextDay.title = buildRealPlaceDayTitle(titleDonor, day.dayNumber, segment.city);
          }
          if (titleDonor && shouldPromoteRealPlaceToDaySummary(nextDay)) {
            nextDay.summary = buildRealPlaceDaySummary(titleDonor, segment.city, day.dayNumber);
          }

          return normalizePlannerDayScheduling(nextDay, {
            pace: current.pace,
            travelers: current.travelers,
            isTransferDay,
          });
        });

        return {
          ...current,
          segments: current.segments.map((currentSegment) =>
            currentSegment.id !== segmentId
              ? currentSegment
              : {
                  ...currentSegment,
                  highlights: buildRealPlaceHighlights(segment.city, sequence),
                  days: nextDays,
                  realPlacesStatus: 'ready',
                  realPlacesError: insertedCount > 0 ? undefined : 'No encontramos suficientes lugares reales para este tramo.',
                }
          ),
        };
      }, 'system');
      timer.end('filled', { insertedCount });
    } finally {
      pendingRealPlacesHydrationRef.current.delete(segmentId);
    }
  }, [conversationId, plannerState, updatePlannerState, pendingRealPlacesHydrationRef]);

  // "Add to itinerary" entry point for discovery places in the chat.
  // Bootstraps empty state, creates segment for the city if missing, ensures a day exists,
  // and pushes the place into the suggested slot.
  const addRecommendedPlaceFromChat = useCallback(async (place: {
    name: string;
    description?: string;
    category: string;
    suggestedSlot: 'morning' | 'afternoon' | 'evening';
    segmentCity: string;
    placeId?: string;
    formattedAddress?: string;
    photoUrls?: string[];
    rating?: number;
    userRatingsTotal?: number;
  }) => {
    const targetCity = place.segmentCity?.trim();
    if (!targetCity) {
      toast({
        title: 'Falta la ciudad del lugar',
        description: 'No pudimos determinar el destino para sumarlo al itinerario.',
        variant: 'destructive',
      });
      return;
    }

    const mapCategory = (cat: string): PlannerPlaceCandidate['category'] => {
      const lower = cat.toLowerCase();
      if (/museo|museum/.test(lower)) return 'museum';
      if (/restaurante|gastronom|cena|almuerzo/.test(lower)) return 'restaurant';
      if (/cafe|cafeter/.test(lower)) return 'cafe';
      return 'activity';
    };

    const placeCandidate: PlannerPlaceCandidate = {
      placeId: place.placeId || `recommended-${place.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: place.name,
      description: place.description,
      photoUrls: place.photoUrls || [],
      formattedAddress: place.formattedAddress,
      rating: place.rating,
      userRatingsTotal: place.userRatingsTotal,
      category: mapCategory(place.category),
    };

    await ensureAndUpdatePlannerState(
      () => buildEmptyPlannerState(conversationId || undefined),
      (current) => {
        const existing = findSegmentByCity(current, targetCity);

        // Build segment if missing (default 2 nights, single empty day)
        let segments = current.segments;
        if (!existing) {
          const newSegment = createSegmentFromCity(targetCity, { order: current.segments.length });
          const dayId = `${newSegment.id}-day-1`;
          segments = [
            ...current.segments,
            {
              ...newSegment,
              days: [
                {
                  id: dayId,
                  dayNumber: 1,
                  city: targetCity,
                  title: `Día 1`,
                  morning: [],
                  afternoon: [],
                  evening: [],
                  restaurants: [],
                },
              ],
            },
          ];
        }

        const segmentId = existing?.id ?? segments[segments.length - 1].id;

        return {
          ...current,
          segments: segments.map((segment, segmentIndex) => {
            if (segment.id !== segmentId) return segment;

            // Ensure at least one day exists
            const days = segment.days.length > 0
              ? segment.days
              : [{
                  id: `${segment.id}-day-1`,
                  dayNumber: 1,
                  city: segment.city,
                  title: 'Día 1',
                  morning: [],
                  afternoon: [],
                  evening: [],
                  restaurants: [],
                }];

            // Pick first day with a free slot at the suggested block; fall back to day 0
            const targetDayIndex = Math.max(
              0,
              days.findIndex((d) => d[place.suggestedSlot].length === 0),
            );
            const targetDay = days[targetDayIndex] || days[0];

            const duplicate = targetDay[place.suggestedSlot].some(
              (a) => a.placeId === placeCandidate.placeId,
            );
            if (duplicate) return segment;

            const activityId = `gmaps-${placeCandidate.placeId}-${place.suggestedSlot}-${Date.now().toString(36)}`;
            const nextActivity = {
              id: activityId,
              title: placeCandidate.name,
              description: placeCandidate.description,
              category: getPlannerPlaceCategoryLabel(placeCandidate.category),
              recommendedSlot: place.suggestedSlot,
              neighborhood: placeCandidate.formattedAddress,
              placeId: placeCandidate.placeId,
              formattedAddress: placeCandidate.formattedAddress,
              rating: placeCandidate.rating,
              userRatingsTotal: placeCandidate.userRatingsTotal,
              photoUrls: placeCandidate.photoUrls,
              source: 'google_maps' as const,
            };

            const nextDays = days.map((day, dayIndex) => {
              if (day.id !== targetDay.id) return day;

              const updatedDay = {
                ...day,
                [place.suggestedSlot]: [...day[place.suggestedSlot], nextActivity],
                restaurants: isFoodLikePlannerPlace(placeCandidate)
                  && !day.restaurants.some((r) => r.placeId === placeCandidate.placeId)
                  ? [
                      ...day.restaurants,
                      {
                        id: `gmaps-restaurant-${placeCandidate.placeId}`,
                        name: placeCandidate.name,
                        type: placeCandidate.category === 'cafe' ? 'Cafe' : 'Restaurante',
                        placeId: placeCandidate.placeId,
                        formattedAddress: placeCandidate.formattedAddress,
                        rating: placeCandidate.rating,
                        userRatingsTotal: placeCandidate.userRatingsTotal,
                        source: 'google_maps' as const,
                      },
                    ]
                  : day.restaurants,
              };

              return normalizePlannerDayScheduling(updatedDay, {
                pace: current.pace,
                travelers: current.travelers,
                isTransferDay: segmentIndex > 0 && dayIndex === 0 && Boolean(segment.transportIn),
              });
            });

            return { ...segment, days: nextDays };
          }),
        };
      },
    );

    toast({
      title: 'Lugar agregado al itinerario',
      description: `${place.name} en ${formatDestinationLabel(targetCity)}.`,
    });
  }, [conversationId, ensureAndUpdatePlannerState, toast]);

  return {
    addPlaceToPlanner,
    addPlaceToFirstAvailableSlot,
    addRecommendedPlaceFromChat,
    autoFillSegmentWithRealPlaces,
  };
}
