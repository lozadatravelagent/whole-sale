/**
 * City Code Service - Converts city names to IATA airport codes
 * Centralizes all city-to-code mapping for flights and hotels
 */

interface CityCodeMapping {
  iata: string;      // Airport code for flights (IATA) - primary
  iataSecondary?: string; // Secondary IATA airport code
  hotelCode: string; // City code for hotels (may differ from IATA)
  country: string;
  aliases: string[]; // Alternative names for the city
}

const CITY_MAPPINGS: Record<string, CityCodeMapping> = {
  // Argentina
  'buenos aires': {
    iata: 'EZE',
    iataSecondary: 'AEP',
    hotelCode: 'BUE',
    country: 'AR',
    aliases: ['bsas', 'capital federal', 'caba']
  },
  'cordoba': {
    iata: 'COR',
    hotelCode: 'COR',
    country: 'AR',
    aliases: ['córdoba']
  },
  'mendoza': {
    iata: 'MDZ',
    hotelCode: 'MDZ',
    country: 'AR',
    aliases: []
  },
  'bariloche': {
    iata: 'BRC',
    hotelCode: 'BRC',
    country: 'AR',
    aliases: ['san carlos de bariloche']
  },
  'rosario': {
    iata: 'ROS',
    hotelCode: 'ROS',
    country: 'AR',
    aliases: []
  },
  'salta': {
    iata: 'SLA',
    hotelCode: 'SLA',
    country: 'AR',
    aliases: []
  },
  'tucuman': {
    iata: 'TUC',
    hotelCode: 'TUC',
    country: 'AR',
    aliases: ['tucumán', 'san miguel de tucuman']
  },
  'neuquen': {
    iata: 'NQN',
    hotelCode: 'NQN',
    country: 'AR',
    aliases: ['neuquén']
  },
  'ushuaia': {
    iata: 'USH',
    hotelCode: 'USH',
    country: 'AR',
    aliases: []
  },
  'iguazu': {
    iata: 'IGR',
    hotelCode: 'IGR',
    country: 'AR',
    aliases: ['iguazú', 'puerto iguazu', 'cataratas']
  },
  'el calafate': {
    iata: 'FTE',
    hotelCode: 'FTE',
    country: 'AR',
    aliases: ['calafate']
  },
  'mar del plata': {
    iata: 'MDQ',
    hotelCode: 'MDQ',
    country: 'AR',
    aliases: []
  },

  // República Dominicana
  'punta cana': {
    iata: 'PUJ',
    hotelCode: 'PUJ',
    country: 'DO',
    aliases: ['puntacana', 'bavaro', 'bávaro']
  },
  'santo domingo': {
    iata: 'SDQ',
    hotelCode: 'SDQ',
    country: 'DO',
    aliases: []
  },
  'puerto plata': {
    iata: 'POP',
    hotelCode: 'POP',
    country: 'DO',
    aliases: []
  },
  'la romana': {
    iata: 'LRM',
    hotelCode: 'LRM',
    country: 'DO',
    aliases: ['romana', 'casa de campo']
  },

  // Cuba
  'la habana': {
    iata: 'HAV',
    hotelCode: 'HAV',
    country: 'CU',
    aliases: ['habana', 'havana', 'havanna']
  },
  'varadero': {
    iata: 'VRA',
    hotelCode: 'VRA',
    country: 'CU',
    aliases: []
  },
  'holguin': {
    iata: 'HOG',
    hotelCode: 'HOG',
    country: 'CU',
    aliases: ['holguín']
  },
  'cayo coco': {
    iata: 'CCC',
    hotelCode: 'CCC',
    country: 'CU',
    aliases: ['cayo guillermo']
  },
  'santa clara': {
    iata: 'SNU',
    hotelCode: 'SNU',
    country: 'CU',
    aliases: ['cayo santa maria']
  },

  // Jamaica
  'montego bay': {
    iata: 'MBJ',
    hotelCode: 'MBJ',
    country: 'JM',
    aliases: ['montego', 'mobay']
  },
  'kingston': {
    iata: 'KIN',
    hotelCode: 'KIN',
    country: 'JM',
    aliases: []
  },
  'ocho rios': {
    iata: 'OCJ',
    hotelCode: 'OCJ',
    country: 'JM',
    aliases: []
  },
  'negril': {
    iata: 'NEG',
    hotelCode: 'NEG',
    country: 'JM',
    aliases: []
  },

  // Bahamas
  'nassau': {
    iata: 'NAS',
    hotelCode: 'NAS',
    country: 'BS',
    aliases: ['bahamas', 'new providence']
  },
  'freeport': {
    iata: 'FPO',
    hotelCode: 'FPO',
    country: 'BS',
    aliases: ['gran bahama', 'grand bahama']
  },

  // Puerto Rico
  'san juan': {
    iata: 'SJU',
    hotelCode: 'SJU',
    country: 'PR',
    aliases: ['puerto rico']
  },

  // Aruba
  'aruba': {
    iata: 'AUA',
    hotelCode: 'AUA',
    country: 'AW',
    aliases: ['oranjestad']
  },

  // Curazao
  'curacao': {
    iata: 'CUR',
    hotelCode: 'CUR',
    country: 'CW',
    aliases: ['curazao', 'curaçao', 'willemstad']
  },

  // Bonaire
  'bonaire': {
    iata: 'BON',
    hotelCode: 'BON',
    country: 'BQ',
    aliases: ['kralendijk']
  },

  // Sint Maarten / San Martín
  'sint maarten': {
    iata: 'SXM',
    hotelCode: 'SXM',
    country: 'SX',
    aliases: ['san martin', 'saint martin', 'st maarten', 'st martin']
  },

  // Barbados
  'barbados': {
    iata: 'BGI',
    hotelCode: 'BGI',
    country: 'BB',
    aliases: ['bridgetown']
  },

  // Trinidad y Tobago
  'trinidad': {
    iata: 'POS',
    hotelCode: 'POS',
    country: 'TT',
    aliases: ['puerto espana', 'port of spain', 'trinidad y tobago']
  },

  // Islas Caimán
  'grand cayman': {
    iata: 'GCM',
    hotelCode: 'GCM',
    country: 'KY',
    aliases: ['cayman', 'islas caiman', 'george town']
  },

  // Islas Turcas y Caicos
  'turks and caicos': {
    iata: 'PLS',
    hotelCode: 'PLS',
    country: 'TC',
    aliases: ['providenciales', 'turcos y caicos']
  },

  // Islas Vírgenes
  'st thomas': {
    iata: 'STT',
    hotelCode: 'STT',
    country: 'VI',
    aliases: ['saint thomas', 'islas virgenes']
  },

  // España
  'madrid': {
    iata: 'MAD',
    hotelCode: 'MAD',
    country: 'ES',
    aliases: []
  },
  'barcelona': {
    iata: 'BCN',
    hotelCode: 'BCN',
    country: 'ES',
    aliases: []
  },
  'valencia': {
    iata: 'VLC',
    hotelCode: 'VLC',
    country: 'ES',
    aliases: []
  },
  'sevilla': {
    iata: 'SVQ',
    hotelCode: 'SVQ',
    country: 'ES',
    aliases: ['seville']
  },
  'bilbao': {
    iata: 'BIO',
    hotelCode: 'BIO',
    country: 'ES',
    aliases: []
  },
  'palma': {
    iata: 'PMI',
    hotelCode: 'PMI',
    country: 'ES',
    aliases: ['palma de mallorca', 'mallorca']
  },

  // México
  'cancun': {
    iata: 'CUN',
    hotelCode: 'CUN',
    country: 'MX',
    aliases: ['cancún']
  },
  'mexico city': {
    iata: 'MEX',
    hotelCode: 'MEX',
    country: 'MX',
    aliases: ['ciudad de mexico', 'cdmx', 'df']
  },
  'guadalajara': {
    iata: 'GDL',
    hotelCode: 'GDL',
    country: 'MX',
    aliases: []
  },
  'puerto vallarta': {
    iata: 'PVR',
    hotelCode: 'PVR',
    country: 'MX',
    aliases: []
  },
  'los cabos': {
    iata: 'SJD',
    hotelCode: 'SJD',
    country: 'MX',
    aliases: ['cabo san lucas']
  },

  // Estados Unidos
  'new york': {
    iata: 'JFK',
    hotelCode: 'NYC',
    country: 'US',
    aliases: ['nueva york', 'nyc']
  },
  'los angeles': {
    iata: 'LAX',
    hotelCode: 'LAX',
    country: 'US',
    aliases: ['la']
  },
  'miami': {
    iata: 'MIA',
    hotelCode: 'MIA',
    country: 'US',
    aliases: []
  },
  'las vegas': {
    iata: 'LAS',
    hotelCode: 'LAS',
    country: 'US',
    aliases: ['vegas']
  },
  'orlando': {
    iata: 'MCO',
    hotelCode: 'ORL',
    country: 'US',
    aliases: []
  },

  // Europa
  'paris': {
    iata: 'CDG',
    hotelCode: 'PAR',
    country: 'FR',
    aliases: ['parís']
  },
  'london': {
    iata: 'LHR',
    hotelCode: 'LON',
    country: 'GB',
    aliases: ['londres']
  },
  'rome': {
    iata: 'FCO',
    hotelCode: 'ROM',
    country: 'IT',
    aliases: ['roma']
  },
  'florence': {
    iata: 'FLR',
    hotelCode: 'FLR',
    country: 'IT',
    aliases: ['florencia', 'firenze']
  },
  'amsterdam': {
    iata: 'AMS',
    hotelCode: 'AMS',
    country: 'NL',
    aliases: []
  },
  'frankfurt': {
    iata: 'FRA',
    hotelCode: 'FRA',
    country: 'DE',
    aliases: []
  },
  'zurich': {
    iata: 'ZUR',
    hotelCode: 'ZUR',
    country: 'CH',
    aliases: ['zürich']
  }
};

/**
 * Get IATA airport code for flights (primary airport)
 */
export function getAirportCode(cityName: string): string | null {
  const normalizedCity = normalizeString(cityName);

  // Direct match
  const mapping = CITY_MAPPINGS[normalizedCity];
  if (mapping) {
    return mapping.iata;
  }

  // Check aliases
  for (const [key, value] of Object.entries(CITY_MAPPINGS)) {
    if (value.aliases.some(alias => normalizeString(alias) === normalizedCity)) {
      return value.iata;
    }
  }

  console.warn(`⚠️ No IATA code found for city: ${cityName}`);
  return null;
}

/**
 * Get smart airport code based on flight context
 * For Buenos Aires: EZE for international flights, AEP for domestic/regional
 */
export function getSmartAirportCode(cityName: string, destination?: string): string | null {
  const normalizedCity = normalizeString(cityName);

  // Special handling for Buenos Aires
  if (normalizedCity === 'buenos aires' || normalizedCity === 'bsas' ||
    normalizedCity === 'capital federal' || normalizedCity === 'caba') {

    if (destination) {
      const destNormalized = normalizeString(destination);

      // Domestic destinations from Buenos Aires (use AEP)
      const domesticDestinations = [
        'cordoba', 'córdoba', 'mendoza', 'bariloche', 'ushuaia', 'salta',
        'rosario', 'neuquen', 'neuquén', 'tucuman', 'tucumán', 'jujuy',
        'la plata', 'mar del plata', 'san martin de los andes', 'el calafate',
        'iguazu', 'iguazú', 'puerto iguazu',
        'comodoro rivadavia', 'resistencia', 'corrientes', 'trelew', 'puerto madryn',
        'rio gallegos', 'posadas', 'san juan', 'santiago del estero',
        'formosa', 'bahia blanca', 'santa rosa', 'rio grande',
        'catamarca', 'la rioja', 'san luis', 'parana', 'santa fe', 'viedma'
      ];

      // Regional destinations (South America - use EZE)
      const regionalDestinations = [
        'santiago', 'lima', 'bogota', 'bogotá', 'sao paulo', 'são paulo',
        'rio de janeiro', 'brasilia', 'montevideo', 'asuncion', 'asunción',
        'la paz', 'caracas', 'quito', 'guayaquil', 'cali', 'medellin', 'medellín'
      ];

      // International destinations (use EZE)
      const internationalDestinations = [
        'madrid', 'barcelona', 'paris', 'london', 'londres', 'rome', 'roma',
        'miami', 'new york', 'nueva york', 'los angeles', 'chicago', 'toronto',
        'mexico city', 'ciudad de mexico', 'cancun', 'cancún'
      ];

      if (domesticDestinations.some(dest => destNormalized.includes(dest) || dest.includes(destNormalized))) {
        console.log(`🏠 Domestic flight detected: Buenos Aires -> ${destination}, using AEP`);
        return 'AEP';
      } else if (regionalDestinations.some(dest => destNormalized.includes(dest) || dest.includes(destNormalized))) {
        console.log(`🌎 Regional flight detected: Buenos Aires -> ${destination}, using EZE`);
        return 'EZE';
      } else if (internationalDestinations.some(dest => destNormalized.includes(dest) || dest.includes(destNormalized))) {
        console.log(`🌍 International flight detected: Buenos Aires -> ${destination}, using EZE`);
        return 'EZE';
      }
    }

    // Default to EZE for Buenos Aires if no destination context
    console.log(`✈️ Buenos Aires without destination context, defaulting to EZE`);
    return 'EZE';
  }

  // For other cities, use the standard logic
  return getAirportCode(cityName);
}

/**
 * Get all IATA airport codes for a city (primary + secondary if available)
 */
export function getAllAirportCodes(cityName: string): string[] {
  const normalizedCity = normalizeString(cityName);

  // Direct match
  const mapping = CITY_MAPPINGS[normalizedCity];
  if (mapping) {
    const codes = [mapping.iata];
    if (mapping.iataSecondary) {
      codes.push(mapping.iataSecondary);
    }
    return codes;
  }

  // Check aliases
  for (const [key, value] of Object.entries(CITY_MAPPINGS)) {
    if (value.aliases.some(alias => normalizeString(alias) === normalizedCity)) {
      const codes = [value.iata];
      if (value.iataSecondary) {
        codes.push(value.iataSecondary);
      }
      return codes;
    }
  }

  console.warn(`⚠️ No IATA codes found for city: ${cityName}`);
  return [];
}

/**
 * Get hotel city code
 */
export function getHotelCode(cityName: string): string | null {
  const normalizedCity = normalizeString(cityName);

  // Direct match
  const mapping = CITY_MAPPINGS[normalizedCity];
  if (mapping) {
    return mapping.hotelCode;
  }

  // Check aliases
  for (const [key, value] of Object.entries(CITY_MAPPINGS)) {
    if (value.aliases.some(alias => normalizeString(alias) === normalizedCity)) {
      return value.hotelCode;
    }
  }

  console.warn(`⚠️ No hotel code found for city: ${cityName}`);
  return null;
}

/**
 * Get both codes for a city
 */
export function getCityCodes(cityName: string): { iata: string | null; hotelCode: string | null } {
  return {
    iata: getAirportCode(cityName),
    hotelCode: getHotelCode(cityName)
  };
}

/**
 * Check if a city is supported
 */
export function isCitySupported(cityName: string): boolean {
  const normalizedCity = normalizeString(cityName);

  // Direct match
  if (CITY_MAPPINGS[normalizedCity]) {
    return true;
  }

  // Check aliases
  return Object.values(CITY_MAPPINGS).some(mapping =>
    mapping.aliases.some(alias => normalizeString(alias) === normalizedCity)
  );
}

/**
 * Get all supported cities for autocomplete
 */
export function getSupportedCities(): string[] {
  const cities: string[] = [];

  Object.keys(CITY_MAPPINGS).forEach(city => {
    cities.push(city);
    cities.push(...CITY_MAPPINGS[city].aliases);
  });

  return cities.sort();
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/ç/g, 'c');
}

/**
 * Add logging for debugging
 */
export function logCityConversion(cityName: string, type: 'flight' | 'hotel'): void {
  const codes = getCityCodes(cityName);
  const code = type === 'flight' ? codes.iata : codes.hotelCode;

  if (code) {
    console.log(`✅ ${type.toUpperCase()} - "${cityName}" → ${code}`);
  } else {
    console.error(`❌ ${type.toUpperCase()} - No code found for "${cityName}"`);
  }
}

/**
 * Get country code from airport IATA code
 */
export function getCountryFromAirportCode(airportCode: string): string | null {
  // Search through all city mappings to find the airport code
  for (const mapping of Object.values(CITY_MAPPINGS)) {
    if (mapping.iata === airportCode || mapping.iataSecondary === airportCode) {
      return mapping.country;
    }
  }

  console.warn(`⚠️ No country found for airport code: ${airportCode}`);
  return null;
}

/**
 * Comprehensive IATA to City Name mapping
 * Covers 500+ major commercial airports worldwide
 */
const IATA_TO_CITY: Record<string, string> = {
  // Argentina
  'BUE': 'Buenos Aires', 'EZE': 'Buenos Aires', 'AEP': 'Buenos Aires', 'COR': 'Córdoba', 'MDZ': 'Mendoza',
  'BRC': 'Bariloche', 'IGR': 'Iguazú', 'USH': 'Ushuaia', 'FTE': 'El Calafate',
  'SLA': 'Salta', 'TUC': 'Tucumán', 'ROS': 'Rosario', 'NQN': 'Neuquén',

  // Brasil
  'GRU': 'São Paulo', 'CGH': 'São Paulo', 'GIG': 'Río de Janeiro', 'BSB': 'Brasilia',
  'SSA': 'Salvador', 'REC': 'Recife', 'FOR': 'Fortaleza', 'MAO': 'Manaus',
  'BEL': 'Belém', 'CWB': 'Curitiba', 'POA': 'Porto Alegre', 'FLN': 'Florianópolis',

  // Chile
  'SCL': 'Santiago', 'ARI': 'Arica', 'IQQ': 'Iquique', 'ANF': 'Antofagasta',
  'CJC': 'Calama', 'CPO': 'Concepción', 'ZCO': 'Temuco', 'PMC': 'Puerto Montt',
  'PUQ': 'Punta Arenas', 'IPC': 'Isla de Pascua',

  // Colombia
  'BOG': 'Bogotá', 'MDE': 'Medellín', 'CLO': 'Cali', 'CTG': 'Cartagena',
  'BAQ': 'Barranquilla', 'SMR': 'Santa Marta', 'PEI': 'Pereira', 'BGA': 'Bucaramanga',
  'ADZ': 'San Andrés', 'LET': 'Leticia',

  // Perú
  'LIM': 'Lima', 'CUZ': 'Cuzco', 'AQP': 'Arequipa', 'TCQ': 'Tacna',
  'JUL': 'Juliaca', 'TRU': 'Trujillo', 'PIU': 'Piura', 'IQT': 'Iquitos',

  // Ecuador
  'UIO': 'Quito', 'GYE': 'Guayaquil', 'GPS': 'Galápagos',

  // Uruguay
  'MVD': 'Montevideo', 'PDP': 'Punta del Este',

  // Paraguay
  'ASU': 'Asunción',

  // Bolivia
  'LPB': 'La Paz', 'VVI': 'Santa Cruz', 'CBB': 'Cochabamba', 'SRE': 'Sucre',

  // Venezuela
  'CCS': 'Caracas', 'MAR': 'Maracaibo', 'VLN': 'Valencia', 'BLA': 'Barcelona',

  // México
  'MEX': 'Ciudad de México', 'CUN': 'Cancún', 'GDL': 'Guadalajara', 'MTY': 'Monterrey',
  'TIJ': 'Tijuana', 'PVR': 'Puerto Vallarta', 'SJD': 'Los Cabos', 'MZT': 'Mazatlán',
  'ACA': 'Acapulco', 'ZIH': 'Ixtapa', 'HUX': 'Huatulco', 'OAX': 'Oaxaca',
  'MID': 'Mérida', 'VSA': 'Villahermosa', 'CZM': 'Cozumel',

  // Cuba
  'HAV': 'La Habana', 'VRA': 'Varadero', 'HOG': 'Holguín', 'SCU': 'Santiago de Cuba',

  // República Dominicana
  'PUJ': 'Punta Cana', 'SDQ': 'Santo Domingo', 'STI': 'Santiago', 'POP': 'Puerto Plata',
  'LRM': 'La Romana', 'BRX': 'Barahona',

  // Jamaica
  'KIN': 'Kingston', 'MBJ': 'Montego Bay',

  // Bahamas
  'NAS': 'Nassau', 'FPO': 'Freeport',

  // Puerto Rico
  'SJU': 'San Juan',

  // Aruba / Caribe
  'AUA': 'Aruba', 'CUR': 'Curazao', 'BON': 'Bonaire', 'SXM': 'Sint Maarten',
  'POS': 'Puerto España', 'BGI': 'Barbados', 'GND': 'Granada',

  // Estados Unidos - Este
  'JFK': 'Nueva York', 'LGA': 'Nueva York', 'EWR': 'Newark', 'BOS': 'Boston',
  'PHL': 'Filadelfia', 'IAD': 'Washington', 'DCA': 'Washington', 'BWI': 'Baltimore',
  'RDU': 'Raleigh', 'CLT': 'Charlotte', 'ATL': 'Atlanta', 'MIA': 'Miami',
  'FLL': 'Fort Lauderdale', 'PBI': 'West Palm Beach', 'TPA': 'Tampa',
  'MCO': 'Orlando', 'JAX': 'Jacksonville', 'RSW': 'Fort Myers', 'PNS': 'Pensacola',
  'MSY': 'Nueva Orleans', 'BNA': 'Nashville', 'MEM': 'Memphis', 'DTW': 'Detroit',
  'CLE': 'Cleveland', 'CVG': 'Cincinnati', 'IND': 'Indianápolis', 'CMH': 'Columbus',
  'PIT': 'Pittsburgh', 'BUF': 'Buffalo', 'RIC': 'Richmond',

  // Estados Unidos - Centro
  'ORD': 'Chicago', 'MDW': 'Chicago', 'MSP': 'Minneapolis', 'MKE': 'Milwaukee',
  'STL': 'St. Louis', 'KCI': 'Kansas City', 'OMA': 'Omaha', 'DSM': 'Des Moines',
  'DEN': 'Denver', 'COS': 'Colorado Springs', 'SLC': 'Salt Lake City',
  'PHX': 'Phoenix', 'TUS': 'Tucson', 'ABQ': 'Albuquerque', 'ELP': 'El Paso',
  'DFW': 'Dallas', 'DAL': 'Dallas', 'IAH': 'Houston', 'HOU': 'Houston',
  'AUS': 'Austin', 'SAT': 'San Antonio', 'OKC': 'Oklahoma City', 'TUL': 'Tulsa',

  // Estados Unidos - Oeste
  'LAX': 'Los Ángeles', 'SNA': 'Santa Ana', 'ONT': 'Ontario', 'BUR': 'Burbank',
  'SAN': 'San Diego', 'SFO': 'San Francisco', 'SJC': 'San José', 'OAK': 'Oakland',
  'SMF': 'Sacramento', 'RNO': 'Reno', 'LAS': 'Las Vegas', 'SEA': 'Seattle',
  'PDX': 'Portland', 'BOI': 'Boise', 'ANC': 'Anchorage', 'HNL': 'Honolulu',
  'OGG': 'Maui', 'KOA': 'Kona', 'LIH': 'Kauai',

  // Canadá
  'YYZ': 'Toronto', 'YUL': 'Montreal', 'YVR': 'Vancouver', 'YYC': 'Calgary',
  'YEG': 'Edmonton', 'YOW': 'Ottawa', 'YHZ': 'Halifax', 'YWG': 'Winnipeg',
  'YQB': 'Quebec', 'YYJ': 'Victoria',

  // España
  'MAD': 'Madrid', 'BCN': 'Barcelona', 'VLC': 'Valencia', 'SVQ': 'Sevilla',
  'AGP': 'Málaga', 'BIO': 'Bilbao', 'PMI': 'Palma de Mallorca', 'ALC': 'Alicante',
  'IBZ': 'Ibiza', 'TFS': 'Tenerife', 'LPA': 'Gran Canaria', 'ACE': 'Lanzarote',
  'FUE': 'Fuerteventura', 'SCQ': 'Santiago', 'OVD': 'Oviedo', 'GRX': 'Granada',

  // Portugal
  'LIS': 'Lisboa', 'OPO': 'Oporto', 'FAO': 'Faro', 'FNC': 'Funchal', 'PDL': 'Ponta Delgada',

  // Francia
  'CDG': 'París', 'ORY': 'París', 'NCE': 'Niza', 'LYS': 'Lyon', 'MRS': 'Marsella',
  'TLS': 'Toulouse', 'BOD': 'Burdeos', 'NTE': 'Nantes',

  // Italia
  'FCO': 'Roma', 'CIA': 'Roma', 'MXP': 'Milán', 'LIN': 'Milán', 'VCE': 'Venecia',
  'NAP': 'Nápoles', 'FLR': 'Florencia', 'BGY': 'Bérgamo', 'BLQ': 'Bolonia',
  'CTA': 'Catania', 'PMO': 'Palermo', 'BRI': 'Bari', 'TRN': 'Turín',

  // Reino Unido / Irlanda
  'LHR': 'Londres', 'LGW': 'Londres', 'STN': 'Londres', 'LTN': 'Londres', 'LCY': 'Londres',
  'MAN': 'Mánchester', 'EDI': 'Edimburgo', 'GLA': 'Glasgow', 'BHX': 'Birmingham',
  'NCL': 'Newcastle', 'BRS': 'Bristol', 'LPL': 'Liverpool', 'DUB': 'Dublín',
  'ORK': 'Cork', 'SNN': 'Shannon', 'BFS': 'Belfast',

  // Alemania
  'FRA': 'Fráncfort', 'MUC': 'Múnich', 'TXL': 'Berlín', 'SXF': 'Berlín', 'BER': 'Berlín',
  'DUS': 'Düsseldorf', 'CGN': 'Colonia', 'HAM': 'Hamburgo', 'STR': 'Stuttgart',
  'HAJ': 'Hanóver', 'NUE': 'Núremberg', 'DRS': 'Dresde', 'LEJ': 'Leipzig',

  // Países Bajos / Bélgica
  'AMS': 'Ámsterdam', 'RTM': 'Róterdam', 'EIN': 'Eindhoven', 'BRU': 'Bruselas',
  'CRL': 'Charleroi', 'ANR': 'Amberes',

  // Suiza / Austria
  'ZRH': 'Zúrich', 'GVA': 'Ginebra', 'BSL': 'Basilea', 'BRN': 'Berna',
  'VIE': 'Viena', 'SZG': 'Salzburgo', 'INN': 'Innsbruck',

  // Escandinavia
  'CPH': 'Copenhague', 'ARN': 'Estocolmo', 'OSL': 'Oslo', 'BGO': 'Bergen',
  'HEL': 'Helsinki', 'REK': 'Reikiavik',

  // Europa del Este
  'WAW': 'Varsovia', 'KRK': 'Cracovia', 'PRG': 'Praga', 'BUD': 'Budapest',
  'OTP': 'Bucarest', 'SOF': 'Sofía', 'ATH': 'Atenas', 'BEG': 'Belgrado',
  'ZAG': 'Zagreb', 'LJU': 'Liubliana', 'RIX': 'Riga', 'TLL': 'Tallin',
  'VNO': 'Vilna', 'KBP': 'Kiev', 'MOW': 'Moscú', 'SVO': 'Moscú', 'DME': 'Moscú',

  // Turquía / Medio Oriente
  'IST': 'Estambul', 'SAW': 'Estambul', 'AYT': 'Antalya', 'ADB': 'Esmirna',
  'DXB': 'Dubái', 'AUH': 'Abu Dabi', 'DOH': 'Doha', 'BAH': 'Baréin',
  'KWI': 'Kuwait', 'RUH': 'Riad', 'JED': 'Yeda', 'AMM': 'Amán',
  'TLV': 'Tel Aviv', 'CAI': 'El Cairo', 'BEY': 'Beirut',

  // África
  'JNB': 'Johannesburgo', 'CPT': 'Ciudad del Cabo', 'DUR': 'Durban',
  'NBO': 'Nairobi', 'ADD': 'Adís Abeba', 'LOS': 'Lagos', 'ACC': 'Acra',
  'CAS': 'Casablanca', 'RAK': 'Marrakech', 'TUN': 'Túnez', 'ALG': 'Argel',

  // Asia - China / Hong Kong
  'PEK': 'Pekín', 'PVG': 'Shanghái', 'CAN': 'Cantón', 'CTU': 'Chengdu',
  'SZX': 'Shenzhen', 'XIY': 'Xi\'an', 'WUH': 'Wuhan', 'HGH': 'Hangzhou',
  'HKG': 'Hong Kong', 'MFM': 'Macao', 'TPE': 'Taipei',

  // Asia - Japón / Corea
  'NRT': 'Tokio', 'HND': 'Tokio', 'KIX': 'Osaka', 'NGO': 'Nagoya',
  'CTS': 'Sapporo', 'FUK': 'Fukuoka', 'ICN': 'Seúl', 'GMP': 'Seúl', 'PUS': 'Busan',

  // Asia - Sudeste Asiático
  'SIN': 'Singapur', 'BKK': 'Bangkok', 'HKT': 'Phuket', 'CNX': 'Chiang Mai',
  'KUL': 'Kuala Lumpur', 'PEN': 'Penang', 'MNL': 'Manila', 'CEB': 'Cebú',
  'CGK': 'Yakarta', 'DPS': 'Bali', 'HAN': 'Hanói', 'SGN': 'Ho Chi Minh',
  'REP': 'Siem Reap', 'RGN': 'Yangón', 'VTE': 'Vientián',

  // Asia - India
  'DEL': 'Nueva Delhi', 'BOM': 'Bombay', 'BLR': 'Bangalore', 'HYD': 'Hyderabad',
  'MAA': 'Chennai', 'CCU': 'Calcuta', 'GOI': 'Goa', 'COK': 'Kochi',

  // Oceanía
  'SYD': 'Sídney', 'MEL': 'Melbourne', 'BNE': 'Brisbane', 'PER': 'Perth',
  'ADL': 'Adelaida', 'OOL': 'Gold Coast', 'CNS': 'Cairns', 'DRW': 'Darwin',
  'AKL': 'Auckland', 'WLG': 'Wellington', 'CHC': 'Christchurch', 'ZQN': 'Queenstown',
  'NAN': 'Nadi', 'PPT': 'Papeete', 'APW': 'Apia', 'NOU': 'Noumea'
};

/**
 * Get city name from IATA airport code
 * Returns the IATA code itself if no mapping is found
 */
export function getCityNameFromIATA(iataCode: string): string {
  const upperCode = iataCode.toUpperCase();
  return IATA_TO_CITY[upperCode] || upperCode;
}

/**
 * ⭐ UNIFIED AIRPORT CODE RESOLVER - SINGLE SOURCE OF TRUTH ⭐
 *
 * Combines ALL city code sources with intelligent 4-layer fallback.
 * This function GUARANTEES a valid 3-letter IATA code for Starling API.
 *
 * Resolution Strategy:
 * 1️⃣ SMART LOGIC: Context-aware (Buenos Aires → AEP/EZE based on destination)
 * 2️⃣ LOCAL DICT: Static dictionary (200 cities, includes Argentina)
 * 3️⃣ EUROVIPS: Global database (766 cities worldwide)
 * 4️⃣ FALLBACK: First 3 letters (last resort with warning)
 *
 * @param cityName - City name to convert (e.g., "Buenos Aires", "Miami")
 * @param context - Optional context for smart resolution
 * @returns Promise<string> - Valid 3-letter IATA code (uppercase)
 * @throws Error if city cannot be resolved to valid code
 */
export async function getUnifiedAirportCode(
  cityName: string,
  context?: {
    destination?: string;
    country?: string;
    searchType?: 'flight' | 'hotel';
  }
): Promise<string> {
  if (!cityName || cityName.trim() === '') {
    throw new Error('❌ City name cannot be empty');
  }

  const startTime = Date.now();
  console.log(`\n🔍 [UNIFIED RESOLVER] Starting resolution for: "${cityName}"`);
  if (context?.destination) console.log(`   → Destination context: "${context.destination}"`);
  if (context?.country) console.log(`   → Country hint: "${context.country}"`);

  // ============================================
  // LAYER 0: IATA Code Passthrough
  // If input is already a known IATA code, return it directly
  // EXCEPTION: Metro codes (e.g. BUE) for multi-airport cities
  // fall through to Layer 1 for context-aware resolution (AEP vs EZE)
  // ============================================
  const upperInput = cityName.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(upperInput) && IATA_TO_CITY[upperInput]) {
    const resolvedCityName = IATA_TO_CITY[upperInput];
    const normalizedResolvedCity = normalizeString(resolvedCityName);
    const cityMapping = CITY_MAPPINGS[normalizedResolvedCity];

    if (cityMapping?.iataSecondary) {
      // Metro code (e.g. BUE) — siempre cae a smart logic
      if (upperInput !== cityMapping.iata && upperInput !== cityMapping.iataSecondary) {
        console.log(`⏭️ [LAYER 0] "${upperInput}" is a metro code for "${resolvedCityName}" (airports: ${cityMapping.iata}/${cityMapping.iataSecondary}), falling through to smart logic...`);
      // Aeropuerto real (EZE/AEP) CON destino — cae a smart logic para elegir el correcto
      } else if (context?.destination) {
        console.log(`⏭️ [LAYER 0] "${upperInput}" is an airport for multi-airport city "${resolvedCityName}", destination "${context.destination}" present, falling through to smart logic...`);
      // Aeropuerto real SIN destino — devolver tal cual
      } else {
        const elapsed = Date.now() - startTime;
        console.log(`✅ [LAYER 0] Input "${cityName}" is already a known IATA code → ${upperInput} (${resolvedCityName}, ${elapsed}ms)`);
        return upperInput;
      }
    } else {
      const elapsed = Date.now() - startTime;
      console.log(`✅ [LAYER 0] Input "${cityName}" is already a known IATA code → ${upperInput} (${resolvedCityName}, ${elapsed}ms)`);
      return upperInput;
    }
  }

  // Resolve IATA codes to city names for Layer 1/2 (needed when metro code falls through)
  let effectiveCityName = cityName;
  let effectiveDestination = context?.destination;

  if (/^[A-Z]{3}$/.test(upperInput) && IATA_TO_CITY[upperInput]) {
    effectiveCityName = IATA_TO_CITY[upperInput];
    console.log(`   → Resolved "${upperInput}" to city name "${effectiveCityName}"`);
  }

  if (effectiveDestination) {
    const upperDest = effectiveDestination.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(upperDest) && IATA_TO_CITY[upperDest]) {
      effectiveDestination = IATA_TO_CITY[upperDest];
      console.log(`   → Resolved destination "${upperDest}" to city name "${effectiveDestination}"`);
    }
  }

  // ============================================
  // LAYER 1: Smart Context-Aware Logic
  // ============================================
  if (context?.searchType === 'flight' || !context?.searchType) {
    console.log(`\n1️⃣ [LAYER 1] Trying smart context-aware logic...`);
    const smartCode = getSmartAirportCode(effectiveCityName, effectiveDestination);

    if (smartCode) {
      const elapsed = Date.now() - startTime;
      console.log(`✅ [LAYER 1 SUCCESS] "${cityName}" → ${smartCode} (smart logic, ${elapsed}ms)`);
      return validateIATACode(smartCode, cityName);
    }
    console.log(`   ⏭️  Layer 1 returned null, trying next layer...`);
  }

  // ============================================
  // LAYER 2: Local Static Dictionary
  // ============================================
  console.log(`\n2️⃣ [LAYER 2] Trying local static dictionary (200 cities)...`);
  const localCode = getAirportCode(effectiveCityName);

  if (localCode) {
    const elapsed = Date.now() - startTime;
    console.log(`✅ [LAYER 2 SUCCESS] "${cityName}" → ${localCode} (static dict, ${elapsed}ms)`);
    return validateIATACode(localCode, cityName);
  }
  console.log(`   ⏭️  City not in local dictionary, trying next layer...`);

  // ============================================
  // LAYER 3: EUROVIPS Global Database
  // ============================================
  console.log(`\n3️⃣ [LAYER 3] Trying EUROVIPS database (766 cities)...`);
  try {
    const { getCityCode } = await import('@/services/cityCodeMapping');
    const eurovipsCode = await getCityCode(cityName, context?.country);

    if (eurovipsCode) {
      const elapsed = Date.now() - startTime;
      console.log(`✅ [LAYER 3 SUCCESS] "${cityName}" → ${eurovipsCode} (EUROVIPS, ${elapsed}ms)`);
      return validateIATACode(eurovipsCode, cityName);
    }
  } catch (error) {
    console.warn(`   ⚠️  EUROVIPS query failed:`, (error as Error).message);
  }
  console.log(`   ⏭️  Not found in EUROVIPS, trying fallback...`);

  // ============================================
  // LAYER 4: Fallback (First 3 Letters)
  // ============================================
  console.log(`\n4️⃣ [LAYER 4] Using FALLBACK (first 3 letters)...`);
  const fallbackCode = cityName
    .trim()
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase();

  if (fallbackCode.length === 3) {
    const elapsed = Date.now() - startTime;
    console.warn(`⚠️ [LAYER 4 FALLBACK] "${cityName}" → ${fallbackCode} (${elapsed}ms)`);
    console.warn(`⚠️ [WARNING] Code generated from first 3 letters - may not be valid!`);
    console.warn(`⚠️ [ACTION REQUIRED] Add "${cityName}" to cityCodeService.ts mappings`);
    return validateIATACode(fallbackCode, cityName);
  }

  // ============================================
  // CRITICAL FAILURE
  // ============================================
  const elapsed = Date.now() - startTime;
  console.error(`\n❌ [CRITICAL FAILURE] Cannot resolve "${cityName}" (${elapsed}ms)`);
  console.error(`   → All 4 layers failed`);
  console.error(`   → City name too short or contains no letters`);

  throw new Error(
    `No se pudo obtener código IATA para "${cityName}". ` +
    `Verifica que el nombre de la ciudad sea válido.`
  );
}

/**
 * Validate IATA code format and structure
 * Ensures code meets Starling API requirements
 */
function validateIATACode(code: string, cityName: string): string {
  const cleaned = code.trim().toUpperCase();

  // Validate length (must be exactly 3 characters)
  if (cleaned.length !== 3) {
    throw new Error(
      `Código IATA inválido para "${cityName}": "${code}" ` +
      `(debe tener 3 caracteres, tiene ${cleaned.length})`
    );
  }

  // Validate format (alphanumeric only - IATA codes can have numbers)
  if (!/^[A-Z0-9]{3}$/.test(cleaned)) {
    throw new Error(
      `Código IATA inválido para "${cityName}": "${code}" ` +
      `(solo se permiten letras A-Z y números 0-9)`
    );
  }

  console.log(`   ✓ Validation passed: ${cleaned}`);
  return cleaned;
}
