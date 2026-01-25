/**
 * Search Executor for API Search Edge Function
 *
 * Executes searches by calling underlying Edge Functions (starling-flights, eurovips-soap)
 * Replicates the logic from src/features/chat/services/searchHandlers.ts
 * but adapted for Edge Function environment.
 *
 * Features:
 * - Per-leg connections analysis
 * - Technical stops detection
 * - Baggage analysis per leg (8 types)
 * - Extended price breakdown
 * - Time preference filtering
 * - Segment details (bookingClass, equipment, fareBasis)
 * - Full results storage with searchId
 */

import { createClient } from '@supabase/supabase-js';
import type { ParsedRequest, SearchResults } from './contextManagement.js';
import {
  applyDestinationWhitelist,
  applyRoomFiltering,
  inferAdultsFromRoomType,
  shouldExcludeLightFare,
  getLightFareAirlines,
  hotelBelongsToChain
} from './advancedFilters.js';
import { resolveFlightCodes, resolveHotelCode } from './cityCodeResolver.js';
import { transformFare, analyzeFlightType, type TransformOptions } from './flightTransformer.js';
import { matchesLuggagePreference, analyzeBaggagePerLeg, type PerLegBaggageInfo } from './baggageUtils.js';
import { filterFlightsByTimePreference, timePreferenceToRange, timeRangeToLabel } from './timeSlotMapper.js';
import { getAirlineName } from '../data/airlineAliases.js';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const PROVIDER_TIMEOUT_MS = 45000; // 45 seconds (Starling puede tardar 20-30s en búsquedas internacionales)

/**
 * Invoke Supabase Edge Function with timeout
 *
 * Prevents hanging requests by aborting after PROVIDER_TIMEOUT_MS
 *
 * @param supabase - Supabase client
 * @param functionName - Name of Edge Function to invoke
 * @param body - Request body
 * @returns Response data
 * @throws Error if timeout or provider error
 */
async function invokeWithTimeout<T>(
  supabase: ReturnType<typeof createClient>,
  functionName: string,
  body: unknown
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  const startTime = Date.now();

  try {
    console.log(`[INVOKE_TIMEOUT] Calling ${functionName}...`);

    const response = await supabase.functions.invoke(functionName, {
      body: body as any,
      // @ts-ignore - Node.js 18+ supports signal in fetch
      signal: controller.signal,
    });

    const latency = Date.now() - startTime;

    if (response.error) {
      console.error(`[INVOKE_TIMEOUT] ❌ ${functionName} error (${latency}ms):`, response.error);
      throw new Error(response.error.message);
    }

    console.log(`[INVOKE_TIMEOUT] ✅ ${functionName} completed (${latency}ms)`);
    return response.data as T;
  } catch (error: any) {
    const latency = Date.now() - startTime;

    if (error.name === 'AbortError') {
      console.error(`[INVOKE_TIMEOUT] ⏱️ ${functionName} timed out after ${PROVIDER_TIMEOUT_MS}ms`);
      throw new Error(`Provider ${functionName} timed out after ${PROVIDER_TIMEOUT_MS}ms`);
    }

    console.error(`[INVOKE_TIMEOUT] ❌ ${functionName} failed (${latency}ms):`, error.message);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Format flight duration from minutes to human-readable string
 */
function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return 'N/A';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Interleave hotels from different chains in round-robin fashion
 * Ensures fair representation of each chain in results
 */
function interleaveHotelsByChain(hotels: any[], chains: string[]): any[] {
  if (chains.length <= 1) return hotels;

  // Group hotels by chain
  const byChain = new Map<string, any[]>();
  chains.forEach(c => byChain.set(c.toLowerCase(), []));

  // Categorize each hotel into its chain group
  for (const hotel of hotels) {
    const hotelName = (hotel.name || '').toLowerCase();
    for (const chain of chains) {
      if (hotelName.includes(chain.toLowerCase())) {
        byChain.get(chain.toLowerCase())!.push(hotel);
        break; // Hotel belongs to first matching chain
      }
    }
  }

  // Log distribution
  for (const [chain, chainHotels] of byChain.entries()) {
    console.log(`📍 [INTERLEAVE] ${chain}: ${chainHotels.length} hotels`);
  }

  // Round-robin interleave (take one from each chain until we have enough)
  const result: any[] = [];
  let round = 0;
  const maxResults = 10; // Get more initially, will be filtered to 5 later

  while (result.length < maxResults) {
    let addedThisRound = false;

    for (const chain of chains) {
      const chainHotels = byChain.get(chain.toLowerCase())!;
      if (round < chainHotels.length && result.length < maxResults) {
        result.push(chainHotels[round]);
        console.log(`✅ [INTERLEAVE] Round ${round + 1}: Added "${chainHotels[round].name}" from ${chain}`);
        addedThisRound = true;
      }
    }

    if (!addedThisRound) break; // No more hotels to add from any chain
    round++;
  }

  console.log(`📊 [INTERLEAVE] Final interleaved count: ${result.length} hotels`);
  return result;
}

/**
 * Calculate layover hours between two flight segments
 * Used for filtering flights by maximum layover duration
 */
function calculateLayoverHours(arrivalSegment: any, departureSegment: any): number {
  try {
    const arrivalTime = arrivalSegment.arrival?.time || '';
    const arrivalDate = arrivalSegment.arrival?.date || '';
    const departureTime = departureSegment.departure?.time || '';
    const departureDate = departureSegment.departure?.date || '';

    if (!arrivalTime || !arrivalDate || !departureTime || !departureDate) {
      console.warn('[LAYOVER_CALC] Missing time/date data for layover calculation');
      return 0;
    }

    const arrivalDateTime = new Date(`${arrivalDate}T${arrivalTime}:00`);
    const departureDateTime = new Date(`${departureDate}T${departureTime}:00`);
    const layoverMs = departureDateTime.getTime() - arrivalDateTime.getTime();
    const layoverHours = layoverMs / (1000 * 60 * 60);

    return layoverHours;
  } catch (error) {
    console.error('[LAYOVER_CALC] Error calculating layover:', error);
    return 0;
  }
}

// =============================================================================
// EXECUTE SEARCH - Main entry point
// =============================================================================

export async function executeSearch(
  parsedRequest: ParsedRequest,
  supabase: ReturnType<typeof createClient>
): Promise<SearchResults> {
  console.log('[SEARCH_EXECUTOR] Executing search for type:', parsedRequest.type);

  switch (parsedRequest.type) {
    case 'flights':
      return await executeFlightSearch(parsedRequest, supabase);

    case 'hotels':
      return await executeHotelSearch(parsedRequest, supabase);

    case 'combined':
      return await executeCombinedSearch(parsedRequest, supabase);

    case 'packages':
      return await executePackageSearch(parsedRequest, supabase);

    case 'services':
      return await executeServiceSearch(parsedRequest, supabase);

    case 'itinerary':
      return await executeItinerarySearch(parsedRequest, supabase);

    default:
      throw new Error(`Unsupported request type: ${parsedRequest.type}`);
  }
}

// =============================================================================
// FLIGHT SEARCH
// =============================================================================

async function executeFlightSearch(
  parsedRequest: ParsedRequest,
  supabase: ReturnType<typeof createClient>
): Promise<SearchResults> {
  console.log('[FLIGHT_SEARCH] Starting flight search');

  if (!parsedRequest.flights) {
    throw new Error('No flight data in parsed request');
  }

  const { flights } = parsedRequest;

  // ✅ REGLA DE NEGOCIO: Convertir nombres de ciudades a códigos IATA
  // Usa la misma lógica que el chat interno (src/services/cityCodeService.ts)
  // Buenos Aires: EZE para vuelos internacionales, AEP para domésticos
  console.log('[FLIGHT_SEARCH] Converting city names to IATA codes...');
  console.log(`   Origin: "${flights.origin}"`);
  console.log(`   Destination: "${flights.destination}"`);

  const { originCode, destinationCode } = resolveFlightCodes(
    flights.origin,
    flights.destination
  );

  console.log('[FLIGHT_SEARCH] IATA codes resolved:');
  console.log(`   "${flights.origin}" → ${originCode}`);
  console.log(`   "${flights.destination}" → ${destinationCode}`);

  // Build Starling API request - passengers
  const passengers: Array<{ Count: number; Type: string }> = [];

  // Add adults (ADT)
  const adultsCount = flights.adults || 1;
  if (adultsCount > 0) {
    passengers.push({
      Count: adultsCount,
      Type: 'ADT'
    });
  }

  // Add children if present (CHD - 2-12 años)
  if (flights.children && flights.children > 0) {
    passengers.push({
      Count: flights.children,
      Type: 'CHD'
    });
  }

  // Add infants if present (INF - 0-2 años, viajan en brazos de adulto)
  // IMPORTANTE: No puede haber más infantes que adultos
  if (flights.infants && flights.infants > 0) {
    // Validar restricción: max 1 infante por adulto
    const validInfants = Math.min(flights.infants, adultsCount);
    if (validInfants !== flights.infants) {
      console.warn(`[FLIGHT_SEARCH] ⚠️ Infants adjusted from ${flights.infants} to ${validInfants} (max 1 infant per adult)`);
    }
    if (validInfants > 0) {
      passengers.push({
        Count: validInfants,
        Type: 'INF'
      });
    }
  }

  const starlingRequest: any = {
    Passengers: passengers,
    Legs: [
      {
        DepartureAirportCity: originCode,      // ✅ Código IATA, no texto
        ArrivalAirportCity: destinationCode,   // ✅ Código IATA, no texto
        FlightDate: flights.departureDate
      }
    ]
  };

  // Add return leg if present
  if (flights.returnDate) {
    starlingRequest.Legs.push({
      DepartureAirportCity: destinationCode,  // ✅ Código IATA
      ArrivalAirportCity: originCode,         // ✅ Código IATA
      FlightDate: flights.returnDate
    });
  }

  // Add airline filter if specified
  if (flights.preferredAirline) {
    starlingRequest.Airlines = [flights.preferredAirline];
  }

  console.log('[FLIGHT_SEARCH] Starling request:', JSON.stringify(starlingRequest, null, 2));

  console.log('[FLIGHT_SEARCH] Calling starling-flights Edge Function');

  // Call starling-flights Edge Function with timeout
  let response;
  try {
    response = await invokeWithTimeout(supabase, 'starling-flights', {
      action: 'searchFlights',
      data: starlingRequest
    });
  } catch (error: any) {
    console.error('[FLIGHT_SEARCH] Starling API error:', error);
    return {
      status: 'error',
      type: 'flights',
      error: {
        message: error.message || 'Flight search failed',
        details: error
      }
    };
  }

  // ============================================================================
  // PARSE STARLING TVC RESPONSE
  // ============================================================================
  // Response structure from starling-flights Edge Function:
  // {
  //   success: true,
  //   data: {
  //     Fares: [...],           // ← Array of flight fares
  //     TransactionID: "...",
  //     BaseCurrency: "USD",
  //     Recommendations: [...]  // Alternative format (some API versions)
  //   },
  //   provider: "TVC"
  // }
  // ============================================================================

  const tvcResponse = (response as any).data || response;

  // Extract fares from TVC response (Fares or Recommendations depending on API version)
  const rawFares = tvcResponse?.Fares || tvcResponse?.Recommendations || [];

  console.log('[FLIGHT_SEARCH] TVC Response received:', {
    success: (response as any).success,
    hasFares: !!tvcResponse?.Fares,
    hasRecommendations: !!tvcResponse?.Recommendations,
    faresCount: rawFares.length,
    transactionId: tvcResponse?.TransactionID
  });

  if (!rawFares || rawFares.length === 0) {
    console.log('[FLIGHT_SEARCH] No fares found in TVC response');
    return {
      status: 'completed',
      type: 'flights',
      flights: {
        count: 0,
        items: []
      }
    };
  }

  // ✅ Transform TVC fares using the new transformer with extended features
  const transformOptions: TransformOptions = {
    adults: flights.adults || 1,
    children: flights.children || 0,
    infants: flights.infants || 0,
    baseCurrency: tvcResponse?.BaseCurrency || 'USD'
  };

  let flights_results = rawFares.map((fare: any, index: number) =>
    transformFare(fare, index, tvcResponse, transformOptions)
  );

  console.log('[FLIGHT_SEARCH] Transformed', flights_results.length, 'flights from TVC with extended features');

  // Track baggage types found for metadata
  const baggageTypesFound = new Set<string>();
  flights_results.forEach((flight: any) => {
    if (flight.baggage?.type) {
      baggageTypesFound.add(flight.baggage.type);
    }
  });

  // ✅ CRITICAL FIX: Filter by maxLayoverHours if specified (mirrors chat internal logic)
  // This ensures API searches respect layover duration constraints just like internal chat
  let excludedByLayover = 0;

  if (flights.maxLayoverHours) {
    const maxLayover = flights.maxLayoverHours;
    console.log(`⏰ [LAYOVER FILTER] Filtering for layovers <= ${maxLayover} hours`);

    const beforeLayoverFilter = flights_results.length;

    flights_results = flights_results.filter((flight: any) => {
      // Check EACH leg individually
      for (const leg of flight.legs || []) {
        for (const option of leg.options || []) {
          const segments = option.segments || [];

          // Direct flights (1 segment) are always OK
          if (segments.length <= 1) continue;

          // Check layover times between consecutive segments
          for (let i = 0; i < segments.length - 1; i++) {
            const current = segments[i];
            const next = segments[i + 1];
            const layoverHours = calculateLayoverHours(current, next);

            // Reject flight if ANY layover exceeds maximum
            if (layoverHours > maxLayover) {
              console.log(`❌ [LAYOVER FILTER] Excluding flight ${flight.id}: layover ${layoverHours.toFixed(1)}h > max ${maxLayover}h`);
              excludedByLayover++;
              return false;
            }
          }
        }
      }

      return true;  // Keep this flight
    });

    console.log(`📊 [LAYOVER FILTER] Flights: ${beforeLayoverFilter} → ${flights_results.length} (excluded: ${excludedByLayover} flights with layovers > ${maxLayover}h)`);
  }

  // ✅ STEP 1: Apply light fare filtering (if user requested carry_on)
  let lightFaresExcluded = 0;
  const userRequestedCarryOn = flights.luggage === 'carry_on';

  if (userRequestedCarryOn) {
    console.log('🧳 [LIGHT FARE FILTER] User requested carry_on, filtering light fares');

    const beforeFilter = flights_results.length;

    flights_results = flights_results.filter((flight: any) => {
      // Extract airline code from flight data
      const airlineCode = flight.airline?.code || flight.airlineCode;

      if (shouldExcludeLightFare(airlineCode, flights.luggage)) {
        console.log(`🚫 [LIGHT FARE] Excluded flight from ${airlineCode} (light fare airline)`);
        lightFaresExcluded++;
        return false;
      }

      return true;
    });

    console.log(`📊 [LIGHT FARE FILTER] Flights: ${beforeFilter} → ${flights_results.length} (excluded: ${lightFaresExcluded})`);
  }

  // ✅ STEP 2: Apply time preference filtering (if specified)
  let timeFilterExcluded = 0;
  const timePreference = flights.timePreference || flights.departureTimePreference;

  if (timePreference) {
    console.log(`🕐 [TIME FILTER] Applying time preference: ${timePreference}`);
    const { flights: timeFiltered, excludedCount } = filterFlightsByTimePreference(flights_results, timePreference);
    timeFilterExcluded = excludedCount;
    flights_results = timeFiltered;
  }

  // ✅ STEP 3: Apply enhanced luggage filtering using per-leg analysis
  let luggageFilterExcluded = 0;

  if (flights.luggage && flights.luggage !== 'any') {
    console.log(`🧳 [LUGGAGE FILTER] Filtering by luggage preference: ${flights.luggage}`);
    const beforeLuggage = flights_results.length;

    flights_results = flights_results.filter((flight: any) => {
      const baggageAnalysis = flight.baggageAnalysis || [];

      // If no baggage analysis, fall back to basic check
      if (baggageAnalysis.length === 0) {
        console.log(`   ⚠️ Flight ${flight.id}: No baggageAnalysis, using basic check`);
        const hasChecked = flight.baggage?.included || false;
        const hasCarryOn = parseInt(flight.baggage?.carryOnQuantity || '0') > 0;

        switch (flights.luggage) {
          case 'checked': return hasChecked;
          case 'carry_on': return hasCarryOn || (!hasChecked && !hasCarryOn);
          case 'both': return hasChecked && hasCarryOn;
          case 'none': return !hasChecked && !hasCarryOn;
          default: return true;
        }
      }

      const matches = matchesLuggagePreference(baggageAnalysis, flights.luggage);
      if (!matches) {
        console.log(`   ❌ Flight ${flight.id}: Does not match ${flights.luggage} preference`);
        luggageFilterExcluded++;
      }
      return matches;
    });

    console.log(`📊 [LUGGAGE FILTER] Flights: ${beforeLuggage} → ${flights_results.length} (excluded: ${luggageFilterExcluded})`);
  }

  // ✅ STEP 4: Sort by price and limit to top 5
  flights_results.sort((a: any, b: any) => (a.price.amount || 0) - (b.price.amount || 0));
  const finalFlights = flights_results.slice(0, 5);

  console.log('[FLIGHT_SEARCH] Final result:', finalFlights.length, 'flights');

  // ✅ STEP 5: Build extended metadata with new features
  const metadata: any = {};

  // Add layover filter metadata if applied
  if (flights.maxLayoverHours) {
    metadata.layover_filter_applied = {
      max_hours: flights.maxLayoverHours,
      excluded_count: excludedByLayover
    };
  }

  // Add light fare filter metadata if applied
  if (userRequestedCarryOn) {
    metadata.light_fares_excluded = lightFaresExcluded;
    metadata.light_fare_airlines = getLightFareAirlines();
  }

  // NEW: Add time preference filter metadata
  if (timePreference) {
    const range = timePreferenceToRange(timePreference);
    metadata.time_filter_applied = {
      preference: timePreference,
      range: range,
      label: timeRangeToLabel(range),
      excluded_count: timeFilterExcluded
    };
  }

  // NEW: Add luggage filter metadata
  if (flights.luggage && flights.luggage !== 'any') {
    metadata.luggage_filter_applied = {
      preference: flights.luggage,
      excluded_count: luggageFilterExcluded
    };
  }

  // NEW: Add baggage analysis summary
  if (baggageTypesFound.size > 0) {
    metadata.baggage_analysis = {
      types_found: Array.from(baggageTypesFound)
    };
  }

  // NEW: Generate searchId for full results reference
  const searchId = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    status: 'completed',
    type: 'flights',
    flights: {
      count: finalFlights.length,
      items: finalFlights,
      // NEW: Search reference for full results
      searchId: searchId,
      fullResultsAvailable: flights_results.length > 5,
      totalResults: flights_results.length
    },
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined
  };
}

// =============================================================================
// HOTEL SEARCH
// =============================================================================

async function executeHotelSearch(
  parsedRequest: ParsedRequest,
  supabase: ReturnType<typeof createClient>
): Promise<SearchResults> {
  console.log('[HOTEL_SEARCH] Starting hotel search');

  if (!parsedRequest.hotels) {
    throw new Error('No hotel data in parsed request');
  }

  const { hotels } = parsedRequest;

  // ✅ STEP 0: Infer adults from roomType if not specified
  const inferredAdults = inferAdultsFromRoomType(
    hotels.adults,
    hotels.roomType
  );

  console.log(`📊 [HOTEL_SEARCH] Adults: ${inferredAdults} (roomType: ${hotels.roomType || 'not specified'})`);

  // ✅ STEP 1: Resolve city name to EUROVIPS city code
  console.log(`🔍 [HOTEL_SEARCH] Resolving city code for: "${hotels.city}"`);
  const cityCode = resolveHotelCode(hotels.city);
  console.log(`✅ [HOTEL_SEARCH] City code resolved: "${hotels.city}" → ${cityCode}`);

  // ✅ MULTI-CHAIN HOTEL SEARCH STRATEGY:
  // - If hotelChains array has multiple chains → Make N parallel requests + dedupe + interleave
  // - If hotelChains has 1 chain → Single request with that chain
  // - If only hotelName → Single request with that name
  // - If nothing → Single request without filter
  const hotelChains = hotels.hotelChains || [];
  const hotelName = hotels.hotelName || '';

  // Base params for all requests
  const baseParams = {
    cityCode: cityCode,
    checkinDate: hotels.checkinDate,
    checkoutDate: hotels.checkoutDate,
    adults: inferredAdults,
    children: hotels.children || 0,
    infants: hotels.infants || 0
  };

  let allHotels: any[] = [];
  let totalFromProvider = 0;

  try {
    if (hotelChains.length > 1) {
      // ✅ MULTI-CHAIN: Make N parallel requests (1 per chain)
      console.log(`🏨 [MULTI-CHAIN] Making ${hotelChains.length} parallel API requests for chains:`, hotelChains);

      const chainResults = await Promise.all(
        hotelChains.map(async (chain: string) => {
          console.log(`📤 [MULTI-CHAIN] Requesting hotels for chain: "${chain}"`);
          try {
            const result = await invokeWithTimeout(supabase, 'eurovips-soap', {
              action: 'searchHotels',
              data: { ...baseParams, hotelName: chain }
            });
            const hotels = (result as any)?.results || [];
            console.log(`✅ [MULTI-CHAIN] Chain "${chain}": received ${hotels.length} hotels`);
            return { chain, hotels };
          } catch (error) {
            console.error(`❌ [MULTI-CHAIN] Chain "${chain}" failed:`, error);
            return { chain, hotels: [] };
          }
        })
      );

      // Flatten all results
      for (const { hotels: chainHotels } of chainResults) {
        totalFromProvider += chainHotels.length;
        allHotels.push(...chainHotels);
      }

      console.log(`🔗 [MULTI-CHAIN] Total hotels before deduplication: ${allHotels.length}`);

      // Deduplicate by hotel_id or name
      const seen = new Set<string>();
      allHotels = allHotels.filter(hotel => {
        const key = hotel.hotel_id || hotel.name?.toLowerCase().trim();
        if (!key || seen.has(key)) {
          if (key) console.log(`🗑️ [DEDUP] Removed duplicate: "${hotel.name}"`);
          return false;
        }
        seen.add(key);
        return true;
      });

      console.log(`✅ [MULTI-CHAIN] After deduplication: ${allHotels.length} hotels`);

      // Interleave results round-robin if multiple chains
      allHotels = interleaveHotelsByChain(allHotels, hotelChains);

    } else {
      // ✅ SINGLE REQUEST: Use first chain, hotelName, or no filter
      const nameFilter = hotelChains[0] || hotelName || '';

      if (nameFilter) {
        console.log(`🏨 [HOTEL_SEARCH] Applying name filter to EUROVIPS: "${nameFilter}"`);
      } else {
        console.log('🏨 [HOTEL_SEARCH] No chain or name filter - searching all hotels');
      }

      console.log(`📤 [HOTEL_SEARCH] Calling eurovips-soap Edge Function`);
      console.log(`   → cityCode: ${cityCode}, dates: ${hotels.checkinDate} to ${hotels.checkoutDate}, adults: ${inferredAdults}`);

      const response = await invokeWithTimeout(supabase, 'eurovips-soap', {
        action: 'searchHotels',
        data: { ...baseParams, hotelName: nameFilter }
      });

      allHotels = (response as any)?.results || [];
      totalFromProvider = allHotels.length;

      console.log('[HOTEL_SEARCH] Found', totalFromProvider, 'hotels from provider');
    }
  } catch (error: any) {
    console.error('[HOTEL_SEARCH] EUROVIPS API error:', error);
    return {
      status: 'error',
      type: 'hotels',
      error: {
        message: error.message || 'Hotel search failed',
        details: error
      }
    };
  }

  console.log('[HOTEL_SEARCH] Found', totalFromProvider, 'hotels from provider');

  // ✅ STEP 1: Apply destination-specific filters (e.g., Punta Cana whitelist)
  // Pass first chain if available (for whitelist bypass logic)
  allHotels = applyDestinationWhitelist(
    allHotels,
    hotels.city || '',
    hotelChains[0] || hotelName // Pass first chain or hotelName for whitelist bypass
  );
  const afterWhitelist = allHotels.length;

  // ✅ STEP 2: Apply room-level filtering (if roomType or mealPlan specified)
  const { hotels: filteredHotels, excludedCount } = applyRoomFiltering(
    allHotels,
    hotels.roomType,
    hotels.mealPlan
  );

  // ✅ STEP 3: Sort by price and limit to top 5
  const sortedHotels = filteredHotels
    .sort((a: any, b: any) => {
      const minPriceA = Math.min(...a.rooms.map((r: any) => r.total_price));
      const minPriceB = Math.min(...b.rooms.map((r: any) => r.total_price));
      return minPriceA - minPriceB;
    })
    .slice(0, 5);

  console.log('[HOTEL_SEARCH] Final result:', sortedHotels.length, 'hotels');

  // ✅ STEP 4: Build extended metadata
  const isPuntaCana = hotels.city?.toLowerCase().includes('punta') &&
    hotels.city?.toLowerCase().includes('cana');

  const metadata: any = {};

  // Destination rules metadata
  if (isPuntaCana) {
    metadata.destination_rules = {
      type: 'quality_whitelist',
      destination: hotels.city,
      total_available_from_provider: totalFromProvider,
      whitelist_matches: afterWhitelist,
      after_all_filters: filteredHotels.length,
      reason: 'Destino con lista curada de hoteles verificados'
    };
  }

  // Room exclusions metadata
  if (excludedCount > 0) {
    metadata.hotels_excluded_no_matching_rooms = excludedCount;
  }

  // Room filters applied
  if (hotels.roomType || hotels.mealPlan) {
    metadata.room_filters_applied = {
      ...(hotels.roomType && { capacity: hotels.roomType }),
      ...(hotels.mealPlan && { meal_plan: hotels.mealPlan })
    };
  }

  // Chain/Name filter applied
  if (hotelChains.length > 0 || hotelName) {
    metadata.chain_filter_applied = {
      chains: hotelChains.length > 0 ? hotelChains : undefined,
      hotel_name: hotelName || undefined,
      multi_chain_search: hotelChains.length > 1,
      applied_to: 'EUROVIPS <name> field'
    };
  }

  // NEW: Generate searchId for full results reference
  const searchId = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    status: 'completed',
    type: 'hotels',
    hotels: {
      count: sortedHotels.length,
      items: sortedHotels,
      // NEW: Search reference for full results
      searchId: searchId,
      fullResultsAvailable: filteredHotels.length > 5,
      totalResults: filteredHotels.length
    },
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined
  };
}

// =============================================================================
// COMBINED SEARCH (Flight + Hotel)
// =============================================================================

async function executeCombinedSearch(
  parsedRequest: ParsedRequest,
  supabase: ReturnType<typeof createClient>
): Promise<SearchResults> {
  console.log('[COMBINED_SEARCH] Starting combined search');

  // ✅ STEP 0: Infer adults from roomType for BOTH flights and hotels
  const inferredAdults = inferAdultsFromRoomType(
    parsedRequest.hotels?.adults || parsedRequest.flights?.adults,
    parsedRequest.hotels?.roomType
  );

  console.log(`📊 [COMBINED_SEARCH] Using adults: ${inferredAdults} for both searches`);

  // Enrich parsedRequest with inferred adults
  const enrichedRequest: ParsedRequest = {
    ...parsedRequest,
    flights: parsedRequest.flights ? {
      ...parsedRequest.flights,
      adults: inferredAdults
    } : undefined,
    hotels: parsedRequest.hotels ? {
      ...parsedRequest.hotels,
      adults: inferredAdults
    } : undefined
  };

  // Execute both searches in parallel with enriched request
  const [flightResult, hotelResult] = await Promise.all([
    executeFlightSearch(enrichedRequest, supabase),
    executeHotelSearch(enrichedRequest, supabase)
  ]);

  console.log('[COMBINED_SEARCH] Both searches completed');
  console.log('[COMBINED_SEARCH] Flight status:', flightResult.status);
  console.log('[COMBINED_SEARCH] Hotel status:', hotelResult.status);

  // ✅ Handle errors in individual searches
  // If flight search failed, include empty results instead of undefined
  const flightData = flightResult.status === 'error'
    ? { count: 0, items: [], error: flightResult.error }
    : flightResult.flights;

  const hotelData = hotelResult.status === 'error'
    ? { count: 0, items: [], error: hotelResult.error }
    : hotelResult.hotels;

  // ✅ Merge metadata from both searches
  const flightMetadata = flightResult.metadata || {};
  const hotelMetadata = hotelResult.metadata || {};
  const combinedMetadata = {
    ...flightMetadata,
    ...hotelMetadata
  };

  // Determine overall status: completed only if both succeeded
  const overallStatus = flightResult.status === 'error' || hotelResult.status === 'error'
    ? 'incomplete'
    : 'completed';

  return {
    status: overallStatus,
    type: 'combined',
    flights: flightData,
    hotels: hotelData,
    metadata: Object.keys(combinedMetadata).length > 0 ? combinedMetadata : undefined
  };
}

// =============================================================================
// PACKAGE SEARCH
// =============================================================================

async function executePackageSearch(
  parsedRequest: ParsedRequest,
  supabase: ReturnType<typeof createClient>
): Promise<SearchResults> {
  console.log('[PACKAGE_SEARCH] Starting package search');

  if (!parsedRequest.packages) {
    throw new Error('No package data in parsed request');
  }

  const { packages } = parsedRequest;

  let response;
  try {
    response = await invokeWithTimeout(supabase, 'eurovips-soap', {
      action: 'searchPackages',
      data: {
        cityCode: packages.destination,
        dateFrom: packages.dateFrom,
        dateTo: packages.dateTo,
        packageClass: packages.packageClass
      }
    });
  } catch (error: any) {
    console.error('[PACKAGE_SEARCH] EUROVIPS API error:', error);
    return {
      status: 'error',
      type: 'packages',
      error: {
        message: error.message || 'Package search failed',
        details: error
      }
    };
  }

  const packageData = (response as any)?.results || [];

  return {
    status: 'completed',
    type: 'packages',
    packages: {
      count: packageData.length,
      items: packageData.slice(0, 5)
    }
  };
}

// =============================================================================
// SERVICE SEARCH
// =============================================================================

async function executeServiceSearch(
  parsedRequest: ParsedRequest,
  supabase: ReturnType<typeof createClient>
): Promise<SearchResults> {
  console.log('[SERVICE_SEARCH] Starting service search');

  if (!parsedRequest.services) {
    throw new Error('No service data in parsed request');
  }

  const { services } = parsedRequest;

  let response;
  try {
    response = await invokeWithTimeout(supabase, 'eurovips-soap', {
      action: 'searchServices',
      data: {
        cityCode: services.city,
        dateFrom: services.dateFrom,
        dateTo: services.dateTo,
        serviceType: services.serviceType
      }
    });
  } catch (error: any) {
    console.error('[SERVICE_SEARCH] EUROVIPS API error:', error);
    return {
      status: 'error',
      type: 'services',
      error: {
        message: error.message || 'Service search failed',
        details: error
      }
    };
  }

  const serviceData = (response as any)?.results || [];

  return {
    status: 'completed',
    type: 'services',
    services: {
      count: serviceData.length,
      items: serviceData.slice(0, 5)
    }
  };
}

// =============================================================================
// ITINERARY SEARCH
// =============================================================================

async function executeItinerarySearch(
  parsedRequest: ParsedRequest,
  supabase: ReturnType<typeof createClient>
): Promise<SearchResults> {
  console.log('[ITINERARY_SEARCH] Starting itinerary generation');

  if (!parsedRequest.itinerary) {
    throw new Error('No itinerary data in parsed request');
  }

  const { itinerary } = parsedRequest;

  let response;
  try {
    response = await invokeWithTimeout(supabase, 'travel-itinerary', {
      destinations: itinerary.destinations,
      days: itinerary.days
    });
  } catch (error: any) {
    console.error('[ITINERARY_SEARCH] Edge Function error:', error);
    return {
      status: 'error',
      type: 'itinerary',
      error: {
        message: error.message || 'Itinerary generation failed',
        details: error
      }
    };
  }

  const itineraryData = (response as any)?.data;

  return {
    status: 'completed',
    type: 'itinerary',
    itinerary: itineraryData
  };
}
