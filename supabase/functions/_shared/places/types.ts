export type PlannerPlaceCategory =
  | 'hotel'
  | 'restaurant'
  | 'cafe'
  | 'museum'
  | 'activity'
  | 'sights'
  | 'nightlife'
  | 'parks'
  | 'shopping'
  | 'culture';

export type PlannerActivityType =
  | 'museum'
  | 'landmark'
  | 'walk'
  | 'food'
  | 'market'
  | 'nightlife'
  | 'shopping'
  | 'nature'
  | 'family'
  | 'wellness'
  | 'transport'
  | 'hotel'
  | 'viewpoint'
  | 'culture'
  | 'experience'
  | 'unknown';

export type PlaceSource = 'foursquare' | 'wikipedia' | 'inventory';

export interface PlacesLocation {
  lat: number;
  lng: number;
}

export interface PlannerPlaceCandidate {
  placeId: string;
  name: string;
  formattedAddress?: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrls: string[];
  types?: string[];
  lat?: number;
  lng?: number;
  website?: string;
  phoneNumber?: string;
  openingHours?: string[];
  isOpenNow?: boolean;
  category: PlannerPlaceCategory;
  activityType?: PlannerActivityType;
  source?: PlaceSource;
}

export interface PlannerPlaceHotelCandidate extends PlannerPlaceCandidate {
  category: 'hotel';
  hotelId?: string;
  hotel?: Record<string, unknown> | null;
  provider?: string;
}

export interface PlaceReview {
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
}

export interface PlaceDetails {
  placeId: string;
  source?: PlaceSource;
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
  reviews?: PlaceReview[];
  types?: string[];
  freshness?: string;
}

export interface PlacesViewportRequest {
  city: string;
  location: PlacesLocation;
  categories?: PlannerPlaceCategory[];
  radius?: number;
  limit?: number;
  /** Multi-point mode: search multiple locations in a single invocation. */
  searchPoints?: Array<{ location: PlacesLocation; radius?: number }>;
}

export interface PlaceSummaryRequest {
  placeId?: string;
  title: string;
  city: string;
  category?: PlannerPlaceCategory;
  locationBias?: PlacesLocation;
}

export interface PlaceDetailsRequest {
  placeId?: string;
  title: string;
  city: string;
  locationBias?: PlacesLocation;
}

export interface PlacePhotosRequest {
  placeId: string;
  limit?: number;
  size?: 'thumb' | 'hero' | 'gallery';
}

export interface PlaceRecommendationsRequest {
  destinations: string[];
  limitPerCity?: number;
}

export interface PlaceHotelCandidatesRequest {
  city: string;
  hotels: Array<{
    name: string;
    address?: string;
    hotel_id?: string;
    city?: string;
  }>;
  locationBias?: PlacesLocation;
  limit?: number;
}

export interface PlacesResponseMeta {
  provider: 'foursquare';
  cacheStatus: 'hit' | 'miss' | 'stale';
  requestId: string;
  fallbackUsed?: boolean;
  /** Actual Foursquare API calls made in this invocation. */
  providerCalls?: number;
}

export interface PlacesViewportResponse {
  placesByCategory: Partial<Record<PlannerPlaceCategory, PlannerPlaceCandidate[]>>;
  /** True when some point×category tasks failed or timed out. */
  partial?: boolean;
}

export interface PlaceRecommendationsResponse {
  destinations: Array<{
    city: string;
    places: PlannerPlaceCandidate[];
  }>;
}

export interface PlacePhotosResponse {
  placeId: string;
  photoUrls: string[];
}
