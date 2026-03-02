/**
 * Hotelbeds Destination Code Resolver
 *
 * Static map of high-traffic destinations → Hotelbeds destination codes.
 * Phase 2 will replace this with database lookup from hotelbeds_destinations table.
 */

interface DestinationMapping {
  hotelbedsCode: string;
  aliases: string[];
}

const DESTINATION_MAP: Record<string, DestinationMapping> = {
  // Caribbean
  'punta cana': { hotelbedsCode: 'PUJ', aliases: ['puj', 'puntacana', 'bavaro'] },
  'cancun': { hotelbedsCode: 'CUN', aliases: ['cancún', 'riviera maya'] },
  'playa del carmen': { hotelbedsCode: 'PCM', aliases: ['playadelcarmen', 'playa carmen'] },
  'san jose del cabo': { hotelbedsCode: 'SJD', aliases: ['los cabos', 'cabo san lucas'] },
  'cartagena': { hotelbedsCode: 'CTG', aliases: ['cartagena de indias'] },
  'san andres': { hotelbedsCode: 'ADZ', aliases: ['san andrés', 'san andres isla'] },
  'la habana': { hotelbedsCode: 'HAV', aliases: ['habana', 'havana'] },
  'varadero': { hotelbedsCode: 'VRA', aliases: [] },
  'nassau': { hotelbedsCode: 'NAS', aliases: ['bahamas'] },
  'aruba': { hotelbedsCode: 'AUA', aliases: ['oranjestad'] },
  'curacao': { hotelbedsCode: 'CUR', aliases: ['curazao', 'curaçao', 'willemstad'] },
  'montego bay': { hotelbedsCode: 'MBJ', aliases: ['jamaica', 'negril'] },

  // USA
  'miami': { hotelbedsCode: 'MIA', aliases: ['miami beach', 'south beach'] },
  'orlando': { hotelbedsCode: 'ORL', aliases: ['disney', 'walt disney world'] },
  'nueva york': { hotelbedsCode: 'NYC', aliases: ['new york', 'manhattan', 'nyc'] },
  'las vegas': { hotelbedsCode: 'LAS', aliases: [] },
  'los angeles': { hotelbedsCode: 'LAX', aliases: ['la', 'hollywood'] },
  'san francisco': { hotelbedsCode: 'SFO', aliases: [] },

  // South America
  'buenos aires': { hotelbedsCode: 'BUE', aliases: ['bsas', 'baires', 'caba', 'capital federal'] },
  'bariloche': { hotelbedsCode: 'BRC', aliases: ['san carlos de bariloche'] },
  'mendoza': { hotelbedsCode: 'MDZ', aliases: [] },
  'ushuaia': { hotelbedsCode: 'USH', aliases: ['tierra del fuego'] },
  'el calafate': { hotelbedsCode: 'FTE', aliases: ['calafate', 'glaciar perito moreno'] },
  'iguazu': { hotelbedsCode: 'IGR', aliases: ['iguazú', 'cataratas', 'puerto iguazu'] },
  'salta': { hotelbedsCode: 'SLA', aliases: [] },
  'cordoba': { hotelbedsCode: 'COR', aliases: ['córdoba'] },
  'lima': { hotelbedsCode: 'LIM', aliases: [] },
  'cusco': { hotelbedsCode: 'CUZ', aliases: ['cuzco', 'machu picchu'] },
  'santiago': { hotelbedsCode: 'SCL', aliases: ['santiago de chile'] },
  'rio de janeiro': { hotelbedsCode: 'RIO', aliases: ['rio', 'copacabana'] },
  'sao paulo': { hotelbedsCode: 'SAO', aliases: ['são paulo'] },
  'bogota': { hotelbedsCode: 'BOG', aliases: ['bogotá'] },
  'montevideo': { hotelbedsCode: 'MVD', aliases: [] },
  'punta del este': { hotelbedsCode: 'PDP', aliases: [] },

  // Europe
  'madrid': { hotelbedsCode: 'MAD', aliases: [] },
  'barcelona': { hotelbedsCode: 'BCN', aliases: [] },
  'paris': { hotelbedsCode: 'PAR', aliases: ['parís'] },
  'roma': { hotelbedsCode: 'ROM', aliases: ['rome'] },
  'londres': { hotelbedsCode: 'LON', aliases: ['london'] },
  'amsterdam': { hotelbedsCode: 'AMS', aliases: [] },
  'berlin': { hotelbedsCode: 'BER', aliases: ['berlín'] },
  'lisboa': { hotelbedsCode: 'LIS', aliases: ['lisbon'] },
  'estambul': { hotelbedsCode: 'IST', aliases: ['istanbul', 'estanbul'] },
  'atenas': { hotelbedsCode: 'ATH', aliases: ['athens'] },
  'praga': { hotelbedsCode: 'PRG', aliases: ['prague'] },
  'viena': { hotelbedsCode: 'VIE', aliases: ['vienna'] },

  // Asia
  'dubai': { hotelbedsCode: 'DXB', aliases: [] },
  'bangkok': { hotelbedsCode: 'BKK', aliases: [] },
  'tokio': { hotelbedsCode: 'TYO', aliases: ['tokyo'] },
  'singapur': { hotelbedsCode: 'SIN', aliases: ['singapore'] },

  // Mexico
  'ciudad de mexico': { hotelbedsCode: 'MEX', aliases: ['cdmx', 'mexico city', 'df'] },
};

/**
 * Normalize text for comparison: lowercase, strip accents
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Resolve a city name or code to a Hotelbeds destination code.
 *
 * Attempts exact match first, then alias match, then returns input as-is
 * (assuming it might already be a valid Hotelbeds code).
 */
export function resolveHotelbedsDestination(input: string): string {
  if (!input) return '';

  const normalized = normalize(input);

  // Direct match
  if (DESTINATION_MAP[normalized]) {
    return DESTINATION_MAP[normalized].hotelbedsCode;
  }

  // Check all aliases
  for (const [, mapping] of Object.entries(DESTINATION_MAP)) {
    if (mapping.aliases.some(alias => normalize(alias) === normalized)) {
      return mapping.hotelbedsCode;
    }
    // Also check if input matches the hotelbedsCode directly
    if (mapping.hotelbedsCode.toLowerCase() === normalized) {
      return mapping.hotelbedsCode;
    }
  }

  // If nothing matched, return input uppercase (might already be a valid code)
  console.warn(`[HOTELBEDS_DEST] No mapping found for "${input}", using as-is`);
  return input.toUpperCase();
}
