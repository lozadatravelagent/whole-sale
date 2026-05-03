import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { ChatRecommendedPlace } from './conversationOrchestrator';
import { formatDiscoveryResponse } from './conversationOrchestrator';

export interface DiscoveryDestination {
  city: string;
  country?: string;
  lat: number;
  lng: number;
  bbox?: [number, number, number, number];
  placeLabel?: string;
  confidence: number;
  source: 'parsed_request' | 'planner_state' | 'conversation_history' | 'message_heuristic';
}

export interface DiscoveryContext {
  destination: DiscoveryDestination;
  queryType: 'broad_city_discovery' | 'museum_discovery' | 'food_discovery' | 'nightlife_discovery' | 'neighborhood_discovery';
  places: ChatRecommendedPlace[];
}

function buildApproximateBbox(lat: number, lng: number): [number, number, number, number] {
  const latDelta = 0.12;
  const lngDelta = 0.18;
  return [lng - lngDelta, lat - latDelta, lng + lngDelta, lat + latDelta];
}

function bucketFromToolCategory(category?: string): ChatRecommendedPlace['bucket'] {
  switch (category) {
    case 'restaurant':
    case 'cafe':
      return 'gastronomia';
    case 'nightlife':
      return 'noche';
    case 'museum':
      return 'museos';
    case 'parks':
      return 'parques';
    case 'culture':
      return 'historia';
    case 'sights':
    case 'activity':
    case 'shopping':
    default:
      return 'imperdibles';
  }
}

function queryTypeFromDiscoveryIntent(intent?: string): DiscoveryContext['queryType'] {
  switch (intent) {
    case 'food':
      return 'food_discovery';
    case 'nightlife':
      return 'nightlife_discovery';
    case 'culture':
      return 'museum_discovery';
    case 'neighborhoods':
      return 'neighborhood_discovery';
    case 'broad':
    case 'sights':
    case 'parks':
    case 'shopping':
    default:
      return 'broad_city_discovery';
  }
}

/**
 * Maps the LLM `discover_places` tool result into the chat discovery payload.
 *
 * This is the single entry point for discovery rendering since the legacy
 * `buildDiscoveryResponsePayload` (regex-driven curation + provider fetch) was
 * removed. The tool result is sourced from the edge function's tool loop and
 * surfaced on `parsedRequest.placeDiscoveryResult`. Returns `null` when the
 * result is unusable (not ok, missing city, no places, or no usable
 * coordinates) so the caller can render a graceful fallback.
 */
export function buildDiscoveryResponseFromToolResult(options: {
  message: string;
  placeDiscoveryResult: ParsedTravelRequest['placeDiscoveryResult'];
}): {
  text: string;
  discoveryContext: DiscoveryContext | null;
  recommendedPlaces: ChatRecommendedPlace[];
} | null {
  const result = options.placeDiscoveryResult;
  const destination = result?.destination;
  const rawPlaces = Array.isArray(result?.places) ? result.places : [];
  if (!result?.ok || !destination?.city || rawPlaces.length === 0) return null;

  const lat = Number(destination.lat);
  const lng = Number(destination.lng);
  const places: ChatRecommendedPlace[] = rawPlaces
    .map((place): ChatRecommendedPlace | null => {
      if (!place?.name) return null;
      return {
        placeId: place.placeId,
        name: place.name,
        description: place.description || undefined,
        category: place.category || 'activity',
        bucket: bucketFromToolCategory(place.category),
        city: destination.city as string,
        country: destination.country || undefined,
        suggestedSlot: place.category === 'nightlife' ? 'evening' : undefined,
        photoUrl: place.photoUrl || undefined,
        lat: Number.isFinite(Number(place.lat)) ? Number(place.lat) : undefined,
        lng: Number.isFinite(Number(place.lng)) ? Number(place.lng) : undefined,
        source: place.source || undefined,
      };
    })
    .filter(Boolean) as ChatRecommendedPlace[];

  if (!places.length) return null;

  const firstPlaceWithCoords = places.find((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng));
  const coordsSource = Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng }
    : {
        lat: firstPlaceWithCoords?.lat,
        lng: firstPlaceWithCoords?.lng,
      };

  if (!Number.isFinite(coordsSource.lat) || !Number.isFinite(coordsSource.lng)) return null;

  const discoveryContext: DiscoveryContext = {
    destination: {
      city: destination.city,
      country: destination.country || undefined,
      lat: coordsSource.lat as number,
      lng: coordsSource.lng as number,
      bbox: buildApproximateBbox(coordsSource.lat as number, coordsSource.lng as number),
      placeLabel: destination.country ? `${destination.city}, ${destination.country}` : destination.city,
      confidence: 0.94,
      source: 'parsed_request',
    },
    queryType: queryTypeFromDiscoveryIntent(result.intent),
    places,
  };

  return {
    text: formatDiscoveryResponse({
      city: destination.city,
      requestText: options.message,
      places,
    }),
    discoveryContext,
    recommendedPlaces: places,
  };
}
