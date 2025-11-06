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
export const isPriceChangeRequest = (message: string): boolean => {
  const norm = normalizeText(message);
  const priceKeywords = [
    'cambia el precio',
    'cambiar precio',
    'precio total',
    'que cueste',
    'quiero que el precio',
    'modifica el precio',
    'ajusta el precio',
    'precio a',
    'cuesta',
    '$',
    'dolar',
    'usd',
    // Individual price modification keywords
    'primer precio',
    'segundo precio',
    'tercer precio',
    'cuarto precio',
    'primer vuelo',
    'segundo vuelo',
    'tercer vuelo',
    'cuarto vuelo',
    'precio 1',
    'precio 2',
    'precio 3',
    'precio 4',
    'vuelo 1',
    'vuelo 2',
    'vuelo 3',
    'vuelo 4',
    // Hotel price keywords
    'precio del hotel',
    'precio de hotel',
    'hotel a',
    'hotel cueste',
    'hotel por'
  ];

  return priceKeywords.some(keyword => norm.includes(keyword));
};

// Extract price change target (total, hotel, or flight)
export const extractPriceChangeTarget = (message: string): 'total' | 'hotel' | 'flights' | 'unknown' => {
  const norm = normalizeText(message);

  // Check for hotel-specific price change
  if (norm.includes('precio del hotel') ||
      norm.includes('precio de hotel') ||
      norm.includes('hotel a') ||
      norm.includes('hotel cueste') ||
      norm.includes('hotel por')) {
    return 'hotel';
  }

  // Check for flight-specific price change
  if (norm.includes('precio del vuelo') ||
      norm.includes('precio de vuelo') ||
      norm.includes('vuelo a') ||
      norm.includes('vuelo cueste') ||
      norm.includes('primer vuelo') ||
      norm.includes('segundo vuelo')) {
    return 'flights';
  }

  // Check for total/package price change
  if (norm.includes('precio total') ||
      norm.includes('total a') ||
      norm.includes('paquete a') ||
      norm.includes('todo a') ||
      norm.includes('que cueste')) {
    return 'total';
  }

  // Default to total if just "cambia el precio"
  if (norm.includes('cambia el precio') || norm.includes('cambiar precio')) {
    return 'total';
  }

  return 'unknown';
};