import { useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Star } from 'lucide-react';
import { HAS_PLANNER_GOOGLE_MAPS, PLANNER_GOOGLE_MAPS_API_KEY } from '../map';
import { formatDestinationLabel } from '../utils';
import type { PlannerPlaceCandidate } from '../types';

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

// Module-level cache so we never re-fetch the same city
const cityHighlightsCache = new Map<string, PlaceHighlight[]>();

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
  const placesLib = useMapsLibrary('places');
  const fetchedRef = useRef(false);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    if (!placesLib || fetchedRef.current || destinations.length === 0) return;
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
      onLoadedRef.current(
        destinations.map((city) => ({ city, places: cached[city] }))
      );
      return;
    }

    const container = document.createElement('div');
    const service = new placesLib.PlacesService(container);
    const results: Record<string, PlaceHighlight[]> = { ...cached };
    let remaining = destinations.filter((c) => !cached[c]).length;

    destinations.forEach((city) => {
      if (cached[city]) return;

      service.textSearch(
        {
          query: `top tourist attractions in ${city}`,
          type: 'tourist_attraction',
        },
        (searchResults, status) => {
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            searchResults
          ) {
            const places: PlaceHighlight[] = searchResults.slice(0, 4).map((r) => ({
              placeId: r.place_id || r.name || '',
              name: r.name || '',
              photo: r.photos?.[0]?.getUrl({ maxWidth: 400 }),
              rating: r.rating,
              userRatingsTotal: r.user_ratings_total,
              vicinity: r.formatted_address || (r as any).vicinity,
            }));
            results[city] = places;
            cityHighlightsCache.set(city.trim().toLowerCase(), places);
          }
          remaining--;
          if (remaining <= 0) {
            onLoadedRef.current(
              destinations.map((c) => ({
                city: c,
                places: results[c] || [],
              }))
            );
          }
        },
      );
    });
  }, [placesLib, destinations]);

  return null;
}

// ---------------------------------------------------------------------------
// Card components
// ---------------------------------------------------------------------------

function PlaceCard({ place, onClick }: { place: PlaceHighlight; onClick?: () => void }) {
  return (
    <div className="w-40 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm transition-shadow hover:shadow-md" onClick={onClick}>
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

function DiscoveryPlaceCard({ place, onClick }: { place: PlannerPlaceCandidate; onClick?: () => void }) {
  return (
    <div className="w-40 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm transition-shadow hover:shadow-md" onClick={onClick}>
      {place.photoUrls?.[0] ? (
        <img
          src={place.photoUrls[0]}
          alt={place.name}
          className="h-28 w-full object-cover"
        />
      ) : (
        <div className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
          <MapPin className="h-6 w-6 text-primary/40" />
        </div>
      )}
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PlannerChatDestinationCardsProps {
  destinations: string[];
  segments: { id: string; city: string }[];
  discoveryPlacesBySegment: Record<string, PlannerPlaceCandidate[]>;
  onPlaceClick?: (payload: { segmentId: string; place: PlannerPlaceCandidate }) => void;
}

export default function PlannerChatDestinationCards({
  destinations,
  segments,
  discoveryPlacesBySegment,
  onPlaceClick,
}: PlannerChatDestinationCardsProps) {
  const [fetchedHighlights, setFetchedHighlights] = useState<
    DestinationHighlight[] | null
  >(null);

  const handleLoaded = useCallback(
    (highlights: DestinationHighlight[]) => setFetchedHighlights(highlights),
    []
  );

  // Use discoveryPlacesBySegment if available (better data from nearby search)
  const hasDiscoveryData = segments.some(
    (s) => (discoveryPlacesBySegment[s.id]?.length || 0) > 0
  );

  // If we have discovery data, render from that
  if (hasDiscoveryData) {
    const highlightsFromDiscovery: { segmentId: string; city: string; places: PlannerPlaceCandidate[] }[] = [];
    const seenCities = new Set<string>();

    for (const segment of segments) {
      const cityKey = segment.city.trim().toLowerCase();
      if (seenCities.has(cityKey)) continue;
      seenCities.add(cityKey);

      // Merge places from all segments that share the same city
      const allPlaces = segments
        .filter((s) => s.city.trim().toLowerCase() === cityKey)
        .flatMap((s) => discoveryPlacesBySegment[s.id] || []);

      if (!allPlaces.length) continue;

      // Deduplicate places by placeId
      const uniquePlaces = Array.from(
        new Map(allPlaces.map((p) => [p.placeId, p])).values()
      );

      const top = uniquePlaces
        .filter((p) => p.category !== 'hotel')
        .sort(
          (a, b) =>
            (b.rating || 0) * (b.userRatingsTotal || 0) -
            (a.rating || 0) * (a.userRatingsTotal || 0)
        )
        .slice(0, 4);

      if (top.length > 0) {
        highlightsFromDiscovery.push({ segmentId: segment.id, city: segment.city, places: top });
      }
    }

    if (highlightsFromDiscovery.length === 0) return null;

    return (
      <div className="space-y-4">
        {highlightsFromDiscovery.map((dh) => (
          <div key={dh.city}>
            <p className="mb-2 text-sm font-semibold text-foreground">
              Qué hacer en {formatDestinationLabel(dh.city)}
            </p>
            <div
              className="flex gap-2.5 overflow-x-auto pb-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {dh.places.map((place) => (
                <DiscoveryPlaceCard
                  key={place.placeId}
                  place={place}
                  onClick={() => onPlaceClick?.({ segmentId: dh.segmentId, place })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // If no discovery data yet, fetch via Google Places text search
  // Deduplicate destinations by normalized city name
  const uniqueDestinations = destinations.filter(
    (d, i, arr) => arr.findIndex((x) => x.trim().toLowerCase() === d.trim().toLowerCase()) === i
  );
  if (!HAS_PLANNER_GOOGLE_MAPS || uniqueDestinations.length === 0) return null;

  if (fetchedHighlights) {
    // Deduplicate fetched highlights by city
    const seenFetchedCities = new Set<string>();
    const nonEmpty = fetchedHighlights.filter((h) => {
      const key = h.city.trim().toLowerCase();
      if (seenFetchedCities.has(key) || h.places.length === 0) return false;
      seenFetchedCities.add(key);
      return true;
    });
    if (nonEmpty.length === 0) return null;

    return (
      <div className="space-y-4">
        {nonEmpty.map((dh) => (
          <div key={dh.city}>
            <p className="mb-2 text-sm font-semibold text-foreground">
              Qué hacer en {formatDestinationLabel(dh.city)}
            </p>
            <div
              className="flex gap-2.5 overflow-x-auto pb-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {dh.places.map((place) => (
                <PlaceCard
                  key={place.placeId}
                  place={place}
                  onClick={() => {
                    const seg = segments.find(s =>
                      s.city.toLowerCase().includes(dh.city.toLowerCase())
                      || dh.city.toLowerCase().includes(s.city.toLowerCase())
                    );
                    if (!seg || !onPlaceClick) return;
                    onPlaceClick({
                      segmentId: seg.id,
                      place: {
                        placeId: place.placeId,
                        name: place.name,
                        photoUrls: place.photo ? [place.photo] : [],
                        rating: place.rating,
                        userRatingsTotal: place.userRatingsTotal,
                        category: 'activity',
                      },
                    });
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Render fetcher while loading
  return (
    <APIProvider apiKey={PLANNER_GOOGLE_MAPS_API_KEY} language="es" region="ES">
      <DestinationHighlightsFetcher
        destinations={uniqueDestinations}
        onLoaded={handleLoaded}
      />
    </APIProvider>
  );
}
