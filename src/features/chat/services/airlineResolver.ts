// Centralized airline code resolver service
import { getAirlineNameFromCode, getAirlineCodeFromName } from '../utils/flightHelpers';

interface AirlineInfo {
  code: string;
  name: string;
  source: 'static' | 'api' | 'learned' | 'external';
}

// In-memory cache for learned mappings
const learnedMappings = new Map<string, AirlineInfo>();

// OpenFlights API (free, no API key required)
const OPENFLIGHTS_URL = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat';

// Cache for OpenFlights data to avoid multiple API calls
let openflightsCache: Map<string, AirlineInfo> | null = null;
let openflightsCachePromise: Promise<Map<string, AirlineInfo>> | null = null;

/**
 * Centralized airline resolver - handles both user input and API codes
 */
export class AirlineResolver {
  private static instance: AirlineResolver;

  static getInstance(): AirlineResolver {
    if (!AirlineResolver.instance) {
      AirlineResolver.instance = new AirlineResolver();
    }
    return AirlineResolver.instance;
  }

  /**
   * Main resolution method - tries multiple strategies
   */
  async resolveAirline(input: string): Promise<AirlineInfo> {
    const normalizedInput = input.trim();

    console.log(`🔍 [AIRLINE RESOLVER] Resolving: "${normalizedInput}"`);

    // Strategy 1: Check learned mappings first (fastest)
    const learned = this.checkLearnedMappings(normalizedInput);
    if (learned) {
      console.log(`✅ Found in learned mappings: ${learned.name} (${learned.code})`);
      return learned;
    }

    // Strategy 2: Check static mappings (local)
    const staticMapping = this.checkStaticMappings(normalizedInput);
    if (staticMapping) {
      console.log(`✅ Found in static mappings: ${staticMapping.name} (${staticMapping.code})`);
      return staticMapping;
    }

    // Strategy 3: Try external API lookup
    try {
      const external = await this.lookupExternalAPI(normalizedInput);
      if (external) {
        console.log(`✅ Found via external API: ${external.name} (${external.code})`);
        // Learn this mapping for future use
        this.learnMapping(normalizedInput, external);
        return external;
      }
    } catch (error) {
      console.warn(`⚠️ External API lookup failed: ${error.message}`);
    }

    // Strategy 4: Create placeholder mapping
    const placeholder = this.createPlaceholder(normalizedInput);
    console.log(`🔶 Created placeholder: ${placeholder.name} (${placeholder.code})`);
    return placeholder;
  }

  /**
   * Learn from API responses - automatically map unknown codes
   */
  learnFromApiResponse(segments: any[]): void {
    for (const segment of segments) {
      const airlineCode = segment.Airline || segment.OperatingAirline;
      const airlineName = segment.OperatingAirlineName;

      if (airlineCode && airlineName && !this.isKnownCode(airlineCode)) {
        const airlineInfo: AirlineInfo = {
          code: airlineCode,
          name: airlineName,
          source: 'api'
        };

        this.learnMapping(airlineCode, airlineInfo);
        this.learnMapping(airlineName.toLowerCase(), airlineInfo);

        console.log(`📚 [AIRLINE LEARNER] Learned: ${airlineCode} = "${airlineName}"`);
      }
    }
  }

  /**
   * Batch process API response to learn all airline mappings
   */
  processApiResponse(tvcData: any): void {
    const fares = tvcData?.Fares || [];

    for (const fare of fares) {
      for (const leg of fare.Legs || []) {
        for (const option of leg.Options || []) {
          this.learnFromApiResponse(option.Segments || []);
        }
      }
    }
  }

  private checkLearnedMappings(input: string): AirlineInfo | null {
    const key = input.toLowerCase();
    return learnedMappings.get(key) || null;
  }

  private checkStaticMappings(input: string): AirlineInfo | null {
    // Try as airline code first
    if (input.length <= 3) {
      const name = getAirlineNameFromCode(input.toUpperCase());
      if (name !== input.toUpperCase()) {
        return {
          code: input.toUpperCase(),
          name: name,
          source: 'static'
        };
      }
    }

    // Try as airline name
    const code = getAirlineCodeFromName(input);
    if (code !== input.toUpperCase()) {
      const name = getAirlineNameFromCode(code);
      return {
        code: code,
        name: name,
        source: 'static'
      };
    }

    return null;
  }

  private async lookupExternalAPI(input: string): Promise<AirlineInfo | null> {
    try {
      const openflightsData = await this.getOpenFlightsData();

      // Search by IATA code (case insensitive)
      const byCode = openflightsData.get(input.toUpperCase());
      if (byCode) return byCode;

      // Search by name (partial match, case insensitive)
      const inputLower = input.toLowerCase();
      for (const [key, airline] of openflightsData) {
        if (airline.name.toLowerCase().includes(inputLower) ||
            inputLower.includes(airline.name.toLowerCase())) {
          return airline;
        }
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ OpenFlights lookup failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Get and cache OpenFlights airline data
   */
  private async getOpenFlightsData(): Promise<Map<string, AirlineInfo>> {
    // Return cached data if available
    if (openflightsCache) {
      return openflightsCache;
    }

    // Return existing promise if already loading
    if (openflightsCachePromise) {
      return await openflightsCachePromise;
    }

    // Start loading data
    openflightsCachePromise = this.loadOpenFlightsData();
    openflightsCache = await openflightsCachePromise;
    openflightsCachePromise = null; // Clear promise after completion

    return openflightsCache;
  }

  /**
   * Load and parse OpenFlights airline data
   */
  private async loadOpenFlightsData(): Promise<Map<string, AirlineInfo>> {
    console.log(`🌐 [AIRLINE RESOLVER] Loading OpenFlights data...`);

    const response = await fetch(OPENFLIGHTS_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const csvData = await response.text();
    const airlines = new Map<string, AirlineInfo>();

    // Parse CSV data (OpenFlights format)
    const lines = csvData.trim().split('\n');
    let processed = 0;

    for (const line of lines) {
      try {
        // OpenFlights CSV format: ID,Name,Alias,IATA,ICAO,Callsign,Country,Active
        const fields = this.parseCSVLine(line);
        if (fields.length < 8) continue;

        const [id, name, alias, iata, icao, callsign, country, active] = fields;

        // Only include active airlines with IATA codes
        if (active === 'Y' && iata && iata !== '\\N' && iata.length === 2) {
          const airlineInfo: AirlineInfo = {
            code: iata,
            name: name,
            source: 'external'
          };

          airlines.set(iata, airlineInfo);
          processed++;
        }
      } catch (error) {
        // Skip malformed lines
        continue;
      }
    }

    console.log(`✅ [AIRLINE RESOLVER] Loaded ${processed} airlines from OpenFlights`);
    return airlines;
  }

  /**
   * Parse CSV line handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    fields.push(current.trim());
    return fields;
  }

  private createPlaceholder(input: string): AirlineInfo {
    if (input.length <= 3) {
      // Treat as airline code
      return {
        code: input.toUpperCase(),
        name: `Airline ${input.toUpperCase()}`,
        source: 'learned'
      };
    } else {
      // Treat as airline name
      const code = input.substring(0, 2).toUpperCase();
      return {
        code: code,
        name: input,
        source: 'learned'
      };
    }
  }

  private learnMapping(key: string, airlineInfo: AirlineInfo): void {
    learnedMappings.set(key.toLowerCase(), airlineInfo);
  }

  private isKnownCode(code: string): boolean {
    return getAirlineNameFromCode(code) !== code;
  }

  /**
   * Get all learned mappings for debugging
   */
  getLearnedMappings(): Map<string, AirlineInfo> {
    return new Map(learnedMappings);
  }

  /**
   * Export learned mappings for persistence
   */
  exportLearnedMappings(): Record<string, AirlineInfo> {
    return Object.fromEntries(learnedMappings);
  }
}

// Singleton instance
export const airlineResolver = AirlineResolver.getInstance();

/**
 * Convenience function for quick resolution
 */
export async function resolveAirlineQuick(input: string): Promise<{ code: string; name: string }> {
  const result = await airlineResolver.resolveAirline(input);
  return {
    code: result.code,
    name: result.name
  };
}