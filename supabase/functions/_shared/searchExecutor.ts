/**
 * Search Executor for API Search Edge Function
 *
 * Executes searches by calling underlying Edge Functions (starling-flights, eurovips-soap)
 * Replicates the logic from src/features/chat/services/searchHandlers.ts
 * but adapted for Edge Function environment.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import type { ParsedRequest, SearchResults } from './contextManagement.ts';
import {
  applyDestinationWhitelist,
  applyRoomFiltering,
  inferAdultsFromRoomType,
  shouldExcludeLightFare,
  getLightFareAirlines
} from './advancedFilters.ts';
import { resolveFlightCodes, resolveHotelCode } from './cityCodeResolver.ts';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const PROVIDER_TIMEOUT_MS = 15000; // 15 seconds

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
      body,
      // @ts-ignore - Deno supports signal in fetch
      signal: controller.signal,
    });

    const latency = Date.now() - startTime;

    if (response.error) {
      console.error(`[INVOKE_TIMEOUT] ❌ ${functionName} error (${latency}ms):`, response.error);
      throw new Error(response.error.message);
    }

    console.log(`[INVOKE_TIMEOUT] ✅ ${functionName} completed (${latency}ms)`);
    return response.data as T;
  } catch (error) {
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

  // Add adults
  if ((flights.adults || 1) > 0) {
    passengers.push({
      Count: flights.adults || 1,
      Type: 'ADT'
    });
  }

  // Add children if present
  if (flights.children && flights.children > 0) {
    passengers.push({
      Count: flights.children,
      Type: 'CHD'
    });
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
  } catch (error) {
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

  const tvcResponse = response.data || response;

  // Extract fares from TVC response (Fares or Recommendations depending on API version)
  const rawFares = tvcResponse?.Fares || tvcResponse?.Recommendations || [];

  console.log('[FLIGHT_SEARCH] TVC Response received:', {
    success: response.success,
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

  // Transform TVC fares to our standard flight format
  let flights_results = rawFares.map((fare: any, index: number) => {
    const legs = fare.Legs || [];
    const firstLeg = legs[0] || {};
    const firstOption = firstLeg.Options?.[0] || {};
    const firstSegment = firstOption.Segments?.[0] || {};
    const lastSegment = firstOption.Segments?.[firstOption.Segments?.length - 1] || firstSegment;

    // Get return date if round trip
    let returnDate = null;
    if (legs.length > 1) {
      const secondLeg = legs[1];
      const secondOption = secondLeg.Options?.[0] || {};
      const secondSegment = secondOption.Segments?.[0] || {};
      returnDate = secondSegment.Departure?.Date || null;
    }

    // Calculate stops
    const totalSegments = legs.reduce((sum: number, leg: any) => {
      const options = leg.Options || [];
      const maxSegments = Math.max(...options.map((opt: any) => (opt.Segments?.length || 0)));
      return sum + maxSegments;
    }, 0);
    const stopCount = Math.max(0, totalSegments - legs.length);
    const isDirect = stopCount === 0;

    // Parse baggage info
    const baggageInfo = firstSegment.Baggage || '';
    const baggageMatch = baggageInfo.match(/(\d+)PC|(\d+)KG/);
    const baggageQuantity = baggageMatch ? parseInt(baggageMatch[1] || baggageMatch[2]) : 0;

    return {
      id: fare.FareID || `tvc-fare-${index}`,
      airline: {
        code: firstSegment.Airline || 'N/A',
        name: firstSegment.OperatingAirlineName || firstSegment.Airline || 'Unknown'
      },
      price: {
        amount: fare.TotalAmount || 0,
        currency: fare.Currency || tvcResponse?.BaseCurrency || 'USD',
        netAmount: fare.ExtendedFareInfo?.NetTotalAmount || fare.TotalAmount || 0,
        taxAmount: fare.TaxAmount || 0,
        fareAmount: fare.FareAmount || 0
      },
      adults: flights.adults || 1,
      children: flights.children || 0,
      departure_date: firstSegment.Departure?.Date || flights.departureDate,
      departure_time: firstSegment.Departure?.Time || '',
      arrival_date: lastSegment.Arrival?.Date || '',
      arrival_time: lastSegment.Arrival?.Time || '',
      return_date: returnDate,
      duration: {
        total: firstOption.OptionDuration || 0,
        formatted: formatDuration(firstOption.OptionDuration || 0)
      },
      stops: {
        count: stopCount,
        direct: isDirect,
        connections: stopCount
      },
      baggage: {
        included: baggageQuantity > 0,
        details: baggageInfo,
        quantity: baggageQuantity
      },
      cabin: {
        class: firstSegment.CabinClass || 'Y',
        brandName: firstSegment.BrandName || 'Economy'
      },
      booking: {
        validatingCarrier: fare.ValidatingCarrier || '',
        lastTicketingDate: fare.LastTicketingDate || '',
        fareType: fare.FareType || ''
      },
      legs: legs.map((leg: any, legIndex: number) => ({
        legNumber: leg.LegNumber || legIndex + 1,
        options: (leg.Options || []).map((option: any) => ({
          optionId: option.FlightOptionID || '',
          duration: option.OptionDuration || 0,
          segments: (option.Segments || []).map((segment: any) => ({
            airline: segment.Airline || '',
            flightNumber: segment.FlightNumber || '',
            departure: {
              airportCode: segment.Departure?.AirportCode || '',
              date: segment.Departure?.Date || '',
              time: segment.Departure?.Time || ''
            },
            arrival: {
              airportCode: segment.Arrival?.AirportCode || '',
              date: segment.Arrival?.Date || '',
              time: segment.Arrival?.Time || ''
            },
            duration: segment.Duration || 0,
            cabinClass: segment.CabinClass || '',
            baggage: segment.Baggage || ''
          }))
        }))
      })),
      provider: 'TVC',
      transactionId: tvcResponse?.TransactionID || ''
    };
  });

  console.log('[FLIGHT_SEARCH] Transformed', flights_results.length, 'flights from TVC');

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

  // ✅ STEP 2: Limit to top 5
  const finalFlights = flights_results.slice(0, 5);

  console.log('[FLIGHT_SEARCH] Final result:', finalFlights.length, 'flights');

  // ✅ STEP 3: Build extended metadata
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

  return {
    status: 'completed',
    type: 'flights',
    flights: {
      count: finalFlights.length,
      items: finalFlights
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

  // ✅ REGLA DE NEGOCIO (confirmada con Ruth/SOFTUR):
  // El campo <name> de EUROVIPS es el ÚNICO campo correcto para filtrar por:
  // - Cadena hotelera (Iberostar, Riu, Melia, etc.)
  // - Texto parcial del nombre del hotel (Ocean, Palace, etc.)
  // Prioridad: hotelChain > hotelName (hotelChain es más específico para búsquedas de cadena)
  const nameFilter = hotels.hotelChain || hotels.hotelName || '';

  if (nameFilter) {
    console.log(`🏨 [HOTEL_SEARCH] Applying name filter to EUROVIPS: "${nameFilter}"`);
  }

  // ✅ STEP 1: Resolve city name to EUROVIPS city code
  console.log(`🔍 [HOTEL_SEARCH] Resolving city code for: "${hotels.city}"`);
  const cityCode = resolveHotelCode(hotels.city);
  console.log(`✅ [HOTEL_SEARCH] City code resolved: "${hotels.city}" → ${cityCode}`);

  // Build EUROVIPS API request
  const eurovipsRequest = {
    action: 'searchHotels',
    data: {
      cityCode: cityCode, // ✅ Código resuelto (ej: "PUJ", no "Punta Cana")
      checkinDate: hotels.checkinDate,
      checkoutDate: hotels.checkoutDate,
      adults: inferredAdults,
      children: hotels.children || 0,
      hotelName: nameFilter // ✅ Filtro por <name> en EUROVIPS (cadena o nombre parcial)
    }
  };

  console.log('[HOTEL_SEARCH] Calling eurovips-soap Edge Function', nameFilter ? `with name filter: "${nameFilter}"` : 'without name filter');
  console.log(`   → cityCode: ${cityCode}, dates: ${hotels.checkinDate} to ${hotels.checkoutDate}, adults: ${inferredAdults}`);

  // Call eurovips-soap Edge Function with timeout
  let response;
  try {
    response = await invokeWithTimeout(supabase, 'eurovips-soap', eurovipsRequest);
  } catch (error) {
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

  let allHotels = response?.results || [];
  const totalFromProvider = allHotels.length;

  console.log('[HOTEL_SEARCH] Found', totalFromProvider, 'hotels from provider');

  // ✅ STEP 1: Apply destination-specific filters (e.g., Punta Cana whitelist)
  const beforeWhitelist = allHotels.length;
  allHotels = applyDestinationWhitelist(
    allHotels,
    hotels.city || '',
    hotels.hotelChain
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

  // Name filter applied (chain or hotel name)
  if (nameFilter) {
    metadata.name_filter_applied = {
      filter_value: nameFilter,
      filter_source: hotels.hotelChain ? 'hotelChain' : 'hotelName',
      applied_to: 'EUROVIPS <name> field'
    };
  }

  return {
    status: 'completed',
    type: 'hotels',
    hotels: {
      count: sortedHotels.length,
      items: sortedHotels
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

  // ✅ Merge metadata from both searches
  const flightMetadata = flightResult.metadata || {};
  const hotelMetadata = hotelResult.metadata || {};
  const combinedMetadata = {
    ...flightMetadata,
    ...hotelMetadata
  };

  return {
    status: 'completed',
    type: 'combined',
    flights: flightResult.flights,
    hotels: hotelResult.hotels,
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
  } catch (error) {
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

  const packageData = response?.results || [];

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
  } catch (error) {
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

  const serviceData = response?.results || [];

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
  } catch (error) {
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

  const itineraryData = response?.data;

  return {
    status: 'completed',
    type: 'itinerary',
    itinerary: itineraryData
  };
}
