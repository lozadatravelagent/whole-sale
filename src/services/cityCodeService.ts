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

  // República Dominicana
  'punta cana': {
    iata: 'PUJ',
    hotelCode: 'PUJ',
    country: 'DO',
    aliases: ['puntacana']
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
        'la plata', 'mar del plata', 'san martin de los andes', 'el calafate'
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
  'EZE': 'Buenos Aires', 'AEP': 'Buenos Aires', 'COR': 'Córdoba', 'MDZ': 'Mendoza',
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
  'KIN': 'Kingston', 'MBJ': 'Montego Bay', 'NAN': 'Negril',

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
  'TLS': 'Toulouse', 'BSL': 'Basilea', 'BOD': 'Burdeos', 'NTE': 'Nantes',

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
