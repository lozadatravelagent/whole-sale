import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  Map,
  Marker,
  RenderingType,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { AlertCircle, Calendar, Clock, ExternalLink, Globe, Lightbulb, Loader2, MapPin, MapPinned, Phone, Route, Star, X } from 'lucide-react';
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

    return () => {
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

function ActivityDetailPanel({
  activity,
  placeDetails,
  placeLoading,
  onClose,
}: {
  activity: ActivityMarkerEntry;
  placeDetails: PlaceDetails | null;
  placeLoading: boolean;
  onClose: () => void;
}) {
  const emoji = ACTIVITY_EMOJI[activity.activityType] || ACTIVITY_EMOJI.unknown;
  const heroPhoto = placeDetails?.photoUrls?.[0];

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-[320px] translate-x-0 flex-col overflow-hidden rounded-l-2xl border-l border-slate-200 bg-white shadow-xl transition-transform duration-300">
      <button
        onClick={onClose}
        className="absolute right-3 top-3 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative h-[160px] flex-shrink-0 overflow-hidden bg-slate-100">
        {heroPhoto ? (
          <img src={heroPhoto} alt={activity.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">{emoji}</div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-3">
          <h3 className="text-base font-semibold leading-tight text-slate-900">{activity.title}</h3>
          <div className="mt-1.5 flex items-center gap-2">
            {placeDetails?.rating && (
              <span className="flex items-center gap-1 text-sm font-medium text-amber-600">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {placeDetails.rating}
                {placeDetails.userRatingsTotal && (
                  <span className="text-xs font-normal text-slate-400">({placeDetails.userRatingsTotal.toLocaleString()})</span>
                )}
              </span>
            )}
            {activity.category && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {activity.category}
              </span>
            )}
          </div>
        </div>

        {activity.description && (
          <div className="px-4 pb-3">
            <p className="text-sm leading-relaxed text-slate-600">{activity.description}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {activity.time && (
            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              <Clock className="h-3 w-3" />
              {activity.time}
            </span>
          )}
          {activity.durationMinutes && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              ~{activity.durationMinutes} min
            </span>
          )}
          {activity.neighborhood && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <MapPin className="h-3 w-3" />
              {activity.neighborhood}
            </span>
          )}
        </div>

        {activity.tip && (
          <div className="mx-4 mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <p className="text-xs leading-relaxed text-amber-800">{activity.tip}</p>
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 px-4 pt-3 pb-4">
          {placeLoading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Buscando info en Google...
            </div>
          ) : placeDetails ? (
            <div className="space-y-2.5">
              {placeDetails.formattedAddress && (
                <div className="flex items-start gap-2 text-xs text-slate-600">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  <span>{placeDetails.formattedAddress}</span>
                </div>
              )}
              {placeDetails.isOpenNow !== undefined && (
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  <span className={placeDetails.isOpenNow ? 'font-medium text-emerald-600' : 'font-medium text-red-500'}>
                    {placeDetails.isOpenNow ? 'Abierto ahora' : 'Cerrado'}
                  </span>
                </div>
              )}
              {placeDetails.phoneNumber && (
                <a href={`tel:${placeDetails.phoneNumber}`} className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                  <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  {placeDetails.phoneNumber}
                </a>
              )}
              {placeDetails.website && (
                <a href={placeDetails.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                  <Globe className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  Sitio web
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {placeDetails.reviewSnippet && (
                <blockquote className="mt-2 border-l-2 border-slate-200 pl-3 text-xs italic leading-relaxed text-slate-500">
                  "{placeDetails.reviewSnippet.length > 150 ? `${placeDetails.reviewSnippet.slice(0, 150)}…` : placeDetails.reviewSnippet}"
                </blockquote>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type SegmentWithLocation = PlannerSegment & { location: NonNullable<PlannerSegment['location']> };

function CityDetailPanel({
  segment,
  segmentIndex,
  placeDetails,
  placeLoading,
  onClose,
}: {
  segment: SegmentWithLocation;
  segmentIndex: number;
  placeDetails: PlaceDetails | null;
  placeLoading: boolean;
  onClose: () => void;
}) {
  const heroPhoto = placeDetails?.photoUrls?.[0];

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-[320px] translate-x-0 flex-col overflow-hidden rounded-l-2xl border-l border-slate-200 bg-white shadow-xl transition-transform duration-300">
      <button
        onClick={onClose}
        className="absolute right-3 top-3 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative h-[160px] flex-shrink-0 overflow-hidden bg-slate-100">
        {heroPhoto ? (
          <img src={heroPhoto} alt={segment.city} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100">
            <MapPinned className="h-12 w-12 text-blue-300" />
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent px-4 pb-3 pt-8">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
            <Route className="h-3.5 w-3.5" />
            Parada {segmentIndex + 1}
          </div>
          <h3 className="text-lg font-bold leading-tight text-white">{formatDestinationLabel(segment.city)}</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            {placeDetails?.rating && (
              <span className="flex items-center gap-1 text-sm font-medium text-amber-600">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {placeDetails.rating}
                {placeDetails.userRatingsTotal && (
                  <span className="text-xs font-normal text-slate-400">({placeDetails.userRatingsTotal.toLocaleString()})</span>
                )}
              </span>
            )}
            {segment.country && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {segment.country}
              </span>
            )}
          </div>
        </div>

        {segment.summary && (
          <div className="px-4 pb-3">
            <p className="text-sm leading-relaxed text-slate-600">{segment.summary}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            <Calendar className="h-3 w-3" />
            {formatDateRange(segment.startDate, segment.endDate)}
          </span>
          {segment.nights != null && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {segment.nights} noche{segment.nights !== 1 ? 's' : ''}
            </span>
          )}
          {segment.days.length > 0 && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              {segment.days.reduce((acc, d) => acc + d.morning.length + d.afternoon.length + d.evening.length, 0)} actividades
            </span>
          )}
        </div>

        <div className="border-t border-slate-100 px-4 pt-3 pb-4">
          {placeLoading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Buscando info en Google...
            </div>
          ) : placeDetails ? (
            <div className="space-y-2.5">
              {placeDetails.formattedAddress && (
                <div className="flex items-start gap-2 text-xs text-slate-600">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  <span>{placeDetails.formattedAddress}</span>
                </div>
              )}
              {placeDetails.website && (
                <a href={placeDetails.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                  <Globe className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  Sitio web
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {placeDetails.reviewSnippet && (
                <blockquote className="mt-2 border-l-2 border-slate-200 pl-3 text-xs italic leading-relaxed text-slate-500">
                  "{placeDetails.reviewSnippet.length > 150 ? `${placeDetails.reviewSnippet.slice(0, 150)}…` : placeDetails.reviewSnippet}"
                </blockquote>
              )}
              {placeDetails.photoUrls.length > 1 && (
                <div className="mt-2 flex gap-2">
                  {placeDetails.photoUrls.slice(1).map((url, i) => (
                    <img key={i} src={url} alt="" className="h-16 w-24 rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
      return;
    }

    const gen = ++geocodeGenRef.current;
    setActivityMarkers([]);
    animatedMarkerIdsRef.current.clear();
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

      </Map>

      <div
        className={`absolute right-0 top-0 z-20 h-full transition-transform duration-300 ${selectedActivity ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedActivity && (
          <ActivityDetailPanel
            activity={selectedActivity}
            placeDetails={placeDetails}
            placeLoading={placeLoading}
            onClose={() => setSelectedActivity(null)}
          />
        )}
      </div>

      <div
        className={`absolute right-0 top-0 z-20 h-full transition-transform duration-300 ${!selectedActivity && showCityPanel && selectedSegment ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {!selectedActivity && showCityPanel && selectedSegment && (
          <CityDetailPanel
            segment={selectedSegment}
            segmentIndex={segments.findIndex((s) => s.id === selectedSegment.id)}
            placeDetails={cityPlaceDetails}
            placeLoading={cityPlaceLoading}
            onClose={() => setShowCityPanel(false)}
          />
        )}
      </div>
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
      <div className="absolute inset-x-4 top-4 z-10 flex flex-wrap items-start justify-between gap-3 pointer-events-none">
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
