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

const cache = new Map<string, PlaceDetails | null>();

function normalizeKey(title: string, city: string): string {
  return `${title}::${city}`
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export async function fetchPlaceDetails(
  placesService: google.maps.places.PlacesService,
  title: string,
  city: string,
  locationBias?: { lat: number; lng: number }
): Promise<PlaceDetails | null> {
  const key = normalizeKey(title, city);
  if (cache.has(key)) return cache.get(key)!;

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
        cache.set(key, null);
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
            cache.set(key, null);
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

          cache.set(key, details);
          resolve(details);
        }
      );
    });
  });
}
