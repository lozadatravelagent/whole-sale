import type { TripPlannerState } from '@/features/trip-planner/types';
import type { DiscoveryContext } from '../services/discoveryService';

export type ChatMapMarkerKind = 'destination' | 'place' | 'origin';

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

// Lat/lng tolerance to detect "origin = first segment" (~5km at the equator).
const SAME_PLACE_TOLERANCE = 0.05;

function isSamePlace(a: { lat: number; lng: number }, b: { lat: number; lng: number }): boolean {
  return Math.abs(a.lat - b.lat) <= SAME_PLACE_TOLERANCE && Math.abs(a.lng - b.lng) <= SAME_PLACE_TOLERANCE;
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

  const destinationMarkers = segments.map((segment, index): ChatMapMarker => ({
    id: segment.id || `${segment.city}-${index}`,
    name: segment.city,
    subtitle: segment.country,
    lat: segment.location!.lat,
    lng: segment.location!.lng,
    kind: 'destination',
    order: index + 1,
  }));

  // Origin marker → drives the origin→first-destination polyline on the map.
  // Skipped when origin city overlaps with the first segment (avoids stacked markers).
  const originLocation = plannerState?.originLocation;
  const firstDest = destinationMarkers[0];
  const showOrigin = Boolean(
    originLocation
    && isFiniteCoord(originLocation.lat, originLocation.lng)
    && !isSamePlace(originLocation, firstDest)
  );

  const originMarker: ChatMapMarker | null = showOrigin
    ? {
        id: 'origin',
        name: originLocation!.city,
        subtitle: originLocation!.country,
        lat: originLocation!.lat,
        lng: originLocation!.lng,
        kind: 'origin',
        order: 0,
      }
    : null;

  const markers: ChatMapMarker[] = originMarker
    ? [originMarker, ...destinationMarkers]
    : destinationMarkers;

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
