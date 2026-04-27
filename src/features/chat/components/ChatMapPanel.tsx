import { useMemo, useState } from 'react';
import MapGL, { Layer, Marker, NavigationControl, Popup, Source } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Star } from 'lucide-react';
import { HAS_MAP, MAPBOX_TOKEN } from '@/features/trip-planner/map';
import type { TripPlannerState } from '@/features/trip-planner/types';
import type { DiscoveryContext } from '../services/discoveryService';
import { cn } from '@/lib/utils';
import { buildChatMapModel, type ChatMapMarker, type ChatMapModel } from '../utils/chatMapModel';

interface ChatMapPanelProps {
  plannerState: TripPlannerState | null;
  discoveryContext?: DiscoveryContext | null;
  className?: string;
}

function getInitialViewState(model: ChatMapModel) {
  const [first] = model.markers;
  if (model.markers.length === 1) {
    return {
      longitude: first.lng,
      latitude: first.lat,
      zoom: first.kind === 'place' ? 13 : 10.5,
    };
  }

  const average = model.markers.reduce(
    (acc, marker) => ({
      lng: acc.lng + marker.lng,
      lat: acc.lat + marker.lat,
    }),
    { lng: 0, lat: 0 },
  );

  return {
    longitude: average.lng / model.markers.length,
    latitude: average.lat / model.markers.length,
    zoom: model.route.length > 1 ? 4 : 11,
  };
}

function buildRouteGeoJSON(route: Array<[number, number]>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: route.length >= 2
      ? [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route,
          },
        }]
      : [],
  };
}

function fitMapToMarkers(map: mapboxgl.Map, markers: ChatMapMarker[]) {
  if (markers.length <= 1) return;

  const bounds = new mapboxgl.LngLatBounds();
  markers.forEach((marker) => bounds.extend([marker.lng, marker.lat]));
  map.fitBounds(bounds, { padding: 42, duration: 0, maxZoom: 12 });
}

export default function ChatMapPanel({
  plannerState,
  discoveryContext,
  className,
}: ChatMapPanelProps) {
  const model = useMemo(
    () => buildChatMapModel(plannerState, discoveryContext),
    [plannerState, discoveryContext],
  );
  const [selectedMarker, setSelectedMarker] = useState<ChatMapMarker | null>(null);

  if (!model) return null;

  const initialViewState = getInitialViewState(model);
  const routeGeoJSON = buildRouteGeoJSON(model.route);
  const placeMarkers = model.markers.filter((marker) => marker.kind === 'place');

  return (
    <aside
      className={cn('flex h-full w-full flex-col bg-background', className)}
      data-testid="chat-map-panel"
    >
      <div className="min-h-[360px] flex-1 border-b border-border">
        <div className="h-full w-full bg-muted">
          {HAS_MAP ? (
            <MapGL
              key={model.markers.map((marker) => marker.id).join('|')}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={initialViewState}
              style={{ width: '100%', height: '100%' }}
              mapStyle="mapbox://styles/mapbox/streets-v12"
              dragRotate={false}
              touchZoomRotate={false}
              onLoad={(event) => fitMapToMarkers(event.target, model.markers)}
              onClick={() => setSelectedMarker(null)}
            >
              <NavigationControl position="bottom-right" showCompass={false} />

              {model.route.length >= 2 && (
                <Source id="chat-route" type="geojson" data={routeGeoJSON}>
                  <Layer
                    id="chat-route-line"
                    type="line"
                    paint={{
                      'line-color': '#2563eb',
                      'line-width': 3,
                      'line-opacity': 0.9,
                      'line-dasharray': [2, 1.5],
                    }}
                    layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  />
                </Source>
              )}

              {model.markers.map((marker) => (
                <Marker
                  key={marker.id}
                  longitude={marker.lng}
                  latitude={marker.lat}
                  anchor="center"
                  onClick={(event) => {
                    event.originalEvent.stopPropagation();
                    setSelectedMarker(marker);
                  }}
                >
                  <button
                    type="button"
                    className={cn(
                      'flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white px-2 text-xs font-semibold shadow-md transition-transform hover:scale-105',
                      marker.kind === 'place'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-950 text-white'
                    )}
                    aria-label={marker.name}
                  >
                    {marker.order ?? <MapPin className="h-3.5 w-3.5" />}
                  </button>
                </Marker>
              ))}

              {selectedMarker && (
                <Popup
                  longitude={selectedMarker.lng}
                  latitude={selectedMarker.lat}
                  closeButton={false}
                  closeOnClick={false}
                  anchor="top"
                  offset={12}
                >
                  <div className="max-w-[180px] rounded-md border border-border bg-background px-3 py-2 text-foreground shadow-lg">
                    <p className="text-sm font-medium leading-tight">{selectedMarker.name}</p>
                    {selectedMarker.subtitle && (
                      <p className="mt-1 text-xs text-muted-foreground">{selectedMarker.subtitle}</p>
                    )}
                    {selectedMarker.rating && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span>{selectedMarker.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </Popup>
              )}
            </MapGL>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Configurá VITE_MAPBOX_TOKEN para ver el mapa.
            </div>
          )}
        </div>
      </div>

      {placeMarkers.length > 0 && (
      <div className="max-h-[220px] overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-2">
          {placeMarkers.map((marker) => (
            <button
              key={`list-${marker.id}`}
              type="button"
              className="flex items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted"
              onClick={() => setSelectedMarker(marker)}
            >
              <span className={cn(
                'mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-semibold',
                marker.kind === 'place'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-900'
              )}>
                {marker.order ?? <MapPin className="h-3 w-3" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{marker.name}</span>
                {marker.subtitle && (
                  <span className="block truncate text-xs text-muted-foreground">{marker.subtitle}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
      )}
    </aside>
  );
}
