/**
 * Build Metadata Helper
 *
 * Construye metadata extendida para responses de búsqueda,
 * incluyendo información sobre whitelists, filtros aplicados y exclusiones.
 */

export interface SearchMetadata {
  search_time_ms?: number;
  ai_parsing_time_ms?: number;
  pre_parsing_time_ms?: number;
  providers_used: string[];

  // Flight-specific metadata
  light_fares_excluded?: number;
  light_fare_airlines?: string[];

  // Hotel-specific metadata
  destination_rules?: {
    type: 'quality_whitelist' | null;
    destination?: string;
    total_available_from_provider?: number;
    whitelist_matches?: number;
    after_all_filters?: number;
    reason?: string;
  };
  hotels_excluded_no_matching_rooms?: number;
  room_filters_applied?: {
    capacity?: string;
    meal_plan?: string;
  };

  // Combined metadata
  filtering_pipeline?: Array<{
    stage: string;
    filter: string;
    input_count?: number;
    output_count?: number;
  }>;
}

export interface FiltersApplied {
  // Flight filters
  stopsFilter?: boolean;
  luggageFilter?: boolean;
  airlineFilter?: boolean;
  layoverFilter?: boolean;

  // Hotel filters
  whitelistFilter?: boolean;
  chainFilter?: boolean;
  nameFilter?: boolean;
  roomFilter?: boolean;

  // Counts
  lightFaresExcluded?: number;
  hotelsExcludedNoRooms?: number;
}

/**
 * Build extended metadata for search results
 */
export function buildExtendedMetadata(
  results: any,
  filtersApplied: FiltersApplied,
  timingData?: {
    searchTimeMs?: number;
    aiParsingTimeMs?: number;
    preParsingTimeMs?: number;
  }
): SearchMetadata {
  const metadata: SearchMetadata = {
    providers_used: determineProvidersUsed(results),
    ...timingData
  };

  // Add flight-specific metadata
  if (results.flights) {
    if (filtersApplied.lightFaresExcluded && filtersApplied.lightFaresExcluded > 0) {
      metadata.light_fares_excluded = filtersApplied.lightFaresExcluded;
      metadata.light_fare_airlines = ['LA', 'H2', 'AV', 'AM', 'JA', 'AR'];
    }
  }

  // Add hotel-specific metadata
  if (results.hotels) {
    // Whitelist metadata
    if (filtersApplied.whitelistFilter) {
      const destination = extractDestination(results);
      metadata.destination_rules = {
        type: 'quality_whitelist',
        destination,
        reason: 'Destino con lista curada de hoteles verificados'
      };
    }

    // Room exclusion metadata
    if (filtersApplied.hotelsExcludedNoRooms && filtersApplied.hotelsExcludedNoRooms > 0) {
      metadata.hotels_excluded_no_matching_rooms = filtersApplied.hotelsExcludedNoRooms;
    }

    // Room filters applied
    if (filtersApplied.roomFilter) {
      metadata.room_filters_applied = extractRoomFilters(results);
    }
  }

  return metadata;
}

/**
 * Determine which providers were used based on results
 */
function determineProvidersUsed(results: any): string[] {
  const providers: string[] = [];

  if (results.flights && results.flights.count > 0) {
    providers.push('starling');
  }

  if (results.hotels && results.hotels.count > 0) {
    providers.push('eurovips');
  }

  if (results.packages && results.packages.count > 0) {
    providers.push('eurovips');
  }

  if (results.services && results.services.count > 0) {
    providers.push('eurovips');
  }

  return providers.length > 0 ? providers : ['none'];
}

/**
 * Extract destination from results
 */
function extractDestination(results: any): string {
  if (results.hotels && results.hotels.items && results.hotels.items.length > 0) {
    return results.hotels.items[0].city || 'Unknown';
  }

  return 'Unknown';
}

/**
 * Extract room filters that were applied
 */
function extractRoomFilters(results: any): {
  capacity?: string;
  meal_plan?: string;
} {
  const filters: any = {};

  // Try to infer from search params (if available in results metadata)
  if (results.searchParams) {
    if (results.searchParams.roomType) {
      filters.capacity = results.searchParams.roomType;
    }
    if (results.searchParams.mealPlan) {
      filters.meal_plan = results.searchParams.mealPlan;
    }
  }

  return filters;
}

/**
 * Build filtering pipeline metadata for detailed tracking
 */
export function buildFilteringPipeline(steps: Array<{
  stage: string;
  filter: string;
  inputCount?: number;
  outputCount?: number;
}>): Array<{
  stage: string;
  filter: string;
  input_count?: number;
  output_count?: number;
}> {
  return steps.map(step => ({
    stage: step.stage,
    filter: step.filter,
    input_count: step.inputCount,
    output_count: step.outputCount
  }));
}

/**
 * Add parsing details to metadata
 */
export function addParsingDetails(
  parsedRequest: any,
  preParserExtracted: string[],
  aiExtracted: string[],
  preParsingTimeMs: number,
  aiParsingTimeMs: number
): any {
  return {
    ...parsedRequest,
    parsing_details: {
      pre_parser_extracted: preParserExtracted,
      ai_extracted: aiExtracted,
      pre_parser_time_ms: preParsingTimeMs,
      ai_time_ms: aiParsingTimeMs
    }
  };
}

/**
 * Calculate search time from start timestamp
 */
export function calculateSearchTime(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * Build complete response metadata
 */
export function buildCompleteMetadata(
  providers: string[],
  searchTimeMs: number,
  aiParsingTimeMs?: number,
  preParsingTimeMs?: number,
  additionalMetadata?: Partial<SearchMetadata>
): SearchMetadata {
  const metadata: SearchMetadata = {
    search_time_ms: searchTimeMs,
    providers_used: providers
  };

  if (aiParsingTimeMs !== undefined) {
    metadata.ai_parsing_time_ms = aiParsingTimeMs;
  }

  if (preParsingTimeMs !== undefined) {
    metadata.pre_parsing_time_ms = preParsingTimeMs;
  }

  if (additionalMetadata) {
    Object.assign(metadata, additionalMetadata);
  }

  return metadata;
}
