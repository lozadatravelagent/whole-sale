import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  InfoWindow,
  Map,
  Marker,
  RenderingType,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { AlertCircle, Calendar, Clock, Lightbulb, Loader2, MapPin, MapPinned, Route, Star } from 'lucide-react';
import { HAS_PLANNER_GOOGLE_MAPS, PLANNER_GOOGLE_MAPS_API_KEY, PLANNER_GOOGLE_MAPS_MAP_ID } from '../map';
import type { PlannerActivity, PlannerActivityType, PlannerSegment } from '../types';
import { formatDateRange, formatDestinationLabel } from '../utils';
import { resolveActivityLocation } from '../services/plannerGeocoding';
import { fetchPlaceDetails, type PlaceDetails } from '../services/placesService';

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

function buildEmojiMarkerIcon(emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
    <circle cx="18" cy="18" r="16" fill="white" stroke="#0f172a" stroke-width="2"/>
    <text x="18" y="19" text-anchor="middle" dominant-baseline="central" font-size="16">${emoji}</text>
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

type ActivityMarkerEntry = {
  activityId: string;
  title: string;
  time?: string;
  category?: string;
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
  isResolvingLocations?: boolean;
  locationWarning?: string | null;
  onSelectSegment?: (segmentId: string) => void;
}

function PlannerRouteOverlay({
  segments,
}: {
  segments: Array<PlannerSegment & { location: NonNullable<PlannerSegment['location']> }>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined' || segments.length < 2) {
      return;
    }

    const routeLine = new google.maps.Polyline({
      path: segments.map((segment) => ({
        lat: segment.location.lat,
        lng: segment.location.lng,
      })),
      geodesic: true,
      strokeColor: '#2563eb',
      strokeOpacity: 0.92,
      strokeWeight: 4,
      icons: [
        {
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 1,
            scale: 4,
          },
          offset: '0',
          repeat: '18px',
        },
      ],
    });

    routeLine.setMap(map);

    let offset = 100;
    const interval = setInterval(() => {
      offset -= 2;
      if (offset <= 0) {
        offset = 0;
        clearInterval(interval);
      }
      routeLine.set('icons', [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4 },
        offset: `${offset}%`,
        repeat: '18px',
      }]);
    }, 30);

    return () => {
      clearInterval(interval);
      routeLine.setMap(null);
    };
  }, [map, segments]);

  return null;
}

function PlannerViewportManager({
  segments,
}: {
  segments: Array<PlannerSegment & { location: NonNullable<PlannerSegment['location']> }>;
}) {
  const map = useMap();

  const fitSignature = useMemo(
    () => segments.map((segment) => `${segment.id}:${segment.location.lng}:${segment.location.lat}`).join('|'),
    [segments]
  );

  useEffect(() => {
    if (!map || typeof google === 'undefined' || segments.length === 0) {
      return;
    }

    if (segments.length === 1) {
      const segment = segments[0];
      map.setCenter({ lat: segment.location.lat, lng: segment.location.lng });
      map.setZoom(5.5);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    segments.forEach((segment) => bounds.extend({ lat: segment.location.lat, lng: segment.location.lng }));
    map.fitBounds(bounds, 56);
  }, [fitSignature, map, segments]);

  return null;
}

function collectSegmentActivities(segment: PlannerSegment): Array<PlannerActivity & { slot: string }> {
  const result: Array<PlannerActivity & { slot: string }> = [];
  for (const day of segment.days) {
    for (const a of day.morning) result.push({ ...a, slot: 'morning' });
    for (const a of day.afternoon) result.push({ ...a, slot: 'afternoon' });
    for (const a of day.evening) result.push({ ...a, slot: 'evening' });
  }
  return result;
}

type SegmentWithLocation = PlannerSegment & { location: NonNullable<PlannerSegment['location']> };

function PlannerGoogleMapScene({
  segments,
  selectedSegmentId,
  onSelectSegment,
}: {
  segments: SegmentWithLocation[];
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string) => void;
}) {
  const coreLib = useMapsLibrary('core');
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId) || segments[0];
  const [activityMarkers, setActivityMarkers] = useState<ActivityMarkerEntry[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityMarkerEntry | null>(null);
  const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [cityPlaceDetails, setCityPlaceDetails] = useState<PlaceDetails | null>(null);
  const [cityPlaceLoading, setCityPlaceLoading] = useState(false);
  const [showCityPanel, setShowCityPanel] = useState(false);
  const geocodeGenRef = useRef(0);
  const animatedMarkerIdsRef = useRef<Set<string>>(new Set());
  const animatedCityIdsRef = useRef<Set<string>>(new Set());
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (placesLib && map && !placesServiceRef.current) {
      placesServiceRef.current = new placesLib.PlacesService(map);
    }
  }, [placesLib, map]);

  useEffect(() => {
    if (!selectedActivity) {
      setPlaceDetails(null);
      setPlaceLoading(false);
      return;
    }

    const service = placesServiceRef.current;
    if (!service || !selectedActivity.city) {
      setPlaceDetails(null);
      setPlaceLoading(false);
      return;
    }

    let cancelled = false;
    setPlaceDetails(null);
    setPlaceLoading(true);

    fetchPlaceDetails(service, selectedActivity.title, selectedActivity.city, {
      lat: selectedActivity.lat,
      lng: selectedActivity.lng,
    }).then((details) => {
      if (cancelled) return;
      setPlaceDetails(details);
      setPlaceLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedActivity]);

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

    const cityQuery = selectedSegment.city;
    const countryQuery = selectedSegment.country || '';

    fetchPlaceDetails(service, cityQuery, countryQuery, {
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
  }, [showCityPanel, selectedSegment]);

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

    // Collect activities from ALL segments
    const allActivities: Array<PlannerActivity & { slot: string; city: string; country?: string }> = [];
    for (const segment of segments) {
      for (const activity of collectSegmentActivities(segment)) {
        allActivities.push({ ...activity, city: segment.city, country: segment.country });
      }
    }

    if (allActivities.length === 0) return;

    (async () => {
      for (const activity of allActivities) {
        if (geocodeGenRef.current !== gen) return;

        const coords = await resolveActivityLocation({
          title: activity.title,
          neighborhood: activity.neighborhood,
          city: activity.city,
          country: activity.country,
        });

        if (geocodeGenRef.current !== gen || !coords) continue;

        const entry: ActivityMarkerEntry = {
          activityId: activity.id,
          title: activity.title,
          time: activity.time,
          category: activity.category,
          activityType: activity.activityType || 'unknown',
          lat: coords.lat,
          lng: coords.lng,
          description: activity.description,
          tip: activity.tip,
          neighborhood: activity.neighborhood,
          durationMinutes: activity.durationMinutes,
          city: activity.city,
          country: activity.country,
        };

        setActivityMarkers((prev) => {
          if (prev.some((m) => m.activityId === entry.activityId)) return prev;
          return [...prev, entry];
        });
      }
    })();

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally bumping the generation to cancel in-flight geocoding
      geocodeGenRef.current++;
    };
  }, [segments]);

  const handleActivityClick = useCallback((marker: ActivityMarkerEntry) => {
    setShowCityPanel(false);
    setSelectedActivity((prev) => (prev?.activityId === marker.activityId ? null : marker));
  }, []);

  const handleCityMarkerClick = useCallback((segmentId: string) => {
    setSelectedActivity(null);
    onSelectSegment(segmentId);
    setShowCityPanel(true);
  }, [onSelectSegment]);

  if (!coreLib) return null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Map
        defaultCenter={{ lat: 42, lng: 9 }}
        defaultZoom={3}
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
        <PlannerViewportManager segments={segments} />
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

        {activityMarkers.map((marker) => {
          const isNew = !animatedMarkerIdsRef.current.has(marker.activityId);
          if (isNew) animatedMarkerIdsRef.current.add(marker.activityId);

          return (
            <Marker
              key={marker.activityId}
              position={{ lat: marker.lat, lng: marker.lng }}
              icon={{
                url: buildEmojiMarkerIcon(ACTIVITY_EMOJI[marker.activityType] || ACTIVITY_EMOJI.unknown),
                scaledSize: new google.maps.Size(36, 36),
                anchor: new google.maps.Point(18, 18),
              }}
              zIndex={500}
              animation={isNew ? google.maps.Animation.DROP : undefined}
              onClick={() => handleActivityClick(marker)}
            />
          );
        })}

        {selectedActivity && (
          <InfoWindow
            position={{ lat: selectedActivity.lat, lng: selectedActivity.lng }}
            onCloseClick={() => setSelectedActivity(null)}
            pixelOffset={[0, -20]}
          >
            <div className="w-[280px]">
              <div className="flex items-start gap-2.5">
                <span className="text-2xl leading-none">{ACTIVITY_EMOJI[selectedActivity.activityType] || ACTIVITY_EMOJI.unknown}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-tight text-slate-900">{selectedActivity.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {placeDetails?.rating && (
                      <span className="flex items-center gap-0.5 text-xs font-medium text-amber-600">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {placeDetails.rating}
                      </span>
                    )}
                    {selectedActivity.category && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        {selectedActivity.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {placeDetails?.photoUrls?.[0] && (
                <img src={placeDetails.photoUrls[0]} alt="" className="mt-2 h-[100px] w-full rounded-lg object-cover" />
              )}

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

              {placeLoading && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando info...
                </div>
              )}

              {placeDetails?.formattedAddress && (
                <p className="mt-2 flex items-start gap-1 text-[11px] text-slate-500">
                  <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" />
                  {placeDetails.formattedAddress}
                </p>
              )}
            </div>
          </InfoWindow>
        )}

        {!selectedActivity && showCityPanel && selectedSegment && (
          <InfoWindow
            position={{ lat: selectedSegment.location.lat, lng: selectedSegment.location.lng }}
            onCloseClick={() => setShowCityPanel(false)}
            pixelOffset={[0, -20]}
          >
            <div className="w-[280px]">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {segments.findIndex((s) => s.id === selectedSegment.id) + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{formatDestinationLabel(selectedSegment.city)}</h3>
                  {selectedSegment.country && (
                    <span className="text-[11px] text-slate-500">{selectedSegment.country}</span>
                  )}
                </div>
              </div>

              {cityPlaceDetails?.photoUrls?.[0] && (
                <img src={cityPlaceDetails.photoUrls[0]} alt="" className="mt-2 h-[100px] w-full rounded-lg object-cover" />
              )}

              {cityPlaceDetails?.rating && (
                <div className="mt-2 flex items-center gap-0.5 text-xs font-medium text-amber-600">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {cityPlaceDetails.rating}
                  {cityPlaceDetails.userRatingsTotal && (
                    <span className="ml-1 text-[10px] font-normal text-slate-400">({cityPlaceDetails.userRatingsTotal.toLocaleString()})</span>
                  )}
                </div>
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
                {selectedSegment.days.length > 0 && (
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    {selectedSegment.days.reduce((acc, d) => acc + d.morning.length + d.afternoon.length + d.evening.length, 0)} actividades
                  </span>
                )}
              </div>

              {selectedSegment.summary && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{selectedSegment.summary}</p>
              )}

              {cityPlaceLoading && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando info...
                </div>
              )}
            </div>
          </InfoWindow>
        )}

      </Map>
    </div>
  );
}

export default function TripPlannerMap({
  segments,
  days,
  isResolvingLocations = false,
  locationWarning,
  onSelectSegment,
}: TripPlannerMapProps) {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const mappedSegments = useMemo(
    () =>
      segments.filter(
        (segment): segment is PlannerSegment & { location: NonNullable<PlannerSegment['location']> } =>
          Boolean(segment.location && Number.isFinite(segment.location.lat) && Number.isFinite(segment.location.lng))
      ),
    [segments]
  );

  useEffect(() => {
    if (!selectedSegmentId && mappedSegments.length > 0) {
      setSelectedSegmentId(mappedSegments[0].id);
    }
  }, [mappedSegments, selectedSegmentId]);

  const unresolvedCount = segments.length - mappedSegments.length;
  const destinationSummary = segments.map((segment) => formatDestinationLabel(segment.city)).join(' • ');
  const canRenderMap = HAS_PLANNER_GOOGLE_MAPS && mappedSegments.length > 0 && !mapError;

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-primary/15 bg-slate-100 shadow-sm">
      <div className="absolute inset-x-4 top-4 z-10 flex flex-wrap items-start justify-between gap-3 pointer-events-none animate-in fade-in duration-700">
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
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,#f8fafc,#e2e8f0)] px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPinned className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-slate-900">
                {isResolvingLocations ? 'Ubicando destinos en el mapa...' : 'Todavía no pudimos ubicar los destinos.'}
              </p>
              <p className="text-sm text-slate-500">
                {locationWarning || 'Cuando tengamos coordenadas para el viaje, el mapa mostrará la ruta completa.'}
              </p>
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
              onSelectSegment={(segmentId) => {
                setSelectedSegmentId(segmentId);
                onSelectSegment?.(segmentId);
              }}
            />
          </APIProvider>
        )}
      </div>

      <div className="border-t bg-white/85 px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Route className="h-3.5 w-3.5 text-primary" />
            {canRenderMap ? 'Google Maps interactivo con zoom y paneo' : 'Vista del recorrido preparada para Google Maps'}
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
