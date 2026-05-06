// =============================================================================
// types.ts — Shared types for the backend orchestrator (Phase 2 mirror).
// =============================================================================
//
// These are permissive subsets of the frontend types. Source files:
//   - src/services/aiMessageParser.ts (ParsedTravelRequest, PlannerEditIntent)
//   - src/features/trip-planner/types.ts (TripPlannerState et al.)
//   - src/features/chat/types/contextState.ts (ContextState)
//
// We keep them permissive (`[key: string]: unknown` on top-level interfaces)
// so unknown frontend fields survive serialization to the edge function and
// back without TS errors. The orchestrator only reads the fields explicitly
// declared here; everything else is passthrough.
// =============================================================================

// ---------------------------------------------------------------------------
// PlannerEditIntent — kept narrow because routeRequest.ts:150 compares
// `parsed.itinerary?.editIntent === true`, a boolean check on what is
// nominally an object. We mirror the source typing as `unknown` so the
// comparison compiles unchanged.
// ---------------------------------------------------------------------------

export type PlannerEditIntent = unknown;

// ---------------------------------------------------------------------------
// ParsedTravelRequest — subset used by routeRequest, conversationOrchestrator
// and discoveryService.
// ---------------------------------------------------------------------------

export interface ParsedTravelRequest {
  requestType:
    | 'flights'
    | 'hotels'
    | 'packages'
    | 'services'
    | 'combined'
    | 'general'
    | 'missing_info_request'
    | 'itinerary';
  flights?: {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    tripType?: 'one_way' | 'round_trip' | 'multi_city';
    segments?: Array<{
      origin?: string;
      destination?: string;
      departureDate?: string;
      [key: string]: unknown;
    }>;
    adults: number;
    adultsExplicit?: boolean;
    children: number;
    infants?: number;
    [key: string]: unknown;
  };
  hotels?: {
    city: string;
    checkinDate: string;
    checkoutDate: string;
    adults: number;
    adultsExplicit?: boolean;
    children: number;
    infants?: number;
    segments?: Array<{
      id?: string;
      city?: string;
      checkinDate?: string;
      checkoutDate?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  packages?: {
    destination: string;
    [key: string]: unknown;
  };
  services?: {
    [key: string]: unknown;
  };
  itinerary?: {
    destinations: string[];
    days?: number;
    startDate?: string;
    endDate?: string;
    isFlexibleDates?: boolean;
    flexibleMonth?: string;
    flexibleYear?: number;
    travelers?: {
      adults?: number;
      children?: number;
      infants?: number;
    };
    editIntent?: PlannerEditIntent;
    [key: string]: unknown;
  };
  placeDiscoveryResult?: {
    ok?: boolean;
    intent?: string;
    destination?: {
      city?: string;
      country?: string | null;
      lat?: number | null;
      lng?: number | null;
    };
    categories?: string[];
    places?: Array<{
      placeId?: string;
      name: string;
      category?: string;
      lat?: number | null;
      lng?: number | null;
      photoUrl?: string | null;
      description?: string | null;
      source?: string | null;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  } | null;
  confidence: number;
  originalMessage: string;
  message?: string;
  missingFields?: string[];
  missingRequiredFields?: string[];
  needsMoreInfo?: boolean;
  pendingActionResolution?: {
    kind: 'awaiting_user_input' | 'awaiting_user_confirmation';
    for: string;
    ref?: { type: 'plan' | 'quote' | 'lead'; id: string };
    applied: Record<string, unknown>;
    complete: boolean;
    payload?: Record<string, unknown>;
  } | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// TripPlannerState subset — only the fields touched by conversationOrchestrator.
// Permissive on every interface so frontend additions don't break serialization.
// ---------------------------------------------------------------------------

export interface PlannerActivity {
  title: string;
  description?: string;
  tip?: string;
  category?: string;
  activityType?: string;
  photoUrls?: string[];
  [key: string]: unknown;
}

export interface PlannerRestaurant {
  name: string;
  type?: string;
  priceRange?: string;
  photoUrls?: string[];
  [key: string]: unknown;
}

export interface PlannerDay {
  city?: string;
  morning: PlannerActivity[];
  afternoon: PlannerActivity[];
  evening: PlannerActivity[];
  restaurants: PlannerRestaurant[];
  [key: string]: unknown;
}

export interface SegmentHotelPlan {
  searchStatus?: string;
  matchStatus?: string;
  selectedHotelId?: string;
  selectedPlaceCandidate?: unknown;
  confirmedInventoryHotel?: unknown;
  hotelRecommendations?: unknown[];
  [key: string]: unknown;
}

export interface PlannerTransport {
  type?: string;
  summary?: string;
  searchStatus?: string;
  selectedOptionId?: string;
  options?: unknown[];
  [key: string]: unknown;
}

export interface PlannerSegment {
  id: string;
  city: string;
  country?: string;
  order?: number;
  startDate?: string;
  endDate?: string;
  nights?: number;
  days: PlannerDay[];
  hotelPlan?: SegmentHotelPlan;
  transportIn?: PlannerTransport | null;
  transportOut?: PlannerTransport | null;
  [key: string]: unknown;
}

export interface TripPlannerState {
  id?: string;
  title?: string;
  summary?: string;
  startDate?: string;
  endDate?: string;
  isFlexibleDates?: boolean;
  flexibleMonth?: string;
  flexibleYear?: number;
  days?: number;
  travelers: {
    adults: number;
    children: number;
    infants: number;
  };
  destinations?: string[];
  origin?: string;
  originCountry?: string;
  segments: PlannerSegment[];
  generationMeta?: {
    isDraft?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// ContextState subset — orchestrator only reads lastSearch.{flights,hotels}Params.
// ---------------------------------------------------------------------------

export interface FlightContextParams {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  infants?: number;
  [key: string]: unknown;
}

export interface HotelContextParams {
  city?: string;
  checkinDate?: string;
  checkoutDate?: string;
  adults?: number;
  children?: number;
  infants?: number;
  [key: string]: unknown;
}

export interface ContextState {
  lastSearch?: {
    flightsParams?: FlightContextParams;
    hotelsParams?: HotelContextParams;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
