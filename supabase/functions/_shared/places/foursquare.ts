const FSQ_API_KEY = Deno.env.get('FOURSQUARE_API_KEY')?.trim() || '';
const FSQ_CLIENT_ID = Deno.env.get('FOURSQUARE_CLIENT_ID')?.trim() || '';
const FSQ_CLIENT_SECRET = Deno.env.get('FOURSQUARE_CLIENT_SECRET')?.trim() || '';
const FSQ_V2_BASE = 'https://api.foursquare.com/v2';
const FSQ_V3_BASE = 'https://places-api.foursquare.com/places';
const FSQ_VERSION = '20231010';

export interface CanonicalVenuePhoto {
  prefix: string;
  suffix: string;
}

export interface CanonicalVenue {
  id: string;
  name: string;
  location?: {
    address?: string;
    formattedAddress?: string[];
    lat?: number;
    lng?: number;
  };
  categories?: Array<{
    id: string;
    name: string;
    categoryCode?: number;
    icon?: { prefix: string; suffix: string };
  }>;
  rating?: number;
  ratingSignals?: number;
  url?: string;
  tel?: string;
  description?: string;
  hours?: { status?: string; isOpen?: boolean };
  bestPhoto?: CanonicalVenuePhoto;
  photos?: { groups?: Array<{ items?: CanonicalVenuePhoto[] }> };
}

function hasV3Auth(): boolean {
  return Boolean(FSQ_API_KEY);
}

function hasV2Auth(): boolean {
  return Boolean(FSQ_CLIENT_ID && FSQ_CLIENT_SECRET);
}

function getAuthMode(): 'v3' | 'v2' | null {
  if (hasV3Auth()) return 'v3';
  if (hasV2Auth()) return 'v2';
  return null;
}

function authParams(): URLSearchParams {
  return new URLSearchParams({
    client_id: FSQ_CLIENT_ID,
    client_secret: FSQ_CLIENT_SECRET,
    v: FSQ_VERSION,
  });
}

async function fsqFetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Foursquare ${response.status}: ${text}`);
  }

  return await response.json();
}

async function fsqFetchV2(url: string): Promise<unknown> {
  const json = await fsqFetchJson(url);
  return (json as { response?: unknown }).response;
}

function buildV3Headers(): HeadersInit {
  return {
    Authorization: `Bearer ${FSQ_API_KEY}`,
    'X-Places-Api-Version': '2025-06-17',
  };
}

function compactAddressParts(parts: Array<string | undefined | null>): string[] | undefined {
  const normalized = parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function toPhoto(photo: Record<string, unknown> | null | undefined): CanonicalVenuePhoto | undefined {
  const prefix = typeof photo?.prefix === 'string' ? photo.prefix : '';
  const suffix = typeof photo?.suffix === 'string' ? photo.suffix : '';

  if (!prefix || !suffix) return undefined;
  return { prefix, suffix };
}

function toPhotosGroup(photos: unknown): CanonicalVenue['photos'] {
  const items = Array.isArray(photos)
    ? photos
        .map((photo) => toPhoto(photo as Record<string, unknown>))
        .filter((photo): photo is CanonicalVenuePhoto => Boolean(photo))
    : [];

  return items.length > 0 ? { groups: [{ items }] } : undefined;
}

function toHours(hours: Record<string, unknown> | null | undefined): CanonicalVenue['hours'] {
  if (!hours) return undefined;

  const display = hours.display;
  const displayLine = Array.isArray(display)
    ? display.find((line) => typeof line === 'string')
    : typeof display === 'string'
      ? display
      : undefined;

  const openNow = typeof hours.open_now === 'boolean'
    ? hours.open_now
    : typeof hours.is_open === 'boolean'
      ? hours.is_open
      : undefined;

  if (!displayLine && openNow == null) return undefined;

  return {
    status: displayLine,
    isOpen: openNow,
  };
}

function toCategories(categories: unknown): CanonicalVenue['categories'] {
  if (!Array.isArray(categories)) return undefined;

  const mapped = categories
    .map((category) => {
      const raw = category as Record<string, unknown>;
      const idValue = raw.fsq_category_id ?? raw.id ?? raw.category_id ?? raw.categoryCode;
      const name = typeof raw.name === 'string' ? raw.name : '';
      const icon = raw.icon as Record<string, unknown> | undefined;

      if (!idValue && !name) return null;

      const numericId = typeof idValue === 'number' ? idValue : Number(idValue);

      return {
        id: String(idValue ?? name),
        name,
        categoryCode: Number.isFinite(numericId) ? numericId : undefined,
        icon: typeof icon?.prefix === 'string' && typeof icon?.suffix === 'string'
          ? { prefix: icon.prefix, suffix: icon.suffix }
          : undefined,
      };
    })
    .filter((category): category is NonNullable<typeof category> => Boolean(category));

  return mapped.length > 0 ? mapped : undefined;
}

function mapV3Place(place: Record<string, unknown>): CanonicalVenue {
  const location = (place.location as Record<string, unknown> | undefined) ?? {};
  const geocodes = (place.geocodes as Record<string, unknown> | undefined) ?? {};
  const mainGeocode = (geocodes.main as Record<string, unknown> | undefined) ?? {};
  const stats = (place.stats as Record<string, unknown> | undefined) ?? {};
  const photos = toPhotosGroup(place.photos);
  const photoItems = photos?.groups?.[0]?.items ?? [];

  return {
    id: String(place.fsq_place_id ?? place.fsq_id ?? place.id ?? ''),
    name: typeof place.name === 'string' ? place.name : '',
    location: {
      address: typeof location.address === 'string' ? location.address : undefined,
      formattedAddress: compactAddressParts([
        typeof location.formatted_address === 'string' ? location.formatted_address : undefined,
        typeof location.address === 'string' ? location.address : undefined,
        typeof location.locality === 'string' ? location.locality : undefined,
        typeof location.region === 'string' ? location.region : undefined,
        typeof location.country === 'string' ? location.country : undefined,
      ]),
      lat: typeof mainGeocode.latitude === 'number'
        ? mainGeocode.latitude
        : typeof place.latitude === 'number'
          ? (place.latitude as number)
          : undefined,
      lng: typeof mainGeocode.longitude === 'number'
        ? mainGeocode.longitude
        : typeof place.longitude === 'number'
          ? (place.longitude as number)
          : undefined,
    },
    categories: toCategories(place.categories),
    rating: typeof place.rating === 'number' ? place.rating : undefined,
    ratingSignals: typeof stats.total_ratings === 'number'
      ? stats.total_ratings
      : typeof place.rating_signals === 'number'
        ? place.rating_signals
        : undefined,
    url: typeof place.website === 'string'
      ? place.website
      : typeof place.link === 'string'
        ? place.link
        : undefined,
    tel: typeof place.tel === 'string' ? place.tel : undefined,
    description: typeof place.description === 'string' ? place.description : undefined,
    hours: toHours(place.hours as Record<string, unknown> | undefined),
    bestPhoto: photoItems[0],
    photos,
  };
}

function mapV2Venue(venue: Record<string, unknown>): CanonicalVenue {
  const location = (venue.location as Record<string, unknown> | undefined) ?? {};
  const categories = Array.isArray(venue.categories) ? venue.categories : [];
  const photos = venue.photos as Record<string, unknown> | undefined;
  const groups = Array.isArray(photos?.groups) ? photos.groups as Array<Record<string, unknown>> : [];
  const firstGroupItems = Array.isArray(groups[0]?.items) ? groups[0].items as Array<Record<string, unknown>> : [];

  return {
    id: String(venue.id ?? ''),
    name: typeof venue.name === 'string' ? venue.name : '',
    location: {
      address: typeof location.address === 'string' ? location.address : undefined,
      formattedAddress: Array.isArray(location.formattedAddress)
        ? location.formattedAddress.filter((line): line is string => typeof line === 'string')
        : undefined,
      lat: typeof location.lat === 'number' ? location.lat : undefined,
      lng: typeof location.lng === 'number' ? location.lng : undefined,
    },
    categories: categories.map((category) => {
      const raw = category as Record<string, unknown>;
      const numericId = typeof raw.categoryCode === 'number' ? raw.categoryCode : Number(raw.id);

      return {
        id: String(raw.id ?? raw.categoryCode ?? raw.name ?? ''),
        name: typeof raw.name === 'string' ? raw.name : '',
        categoryCode: Number.isFinite(numericId) ? numericId : undefined,
        icon: typeof (raw.icon as Record<string, unknown> | undefined)?.prefix === 'string'
          && typeof (raw.icon as Record<string, unknown> | undefined)?.suffix === 'string'
          ? {
              prefix: ((raw.icon as Record<string, unknown>).prefix as string),
              suffix: ((raw.icon as Record<string, unknown>).suffix as string),
            }
          : undefined,
      };
    }),
    rating: typeof venue.rating === 'number' ? venue.rating : undefined,
    ratingSignals: typeof venue.ratingSignals === 'number' ? venue.ratingSignals : undefined,
    url: typeof venue.url === 'string' ? venue.url : undefined,
    tel: typeof venue.contact === 'object'
      && venue.contact
      && typeof (venue.contact as Record<string, unknown>).formattedPhone === 'string'
      ? (venue.contact as Record<string, unknown>).formattedPhone as string
      : undefined,
    description: typeof venue.description === 'string' ? venue.description : undefined,
    hours: typeof venue.hours === 'object' && venue.hours
      ? {
          status: typeof (venue.hours as Record<string, unknown>).status === 'string'
            ? (venue.hours as Record<string, unknown>).status as string
            : undefined,
          isOpen: typeof (venue.hours as Record<string, unknown>).isOpen === 'boolean'
            ? (venue.hours as Record<string, unknown>).isOpen as boolean
            : undefined,
        }
      : undefined,
    bestPhoto: toPhoto(venue.bestPhoto as Record<string, unknown> | undefined) || toPhoto(firstGroupItems[0]),
    photos: groups.length > 0
      ? {
          groups: groups.map((group) => ({
            items: (Array.isArray(group.items) ? group.items : [])
              .map((item) => toPhoto(item as Record<string, unknown>))
              .filter((item): item is CanonicalVenuePhoto => Boolean(item)),
          })),
        }
      : undefined,
  };
}

async function fetchV3Search(params: Record<string, unknown>): Promise<CanonicalVenue[]> {
  const query = new URLSearchParams();
  const lat = typeof params.lat === 'number' ? params.lat : undefined;
  const lng = typeof params.lng === 'number' ? params.lng : undefined;
  const radius = typeof params.radius === 'number' ? params.radius : undefined;
  const limit = typeof params.limit === 'number' ? params.limit : 15;
  const categoryId = typeof params.categoryId === 'string' ? params.categoryId : undefined;
  const searchQuery = typeof params.query === 'string' ? params.query : undefined;
  const near = typeof params.near === 'string' ? params.near : undefined;

  if (lat != null && lng != null) query.set('ll', `${lat},${lng}`);
  if (radius != null) query.set('radius', String(radius));
  if (limit != null) query.set('limit', String(limit));
  if (categoryId) query.set('categories', categoryId);
  if (searchQuery) query.set('query', searchQuery);
  if (near) query.set('near', near);

  const json = await fsqFetchJson(`${FSQ_V3_BASE}/search?${query}`, {
    headers: buildV3Headers(),
  }) as { results?: Array<Record<string, unknown>> };

  return Array.isArray(json.results) ? json.results.map(mapV3Place) : [];
}

async function fetchV3Details(venueId: string): Promise<CanonicalVenue | null> {
  const json = await fsqFetchJson(`${FSQ_V3_BASE}/${venueId}`, {
    headers: buildV3Headers(),
  }) as Record<string, unknown>;

  return json ? mapV3Place(json) : null;
}

async function fetchV3Photos(venueId: string, limit: number): Promise<CanonicalVenuePhoto[]> {
  const query = new URLSearchParams();
  query.set('limit', String(limit));

  const json = await fsqFetchJson(`${FSQ_V3_BASE}/${venueId}/photos?${query}`, {
    headers: buildV3Headers(),
  });

  const rawPhotos = Array.isArray(json)
    ? json
    : Array.isArray((json as Record<string, unknown>)?.photos)
      ? (json as Record<string, unknown>).photos as Array<Record<string, unknown>>
      : [];

  return rawPhotos
    .map((photo) => toPhoto(photo as Record<string, unknown>))
    .filter((photo): photo is CanonicalVenuePhoto => Boolean(photo));
}

export async function searchNearby(params: {
  lat: number;
  lng: number;
  categoryId?: string;
  radius?: number;
  limit?: number;
}): Promise<CanonicalVenue[]> {
  const authMode = getAuthMode();
  if (!authMode) throw new Error('Missing Foursquare credentials');

  if (authMode === 'v3') {
    return await fetchV3Search(params);
  }

  const query = authParams();
  query.set('ll', `${params.lat},${params.lng}`);
  query.set('radius', String(params.radius ?? 1500));
  query.set('limit', String(params.limit ?? 15));
  query.set('intent', 'browse');
  if (params.categoryId) query.set('categoryId', params.categoryId);

  const response = await fsqFetchV2(`${FSQ_V2_BASE}/venues/search?${query}`) as { venues?: Array<Record<string, unknown>> };
  return Array.isArray(response?.venues) ? response.venues.map(mapV2Venue) : [];
}

export async function searchByQuery(params: {
  query: string;
  lat?: number;
  lng?: number;
  limit?: number;
}): Promise<CanonicalVenue[]> {
  const authMode = getAuthMode();
  if (!authMode) throw new Error('Missing Foursquare credentials');

  if (authMode === 'v3') {
    return await fetchV3Search(params);
  }

  const query = authParams();
  query.set('query', params.query);
  query.set('limit', String(params.limit ?? 5));
  query.set('intent', 'checkin');
  if (typeof params.lat === 'number' && typeof params.lng === 'number') {
    query.set('ll', `${params.lat},${params.lng}`);
  }

  const response = await fsqFetchV2(`${FSQ_V2_BASE}/venues/search?${query}`) as { venues?: Array<Record<string, unknown>> };
  return Array.isArray(response?.venues) ? response.venues.map(mapV2Venue) : [];
}

export async function searchText(params: {
  query: string;
  near?: string;
  limit?: number;
}): Promise<CanonicalVenue[]> {
  const authMode = getAuthMode();
  if (!authMode) throw new Error('Missing Foursquare credentials');

  if (authMode === 'v3') {
    return await fetchV3Search(params);
  }

  const query = authParams();
  query.set('query', params.query);
  query.set('limit', String(params.limit ?? 10));
  query.set('near', params.near || 'world');
  query.set('intent', 'global');

  const response = await fsqFetchV2(`${FSQ_V2_BASE}/venues/search?${query}`) as { venues?: Array<Record<string, unknown>> };
  return Array.isArray(response?.venues) ? response.venues.map(mapV2Venue) : [];
}

export async function getDetails(venueId: string): Promise<CanonicalVenue | null> {
  const authMode = getAuthMode();
  if (!authMode) throw new Error('Missing Foursquare credentials');

  if (authMode === 'v3') {
    return await fetchV3Details(venueId);
  }

  const query = authParams();
  const response = await fsqFetchV2(`${FSQ_V2_BASE}/venues/${venueId}?${query}`) as { venue?: Record<string, unknown> };
  return response?.venue ? mapV2Venue(response.venue) : null;
}

export async function getPhotos(venueId: string, limit = 3): Promise<CanonicalVenuePhoto[]> {
  const authMode = getAuthMode();
  if (!authMode) throw new Error('Missing Foursquare credentials');

  if (authMode === 'v3') {
    return await fetchV3Photos(venueId, limit);
  }

  const query = authParams();
  query.set('limit', String(limit));
  const response = await fsqFetchV2(`${FSQ_V2_BASE}/venues/${venueId}/photos?${query}`) as { photos?: { items?: Array<Record<string, unknown>> } };
  const items = Array.isArray(response?.photos?.items) ? response.photos.items : [];
  return items
    .map((photo) => toPhoto(photo))
    .filter((photo): photo is CanonicalVenuePhoto => Boolean(photo));
}

export function getVenuePhotoUrl(venue: CanonicalVenue, size = '400x300'): string | undefined {
  const photo = venue.bestPhoto || venue.photos?.groups?.[0]?.items?.[0];
  if (!photo) return undefined;
  return `${photo.prefix}${size}${photo.suffix}`;
}
