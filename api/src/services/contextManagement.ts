/**
 * Context Management Helper
 *
 * Determina qué acción tomar con el contexto después de cada búsqueda
 * y genera sugerencias de follow-up para el tercero.
 */

export interface ParsedRequest {
  type: 'flights' | 'hotels' | 'combined' | 'packages' | 'services' | 'itinerary' | 'general' | 'missing_info_request';
  flights?: any;
  hotels?: any;
  packages?: any;
  services?: any;
  itinerary?: any;
  confidence?: number;
  originalMessage?: string;
  message?: string;
  missingFields?: string[];
}

export interface SearchResults {
  status: 'completed' | 'incomplete' | 'error';
  type?: 'flights' | 'hotels' | 'combined' | 'packages' | 'services' | 'itinerary';
  flights?: {
    count: number;
    items: any[];
  };
  hotels?: {
    count: number;
    items: any[];
  };
  packages?: {
    count: number;
    items: any[];
  };
  services?: {
    count: number;
    items: any[];
  };
  itinerary?: any;
  metadata?: any;
  error?: {
    message: string;
    details?: any;
  };
}

export interface ContextManagement {
  action: 'merge' | 'replace' | 'clear';
  persist_for_next_request: any;
  suggested_followups: Array<{
    type: string;
    prompt_example: string;
  }>;
}

/**
 * Determine context action based on parsed request and search results
 */
export function determineContextAction(
  parsedRequest: ParsedRequest,
  searchResults: SearchResults
): ContextManagement {
  // Case 1: Incomplete request (missing required fields)
  if (searchResults.status === 'incomplete') {
    return {
      action: 'merge',
      persist_for_next_request: buildPartialContext(parsedRequest),
      suggested_followups: []
    };
  }

  // Case 2: Error in search
  if (searchResults.status === 'error') {
    return {
      action: 'merge',
      persist_for_next_request: buildPartialContext(parsedRequest),
      suggested_followups: []
    };
  }

  // Case 3: Successful search
  if (searchResults.status === 'completed') {
    // Case 3a: Combined search (flights + hotels) → Clear context
    if (parsedRequest.type === 'combined' && searchResults.type === 'combined') {
      return {
        action: 'clear',
        persist_for_next_request: null,
        suggested_followups: [
          { type: 'new_search', prompt_example: 'buscar otro destino' },
          { type: 'cheaper', prompt_example: 'buscar más económico' }
        ]
      };
    }

    // Case 3b: Flight-only search → Replace context with flight data (allow hotel follow-up)
    if (parsedRequest.type === 'flights' && searchResults.flights && searchResults.flights.count > 0) {
      return {
        action: 'replace',
        persist_for_next_request: {
          flights: extractFlightContext(parsedRequest.flights)
        },
        suggested_followups: [
          { type: 'hotels', prompt_example: 'agregar hotel' },
          { type: 'cheaper', prompt_example: 'buscar vuelo más económico' },
          { type: 'different_dates', prompt_example: 'cambiar fechas' },
          { type: 'different_airline', prompt_example: 'buscar con otra aerolínea' }
        ]
      };
    }

    // Case 3c: Hotel-only search → Replace context with hotel data
    if (parsedRequest.type === 'hotels' && searchResults.hotels && searchResults.hotels.count > 0) {
      return {
        action: 'replace',
        persist_for_next_request: {
          hotels: extractHotelContext(parsedRequest.hotels)
        },
        suggested_followups: [
          { type: 'cheaper', prompt_example: 'buscar hotel más económico' },
          { type: 'different_dates', prompt_example: 'cambiar fechas' },
          { type: 'different_hotel', prompt_example: 'buscar otro hotel' }
        ]
      };
    }

    // Case 3d: Search returned no results → Keep context for refinement
    if (
      (searchResults.flights && searchResults.flights.count === 0) ||
      (searchResults.hotels && searchResults.hotels.count === 0)
    ) {
      return {
        action: 'merge',
        persist_for_next_request: buildPartialContext(parsedRequest),
        suggested_followups: [
          { type: 'different_dates', prompt_example: 'probar con otras fechas' },
          { type: 'flexible_search', prompt_example: 'buscar con más flexibilidad' }
        ]
      };
    }
  }

  // Default: merge context
  return {
    action: 'merge',
    persist_for_next_request: buildPartialContext(parsedRequest),
    suggested_followups: []
  };
}

/**
 * Build partial context from incomplete request
 */
function buildPartialContext(parsedRequest: ParsedRequest): any {
  const context: any = {};

  if (parsedRequest.flights) {
    context.flights = {
      ...parsedRequest.flights
    };
  }

  if (parsedRequest.hotels) {
    context.hotels = {
      ...parsedRequest.hotels
    };
  }

  if (parsedRequest.packages) {
    context.packages = {
      ...parsedRequest.packages
    };
  }

  if (parsedRequest.services) {
    context.services = {
      ...parsedRequest.services
    };
  }

  return context;
}

/**
 * Extract relevant flight context for follow-up requests
 */
function extractFlightContext(flightData: any): any {
  return {
    origin: flightData.origin,
    destination: flightData.destination,
    departure_date: flightData.departureDate || flightData.departure_date,
    return_date: flightData.returnDate || flightData.return_date,
    adults: flightData.adults,
    children: flightData.children || 0,   // Niños 2-12 años (CHD)
    infants: flightData.infants || 0,     // Infantes 0-2 años (INF)
    // Optional fields (preserve if exist)
    ...(flightData.luggage && { luggage: flightData.luggage }),
    ...(flightData.stops && { stops: flightData.stops }),
    ...(flightData.preferredAirline && { preferredAirline: flightData.preferredAirline }),
    ...(flightData.maxLayoverHours && { maxLayoverHours: flightData.maxLayoverHours })
  };
}

/**
 * Extract relevant hotel context for follow-up requests
 */
function extractHotelContext(hotelData: any): any {
  return {
    city: hotelData.city,
    checkin_date: hotelData.checkinDate || hotelData.checkin_date,
    checkout_date: hotelData.checkoutDate || hotelData.checkout_date,
    adults: hotelData.adults,
    children: hotelData.children || 0,   // Niños 2-12 años
    infants: hotelData.infants || 0,     // Infantes 0-2 años
    // Optional fields (preserve if exist)
    ...(hotelData.roomType && { roomType: hotelData.roomType }),
    ...(hotelData.mealPlan && { mealPlan: hotelData.mealPlan }),
    ...(hotelData.hotelChains && { hotelChains: hotelData.hotelChains }),
    ...(hotelData.hotelChain && { hotelChain: hotelData.hotelChain }), // Legacy support
    ...(hotelData.hotelName && { hotelName: hotelData.hotelName })
  };
}

/**
 * Determine if a request should clear previous context
 * (Used for detecting completely new searches)
 */
export function shouldClearContext(
  parsedRequest: ParsedRequest,
  previousContext: any
): boolean {
  // No previous context → nothing to clear
  if (!previousContext) {
    return false;
  }

  // Completely different request type → clear
  if (parsedRequest.type === 'general' || parsedRequest.type === 'itinerary') {
    return true;
  }

  // New flight search with different origin/destination → clear
  if (
    parsedRequest.type === 'flights' &&
    previousContext.flights &&
    (
      parsedRequest.flights?.origin !== previousContext.flights.origin ||
      parsedRequest.flights?.destination !== previousContext.flights.destination
    )
  ) {
    return true;
  }

  // New hotel search with different city → clear
  if (
    parsedRequest.type === 'hotels' &&
    previousContext.hotels &&
    parsedRequest.hotels?.city !== previousContext.hotels.city
  ) {
    return true;
  }

  return false;
}
