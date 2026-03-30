import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchNearbyPlacesByCategory } from '../services/placesService';
import type { PlannerPlaceCandidate, PlannerPlaceCategory, TripPlannerState } from '../types';

const EAGER_FETCH_CATEGORIES: PlannerPlaceCategory[] = ['restaurant', 'cafe', 'museum', 'activity'];
const CHAT_PUSH_CATEGORIES = new Set<PlannerPlaceCategory>(['activity', 'sights']);

const DEFAULT_ACTIVE: Record<PlannerPlaceCategory, boolean> = {
  hotel: true,
  restaurant: true,
  cafe: true,
  museum: true,
  activity: true,
  sights: false,
  nightlife: false,
  parks: false,
  shopping: false,
  culture: false,
};

export interface PlaceBlock {
  id: string;
  category: PlannerPlaceCategory;
  city: string;
  segmentId: string;
  places: PlannerPlaceCandidate[];
}

/**
 * Owns all places-related state for the trip planner map:
 * - Active category filters
 * - Fetched places indexed by segment + category (survives segment changes)
 * - Chat place blocks for discovery cards
 *
 * Key improvement: places are indexed by `segmentId::category` so switching
 * back to a previously visited segment shows results instantly (0 re-fetches).
 */
export function usePlacesOrchestrator(
  plannerState: TripPlannerState | null,
  activeSegmentId: string | null,
) {
  const [activeCategories, setActiveCategories] = useState(DEFAULT_ACTIVE);
  const [placesBySegment, setPlacesBySegment] = useState<
    Record<string, Record<string, PlannerPlaceCandidate[]>>
  >({});
  const [fetchedKeys, setFetchedKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [chatPlaceBlocks, setChatPlaceBlocks] = useState<PlaceBlock[]>([]);

  const fetchAndMerge = useCallback((
    segmentId: string,
    city: string,
    location: { lat: number; lng: number },
    category: PlannerPlaceCategory,
    pushToChat = false,
  ) => {
    const key = `${segmentId}::${category}`;
    setFetchedKeys(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    return fetchNearbyPlacesByCategory(city, location, category)
      .then(places => {
        setPlacesBySegment(prev => {
          const segData = prev[segmentId] || {};
          const existing = segData[category] || [];
          const merged = [
            ...existing,
            ...places.filter(p => !existing.some(e => e.placeId === p.placeId)),
          ];
          return { ...prev, [segmentId]: { ...segData, [category]: merged } };
        });

        if (pushToChat && CHAT_PUSH_CATEGORIES.has(category) && places.length > 0) {
          const blockId = `${segmentId}::${category}`;
          setChatPlaceBlocks(prev => {
            if (prev.some(b => b.id === blockId)) return prev;
            return [...prev, {
              id: blockId,
              category,
              city,
              segmentId,
              places: places
                .filter(p => (p.photoUrls?.length ?? 0) > 0 || p.rating != null)
                .sort((a, b) =>
                  (b.rating || 0) * (b.userRatingsTotal || 0) -
                  (a.rating || 0) * (a.userRatingsTotal || 0),
                )
                .slice(0, 6),
            }];
          });
        }

        return places;
      })
      .catch(() => [] as PlannerPlaceCandidate[]);
  }, []);

  // Eager fetch — only fetches missing categories for active segment.
  // Does NOT reset data from other segments.
  useEffect(() => {
    if (!plannerState || !activeSegmentId) return;
    const seg = plannerState.segments.find(s => s.id === activeSegmentId);
    if (!seg?.location) return;

    const loc = { lat: seg.location.lat, lng: seg.location.lng };
    const missing = EAGER_FETCH_CATEGORIES.filter(
      cat => !fetchedKeys.has(`${activeSegmentId}::${cat}`),
    );

    if (missing.length === 0) return;

    setIsLoading(true);
    Promise.all(missing.map(cat => fetchAndMerge(activeSegmentId, seg.city, loc, cat)))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSegmentId, plannerState]);

  const toggleCategory = useCallback((category: PlannerPlaceCategory) => {
    setActiveCategories(current => ({ ...current, [category]: !current[category] }));

    // Fetch on activate — kept outside the state updater to avoid async side effects in setters
    if (category !== 'hotel' && activeSegmentId) {
      const seg = plannerState?.segments.find(s => s.id === activeSegmentId);
      const loc = seg?.location;
      if (seg && loc && !fetchedKeys.has(`${activeSegmentId}::${category}`)) {
        fetchAndMerge(activeSegmentId, seg.city, { lat: loc.lat, lng: loc.lng }, category, true);
      }
    }
  }, [plannerState, activeSegmentId, fetchedKeys, fetchAndMerge]);

  // Flat by-category view for the active segment (same shape the map expects)
  const placesForActiveSegment = useMemo((): Record<string, PlannerPlaceCandidate[]> => {
    if (!activeSegmentId) return {};
    return placesBySegment[activeSegmentId] || {};
  }, [activeSegmentId, placesBySegment]);

  // Discovery places flat by segment (for discovery cards)
  const discoveryPlacesBySegment = useMemo((): Record<string, PlannerPlaceCandidate[]> => {
    const result: Record<string, PlannerPlaceCandidate[]> = {};
    for (const [segId, cats] of Object.entries(placesBySegment)) {
      result[segId] = Object.values(cats).flat();
    }
    return result;
  }, [placesBySegment]);

  const ensureCategoryActive = useCallback((category: PlannerPlaceCategory) => {
    setActiveCategories(prev => {
      if (prev[category]) return prev;
      return { ...prev, [category]: true };
    });
  }, []);

  const resetForConversation = useCallback(() => {
    setActiveCategories(DEFAULT_ACTIVE);
    setPlacesBySegment({});
    setFetchedKeys(new Set());
    setIsLoading(false);
    setChatPlaceBlocks([]);
  }, []);

  return {
    activeCategories,
    placesForActiveSegment,
    allPlacesBySegment: placesBySegment,
    isLoading,
    chatPlaceBlocks,
    discoveryPlacesBySegment,
    toggleCategory,
    ensureCategoryActive,
    resetForConversation,
  };
}
