import { useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  InfoWindow,
  Map,
  Marker,
  RenderingType,
  useMap,
} from '@vis.gl/react-google-maps';
import { AlertCircle, MapPinned, Route } from 'lucide-react';
import { HAS_PLANNER_GOOGLE_MAPS, PLANNER_GOOGLE_MAPS_API_KEY, PLANNER_GOOGLE_MAPS_MAP_ID } from '../map';
import type { PlannerSegment } from '../types';
import { formatDateRange, formatDestinationLabel } from '../utils';

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

function PlannerGoogleMapScene({
  segments,
  selectedSegmentId,
  onSelectSegment,
}: {
  segments: Array<PlannerSegment & { location: NonNullable<PlannerSegment['location']> }>;
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string) => void;
}) {
  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId) || segments[0];

  return (
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
            label={{
              text: `${index + 1}`,
              color: isSelected ? '#ffffff' : '#0f172a',
              fontWeight: '700',
            }}
            zIndex={isSelected ? 1000 : index + 1}
            onClick={() => onSelectSegment(segment.id)}
          />
        );
      })}

      {selectedSegment && (
        <InfoWindow
          position={{ lat: selectedSegment.location.lat, lng: selectedSegment.location.lng }}
          onCloseClick={() => onSelectSegment(segments[0]?.id || selectedSegment.id)}
        >
          <div className="min-w-[220px] pr-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <Route className="h-3.5 w-3.5 text-primary" />
              Parada {segments.findIndex((segment) => segment.id === selectedSegment.id) + 1}
            </div>
            <p className="mt-2 text-base font-semibold text-slate-950">{formatDestinationLabel(selectedSegment.city)}</p>
            <p className="mt-1 text-sm text-slate-500">
              {formatDateRange(selectedSegment.startDate, selectedSegment.endDate)}
            </p>
            {selectedSegment.summary && (
              <p className="mt-3 text-sm leading-6 text-slate-600">{selectedSegment.summary}</p>
            )}
          </div>
        </InfoWindow>
      )}
    </Map>
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
            libraries={['marker']}
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
