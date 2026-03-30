import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FSQ_API_KEY = Deno.env.get("FOURSQUARE_API_KEY")?.trim() || "";
const FSQ_CLIENT_ID = Deno.env.get("FOURSQUARE_CLIENT_ID")?.trim() || "";
const FSQ_CLIENT_SECRET = Deno.env.get("FOURSQUARE_CLIENT_SECRET")?.trim() || "";
const FSQ_V2_BASE = "https://api.foursquare.com/v2";
const FSQ_V3_BASE = "https://places-api.foursquare.com/places";
const FSQ_VERSION = "20231010";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "search_nearby"
  | "get_details"
  | "search_by_query"
  | "search_text"
  | "get_photos";

interface CanonicalVenuePhoto {
  prefix: string;
  suffix: string;
}

interface CanonicalVenue {
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function hasV3Auth(): boolean {
  return Boolean(FSQ_API_KEY);
}

function hasV2Auth(): boolean {
  return Boolean(FSQ_CLIENT_ID && FSQ_CLIENT_SECRET);
}

function getAuthMode(): "v3" | "v2" | null {
  if (hasV3Auth()) return "v3";
  if (hasV2Auth()) return "v2";
  return null;
}

function emptyData(action: Action): Record<string, unknown> {
  switch (action) {
    case "get_details":
      return { venue: null };
    case "get_photos":
      return { photos: [] };
    default:
      return { venues: [] };
  }
}

function buildRecoverableResponse(action: Action, message: string) {
  return jsonResponse({
    data: emptyData(action),
    error: message,
  });
}

function authParams(): URLSearchParams {
  return new URLSearchParams({
    client_id: FSQ_CLIENT_ID,
    client_secret: FSQ_CLIENT_SECRET,
    v: FSQ_VERSION,
  });
}

async function fsqFetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Foursquare ${res.status}: ${text}`);
  }

  return await res.json();
}

async function fsqFetchV2(url: string): Promise<unknown> {
  const json = await fsqFetchJson(url);
  return (json as { response?: unknown }).response;
}

function buildV3Headers(): HeadersInit {
  return {
    Authorization: `Bearer ${FSQ_API_KEY}`,
    "X-Places-Api-Version": "2025-06-17",
  };
}

function compactAddressParts(parts: Array<string | undefined | null>): string[] | undefined {
  const normalized = parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function toV3Photo(photo: Record<string, unknown> | null | undefined): CanonicalVenuePhoto | undefined {
  const prefix = typeof photo?.prefix === "string" ? photo.prefix : "";
  const suffix = typeof photo?.suffix === "string" ? photo.suffix : "";
  if (!prefix || !suffix) return undefined;
  return { prefix, suffix };
}

function toV3PhotosGroup(photos: unknown): CanonicalVenue["photos"] {
  const items = Array.isArray(photos)
    ? photos
        .map((photo) => toV3Photo(photo as Record<string, unknown>))
        .filter((photo): photo is CanonicalVenuePhoto => Boolean(photo))
    : [];

  return items.length > 0 ? { groups: [{ items }] } : undefined;
}

function toV3Hours(hours: Record<string, unknown> | null | undefined): CanonicalVenue["hours"] {
  if (!hours) return undefined;

  const display = hours.display;
  const displayLine = Array.isArray(display)
    ? display.find((line) => typeof line === "string")
    : typeof display === "string"
      ? display
      : undefined;

  const openNow = typeof hours.open_now === "boolean"
    ? hours.open_now
    : typeof hours.is_open === "boolean"
      ? hours.is_open
      : undefined;

  if (!displayLine && openNow == null) return undefined;

  return {
    status: displayLine,
    isOpen: openNow,
  };
}

function toV3Categories(categories: unknown): CanonicalVenue["categories"] {
  if (!Array.isArray(categories)) return undefined;

  const mapped = categories
    .map((category) => {
      const raw = category as Record<string, unknown>;
      const idValue = raw.fsq_category_id ?? raw.id ?? raw.category_id ?? raw.categoryCode;
      const name = typeof raw.name === "string" ? raw.name : "";
      const icon = raw.icon as Record<string, unknown> | undefined;

      if (!idValue && !name) return null;

      const numericId = typeof idValue === "number" ? idValue : Number(idValue);

      return {
        id: String(idValue ?? name),
        name,
        categoryCode: Number.isFinite(numericId) ? numericId : undefined,
        icon: typeof icon?.prefix === "string" && typeof icon?.suffix === "string"
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
  const photos = toV3PhotosGroup(place.photos);
  const photoItems = photos?.groups?.[0]?.items ?? [];

  return {
    id: String(place.fsq_place_id ?? place.fsq_id ?? place.id ?? ""),
    name: typeof place.name === "string" ? place.name : "",
    location: {
      address: typeof location.address === "string" ? location.address : undefined,
      formattedAddress: compactAddressParts([
        typeof location.formatted_address === "string" ? location.formatted_address : undefined,
        typeof location.address === "string" ? location.address : undefined,
        typeof location.locality === "string" ? location.locality : undefined,
        typeof location.region === "string" ? location.region : undefined,
        typeof location.country === "string" ? location.country : undefined,
      ]),
      lat: typeof mainGeocode.latitude === "number"
        ? mainGeocode.latitude
        : typeof (place.latitude) === "number"
          ? (place.latitude as number)
          : undefined,
      lng: typeof mainGeocode.longitude === "number"
        ? mainGeocode.longitude
        : typeof (place.longitude) === "number"
          ? (place.longitude as number)
          : undefined,
    },
    categories: toV3Categories(place.categories),
    rating: typeof place.rating === "number" ? place.rating : undefined,
    ratingSignals: typeof stats.total_ratings === "number"
      ? stats.total_ratings
      : typeof place.rating_signals === "number"
        ? place.rating_signals
        : undefined,
    url: typeof place.website === "string"
      ? place.website
      : typeof place.link === "string"
        ? place.link
        : undefined,
    tel: typeof place.tel === "string" ? place.tel : undefined,
    description: typeof place.description === "string" ? place.description : undefined,
    hours: toV3Hours(place.hours as Record<string, unknown> | undefined),
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
    id: String(venue.id ?? ""),
    name: typeof venue.name === "string" ? venue.name : "",
    location: {
      address: typeof location.address === "string" ? location.address : undefined,
      formattedAddress: Array.isArray(location.formattedAddress)
        ? location.formattedAddress.filter((line): line is string => typeof line === "string")
        : undefined,
      lat: typeof location.lat === "number" ? location.lat : undefined,
      lng: typeof location.lng === "number" ? location.lng : undefined,
    },
    categories: categories.map((category) => {
      const raw = category as Record<string, unknown>;
      const numericId = typeof raw.categoryCode === "number" ? raw.categoryCode : Number(raw.id);
      return {
        id: String(raw.id ?? raw.categoryCode ?? raw.name ?? ""),
        name: typeof raw.name === "string" ? raw.name : "",
        categoryCode: Number.isFinite(numericId) ? numericId : undefined,
        icon: typeof (raw.icon as Record<string, unknown> | undefined)?.prefix === "string"
          && typeof (raw.icon as Record<string, unknown> | undefined)?.suffix === "string"
          ? {
              prefix: ((raw.icon as Record<string, unknown>).prefix as string),
              suffix: ((raw.icon as Record<string, unknown>).suffix as string),
            }
          : undefined,
      };
    }),
    rating: typeof venue.rating === "number" ? venue.rating : undefined,
    ratingSignals: typeof venue.ratingSignals === "number" ? venue.ratingSignals : undefined,
    url: typeof venue.url === "string" ? venue.url : undefined,
    tel: typeof venue.contact === "object" && venue.contact && typeof (venue.contact as Record<string, unknown>).formattedPhone === "string"
      ? (venue.contact as Record<string, unknown>).formattedPhone as string
      : undefined,
    description: typeof venue.description === "string" ? venue.description : undefined,
    hours: typeof venue.hours === "object" && venue.hours
      ? {
          status: typeof (venue.hours as Record<string, unknown>).status === "string"
            ? (venue.hours as Record<string, unknown>).status as string
            : undefined,
          isOpen: typeof (venue.hours as Record<string, unknown>).isOpen === "boolean"
            ? (venue.hours as Record<string, unknown>).isOpen as boolean
            : undefined,
        }
      : undefined,
    bestPhoto: toV3Photo(venue.bestPhoto as Record<string, unknown> | undefined) || toV3Photo(firstGroupItems[0]),
    photos: groups.length > 0
      ? {
          groups: groups.map((group) => ({
            items: (Array.isArray(group.items) ? group.items : [])
              .map((item) => toV3Photo(item as Record<string, unknown>))
              .filter((item): item is CanonicalVenuePhoto => Boolean(item)),
          })),
        }
      : undefined,
  };
}

async function fetchV3Search(params: Record<string, unknown>): Promise<{ venues: CanonicalVenue[] }> {
  const qs = new URLSearchParams();
  const lat = typeof params.lat === "number" ? params.lat : undefined;
  const lng = typeof params.lng === "number" ? params.lng : undefined;
  const radius = typeof params.radius === "number" ? params.radius : undefined;
  const limit = typeof params.limit === "number" ? params.limit : 15;
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : undefined;
  const query = typeof params.query === "string" ? params.query : undefined;

  if (lat != null && lng != null) qs.set("ll", `${lat},${lng}`);
  if (radius != null) qs.set("radius", String(radius));
  if (limit != null) qs.set("limit", String(limit));
  if (categoryId) qs.set("categories", categoryId);
  if (query) qs.set("query", query);
  const near = typeof params.near === "string" ? params.near : undefined;
  if (near) qs.set("near", near);

  const json = await fsqFetchJson(`${FSQ_V3_BASE}/search?${qs}`, {
    headers: buildV3Headers(),
  }) as { results?: Array<Record<string, unknown>> };

  return {
    venues: Array.isArray(json.results) ? json.results.map(mapV3Place) : [],
  };
}

async function fetchV3Details(venueId: string): Promise<{ venue: CanonicalVenue | null }> {
  const json = await fsqFetchJson(`${FSQ_V3_BASE}/${venueId}`, {
    headers: buildV3Headers(),
  }) as Record<string, unknown>;

  return {
    venue: json ? mapV3Place(json) : null,
  };
}

async function fetchV3Photos(venueId: string, limit: number): Promise<{ photos: CanonicalVenuePhoto[] }> {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));

  const json = await fsqFetchJson(`${FSQ_V3_BASE}/${venueId}/photos?${qs}`, {
    headers: buildV3Headers(),
  });

  // API may return a flat array or { photos: [...] }
  const rawPhotos = Array.isArray(json)
    ? json
    : Array.isArray((json as Record<string, unknown>)?.photos)
      ? (json as Record<string, unknown>).photos as Array<Record<string, unknown>>
      : [];

  const photos = (rawPhotos as Array<Record<string, unknown>>)
    .map((photo) => toV3Photo(photo))
    .filter((photo): photo is CanonicalVenuePhoto => Boolean(photo));

  return { photos };
}

async function executeAction(action: Action, params: Record<string, unknown>) {
  const authMode = getAuthMode();
  if (!authMode) {
    throw new Error("Missing Foursquare credentials. Configure FOURSQUARE_API_KEY or FOURSQUARE_CLIENT_ID/FOURSQUARE_CLIENT_SECRET.");
  }

  if (authMode === "v3") {
    switch (action) {
      case "search_nearby":
      case "search_by_query":
      case "search_text":
        return await fetchV3Search(params);
      case "get_details":
        return await fetchV3Details(String(params.venue_id ?? ""));
      case "get_photos":
        return await fetchV3Photos(String(params.venue_id ?? ""), Number(params.limit ?? 1));
      default:
        return emptyData(action);
    }
  }

  switch (action) {
    case "search_nearby": {
      const { lat, lng, categoryId, radius = 1500, limit = 15 } = params;
      const qs = authParams();
      qs.set("ll", `${lat},${lng}`);
      qs.set("radius", String(radius));
      qs.set("limit", String(limit));
      qs.set("intent", "browse");
      if (typeof categoryId === "string" && categoryId) qs.set("categoryId", categoryId);
      const response = await fsqFetchV2(`${FSQ_V2_BASE}/venues/search?${qs}`) as { venues?: Array<Record<string, unknown>> };
      return { venues: Array.isArray(response?.venues) ? response.venues.map(mapV2Venue) : [] };
    }

    case "get_details": {
      const { venue_id } = params;
      const qs = authParams();
      const response = await fsqFetchV2(`${FSQ_V2_BASE}/venues/${venue_id}?${qs}`) as { venue?: Record<string, unknown> };
      return { venue: response?.venue ? mapV2Venue(response.venue) : null };
    }

    case "search_by_query": {
      const { query, lat, lng, limit = 5 } = params;
      const qs = authParams();
      qs.set("query", String(query ?? ""));
      qs.set("limit", String(limit));
      qs.set("intent", "checkin");
      if (typeof lat === "number" && typeof lng === "number") qs.set("ll", `${lat},${lng}`);
      const response = await fsqFetchV2(`${FSQ_V2_BASE}/venues/search?${qs}`) as { venues?: Array<Record<string, unknown>> };
      return { venues: Array.isArray(response?.venues) ? response.venues.map(mapV2Venue) : [] };
    }

    case "search_text": {
      const { query, limit = 10 } = params;
      const qs = authParams();
      qs.set("query", String(query ?? ""));
      qs.set("limit", String(limit));
      qs.set("near", "world");
      qs.set("intent", "global");
      const response = await fsqFetchV2(`${FSQ_V2_BASE}/venues/search?${qs}`) as { venues?: Array<Record<string, unknown>> };
      return { venues: Array.isArray(response?.venues) ? response.venues.map(mapV2Venue) : [] };
    }

    case "get_photos": {
      const { venue_id, limit = 1 } = params;
      const qs = authParams();
      qs.set("limit", String(limit));
      const response = await fsqFetchV2(`${FSQ_V2_BASE}/venues/${venue_id}/photos?${qs}`) as { photos?: { items?: Array<Record<string, unknown>> } };
      const items = Array.isArray(response?.photos?.items)
        ? response.photos.items
            .map((photo) => toV3Photo(photo))
            .filter((photo): photo is CanonicalVenuePhoto => Boolean(photo))
        : [];
      return { photos: items };
    }

    default:
      return emptyData(action);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const action = body?.action as Action | undefined;
    const params = (body?.params as Record<string, unknown> | undefined) ?? {};

    if (!action) {
      return jsonResponse({ error: "Missing action" }, 400);
    }

    if (!["search_nearby", "get_details", "search_by_query", "search_text", "get_photos"].includes(action)) {
      return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }

    try {
      const data = await executeAction(action, params);
      return jsonResponse({ data });
    } catch (error) {
      console.error("[FOURSQUARE-PLACES] Recoverable upstream error", {
        action,
        error: error instanceof Error ? error.message : String(error),
      });
      return buildRecoverableResponse(action, error instanceof Error ? error.message : "Foursquare request failed");
    }
  } catch (error) {
    console.error("[FOURSQUARE-PLACES] Unexpected error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
