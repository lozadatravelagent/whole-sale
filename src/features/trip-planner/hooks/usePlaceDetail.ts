import { useCallback, useEffect, useState } from 'react';
import { fetchPlaceDetails } from '../services/placesService';
import type {
  PlannerPlaceCandidate,
  PlannerPlaceHotelCandidate,
  TripPlannerState,
} from '../types';
import type { PlaceDetailData } from '../components/PlannerPlaceDetailPanel';

/** Centralises place detail selection, fetching and state. */
export function usePlaceDetail({ plannerState }: { plannerState: TripPlannerState | null }) {
  const [placeDetailState, setPlaceDetailState] = useState<PlaceDetailData | null>(null);
  const [placeDetailSegmentId, setPlaceDetailSegmentId] = useState<string | null>(null);

  // Fetch details when a place is selected (loading === true)
  useEffect(() => {
    if (!placeDetailState?.loading || !placeDetailState.place || !placeDetailSegmentId) return;

    const place = placeDetailState.place;
    const segment = plannerState?.segments.find(s => s.id === placeDetailSegmentId);
    if (!segment?.location) return;

    let cancelled = false;

    fetchPlaceDetails({
      placeId: place.placeId,
      title: place.name,
      city: segment.city,
      locationBias: {
        lat: place.lat ?? segment.location.lat,
        lng: place.lng ?? segment.location.lng,
      },
    }).then((details) => {
      if (cancelled) return;
      setPlaceDetailState(prev =>
        prev ? { ...prev, details: details ?? null, loading: false } : null,
      );
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on placeId, not the full place object
  }, [placeDetailState?.loading, placeDetailState?.place?.placeId, placeDetailSegmentId, plannerState]);

  /**
   * Open place detail panel.
   * Returns `false` for inventory hotels — the caller should route to
   * the hotel detail flow instead.
   *
   * Pass `fetchDetails: false` to show the place without triggering a
   * details fetch (e.g. activities without a real placeId).
   */
  const openPlaceDetail = useCallback((payload: {
    segmentId: string;
    place: PlannerPlaceCandidate;
    fetchDetails?: boolean;
  }): boolean => {
    if (payload.place.source === 'inventory' && payload.place.category === 'hotel') {
      const hotelPlace = payload.place as PlannerPlaceHotelCandidate;
      if (hotelPlace.hotelId) return false;
    }

    const shouldFetch = payload.fetchDetails ?? true;
    setPlaceDetailState({ place: payload.place, details: null, loading: shouldFetch });
    setPlaceDetailSegmentId(payload.segmentId);
    return true;
  }, []);

  const closePlaceDetail = useCallback(() => {
    setPlaceDetailState(null);
    setPlaceDetailSegmentId(null);
  }, []);

  return {
    placeDetail: placeDetailState,
    placeDetailSegmentId,
    openPlaceDetail,
    closePlaceDetail,
    isLoading: placeDetailState?.loading ?? false,
    highlightedPlaceId: placeDetailState?.place?.placeId ?? null,
  };
}
