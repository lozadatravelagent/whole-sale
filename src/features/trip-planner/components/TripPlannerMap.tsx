import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Marker,
  RenderingType,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { AlertCircle, Calendar, Clock, Lightbulb, Loader2, MapPin, MapPinned, Route, Star } from 'lucide-react';
import { HAS_PLANNER_GOOGLE_MAPS, PLANNER_GOOGLE_MAPS_API_KEY, PLANNER_GOOGLE_MAPS_MAP_ID } from '../map';
import type {
  PlannerActivity,
  PlannerActivityType,
  PlannerPlaceCandidate,
  PlannerPlaceCategory,
  PlannerPlaceHotelCandidate,
  PlannerSegment,
} from '../types';
import { formatDateRange, formatDestinationLabel, formatPlannerPrice, formatPlannerRoomLabel, formatPlannerTravelerSummary, getPrimaryPlannerHotelRoom } from '../utils';
import { resolveActivityLocation } from '../services/plannerGeocoding';
import { fetchInventoryHotelPlaces, fetchNearbyPlacesBundle, fetchPlaceDetails, type PlaceDetails } from '../services/placesService';
import { getPlannerPlaceCategoryLabel, getPlannerPlaceEmoji, pickCanonicalPlannerPlaceCategory } from '../services/plannerPlaceMapper';
import { getHotelsFromStorage } from '@/features/chat/services/hotelStorageService';
import type { LocalHotelData } from '@/features/chat/types/chat';

const DISCOVERY_CATEGORIES: PlannerPlaceCategory[] = ['hotel', 'restaurant', 'cafe', 'museum', 'activity'];
const PLACES_FETCH_CATEGORIES: PlannerPlaceCategory[] = ['restaurant', 'cafe', 'museum', 'activity'];
const MAP_INVENTORY_HOTELS_LIMIT = 12;

const CATEGORY_STYLES: Record<PlannerPlaceCategory, { bg: string; border: string; label: string }> = {
  hotel: { bg: '#0f172a', border: '#0f172a', label: 'Hoteles' },
  restaurant: { bg: '#b45309', border: '#92400e', label: 'Restaurantes' },
  cafe: { bg: '#6b4f3a', border: '#513826', label: 'Cafes' },
  museum: { bg: '#1d4ed8', border: '#1e40af', label: 'Museos' },
  activity: { bg: '#0f766e', border: '#115e59', label: 'Que hacer' },
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

type PlacesByCategory = Record<PlannerPlaceCategory, PlannerPlaceCandidate[]>;
type SegmentWithLocation = PlannerSegment & { location: NonNullable<PlannerSegment['location']> };
type ActivityMarkerEntry = {
  activityId: string;
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
};

interface TripPlannerMapProps {
  segments: PlannerSegment[];
  days: number;
  activeCategories: Record<PlannerPlaceCategory, boolean>;
  isResolvingLocations?: boolean;
  locationWarning?: string | null;
  draftPhrase?: string | null;
  onSelectSegment?: (segmentId: string) => void;
  onAddHotelToSegment?: (segmentId: string, placeCandidate: PlannerPlaceHotelCandidate) => void;
  onRequestAddPlaceToPlanner?: (payload: {
    segmentId: string;
    place: PlannerPlaceCandidate;
  }) => void;
  onAutoFillRealPlaces?: (payload: {
    segmentId: string;
    placesByCategory: PlacesByCategory;
  }) => void;
}

function buildEmojiMarkerIcon(emoji: string, bg = 'white', border = '#0f172a'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
    <circle cx="18" cy="18" r="16" fill="${bg}" stroke="${border}" stroke-width="2"/>
    <text x="18" y="19" text-anchor="middle" dominant-baseline="central" font-size="16">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncateDiscoveryMarkerLabel(labelText: string, maxLength = 20): string {
  const normalized = labelText.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function getDiscoveryMarkerLabel(place: PlannerPlaceCandidate): string {
  return truncateDiscoveryMarkerLabel(place.name || CATEGORY_STYLES[place.category].label);
}

function getDiscoveryChipMarkerMetrics(labelText: string) {
  const width = Math.max(96, Math.min(182, 44 + labelText.length * 6.4));
  return {
    width,
    height: 32,
  };
}

function buildDiscoveryChipMarkerIcon(input: {
  category: PlannerPlaceCategory;
  labelText: string;
  isSelected?: boolean;
}): string {
  const { category, labelText, isSelected = false } = input;
  const { width, height } = getDiscoveryChipMarkerMetrics(labelText);
  const border = isSelected ? '#0f172a' : '#d4d4d8';
  const emoji = getPlannerPlaceEmoji(category);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <filter id="chip-shadow" x="-20%" y="-50%" width="140%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(15,23,42,0.18)"/>
      </filter>
    </defs>
    <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="16" fill="white" stroke="${border}" stroke-width="${isSelected ? 1.8 : 1.2}" filter="url(#chip-shadow)"/>
    <text x="17" y="16.5" text-anchor="middle" dominant-baseline="middle" font-size="12.5">${emoji}</text>
    <text x="31" y="16.5" text-anchor="start" dominant-baseline="middle" font-size="10.5" font-weight="700" fill="#111827" font-family="system-ui, sans-serif">
      ${escapeSvgText(labelText)}
    </text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildCityMarkerIcon(index: number, isSelected: boolean): string {
  const bg = isSelected ? '#0f172a' : 'white';
  const border = '#0f172a';
  const textColor = isSelected ? 'white' : '#0f172a';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
    <circle cx="18" cy="18" r="16" fill="${bg}" stroke="${border}" stroke-width="2"/>
    <text x="18" y="19" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="${textColor}" font-family="system-ui, sans-serif">${index + 1}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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

function getEmptyPlacesBundle(): PlacesByCategory {
  return { hotel: [], restaurant: [], cafe: [], museum: [], activity: [] };
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

function PlannerRouteOverlay({ segments }: { segments: SegmentWithLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined' || segments.length < 2) return;

    const routeLine = new google.maps.Polyline({
      path: segments.map((segment) => ({ lat: segment.location.lat, lng: segment.location.lng })),
      geodesic: true,
      strokeColor: '#2563eb',
      strokeOpacity: 0.92,
      strokeWeight: 4,
      icons: [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4 },
        offset: '0',
        repeat: '18px',
      }],
    });

    routeLine.setMap(map);
    return () => routeLine.setMap(null);
  }, [map, segments]);

  return null;
}

function PlannerViewportManager({
  segments,
  selectedSegment,
}: {
  segments: SegmentWithLocation[];
  selectedSegment?: SegmentWithLocation | null;
}) {
  const map = useMap();
  const fitSignature = useMemo(
    () => [
      segments.map((segment) => `${segment.id}:${segment.location.lng}:${segment.location.lat}`).join('|'),
      selectedSegment?.id || '',
      selectedSegment?.location?.lat || '',
      selectedSegment?.location?.lng || '',
    ].join('|'),
    [segments, selectedSegment]
  );

  const segmentsRef = useRef(segments);
  const selectedSegmentRef = useRef(selectedSegment);
  segmentsRef.current = segments;
  selectedSegmentRef.current = selectedSegment;

  useEffect(() => {
    const currentSegments = segmentsRef.current;
    const currentSelected = selectedSegmentRef.current;

    if (!map || typeof google === 'undefined' || currentSegments.length === 0) return;

    if (currentSelected) {
      map.setCenter({ lat: currentSelected.location.lat, lng: currentSelected.location.lng });
      map.setZoom(12);
      return;
    }

    if (currentSegments.length === 1) {
      map.setCenter({ lat: currentSegments[0].location.lat, lng: currentSegments[0].location.lng });
      map.setZoom(12);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    currentSegments.forEach((segment) => bounds.extend({ lat: segment.location.lat, lng: segment.location.lng }));
    map.fitBounds(bounds, 56);
  }, [fitSignature, map]);

  return null;
}

function PlannerGoogleMapScene({
  segments,
  selectedSegmentId,
  activeCategories,
  onSelectSegment,
  onAddHotelToSegment,
  onRequestAddPlaceToPlanner,
  onAutoFillRealPlaces,
}: {
  segments: SegmentWithLocation[];
  selectedSegmentId: string | null;
  activeCategories: Record<PlannerPlaceCategory, boolean>;
  onSelectSegment: (segmentId: string) => void;
  onAddHotelToSegment?: (segmentId: string, placeCandidate: PlannerPlaceHotelCandidate) => void;
  onRequestAddPlaceToPlanner?: (payload: { segmentId: string; place: PlannerPlaceCandidate }) => void;
  onAutoFillRealPlaces?: (payload: { segmentId: string; placesByCategory: PlacesByCategory }) => void;
}) {
  const coreLib = useMapsLibrary('core');
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId) || segments[0];
  const initialCenter = useMemo(
    () => (
      selectedSegment
        ? { lat: selectedSegment.location.lat, lng: selectedSegment.location.lng }
        : { lat: 42, lng: 9 }
    ),
    [selectedSegment]
  );
  const initialZoom = selectedSegment ? 12 : 3;
  const [activityMarkers, setActivityMarkers] = useState<ActivityMarkerEntry[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityMarkerEntry | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlannerPlaceCandidate | null>(null);
  const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [cityPlaceDetails, setCityPlaceDetails] = useState<PlaceDetails | null>(null);
  const [cityPlaceLoading, setCityPlaceLoading] = useState(false);
  const [placesByCategory, setPlacesByCategory] = useState<PlacesByCategory>(getEmptyPlacesBundle);
  const [inventoryHotelPlaces, setInventoryHotelPlaces] = useState<PlannerPlaceHotelCandidate[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [inventoryHotelsLoading, setInventoryHotelsLoading] = useState(false);
  const [fetchCenter, setFetchCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [showCityPanel, setShowCityPanel] = useState(false);
  const [isPlacesServiceReady, setIsPlacesServiceReady] = useState(false);
  const geocodeGenRef = useRef(0);
  const animatedMarkerIdsRef = useRef<Set<string>>(new Set());
  const animatedCityIdsRef = useRef<Set<string>>(new Set());
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (placesLib && map && !placesServiceRef.current) {
      placesServiceRef.current = new placesLib.PlacesService(map);
      setIsPlacesServiceReady(true);
    }
    if (!placesLib || !map) {
      setIsPlacesServiceReady(false);
    }
  }, [placesLib, map]);

  useEffect(() => {
    if (selectedSegment) {
      setFetchCenter({ lat: selectedSegment.location.lat, lng: selectedSegment.location.lng });
    } else {
      setFetchCenter(null);
    }
  }, [selectedSegmentId]);

  useEffect(() => {
    if (!map) return;

    let timer: ReturnType<typeof setTimeout>;
    const handleIdle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const center = map.getCenter();
        if (!center) return;
        const lat = center.lat();
        const lng = center.lng();
        setFetchCenter((prev) => {
          if (!prev) return { lat, lng };
          if (Math.abs(lat - prev.lat) < 0.027 && Math.abs(lng - prev.lng) < 0.027) return prev;
          return { lat, lng };
        });
      }, 800);
    };

    const listener = map.addListener('idle', handleIdle);
    return () => {
      clearTimeout(timer);
      google.maps.event.removeListener(listener);
    };
  }, [map]);

  useEffect(() => {
    if (!selectedPlace || !selectedSegment || selectedPlace.source === 'inventory') {
      setPlaceDetails(null);
      setPlaceLoading(false);
      return;
    }

    const service = placesServiceRef.current;
    if (!service) {
      setPlaceDetails(null);
      setPlaceLoading(false);
      return;
    }

    let cancelled = false;
    setPlaceDetails(null);
    setPlaceLoading(true);

    fetchPlaceDetails(service, selectedPlace.name, selectedSegment.city, {
      lat: selectedPlace.lat || selectedSegment.location.lat,
      lng: selectedPlace.lng || selectedSegment.location.lng,
    }).then((details) => {
      if (cancelled) return;
      setPlaceDetails(details);
      setPlaceLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedPlace, selectedSegment]);

  useEffect(() => {
    if (!showCityPanel || !selectedSegment) {
      setCityPlaceDetails(null);
      setCityPlaceLoading(false);
      return;
    }

    const service = placesServiceRef.current;
    if (!service) {
      setCityPlaceDetails(null);
      setCityPlaceLoading(false);
      return;
    }

    let cancelled = false;
    setCityPlaceDetails(null);
    setCityPlaceLoading(true);

    fetchPlaceDetails(service, selectedSegment.city, selectedSegment.country || selectedSegment.city, {
      lat: selectedSegment.location.lat,
      lng: selectedSegment.location.lng,
    }).then((details) => {
      if (cancelled) return;
      setCityPlaceDetails(details);
      setCityPlaceLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedSegment, showCityPanel]);

  useEffect(() => {
    if (!selectedSegment || !isPlacesServiceReady) {
      setInventoryHotelPlaces([]);
      setInventoryHotelsLoading(false);
      return;
    }

    const service = placesServiceRef.current;
    if (!service) {
      return;
    }

    let cancelled = false;
    setInventoryHotelsLoading(true);

    void (async () => {
      try {
        const fallbackHotels = selectedSegment.hotelPlan.hotelRecommendations.filter(
          (hotel) => hotel.provider === 'EUROVIPS'
        );

        let inventoryHotels: LocalHotelData[] = fallbackHotels;
        const linkedSearchId = selectedSegment.hotelPlan.linkedSearchId;

        if (linkedSearchId) {
          const storedHotels = await getHotelsFromStorage(linkedSearchId).catch(() => null);
          if (cancelled) return;

          const storedEurovipsHotels = (storedHotels || []).filter(
            (hotel): hotel is LocalHotelData => hotel.provider === 'EUROVIPS'
          );

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
          service,
          selectedSegment.city,
          inventoryHotels,
          {
            lat: selectedSegment.location.lat,
            lng: selectedSegment.location.lng,
          },
          MAP_INVENTORY_HOTELS_LIMIT,
        );

        if (cancelled) return;
        setInventoryHotelPlaces(results);
        setInventoryHotelsLoading(false);
      } catch {
        if (cancelled) return;
        setInventoryHotelPlaces([]);
        setInventoryHotelsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPlacesServiceReady, selectedSegment]);

  useEffect(() => {
    if (!selectedSegment || !fetchCenter || !isPlacesServiceReady) {
      setPlacesByCategory(getEmptyPlacesBundle());
      setSelectedPlace(null);
      setPlacesLoading(false);
      return;
    }

    const service = placesServiceRef.current;
    if (!service) {
      return;
    }

    let cancelled = false;
    setPlacesLoading(true);

    fetchNearbyPlacesBundle(service, selectedSegment.city, fetchCenter, PLACES_FETCH_CATEGORIES).then((bundle) => {
      if (cancelled) return;
      setPlacesByCategory(bundle);
      setPlacesLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setPlacesByCategory(getEmptyPlacesBundle());
      setPlacesLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [fetchCenter, isPlacesServiceReady, selectedSegment]);

  useEffect(() => {
    if (!selectedSegment || !onAutoFillRealPlaces || placesLoading) {
      return;
    }

    if (selectedSegment.contentStatus !== 'ready') {
      return;
    }

    if (selectedSegment.realPlacesStatus === 'ready' || selectedSegment.realPlacesStatus === 'loading') {
      return;
    }

    const hasPlaces = Object.values(placesByCategory).some((items) => items.length > 0);
    if (!hasPlaces) {
      return;
    }

    onAutoFillRealPlaces({
      segmentId: selectedSegment.id,
      placesByCategory,
    });
  }, [onAutoFillRealPlaces, placesByCategory, placesLoading, selectedSegment]);

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

    const allActivities: Array<PlannerActivity & { slot: string; city: string; country?: string }> = [];
    for (const segment of segments) {
      for (const activity of collectSegmentActivities(segment)) {
        allActivities.push({ ...activity, city: segment.city, country: segment.country });
      }
    }

    if (allActivities.length === 0) return;

    void (async () => {
      for (const activity of allActivities) {
        if (geocodeGenRef.current !== gen) return;

        const coords = await resolveActivityLocation({
          title: activity.title,
          neighborhood: activity.neighborhood,
          city: activity.city,
          country: activity.country,
        });

        if (geocodeGenRef.current !== gen || !coords) continue;

        setActivityMarkers((prev) => {
          if (prev.some((marker) => marker.activityId === activity.id)) return prev;
          return [
            ...prev,
            {
              activityId: activity.id,
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
            },
          ];
        });
      }
    })();

    return () => {
      geocodeGenRef.current++;
    };
  }, [segments]);

  const visiblePlaces = useMemo(
    () => dedupeVisiblePlaces(
      DISCOVERY_CATEGORIES
        .filter((category) => activeCategories[category])
        .flatMap((category) => category === 'hotel' ? inventoryHotelPlaces : (placesByCategory[category] || []))
    ),
    [activeCategories, inventoryHotelPlaces, placesByCategory]
  );

  const visibleActivityMarkers = useMemo(
    () => activityMarkers.filter((marker) => activeCategories[marker.placeCategory]),
    [activeCategories, activityMarkers]
  );

  const hotelInventorySearchLoading = selectedSegment?.hotelPlan.searchStatus === 'loading';
  const discoveryLoading = placesLoading || inventoryHotelsLoading || hotelInventorySearchLoading;

  useEffect(() => {
    if (selectedPlace && !activeCategories[selectedPlace.category]) {
      setSelectedPlace(null);
    }
  }, [activeCategories, selectedPlace]);

  useEffect(() => {
    if (selectedActivity && !activeCategories[selectedActivity.placeCategory]) {
      setSelectedActivity(null);
    }
  }, [activeCategories, selectedActivity]);

  const canInsertNonHotel = Boolean(selectedSegment && selectedSegment.days.length > 0 && onRequestAddPlaceToPlanner);

  const handleActivityClick = useCallback((marker: ActivityMarkerEntry) => {
    setSelectedPlace(null);
    setShowCityPanel(false);
    setSelectedActivity((prev) => (prev?.activityId === marker.activityId ? null : marker));
  }, []);

  const handleCityMarkerClick = useCallback((segmentId: string) => {
    setSelectedActivity(null);
    setSelectedPlace(null);
    onSelectSegment(segmentId);
    setShowCityPanel(true);
  }, [onSelectSegment]);

  const handleDiscoveryPlaceClick = useCallback((place: PlannerPlaceCandidate) => {
    setSelectedActivity(null);
    setShowCityPanel(false);
    setSelectedPlace((prev) => (prev?.placeId === place.placeId ? null : place));
  }, []);

  const selectedInventoryHotel = selectedPlace?.source === 'inventory' && selectedPlace.category === 'hotel'
    ? (selectedPlace as PlannerPlaceHotelCandidate).hotel || null
    : null;

  if (!coreLib) return null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {discoveryLoading && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
          <div className="planner-map-loading-rail">
            <div className="planner-map-loading-rail__beam" />
          </div>
        </div>
      )}
      <GoogleMap
        defaultCenter={initialCenter}
        defaultZoom={initialZoom}
        mapId={PLANNER_GOOGLE_MAPS_MAP_ID || undefined}
        reuseMaps
        disableDefaultUI={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        gestureHandling="greedy"
        colorScheme="LIGHT"
        renderingType={RenderingType.VECTOR}
        style={{ width: '100%', height: '100%' }}
      >
        <PlannerViewportManager segments={segments} selectedSegment={selectedSegment} />
        <PlannerRouteOverlay segments={segments} />
        {segments.map((segment, index) => {
          const isNew = !animatedCityIdsRef.current.has(segment.id);
          if (isNew) animatedCityIdsRef.current.add(segment.id);
          const isSelected = segment.id === selectedSegment?.id;

          return (
            <Marker
              key={segment.id}
              position={{ lat: segment.location.lat, lng: segment.location.lng }}
              icon={{
                url: buildCityMarkerIcon(index, isSelected),
                scaledSize: new google.maps.Size(36, 36),
                anchor: new google.maps.Point(18, 18),
              }}
              zIndex={isSelected ? 1000 : index + 1}
              animation={isNew ? google.maps.Animation.DROP : undefined}
              onClick={() => handleCityMarkerClick(segment.id)}
            />
          );
        })}

        {visiblePlaces
          .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng))
          .map((place) => {
            const labelText = getDiscoveryMarkerLabel(place);
            const metrics = getDiscoveryChipMarkerMetrics(labelText);
            const isSelectedPlace = selectedPlace?.placeId === place.placeId;
            return (
              <Marker
                key={`${place.category}-${place.placeId}`}
                position={{ lat: place.lat!, lng: place.lng! }}
                icon={{
                  url: buildDiscoveryChipMarkerIcon({
                    category: place.category,
                    labelText,
                    isSelected: isSelectedPlace,
                  }),
                  scaledSize: new google.maps.Size(metrics.width, metrics.height),
                  anchor: new google.maps.Point(Math.round(metrics.width / 2), Math.round(metrics.height / 2)),
                }}
                zIndex={isSelectedPlace ? 920 : place.category === 'hotel' ? 760 : 640}
                onClick={() => handleDiscoveryPlaceClick(place)}
              />
            );
          })}

        {visibleActivityMarkers.map((marker) => {
          const isNew = !animatedMarkerIdsRef.current.has(marker.activityId);
          if (isNew) animatedMarkerIdsRef.current.add(marker.activityId);

          return (
            <Marker
              key={marker.activityId}
              position={{ lat: marker.lat, lng: marker.lng }}
              icon={{
                url: buildEmojiMarkerIcon(ACTIVITY_EMOJI[marker.activityType] || ACTIVITY_EMOJI.unknown, 'white', '#94a3b8'),
                scaledSize: new google.maps.Size(32, 32),
                anchor: new google.maps.Point(16, 16),
              }}
              zIndex={500}
              animation={isNew ? google.maps.Animation.DROP : undefined}
              onClick={() => handleActivityClick(marker)}
            />
          );
        })}

        {selectedActivity && (
          <InfoWindow position={{ lat: selectedActivity.lat, lng: selectedActivity.lng }} onCloseClick={() => setSelectedActivity(null)} pixelOffset={[0, -20]}>
            <div className="w-[280px]">
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
            </div>
          </InfoWindow>
        )}

        {!selectedActivity && selectedPlace && selectedSegment && (
          <InfoWindow
            position={{ lat: selectedPlace.lat || selectedSegment.location.lat, lng: selectedPlace.lng || selectedSegment.location.lng }}
            onCloseClick={() => setSelectedPlace(null)}
            pixelOffset={[0, -20]}
          >
            <div className="w-[300px]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-lg leading-none">{getPlannerPlaceEmoji(selectedPlace.category, selectedPlace.activityType)}</span>
                    <h3 className="text-sm font-semibold leading-tight text-slate-900">{selectedPlace.name}</h3>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{placeDetails?.formattedAddress || selectedPlace.formattedAddress}</p>
                </div>
                {typeof (placeDetails?.rating ?? selectedPlace.rating) === 'number' && (
                  <span className="flex items-center gap-0.5 text-xs font-medium text-amber-600">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {(placeDetails?.rating ?? selectedPlace.rating)?.toFixed(1)}
                  </span>
                )}
              </div>

              {(placeDetails?.photoUrls?.[0] || selectedPlace.photoUrls?.[0]) && (
                <img src={placeDetails?.photoUrls?.[0] || selectedPlace.photoUrls?.[0]} alt="" className="mt-2 h-[104px] w-full rounded-lg object-cover" />
              )}

              <div className="mt-2 flex flex-wrap gap-1">
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                  {getPlannerPlaceCategoryLabel(selectedPlace.category)}
                </span>
                {placeDetails?.isOpenNow === true && (
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">Abierto ahora</span>
                )}
                {placeDetails?.isOpenNow === false && (
                  <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">Cerrado ahora</span>
                )}
              </div>

              {placeLoading && selectedPlace.source !== 'inventory' && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando info...
                </div>
              )}

              {placeDetails?.reviewSnippet && selectedPlace.source !== 'inventory' && (
                <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-slate-600">{placeDetails.reviewSnippet}</p>
              )}

              {selectedInventoryHotel && (
                <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600">
                  <div className="flex items-center justify-between gap-2">
                    <span>{formatDateRange(selectedInventoryHotel.check_in, selectedInventoryHotel.check_out)}</span>
                    <span>{selectedInventoryHotel.nights} noche{selectedInventoryHotel.nights === 1 ? '' : 's'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{formatPlannerRoomLabel(selectedInventoryHotel)}</span>
                    {getPrimaryPlannerHotelRoom(selectedInventoryHotel) && (
                      <span className="font-semibold text-slate-900">
                        {formatPlannerPrice(getPrimaryPlannerHotelRoom(selectedInventoryHotel)?.total_price, getPrimaryPlannerHotelRoom(selectedInventoryHotel)?.currency)}
                      </span>
                    )}
                  </div>
                  {formatPlannerTravelerSummary(selectedInventoryHotel) && (
                    <div>{formatPlannerTravelerSummary(selectedInventoryHotel)}</div>
                  )}
                </div>
              )}

              {selectedPlace.category === 'hotel' ? (
                <Button type="button" size="sm" className="mt-3 w-full" onClick={() => onAddHotelToSegment?.(selectedSegment.id, selectedPlace as PlannerPlaceHotelCandidate)}>
                  Agregar hotel al destino
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3 w-full"
                    disabled={!canInsertNonHotel}
                    onClick={() => onRequestAddPlaceToPlanner?.({ segmentId: selectedSegment.id, place: selectedPlace })}
                  >
                    Agregar al itinerario
                  </Button>
                  {!canInsertNonHotel && (
                    <p className="mt-2 text-[11px] text-slate-500">
                      Este destino todavía no tiene días generados para ubicar actividades.
                    </p>
                  )}
                </>
              )}
            </div>
          </InfoWindow>
        )}

        {!selectedActivity && showCityPanel && selectedSegment && (
          <InfoWindow position={{ lat: selectedSegment.location.lat, lng: selectedSegment.location.lng }} onCloseClick={() => setShowCityPanel(false)} pixelOffset={[0, -20]}>
            <div className="w-[320px]">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {segments.findIndex((segment) => segment.id === selectedSegment.id) + 1}
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

              {placesLoading ? (
                <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Cargando lugares de la ciudad...
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {DISCOVERY_CATEGORIES.filter((category) => activeCategories[category]).map((category) => {
                    const topPlaces = (category === 'hotel' ? inventoryHotelPlaces : placesByCategory[category]).slice(0, 2);
                    if (topPlaces.length === 0) return null;

                    return (
                      <div key={category}>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {CATEGORY_STYLES[category].label}
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
                              {place.rating ? ` • ${place.rating}` : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {cityPlaceLoading && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando info...
                </div>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

    </div>
  );
}

export default function TripPlannerMap({
  segments,
  days,
  activeCategories,
  isResolvingLocations = false,
  locationWarning,
  draftPhrase,
  onSelectSegment,
  onAddHotelToSegment,
  onRequestAddPlaceToPlanner,
  onAutoFillRealPlaces,
}: TripPlannerMapProps) {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const mappedSegments = useMemo(
    () => segments.filter(
      (segment): segment is SegmentWithLocation =>
        Boolean(segment.location && Number.isFinite(segment.location.lat) && Number.isFinite(segment.location.lng))
    ),
    [segments]
  );

  useEffect(() => {
    if (!selectedSegmentId && mappedSegments.length > 0) {
      setSelectedSegmentId(mappedSegments[0].id);
      return;
    }

    if (selectedSegmentId && !mappedSegments.some((segment) => segment.id === selectedSegmentId)) {
      setSelectedSegmentId(mappedSegments[0]?.id || null);
    }
  }, [mappedSegments, selectedSegmentId]);

  const unresolvedCount = segments.length - mappedSegments.length;
  const destinationSummary = segments.map((segment) => formatDestinationLabel(segment.city)).join(' • ');
  const canRenderMap = HAS_PLANNER_GOOGLE_MAPS && mappedSegments.length > 0 && !mapError;

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-primary/15 bg-transparent shadow-sm">
      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-wrap items-start justify-between gap-3 animate-in fade-in duration-700">
        <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            <MapPinned className="h-3.5 w-3.5 text-primary" />
            Mapa del recorrido
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {segments.length} destinos conectados en una ruta de {days} días.
          </p>
        </div>
        <div className="max-w-full rounded-full border border-white/70 bg-white/85 px-4 py-2 text-xs text-slate-600 shadow backdrop-blur">
          {destinationSummary}
        </div>
      </div>

      <div className="h-[320px] sm:h-[380px]">
        {!HAS_PLANNER_GOOGLE_MAPS ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,#f8fafc,#e2e8f0)] px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPinned className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-slate-900">Configurá Google Maps para ver el recorrido interactivo.</p>
              <p className="text-sm text-slate-500">
                Agregá <code>VITE_GOOGLE_MAPS_API_KEY</code> para habilitar el mapa real del viaje.
              </p>
            </div>
          </div>
        ) : mappedSegments.length === 0 ? (
          <div className="relative h-full">
            <APIProvider
              apiKey={PLANNER_GOOGLE_MAPS_API_KEY}
              language="es"
              region="ES"
            >
              <GoogleMap
                defaultCenter={{ lat: 30, lng: 10 }}
                defaultZoom={2.2}
                mapId={PLANNER_GOOGLE_MAPS_MAP_ID || undefined}
                reuseMaps
                disableDefaultUI
                gestureHandling="cooperative"
                colorScheme="LIGHT"
                renderingType={RenderingType.VECTOR}
                style={{ width: '100%', height: '100%' }}
              />
            </APIProvider>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 px-6 text-center backdrop-blur-[2px]">
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
          <APIProvider
            apiKey={PLANNER_GOOGLE_MAPS_API_KEY}
            language="es"
            region="ES"
            libraries={['marker', 'places']}
            onError={(error) => {
              console.error('❌ [TRIP PLANNER MAP] Google Maps failed to load:', error);
              setMapError('No pudimos cargar Google Maps en este momento.');
            }}
          >
	            <PlannerGoogleMapScene
	              segments={mappedSegments}
	              selectedSegmentId={selectedSegmentId}
	              activeCategories={activeCategories}
              onSelectSegment={(segmentId) => {
                setSelectedSegmentId(segmentId);
                onSelectSegment?.(segmentId);
              }}
	              onAddHotelToSegment={onAddHotelToSegment}
	              onRequestAddPlaceToPlanner={onRequestAddPlaceToPlanner}
	              onAutoFillRealPlaces={onAutoFillRealPlaces}
	            />
          </APIProvider>
        )}
      </div>

      <div className="border-t bg-white/85 px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Route className="h-3.5 w-3.5 text-primary" />
            {canRenderMap ? 'Google Maps interactivo con filtros de hoteles, gastronomía, museos y actividades' : 'Vista del recorrido preparada para Google Maps'}
          </div>
          {(unresolvedCount > 0 || locationWarning || mapError) && (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {mapError || locationWarning || `No pudimos ubicar ${unresolvedCount} destino${unresolvedCount > 1 ? 's' : ''} en el mapa.`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
