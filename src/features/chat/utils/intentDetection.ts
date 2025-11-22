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
export const isAddHotelRequest = (text: string): boolean => {
  const norm = normalizeText(text);

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

  const hotelKeywords = [
    'agrega un hotel', 'agregale un hotel', 'agregar un hotel', 'sumale un hotel', 'añade un hotel',
    'agrega hotel', 'agregale hotel', 'sumale hotel', 'añade hotel', 'agregar hotel', 'agregame un hotel'
  ];
  return hotelKeywords.some(k => norm.includes(k)) || (norm.includes('hotel') && norm.includes('misma')); // e.g., "hotel mismas fechas"
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

    // "precio total/del vuelo/del hotel [a/en] [number]"
    /\bprecio\s+(total|del\s+(vuelo|hotel|paquete))\s*(a|en|por)?\s*[\d$]/i,

    // "que cueste/cuesta/debe costar [number]"
    /\b(que|debe|deberia|tiene\s+que)\s+(cueste?|costar?)\s*[\d$]/i,

    // Positional price changes: "primer/segundo/tercer/cuarto precio [a] [number]"
    /\b(primer[ao]?|segundo?[ao]?|tercer[ao]?|cuarto?[ao]?)\s+precio\s*(a|al|en)?\s*[\d$]/i,

    // Positional with "al": "al primer/segundo [number]"
    /\bal\s+(primer[ao]?|segundo?[ao]?|tercer[ao]?|cuarto?[ao]?|[1-4])\s+(?:vuelo\s+)?[\d$]/i,

    // Direct price patterns: "precio 1/2/3/4 [a] [number]"
    /\bprecio\s+[1-4]\s*(a|al|en)?\s*[\d$]/i,

    // Hotel-specific: "hotel [a/por/en] $X"
    /\bhotel\s+(a|por|en)\s*[$\d]/i
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