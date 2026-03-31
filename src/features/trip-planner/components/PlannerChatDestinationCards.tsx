import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Plus, Star } from 'lucide-react';
import { formatDestinationLabel } from '../utils';
import type { PlannerActivity, PlannerPlaceCandidate, PlannerRestaurant, PlannerSegment } from '../types';
import { inferPlannerPlaceCategory, pickCanonicalPlannerPlaceCategory } from '../services/plannerPlaceMapper';
import { fetchPlaceDetails, fetchPlaceRecommendations } from '../services/placesService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlaceHighlight {
  placeId: string;
  name: string;
  photo?: string;
  rating?: number;
  userRatingsTotal?: number;
  vicinity?: string;
}

interface DestinationHighlight {
  city: string;
  places: PlaceHighlight[];
}

interface HighlightGroup {
  segmentId: string;
  city: string;
  places: PlannerPlaceCandidate[];
}

// Module-level cache so we never re-fetch the same city
const cityHighlightsCache = new Map<string, PlaceHighlight[]>();
const PRIMARY_HIGHLIGHT_CATEGORIES = new Set<PlannerPlaceCandidate['category']>(['museum', 'sights', 'culture', 'activity', 'parks']);
const TRUSTED_PHOTO_CATEGORIES = new Set<PlannerPlaceCandidate['category']>(['museum', 'sights', 'culture', 'activity', 'parks', 'restaurant', 'cafe']);
const CHAIN_NAME_PATTERN = /\b(wendy'?s|mcdonald'?s|burger king|kfc|subway|starbucks|pizza hut|domino'?s|hard rock|taco bell)\b/i;

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function buildSyntheticPlaceId(prefix: string, name: string, city: string): string {
  return `${prefix}-${normalizeKey(`${name} ${city}`).replace(/[^a-z0-9]+/g, '-')}`;
}

function mapCandidateToHighlight(place: PlannerPlaceCandidate): PlaceHighlight {
  return {
    placeId: place.placeId,
    name: place.name,
    photo: place.photoUrls?.[0],
    rating: place.rating,
    userRatingsTotal: place.userRatingsTotal,
    vicinity: place.formattedAddress,
  };
}

function getCategoryScore(category: PlannerPlaceCandidate['category']): number {
  switch (category) {
    case 'museum':
    case 'sights':
    case 'culture':
      return 220_000;
    case 'activity':
    case 'parks':
      return 180_000;
    case 'nightlife':
      return 45_000;
    case 'shopping':
      return 30_000;
    case 'restaurant':
      return 20_000;
    case 'cafe':
      return 15_000;
    default:
      return 0;
  }
}

function getMergeScore(place: Pick<PlannerPlaceCandidate, 'name' | 'category' | 'photoUrls' | 'rating' | 'userRatingsTotal' | 'types'>): number {
  const hasPhoto = place.photoUrls?.some(Boolean) ? 1_000_000 : 0;
  const rating = (place.rating || 0) * 10_000;
  const ratingsVolume = place.userRatingsTotal || 0;
  const category = getCategoryScore(place.category);
  const chainPenalty = CHAIN_NAME_PATTERN.test(place.name) || place.types?.some((type) => /fast food|burger|fried chicken|sandwich/i.test(type))
    ? 900_000
    : 0;

  return hasPhoto + rating + ratingsVolume + category - chainPenalty;
}

function isSyntheticPlaceId(placeId?: string): boolean {
  return /^(activity|restaurant)-/i.test(placeId || '');
}

function hasTrustedPhotoSource(place: PlannerPlaceCandidate): boolean {
  return (place.source === 'foursquare' || place.source === 'google_maps')
    && Boolean(place.placeId)
    && !isSyntheticPlaceId(place.placeId)
    && Boolean(place.photoUrls?.[0]);
}

function getHighlightScore(place: Pick<PlannerPlaceCandidate, 'name' | 'category' | 'photoUrls' | 'rating' | 'userRatingsTotal' | 'types' | 'placeId' | 'source'>): number {
  const category = getCategoryScore(place.category) * 8;
  const trustedPhotoBonus = hasTrustedPhotoSource(place as PlannerPlaceCandidate) ? 250_000 : 0;
  const rating = (place.rating || 0) * 20_000;
  const ratingsVolume = Math.min(place.userRatingsTotal || 0, 5000);
  const chainPenalty = CHAIN_NAME_PATTERN.test(place.name) || place.types?.some((type) => /fast food|burger|fried chicken|sandwich/i.test(type))
    ? 1_500_000
    : 0;
  const lowIntentPenalty = PRIMARY_HIGHLIGHT_CATEGORIES.has(place.category) ? 0 : 350_000;

  return category + trustedPhotoBonus + rating + ratingsVolume - chainPenalty - lowIntentPenalty;
}

function shouldUseCardPhoto(place: PlannerPlaceCandidate): boolean {
  return TRUSTED_PHOTO_CATEGORIES.has(place.category) && hasTrustedPhotoSource(place);
}

function selectTopHighlights(places: PlannerPlaceCandidate[], limit = 4): PlannerPlaceCandidate[] {
  const ranked = places
    .filter((place) => place.category !== 'hotel')
    .sort((left, right) => getHighlightScore(right) - getHighlightScore(left));

  const preferred = ranked.filter((place) => PRIMARY_HIGHLIGHT_CATEGORIES.has(place.category)).slice(0, limit);
  if (preferred.length >= limit) {
    return preferred;
  }

  const preferredIds = new Set(preferred.map((place) => place.placeId));
  const fallback = ranked
    .filter((place) => !preferredIds.has(place.placeId))
    .slice(0, limit - preferred.length);

  return [...preferred, ...fallback];
}

function mergePlaceCandidate(current: PlannerPlaceCandidate | undefined, next: PlannerPlaceCandidate): PlannerPlaceCandidate {
  if (!current) return next;

  const preferred = getMergeScore(next) >= getMergeScore(current) ? next : current;
  const fallback = preferred === next ? current : next;

  return {
    ...fallback,
    ...preferred,
    formattedAddress: preferred.formattedAddress || fallback.formattedAddress,
    rating: preferred.rating ?? fallback.rating,
    userRatingsTotal: preferred.userRatingsTotal ?? fallback.userRatingsTotal,
    photoUrls: preferred.photoUrls?.length ? preferred.photoUrls : fallback.photoUrls,
    category: pickCanonicalPlannerPlaceCategory([current.category, next.category]),
    activityType: preferred.activityType ?? fallback.activityType,
    source: preferred.source ?? fallback.source,
  };
}

function mapActivityToPlaceCandidate(activity: PlannerActivity, city: string): PlannerPlaceCandidate | null {
  if ((activity.activityType === 'hotel' || activity.activityType === 'transport') && !activity.placeId && !(activity.photoUrls?.length)) {
    return null;
  }

  if (!activity.placeId && !(activity.photoUrls?.length)) {
    return null;
  }

  return {
    placeId: activity.placeId || buildSyntheticPlaceId('activity', activity.title, city),
    name: activity.title,
    formattedAddress: activity.formattedAddress || activity.neighborhood,
    rating: activity.rating,
    userRatingsTotal: activity.userRatingsTotal,
    photoUrls: activity.source === 'foursquare' || activity.source === 'google_maps' ? (activity.photoUrls || []) : [],
    category: inferPlannerPlaceCategory(undefined, `${activity.category || ''} ${activity.title}`),
    activityType: activity.activityType,
    source: activity.source === 'foursquare'
      ? 'foursquare'
      : activity.source === 'google_maps'
        ? 'google_maps'
        : undefined,
  };
}

function mapRestaurantToPlaceCandidate(restaurant: PlannerRestaurant, city: string): PlannerPlaceCandidate | null {
  if (!restaurant.placeId && !(restaurant.photoUrls?.length)) {
    return null;
  }

  return {
    placeId: restaurant.placeId || buildSyntheticPlaceId('restaurant', restaurant.name, city),
    name: restaurant.name,
    formattedAddress: restaurant.formattedAddress,
    rating: restaurant.rating,
    userRatingsTotal: restaurant.userRatingsTotal,
    photoUrls: restaurant.source === 'foursquare' || restaurant.source === 'google_maps' ? (restaurant.photoUrls || []) : [],
    category: inferPlannerPlaceCategory(undefined, `${restaurant.type || ''} ${restaurant.name}`),
    activityType: 'food',
    source: restaurant.source === 'foursquare'
      ? 'foursquare'
      : restaurant.source === 'google_maps'
        ? 'google_maps'
        : undefined,
  };
}

function buildPersistedHighlights(segments: PlannerSegment[]): Array<{ segmentId: string; city: string; places: PlannerPlaceCandidate[] }> {
  const groups = new Map<string, { segmentId: string; city: string; places: Map<string, PlannerPlaceCandidate> }>();

  for (const segment of segments) {
    const cityKey = normalizeKey(segment.city);
    const currentGroup = groups.get(cityKey) || {
      segmentId: segment.id,
      city: segment.city,
      places: new Map<string, PlannerPlaceCandidate>(),
    };

    for (const day of segment.days) {
      const dayPlaces = [
        ...day.morning.map((activity) => mapActivityToPlaceCandidate(activity, segment.city)),
        ...day.afternoon.map((activity) => mapActivityToPlaceCandidate(activity, segment.city)),
        ...day.evening.map((activity) => mapActivityToPlaceCandidate(activity, segment.city)),
        ...day.restaurants.map((restaurant) => mapRestaurantToPlaceCandidate(restaurant, segment.city)),
      ].filter((place): place is PlannerPlaceCandidate => Boolean(place));

      for (const place of dayPlaces) {
        const placeKey = normalizeKey(place.placeId || `${place.name}::${segment.city}`);
        currentGroup.places.set(placeKey, mergePlaceCandidate(currentGroup.places.get(placeKey), place));
      }
    }

    groups.set(cityKey, currentGroup);
  }

  return Array.from(groups.values())
    .map((group) => ({
      segmentId: group.segmentId,
      city: group.city,
      places: selectTopHighlights(Array.from(group.places.values())),
    }))
    .filter((group) => group.places.length > 0);
}

// ---------------------------------------------------------------------------
// Fetcher — runs inside APIProvider
// ---------------------------------------------------------------------------

function DestinationHighlightsFetcher({
  destinations,
  onLoaded,
}: {
  destinations: string[];
  onLoaded: (highlights: DestinationHighlight[]) => void;
}) {
  const fetchedRef = useRef(false);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    if (fetchedRef.current || destinations.length === 0) return;
    fetchedRef.current = true;

    // Check cache
    const cached: Record<string, PlaceHighlight[]> = {};
    let allCached = true;
    for (const city of destinations) {
      const key = city.trim().toLowerCase();
      const hit = cityHighlightsCache.get(key);
      if (hit) {
        cached[city] = hit;
      } else {
        allCached = false;
      }
    }

    if (allCached) {
      onLoadedRef.current(destinations.map((city) => ({ city, places: cached[city] })));
      return;
    }

    const results: Record<string, PlaceHighlight[]> = { ...cached };
    void fetchPlaceRecommendations(destinations, 4)
      .then((groups) => {
        groups.forEach((group) => {
          const places = group.places.map(mapCandidateToHighlight);
          results[group.city] = places;
          cityHighlightsCache.set(group.city.trim().toLowerCase(), places);
        });

        destinations.forEach((city) => {
          const key = city.trim().toLowerCase();
          if (!results[city]) {
            results[city] = cityHighlightsCache.get(key) || [];
          }
        });

        onLoadedRef.current(destinations.map((city) => ({ city, places: results[city] || [] })));
      })
      .catch(() => {
        destinations.forEach((city) => {
          results[city] = [];
          cityHighlightsCache.set(city.trim().toLowerCase(), []);
        });

        onLoadedRef.current(destinations.map((city) => ({ city, places: results[city] || [] })));
      });
  }, [destinations]);

  return null;
}

// ---------------------------------------------------------------------------
// Card components
// ---------------------------------------------------------------------------

function PlaceCard({ place, onClick, onAddClick }: { place: PlaceHighlight; onClick?: () => void; onAddClick?: () => void }) {
  return (
    <div className="group relative w-40 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm transition-shadow hover:shadow-md" onClick={onClick}>
      <div className="relative">
        {place.photo ? (
          <img
            src={place.photo}
            alt={place.name}
            className="h-28 w-full object-cover"
          />
        ) : (
          <div className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <MapPin className="h-6 w-6 text-primary/40" />
          </div>
        )}
        {(onAddClick || onClick) && (
          <button
            type="button"
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); (onAddClick || onClick)?.(); }}
            title="Agregar al itinerario"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-1 text-[13px] font-semibold leading-tight text-foreground">
          {place.name}
        </p>
        {place.rating != null && (
          <div className="mt-1 flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium text-foreground">
              {place.rating.toFixed(1)}
            </span>
            {place.userRatingsTotal != null && (
              <span className="text-[11px] text-muted-foreground">
                ({place.userRatingsTotal.toLocaleString()})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function DiscoveryPlaceCard({ place, onClick, onAddClick }: { place: PlannerPlaceCandidate; onClick?: () => void; onAddClick?: () => void }) {
  const coverPhoto = shouldUseCardPhoto(place) ? place.photoUrls?.[0] : undefined;

  return (
    <div className="group relative w-40 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm transition-shadow hover:shadow-md" onClick={onClick}>
      <div className="relative">
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt={place.name}
            className="h-28 w-full object-cover"
          />
        ) : (
          <div className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <MapPin className="h-6 w-6 text-primary/40" />
          </div>
        )}
        {(onAddClick || onClick) && (
          <button
            type="button"
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); (onAddClick || onClick)?.(); }}
            title="Agregar al itinerario"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-1 text-[13px] font-semibold leading-tight text-foreground">
          {place.name}
        </p>
        {place.formattedAddress && (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{place.formattedAddress}</p>
        )}
        {place.rating != null && (
          <div className="mt-0.5 flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium text-foreground">
              {place.rating.toFixed(1)}
            </span>
            {place.userRatingsTotal != null && (
              <span className="text-[11px] text-muted-foreground">
                ({place.userRatingsTotal.toLocaleString()})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PlannerChatDestinationCardsProps {
  destinations: string[];
  segments: PlannerSegment[];
  discoveryPlacesBySegment: Record<string, PlannerPlaceCandidate[]>;
  onPlaceClick?: (payload: { segmentId: string; place: PlannerPlaceCandidate }) => void;
  onAutoSlotPlace?: (payload: { segmentId: string; place: PlannerPlaceCandidate }) => void;
}

export default function PlannerChatDestinationCards({
  destinations,
  segments,
  discoveryPlacesBySegment,
  onPlaceClick,
  onAutoSlotPlace,
}: PlannerChatDestinationCardsProps) {
  const [fetchedHighlights, setFetchedHighlights] = useState<DestinationHighlight[] | null>(null);
  const [hydratedPlacesById, setHydratedPlacesById] = useState<Record<string, PlannerPlaceCandidate>>({});
  const requestedHydrationRef = useRef<Set<string>>(new Set());

  const persistedHighlights = useMemo(() => buildPersistedHighlights(segments), [segments]);

  const handleLoaded = useCallback((highlights: DestinationHighlight[]) => setFetchedHighlights(highlights), []);

  const discoveryHighlights = useMemo<HighlightGroup[]>(() => {
    const highlightsFromDiscovery: HighlightGroup[] = [];
    const seenCities = new Set<string>();

    for (const segment of segments) {
      const cityKey = normalizeKey(segment.city);
      if (seenCities.has(cityKey)) continue;
      seenCities.add(cityKey);

      const allPlaces = segments
        .filter((s) => normalizeKey(s.city) === cityKey)
        .flatMap((s) => discoveryPlacesBySegment[s.id] || []);

      if (!allPlaces.length) continue;

      const uniquePlaces = Array.from(new Map(allPlaces.map((place) => [place.placeId, place])).values());
      const top = selectTopHighlights(uniquePlaces);

      if (top.length > 0) {
        highlightsFromDiscovery.push({ segmentId: segment.id, city: segment.city, places: top });
      }
    }

    return highlightsFromDiscovery;
  }, [discoveryPlacesBySegment, segments]);

  const uniqueDestinations = useMemo(
    () => destinations.filter(
      (destination, index, all) => all.findIndex((value) => normalizeKey(value) === normalizeKey(destination)) === index
    ),
    [destinations]
  );

  const fallbackHighlights = useMemo<HighlightGroup[]>(() => {
    if (!fetchedHighlights) return [];

    const seenFetchedCities = new Set<string>();
    return fetchedHighlights
      .filter((highlight) => {
        const key = normalizeKey(highlight.city);
        if (seenFetchedCities.has(key) || highlight.places.length === 0) return false;
        seenFetchedCities.add(key);
        return true;
      })
      .map((highlight) => {
        const segment = segments.find((item) => {
          const segmentCity = normalizeKey(item.city);
          const highlightCity = normalizeKey(highlight.city);
          return segmentCity.includes(highlightCity) || highlightCity.includes(segmentCity);
        });

        return {
          segmentId: segment?.id || segments[0]?.id || '',
          city: highlight.city,
          places: highlight.places.map((place) => ({
            placeId: place.placeId,
            name: place.name,
            formattedAddress: place.vicinity,
            photoUrls: place.photo ? [place.photo] : [],
            rating: place.rating,
            userRatingsTotal: place.userRatingsTotal,
            category: inferPlannerPlaceCategory(undefined, place.name),
            source: 'foursquare' as const,
          })),
        };
      })
      .filter((highlight) => highlight.segmentId && highlight.places.length > 0);
  }, [fetchedHighlights, segments]);

  const visibleHighlightGroups = useMemo<HighlightGroup[]>(() => {
    if (discoveryHighlights.length > 0) return discoveryHighlights;
    if (persistedHighlights.length > 0) return persistedHighlights;
    return fallbackHighlights;
  }, [discoveryHighlights, fallbackHighlights, persistedHighlights]);

  const resetKey = useMemo(
    () => segments.map((segment) => `${segment.id}:${segment.city}`).join('|'),
    [segments]
  );

  useEffect(() => {
    requestedHydrationRef.current.clear();
    setHydratedPlacesById({});
  }, [resetKey]);

  useEffect(() => {
    const candidatesToHydrate = visibleHighlightGroups
      .flatMap((group) => group.places.map((place) => ({ city: group.city, place })))
      .filter(({ city, place }) => {
        const requestKey = `${place.placeId}::${normalizeKey(city)}`;
        if (requestedHydrationRef.current.has(requestKey)) return false;
        requestedHydrationRef.current.add(requestKey);
        return true;
      })
      .slice(0, 8);

    if (candidatesToHydrate.length === 0) return;

    let cancelled = false;

    void Promise.all(candidatesToHydrate.map(async ({ city, place }) => {
      const details = await fetchPlaceDetails({
        placeId: place.placeId,
        title: place.name,
        city,
      });

      if (!details || !(details.photoUrls?.length)) return null;

      return {
        key: place.placeId,
        place: {
          ...place,
          formattedAddress: details.formattedAddress || place.formattedAddress,
          rating: details.rating ?? place.rating,
          userRatingsTotal: details.userRatingsTotal ?? place.userRatingsTotal,
          photoUrls: details.photoUrls,
          website: details.website || place.website,
          phoneNumber: details.phoneNumber || place.phoneNumber,
          openingHours: details.openingHours || place.openingHours,
          isOpenNow: details.isOpenNow ?? place.isOpenNow,
        } satisfies PlannerPlaceCandidate,
      };
    })).then((results) => {
      if (cancelled) return;

      setHydratedPlacesById((current) => {
        const next = { ...current };
        results.forEach((result) => {
          if (!result) return;
          next[result.key] = mergePlaceCandidate(next[result.key], result.place);
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [visibleHighlightGroups]);

  if (visibleHighlightGroups.length > 0) {
    return (
      <div className="space-y-4">
        {visibleHighlightGroups.map((group) => (
          <div key={group.city}>
            <p className="mb-2 text-sm font-semibold text-foreground">
              Qué hacer en {formatDestinationLabel(group.city)}
            </p>
            <div
              className="flex gap-2.5 overflow-x-auto pb-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {group.places.map((place) => {
                const displayPlace = hydratedPlacesById[place.placeId]
                  ? mergePlaceCandidate(place, hydratedPlacesById[place.placeId])
                  : place;

                return (
                  <DiscoveryPlaceCard
                    key={displayPlace.placeId}
                    place={displayPlace}
                    onClick={() => onPlaceClick?.({ segmentId: group.segmentId, place: displayPlace })}
                    onAddClick={onAutoSlotPlace ? () => onAutoSlotPlace({ segmentId: group.segmentId, place: displayPlace }) : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (uniqueDestinations.length === 0) return null;

  return fetchedHighlights ? null : (
    <DestinationHighlightsFetcher
      destinations={uniqueDestinations}
      onLoaded={handleLoaded}
    />
  );
}
