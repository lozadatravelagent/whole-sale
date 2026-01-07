/**
 * Iteration Detection for API Gateway
 *
 * Detects when a user is modifying a previous search rather than starting a new one.
 * Ported from src/features/chat/utils/iterationDetection.ts
 *
 * Use cases:
 * - "lo mismo pero con hotel RIU" → Preserve flight, update hotel chain
 * - "el mismo pero sin escalas" → Preserve origin/dest/dates, change stops
 * - "con Iberia" → Preserve all, add airline filter
 */

// =============================================================================
// TYPES
// =============================================================================

export interface FlightParams {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  stops?: string;
  preferredAirline?: string;
  luggage?: string;
  maxLayoverHours?: number;
}

export interface HotelParams {
  city?: string;
  checkinDate?: string;
  checkoutDate?: string;
  adults?: number;
  children?: number;
  roomType?: string;
  mealPlan?: string;
  hotelChains?: string[];
  hotelName?: string;
}

export interface ContextState {
  lastSearch?: {
    requestType: 'flights' | 'hotels' | 'combined' | 'packages' | 'services';
    timestamp?: string;
    flightsParams?: FlightParams;
    hotelsParams?: HotelParams;
  };
  turnNumber?: number;
}

export interface IterationResult {
  isIteration: boolean;
  iterationType?: 'hotel_modification' | 'flight_modification' | 'constraint_update';
  confidence: number;
  modifiedComponent?: 'hotel' | 'flight' | 'both';
}

export interface ParsedRequest {
  type: string;
  flights?: any;
  hotels?: any;
  [key: string]: any;
}

// =============================================================================
// DETECTION PATTERNS
// =============================================================================

// Patterns that indicate reference to previous search
const CONTEXT_REFERENCE_PATTERNS = [
  /\bmisma\s+b[uú]squeda\b/i,
  /\bmismo\s+vuelo\b/i,
  /\bmismo\s+hotel\b/i,
  /\blo\s+mismo\s+pero\b/i,
  /\bla\s+misma\s+pero\b/i,
  /\bigual\s+pero\b/i,
  /\bcomo\s+antes\b/i,
  /\brepet[íi]\b/i,
  /\bel\s+mismo\s+pero\b/i,
  /\bla\s+misma\s+b[uú]squeda\b/i
];

// Patterns that indicate hotel modification
const HOTEL_MODIFICATION_PATTERNS = [
  /\bpero\s+con\s+hotel\b/i,
  /\bcambiar\s+el?\s+hotel\b/i,
  /\botro\s+hotel\b/i,
  /\bcon\s+cadena\b/i,
  /\bcadena\s+\w+/i,
  /\bhotel\s+(riu|iberostar|melia|barcelo|bahia|secrets|dreams|excellence|paradisus|hard\s*rock|royalton|occidental|palladium|catalonia|sunscape|majestic|chic|lopesan|trs|now|hideaway)/i,
  /\b(todo\s+incluido|all\s+inclusive)\b/i,
  /\b(\d+)\s+estrellas?\b/i
];

// Patterns that indicate flight modification
const FLIGHT_MODIFICATION_PATTERNS = [
  /\bcon\s+escalas?\b/i,
  /\bsin\s+escalas?\b/i,
  /\bdirecto\b/i,
  /\buna?\s+escala\b/i,
  /\bdos\s+escalas?\b/i,
  /\bcon\s+valija\b/i,
  /\bcon\s+equipaje\b/i,
  /\bcarry[\s-]?on\b/i,
  /\bsolo\s+equipaje\s+de\s+mano\b/i,
  /\bcon\s+(iberia|latam|avianca|aeromexico|copa|american|united|delta|air\s*europa|level|jetsmart|flybondi|aerolineas)\b/i,
  /\ben\s+(iberia|latam|avianca|aeromexico|copa|american|united|delta|air\s*europa|level|jetsmart|flybondi|aerolineas)\b/i,
  /\bescalas?\s+m[aá]xim[ao]?\s+de?\s+(\d+)\s*h/i,
  /\bm[aá]xim[ao]?\s+(\d+)\s*h(oras?)?\s+de?\s+escala/i,
  // ✨ Horarios de salida
  /\b(que\s+)?(?:salga|sal[íi]|vuele)\s+(?:de\s+)?(?:la\s+)?(mañana|manana|tarde|noche|madrugada|dia|d[íi]a|temprano)\b/i,
  // ✨ Horarios de llegada
  /\b(que\s+)?(?:llegue|vuelva|regrese)\s+(?:de\s+)?(?:la\s+)?(mañana|manana|tarde|noche|dia|d[íi]a)\b/i,
  // ✨ Máximo de escalas (duración)
  /\bescalas?\s+(?:de\s+)?(?:no\s+)?m[aá]s\s+(?:de\s+)?(\d+)\s*(?:h|hs|hora|horas)\b/i
];

// Patterns that indicate a NEW search (not iteration)
const NEW_SEARCH_PATTERNS = [
  /\bquiero\s+(un\s+)?(otro\s+)?vuelo\s+(a|desde|para)\b/i,
  /\bbusca(me)?\s+(un\s+)?vuelo\s+(a|desde|para)\b/i,
  /\bvuelo\s+(a|desde|para)\s+\w+\s+del?\s+\d/i,
  /\bhoteles?\s+en\s+\w+\s+del?\s+\d/i
];

// =============================================================================
// AIRLINE DETECTION
// =============================================================================

const AIRLINE_ALIASES: Record<string, string> = {
  // LATAM Group
  'latam': 'LA', 'lan': 'LA', 'tam': 'LA',
  // Iberia / IAG
  'iberia': 'IB', 'air europa': 'UX', 'level': 'IB',
  // Avianca
  'avianca': 'AV',
  // Aeromexico
  'aeromexico': 'AM', 'aeroméxico': 'AM',
  // Copa
  'copa': 'CM',
  // American
  'american': 'AA', 'american airlines': 'AA',
  // United
  'united': 'UA', 'united airlines': 'UA',
  // Delta
  'delta': 'DL', 'delta airlines': 'DL',
  // Low cost Argentina
  'jetsmart': 'JA', 'jet smart': 'JA',
  'flybondi': 'FO', 'fly bondi': 'FO',
  // Aerolineas Argentinas
  'aerolineas': 'AR', 'aerolíneas': 'AR', 'aerolineas argentinas': 'AR'
};

function detectAirlineInMessage(message: string): string | null {
  const lowerMessage = message.toLowerCase();

  for (const [alias, code] of Object.entries(AIRLINE_ALIASES)) {
    if (lowerMessage.includes(alias)) {
      return code;
    }
  }

  return null;
}

// =============================================================================
// MAIN DETECTION FUNCTION
// =============================================================================

/**
 * Detect if the current message is an iteration on a previous search
 */
export function detectIterationIntent(
  message: string,
  previousContext: ContextState | null
): IterationResult {
  // No previous context = can't be an iteration
  if (!previousContext?.lastSearch) {
    return { isIteration: false, confidence: 0 };
  }

  // Check for NEW search patterns first (these override iteration detection)
  for (const pattern of NEW_SEARCH_PATTERNS) {
    if (pattern.test(message)) {
      console.log('[ITERATION] Detected NEW search pattern, not an iteration');
      return { isIteration: false, confidence: 0.9 };
    }
  }

  // Check for context reference patterns
  const hasContextRef = CONTEXT_REFERENCE_PATTERNS.some(p => p.test(message));

  // Check for hotel modification patterns
  const hasHotelMod = HOTEL_MODIFICATION_PATTERNS.some(p => p.test(message));

  // Check for flight modification patterns
  const hasFlightMod = FLIGHT_MODIFICATION_PATTERNS.some(p => p.test(message));

  // Determine if this is an iteration
  if (hasContextRef || hasHotelMod || hasFlightMod) {
    let iterationType: IterationResult['iterationType'];
    let modifiedComponent: IterationResult['modifiedComponent'];
    let confidence = 0.5;

    if (hasContextRef) {
      confidence += 0.3;
    }

    if (hasHotelMod && !hasFlightMod) {
      iterationType = 'hotel_modification';
      modifiedComponent = 'hotel';
      confidence += 0.15;
    } else if (hasFlightMod && !hasHotelMod) {
      iterationType = 'flight_modification';
      modifiedComponent = 'flight';
      confidence += 0.15;
    } else if (hasHotelMod && hasFlightMod) {
      iterationType = 'constraint_update';
      modifiedComponent = 'both';
      confidence += 0.1;
    } else {
      iterationType = 'constraint_update';
      modifiedComponent = previousContext.lastSearch.requestType === 'flights' ? 'flight' : 'hotel';
    }

    console.log(`[ITERATION] Detected iteration: type=${iterationType}, component=${modifiedComponent}, confidence=${confidence.toFixed(2)}`);

    return {
      isIteration: true,
      iterationType,
      confidence: Math.min(confidence, 1),
      modifiedComponent
    };
  }

  return { isIteration: false, confidence: 0 };
}

// =============================================================================
// MERGE FUNCTION
// =============================================================================

/**
 * Merge new parsed request with previous context based on iteration type
 */
export function mergeIterationContext(
  newParsedRequest: ParsedRequest,
  previousContext: ContextState,
  iterationResult: IterationResult,
  originalMessage: string
): ParsedRequest {
  if (!iterationResult.isIteration || !previousContext.lastSearch) {
    return newParsedRequest;
  }

  const { lastSearch } = previousContext;
  const merged: ParsedRequest = { ...newParsedRequest };

  console.log(`[ITERATION_MERGE] Merging with previous ${lastSearch.requestType} search`);

  // CASE 1: Hotel modification on combined/flight search
  if (iterationResult.iterationType === 'hotel_modification') {
    // Preserve flight params from previous search
    if (lastSearch.flightsParams) {
      merged.flights = {
        ...lastSearch.flightsParams,
        ...(newParsedRequest.flights || {})
      };
      console.log('[ITERATION_MERGE] Preserved flight params from previous search');
    }

    // Update hotel params with new modifications
    merged.hotels = {
      ...(lastSearch.hotelsParams || {}),
      ...(newParsedRequest.hotels || {}),
      // If previous was combined, use flight destination as hotel city
      city: newParsedRequest.hotels?.city || lastSearch.hotelsParams?.city || lastSearch.flightsParams?.destination
    };

    // Force combined type if we have both flight and hotel data
    if (merged.flights && merged.hotels) {
      merged.type = 'combined';
    }
  }

  // CASE 2: Flight modification (stops, luggage, airline)
  if (iterationResult.iterationType === 'flight_modification') {
    // Preserve all flight params and override specific modifications
    merged.flights = {
      ...lastSearch.flightsParams,
      ...(newParsedRequest.flights || {})
    };

    // Detect specific modifications from message
    // Direct flight request
    if (/\bdirecto\b/i.test(originalMessage) || /\bsin\s+escalas?\b/i.test(originalMessage)) {
      merged.flights.stops = 'direct';
      console.log('[ITERATION_MERGE] Applied: stops=direct');
    }

    // With stops request
    if (/\bcon\s+escalas?\b/i.test(originalMessage)) {
      merged.flights.stops = 'with_stops';
      console.log('[ITERATION_MERGE] Applied: stops=with_stops');
    }

    // One stop
    if (/\buna?\s+escala\b/i.test(originalMessage)) {
      merged.flights.stops = 'one_stop';
      console.log('[ITERATION_MERGE] Applied: stops=one_stop');
    }

    // Luggage: checked
    if (/\bcon\s+(valija|equipaje)\b/i.test(originalMessage) && !/equipaje\s+de\s+mano/i.test(originalMessage)) {
      merged.flights.luggage = 'checked';
      console.log('[ITERATION_MERGE] Applied: luggage=checked');
    }

    // Luggage: carry-on
    if (/\bcarry[\s-]?on\b/i.test(originalMessage) || /\bequipaje\s+de\s+mano\b/i.test(originalMessage)) {
      merged.flights.luggage = 'carry_on';
      console.log('[ITERATION_MERGE] Applied: luggage=carry_on');
    }

    // Airline preference
    const detectedAirline = detectAirlineInMessage(originalMessage);
    if (detectedAirline) {
      merged.flights.preferredAirline = detectedAirline;
      console.log(`[ITERATION_MERGE] Applied: preferredAirline=${detectedAirline}`);
    }

    // Max layover hours
    const layoverMatch = originalMessage.match(/escalas?\s+m[aá]xim[ao]?\s+de?\s+(\d+)\s*h/i) ||
                         originalMessage.match(/m[aá]xim[ao]?\s+(\d+)\s*h(oras?)?\s+de?\s+escala/i);
    if (layoverMatch) {
      merged.flights.maxLayoverHours = parseInt(layoverMatch[1]);
      console.log(`[ITERATION_MERGE] Applied: maxLayoverHours=${merged.flights.maxLayoverHours}`);
    }

    // Preserve hotel params if previous was combined
    if (lastSearch.requestType === 'combined' && lastSearch.hotelsParams) {
      merged.hotels = {
        ...lastSearch.hotelsParams,
        ...(newParsedRequest.hotels || {})
      };
      merged.type = 'combined';
    }
  }

  // CASE 3: Constraint update (both components)
  if (iterationResult.iterationType === 'constraint_update') {
    // Preserve both and merge modifications
    if (lastSearch.flightsParams) {
      merged.flights = {
        ...lastSearch.flightsParams,
        ...(newParsedRequest.flights || {})
      };
    }
    if (lastSearch.hotelsParams) {
      merged.hotels = {
        ...lastSearch.hotelsParams,
        ...(newParsedRequest.hotels || {})
      };
    }

    // Determine type based on what we have
    if (merged.flights && merged.hotels) {
      merged.type = 'combined';
    } else if (merged.flights) {
      merged.type = 'flights';
    } else if (merged.hotels) {
      merged.type = 'hotels';
    }
  }

  console.log(`[ITERATION_MERGE] Final request type: ${merged.type}`);
  return merged;
}

// =============================================================================
// CONTEXT BUILDER
// =============================================================================

/**
 * Build context state from a completed search for future iterations
 */
export function buildContextFromSearch(
  parsedRequest: ParsedRequest,
  previousTurnNumber?: number
): ContextState {
  const context: ContextState = {
    turnNumber: (previousTurnNumber || 0) + 1,
    lastSearch: {
      requestType: parsedRequest.type as any,
      timestamp: new Date().toISOString()
    }
  };

  if (parsedRequest.flights) {
    context.lastSearch!.flightsParams = {
      origin: parsedRequest.flights.origin,
      destination: parsedRequest.flights.destination,
      departureDate: parsedRequest.flights.departureDate,
      returnDate: parsedRequest.flights.returnDate,
      adults: parsedRequest.flights.adults,
      children: parsedRequest.flights.children,
      stops: parsedRequest.flights.stops,
      preferredAirline: parsedRequest.flights.preferredAirline,
      luggage: parsedRequest.flights.luggage,
      maxLayoverHours: parsedRequest.flights.maxLayoverHours
    };
  }

  if (parsedRequest.hotels) {
    context.lastSearch!.hotelsParams = {
      city: parsedRequest.hotels.city,
      checkinDate: parsedRequest.hotels.checkinDate,
      checkoutDate: parsedRequest.hotels.checkoutDate,
      adults: parsedRequest.hotels.adults,
      children: parsedRequest.hotels.children,
      roomType: parsedRequest.hotels.roomType,
      mealPlan: parsedRequest.hotels.mealPlan,
      hotelChains: parsedRequest.hotels.hotelChains,
      hotelName: parsedRequest.hotels.hotelName
    };
  }

  return context;
}
