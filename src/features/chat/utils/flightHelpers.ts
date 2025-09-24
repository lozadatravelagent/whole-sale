// Helper function to format duration from minutes to readable format
export const formatDuration = (minutes: number): string => {
  if (!minutes || minutes <= 0) return '0h 0m';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

// Helper function to get city name from airport code
export const getCityNameFromCode = (airportCode: string): string => {
  const airportMapping: Record<string, string> = {
    'EZE': 'Buenos Aires',
    'BUE': 'Buenos Aires',
    'MAD': 'Madrid',
    'BCN': 'Barcelona',
    'PUJ': 'Punta Cana',
    'BOG': 'Bogotá',
    'LIM': 'Lima',
    'SCL': 'Santiago',
    'CUN': 'Cancún',
    'MIA': 'Miami',
    'JFK': 'Nueva York',
    'CDG': 'París',
    'LHR': 'Londres',
    'FCO': 'Roma',
    'AMS': 'Amsterdam',
    'FRA': 'Frankfurt',
    'ZUR': 'Zurich',
    'GRU': 'São Paulo',
    'RIO': 'Río de Janeiro',
    'MVD': 'Montevideo',
    'ASU': 'Asunción'
  };

  return airportMapping[airportCode] || airportCode;
};

// Helper function to get tax description from tax code
export const getTaxDescription = (taxCode: string): string => {
  const taxDescriptions: Record<string, string> = {
    'AR': 'Tasa de Salida Argentina',
    'Q1': 'Tasa de Combustible',
    'QO': 'Tasa de Operación',
    'TQ': 'Tasa de Terminal',
    'XY': 'Tasa de Inmigración',
    'YC': 'Tasa de Seguridad',
    'S7': 'Tasa de Servicio',
    'XR': 'Tasa de Inspección',
    'XA': 'Tasa de Aduanas',
    'XF': 'Tasa de Facilidades',
    'UX': 'Tasa de Uso',
    'L8': 'Tasa Local',
    'VB': 'Tasa Variable',
    'AY': 'Tasa de Aeropuerto',
    'TY': 'Tasa de Turismo'
  };

  return taxDescriptions[taxCode] || `Tasa ${taxCode}`;
};

// Helper function to get airline name from airline code
export const getAirlineNameFromCode = (airlineCode: string): string => {
  const airlineMapping: Record<string, string> = {
    'LA': 'LATAM AIRLINES GROUP',
    'AR': 'Aerolíneas Argentinas',
    'UA': 'United Airlines',
    'AA': 'American Airlines',
    'DL': 'Delta Air Lines',
    'IB': 'Iberia',
    'LH': 'Lufthansa',
    'AF': 'Air France',
    'KL': 'KLM',
    'BA': 'British Airways',
    'AZ': 'Alitalia',
    'LX': 'Swiss International Air Lines',
    'TP': 'TAP Air Portugal',
    'JJ': 'TAM Airlines',
    'G3': 'Gol Transportes Aéreos',
    'AD': 'Azul Brazilian Airlines',
    'CM': 'Copa Airlines',
    'AV': 'Avianca',
    'AM': 'Aeroméxico',
    'VY': 'Vueling',
    'FR': 'Ryanair',
    'EK': 'Emirates',
    'QR': 'Qatar Airways',
    'TK': 'Turkish Airlines',
    'SU': 'Aeroflot',
    'CX': 'Cathay Pacific',
    'SQ': 'Singapore Airlines',
    'TG': 'Thai Airways',
    'JL': 'Japan Airlines',
    'NH': 'All Nippon Airways'
  };

  return airlineMapping[airlineCode] || airlineCode;
};

// Helper function to get airline code from airline name (reverse mapping)
export const getAirlineCodeFromName = (airlineName: string): string => {
  const normalizedName = airlineName.toLowerCase().trim();

  const nameToCodeMapping: Record<string, string> = {
    // LATAM variations
    'latam': 'LA',
    'latam airlines': 'LA',
    'latam airlines group': 'LA',
    'tam': 'JJ',

    // Aerolíneas Argentinas variations
    'aerolineas argentinas': 'AR',
    'aerolíneas argentinas': 'AR',
    'aerolineas': 'AR',
    'aerolíneas': 'AR',

    // Air France variations
    'air france': 'AF',
    'airfrance': 'AF',

    // Other major airlines
    'iberia': 'IB',
    'lufthansa': 'LH',
    'american airlines': 'AA',
    'american': 'AA',
    'united airlines': 'UA',
    'united': 'UA',
    'delta': 'DL',
    'delta air lines': 'DL',
    'british airways': 'BA',
    'klm': 'KL',
    'alitalia': 'AZ',
    'swiss': 'LX',
    'swiss international air lines': 'LX',
    'tap air portugal': 'TP',
    'tap': 'TP',
    'gol': 'G3',
    'azul': 'AD',
    'copa airlines': 'CM',
    'copa': 'CM',
    'avianca': 'AV',
    'aeromexico': 'AM',
    'aeroméxico': 'AM',
    'vueling': 'VY',
    'ryanair': 'FR',
    'emirates': 'EK',
    'qatar airways': 'QR',
    'qatar': 'QR',
    'turkish airlines': 'TK',
    'turkish': 'TK',
    'aeroflot': 'SU',
    'cathay pacific': 'CX',
    'singapore airlines': 'SQ',
    'singapore': 'SQ',
    'thai airways': 'TG',
    'thai': 'TG',
    'japan airlines': 'JL',
    'jal': 'JL',
    'ana': 'NH',
    'all nippon airways': 'NH'
  };

  // Try exact match first
  if (nameToCodeMapping[normalizedName]) {
    return nameToCodeMapping[normalizedName];
  }

  // Try partial matches for common variations
  for (const [name, code] of Object.entries(nameToCodeMapping)) {
    if (normalizedName.includes(name) || name.includes(normalizedName)) {
      return code;
    }
  }

  // If no match found, return the original name (uppercase for consistency)
  return airlineName.toUpperCase();
};

// Helper function to check if airline matches preference (supports both codes and names)
export const matchesAirlinePreference = (airlineCode: string, operatingAirlineName: string | null, preference: string): boolean => {
  if (!preference) return true;

  const normalizedPreference = preference.toLowerCase().trim();
  const normalizedCode = airlineCode.toLowerCase();
  const normalizedOperatingName = operatingAirlineName?.toLowerCase() || '';

  // Check if preference is already a code (2-3 characters)
  if (preference.length <= 3 && preference.toUpperCase() === airlineCode) {
    return true;
  }

  // Check if preference matches the operating airline name
  if (operatingAirlineName && normalizedOperatingName.includes(normalizedPreference)) {
    return true;
  }

  // Check if preference matches mapped airline name
  const mappedName = getAirlineNameFromCode(airlineCode).toLowerCase();
  if (mappedName.includes(normalizedPreference)) {
    return true;
  }

  // Try to convert preference to code and compare
  const preferenceAsCode = getAirlineCodeFromName(preference);
  if (preferenceAsCode === airlineCode) {
    return true;
  }

  return false;
};

// Helper function to calculate connection time between segments
export const calculateConnectionTime = (segment1: any, segment2: any): string => {
  if (!segment1?.Arrival?.Date || !segment1?.Arrival?.Time ||
    !segment2?.Departure?.Date || !segment2?.Departure?.Time) {
    return 'N/A';
  }

  try {
    const arrival = new Date(`${segment1.Arrival.Date}T${segment1.Arrival.Time}`);
    const departure = new Date(`${segment2.Departure.Date}T${segment2.Departure.Time}`);

    const diffMs = departure.getTime() - arrival.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 0) return 'N/A';

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  } catch (error) {
    console.warn('Error calculating connection time:', error);
    return 'N/A';
  }
};