import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { MessageRow } from '../types/chat';
import type { ChatRecommendedPlace } from './conversationOrchestrator';
import { formatDiscoveryResponse } from './conversationOrchestrator';
import type { PlannerPlaceCandidate, PlannerPlaceCategory, TripPlannerState } from '@/features/trip-planner/types';

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
  queryType: 'broad' | 'museums' | 'food' | 'nightlife' | 'neighborhoods';
  places: ChatRecommendedPlace[];
}

function normalizeText(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreBasePlace(place: PlannerPlaceCandidate): number {
  const popularityScore = (place.rating || 0) * 18 + Math.log10((place.userRatingsTotal || 0) + 1) * 22;
  const categoryBonus = place.category === 'museum'
    ? 18
    : place.category === 'sights'
      ? 16
      : place.category === 'culture'
        ? 14
        : place.category === 'activity'
          ? 12
          : place.category === 'parks'
            ? 12
            : place.category === 'restaurant' || place.category === 'cafe'
              ? 8
              : 4;
  return popularityScore + categoryBonus;
}

function dedupePlaces(candidates: PlannerPlaceCandidate[]): PlannerPlaceCandidate[] {
  const unique = new Map<string, PlannerPlaceCandidate>();

  candidates.forEach((candidate) => {
    const key = `${candidate.placeId || ''}::${normalizeText(candidate.name)}`;
    const current = unique.get(key);
    if (!current || scoreBasePlace(candidate) > scoreBasePlace(current)) {
      unique.set(key, candidate);
    }
  });

  return Array.from(unique.values());
}

function titleCase(value?: string | null): string {
  if (!value) return '';
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const DISCOVERY_PATTERN = /\b(cosas\s+para\s+hacer|que\s+ver|qué\s+ver|que\s+hacer|qué\s+hacer|imperdibles?|museos?|barrios?|restaurantes?|actividades?)\b/i;
const MUSEUM_PATTERN = /\b(museos?|arte|galerias?|galerías|impresionismo|cultura|historia)\b/i;
const FOOD_PATTERN = /\b(restaurantes?|gastronomia|gastronomía|comida|cena|tapas|cafes?|cafés)\b/i;
const NIGHT_PATTERN = /\b(noche|bares?|cocktails?|boliches?|vida nocturna)\b/i;
const NEIGHBORHOOD_PATTERN = /\b(barrios?|zonas?|donde caminar|dónde caminar|para caminar|pasear)\b/i;
const NOISE_RE = /\b(cinema|cine|movie theater|movie_theater|parking|mall|shopping mall|shopping_mall|supermarket|convenience store|convenience_store|train station|train_station|bus station|bus_station|airport|hostel|hotel)\b/i;
const CHAIN_RE = /\b(mcdonald'?s|burger king|kfc|subway|starbucks|pizza hut|domino'?s|hard rock|taco bell)\b/i;
const ARTWORK_RE = /\b(guernica|mona lisa|las meninas|by pablo picasso|obra|collection room|sala )\b/i;

function getQueryType(requestText: string): DiscoveryContext['queryType'] {
  if (FOOD_PATTERN.test(requestText)) return 'food';
  if (NIGHT_PATTERN.test(requestText)) return 'nightlife';
  if (NEIGHBORHOOD_PATTERN.test(requestText)) return 'neighborhoods';
  if (MUSEUM_PATTERN.test(requestText)) return 'museums';
  return 'broad';
}

function getRequestedCategories(queryType: DiscoveryContext['queryType']): PlannerPlaceCategory[] {
  switch (queryType) {
    case 'museums':
      return ['museum', 'culture', 'sights', 'parks', 'activity'];
    case 'food':
      return ['restaurant', 'cafe', 'sights', 'activity', 'nightlife'];
    case 'nightlife':
      return ['nightlife', 'restaurant', 'cafe', 'activity', 'sights'];
    case 'neighborhoods':
      return ['sights', 'activity', 'parks', 'culture', 'cafe'];
    case 'broad':
    default:
      return ['sights', 'museum', 'culture', 'activity', 'parks', 'cafe'];
  }
}

function getPlannerDestination(plannerState?: TripPlannerState | null): string | undefined {
  if (!plannerState) return undefined;
  if (plannerState.destinations?.length) return plannerState.destinations[0];
  if (plannerState.segments?.length) return plannerState.segments[0].city;
  return undefined;
}

function getParsedDestination(parsedRequest?: ParsedTravelRequest | null): string | undefined {
  if (!parsedRequest) return undefined;
  if (parsedRequest.itinerary?.destinations?.length) return parsedRequest.itinerary.destinations[0];
  if (parsedRequest.hotels?.city) return parsedRequest.hotels.city;
  if (parsedRequest.flights?.destination) return parsedRequest.flights.destination;
  if (parsedRequest.packages?.destination) return parsedRequest.packages.destination;
  return undefined;
}

function getMessageDestination(message: string): string | undefined {
  const match = message.match(/\b(?:en|de|para)\s+([a-zA-ZÀ-ÿ'\-\s]{3,})$/i);
  return match?.[1]?.trim();
}

function getLastDiscoveryDestination(messages: MessageRow[]): string | undefined {
  const lastDiscovery = [...messages].reverse().find((message) => {
    const meta = message.meta as Record<string, unknown> | null;
    return Boolean(meta && (meta as any).discoveryContext?.destination?.city);
  });
  return ((lastDiscovery?.meta as any)?.discoveryContext?.destination?.city as string | undefined) || undefined;
}

function buildApproximateBbox(lat: number, lng: number): [number, number, number, number] {
  const latDelta = 0.12;
  const lngDelta = 0.18;
  return [lng - lngDelta, lat - latDelta, lng + lngDelta, lat + latDelta];
}

export async function resolveDiscoveryDestination(options: {
  message: string;
  parsedRequest: ParsedTravelRequest;
  plannerState?: TripPlannerState | null;
  conversationHistory: MessageRow[];
}): Promise<DiscoveryDestination | null> {
  const { message, parsedRequest, plannerState, conversationHistory } = options;
  const { resolvePlannerSegmentLocation } = await import('@/features/trip-planner/services/plannerGeocoding');

  const candidates: Array<{ city?: string; confidence: number; source: DiscoveryDestination['source'] }> = [
    { city: getParsedDestination(parsedRequest), confidence: 0.96, source: 'parsed_request' },
    { city: getPlannerDestination(plannerState), confidence: 0.74, source: 'planner_state' },
    { city: getLastDiscoveryDestination(conversationHistory), confidence: 0.62, source: 'conversation_history' },
    { city: getMessageDestination(message), confidence: 0.58, source: 'message_heuristic' },
  ];

  for (const candidate of candidates) {
    if (!candidate.city) continue;
    const location = await resolvePlannerSegmentLocation({ city: candidate.city });
    if (!location) continue;
    return {
      city: location.city,
      country: location.country,
      lat: location.lat,
      lng: location.lng,
      placeLabel: location.placeLabel,
      bbox: buildApproximateBbox(location.lat, location.lng),
      confidence: candidate.confidence,
      source: candidate.source,
    };
  }

  return null;
}

function getDiscoveryBucket(place: PlannerPlaceCandidate): ChatRecommendedPlace['bucket'] {
  const normalized = normalizeText(`${place.name} ${(place.types || []).join(' ')} ${place.category} ${place.activityType || ''}`);
  if (place.category === 'museum') return 'museos';
  if (place.category === 'nightlife') return 'noche';
  if (place.category === 'restaurant' || place.category === 'cafe') return 'gastronomia';
  if (place.category === 'parks') return /mirador|viewpoint|observation|lookout/.test(normalized) ? 'miradores' : 'parques';
  if (/barrio|district|quarter|old town|centro historico|centre historique|neighborhood|neighbourhood/.test(normalized)) return 'barrios';
  if (/cathedral|catedral|basilica|basílica|church|temple|templo|foro|roman|historic|castle|palace|palacio/.test(normalized)) return 'historia';
  if (/tower|torre|bridge|puente|square|plaza|monument|landmark|gate|puerta/.test(normalized) || place.category === 'sights') return 'imperdibles';
  return 'imperdibles';
}

function getDedupKey(place: PlannerPlaceCandidate): string {
  const normalized = normalizeText(place.name)
    .replace(/\b(museum|museo|musee|museums|square|plaza|park|parque|palace|palacio|church|cathedral|basilica|district|quarter|bairro|barrio|de|del|la|le|el|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (ARTWORK_RE.test(normalized)) {
    return normalized.split(' ').slice(-2).join(' ');
  }
  return normalized;
}

function scoreIntentFit(place: PlannerPlaceCandidate, queryType: DiscoveryContext['queryType']): number {
  const bucket = getDiscoveryBucket(place);
  switch (queryType) {
    case 'museums':
      return bucket === 'museos' ? 38 : bucket === 'historia' ? 20 : 8;
    case 'food':
      return bucket === 'gastronomia' ? 40 : bucket === 'barrios' ? 18 : 6;
    case 'nightlife':
      return bucket === 'noche' ? 40 : bucket === 'gastronomia' ? 18 : 6;
    case 'neighborhoods':
      return bucket === 'barrios' ? 38 : bucket === 'imperdibles' ? 18 : 8;
    case 'broad':
    default:
      return bucket === 'imperdibles'
        ? 34
        : bucket === 'historia'
          ? 28
          : bucket === 'barrios'
            ? 24
            : bucket === 'parques' || bucket === 'miradores'
              ? 18
              : bucket === 'museos'
                ? 16
                : 4;
  }
}

function scoreCentrality(place: PlannerPlaceCandidate, destination: DiscoveryDestination): number {
  if (typeof place.lat !== 'number' || typeof place.lng !== 'number') return 0;
  const distance = Math.abs(place.lat - destination.lat) + Math.abs(place.lng - destination.lng);
  if (distance < 0.02) return 18;
  if (distance < 0.05) return 12;
  if (distance < 0.09) return 6;
  return 0;
}

function scoreDiscoveryCandidate(place: PlannerPlaceCandidate, destination: DiscoveryDestination, queryType: DiscoveryContext['queryType']): number {
  const representativenessScore = scoreBasePlace(place);
  const popularityScore = (place.rating || 0) * 12 + Math.log10((place.userRatingsTotal || 0) + 1) * 18;
  const categoryIntentFit = scoreIntentFit(place, queryType);
  const visualSignalScore = place.photoUrls?.some(Boolean) ? 8 : 0;
  const centralityScore = scoreCentrality(place, destination);
  const noisePenalty = NOISE_RE.test(`${place.name} ${(place.types || []).join(' ')}`) || CHAIN_RE.test(place.name) ? 120 : 0;
  const artworkPenalty = queryType === 'broad' && ARTWORK_RE.test(place.name) ? 90 : 0;
  return representativenessScore + popularityScore + categoryIntentFit + visualSignalScore + centralityScore - noisePenalty - artworkPenalty;
}

function shouldKeepPlace(place: PlannerPlaceCandidate, queryType: DiscoveryContext['queryType']): boolean {
  const haystack = `${place.name} ${(place.types || []).join(' ')}`;
  if (NOISE_RE.test(haystack) || CHAIN_RE.test(haystack)) return false;
  if (queryType === 'broad' && ARTWORK_RE.test(haystack)) return false;
  return true;
}

function categoryLimitForBucket(bucket: NonNullable<ChatRecommendedPlace['bucket']>, queryType: DiscoveryContext['queryType']): number {
  if (queryType === 'broad') {
    if (bucket === 'museos') return 1;
    if (bucket === 'imperdibles') return 2;
    return 1;
  }
  if (queryType === 'museums') {
    return bucket === 'museos' ? 3 : 1;
  }
  if (queryType === 'food') {
    return bucket === 'gastronomia' ? 3 : 1;
  }
  if (queryType === 'nightlife') {
    return bucket === 'noche' ? 3 : 1;
  }
  if (queryType === 'neighborhoods') {
    return bucket === 'barrios' ? 3 : 1;
  }
  return 2;
}

function toRecommendedPlace(place: PlannerPlaceCandidate, destination: DiscoveryDestination): ChatRecommendedPlace {
  const bucket = getDiscoveryBucket(place);
  return {
    placeId: place.placeId,
    name: place.name,
    description: place.formattedAddress || titleCase(bucket),
    category: titleCase(bucket),
    bucket,
    city: destination.city,
    country: destination.country,
    photoUrl: place.photoUrls?.[0],
    lat: place.lat,
    lng: place.lng,
    source: place.source,
  };
}

export function curateDiscoveryPlaces(options: {
  candidates: PlannerPlaceCandidate[];
  destination: DiscoveryDestination;
  queryType: DiscoveryContext['queryType'];
}): ChatRecommendedPlace[] {
  const ranked = dedupePlaces(options.candidates)
    .filter((place) => shouldKeepPlace(place, options.queryType))
    .sort((left, right) => scoreDiscoveryCandidate(right, options.destination, options.queryType) - scoreDiscoveryCandidate(left, options.destination, options.queryType));

  const selected: ChatRecommendedPlace[] = [];
  const seenKeys = new Set<string>();
  const bucketCounts = new Map<string, number>();

  for (const candidate of ranked) {
    const dedupKey = getDedupKey(candidate);
    if (!dedupKey || seenKeys.has(dedupKey)) continue;

    const mapped = toRecommendedPlace(candidate, options.destination);
    const bucket = mapped.bucket || 'imperdibles';
    const bucketCount = bucketCounts.get(bucket) || 0;
    if (bucketCount >= categoryLimitForBucket(bucket, options.queryType)) continue;

    selected.push(mapped);
    seenKeys.add(dedupKey);
    bucketCounts.set(bucket, bucketCount + 1);
    if (selected.length >= 6) break;
  }

  return selected;
}

async function fetchDiscoveryCandidates(destination: DiscoveryDestination, queryType: DiscoveryContext['queryType']): Promise<PlannerPlaceCandidate[]> {
  const { fetchNearbyPlacesBundle, fetchPlaceRecommendations } = await import('@/features/trip-planner/services/placesService');
  const categories = getRequestedCategories(queryType);
  const [nearbyBundle, recommendedGroups] = await Promise.all([
    fetchNearbyPlacesBundle(null, destination.city, { lat: destination.lat, lng: destination.lng }, categories),
    fetchPlaceRecommendations([destination.city], 8),
  ]);

  const nearbyPlaces = categories.flatMap((category) => nearbyBundle[category] || []);
  const recommendationPlaces = recommendedGroups
    .filter((group) => normalizeText(group.city) === normalizeText(destination.city))
    .flatMap((group) => group.places || []);

  return [...nearbyPlaces, ...recommendationPlaces];
}

export async function buildDiscoveryResponsePayload(options: {
  message: string;
  parsedRequest: ParsedTravelRequest;
  plannerState?: TripPlannerState | null;
  conversationHistory: MessageRow[];
}): Promise<{
  text: string;
  discoveryContext: DiscoveryContext | null;
  recommendedPlaces: ChatRecommendedPlace[];
}> {
  const destination = await resolveDiscoveryDestination({
    message: options.message,
    parsedRequest: options.parsedRequest,
    plannerState: options.plannerState,
    conversationHistory: options.conversationHistory,
  });

  if (!destination) {
    return {
      text: 'Decime qué ciudad querés explorar y te dejo una selección clara de imperdibles, museos y zonas para caminar.',
      discoveryContext: null,
      recommendedPlaces: [],
    };
  }

  const queryType = getQueryType(options.message);
  const candidates = await fetchDiscoveryCandidates(destination, queryType);
  const recommendedPlaces = curateDiscoveryPlaces({
    candidates,
    destination,
    queryType,
  });

  const discoveryContext: DiscoveryContext = {
    destination,
    queryType,
    places: recommendedPlaces,
  };

  return {
    text: formatDiscoveryResponse({
      city: destination.city,
      requestText: options.message,
      places: recommendedPlaces,
    }),
    discoveryContext,
    recommendedPlaces,
  };
}

export function isDiscoveryMessage(message: string): boolean {
  return DISCOVERY_PATTERN.test(message);
}
