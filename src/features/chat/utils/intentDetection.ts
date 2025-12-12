import { useCallback } from 'react';

// Helper: normalize text removing diacritics and trimming spaces for robust intent detection
export const normalizeText = (text: string): string => {
  try {
    return text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return text.toLowerCase();
  }
};

// Helper: detect intent to add a hotel to existing flight search
// This should ONLY trigger for follow-up messages, not initial combined requests
// NOTE: This function is now complemented by iterationDetection.ts for more complex patterns
// IMPORTANT: Iteration patterns should be handled by iterationDetection.ts, not here
export const isAddHotelRequest = (text: string): boolean => {
  const norm = normalizeText(text);

  // === EXCLUSION: Iteration patterns should be handled by iterationDetection.ts ===
  // These patterns indicate a modification to an existing search, not "add hotel"
  const isIterationPattern = (
    norm.includes('misma busqueda') ||      // "quiero la misma búsqueda pero..."
    norm.includes('lo mismo pero') ||        // "lo mismo pero con hotel X"
    norm.includes('igual pero') ||           // "igual pero con hotel Y"
    norm.includes('mismo vuelo') ||          // "mismo vuelo pero hotel Z"
    norm.includes('mismos vuelos') ||        // "mismos vuelos pero..."
    norm.includes('cambiar el hotel') ||     // "cambiar el hotel por X"
    norm.includes('cambia el hotel') ||      // "cambia el hotel a Y"
    /\bpero\s+(?:con\s+)?hotel\b/i.test(norm)  // "pero con hotel X" / "pero hotel X"
  );
  
  if (isIterationPattern) {
    return false; // Let iterationDetection.ts handle this
  }

  // If the message contains flight details (origin, destination, dates), it's likely a combined request, not an "add hotel" request
  const hasFlightDetails = (
    // Has origin indicator
    norm.includes('desde') &&
    // Has destination indicator  
    (norm.includes('a ') || norm.includes('para ')) &&
    // Has flight-related keywords
    (norm.includes('vuelo') || norm.includes('semana') || norm.includes('mes') || norm.includes('día') ||
      norm.includes('enero') || norm.includes('febrero') || norm.includes('marzo') || norm.includes('abril') ||
      norm.includes('mayo') || norm.includes('junio') || norm.includes('julio') || norm.includes('agosto') ||
      norm.includes('septiembre') || norm.includes('octubre') || norm.includes('noviembre') || norm.includes('diciembre'))
  );

  if (hasFlightDetails) {
    return false; // This is likely a combined request, not an "add hotel" request
  }

  // Primary patterns: explicit "add hotel" requests (simple addition, not modification)
  const addHotelKeywords = [
    'agrega un hotel', 'agregale un hotel', 'agregar un hotel', 'sumale un hotel', 'añade un hotel',
    'agrega hotel', 'agregale hotel', 'sumale hotel', 'añade hotel', 'agregar hotel', 'agregame un hotel',
    'incluir hotel', 'incluime hotel', 'con hotel tambien', 'con hotel también'
  ];
  
  if (addHotelKeywords.some(k => norm.includes(k))) {
    return true;
  }
  
  // Pattern: "hotel" + reference to dates (not search modification)
  // NOTE: Removed "misma/mismo" patterns - those are iterations now
  if (norm.includes('hotel') && (
    norm.includes('esas fechas') || norm.includes('esos dias') ||
    norm.includes('para las fechas') || norm.includes('para esas')
  )) {
    return true;
  }

  return false;
};

// Helper: detect intent to modify/change hotel in an existing combined search
// This is used for iteration detection - when user wants to change only the hotel
// NOTE: More comprehensive detection is done in iterationDetection.ts
export const isHotelIterationRequest = (text: string): boolean => {
  const norm = normalizeText(text);

  // If it has new flight details, it's not a hotel-only iteration
  const hasNewFlightDetails = (
    /\bdesde\s+\w+\s+(?:a|para|hasta)\s+\w+\b/i.test(norm) ||
    /\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(norm)
  );

  if (hasNewFlightDetails) {
    return false;
  }

  // Patterns that indicate hotel modification/iteration
  const iterationPatterns = [
    // "misma búsqueda pero con hotel X"
    /\b(mism[ao]s?\s+busqueda|misma\s+consulta)\s+(pero\s+)?(con\s+)?hotel/i,
    // "mismo vuelo pero/y hotel X"
    /\b(mismo\s+vuelo|mismos\s+vuelos)\s+(pero|y|con)\s+hotel/i,
    // "cambiar/cambiá el hotel"
    /\b(cambi[aáe]r?|cambia)\s+(el\s+)?hotel/i,
    // "otro hotel"
    /\b(otro\s+hotel|diferente\s+hotel)/i,
    // "quiero hotel X" after context (without flight params)
    /\b(quiero|prefiero)\s+(un\s+)?(hotel\s+)?(cadena\s+)?(\w+)\s*$/i,
    // "lo mismo pero con hotel X"
    /\b(lo\s+mismo|la\s+misma)\s+(pero\s+)?(con\s+)?hotel/i,
  ];

  return iterationPatterns.some(p => p.test(norm));
};

// Check if message is a cheaper flights search request
export const isCheaperFlightRequest = (message: string): boolean => {
  const norm = normalizeText(message);
  const flightKeywords = [
    'buscar vuelos mas baratos',
    'busca vuelos mas baratos',
    'buca vuelos mas baratos',
    'vuelos mas baratos',
    'opciones mas economicas',
    'vuelos mas economicos',
    'alternativas mas baratas',
    'opciones mas baratas',
    'vuelos alternativos',
    'mejores precios vuelos',
    'vuelos menos caros'
  ];
  return flightKeywords.some(keyword => norm.includes(keyword));
};

// Check if message is a price change request
// This function is EXCLUSIVE for PDF price modifications and should NOT trigger for flight/hotel searches
export const isPriceChangeRequest = (message: string): boolean => {
  const norm = normalizeText(message);

  // CRITICAL: Exclude messages that are clearly flight/hotel search requests
  // If message contains origin/destination patterns, it's a search, NOT a price change
  const isSearchRequest = (
    // Has "desde X a/para/hasta Y" pattern (flight search)
    /\bdesde\s+\w+\s+(a|para|hasta)\s+\w+/i.test(norm) ||
    // Has date patterns with "el" or month names without price change verbs
    (/\b(el|fecha|dia)\s+\d{1,2}\b/i.test(norm) && !/\b(cambiar?|modificar?|ajustar?)\b/i.test(norm)) ||
    // Has "buscar", "quiero", "necesito" + "vuelo/hotel" (search intent)
    (/\b(buscar?|quiero|necesito|mostrar?|ver)\s+(vuelo|hotel|pasaje)/i.test(norm))
  );

  if (isSearchRequest) {
    console.log('🚫 [PRICE CHANGE] Excluded - detected search request pattern');
    return false;
  }

  // Price change patterns using REGEX for flexibility
  const priceChangePatterns = [
    // Primary patterns: "cambiar/modificar/ajustar [el/ese/este] precio [a/por] [number]"
    /\b(cambiar?|modificar?|ajustar?|poner?)\s+(el|ese|este|ese)?\s*precio/i,

    // "precio total/del vuelo/del hotel/de hotel [a/en] [number]"
    /\bprecio\s+(total|del\s+(vuelo|hotel|paquete)|de\s+hotel)\s*(a|en|por)?\s*[\d$]/i,

    // Generic "precio a/por $X" or "precio a/por usd X"
    /\bprecio\s+(a|por)\s*([$]|\busd\b)/i,

    // "que cueste/cuesta/debe costar [number]"
    /\b(que|debe|deberia|tiene\s+que)\s+(cueste?|costar?)\s*[\d$]/i,

    // Standalone "cuesta $X" or "cuesta usd X"
    /\bcuesta\s*([$]|\busd\b)/i,

    // Positional price changes: "primer/segundo/tercer/cuarto precio [a] [number]"
    /\b(primer[ao]?|segundo?[ao]?|tercer[ao]?|cuarto?[ao]?)\s+precio\s*(a|al|en)?\s*[\d$]/i,

    // Positional flights: "primer/segundo/tercer/cuarto vuelo [number]"
    /\b(primer[ao]?|segundo?[ao]?|tercer[ao]?|cuarto?[ao]?)\s+vuelo\s+[\d$]/i,

    // Positional with "al": "al primer/segundo [vuelo] [number]"
    /\bal\s+(primer[ao]?|segundo?[ao]?|tercer[ao]?|cuarto?[ao]?|[1-4])\s+(?:vuelo\s+)?[\d$]/i,

    // Direct price patterns: "precio 1/2/3/4 [a] [number]"
    /\bprecio\s+[1-4]\s*(a|al|en)?\s*[\d$]/i,

    // Direct flight patterns: "vuelo 1/2/3/4 [number]"
    /\bvuelo\s+[1-4]\s+[\d$]/i,

    // Hotel-specific: "hotel [a/por/en] $X/usd"
    /\bhotel\s+(a|por|en)\s*([$\d]|\busd\b)/i,

    // Hotel-specific: "hotel cueste [number]"
    /\bhotel\s+cueste?\s*[\d$]/i
  ];

  // Check if any price change pattern matches
  const hasValidPattern = priceChangePatterns.some(pattern => pattern.test(norm));

  if (!hasValidPattern) {
    return false;
  }

  // CRITICAL: Must contain a number (price value) to be a valid price change request
  // This prevents false positives from generic "cambiar precio" without actual value
  const hasNumber = /\d+/.test(norm);

  if (!hasNumber) {
    console.log('🚫 [PRICE CHANGE] Excluded - no numeric value found in message');
    return false;
  }

  console.log('✅ [PRICE CHANGE] Detected valid price change request');
  return true;
};

// Extract price change target (total, hotel, or flight)
export const extractPriceChangeTarget = (message: string): 'total' | 'hotel' | 'flights' | 'unknown' => {
  const norm = normalizeText(message);

  // Check for hotel-specific price change
  if (norm.includes('precio del hotel') ||
      norm.includes('precio de hotel') ||
      norm.includes('hotel a $') ||
      norm.includes('hotel a usd') ||
      norm.includes('hotel cueste') ||
      norm.includes('hotel por $') ||
      norm.includes('hotel por usd')) {
    return 'hotel';
  }

  // Check for flight-specific price change
  if (norm.includes('precio del vuelo') ||
      norm.includes('precio de vuelo') ||
      norm.includes('vuelo a $') ||
      norm.includes('vuelo a usd') ||
      norm.includes('vuelo cueste') ||
      norm.includes('primer vuelo') ||
      norm.includes('segundo vuelo')) {
    return 'flights';
  }

  // Check for total/package price change
  if (norm.includes('precio total') ||
      norm.includes('total a $') ||
      norm.includes('total a usd') ||
      norm.includes('paquete a $') ||
      norm.includes('paquete a usd') ||
      norm.includes('todo a $') ||
      norm.includes('todo a usd') ||
      norm.includes('que cueste')) {
    return 'total';
  }

  // Default to total if just "cambia el precio"
  if (norm.includes('cambia el precio') || norm.includes('cambiar precio')) {
    return 'total';
  }

  return 'unknown';
};