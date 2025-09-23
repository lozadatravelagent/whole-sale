import { supabase } from '@/integrations/supabase/client';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import { formatForStarling, formatForEurovips } from '@/services/aiMessageParser';
import type { SearchResult, LocalHotelData, LocalPackageData, LocalServiceData } from '../types/chat';
import { transformStarlingResults } from './flightTransformer';
import { formatFlightResponse, formatHotelResponse, formatPackageResponse, formatServiceResponse, formatCombinedResponse } from './responseFormatters';
import { getCityCode } from './messageService';

// Handler functions WITHOUT N8N
export const handleFlightSearch = async (parsed: ParsedTravelRequest): Promise<SearchResult> => {
  console.log('✈️ [FLIGHT SEARCH] Starting flight search process');
  console.log('📋 Parsed request:', parsed);

  try {
    console.log('🔄 [FLIGHT SEARCH] Step 1: Formatting parameters for Starling API');
    const starlingParams = formatForStarling(parsed);
    console.log('📊 Starling parameters:', starlingParams);

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
    let flights = transformStarlingResults(flightData, parsed);

    // If user requested direct flights only, filter options with exactly one segment per leg
    if (parsed?.flights?.stops === 'direct') {
      console.log('🚦 [FLIGHT SEARCH] Filtering to NON-STOP flights (direct)');
      flights = flights
        .map((flight: any) => {
          const filteredLegs = (flight.legs || []).map((leg: any) => {
            const options = (leg.options || []).filter((opt: any) => {
              const segments = opt.segments || [];
              return segments.length === 1 && (segments[0]?.stops?.length || 0) === 0;
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
        console.log('⚠️ [FLIGHT SEARCH] No non-stop options available for this itinerary');
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

    // Get city code first
    console.log('📍 [HOTEL SEARCH] Step 2: Getting city code for location');
    console.log('🔍 Looking up city:', eurovipsParams.hotelParams.cityCode);

    const cityCode = await getCityCode(eurovipsParams.hotelParams.cityCode);
    console.log('✅ [HOTEL SEARCH] City code resolved:', cityCode);

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

    // Sort hotels by lowest price (minimum room price) and limit to 5
    const hotels = allHotels
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
    const formattedResponse = formatHotelResponse(hotels);

    const result = {
      response: formattedResponse,
      data: {
        eurovipsData: { hotels },
        combinedData: {
          flights: [],
          hotels,
          requestType: 'hotels-only' as const
        }
      }
    };

    console.log('🎉 [HOTEL SEARCH] Hotel search completed successfully');
    console.log('📋 Final result:', result);

    return result;
  } catch (error) {
    console.error('❌ [HOTEL SEARCH] Error in hotel search process:', error);
    return {
      response: '❌ **Servicio de hoteles temporalmente no disponible**\n\nNuestros servicios de búsqueda de hoteles están siendo configurados. Mientras tanto:\n\n🏨 **Puedo ayudarte con:**\n- Recomendaciones generales de destinos\n- Información sobre ciudades\n- Planificación de viajes\n\n📞 **Para reservas de hoteles:**\nNuestro equipo puede asistirte con cotizaciones personalizadas.',
      data: null
    };
  }
};

export const handlePackageSearch = async (parsed: ParsedTravelRequest): Promise<SearchResult> => {
  try {
    const eurovipsParams = formatForEurovips(parsed);
    const cityCode = await getCityCode(eurovipsParams.packageParams.cityCode);

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
    const cityCode = await getCityCode(eurovipsParams.serviceParams.cityCode);

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

    console.log('🔄 [COMBINED SEARCH] Step 3: Combining search results');
    const combinedData = {
      flights: flightResult.data?.combinedData?.flights || [],
      hotels: hotelResult.data?.combinedData?.hotels || [],
      requestType: 'combined' as const
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