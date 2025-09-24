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