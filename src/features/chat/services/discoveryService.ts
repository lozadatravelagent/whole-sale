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
  queryType: 'broad_city_discovery' | 'museum_discovery' | 'food_discovery' | 'nightlife_discovery' | 'neighborhood_discovery';
  places: ChatRecommendedPlace[];
  debug?: DiscoveryDebugPayload;
}

interface DiscoveryDebugPlaceSample {
  id?: string;
  name: string;
  rawCategory?: string;
  reason: string;
}

export interface DiscoveryDebugPayload {
  discoverySubtype: DiscoveryContext['queryType'];
  providerCategories: Record<string, number>;
  fallbackProviderCategories?: Record<string, number>;
  selectedBuckets: Array<NonNullable<ChatRecommendedPlace['bucket']>>;
  selectedPlaceIds: string[];
  candidateCountBeforeFiltering: number;
  candidateCountAfterFiltering: number;
  candidateCountAfterCuration: number;
  fallbackCandidateCountBeforeFiltering?: number;
  fallbackCandidateCountAfterFiltering?: number;
  usedFallbackSelection: boolean;
  destinationResolutionSource: DiscoveryDestination['source'];
  destinationResolutionConfidence: number;
  rejectedByQualityGate: DiscoveryDebugPlaceSample[];
  rejectedByNoiseFilter: DiscoveryDebugPlaceSample[];
  rejectedByDedup: DiscoveryDebugPlaceSample[];
  rejectedBySelectionRules: DiscoveryDebugPlaceSample[];
}

interface DiscoveryDebugCollector {
  payload: DiscoveryDebugPayload;
}

const CURATED_BUCKET_DESCRIPTIONS: Record<NonNullable<ChatRecommendedPlace['bucket']>, string> = {
  imperdibles: 'de los puntos más representativos para una primera visita',
  historia: 'muy buen punto para entender la historia de la ciudad',
  museos: 'de las visitas culturales más fuertes del destino',
  barrios: 'ideal para caminar y absorber el ambiente local',
  miradores: 'gran lugar para tener una buena vista general',
  parques: 'muy buen respiro para pasear y bajar el ritmo',
  gastronomia: 'vale la pena si querés sumar una parada gastronómica',
  noche: 'sirve si querés explorar la ciudad de noche',
};

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

function dedupePlaces(candidates: PlannerPlaceCandidate[], debug?: DiscoveryDebugCollector): PlannerPlaceCandidate[] {
  const unique = new Map<string, PlannerPlaceCandidate>();

  candidates.forEach((candidate) => {
    const key = `${candidate.placeId || ''}::${normalizeText(candidate.name)}`;
    const current = unique.get(key);
    if (!current || scoreBasePlace(candidate) > scoreBasePlace(current)) {
      if (current && debug) {
        pushDebugSample(debug.payload.rejectedByDedup, toDebugSample(current, 'provider_duplicate'));
      }
      unique.set(key, candidate);
      return;
    }

    if (debug) {
      pushDebugSample(debug.payload.rejectedByDedup, toDebugSample(candidate, 'provider_duplicate'));
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

function summarizeProviderCategories(candidates: PlannerPlaceCandidate[]): Record<string, number> {
  return candidates.reduce<Record<string, number>>((accumulator, candidate) => {
    const key = candidate.category || 'unknown';
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

function createDiscoveryDebugPayload(options: {
  queryType: DiscoveryContext['queryType'];
  destination: DiscoveryDestination;
  providerCategories: Record<string, number>;
}): DiscoveryDebugCollector {
  return {
    payload: {
      discoverySubtype: options.queryType,
      providerCategories: options.providerCategories,
      selectedBuckets: [],
      selectedPlaceIds: [],
      candidateCountBeforeFiltering: 0,
      candidateCountAfterFiltering: 0,
      candidateCountAfterCuration: 0,
      usedFallbackSelection: false,
      destinationResolutionSource: options.destination.source,
      destinationResolutionConfidence: options.destination.confidence,
      rejectedByQualityGate: [],
      rejectedByNoiseFilter: [],
      rejectedByDedup: [],
      rejectedBySelectionRules: [],
    },
  };
}

function pushDebugSample(target: DiscoveryDebugPlaceSample[], sample: DiscoveryDebugPlaceSample, limit = 8) {
  if (target.length >= limit) return;
  target.push(sample);
}

function mergeDebugSamples(target: DiscoveryDebugPlaceSample[], samples: DiscoveryDebugPlaceSample[], limit = 8) {
  samples.forEach((sample) => pushDebugSample(target, sample, limit));
}

function toDebugSample(place: PlannerPlaceCandidate, reason: string): DiscoveryDebugPlaceSample {
  return {
    id: place.placeId,
    name: place.name,
    rawCategory: place.category,
    reason,
  };
}

const DISCOVERY_PATTERN = /\b(cosas\s+para\s+hacer|que\s+ver|qué\s+ver|que\s+hacer|qué\s+hacer|imperdibles?|museos?|barrios?|restaurantes?|actividades?)\b/i;
const MUSEUM_PATTERN = /\b(museos?|arte|galerias?|galerías|impresionismo|cultura|historia)\b/i;
const FOOD_PATTERN = /\b(restaurantes?|gastronomia|gastronomía|comida|cena|tapas|cafes?|cafés)\b/i;
const NIGHT_PATTERN = /\b(noche|bares?|cocktails?|boliches?|vida nocturna)\b/i;
const NEIGHBORHOOD_PATTERN = /\b(barrios?|zonas?|donde caminar|dónde caminar|para caminar|pasear)\b/i;
const NOISE_RE = /\b(cinema|cine|movie theater|movie_theater|parking|mall|shopping mall|shopping_mall|supermarket|convenience store|convenience_store|train station|train_station|bus station|bus_station|airport|hostel|hotel)\b/i;
const CHAIN_RE = /\b(mcdonald'?s|burger king|kfc|subway|starbucks|pizza hut|domino'?s|hard rock|taco bell)\b/i;
const ARTWORK_RE = /\b(guernica|mona lisa|las meninas|by pablo picasso|obra|collection room|sala )\b/i;
const BROAD_QUERY_RE = /\b(cosas\s+para\s+hacer|que\s+ver|qué\s+ver|que\s+hacer|qué\s+hacer|imperdibles?)\b/i;
const ATTRACTION_TYPE_RE = /\b(tourist_attraction|museum|art_gallery|church|place_of_worship|historical_landmark|landmark|monument|park|garden|neighborhood|district|plaza|square|bridge|viewpoint|lookout|castle|palace|cathedral|canal|fort|tower|museum|memorial)\b/i;
const ATTRACTION_NAME_RE = /\b(museum|museu|museo|gallery|galeria|canal|gracht|park|parque|garden|bridge|puente|tower|torre|church|cathedral|basilica|palace|palacio|castle|fort|gate|puerta|plaza|square|old town|historic|monastery|mosteiro|monasterio|bairro|barrio|district|quarter|promenade|boulevard|abbey|lookout|viewpoint|mirador|riverfront|waterfront|museumplein|memorial|wall)\b/i;
const COMMERCIAL_RE = /\b(shop|store|outlet|boutique|skate|brand|bar|pub|club|cafe|coffee|restaurant|kitchen|brasserie|bistro|comedy|theater|theatre|venue|hall|casino|arena|stadium|hostel)\b/i;
const BUSINESS_TYPE_RE = /\b(store|shop|clothing_store|shoe_store|bar|night_club|cafe|restaurant|movie_theater|comedy_club|event_venue|bakery|shopping_mall)\b/i;
const WEAK_ADDRESS_RE = /^(sv|cv|df|mx|es|pt|de|fr|nl|uk|us|arg|br|uy)$/i;
const GENERIC_CITY_LABEL_HEAD_RE = /^(mirador|miradouro|viewpoint|lookout|parque|park|museo|museum|museu|catedral|cathedral|church|barrio|bairro|district|plaza|square|puente|bridge|canal|palacio|palace|monumento|monument|torre|tower|centro historico|historic center|old town)\b/i;

export function detectDiscoverySubtype(requestText: string): DiscoveryContext['queryType'] {
  if (FOOD_PATTERN.test(requestText)) return 'food_discovery';
  if (NIGHT_PATTERN.test(requestText)) return 'nightlife_discovery';
  if (NEIGHBORHOOD_PATTERN.test(requestText)) return 'neighborhood_discovery';
  if (MUSEUM_PATTERN.test(requestText) && !BROAD_QUERY_RE.test(requestText)) return 'museum_discovery';
  return 'broad_city_discovery';
}

function getRequestedCategories(queryType: DiscoveryContext['queryType']): PlannerPlaceCategory[] {
  switch (queryType) {
    case 'museum_discovery':
      return ['museum', 'culture', 'sights', 'parks', 'activity'];
    case 'food_discovery':
      return ['restaurant', 'cafe', 'sights', 'activity', 'nightlife'];
    case 'nightlife_discovery':
      return ['nightlife', 'restaurant', 'cafe', 'activity', 'sights'];
    case 'neighborhood_discovery':
      return ['sights', 'activity', 'parks', 'culture', 'cafe'];
    case 'broad_city_discovery':
    default:
      return ['sights', 'museum', 'culture', 'parks', 'activity'];
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
  if (place.category === 'museum' || /museum|museo|museu|gallery|galeria/.test(normalized)) return 'museos';
  if (place.category === 'parks') return /mirador|viewpoint|observation|lookout/.test(normalized) ? 'miradores' : 'parques';
  if (/barrio|district|quarter|old town|centro historico|centre historique|neighborhood|neighbourhood|jordaan|alfama/.test(normalized)) return 'barrios';
  if (/canal|gracht|riverfront|waterfront|promenade|boulevard|park|parque|garden/.test(normalized)) return 'parques';
  if (/mirador|viewpoint|lookout|observatory/.test(normalized)) return 'miradores';
  if (/cathedral|catedral|basilica|basílica|church|temple|templo|foro|roman|historic|castle|palace|palacio|monastery|mosteiro|memorial|reichstag/.test(normalized)) return 'historia';
  if (/tower|torre|bridge|puente|square|plaza|monument|landmark|gate|puerta|museumplein|dam/.test(normalized) || place.category === 'sights' || place.category === 'culture') return 'imperdibles';
  if (place.category === 'restaurant' || place.category === 'cafe') return 'gastronomia';
  if (place.category === 'nightlife') return 'noche';
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

export function isAttractionLikePlace(place: PlannerPlaceCandidate): boolean {
  const haystack = `${place.name} ${(place.types || []).join(' ')} ${place.category}`;
  if (NOISE_RE.test(haystack) || CHAIN_RE.test(haystack)) return false;
  if (BUSINESS_TYPE_RE.test(haystack) || COMMERCIAL_RE.test(haystack)) return false;
  if (place.category === 'museum' || place.category === 'sights' || place.category === 'culture' || place.category === 'parks') return true;
  return ATTRACTION_TYPE_RE.test(haystack) || ATTRACTION_NAME_RE.test(haystack);
}

function isWeakFormattedAddress(value?: string): boolean {
  const normalized = normalizeText(value);
  if (!normalized) return true;
  if (normalized.length <= 3) return true;
  return WEAK_ADDRESS_RE.test(normalized.replace(/\s+/g, ''));
}

function isGenericCityLabel(place: PlannerPlaceCandidate, destination: DiscoveryDestination): boolean {
  const normalizedName = normalizeText(place.name);
  const normalizedCity = normalizeText(destination.city);
  if (!normalizedName || !normalizedCity) return false;
  const compactCity = normalizedCity.replace(/\s+/g, '');
  const compactName = normalizedName.replace(/\s+/g, '');
  if (!GENERIC_CITY_LABEL_HEAD_RE.test(normalizedName)) return false;
  return compactName.includes(compactCity);
}

function getPlaceIdentityIssue(place: PlannerPlaceCandidate, destination: DiscoveryDestination): string | null {
  const normalizedName = normalizeText(place.name);
  if (!normalizedName) return 'missing_name';
  if (normalizedName.length < 4) return 'short_name';
  if (/^[a-z]{1,3}$/.test(normalizedName.replace(/\s+/g, ''))) return 'placeholder_name';
  if (isGenericCityLabel(place, destination)) return 'generic_city_label';
  if (ARTWORK_RE.test(normalizedName)) return 'artwork_only';

  const tokenCount = normalizedName.split(' ').filter(Boolean).length;
  const typeSignal = ATTRACTION_TYPE_RE.test(`${(place.types || []).join(' ')} ${place.category}`);
  const nameSignal = ATTRACTION_NAME_RE.test(normalizedName);
  const metadataSignal = (place.userRatingsTotal || 0) >= 50 || Boolean(place.photoUrls?.length) || Boolean(place.rating && place.rating >= 4.2);

  if (tokenCount === 1 && !nameSignal && !typeSignal) return 'weak_name_identity';
  if (!typeSignal && !nameSignal && !metadataSignal) return 'poor_metadata';

  return null;
}

export function hasStrongPlaceIdentity(place: PlannerPlaceCandidate, destination: DiscoveryDestination): boolean {
  return getPlaceIdentityIssue(place, destination) === null;
}

function scoreIntentFit(place: PlannerPlaceCandidate, queryType: DiscoveryContext['queryType']): number {
  const bucket = getDiscoveryBucket(place);
  switch (queryType) {
    case 'museum_discovery':
      return bucket === 'museos' ? 38 : bucket === 'historia' ? 20 : 8;
    case 'food_discovery':
      return bucket === 'gastronomia' ? 40 : bucket === 'barrios' ? 18 : 6;
    case 'nightlife_discovery':
      return bucket === 'noche' ? 40 : bucket === 'gastronomia' ? 18 : 6;
    case 'neighborhood_discovery':
      return bucket === 'barrios' ? 38 : bucket === 'imperdibles' ? 18 : 8;
    case 'broad_city_discovery':
    default:
      return bucket === 'imperdibles'
        ? 42
        : bucket === 'historia'
          ? 36
          : bucket === 'barrios'
            ? 30
            : bucket === 'parques' || bucket === 'miradores'
              ? 28
              : bucket === 'museos'
                ? 20
                : bucket === 'gastronomia' || bucket === 'noche'
                  ? -40
                  : 2;
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
  const artworkPenalty = queryType === 'broad_city_discovery' && ARTWORK_RE.test(place.name) ? 90 : 0;
  const attractionBonus = queryType === 'broad_city_discovery' && isAttractionLikePlace(place) ? 36 : 0;
  const nightlifePenalty = queryType === 'broad_city_discovery' && getDiscoveryBucket(place) === 'noche' ? 80 : 0;
  const identityPenalty = queryType === 'broad_city_discovery' && !hasStrongPlaceIdentity(place, destination) ? 140 : 0;
  return representativenessScore + popularityScore + categoryIntentFit + visualSignalScore + centralityScore + attractionBonus - noisePenalty - artworkPenalty - nightlifePenalty - identityPenalty;
}

function getNoiseFilterReason(place: PlannerPlaceCandidate): string | null {
  const haystack = `${place.name} ${(place.types || []).join(' ')}`;
  if (CHAIN_RE.test(haystack)) return 'chain_brand';
  if (NOISE_RE.test(haystack)) return 'noise_filter';
  if (BUSINESS_TYPE_RE.test(haystack) || COMMERCIAL_RE.test(haystack)) return 'commercial_venue';
  return null;
}

function getQualityGateReason(place: PlannerPlaceCandidate, queryType: DiscoveryContext['queryType'], destination: DiscoveryDestination): string | null {
  const haystack = `${place.name} ${(place.types || []).join(' ')}`;

  if (queryType === 'broad_city_discovery' && ARTWORK_RE.test(haystack)) return 'artwork_only';
  if (queryType === 'broad_city_discovery' && !isAttractionLikePlace(place)) return 'not_attraction_like';

  const bucket = getDiscoveryBucket(place);
  if (queryType === 'broad_city_discovery' && (bucket === 'noche' || bucket === 'gastronomia')) {
    return 'excluded_bucket';
  }

  if (queryType === 'broad_city_discovery') {
    return getPlaceIdentityIssue(place, destination);
  }

  return null;
}

function categoryLimitForBucket(bucket: NonNullable<ChatRecommendedPlace['bucket']>, queryType: DiscoveryContext['queryType']): number {
  if (queryType === 'broad_city_discovery') {
    if (bucket === 'museos') return 1;
    if (bucket === 'imperdibles' || bucket === 'historia') return 2;
    if (bucket === 'barrios' || bucket === 'parques' || bucket === 'miradores') return 1;
    if (bucket === 'gastronomia' || bucket === 'noche') return 0;
    return 1;
  }
  if (queryType === 'museum_discovery') {
    return bucket === 'museos' ? 3 : 1;
  }
  if (queryType === 'food_discovery') {
    return bucket === 'gastronomia' ? 3 : 1;
  }
  if (queryType === 'nightlife_discovery') {
    return bucket === 'noche' ? 3 : 1;
  }
  if (queryType === 'neighborhood_discovery') {
    return bucket === 'barrios' ? 3 : 1;
  }
  return 2;
}

function buildCuratedDescription(place: PlannerPlaceCandidate, bucket: NonNullable<ChatRecommendedPlace['bucket']>): string {
  if (!isWeakFormattedAddress(place.formattedAddress)) {
    return place.formattedAddress as string;
  }
  return CURATED_BUCKET_DESCRIPTIONS[bucket];
}

function toRecommendedPlace(place: PlannerPlaceCandidate, destination: DiscoveryDestination): ChatRecommendedPlace {
  const bucket = getDiscoveryBucket(place);
  return {
    placeId: place.placeId,
    name: place.name,
    description: buildCuratedDescription(place, bucket || 'imperdibles'),
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
  debug?: DiscoveryDebugCollector;
}): ChatRecommendedPlace[] {
  const debug = options.debug;
  if (debug) {
    debug.payload.candidateCountBeforeFiltering = options.candidates.length;
  }

  const deduped = dedupePlaces(options.candidates, debug);
  const filtered = deduped.filter((place) => {
    const noiseReason = getNoiseFilterReason(place);
    if (noiseReason) {
      if (debug) pushDebugSample(debug.payload.rejectedByNoiseFilter, toDebugSample(place, noiseReason));
      return false;
    }

    const qualityReason = getQualityGateReason(place, options.queryType, options.destination);
    if (qualityReason) {
      if (debug) pushDebugSample(debug.payload.rejectedByQualityGate, toDebugSample(place, qualityReason));
      return false;
    }

    return true;
  });

  if (debug) {
    debug.payload.candidateCountAfterFiltering = filtered.length;
  }

  const ranked = filtered
    .sort((left, right) => scoreDiscoveryCandidate(right, options.destination, options.queryType) - scoreDiscoveryCandidate(left, options.destination, options.queryType));

  const conservativeRanked = options.queryType === 'broad_city_discovery'
    ? ranked.filter((candidate) => {
        const bucket = getDiscoveryBucket(candidate);
        return hasStrongPlaceIdentity(candidate, options.destination)
          && ['imperdibles', 'historia', 'museos', 'barrios', 'parques', 'miradores'].includes(bucket || 'imperdibles')
          && isAttractionLikePlace(candidate);
      })
    : ranked;

  const selected: ChatRecommendedPlace[] = [];
  const seenKeys = new Set<string>();
  const bucketCounts = new Map<string, number>();

  const tryAddCandidate = (candidate: PlannerPlaceCandidate) => {
    const dedupKey = getDedupKey(candidate);
    if (!dedupKey) {
      if (debug) pushDebugSample(debug.payload.rejectedByQualityGate, toDebugSample(candidate, 'invalid_identity_key'));
      return false;
    }
    if (seenKeys.has(dedupKey)) {
      if (debug) pushDebugSample(debug.payload.rejectedByDedup, toDebugSample(candidate, 'semantic_duplicate'));
      return false;
    }

    const mapped = toRecommendedPlace(candidate, options.destination);
    const bucket = mapped.bucket || 'imperdibles';
    const bucketCount = bucketCounts.get(bucket) || 0;
    if (bucketCount >= categoryLimitForBucket(bucket, options.queryType)) {
      if (debug) pushDebugSample(debug.payload.rejectedBySelectionRules, toDebugSample(candidate, `bucket_limit:${bucket}`));
      return false;
    }

    selected.push(mapped);
    seenKeys.add(dedupKey);
    bucketCounts.set(bucket, bucketCount + 1);
    return true;
  };

  if (options.queryType === 'broad_city_discovery') {
    const broadRequirements: Array<Array<NonNullable<ChatRecommendedPlace['bucket']>>> = [
      ['imperdibles', 'historia'],
      ['imperdibles', 'historia'],
      ['barrios'],
      ['parques', 'miradores'],
      ['museos'],
    ];

    broadRequirements.forEach((acceptedBuckets) => {
      const match = conservativeRanked.find((candidate) => {
        const bucket = getDiscoveryBucket(candidate) || 'imperdibles';
        const dedupKey = getDedupKey(candidate);
        return acceptedBuckets.includes(bucket)
          && Boolean(dedupKey)
          && !seenKeys.has(dedupKey)
          && (bucketCounts.get(bucket) || 0) < categoryLimitForBucket(bucket, options.queryType);
      });
      if (match) tryAddCandidate(match);
    });
  }

  for (const candidate of ranked) {
    tryAddCandidate(candidate);
    if (selected.length >= 6) break;
  }

  if (options.queryType === 'broad_city_discovery' && selected.length < 4) {
    if (debug) {
      debug.payload.usedFallbackSelection = true;
      debug.payload.rejectedBySelectionRules = [];
    }
    selected.length = 0;
    seenKeys.clear();
    bucketCounts.clear();

    const conservativeRequirements: Array<Array<NonNullable<ChatRecommendedPlace['bucket']>>> = [
      ['imperdibles', 'historia'],
      ['imperdibles', 'historia'],
      ['barrios'],
      ['parques', 'miradores'],
      ['museos'],
    ];

    conservativeRequirements.forEach((acceptedBuckets) => {
      const match = conservativeRanked.find((candidate) => {
        const bucket = getDiscoveryBucket(candidate) || 'imperdibles';
        const dedupKey = getDedupKey(candidate);
        return acceptedBuckets.includes(bucket)
          && Boolean(dedupKey)
          && !seenKeys.has(dedupKey)
          && (bucketCounts.get(bucket) || 0) < categoryLimitForBucket(bucket, options.queryType);
      });
      if (match) tryAddCandidate(match);
    });

    for (const candidate of conservativeRanked) {
      tryAddCandidate(candidate);
      if (selected.length >= 6) break;
    }
  }

  if (debug) {
    debug.payload.candidateCountAfterCuration = selected.length;
    debug.payload.selectedBuckets = selected.map((place) => place.bucket || 'imperdibles');
    debug.payload.selectedPlaceIds = selected.map((place) => place.placeId || place.name).slice(0, 6);
  }

  return selected;
}

async function fetchDiscoveryCandidates(destination: DiscoveryDestination, queryType: DiscoveryContext['queryType']): Promise<PlannerPlaceCandidate[]> {
  const { fetchNearbyPlacesBundle, fetchPlaceRecommendations } = await import('@/features/trip-planner/services/placesService');
  const categories = getRequestedCategories(queryType);
  const [nearbyBundle, recommendedGroups] = await Promise.all([
    fetchNearbyPlacesBundle(destination.city, { lat: destination.lat, lng: destination.lng }, categories)
      .catch(() => ({}) as Record<string, PlannerPlaceCandidate[]>),
    fetchPlaceRecommendations([destination.city], 8),
  ]);

  const nearbyPlaces = categories.flatMap((category) => nearbyBundle[category] || []);
  const recommendationPlaces = recommendedGroups
    .filter((group) => normalizeText(group.city) === normalizeText(destination.city))
    .flatMap((group) => group.places || []);

  return [...nearbyPlaces, ...recommendationPlaces];
}

async function fetchConservativeBroadCandidates(destination: DiscoveryDestination): Promise<PlannerPlaceCandidate[]> {
  const { fetchNearbyPlacesBundle, fetchPlaceRecommendations } = await import('@/features/trip-planner/services/placesService');
  const strictCategories: PlannerPlaceCategory[] = ['sights', 'museum', 'culture', 'parks'];
  const [nearbyBundle, recommendedGroups] = await Promise.all([
    fetchNearbyPlacesBundle(destination.city, { lat: destination.lat, lng: destination.lng }, strictCategories)
      .catch(() => ({}) as Record<string, PlannerPlaceCandidate[]>),
    fetchPlaceRecommendations([destination.city], 12),
  ]);

  const nearbyPlaces = strictCategories.flatMap((category) => nearbyBundle[category] || []);
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

  const queryType = detectDiscoverySubtype(options.message);
  const candidates = await fetchDiscoveryCandidates(destination, queryType);
  const debug = createDiscoveryDebugPayload({
    queryType,
    destination,
    providerCategories: summarizeProviderCategories(candidates),
  });

  let recommendedPlaces = curateDiscoveryPlaces({
    candidates,
    destination,
    queryType,
    debug,
  });

  if (queryType === 'broad_city_discovery' && recommendedPlaces.length < 4) {
    const conservativeCandidates = await fetchConservativeBroadCandidates(destination);
    const fallbackDebug = createDiscoveryDebugPayload({
      queryType,
      destination,
      providerCategories: summarizeProviderCategories(conservativeCandidates),
    });
    recommendedPlaces = curateDiscoveryPlaces({
      candidates: conservativeCandidates,
      destination,
      queryType,
      debug: fallbackDebug,
    });

    debug.payload.usedFallbackSelection = true;
    debug.payload.fallbackProviderCategories = fallbackDebug.payload.providerCategories;
    debug.payload.fallbackCandidateCountBeforeFiltering = fallbackDebug.payload.candidateCountBeforeFiltering;
    debug.payload.fallbackCandidateCountAfterFiltering = fallbackDebug.payload.candidateCountAfterFiltering;
    debug.payload.candidateCountAfterCuration = fallbackDebug.payload.candidateCountAfterCuration;
    debug.payload.selectedBuckets = fallbackDebug.payload.selectedBuckets;
    debug.payload.selectedPlaceIds = fallbackDebug.payload.selectedPlaceIds;
    mergeDebugSamples(debug.payload.rejectedByQualityGate, fallbackDebug.payload.rejectedByQualityGate);
    mergeDebugSamples(debug.payload.rejectedByNoiseFilter, fallbackDebug.payload.rejectedByNoiseFilter);
    mergeDebugSamples(debug.payload.rejectedByDedup, fallbackDebug.payload.rejectedByDedup);
    mergeDebugSamples(debug.payload.rejectedBySelectionRules, fallbackDebug.payload.rejectedBySelectionRules);
  }

  const discoveryContext: DiscoveryContext = {
    destination,
    queryType,
    places: recommendedPlaces,
    debug: debug.payload,
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
