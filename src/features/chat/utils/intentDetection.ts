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
export const isAddHotelRequest = (text: string): boolean => {
  const norm = normalizeText(text);
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
    'usd'
  ];

  return priceKeywords.some(keyword => norm.includes(keyword));
};