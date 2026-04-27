import type { TripPlannerState } from '@/features/trip-planner/types';
import type { DiscoveryContext } from '../services/discoveryService';

export type ChatMapMarkerKind = 'destination' | 'place';

export interface ChatMapMarker {
  id: string;
  name: string;
  subtitle?: string;
  lat: number;
  lng: number;
  kind: ChatMapMarkerKind;
  order?: number;
  rating?: number;
}

export interface ChatMapModel {
  title: string;
  subtitle: string;
  markers: ChatMapMarker[];
  route: Array<[number, number]>;
}

function isFiniteCoord(lat?: number, lng?: number): lat is number {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function buildDiscoveryModel(discoveryContext: DiscoveryContext): ChatMapModel | null {
  const destination = discoveryContext.destination;
  if (!isFiniteCoord(destination.lat, destination.lng)) return null;

  const placeMarkers = discoveryContext.places
    .filter((place) => isFiniteCoord(place.lat, place.lng))
    .slice(0, 12)
    .map((place, index): ChatMapMarker => ({
      id: place.placeId || `${place.name}-${index}`,
      name: place.name,
      subtitle: place.category || place.city,
      lat: place.lat!,
      lng: place.lng!,
      kind: 'place',
      order: index + 1,
    }));

  return {
    title: `Mapa de ${destination.city}`,
    subtitle: placeMarkers.length > 0
      ? `${placeMarkers.length} lugares recomendados`
      : 'Destino de la conversación',
    markers: [
      {
        id: `destination-${destination.city}`,
        name: destination.city,
        subtitle: destination.country,
        lat: destination.lat,
        lng: destination.lng,
        kind: 'destination',
      },
      ...placeMarkers,
    ],
    route: [],
  };
}

function buildPlannerModel(plannerState: TripPlannerState | null): ChatMapModel | null {
  const segments = (plannerState?.segments ?? [])
    .filter((segment) => isFiniteCoord(segment.location?.lat, segment.location?.lng));

  if (segments.length === 0) return null;

  const markers = segments.map((segment, index): ChatMapMarker => ({
    id: segment.id || `${segment.city}-${index}`,
    name: segment.city,
    subtitle: segment.country,
    lat: segment.location!.lat,
    lng: segment.location!.lng,
    kind: 'destination',
    order: index + 1,
  }));

  return {
    title: 'Mapa del viaje',
    subtitle: segments.length === 1
      ? segments[0].city
      : `${segments.length} ciudades conectadas`,
    markers,
    route: markers.map((marker) => [marker.lng, marker.lat]),
  };
}

export function buildChatMapModel(
  plannerState: TripPlannerState | null,
  discoveryContext?: DiscoveryContext | null,
): ChatMapModel | null {
  if (discoveryContext) {
    const discoveryModel = buildDiscoveryModel(discoveryContext);
    if (discoveryModel) return discoveryModel;
  }

  return buildPlannerModel(plannerState);
}

export function hasChatMapContent(
  plannerState: TripPlannerState | null,
  discoveryContext?: DiscoveryContext | null,
): boolean {
  return buildChatMapModel(plannerState, discoveryContext) !== null;
}
