import citiesData from '@/data/eurovips-cities.json';

interface CityRecord {
  cityCode: string;
  cityName: string;
  countryCode: string;
  countryName: string;
}

/**
 * Normalize string for comparison (lowercase, no accents, no special chars)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (acentos)
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars like ()
    .replace(/\s+/g, ' '); // Normalize spaces
}

/**
 * Build normalized index for O(1) lookups
 */
const buildCityIndex = (): Map<string, CityRecord> => {
  const index = new Map<string, CityRecord>();

  (citiesData as CityRecord[]).forEach((city) => {
    const normalized = normalizeString(city.cityName);

    // Store by normalized city name
    if (!index.has(normalized)) {
      index.set(normalized, city);
    }

    // Also store by city code (for reverse lookup)
    index.set(city.cityCode.toLowerCase(), city);
  });

  console.log(`🗺️ [CITY INDEX] Built index with ${index.size} entries from ${citiesData.length} cities`);

  return index;
};

// Singleton index (built once on module import)
const CITY_INDEX = buildCityIndex();

/**
 * Get city code from city name
 *
 * @param cityName - City name in any format (with/without accents)
 * @param countryHint - Optional country name for disambiguation
 * @returns City code for EUROVIPS API
 *
 * @example
 * getCityCode('Cancún') → 'CUN'
 * getCityCode('cancun') → 'CUN'
 * getCityCode('Córdoba', 'España') → 'XQC' (Córdoba ESP)
 * getCityCode('Córdoba', 'Argentina') → 'COR' (Córdoba ARG)
 */
export async function getCityCode(
  cityName: string,
  countryHint?: string
): Promise<string> {
  if (!cityName) {
    throw new Error('City name is required');
  }

  const normalizedCity = normalizeString(cityName);

  console.log(`🔍 [CITY LOOKUP] Searching for: "${cityName}" (normalized: "${normalizedCity}")`);

  // 1. EXACT MATCH: O(1) lookup
  const exactMatch = CITY_INDEX.get(normalizedCity);

  if (exactMatch) {
    // If country hint provided, verify it matches
    if (countryHint) {
      const normalizedCountry = normalizeString(countryHint);
      const recordCountry = normalizeString(exactMatch.countryName);
      const recordCity = normalizeString(exactMatch.cityName);

      // Check if country matches OR city name includes country (like "CORDOBA (ESP)")
      if (recordCountry.includes(normalizedCountry) ||
          normalizedCountry.includes(recordCountry) ||
          recordCity.includes(normalizedCountry)) {
        console.log(`✅ [EXACT + COUNTRY] "${cityName}, ${countryHint}" → ${exactMatch.cityCode}`);
        return exactMatch.cityCode;
      }

      console.log(`⚠️ [COUNTRY MISMATCH] Found "${exactMatch.cityName}" but country doesn't match "${countryHint}"`);
      // Fall through to search with country filter
    } else {
      console.log(`✅ [EXACT MATCH] "${cityName}" → ${exactMatch.cityCode}`);
      return exactMatch.cityCode;
    }
  }

  // 2. PARTIAL MATCH: Search for cities containing the input
  const allCities = Array.from(CITY_INDEX.values())
    .filter(city => city.cityCode.length === 3); // Avoid duplicates from reverse lookup

  const partialMatches = allCities.filter(city => {
    const cityNorm = normalizeString(city.cityName);
    const inputNorm = normalizedCity;

    // Check if city name contains input or vice versa
    const cityMatches = cityNorm.includes(inputNorm) || inputNorm.includes(cityNorm);

    if (!cityMatches) return false;

    // If country hint provided, filter by country
    if (countryHint) {
      const countryNorm = normalizeString(city.countryName);
      const cityFullNorm = normalizeString(city.cityName); // May include "(ESP)" etc
      const inputCountryNorm = normalizeString(countryHint);

      const countryMatches =
        countryNorm.includes(inputCountryNorm) ||
        inputCountryNorm.includes(countryNorm) ||
        cityFullNorm.includes(inputCountryNorm);

      return countryMatches;
    }

    return true;
  });

  if (partialMatches.length === 1) {
    console.log(`✅ [PARTIAL MATCH] "${cityName}" → ${partialMatches[0].cityCode} (${partialMatches[0].cityName})`);
    return partialMatches[0].cityCode;
  }

  if (partialMatches.length > 1) {
    console.warn(`⚠️ [AMBIGUOUS] Multiple matches for "${cityName}":`,
      partialMatches.map(c => `${c.cityName} (${c.countryName}) → ${c.cityCode}`));

    // Return first match (could be improved with better disambiguation)
    console.log(`→ Using first match: ${partialMatches[0].cityCode}`);
    return partialMatches[0].cityCode;
  }

  // 3. NOT FOUND: Throw error with helpful message
  console.error(`❌ [NOT FOUND] City "${cityName}" not found in EUROVIPS database`);

  throw new Error(
    `Ciudad no encontrada: "${cityName}". ` +
    `Por favor verifica el nombre de la ciudad.`
  );
}

/**
 * Get full city information (code + country)
 */
export async function getCityCodes(
  cityName: string,
  countryHint?: string
): Promise<{
  cityCode: string;
  cityName: string;
  countryCode: string;
  countryName: string;
}> {
  const cityCode = await getCityCode(cityName, countryHint);

  // Find full record by code
  const record = CITY_INDEX.get(cityCode.toLowerCase());

  if (!record) {
    throw new Error(`Could not find full data for city code: ${cityCode}`);
  }

  return {
    cityCode: record.cityCode,
    cityName: record.cityName,
    countryCode: record.countryCode,
    countryName: record.countryName
  };
}

/**
 * Search cities by partial name (for autocomplete)
 */
export function searchCities(query: string, limit: number = 10): CityRecord[] {
  if (!query || query.length < 2) return [];

  const normalized = normalizeString(query);

  const allCities = Array.from(CITY_INDEX.values())
    .filter(city => city.cityCode.length === 3); // Avoid duplicates

  return allCities
    .filter(city => {
      const cityNorm = normalizeString(city.cityName);
      const countryNorm = normalizeString(city.countryName);
      return cityNorm.includes(normalized) || countryNorm.includes(normalized);
    })
    .slice(0, limit);
}

/**
 * Get total number of cities available
 */
export function getCityCount(): number {
  return (citiesData as CityRecord[]).length;
}
