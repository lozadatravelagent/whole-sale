import { supabase } from '@/integrations/supabase/client';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import { formatForStarling, formatForEurovips } from '@/services/aiMessageParser';
import type { SearchResult, LocalHotelData, LocalPackageData, LocalServiceData } from '../types/chat';
import { transformStarlingResults } from './flightTransformer';
import { formatFlightResponse, formatHotelResponse, formatPackageResponse, formatServiceResponse, formatCombinedResponse } from './responseFormatters';
import { getCityCode } from '@/services/cityCodeMapping';
import { airlineResolver } from './airlineResolver';

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
    const starlingParams = formatForStarling(parsed);
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

    const result = {
      response: formattedResponse,
      data: {
        combinedData: {
          flights,
          hotels: [],
          requestType: 'flights-only' as const
        }
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

  try {
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
        adults: parsed.hotels?.adults || parsed.flights?.adults || 1,
        children: parsed.hotels?.children || parsed.flights?.children || 0,
        roomType: parsed.hotels?.roomType,
        mealPlan: parsed.hotels?.mealPlan,
        hotelName: (parsed as any)?.hotels?.hotelName
      } as any
    };

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

    const requestBody = {
      action: 'searchHotels',
      data: {
        ...eurovipsParams.hotelParams,
        cityCode: cityCode
      }
    };

    console.log('📤 [HOTEL SEARCH] Step 3: About to call EUROVIPS API (Supabase Edge Function)');
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

    // Sort hotels by lowest price (minimum room price) and limit to 5
    const hotels = correctedHotels
      .sort((a: LocalHotelData, b: LocalHotelData) => {
        const minPriceA = Math.min(...a.rooms.map(r => r.total_price));
        const minPriceB = Math.min(...b.rooms.map(r => r.total_price));
        return minPriceA - minPriceB;
      })
      .slice(0, 5);

    console.log('✅ [HOTEL SEARCH] Step 5: Hotel data extracted and sorted by price');
    console.log('🏨 Hotels found:', allHotels.length, '| Sorted and limited to:', hotels.length);
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
    const formattedResponse = formatHotelResponse(hotels, requestedRoomType, requestedMealPlan);

    // Normalize room type and meal plan from Spanish to English enum values
    const normalizeRoomType = (type?: string): 'single' | 'double' | 'triple' | undefined => {
      if (!type) return undefined;
      const normalized = type.toLowerCase();
      if (normalized === 'doble' || normalized === 'double') return 'double';
      if (normalized === 'individual' || normalized === 'single') return 'single';
      if (normalized === 'triple') return 'triple';
      return type as any; // Return original if no match
    };

    const normalizeMealPlan = (plan?: string): 'all_inclusive' | 'breakfast' | 'half_board' | 'room_only' | undefined => {
      if (!plan) return undefined;
      const normalized = plan.toLowerCase();
      if (normalized === 'todo incluido' || normalized === 'all inclusive' || normalized === 'all_inclusive') return 'all_inclusive';
      if (normalized === 'desayuno' || normalized === 'breakfast') return 'breakfast';
      if (normalized === 'media pensión' || normalized === 'media pension' || normalized === 'half board' || normalized === 'half_board') return 'half_board';
      if (normalized === 'solo habitación' || normalized === 'solo habitacion' || normalized === 'room only' || normalized === 'room_only') return 'room_only';
      return plan as any; // Return original if no match
    };

    const normalizedRoomType = normalizeRoomType(enrichedParsed.hotels?.roomType);
    const normalizedMealPlan = normalizeMealPlan(enrichedParsed.hotels?.mealPlan);

    console.log('🔄 [NORMALIZATION] Room type:', enrichedParsed.hotels?.roomType, '→', normalizedRoomType);
    console.log('🔄 [NORMALIZATION] Meal plan:', enrichedParsed.hotels?.mealPlan, '→', normalizedMealPlan);

    const result = {
      response: formattedResponse,
      data: {
        eurovipsData: { hotels },
        combinedData: {
          flights: [],
          hotels,
          requestType: 'hotels-only' as const,
          requestedRoomType: normalizedRoomType,
          requestedMealPlan: normalizedMealPlan
        }
      }
    };

    console.log('🎉 [HOTEL SEARCH] Hotel search completed successfully');
    console.log('📋 Final result:', result);

    return result;
  } catch (error) {
    console.error('❌ [HOTEL SEARCH] Error in hotel search process:', error);

    // Handle city not found error specifically
    if (error instanceof Error && error.message.includes('Ciudad no encontrada')) {
      return {
        response: `❌ **Ciudad no encontrada**\n\nNo pude encontrar "${enrichedParsed.hotels?.city}" en la base de datos de EUROVIPS.\n\n🔍 **Verifica que el nombre esté bien escrito:**\n- Ejemplos: "Punta Cana", "Cancún", "Madrid", "Barcelona"\n- Puedes escribir con o sin acentos\n\n💡 **¿Buscabas otra ciudad cercana?**\nIntenta con el nombre de la ciudad principal del destino.`,
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
    console.log('🚀 [COMBINED SEARCH] Step 1: Starting parallel searches');
    console.log('⚡ Running flight and hotel searches simultaneously');

    // Parallel searches
    const [flightResult, hotelResult] = await Promise.all([
      handleFlightSearch(parsed),
      handleHotelSearch(parsed)
    ]);

    console.log('✅ [COMBINED SEARCH] Step 2: Parallel searches completed');
    console.log('✈️ Flight search result:', flightResult ? 'SUCCESS' : 'FAILED');
    console.log('🏨 Hotel search result:', hotelResult ? 'SUCCESS' : 'FAILED');
    console.log('🔍 [DEBUG] Flight result data:', flightResult.data);
    console.log('🔍 [DEBUG] Hotel result data:', hotelResult.data);

    console.log('🔄 [COMBINED SEARCH] Step 3: Combining search results');

    // Normalize room type and meal plan from Spanish to English enum values
    const normalizeRoomType = (type?: string): 'single' | 'double' | 'triple' | undefined => {
      if (!type) return undefined;
      const normalized = type.toLowerCase();
      if (normalized === 'doble' || normalized === 'double') return 'double';
      if (normalized === 'individual' || normalized === 'single') return 'single';
      if (normalized === 'triple') return 'triple';
      return type as any;
    };

    const normalizeMealPlan = (plan?: string): 'all_inclusive' | 'breakfast' | 'half_board' | 'room_only' | undefined => {
      if (!plan) return undefined;
      const normalized = plan.toLowerCase();
      if (normalized === 'todo incluido' || normalized === 'all inclusive' || normalized === 'all_inclusive') return 'all_inclusive';
      if (normalized === 'desayuno' || normalized === 'breakfast') return 'breakfast';
      if (normalized === 'media pensión' || normalized === 'media pension' || normalized === 'half board' || normalized === 'half_board') return 'half_board';
      if (normalized === 'solo habitación' || normalized === 'solo habitacion' || normalized === 'room only' || normalized === 'room_only') return 'room_only';
      return plan as any;
    };

    const normalizedRoomType = normalizeRoomType(parsed.hotels?.roomType);
    const normalizedMealPlan = normalizeMealPlan(parsed.hotels?.mealPlan);

    console.log('🔄 [NORMALIZATION] Room type:', parsed.hotels?.roomType, '→', normalizedRoomType);
    console.log('🔄 [NORMALIZATION] Meal plan:', parsed.hotels?.mealPlan, '→', normalizedMealPlan);

    const combinedData = {
      flights: flightResult.data?.combinedData?.flights || [],
      hotels: hotelResult.data?.combinedData?.hotels || [],
      requestType: 'combined' as const,
      requestedRoomType: normalizedRoomType,
      requestedMealPlan: normalizedMealPlan
    };

    console.log('📊 [COMBINED SEARCH] Combined data summary:');
    console.log('✈️ Flights found:', combinedData.flights.length);
    console.log('🏨 Hotels found:', combinedData.hotels.length);

    console.log('📝 [COMBINED SEARCH] Step 4: Formatting combined response');
    const formattedResponse = formatCombinedResponse(combinedData);

    const result = {
      response: formattedResponse,
      data: { combinedData }
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
    '🚌 **Servicios y transfers**\n\n' +
    'Dime qué necesitas con fechas y destinos específicos.';
};