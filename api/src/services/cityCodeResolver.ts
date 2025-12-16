/**
 * City Code Resolver for API Gateway
 *
 * Convierte nombres de ciudades a códigos IATA de aeropuertos para Starling API.
 *
 * Resolution Strategy:
 * 1. Smart context-aware logic (Buenos Aires → AEP/EZE based on destination)
 * 2. Local static dictionary (current implementation)
 * 3. Fallback: First 3 letters (with warning)
 *
 * TODO: Add EUROVIPS getCountryList as Layer 3 for better coverage
 * This would require making resolve functions async and adding supabase client param
 */

interface CityCodeMapping {
    iata: string;      // Airport code for flights (IATA) - primary
    iataSecondary?: string; // Secondary IATA airport code
    hotelCode: string; // City code for hotels (may differ from IATA)
    country: string;
    aliases: string[]; // Alternative names for the city
}

/**
 * CITY_MAPPINGS - Diccionario de códigos de ciudades
 */
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
    'playa del carmen': {
        iata: 'CUN',           // Aeropuerto más cercano es Cancún
        hotelCode: 'PCM',      // Código EUROVIPS para Playa del Carmen
        country: 'MX',
        aliases: ['playa carmen', 'playacar', 'riviera maya playa']
    },
    'riviera maya': {
        iata: 'CUN',           // Aeropuerto más cercano es Cancún
        hotelCode: 'PCM',      // Usa mismo código que Playa del Carmen
        country: 'MX',
        aliases: ['rivera maya', 'maya riviera']
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
 * Get IATA airport code for flights (primary airport)
 */
function getAirportCode(cityName: string): string | null {
    const normalizedCity = normalizeString(cityName);

    // Direct match
    const mapping = CITY_MAPPINGS[normalizedCity];
    if (mapping) {
        return mapping.iata;
    }

    // Check aliases
    for (const [_key, value] of Object.entries(CITY_MAPPINGS)) {
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
function getSmartAirportCode(cityName: string, destination?: string): string | null {
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
 * Validate IATA code format and structure
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

    return cleaned;
}

/**
 * ⭐ UNIFIED AIRPORT CODE RESOLVER ⭐
 *
 * Resolution Strategy:
 * 1️⃣ SMART LOGIC: Context-aware (Buenos Aires → AEP/EZE based on destination)
 * 2️⃣ LOCAL DICT: Static dictionary (ciudades principales)
 * 3️⃣ FALLBACK: First 3 letters (last resort with warning)
 */
export function resolveAirportCode(
    cityName: string,
    destination?: string
): string {
    if (!cityName || cityName.trim() === '') {
        console.warn('⚠️ [AIRPORT RESOLVER] Empty city name provided');
        throw new Error('❌ City name cannot be empty');
    }

    const startTime = Date.now();
    console.log(`\n🔍 [UNIFIED RESOLVER] Starting resolution for: "${cityName}"`);
    if (destination) console.log(`   → Destination context: "${destination}"`);

    // ============================================
    // LAYER 1: Smart Context-Aware Logic
    // ============================================
    console.log(`\n1️⃣ [LAYER 1] Trying smart context-aware logic...`);
    const smartCode = getSmartAirportCode(cityName, destination);

    if (smartCode) {
        const elapsed = Date.now() - startTime;
        console.log(`✅ [LAYER 1 SUCCESS] "${cityName}" → ${smartCode} (smart logic, ${elapsed}ms)`);
        return validateIATACode(smartCode, cityName);
    }
    console.log(`   ⏭️  Layer 1 returned null, trying next layer...`);

    // ============================================
    // LAYER 2: Local Static Dictionary
    // ============================================
    console.log(`\n2️⃣ [LAYER 2] Trying local static dictionary...`);
    const localCode = getAirportCode(cityName);

    if (localCode) {
        const elapsed = Date.now() - startTime;
        console.log(`✅ [LAYER 2 SUCCESS] "${cityName}" → ${localCode} (static dict, ${elapsed}ms)`);
        return validateIATACode(localCode, cityName);
    }
    console.log(`   ⏭️  City not in local dictionary, trying fallback...`);

    // ============================================
    // LAYER 3: Fallback (First 3 Letters)
    // ============================================
    console.log(`\n3️⃣ [LAYER 3] Using FALLBACK (first 3 letters)...`);
    const fallbackCode = cityName
        .trim()
        .replace(/[^a-zA-Z]/g, '')
        .slice(0, 3)
        .toUpperCase();

    if (fallbackCode.length === 3) {
        const elapsed = Date.now() - startTime;
        console.warn(`⚠️ [LAYER 3 FALLBACK] "${cityName}" → ${fallbackCode} (${elapsed}ms)`);
        console.warn(`⚠️ [WARNING] Code generated from first 3 letters - may not be valid!`);
        console.warn(`⚠️ [ACTION REQUIRED] Add "${cityName}" to CITY_MAPPINGS in cityCodeResolver.ts`);
        return validateIATACode(fallbackCode, cityName);
    }

    // ============================================
    // CRITICAL FAILURE
    // ============================================
    const elapsed = Date.now() - startTime;
    console.error(`\n❌ [CRITICAL FAILURE] Cannot resolve "${cityName}" (${elapsed}ms)`);
    throw new Error(
        `No se pudo obtener código IATA para "${cityName}". ` +
        `Verifica que el nombre de la ciudad sea válido.`
    );
}

/**
 * Resolves both origin and destination codes for a flight search
 */
export function resolveFlightCodes(
    origin: string,
    destination: string
): { originCode: string; destinationCode: string } {
    console.log('\n' + '='.repeat(60));
    console.log('✈️ [FLIGHT CODE RESOLVER] Starting resolution...');
    console.log('='.repeat(60));
    console.log(`   Origin:      "${origin}"`);
    console.log(`   Destination: "${destination}"`);

    // Use destination context for smart resolution (Buenos Aires logic)
    const originCode = resolveAirportCode(origin, destination);
    const destinationCode = resolveAirportCode(destination, origin);

    console.log('\n✅ [FLIGHT CODE RESOLVER] Resolution complete:');
    console.log(`   "${origin}" → ${originCode}`);
    console.log(`   "${destination}" → ${destinationCode}`);
    console.log('='.repeat(60) + '\n');

    return { originCode, destinationCode };
}

// =============================================================================
// HOTEL CODE RESOLVER
// =============================================================================

/**
 * Normalize string for comparison (lowercase, remove accents)
 */
function normalizeForHotel(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

/**
 * Get hotel city code from city name
 * Uses hotelCode field from CITY_MAPPINGS
 */
function getHotelCode(cityName: string): string | null {
    const normalizedCity = normalizeForHotel(cityName);

    // Direct lookup
    if (CITY_MAPPINGS[normalizedCity]) {
        return CITY_MAPPINGS[normalizedCity].hotelCode;
    }

    // Check aliases
    for (const [_key, value] of Object.entries(CITY_MAPPINGS)) {
        if (value.aliases.some(alias => normalizeForHotel(alias) === normalizedCity)) {
            return value.hotelCode;
        }
    }

    return null;
}

/**
 * ⭐ HOTEL CODE RESOLVER ⭐
 *
 * Resuelve el código de ciudad para búsquedas de hoteles en EUROVIPS.
 *
 * Resolution Strategy:
 * 1️⃣ LOCAL DICT: Static dictionary (CITY_MAPPINGS.hotelCode)
 * 2️⃣ FALLBACK: First 3 letters (uppercase) with warning
 *
 * @param cityName - Nombre de la ciudad (ej: "Punta Cana", "Miami")
 * @returns Código de ciudad para EUROVIPS (ej: "PUJ", "MIA")
 */
export function resolveHotelCode(cityName: string): string {
    if (!cityName || cityName.trim() === '') {
        console.warn('⚠️ [HOTEL RESOLVER] Empty city name provided');
        throw new Error('❌ City name cannot be empty');
    }

    const startTime = Date.now();
    console.log(`\n🏨 [HOTEL CODE RESOLVER] Starting resolution for: "${cityName}"`);

    // ============================================
    // LAYER 1: Check if already a valid code (3 uppercase letters)
    // ============================================
    const trimmed = cityName.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(trimmed)) {
        console.log(`✅ [HOTEL RESOLVER] Already a valid code: ${trimmed}`);
        return trimmed;
    }

    // ============================================
    // LAYER 2: Local Static Dictionary
    // ============================================
    console.log(`\n1️⃣ [LAYER 1] Trying local static dictionary...`);
    const localCode = getHotelCode(cityName);

    if (localCode) {
        const elapsed = Date.now() - startTime;
        console.log(`✅ [LAYER 1 SUCCESS] "${cityName}" → ${localCode} (static dict, ${elapsed}ms)`);
        return localCode;
    }
    console.log(`   ⏭️  City not in local dictionary, trying fallback...`);

    // ============================================
    // LAYER 3: Fallback (First 3 Letters)
    // ============================================
    console.log(`\n2️⃣ [LAYER 2] Using FALLBACK (first 3 letters)...`);
    const fallbackCode = cityName
        .trim()
        .replace(/[^a-zA-Z]/g, '')
        .slice(0, 3)
        .toUpperCase();

    if (fallbackCode.length === 3) {
        const elapsed = Date.now() - startTime;
        console.warn(`⚠️ [LAYER 2 FALLBACK] "${cityName}" → ${fallbackCode} (${elapsed}ms)`);
        console.warn(`⚠️ [WARNING] Code generated from first 3 letters - may not be valid!`);
        console.warn(`⚠️ [ACTION REQUIRED] Add "${cityName}" to CITY_MAPPINGS with hotelCode`);
        return fallbackCode;
    }

    // ============================================
    // CRITICAL FAILURE
    // ============================================
    const elapsed = Date.now() - startTime;
    console.error(`\n❌ [CRITICAL FAILURE] Cannot resolve hotel code for "${cityName}" (${elapsed}ms)`);
    throw new Error(
        `No se pudo obtener código de ciudad para hoteles: "${cityName}". ` +
        `Verifica que el nombre de la ciudad sea válido.`
    );
}
