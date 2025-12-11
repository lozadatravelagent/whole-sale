import { supabase } from '@/integrations/supabase/client';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import { formatForStarling, formatForEurovips } from '@/services/aiMessageParser';
import type { SearchResult, LocalHotelData, LocalPackageData, LocalServiceData } from '../types/chat';
import { transformStarlingResults } from './flightTransformer';
import { formatFlightResponse, formatHotelResponse, formatPackageResponse, formatServiceResponse, formatCombinedResponse, formatItineraryResponse } from './responseFormatters';
import { getCityCode } from '@/services/cityCodeMapping';
import { airlineResolver } from './airlineResolver';
import { filterRooms, normalizeCapacity, normalizeMealPlan } from '@/utils/roomFilters';
import { hotelBelongsToChain, hotelNameMatches } from '../data/hotelChainAliases';

// =====================================================================
// PUNTA CANA HOTEL WHITELIST - SPECIAL FILTER
// =====================================================================

/**
 * Palabras clave para detectar hoteles permitidos en Punta Cana.
 * Cada array interno representa un hotel; el hotel debe contener TODAS las palabras del array.
 * Ejemplo: ["riu", "bambu"] matchea "RIU BAMBU HOTEL" pero NO "RIU PALACE".
 */
const PUNTA_CANA_ALLOWED_HOTELS = [
  ['riu', 'bambu'],
  ['iberostar', 'dominicana'],
  ['bahia', 'principe', 'grand', 'punta', 'cana'],
  ['sunscape', 'coco'],
  ['riu', 'republica']
];

/**
 * Normaliza texto eliminando acentos y convirtiendo a minúsculas.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Verifica si el destino corresponde a Punta Cana.
 */
function isPuntaCanaDestination(city: string): boolean {
  const normalized = normalizeText(city);
  return normalized.includes('punta') && normalized.includes('cana');
}

/**
 * Verifica si el nombre del hotel está en la whitelist de Punta Cana.
 * Usa coincidencias parciales: el hotel debe contener TODAS las palabras clave de al menos un grupo.
 */
function isAllowedPuntaCanaHotel(hotelName: string): boolean {
  const normalizedName = normalizeText(hotelName);

  return PUNTA_CANA_ALLOWED_HOTELS.some(keywords =>
    keywords.every(keyword => normalizedName.includes(keyword))
  );
}

/**
 * Filtra hoteles aplicando reglas especiales por destino.
 * Actualmente solo aplica whitelist para Punta Cana.
 * 
 * IMPORTANTE: Si el usuario especificó una cadena hotelera (hotelChain),
 * los hoteles de esa cadena son SIEMPRE permitidos, aunque no estén en el whitelist.
 * Esto permite que "cadena iberostar" devuelva todos los Iberostar, no solo "Iberostar Dominicana".
 * 
 * @param hotels - Lista de hoteles a filtrar
 * @param city - Ciudad/destino de la búsqueda
 * @param requestedChain - Cadena hotelera solicitada por el usuario (opcional)
 */
function applyDestinationSpecificFilters(
  hotels: LocalHotelData[],
  city: string,
  requestedChain?: string
): LocalHotelData[] {
  // Solo aplicar filtro especial para Punta Cana
  if (!isPuntaCanaDestination(city)) {
    return hotels;
  }

  console.log('🌴 [PUNTA CANA FILTER] Applying special hotel whitelist filter');
  console.log(`📊 [PUNTA CANA FILTER] Hotels before filter: ${hotels.length}`);

  if (requestedChain) {
    console.log(`🏨 [PUNTA CANA FILTER] User requested chain: "${requestedChain}" - will allow all hotels from this chain`);
  }

  const filteredHotels = hotels.filter(hotel => {
    // FIRST: If user requested a specific chain, allow ALL hotels from that chain
    if (requestedChain) {
      const normalizedHotelName = normalizeText(hotel.name);
      const normalizedChain = normalizeText(requestedChain);

      if (normalizedHotelName.includes(normalizedChain)) {
        console.log(`✅ [PUNTA CANA FILTER] Allowed (matches requested chain "${requestedChain}"): "${hotel.name}"`);
        return true;
      }
    }

    // SECOND: Check against the whitelist for non-chain-specific requests
    const isAllowed = isAllowedPuntaCanaHotel(hotel.name);
    if (!isAllowed) {
      console.log(`🚫 [PUNTA CANA FILTER] Excluded: "${hotel.name}"`);
    } else {
      console.log(`✅ [PUNTA CANA FILTER] Allowed (in whitelist): "${hotel.name}"`);
    }
    return isAllowed;
  });

  console.log(`📊 [PUNTA CANA FILTER] Hotels after filter: ${filteredHotels.length}`);
  return filteredHotels;
}

// Helper function to calculate layover hours between two flight segments
function calculateLayoverHours(arrivalSegment: any, departureSegment: any): number {
  try {
    // Parse arrival time and date (support both lowercase and uppercase API responses)
    const arrivalTime = arrivalSegment.arrival?.time || arrivalSegment.Arrival?.Time || '';
    const arrivalDate = arrivalSegment.arrival?.date || arrivalSegment.Arrival?.Date || '';

    // Parse departure time and date (support both lowercase and uppercase API responses)
    const departureTime = departureSegment.departure?.time || departureSegment.Departure?.Time || '';
    const departureDate = departureSegment.departure?.date || departureSegment.Departure?.Date || '';

    if (!arrivalTime || !arrivalDate || !departureTime || !departureDate) {
      console.warn('⚠️ [LAYOVER CALC] Missing time/date data for layover calculation');
      return 0;
    }

    // Create Date objects
    const arrivalDateTime = new Date(`${arrivalDate}T${arrivalTime}:00`);
    const departureDateTime = new Date(`${departureDate}T${departureTime}:00`);

    // Calculate difference in milliseconds, then convert to hours
    const layoverMs = departureDateTime.getTime() - arrivalDateTime.getTime();
    const layoverHours = layoverMs / (1000 * 60 * 60);

    console.log(`🕐 [LAYOVER CALC] ${arrivalSegment.arrival?.airportCode || arrivalSegment.Arrival?.AirportCode} ${arrivalTime} → ${departureSegment.departure?.airportCode || departureSegment.Departure?.AirportCode} ${departureTime} = ${layoverHours.toFixed(1)}h`);

    return layoverHours;
  } catch (error) {
    console.error('❌ [LAYOVER CALC] Error calculating layover:', error);
    return 0;
  }
}

// Handler functions WITHOUT N8N
export const handleFlightSearch = async (parsed: ParsedTravelRequest): Promise<SearchResult> => {
  console.log('✈️ [FLIGHT SEARCH] Starting flight search process');
  console.log('📋 Parsed request:', parsed);

  try {
    console.log('🔄 [FLIGHT SEARCH] Step 1: Formatting parameters for Starling API');
    const starlingParams = await formatForStarling(parsed);
    console.log('📊 Starling parameters:', starlingParams);

    // ✈️ PRE-FILTER: Add airline filter to STARLING request if user specified preferredAirline
    if (parsed?.flights?.preferredAirline) {
      console.log(`✈️ [PRE-FILTER] Resolving preferred airline: ${parsed.flights.preferredAirline}`);

      try {
        const resolvedAirline = await airlineResolver.resolveAirline(parsed.flights.preferredAirline);
        const airlineCode = resolvedAirline.code;

        // Add Airlines filter to STARLING API request
        (starlingParams as any).Airlines = [airlineCode];

        console.log(`✅ [PRE-FILTER] Added airline filter to STARLING: ${airlineCode} (${resolvedAirline.name})`);
        console.log(`📊 [PRE-FILTER] Updated starlingParams:`, starlingParams);
      } catch (error) {
        console.warn(`⚠️ [PRE-FILTER] Could not resolve airline code, will rely on POST-filter:`, error);
      }
    } else {
      console.log(`ℹ️ [PRE-FILTER] No preferred airline specified, searching all airlines`);
    }

    console.log('📤 [FLIGHT SEARCH] Step 2: About to call Starling API (Supabase Edge Function)');
    const response = await supabase.functions.invoke('starling-flights', {
      body: {
        action: 'searchFlights',
        data: starlingParams
      }
    });

    console.log('✅ [FLIGHT SEARCH] Step 3: Starling API response received');
    console.log('📨 Response status:', response.error ? 'ERROR' : 'SUCCESS');

    if (response.error) {
      console.error('❌ [FLIGHT SEARCH] Starling API error:', response.error);
      throw new Error(response.error.message);
    }

    console.log('📊 [FLIGHT SEARCH] Raw response data:', response.data);

    console.log('🔄 [FLIGHT SEARCH] Step 4: Transforming Starling results');
    const flightData = response.data?.data || response.data;
    let flights = await transformStarlingResults(flightData, parsed);

    // If user specified maximum layover duration, we need to do a NEW SEARCH with more permissive stops
    // to find more options that can then be filtered by layover time
    if (parsed?.flights?.maxLayoverHours) {
      console.log(`⏰ [FLIGHT SEARCH] User requested layovers <= ${parsed.flights.maxLayoverHours} hours - doing expanded search`);

      // For layover filtering, we need to search with "any" stops to get more options
      // IMPORTANT: Keep airline filter if it was set
      const expandedStarlingParams = {
        ...starlingParams,
        stops: 'any' as any // Force expanded search to get more layover options
        // Airlines filter is preserved from starlingParams (if it was set)
      };

      console.log(`🔍 [LAYOVER FILTER] Doing expanded search with stops: any to find more layover options`);
      if ((expandedStarlingParams as any).Airlines) {
        console.log(`✈️ [LAYOVER FILTER] Airline filter preserved: ${(expandedStarlingParams as any).Airlines}`);
      }

      try {
        // Do a new search with expanded parameters using the same Starling API
        const expandedResponse = await supabase.functions.invoke('starling-flights', {
          body: {
            action: 'searchFlights',
            data: expandedStarlingParams
          }
        });

        if (!expandedResponse.error && expandedResponse.data) {
          const expandedFlightData = expandedResponse.data?.data || expandedResponse.data;
          const expandedFlights = await transformStarlingResults(expandedFlightData, parsed);
          console.log(`📊 [LAYOVER FILTER] Expanded search found ${expandedFlights.length} flights`);

          if (expandedFlights.length > 0) {
            flights = expandedFlights;
          }
        }
      } catch (error) {
        console.log(`⚠️ [LAYOVER FILTER] Expanded search failed, using original results:`, error);
      }

      // Now filter the expanded results by layover time
      console.log(`🔍 [LAYOVER FILTER] Filtering ${flights.length} flights for layovers <= ${parsed.flights.maxLayoverHours} hours`);
      flights = flights
        .map((flight: any) => {
          const filteredLegs = (flight.legs || []).map((leg: any) => {
            const options = (leg.options || []).filter((opt: any) => {
              const segments = opt.segments || [];
              if (segments.length <= 1) return true; // Direct flights are always allowed

              // Check layover times between segments
              for (let i = 0; i < segments.length - 1; i++) {
                const currentSegment = segments[i];
                const nextSegment = segments[i + 1];
                const layoverHours = calculateLayoverHours(currentSegment, nextSegment);

                if (layoverHours > parsed.flights.maxLayoverHours) {
                  console.log(`❌ [LAYOVER FILTER] Rejecting option: layover ${layoverHours}h > max ${parsed.flights.maxLayoverHours}h`);
                  return false;
                }
              }
              return true;
            });
            return { ...leg, options };
          });

          // Keep flight only if every leg still has at least one option
          const allLegsHaveOptions = filteredLegs.every((leg: any) => (leg.options?.length || 0) > 0);
          if (!allLegsHaveOptions) return null;
          return { ...flight, legs: filteredLegs };
        })
        .filter(Boolean) as any[];

      if (flights.length === 0) {
        console.log(`⚠️ [LAYOVER FILTER] No flights available with layovers <= ${parsed.flights.maxLayoverHours} hours`);
      } else {
        console.log(`✅ [LAYOVER FILTER] Found ${flights.length} flights with layovers <= ${parsed.flights.maxLayoverHours} hours`);
      }
    }

    // If user didn't specify stops, show mixed results (no filtering). Optionally we could prefer direct-first ordering later.
    console.log('✅ [FLIGHT SEARCH] Step 5: Flight data transformed successfully');
    console.log('✈️ Flights found:', flights.length);

    console.log('📝 [FLIGHT SEARCH] Step 6: Formatting response text');
    const formattedResponse = formatFlightResponse(flights);

    // 📊 BUILD EXTENDED METADATA for API responses
    const lightFareAirlines = ['LA', 'H2', 'AV', 'AM', 'JA', 'AR'];
    const userRequestedCarryOn = parsed?.flights?.luggage === 'carry_on';

    const metadata = {
      // Light fares exclusion (when user requests carry-on, light fare airlines are filtered)
      ...(userRequestedCarryOn && {
        light_fares_excluded: true,
        light_fare_airlines: lightFareAirlines
      })
    };

    const result = {
      response: formattedResponse,
      data: {
        combinedData: {
          flights,
          hotels: [],
          requestType: 'flights-only' as const
        },
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      }
    };

    console.log('🎉 [FLIGHT SEARCH] Flight search completed successfully');
    console.log('📋 Final result:', result);

    return result;
  } catch (error) {
    console.error('❌ [FLIGHT SEARCH] Error in flight search process:', error);
    return {
      response: '❌ **Servicio de vuelos temporalmente no disponible**\n\nNuestros servicios de búsqueda de vuelos están siendo actualizados. Mientras tanto:\n\n✈️ **Puedo ayudarte con:**\n- Información general sobre destinos\n- Consultas sobre hoteles\n- Paquetes turísticos\n\n📞 **Para búsquedas de vuelos inmediatas:**\nContacta a nuestro equipo directamente para asistencia personalizada.',
      data: null
    };
  }
};

export const handleHotelSearch = async (parsed: ParsedTravelRequest): Promise<SearchResult> => {
  console.log('🏨 [HOTEL SEARCH] Starting hotel search process');
  console.log('📋 Parsed request:', parsed);
  console.log('🔍 [DEBUG] parsed.hotels?.roomType:', parsed.hotels?.roomType);
  console.log('🔍 [DEBUG] parsed.hotels?.mealPlan:', parsed.hotels?.mealPlan);

  try {
    // 🔄 STEP 0: Infer adults from roomType if not explicitly specified
    // This is a CRITICAL fallback in case the AI parser didn't correctly infer adults
    let inferredAdults = parsed.hotels?.adults || parsed.flights?.adults || 1;
    const roomType = parsed.hotels?.roomType;

    if (inferredAdults === 1 && roomType) {
      // If adults is default (1) but roomType is specified, infer adults from roomType
      const normalizedRoomType = roomType.toLowerCase().trim();
      if (normalizedRoomType === 'double' || normalizedRoomType === 'twin' || normalizedRoomType === 'doble') {
        inferredAdults = 2;
        console.log('🔄 [ADULTS INFERENCE] roomType="double" → adults=2 (overriding default of 1)');
      } else if (normalizedRoomType === 'triple') {
        inferredAdults = 3;
        console.log('🔄 [ADULTS INFERENCE] roomType="triple" → adults=3 (overriding default of 1)');
      } else if (normalizedRoomType === 'quad' || normalizedRoomType === 'quadruple' || normalizedRoomType === 'cuadruple') {
        inferredAdults = 4;
        console.log('🔄 [ADULTS INFERENCE] roomType="quad" → adults=4 (overriding default of 1)');
      }
    }
    console.log(`📊 [ADULTS] Final adults count: ${inferredAdults} (roomType: ${roomType || 'not specified'})`);

    // Enrich hotel params from flight context if missing (city/dates/pax)
    const enrichedParsed: ParsedTravelRequest = {
      ...parsed,
      hotels: {
        // Prefer existing hotel fields
        city: parsed.hotels?.city || parsed.flights?.destination || '',
        checkinDate: parsed.hotels?.checkinDate || parsed.flights?.departureDate || '',
        checkoutDate:
          parsed.hotels?.checkoutDate ||
          parsed.flights?.returnDate ||
          (parsed.flights?.departureDate
            ? new Date(new Date(parsed.flights.departureDate).getTime() + 3 * 86400000)
              .toISOString()
              .split('T')[0]
            : ''),
        adults: inferredAdults,  // ✅ Use inferred adults from roomType
        children: parsed.hotels?.children || parsed.flights?.children || 0,
        roomType: parsed.hotels?.roomType,
        mealPlan: parsed.hotels?.mealPlan,
        hotelName: parsed.hotels?.hotelName,
        hotelChain: parsed.hotels?.hotelChain  // ✅ FIX: Pass hotelChain for chain filtering
      } as any
    };

    console.log('🔍 [DEBUG] enrichedParsed.hotels.roomType:', enrichedParsed.hotels?.roomType);
    console.log('🔍 [DEBUG] enrichedParsed.hotels.mealPlan:', enrichedParsed.hotels?.mealPlan);
    console.log('🔍 [DEBUG] enrichedParsed.hotels.hotelChain:', enrichedParsed.hotels?.hotelChain);

    // Validate we have at least a city to look up
    if (!enrichedParsed.hotels?.city) {
      console.warn('⚠️ [HOTEL SEARCH] Missing city for hotel search after enrichment');
      return {
        response:
          '🏨 Necesito la ciudad o destino del hotel. ¿En qué ciudad quieres hospedarte?',
        data: null
      };
    }

    console.log('🔄 [HOTEL SEARCH] Step 1: Formatting parameters for EUROVIPS API');
    const eurovipsParams = formatForEurovips(enrichedParsed);
    console.log('📊 EUROVIPS parameters:', eurovipsParams);

    // Get city code from new optimized mapping service
    console.log('📍 [HOTEL SEARCH] Step 2: Resolving city code');
    console.log('🔍 Looking up city:', enrichedParsed.hotels?.city);

    const cityCode = await getCityCode(enrichedParsed.hotels?.city || '');
    console.log('✅ [HOTEL SEARCH] City code resolved:', `"${enrichedParsed.hotels?.city}" → ${cityCode}`);

    // ✅ REGLA DE NEGOCIO (confirmada con Ruth/SOFTUR):
    // El campo <name> de EUROVIPS es el ÚNICO campo correcto para filtrar por:
    // - Cadena hotelera (Iberostar, Riu, Melia, etc.)
    // - Texto parcial del nombre del hotel (Ocean, Palace, etc.)
    // Prioridad: hotelChain > hotelName (hotelChain es más específico para búsquedas de cadena)
    const nameFilter = enrichedParsed.hotels?.hotelChain || enrichedParsed.hotels?.hotelName || '';

    if (nameFilter) {
      console.log(`🏨 [HOTEL SEARCH] Applying name filter to EUROVIPS: "${nameFilter}"`);
    }

    const requestBody = {
      action: 'searchHotels',
      data: {
        ...eurovipsParams.hotelParams,
        cityCode: cityCode,
        hotelName: nameFilter // ✅ Filtro por <name> en EUROVIPS (cadena o nombre parcial)
      }
    };

    console.log('📤 [HOTEL SEARCH] Step 3: About to call EUROVIPS API (Supabase Edge Function)', nameFilter ? `with name filter: "${nameFilter}"` : 'without name filter');
    console.log('📋 Request body:', requestBody);

    const response = await supabase.functions.invoke('eurovips-soap', {
      body: requestBody
    });

    console.log('✅ [HOTEL SEARCH] Step 4: EUROVIPS API response received');
    console.log('📨 Response status:', response.error ? 'ERROR' : 'SUCCESS');

    if (response.error) {
      console.error('❌ [HOTEL SEARCH] EUROVIPS API error:', response.error);
      throw new Error(response.error.message);
    }

    console.log('📊 [HOTEL SEARCH] Raw response data:', response.data);

    const allHotels = response.data.results || [];

    // 🔍 DEBUG: Log all hotel names received from EUROVIPS
    console.log(`📋 [EUROVIPS RESPONSE] Received ${allHotels.length} hotels:`);
    allHotels.forEach((hotel: any, index: number) => {
      console.log(`   ${index + 1}. "${hotel.name}"`);
    });

    // Fix hotel dates - EUROVIPS sometimes returns incorrect dates, so we force the correct ones
    const correctedHotels = allHotels.map((hotel: any) => ({
      ...hotel,
      check_in: enrichedParsed.hotels?.checkinDate || hotel.check_in,
      check_out: enrichedParsed.hotels?.checkoutDate || hotel.check_out,
      nights: hotel.nights // Keep calculated nights
    }));

    console.log('🔧 [HOTEL SEARCH] Corrected hotel dates:', {
      original: allHotels[0]?.check_in,
      corrected: correctedHotels[0]?.check_in,
      params: enrichedParsed.hotels?.checkinDate
    });

    // 🌴 Apply destination-specific filters (e.g., Punta Cana whitelist)
    // IMPORTANT: Pass hotelChain so the filter respects user's chain preference
    let destinationFilteredHotels = applyDestinationSpecificFilters(
      correctedHotels,
      enrichedParsed.hotels?.city || '',
      enrichedParsed.hotels?.hotelChain  // ← Pass requested chain to allow all hotels from that chain
    );

    // 🏨 HOTEL CHAIN FILTER - Filter by hotel chain if specified
    if (enrichedParsed.hotels?.hotelChain) {
      const chainFilter = enrichedParsed.hotels.hotelChain;
      console.log(`🏨 [CHAIN FILTER] Filtering hotels by chain: "${chainFilter}"`);
      console.log(`📊 [CHAIN FILTER] Hotels before filter: ${destinationFilteredHotels.length}`);

      destinationFilteredHotels = destinationFilteredHotels.filter(hotel => {
        const belongs = hotelBelongsToChain(hotel.name, chainFilter);
        if (belongs) {
          console.log(`✅ [CHAIN FILTER] Included: "${hotel.name}" (matches chain "${chainFilter}")`);
        } else {
          console.log(`🚫 [CHAIN FILTER] Excluded: "${hotel.name}" (does not match chain "${chainFilter}")`);
        }
        return belongs;
      });

      console.log(`📊 [CHAIN FILTER] Hotels after filter: ${destinationFilteredHotels.length}`);
    }

    // 🏨 HOTEL NAME FILTER - Filter by specific hotel name if specified
    if (enrichedParsed.hotels?.hotelName) {
      const nameFilter = enrichedParsed.hotels.hotelName;
      console.log(`🏨 [NAME FILTER] Filtering hotels by name: "${nameFilter}"`);
      console.log(`📊 [NAME FILTER] Hotels before filter: ${destinationFilteredHotels.length}`);

      destinationFilteredHotels = destinationFilteredHotels.filter(hotel => {
        const matches = hotelNameMatches(hotel.name, nameFilter);
        if (matches) {
          console.log(`✅ [NAME FILTER] Included: "${hotel.name}" (matches name "${nameFilter}")`);
        } else {
          console.log(`🚫 [NAME FILTER] Excluded: "${hotel.name}" (does not match name "${nameFilter}")`);
        }
        return matches;
      });

      console.log(`📊 [NAME FILTER] Hotels after filter: ${destinationFilteredHotels.length}`);
    }

    // ✅ USE ADVANCED ROOM FILTERING SYSTEM
    const normalizedRoomType = normalizeCapacity(enrichedParsed.hotels?.roomType);
    const normalizedMealPlan = normalizeMealPlan(enrichedParsed.hotels?.mealPlan);

    console.log('🔄 [NORMALIZATION] Room type:', enrichedParsed.hotels?.roomType, '→', normalizedRoomType);
    console.log('🔄 [NORMALIZATION] Meal plan:', enrichedParsed.hotels?.mealPlan, '→', normalizedMealPlan);

    // ✅ FILTER HOTELS BY ROOM TYPE AND MEAL PLAN using advanced filtering system
    const filterHotelRooms = (hotel: LocalHotelData): LocalHotelData | null => {
      // Apply advanced room filtering with both capacity and meal plan
      // Cast rooms to expected type since API response may have optional fields
      const filteredRooms = filterRooms(hotel.rooms as Parameters<typeof filterRooms>[0], {
        capacity: normalizedRoomType,
        mealPlan: normalizedMealPlan
      });

      if (filteredRooms.length === 0) {
        console.log(`🚫 [FILTER] Hotel "${hotel.name}" has no rooms matching criteria (capacity: ${normalizedRoomType || 'any'}, meal plan: ${normalizedMealPlan || 'any'})`);
        return null; // Skip hotel entirely
      }

      console.log(`✅ [FILTER] Hotel "${hotel.name}": ${hotel.rooms.length} → ${filteredRooms.length} rooms after advanced filtering`);

      // Return hotel with filtered rooms
      return {
        ...hotel,
        rooms: filteredRooms
      };
    };

    // Apply filter and remove null hotels
    const filteredHotels = destinationFilteredHotels
      .map(filterHotelRooms)
      .filter((hotel): hotel is LocalHotelData => hotel !== null);

    console.log(`📊 [FILTER] Hotels: ${destinationFilteredHotels.length} → ${filteredHotels.length} (after advanced room filtering)`);

    // Sort hotels by lowest price (minimum room price) and limit to 5
    const hotels = filteredHotels
      .sort((a: LocalHotelData, b: LocalHotelData) => {
        const minPriceA = Math.min(...a.rooms.map(r => r.total_price));
        const minPriceB = Math.min(...b.rooms.map(r => r.total_price));
        return minPriceA - minPriceB;
      })
      .slice(0, 5);

    console.log('✅ [HOTEL SEARCH] Step 5: Hotel data filtered, sorted by price, and limited');
    console.log('🏨 Hotels after filtering:', filteredHotels.length, '| Final count (top 5):', hotels.length);
    if (hotels.length > 0) {
      const cheapestPrice = Math.min(...hotels[0].rooms.map(r => r.total_price));
      const mostExpensivePrice = Math.min(...hotels[hotels.length - 1].rooms.map(r => r.total_price));
      console.log(`💸 Hotel price range: ${cheapestPrice} - ${mostExpensivePrice} ${hotels[0].rooms[0].currency}`);
    }

    console.log('📝 [HOTEL SEARCH] Step 6: Formatting response text');
    const requestedRoomType = enrichedParsed.hotels?.roomType;
    const requestedMealPlan = enrichedParsed.hotels?.mealPlan;
    console.log('🛏️ [HOTEL SEARCH] Requested room type:', requestedRoomType || 'none (showing all)');
    console.log('🍽️ [HOTEL SEARCH] Requested meal plan:', requestedMealPlan || 'none (showing all)');

    // Pass already-filtered hotels to formatter (no need to filter again)
    const formattedResponse = formatHotelResponse(hotels);

    // 📊 BUILD EXTENDED METADATA for API responses
    const isPuntaCana = isPuntaCanaDestination(enrichedParsed.hotels?.city || '');
    const hotelsExcludedNoRooms = destinationFilteredHotels.length - filteredHotels.length;

    const metadata = {
      // Destination-specific rules (e.g., Punta Cana whitelist)
      ...(isPuntaCana && {
        destination_rules: {
          type: 'quality_whitelist' as const,
          destination: enrichedParsed.hotels?.city || 'Punta Cana',
          total_available_from_provider: correctedHotels.length,
          whitelist_matches: destinationFilteredHotels.length,
          after_all_filters: filteredHotels.length,
          reason: 'Destino con lista curada de hoteles verificados'
        }
      }),
      // Hotels excluded because no rooms matched criteria
      ...(hotelsExcludedNoRooms > 0 && {
        hotels_excluded_no_matching_rooms: hotelsExcludedNoRooms
      }),
      // Room filters that were applied
      ...((normalizedRoomType || normalizedMealPlan) && {
        room_filters_applied: {
          ...(normalizedRoomType && { capacity: normalizedRoomType }),
          ...(normalizedMealPlan && { meal_plan: normalizedMealPlan })
        }
      })
    };

    const result = {
      response: formattedResponse,
      data: {
        eurovipsData: { hotels },
        combinedData: {
          flights: [],
          hotels, // ✅ Now contains ONLY hotels with matching rooms
          requestType: 'hotels-only' as const,
          requestedRoomType: normalizedRoomType,
          requestedMealPlan: normalizedMealPlan
        },
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      }
    };

    console.log('🎉 [HOTEL SEARCH] Hotel search completed successfully');
    console.log('📋 Final result:', result);

    return result;
  } catch (error) {
    console.error('❌ [HOTEL SEARCH] Error in hotel search process:', error);

    // Handle city not found error specifically
    const requestedCity = parsed.hotels?.city || parsed.flights?.destination || 'desconocida';
    if (error instanceof Error && error.message.includes('Ciudad no encontrada')) {
      return {
        response: `❌ **Ciudad no encontrada**\n\nNo pude encontrar "${requestedCity}" en la base de datos de EUROVIPS.\n\n🔍 **Verifica que el nombre esté bien escrito:**\n- Ejemplos: "Punta Cana", "Cancún", "Madrid", "Barcelona"\n- Puedes escribir con o sin acentos\n\n💡 **¿Buscabas otra ciudad cercana?**\nIntenta con el nombre de la ciudad principal del destino.`,
        data: null
      };
    }

    return {
      response: '❌ **Servicio de hoteles temporalmente no disponible**\n\nNuestros servicios de búsqueda de hoteles están siendo configurados. Mientras tanto:\n\n🏨 **Puedo ayudarte con:**\n- Recomendaciones generales de destinos\n- Información sobre ciudades\n- Planificación de viajes\n\n📞 **Para reservas de hoteles:**\nNuestro equipo puede asistirte con cotizaciones personalizadas.',
      data: null
    };
  }
};

export const handlePackageSearch = async (parsed: ParsedTravelRequest): Promise<SearchResult> => {
  try {
    const eurovipsParams = formatForEurovips(parsed);
    const cityCode = await getCityCode(parsed.packages?.destination || '');

    const response = await supabase.functions.invoke('eurovips-soap', {
      body: {
        action: 'searchPackages',
        data: {
          ...eurovipsParams.packageParams,
          cityCode: cityCode
        }
      }
    });

    const allPackages = response.data.results || [];
    // Sort packages by price (lowest first) and limit to 5
    const packages = allPackages
      .sort((a: any, b: any) => (a.price || 0) - (b.price || 0))
      .slice(0, 5);

    return {
      response: formatPackageResponse(packages),
      data: null
    };
  } catch (error) {
    return {
      response: '❌ Error buscando paquetes. Intenta con un destino específico.',
      data: null
    };
  }
};

export const handleServiceSearch = async (parsed: ParsedTravelRequest): Promise<SearchResult> => {
  try {
    const eurovipsParams = formatForEurovips(parsed);
    const cityCode = await getCityCode(parsed.services?.city || '');

    const response = await supabase.functions.invoke('eurovips-soap', {
      body: {
        action: 'searchServices',
        data: {
          ...eurovipsParams.serviceParams,
          cityCode: cityCode
        }
      }
    });

    const allServices = response.data.results || [];
    // Sort services by price (lowest first) and limit to 5
    const services = allServices
      .sort((a: any, b: any) => (a.price || 0) - (b.price || 0))
      .slice(0, 5);

    return {
      response: formatServiceResponse(services),
      data: null
    };
  } catch (error) {
    return {
      response: '❌ Error buscando servicios. Verifica la ciudad y fechas.',
      data: null
    };
  }
};

export const handleCombinedSearch = async (parsed: ParsedTravelRequest): Promise<SearchResult> => {
  console.log('🌟 [COMBINED SEARCH] Starting combined search process');
  console.log('📋 Parsed request:', parsed);

  try {
    // 🔄 STEP 0: Infer adults from roomType for BOTH flights and hotels
    // When user says "habitación doble", they need 2 adults for BOTH flight AND hotel
    let inferredAdults = parsed.hotels?.adults || parsed.flights?.adults || 1;
    const roomType = parsed.hotels?.roomType;

    if (inferredAdults === 1 && roomType) {
      const normalizedRoomType = roomType.toLowerCase().trim();
      if (normalizedRoomType === 'double' || normalizedRoomType === 'twin' || normalizedRoomType === 'doble') {
        inferredAdults = 2;
        console.log('🔄 [COMBINED ADULTS INFERENCE] roomType="double" → adults=2 for BOTH flight and hotel');
      } else if (normalizedRoomType === 'triple') {
        inferredAdults = 3;
        console.log('🔄 [COMBINED ADULTS INFERENCE] roomType="triple" → adults=3 for BOTH flight and hotel');
      } else if (normalizedRoomType === 'quad' || normalizedRoomType === 'quadruple' || normalizedRoomType === 'cuadruple') {
        inferredAdults = 4;
        console.log('🔄 [COMBINED ADULTS INFERENCE] roomType="quad" → adults=4 for BOTH flight and hotel');
      }
    }
    console.log(`📊 [COMBINED ADULTS] Final adults count: ${inferredAdults} (roomType: ${roomType || 'not specified'})`);

    // Enrich parsed with inferred adults for both flights and hotels
    const enrichedParsed: ParsedTravelRequest = {
      ...parsed,
      flights: parsed.flights ? {
        ...parsed.flights,
        adults: inferredAdults
      } : undefined,
      hotels: parsed.hotels ? {
        ...parsed.hotels,
        adults: inferredAdults
      } : undefined
    };

    // 🔍 DEBUG: Verify services are preserved in enrichedParsed
    console.log('🔍 [COMBINED SEARCH] Services in enrichedParsed:', {
      has_transfers: !!enrichedParsed.transfers,
      transfers_included: enrichedParsed.transfers?.included,
      has_travel_assistance: !!enrichedParsed.travelAssistance,
      travel_assistance_included: enrichedParsed.travelAssistance?.included
    });

    console.log('🚀 [COMBINED SEARCH] Step 1: Starting parallel searches');
    console.log('⚡ Running flight and hotel searches simultaneously');
    console.log('📊 [COMBINED SEARCH] Using adults:', inferredAdults, 'for both searches');

    // Parallel searches with enriched adults count
    const [flightResult, hotelResult] = await Promise.all([
      handleFlightSearch(enrichedParsed),
      handleHotelSearch(enrichedParsed)
    ]);

    console.log('✅ [COMBINED SEARCH] Step 2: Parallel searches completed');
    console.log('✈️ Flight search result:', flightResult ? 'SUCCESS' : 'FAILED');
    console.log('🏨 Hotel search result:', hotelResult ? 'SUCCESS' : 'FAILED');
    console.log('🔍 [DEBUG] Flight result data:', flightResult.data);
    console.log('🔍 [DEBUG] Hotel result data:', hotelResult.data);

    console.log('🔄 [COMBINED SEARCH] Step 3: Combining search results');

    // Hotels are already filtered by handleHotelSearch, just extract them
    const combinedData = {
      flights: flightResult.data?.combinedData?.flights || [],
      hotels: hotelResult.data?.combinedData?.hotels || [], // ✅ Already filtered
      requestType: 'combined' as const,
      requestedRoomType: hotelResult.data?.combinedData?.requestedRoomType,
      requestedMealPlan: hotelResult.data?.combinedData?.requestedMealPlan
    };

    console.log('📊 [COMBINED SEARCH] Combined data summary:');
    console.log('✈️ Flights found:', combinedData.flights.length);
    console.log('🏨 Hotels found (after filtering):', combinedData.hotels.length);

    console.log('📝 [COMBINED SEARCH] Step 4: Formatting combined response');
    const formattedResponse = formatCombinedResponse(combinedData);

    // 📊 MERGE METADATA from both searches
    const flightMetadata = flightResult.data?.metadata || {};
    const hotelMetadata = hotelResult.data?.metadata || {};
    const combinedMetadata = {
      ...flightMetadata,
      ...hotelMetadata
    };

    const result = {
      response: formattedResponse,
      data: {
        combinedData,
        metadata: Object.keys(combinedMetadata).length > 0 ? combinedMetadata : undefined
      }
    };

    console.log('🎉 [COMBINED SEARCH] Combined search completed successfully');
    console.log('📋 Final combined result:', result);

    return result;
  } catch (error) {
    console.error('❌ [COMBINED SEARCH] Error in combined search process:', error);
    return {
      response: '❌ Error en búsqueda combinada. Intenta por separado.',
      data: null
    };
  }
};

export const handleGeneralQuery = async (parsed: ParsedTravelRequest): Promise<string> => {
  // General response without N8N
  return '¡Hola! Soy Emilia, tu asistente de viajes. Puedo ayudarte con:\n\n' +
    '✈️ **Búsqueda de vuelos**\n' +
    '🏨 **Búsqueda de hoteles**\n' +
    '🎒 **Búsqueda de paquetes**\n' +
    '🚌 **Servicios y transfers**\n' +
    '🗺️ **Itinerarios de viaje**\n\n' +
    'Dime qué necesitas con fechas y destinos específicos.';
};

// =====================================================================
// ITINERARY HANDLER - Generates AI-powered travel itineraries
// =====================================================================

export const handleItineraryRequest = async (parsed: ParsedTravelRequest): Promise<SearchResult> => {
  console.log('🗺️ [ITINERARY] Starting itinerary generation process');
  console.log('📋 Parsed request:', parsed);

  try {
    const { destinations, days } = parsed.itinerary || {};

    if (!destinations || destinations.length === 0 || !days || days < 1) {
      console.warn('⚠️ [ITINERARY] Missing required fields');
      return {
        response: '🗺️ Para crear tu itinerario necesito saber:\n\n' +
          '• **Destino(s):** ¿A qué ciudad(es) o país(es) viajas?\n' +
          '• **Duración:** ¿Cuántos días durará tu viaje?\n\n' +
          'Por ejemplo: "Itinerario de 5 días para Roma" o "Plan de 10 días por Italia y Francia"',
        data: null
      };
    }

    console.log(`🔄 [ITINERARY] Generating itinerary for ${destinations.join(', ')} - ${days} days`);

    // Call the travel-itinerary Edge Function
    const response = await supabase.functions.invoke('travel-itinerary', {
      body: {
        destinations,
        days
      }
    });

    if (response.error) {
      console.error('❌ [ITINERARY] Edge Function error:', response.error);
      throw new Error(response.error.message);
    }

    const itineraryData = response.data?.data;

    if (!itineraryData || !itineraryData.itinerary) {
      console.error('❌ [ITINERARY] Invalid response from Edge Function');
      throw new Error('Invalid itinerary response');
    }

    console.log('✅ [ITINERARY] Itinerary generated successfully');
    console.log(`📊 [ITINERARY] Generated ${itineraryData.itinerary.length} days`);

    // Format the response
    const formattedResponse = formatItineraryResponse(itineraryData);

    const result = {
      response: formattedResponse,
      data: {
        itineraryData,
        messageType: 'itinerary'
      }
    };

    console.log('🎉 [ITINERARY] Itinerary generation completed successfully');

    return result;
  } catch (error) {
    console.error('❌ [ITINERARY] Error in itinerary generation:', error);
    return {
      response: '❌ **Error generando itinerario**\n\n' +
        'No pude generar el itinerario en este momento. Por favor, intenta nuevamente.\n\n' +
        '💡 **Tips:**\n' +
        '• Verifica que el destino esté bien escrito\n' +
        '• Indica la cantidad de días (ej: "5 días", "una semana")\n' +
        '• Puedes pedir itinerarios para ciudades, países o regiones',
      data: null
    };
  }
};