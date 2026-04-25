import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import MapGL, { Layer, Marker, NavigationControl, Popup, Source, useMap } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AlertCircle, Calendar, Clock, ExternalLink, Lightbulb, Loader2, MapPin, MapPinned, Star } from 'lucide-react';
import { HAS_MAP, MAPBOX_TOKEN } from '../map';
import type {
  PlannerActivity,
  PlannerActivityType,
  PlannerPlaceCandidate,
  PlannerPlaceCategory,
  PlannerPlaceHotelCandidate,
  PlannerSegment,
} from '../types';
import { formatDateRange, formatDestinationLabel, isEurovipsInventoryHotel } from '../utils';
import { resolveActivityLocation } from '../services/plannerGeocoding';
import { fetchInventoryHotelPlaces, fetchPlaceDetails, type PlaceDetails } from '../services/placesService';
import { getPlannerPlaceCategoryLabel, getPlannerPlaceEmoji, pickCanonicalPlannerPlaceCategory } from '../services/plannerPlaceMapper';
import { getHotelsFromStorage } from '@/features/chat/services/hotelStorageService';
import type { LocalHotelData } from '@/types/external';

const DISCOVERY_CATEGORIES: PlannerPlaceCategory[] = ['hotel', 'restaurant', 'cafe', 'museum', 'activity', 'sights', 'nightlife', 'parks', 'shopping', 'culture'];
const MAP_INVENTORY_HOTELS_LIMIT = 12;
const MAPBOX_MAP_ID = 'planner-map';

const CATEGORY_STYLES: Record<PlannerPlaceCategory, { bg: string; border: string; label: string }> = {
  hotel: { bg: '#0f172a', border: '#0f172a', label: 'Hoteles' },
  restaurant: { bg: '#b45309', border: '#92400e', label: 'Restaurantes' },
  cafe: { bg: '#6b4f3a', border: '#513826', label: 'Cafes' },
  museum: { bg: '#1d4ed8', border: '#1e40af', label: 'Museos' },
  activity: { bg: '#0f766e', border: '#115e59', label: 'Que hacer' },
  sights: { bg: '#d97706', border: '#b45309', label: 'Puntos de interés' },
  nightlife: { bg: '#7c3aed', border: '#6d28d9', label: 'Bares y noche' },
  parks: { bg: '#059669', border: '#047857', label: 'Parques' },
  shopping: { bg: '#db2777', border: '#be185d', label: 'Compras' },
  culture: { bg: '#4f46e5', border: '#4338ca', label: 'Cultura' },
};

const ACTIVITY_EMOJI: Record<PlannerActivityType | 'unknown', string> = {
  museum: '🏛️',
  culture: '🎭',
  landmark: '🏰',
  viewpoint: '👀',
  nature: '🌿',
  walk: '🚶',
  food: '🍽️',
  market: '🛒',
  nightlife: '🌙',
  experience: '✨',
  shopping: '🛍️',
  wellness: '💆',
  family: '👨‍👩‍👧',
  transport: '🚌',
  hotel: '🏨',
  unknown: '📍',
};

type SegmentWithLocation = PlannerSegment & { location: NonNullable<PlannerSegment['location']> };
type ActivityMarkerEntry = {
  activityId: string;
  segmentId: string;
  title: string;
  time?: string;
  category?: string;
  placeCategory: PlannerPlaceCategory;
  activityType: PlannerActivityType | 'unknown';
  lat: number;
  lng: number;
  description?: string;
  tip?: string;
  neighborhood?: string;
  durationMinutes?: number;
  city?: string;
  country?: string;
  placeId?: string;
  formattedAddress?: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrls: string[];
  source?: PlannerActivity['source'];
};

interface TripPlannerMapProps {
  segments: PlannerSegment[];
  days: number;
  selectedSegmentId?: string | null;
  activeCategories: Record<PlannerPlaceCategory, boolean>;
  placesByCategory?: Record<string, PlannerPlaceCandidate[]>;
  placesLoading?: boolean;
  isResolvingLocations?: boolean;
  locationWarning?: string | null;
  draftPhrase?: string | null;
  onSelectSegment?: (segmentId: string) => void;
  onViewportSelectSegment?: (segmentId: string) => void;
  onAddHotelToSegment?: (segmentId: string, placeCandidate: PlannerPlaceHotelCandidate) => void;
  onRequestAddPlaceToPlanner?: (payload: {
    segmentId: string;
    place: PlannerPlaceCandidate;
  }) => void;
  onOpenPlaceDetail?: (payload: { segmentId: string; place: PlannerPlaceCandidate }) => void;
  highlightedPlaceId?: string | null;
  onInventoryHotelPlacesReady?: (segmentId: string, places: PlannerPlaceHotelCandidate[]) => void;
  onViewportChanged?: (payload: {
    center: { lat: number; lng: number };
    zoom: number;
    bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } };
  }) => void;
}

// ── Helper functions ────────────────────────────────────────────────────────

function truncateDiscoveryMarkerLabel(labelText: string, maxLength = 20): string {
  const normalized = labelText.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function getDiscoveryMarkerLabel(place: PlannerPlaceCandidate): string {
  return truncateDiscoveryMarkerLabel(place.name || CATEGORY_STYLES[place.category].label);
}

function collectSegmentActivities(segment: PlannerSegment): Array<PlannerActivity & { slot: string }> {
  const result: Array<PlannerActivity & { slot: string }> = [];
  for (const day of segment.days) {
    for (const activity of day.morning) result.push({ ...activity, slot: 'morning' });
    for (const activity of day.afternoon) result.push({ ...activity, slot: 'afternoon' });
    for (const activity of day.evening) result.push({ ...activity, slot: 'evening' });
  }
  return result;
}

function mapActivityMarkerToPlaceCandidate(marker: ActivityMarkerEntry): PlannerPlaceCandidate {
  return {
    placeId: marker.placeId || `activity-${marker.activityId}`,
    name: marker.title,
    formattedAddress: marker.formattedAddress || marker.neighborhood,
    rating: marker.rating,
    userRatingsTotal: marker.userRatingsTotal,
    photoUrls: marker.photoUrls,
    category: marker.placeCategory,
    activityType: marker.activityType === 'unknown' ? undefined : marker.activityType,
    source: marker.source === 'foursquare'
      ? 'foursquare'
      : marker.source === 'google_maps'
        ? 'google_maps'
        : undefined,
  };
}

function getPlannerPlaceCategoryForActivity(activity: Pick<PlannerActivity, 'activityType' | 'category' | 'title'>): PlannerPlaceCategory {
  const normalizedText = `${activity.title} ${activity.category || ''}`.toLowerCase();

  if (activity.activityType === 'hotel') return 'hotel';
  if (activity.activityType === 'museum' || activity.activityType === 'culture') return 'museum';

  if (activity.activityType === 'food') {
    return /(cafe|cafeteria|coffee|brunch|desayuno)/.test(normalizedText) ? 'cafe' : 'restaurant';
  }

  if (/(museo|museum|gallery|galeria)/.test(normalizedText)) return 'museum';
  if (/(cafe|cafeteria|coffee|brunch|desayuno)/.test(normalizedText)) return 'cafe';
  if (/(restaurant|restaurante|dinner|lunch|almuerzo|cena|bar|bistro|tapas)/.test(normalizedText)) return 'restaurant';
  if (/(hotel|resort|suite)/.test(normalizedText)) return 'hotel';

  return 'activity';
}

function dedupeVisiblePlaces(places: PlannerPlaceCandidate[]): PlannerPlaceCandidate[] {
  const merged = new Map<string, PlannerPlaceCandidate>();

  places.forEach((place) => {
    const existing = merged.get(place.placeId);
    if (!existing) {
      merged.set(place.placeId, place);
      return;
    }

    const category = pickCanonicalPlannerPlaceCategory([existing.category, place.category]);
    const preferred = category === existing.category ? existing : place;
    const fallback = preferred === existing ? place : existing;

    merged.set(place.placeId, {
      ...fallback,
      ...preferred,
      category,
      activityType: preferred.activityType || fallback.activityType,
      photoUrls: preferred.photoUrls?.length ? preferred.photoUrls : fallback.photoUrls,
    });
  });

  return Array.from(merged.values()).sort((left, right) => {
    const leftScore = (left.rating || 0) * Math.max(1, left.userRatingsTotal || 1);
    const rightScore = (right.rating || 0) * Math.max(1, right.userRatingsTotal || 1);
    return rightScore - leftScore;
  });
}

// ── Route GeoJSON ───────────────────────────────────────────────────────────

function buildRouteGeoJSON(segments: SegmentWithLocation[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: segments.length >= 2
      ? [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: segments.map((s) => [s.location.lng, s.location.lat]),
          },
        }]
      : [],
  };
}

// ── Viewport manager (as useEffect in scene) ───────────────────────────────

function usePlannerViewport(
  segments: SegmentWithLocation[],
  selectedSegment: SegmentWithLocation | undefined,
) {
  const maps = useMap();
  const map = maps[MAPBOX_MAP_ID];
  const fitSignature = useMemo(
    () => [
      segments.map((s) => `${s.id}:${s.location.lng}:${s.location.lat}`).join('|'),
      selectedSegment?.id || '',
    ].join('|'),
    [segments, selectedSegment],
  );

  useEffect(() => {
    if (!map || segments.length === 0) return;

    if (selectedSegment) {
      map.flyTo({ center: [selectedSegment.location.lng, selectedSegment.location.lat], zoom: 12, duration: 800 });
      return;
    }

    if (segments.length === 1) {
      map.flyTo({ center: [segments[0].location.lng, segments[0].location.lat], zoom: 12, duration: 800 });
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    segments.forEach((s) => bounds.extend([s.location.lng, s.location.lat]));
    map.fitBounds(bounds, { padding: 56, duration: 800 });
  }, [fitSignature, map, segments, selectedSegment]);
}

// ── Scene component ─────────────────────────────────────────────────────────

function PlannerMapScene({
  segments,
  selectedSegmentId,
  activeCategories,
  placesByCategory,
  placesLoading: placesLoadingProp,
  onSelectSegment,
  onViewportSelectSegment,
  onAddHotelToSegment,
  onRequestAddPlaceToPlanner,
  onOpenPlaceDetail,
  highlightedPlaceId,
  onInventoryHotelPlacesReady,
  onViewportChanged,
}: {
  segments: SegmentWithLocation[];
  selectedSegmentId: string | null;
  activeCategories: Record<PlannerPlaceCategory, boolean>;
  placesByCategory?: Record<string, PlannerPlaceCandidate[]>;
  placesLoading?: boolean;
  onSelectSegment: (segmentId: string) => void;
  onViewportSelectSegment?: (segmentId: string) => void;
  onAddHotelToSegment?: (segmentId: string, placeCandidate: PlannerPlaceHotelCandidate) => void;
  onRequestAddPlaceToPlanner?: (payload: { segmentId: string; place: PlannerPlaceCandidate }) => void;
  onOpenPlaceDetail?: (payload: { segmentId: string; place: PlannerPlaceCandidate }) => void;
  highlightedPlaceId?: string | null;
  onInventoryHotelPlacesReady?: (segmentId: string, places: PlannerPlaceHotelCandidate[]) => void;
  onViewportChanged?: (payload: {
    center: { lat: number; lng: number };
    zoom: number;
    bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } };
  }) => void;
}) {
  const maps = useMap();
  const map = maps[MAPBOX_MAP_ID];

  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) || segments[0];

  const initialCenter = useMemo(
    () => (selectedSegment
      ? { longitude: selectedSegment.location.lng, latitude: selectedSegment.location.lat }
      : { longitude: 9, latitude: 42 }),
    [selectedSegment],
  );
  const initialZoom = selectedSegment ? 12 : 3;

  const [activityMarkers, setActivityMarkers] = useState<ActivityMarkerEntry[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityMarkerEntry | null>(null);
  const [cityPlaceDetails, setCityPlaceDetails] = useState<PlaceDetails | null>(null);
  const [cityPlaceLoading, setCityPlaceLoading] = useState(false);
  const [inventoryHotelPlaces, setInventoryHotelPlaces] = useState<PlannerPlaceHotelCandidate[]>([]);
  const [inventoryHotelsLoading, setInventoryHotelsLoading] = useState(false);
  const [showCityPanel, setShowCityPanel] = useState(false);
  const [isServiceReady, setIsServiceReady] = useState(false);

  const placesLoading = placesLoadingProp || false;

  const geocodeGenRef = useRef(0);
  const animatedMarkerIdsRef = useRef<Set<string>>(new Set());
  const animatedCityIdsRef = useRef<Set<string>>(new Set());
  const selectedSegmentRef = useRef(selectedSegment);
  const onInventoryHotelPlacesReadyRef = useRef(onInventoryHotelPlacesReady);
  const moveEndTimerRef = useRef<ReturnType<typeof setTimeout>>();
  selectedSegmentRef.current = selectedSegment;
  onInventoryHotelPlacesReadyRef.current = onInventoryHotelPlacesReady;

  useEffect(() => {
    if (!map || typeof window === 'undefined') {
      return;
    }

    const container = map.getContainer();
    const observedNode = container.parentElement || container;
    let frameId = 0;
    let settleFrameId = 0;
    let timeoutId = 0;

    const syncMapSize = () => {
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(settleFrameId);
      window.clearTimeout(timeoutId);

      map.resize();

      frameId = window.requestAnimationFrame(() => {
        map.resize();

        settleFrameId = window.requestAnimationFrame(() => {
          map.resize();
        });
      });

      timeoutId = window.setTimeout(() => {
        map.resize();
      }, 220);
    };

    syncMapSize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        syncMapSize();
      });

      observer.observe(observedNode);

      return () => {
        observer.disconnect();
        window.cancelAnimationFrame(frameId);
        window.cancelAnimationFrame(settleFrameId);
        window.clearTimeout(timeoutId);
      };
    }

    window.addEventListener('resize', syncMapSize);

    return () => {
      window.removeEventListener('resize', syncMapSize);
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(settleFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [map]);

  // Viewport management
  usePlannerViewport(segments, selectedSegment);

  // Mark service as ready once map is loaded (no PlacesService needed with Foursquare)
  useEffect(() => {
    if (map) setIsServiceReady(true);
  }, [map]);

  // Viewport idle handler (moveend) — auto-select nearest segment
  const handleMoveEnd = useCallback(() => {
    clearTimeout(moveEndTimerRef.current);
    moveEndTimerRef.current = setTimeout(() => {
      if (!map) return;
      const center = map.getCenter();
      const lat = center.lat;
      const lng = center.lng;

      const nearestSegment = segments.reduce<SegmentWithLocation | null>((closest, segment) => {
        const distance =
          Math.pow(segment.location.lat - lat, 2) +
          Math.pow(segment.location.lng - lng, 2);
        if (!closest) return segment;
        const closestDistance =
          Math.pow(closest.location.lat - lat, 2) +
          Math.pow(closest.location.lng - lng, 2);
        return distance < closestDistance ? segment : closest;
      }, null);

      if (nearestSegment && nearestSegment.id !== selectedSegmentId) {
        onViewportSelectSegment?.(nearestSegment.id);
      }

      // Emit viewport info for dynamic loading
      const zoom = map.getZoom();
      const mapBounds = map.getBounds();
      onViewportChanged?.({
        center: { lat, lng },
        zoom,
        bounds: {
          sw: { lat: mapBounds.getSouthWest().lat, lng: mapBounds.getSouthWest().lng },
          ne: { lat: mapBounds.getNorthEast().lat, lng: mapBounds.getNorthEast().lng },
        },
      });
    }, 800);
  }, [map, onViewportSelectSegment, onViewportChanged, segments, selectedSegmentId]);

  // Fetch city details for city panel
  useEffect(() => {
    if (!showCityPanel || !selectedSegment) {
      setCityPlaceDetails(null);
      setCityPlaceLoading(false);
      return;
    }

    let cancelled = false;
    setCityPlaceDetails(null);
    setCityPlaceLoading(true);

    const seg = selectedSegmentRef.current;
    if (!seg) return;

    fetchPlaceDetails({
      title: seg.city,
      city: seg.country || seg.city,
      locationBias: {
        lat: seg.location.lat,
        lng: seg.location.lng,
      },
    }).then((details) => {
      if (cancelled) return;
      setCityPlaceDetails(details);
      setCityPlaceLoading(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSegment?.id, showCityPanel]);

  // Fetch inventory hotel places
  useEffect(() => {
    const seg = selectedSegmentRef.current;
    if (!seg || !isServiceReady) {
      setInventoryHotelPlaces([]);
      setInventoryHotelsLoading(false);
      return;
    }

    let cancelled = false;
    setInventoryHotelsLoading(true);

    void (async () => {
      try {
        const fallbackHotels = seg.hotelPlan.hotelRecommendations.filter(isEurovipsInventoryHotel);
        let inventoryHotels: LocalHotelData[] = fallbackHotels;
        const linkedSearchId = seg.hotelPlan.linkedSearchId;

        if (linkedSearchId) {
          const storedHotels = await getHotelsFromStorage(linkedSearchId).catch(() => null);
          if (cancelled) return;
          const storedEurovipsHotels = (storedHotels || []).filter(isEurovipsInventoryHotel);
          if (storedEurovipsHotels.length > inventoryHotels.length) {
            inventoryHotels = storedEurovipsHotels;
          }
        }

        if (inventoryHotels.length === 0) {
          if (cancelled) return;
          setInventoryHotelPlaces([]);
          setInventoryHotelsLoading(false);
          return;
        }

        const results = await fetchInventoryHotelPlaces(
          seg.city,
          inventoryHotels,
          { lat: seg.location.lat, lng: seg.location.lng },
          MAP_INVENTORY_HOTELS_LIMIT,
        );

        if (cancelled) return;
        setInventoryHotelPlaces(results);
        setInventoryHotelsLoading(false);
        onInventoryHotelPlacesReadyRef.current?.(seg.id, results);
      } catch {
        if (cancelled) return;
        setInventoryHotelPlaces([]);
        setInventoryHotelsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isServiceReady, selectedSegment?.id]);

  // Geocode activity markers
  useEffect(() => {
    if (segments.length === 0) {
      setActivityMarkers([]);
      animatedMarkerIdsRef.current.clear();
      animatedCityIdsRef.current.clear();
      return;
    }

    const gen = ++geocodeGenRef.current;
    setActivityMarkers([]);
    animatedMarkerIdsRef.current.clear();
    animatedCityIdsRef.current.clear();
    setSelectedActivity(null);

    const allActivities: Array<PlannerActivity & { slot: string; city: string; country?: string; segmentId: string }> = [];
    for (const segment of segments) {
      for (const activity of collectSegmentActivities(segment)) {
        allActivities.push({ ...activity, city: segment.city, country: segment.country, segmentId: segment.id });
      }
    }

    if (allActivities.length === 0) return;

    void (async () => {
      for (const activity of allActivities) {
        if (geocodeGenRef.current !== gen) return;
        const coords = await resolveActivityLocation({
          title: activity.title,
          neighborhood: activity.neighborhood,
          formattedAddress: activity.formattedAddress,
          placeId: activity.placeId,
          city: activity.city,
          country: activity.country,
        });
        if (geocodeGenRef.current !== gen || !coords) continue;

        setActivityMarkers((prev) => {
          if (prev.some((m) => m.activityId === activity.id)) return prev;
          return [...prev, {
            activityId: activity.id,
            segmentId: activity.segmentId,
            title: activity.title,
            time: activity.time,
            category: activity.category,
            placeCategory: getPlannerPlaceCategoryForActivity(activity),
            activityType: activity.activityType || 'unknown',
            lat: coords.lat,
            lng: coords.lng,
            description: activity.description,
            tip: activity.tip,
            neighborhood: activity.neighborhood,
            durationMinutes: activity.durationMinutes,
            city: activity.city,
            country: activity.country,
            placeId: activity.placeId,
            formattedAddress: activity.formattedAddress,
            rating: activity.rating,
            userRatingsTotal: activity.userRatingsTotal,
            photoUrls: activity.photoUrls || [],
            source: activity.source,
          }];
        });
      }
    })();

    const nextGeneration = gen + 1;
    return () => {
      geocodeGenRef.current = nextGeneration;
    };
  }, [segments]);

  // Visibility
  const visiblePlaces = useMemo(
    () => dedupeVisiblePlaces(
      DISCOVERY_CATEGORIES
        .filter((cat) => activeCategories[cat])
        .flatMap((cat) => {
          if (cat === 'hotel') return inventoryHotelPlaces;
          return placesByCategory?.[cat] || [];
        }),
    ),
    [activeCategories, inventoryHotelPlaces, placesByCategory],
  );

  const visibleActivityMarkers = useMemo(
    () => activityMarkers.filter((m) => activeCategories[m.placeCategory]),
    [activeCategories, activityMarkers],
  );

  const hotelInventorySearchLoading = selectedSegment?.hotelPlan.searchStatus === 'loading';
  const discoveryLoading = placesLoading || inventoryHotelsLoading || hotelInventorySearchLoading;

  // Note: highlighted place deselection on category hide is now handled by the parent hook

  useEffect(() => {
    if (selectedActivity && !activeCategories[selectedActivity.placeCategory]) setSelectedActivity(null);
  }, [activeCategories, selectedActivity]);

  // Click handlers
  const handleActivityClick = useCallback((marker: ActivityMarkerEntry) => {
    setShowCityPanel(false);
    if (onOpenPlaceDetail) {
      setSelectedActivity(null);
      onOpenPlaceDetail({
        segmentId: marker.segmentId,
        place: mapActivityMarkerToPlaceCandidate(marker),
      });
      return;
    }
    setSelectedActivity((prev) => (prev?.activityId === marker.activityId ? null : marker));
  }, [onOpenPlaceDetail]);

  const handleCityMarkerClick = useCallback((segmentId: string) => {
    setSelectedActivity(null);
    onSelectSegment(segmentId);
    setShowCityPanel(true);
  }, [onSelectSegment]);

  const handleDiscoveryPlaceClick = useCallback((place: PlannerPlaceCandidate) => {
    setSelectedActivity(null);
    setShowCityPanel(false);
    if (onOpenPlaceDetail && selectedSegment) {
      onOpenPlaceDetail({ segmentId: selectedSegment.id, place });
    }
  }, [onOpenPlaceDetail, selectedSegment]);


  const routeGeoJSON = useMemo(() => buildRouteGeoJSON(segments), [segments]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {discoveryLoading && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
          <div className="planner-map-loading-rail">
            <div className="planner-map-loading-rail__beam" />
          </div>
        </div>
      )}
      <MapGL
        id={MAPBOX_MAP_ID}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: initialCenter.longitude,
          latitude: initialCenter.latitude,
          zoom: initialZoom,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        dragRotate={false}
        touchZoomRotate={false}
        onMoveEnd={handleMoveEnd}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* Route polyline */}
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer
            id="route-line"
            type="line"
            paint={{
              'line-color': '#2563eb',
              'line-width': 4,
              'line-opacity': 0.92,
              'line-dasharray': [2, 1.5],
            }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </Source>

        {/* City markers */}
        {segments.map((segment, index) => {
          const isNew = !animatedCityIdsRef.current.has(segment.id);
          if (isNew) animatedCityIdsRef.current.add(segment.id);
          const isSelected = segment.id === selectedSegment?.id;

          return (
            <Marker
              key={segment.id}
              longitude={segment.location.lng}
              latitude={segment.location.lat}
              anchor="center"
              onClick={(e) => { e.originalEvent.stopPropagation(); handleCityMarkerClick(segment.id); }}
              style={{ zIndex: isSelected ? 1000 : index + 1 }}
            >
              <div
                className={`flex items-center justify-center rounded-full w-9 h-9 text-sm font-bold cursor-pointer select-none shadow-lg transition-transform ${isNew ? 'marker-drop' : ''} ${isSelected ? 'bg-slate-900 text-white scale-110 ring-2 ring-white' : 'bg-white text-slate-900 border-2 border-slate-900 hover:scale-105'}`}
              >
                {index + 1}
              </div>
            </Marker>
          );
        })}

        {/* Discovery place markers */}
        {visiblePlaces
          .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng))
          .map((place) => {
            const labelText = getDiscoveryMarkerLabel(place);
            const isSelectedPlace = highlightedPlaceId === place.placeId;
            const style = CATEGORY_STYLES[place.category];

            return (
              <Marker
                key={`${place.category}-${place.placeId}`}
                longitude={place.lng!}
                latitude={place.lat!}
                anchor="center"
                onClick={(e) => { e.originalEvent.stopPropagation(); handleDiscoveryPlaceClick(place); }}
                style={{ zIndex: isSelectedPlace ? 920 : place.category === 'hotel' ? 760 : 640 }}
              >
                <div
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold shadow-md cursor-pointer select-none transition-transform hover:scale-105 ${isSelectedPlace ? 'ring-2 ring-slate-900' : ''}`}
                  style={{ background: 'white', border: `1.5px solid ${isSelectedPlace ? '#0f172a' : '#d4d4d8'}` }}
                >
                  <span>{getPlannerPlaceEmoji(place.category, place.activityType)}</span>
                  <span className="max-w-[120px] truncate" style={{ color: style.bg }}>{labelText}</span>
                </div>
              </Marker>
            );
          })}

        {/* Activity markers */}
        {visibleActivityMarkers.map((marker) => {
          const isNew = !animatedMarkerIdsRef.current.has(marker.activityId);
          if (isNew) animatedMarkerIdsRef.current.add(marker.activityId);

          return (
            <Marker
              key={marker.activityId}
              longitude={marker.lng}
              latitude={marker.lat}
              anchor="center"
              onClick={(e) => { e.originalEvent.stopPropagation(); handleActivityClick(marker); }}
              style={{ zIndex: 500 }}
            >
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-slate-400 shadow-md cursor-pointer select-none transition-transform hover:scale-110 ${isNew ? 'marker-drop' : ''}`}
              >
                <span className="text-base leading-none">{ACTIVITY_EMOJI[marker.activityType] || ACTIVITY_EMOJI.unknown}</span>
              </div>
            </Marker>
          );
        })}

        {/* Activity detail popup */}
        {selectedActivity && (
          <Popup
            longitude={selectedActivity.lng}
            latitude={selectedActivity.lat}
            anchor="bottom"
            offset={20}
            onClose={() => setSelectedActivity(null)}
            closeButton
            closeOnClick={false}
            maxWidth="300px"
          >
            <div className="w-[260px]">
              <div className="flex items-start gap-2.5">
                <span className="text-2xl leading-none">{ACTIVITY_EMOJI[selectedActivity.activityType] || ACTIVITY_EMOJI.unknown}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-tight text-slate-900">{selectedActivity.title}</h3>
                  {selectedActivity.category && (
                    <div className="mt-1">
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{selectedActivity.category}</span>
                    </div>
                  )}
                </div>
              </div>
              {selectedActivity.description && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{selectedActivity.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedActivity.time && (
                  <span className="flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                    <Clock className="h-2.5 w-2.5" /> {selectedActivity.time}
                  </span>
                )}
                {selectedActivity.durationMinutes && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    ~{selectedActivity.durationMinutes} min
                  </span>
                )}
                {selectedActivity.neighborhood && (
                  <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    <MapPin className="h-2.5 w-2.5" /> {selectedActivity.neighborhood}
                  </span>
                )}
              </div>
              {selectedActivity.tip && (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                  <div className="flex gap-1.5">
                    <Lightbulb className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-500" />
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-amber-800">{selectedActivity.tip}</p>
                  </div>
                </div>
              )}
              {selectedActivity.title && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedActivity.title + ' ' + (selectedActivity.city || ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ver en mapa
                </a>
              )}
            </div>
          </Popup>
        )}

        {/* City panel popup */}
        {!selectedActivity && showCityPanel && selectedSegment && (
          <Popup
            longitude={selectedSegment.location.lng}
            latitude={selectedSegment.location.lat}
            anchor="bottom"
            offset={20}
            onClose={() => setShowCityPanel(false)}
            closeButton
            closeOnClick={false}
            maxWidth="340px"
          >
            <div className="w-[300px]">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {segments.findIndex((s) => s.id === selectedSegment.id) + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{formatDestinationLabel(selectedSegment.city)}</h3>
                  {selectedSegment.country && <span className="text-[11px] text-slate-500">{selectedSegment.country}</span>}
                </div>
              </div>

              {cityPlaceDetails?.photoUrls?.[0] && (
                <img src={cityPlaceDetails.photoUrls[0]} alt="" className="mt-2 h-[100px] w-full rounded-lg object-cover" />
              )}

              <div className="mt-2 flex flex-wrap gap-1">
                <span className="flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                  <Calendar className="h-2.5 w-2.5" />
                  {formatDateRange(selectedSegment.startDate, selectedSegment.endDate)}
                </span>
                {selectedSegment.nights != null && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    {selectedSegment.nights} noche{selectedSegment.nights !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {selectedSegment.summary && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{selectedSegment.summary}</p>
              )}

              <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-2 text-[11px] text-blue-800">
                Hoteles cotizan inventario real. Restaurantes, cafes, museos y actividades se agregan al planner eligiendo dia y bloque.
              </div>

              <div className="mt-3 space-y-2">
                {DISCOVERY_CATEGORIES.filter((cat) => activeCategories[cat]).map((cat) => {
                  const catPlaces = cat === 'hotel'
                    ? inventoryHotelPlaces
                    : [...(placesByCategory?.[cat] || [])].sort((a, b) => {
                        const sa = (a.rating || 0) * Math.max(1, a.userRatingsTotal || 1);
                        const sb = (b.rating || 0) * Math.max(1, b.userRatingsTotal || 1);
                        return sb - sa;
                      });
                  const topPlaces = catPlaces.slice(0, 2);
                  if (topPlaces.length === 0) return null;
                  return (
                    <div key={cat}>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {CATEGORY_STYLES[cat].label}
                      </p>
                      <div className="space-y-1">
                        {topPlaces.map((place) => (
                          <button
                            key={place.placeId}
                            type="button"
                            className="block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left text-[11px] text-slate-700 transition hover:border-primary/50 hover:bg-primary/5"
                            onClick={() => handleDiscoveryPlaceClick(place)}
                          >
                            <span className="font-medium text-slate-900">{place.name}</span>
                            {place.rating ? ` • ${place.rating.toFixed(1)}` : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {placesLoading && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" /> Cargando más lugares...
                  </div>
                )}
              </div>

              {cityPlaceLoading && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando info...
                </div>
              )}
            </div>
          </Popup>
        )}
      </MapGL>
    </div>
  );
}

// ── Wrapper component (public) ──────────────────────────────────────────────

export default function TripPlannerMap({
  segments,
  days,
  selectedSegmentId: controlledSelectedSegmentId,
  activeCategories,
  placesByCategory,
  placesLoading,
  isResolvingLocations = false,
  locationWarning,
  draftPhrase,
  onSelectSegment,
  onViewportSelectSegment,
  onAddHotelToSegment,
  onRequestAddPlaceToPlanner,
  onOpenPlaceDetail,
  highlightedPlaceId,
  onInventoryHotelPlacesReady,
  onViewportChanged,
}: TripPlannerMapProps) {
  const [uncontrolledSelectedSegmentId, setUncontrolledSelectedSegmentId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const selectedSegmentId = controlledSelectedSegmentId ?? uncontrolledSelectedSegmentId;

  const mappedSegments = useMemo(
    () => segments.filter(
      (segment): segment is SegmentWithLocation =>
        Boolean(segment.location && Number.isFinite(segment.location.lat) && Number.isFinite(segment.location.lng)),
    ),
    [segments],
  );

  useEffect(() => {
    if (!selectedSegmentId && mappedSegments.length > 0) {
      setUncontrolledSelectedSegmentId(mappedSegments[0].id);
      return;
    }
    if (selectedSegmentId && !mappedSegments.some((s) => s.id === selectedSegmentId)) {
      setUncontrolledSelectedSegmentId(mappedSegments[0]?.id || null);
    }
  }, [mappedSegments, selectedSegmentId]);

  const unresolvedCount = segments.length - mappedSegments.length;
  const canRenderMap = HAS_MAP && !mapError;
  const footerMessage =
    mapError ||
    locationWarning ||
    (!isResolvingLocations && unresolvedCount > 0
      ? `No pudimos ubicar ${unresolvedCount} destino${unresolvedCount > 1 ? 's' : ''} en el mapa.`
      : null);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="h-full w-full min-h-[320px] sm:min-h-[380px]">
        {!HAS_MAP ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,#f8fafc,#e2e8f0)] px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPinned className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-slate-900">Configurá Mapbox para ver el recorrido interactivo.</p>
              <p className="text-sm text-slate-500">
                Agregá <code>VITE_MAPBOX_TOKEN</code> para habilitar el mapa real del viaje.
              </p>
            </div>
          </div>
        ) : canRenderMap ? (
          <div className="relative h-full w-full">
            <PlannerMapScene
              segments={mappedSegments}
              selectedSegmentId={selectedSegmentId}
              activeCategories={activeCategories}
              placesByCategory={placesByCategory}
              placesLoading={placesLoading}
              onSelectSegment={(segmentId) => {
                if (controlledSelectedSegmentId === undefined) {
                  setUncontrolledSelectedSegmentId(segmentId);
                }
                onSelectSegment?.(segmentId);
              }}
              onViewportSelectSegment={onViewportSelectSegment}
              onAddHotelToSegment={onAddHotelToSegment}
              onRequestAddPlaceToPlanner={onRequestAddPlaceToPlanner}
              onOpenPlaceDetail={onOpenPlaceDetail}
              highlightedPlaceId={highlightedPlaceId}
              onInventoryHotelPlacesReady={onInventoryHotelPlacesReady}
              onViewportChanged={onViewportChanged}
            />
            <div className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(226,232,240,0.72))] px-6 text-center transition-opacity duration-500 ${mappedSegments.length > 0 ? 'opacity-0' : 'opacity-100'}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MapPinned className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-slate-900">
                  {isResolvingLocations ? 'Ubicando destinos en el mapa...' : 'Esperando destinos del viaje'}
                </p>
                {draftPhrase ? (
                  <div className="h-[18px] overflow-hidden">
                    <p key={draftPhrase} className="planner-phrase-rotate text-sm font-medium text-primary">
                      {draftPhrase}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    {locationWarning || 'El mapa mostrará la ruta completa cuando se definan los destinos.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,#f8fafc,#e2e8f0)] px-6 text-center">
            <MapPinned className="h-6 w-6 text-slate-400" />
            <p className="text-sm text-slate-500">{mapError || 'Esperando destinos...'}</p>
          </div>
        )}
      </div>

      {footerMessage && (
        <div className="border-t bg-white/85 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <AlertCircle className="h-3.5 w-3.5" />
            {footerMessage}
          </div>
        </div>
      )}
    </div>
  );
}
