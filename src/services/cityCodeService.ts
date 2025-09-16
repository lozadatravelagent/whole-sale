/**
 * City Code Service - Converts city names to IATA airport codes
 * Centralizes all city-to-code mapping for flights and hotels
 */

interface CityCodeMapping {
  iata: string;      // Airport code for flights (IATA)
  hotelCode: string; // City code for hotels (may differ from IATA)
  country: string;
  aliases: string[]; // Alternative names for the city
}

const CITY_MAPPINGS: Record<string, CityCodeMapping> = {
  // Argentina
  'buenos aires': {
    iata: 'EZE',
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
 * Get IATA airport code for flights
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