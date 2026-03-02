import type { PlannerPlaceCandidate, PlannerPlaceCategory } from '../types';
import {
  buildPlannerPlaceCandidate,
  inferPlannerPlaceCategory,
  pickCanonicalPlannerPlaceCategory,
} from './plannerPlaceMapper';

export type PlaceDetails = {
  placeId: string;
  name: string;
  formattedAddress?: string;
  rating?: number;
  userRatingsTotal?: number;
  website?: string;
  phoneNumber?: string;
  openingHours?: string[];
  isOpenNow?: boolean;
  photoUrls: string[];
  reviewSnippet?: string;
  types?: string[];
};

type NearbyCategory = PlannerPlaceCategory;

const detailsCache = new Map<string, PlaceDetails | null>();
const nearbyPlacesCache = new Map<string, PlannerPlaceCandidate[]>();

function normalizeKey(title: string, city: string): string {
  return `${title}::${city}`
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeNearbyKey(category: NearbyCategory, city: string, lat: number, lng: number): string {
  return `${category}::${normalizeKey(city, city)}::${lat.toFixed(2)}::${lng.toFixed(2)}`;
}

function mapPlaceResultToCandidate(
  result: google.maps.places.PlaceResult,
  requestedCategory: NearbyCategory,
): PlannerPlaceCandidate | null {
  if (!result.place_id || !result.name) {
    return null;
  }

  return buildPlannerPlaceCandidate({
    placeId: result.place_id,
    name: result.name,
    formattedAddress: result.vicinity,
    rating: result.rating,
    userRatingsTotal: result.user_ratings_total,
    photoUrls: (result.photos ?? []).slice(0, 3).map((photo) => photo.getUrl({ maxWidth: 400 })),
    types: result.types,
    lat: result.geometry?.location?.lat(),
    lng: result.geometry?.location?.lng(),
    category: requestedCategory,
  });
}

function shouldKeepPlaceForCategory(
  category: NearbyCategory,
  place: PlannerPlaceCandidate,
): boolean {
  const inferredCategory = inferPlannerPlaceCategory(place.types, place.name);

  if (category === 'activity') {
    return inferredCategory === 'activity';
  }

  if (!place.types || place.types.length === 0) {
    return true;
  }

  return inferredCategory === category;
}

function dedupePlaces(places: PlannerPlaceCandidate[]): PlannerPlaceCandidate[] {
  const merged = new Map<string, PlannerPlaceCandidate>();

  places.forEach((place) => {
    const existing = merged.get(place.placeId);
    if (!existing) {
      merged.set(place.placeId, place);
      return;
    }

    const category = pickCanonicalPlannerPlaceCategory([existing.category, place.category]);
    const preferred = category === existing.category ? existing : place;
    const secondary = preferred === existing ? place : existing;

    merged.set(place.placeId, {
      ...secondary,
      ...preferred,
      category,
      activityType: preferred.activityType || secondary.activityType,
      photoUrls: preferred.photoUrls?.length ? preferred.photoUrls : secondary.photoUrls,
    });
  });

  return Array.from(merged.values()).sort((left, right) => {
    const leftScore = (left.rating || 0) * Math.max(1, left.userRatingsTotal || 1);
    const rightScore = (right.rating || 0) * Math.max(1, right.userRatingsTotal || 1);
    return rightScore - leftScore;
  });
}

function runNearbySearch(
  placesService: google.maps.places.PlacesService,
  request: google.maps.places.PlaceSearchRequest,
): Promise<google.maps.places.PlaceResult[]> {
  return new Promise((resolve) => {
    const collected: google.maps.places.PlaceResult[] = [];
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve(collected);
    };

    let pageCount = 0;
    const handleResults = (
      results: google.maps.places.PlaceResult[] | null,
      status: google.maps.places.PlacesServiceStatus,
      pagination: google.maps.places.PlaceSearchPagination | null,
    ) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
        finish();
        return;
      }

      collected.push(...results);
      pageCount += 1;

      if (pagination?.hasNextPage && pageCount < 3) {
        pagination.nextPage();
        return;
      }

      finish();
    };

    placesService.nearbySearch(request, (results, status, pagination) => {
      if (!results) {
        resolve([]);
        return;
      }

      handleResults(results, status, pagination || null);
    });
  });
}

function buildNearbyRequests(
  category: NearbyCategory,
  city: string,
  location: { lat: number; lng: number },
): google.maps.places.PlaceSearchRequest[] {
  const latLng = new google.maps.LatLng(location.lat, location.lng);
  const base = {
    location: latLng,
    radius: 12000,
  };

  switch (category) {
    case 'hotel':
      return [
        { ...base, type: 'lodging' as any },
        { ...base, keyword: city, type: 'lodging' as any },
      ];
    case 'restaurant':
      return [{ ...base, type: 'restaurant' as any }];
    case 'cafe':
      return [{ ...base, type: 'cafe' as any }];
    case 'museum':
      return [{ ...base, type: 'museum' as any }];
    case 'activity':
    default:
      return [
        { ...base, type: 'tourist_attraction' as any },
        { ...base, type: 'point_of_interest' as any },
        { ...base, type: 'park' as any },
        { ...base, type: 'art_gallery' as any },
      ];
  }
}

export async function fetchPlaceDetails(
  placesService: google.maps.places.PlacesService,
  title: string,
  city: string,
  locationBias?: { lat: number; lng: number }
): Promise<PlaceDetails | null> {
  const key = normalizeKey(title, city);
  if (detailsCache.has(key)) return detailsCache.get(key)!;

  return new Promise((resolve) => {
    const query = `${title}, ${city}`;
    const request: google.maps.places.FindPlaceFromQueryRequest = {
      query,
      fields: ['place_id', 'name'],
      ...(locationBias
        ? { locationBias: new google.maps.LatLng(locationBias.lat, locationBias.lng) }
        : {}),
    };

    placesService.findPlaceFromQuery(request, (results, status) => {
      if (
        status !== google.maps.places.PlacesServiceStatus.OK ||
        !results ||
        results.length === 0 ||
        !results[0].place_id
      ) {
        detailsCache.set(key, null);
        resolve(null);
        return;
      }

      const placeId = results[0].place_id;

      placesService.getDetails(
        {
          placeId,
          fields: [
            'place_id',
            'name',
            'formatted_address',
            'rating',
            'user_ratings_total',
            'website',
            'formatted_phone_number',
            'opening_hours',
            'photos',
            'reviews',
            'types',
          ],
        },
        (place, detailStatus) => {
          if (detailStatus !== google.maps.places.PlacesServiceStatus.OK || !place) {
            detailsCache.set(key, null);
            resolve(null);
            return;
          }

          const photoUrls = (place.photos ?? [])
            .slice(0, 3)
            .map((photo) => photo.getUrl({ maxWidth: 400 }));

          const details: PlaceDetails = {
            placeId: place.place_id || placeId,
            name: place.name || title,
            formattedAddress: place.formatted_address,
            rating: place.rating,
            userRatingsTotal: place.user_ratings_total,
            website: place.website,
            phoneNumber: place.formatted_phone_number,
            openingHours: place.opening_hours?.weekday_text,
            isOpenNow: place.opening_hours?.isOpen?.(),
            photoUrls,
            reviewSnippet: place.reviews?.[0]?.text,
            types: place.types,
          };

          detailsCache.set(key, details);
          resolve(details);
        }
      );
    });
  });
}

export async function fetchNearbyPlacesByCategory(
  placesService: google.maps.places.PlacesService,
  city: string,
  location: { lat: number; lng: number },
  category: NearbyCategory
): Promise<PlannerPlaceCandidate[]> {
  const key = normalizeNearbyKey(category, city, location.lat, location.lng);
  if (nearbyPlacesCache.has(key)) {
    return nearbyPlacesCache.get(key)!;
  }

  const requests = buildNearbyRequests(category, city, location);
  const results = await Promise.all(requests.map((request) => runNearbySearch(placesService, request)));
  const places = dedupePlaces(
    results
      .flat()
      .map((result) => mapPlaceResultToCandidate(result, category))
      .filter((place): place is PlannerPlaceCandidate => Boolean(place))
      .filter((place) => shouldKeepPlaceForCategory(category, place))
  ).slice(0, 48);

  nearbyPlacesCache.set(key, places);
  return places;
}

export async function fetchNearbyPlacesBundle(
  placesService: google.maps.places.PlacesService,
  city: string,
  location: { lat: number; lng: number },
  categories: NearbyCategory[] = ['hotel', 'restaurant', 'cafe', 'museum', 'activity']
): Promise<Record<NearbyCategory, PlannerPlaceCandidate[]>> {
  const entries = await Promise.all(
    categories.map(async (category) => [category, await fetchNearbyPlacesByCategory(placesService, city, location, category)] as const)
  );

  return {
    hotel: entries.find(([category]) => category === 'hotel')?.[1] || [],
    restaurant: entries.find(([category]) => category === 'restaurant')?.[1] || [],
    cafe: entries.find(([category]) => category === 'cafe')?.[1] || [],
    museum: entries.find(([category]) => category === 'museum')?.[1] || [],
    activity: entries.find(([category]) => category === 'activity')?.[1] || [],
  };
}

export async function fetchNearbyHotels(
  placesService: google.maps.places.PlacesService,
  city: string,
  location: { lat: number; lng: number }
): Promise<PlannerPlaceCandidate[]> {
  return fetchNearbyPlacesByCategory(placesService, city, location, 'hotel');
}
