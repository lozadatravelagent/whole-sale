import { supabase } from '@/integrations/supabase/client';
import { runWithConcurrency } from '@/utils/concurrencyPool';
import type { HotelRequest, HotelStaySegment, ParsedTravelRequest } from '@/services/aiMessageParser';
import {
  formatForStarling,
  formatForEurovips,
  generateMissingInfoMessage,
  getHotelSegments,
  getPrimaryHotelRequest,
  hasFlexibleItineraryDateSelection,
  hasExactItineraryDateRange,
  hasUsableItineraryDates,
  resolveItineraryDateRange
} from '@/services/aiMessageParser';
import type { SearchResult, LocalHotelData, LocalHotelSegmentResult, LocalPackageData, LocalServiceData, FlightData, LocalHotelChainBalance, LocalHotelChainQuota } from '../types/chat';
import { transformStarlingResults } from './flightTransformer';
import { formatFlightResponse, formatHotelResponse, formatMultiSegmentHotelResponse, formatPackageResponse, formatServiceResponse, formatCombinedResponse, formatChainBalanceNote } from './responseFormatters';
import { getCityCode } from '@/services/cityCodeMapping';
import { airlineResolver } from './airlineResolver';
import { filterRooms, normalizeCapacity, normalizeMealPlan } from '@/utils/roomFilters';
import { hotelBelongsToChain, hotelBelongsToAnyChain, hotelNameMatches, hotelMatchesAnyName, getSearchTermForChain } from '../data/hotelChainAliases';
import { generateSearchId, saveFlightsToStorage } from './flightStorageService';
import { generateHotelSearchId, saveHotelsToStorage } from './hotelStorageService';
import { timeStringToNumber } from '@/features/chat/utils/timeSlotMapper';
import type { TripPlannerState } from '@/features/trip-planner/types';
import { getInclusiveDateRangeDays, normalizePlannerState, summarizePlannerForChat } from '@/features/trip-planner';
import { createDebugTimer, logTimingStep, nowMs } from '@/utils/debugTiming';

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
  ['riu', 'republica'],
  ['dreams', 'punta', 'cana'],
  ['now', 'onyx'],
  ['secrets', 'cap', 'cana'],
  ['excellence', 'punta', 'cana'],
  ['majestic', 'elegance'],
  ['barcelo', 'bavaro'],
  ['occidental', 'punta', 'cana'],
  ['paradisus', 'punta', 'cana'],
  ['hard', 'rock', 'punta', 'cana'],
  ['royalton', 'punta', 'cana'],
  ['hideaway', 'royalton'],
  ['chic', 'punta', 'cana'],
  ['lopesan', 'costa', 'bavaro'],
  ['luxury', 'bahia', 'principe'],
  ['grand', 'palladium'],
  ['trs', 'cap', 'cana'],
  ['catalonia', 'royal', 'bavaro'],
  ['hotel', 'riu', 'palace']
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

function normalizeChildrenAges(childrenAges: number[] | undefined, childrenCount: number): number[] {
  if (childrenCount <= 0) return [];

  const safeAges = (childrenAges || [])
    .filter((age) => Number.isFinite(age) && age > 0)
    .map((age) => Math.round(age));

  const normalized = safeAges.slice(0, childrenCount);
  while (normalized.length < childrenCount) {
    normalized.push(8);
  }

  return normalized;
}

function getMinRoomPrice(hotel: LocalHotelData): number {
  if (!hotel.rooms || hotel.rooms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...hotel.rooms.map((room) => room.total_price || Number.POSITIVE_INFINITY));
}

function getHotelUniqueKey(hotel: LocalHotelData): string {
  return hotel.hotel_id ? `id:${hotel.hotel_id}` : `name:${hotel.name.toLowerCase().trim()}`;
}

function selectHotelsWithStrictChainBalance(
  sortedHotels: LocalHotelData[],
  requestedChains: string[],
  totalSlots: number = 5
): { hotels: LocalHotelData[]; chainBalance: LocalHotelChainBalance } {
  const hotelsByChain = new Map<string, LocalHotelData[]>();

  for (const chain of requestedChains) {
    hotelsByChain.set(chain, []);
  }

  for (const hotel of sortedHotels) {
    for (const chain of requestedChains) {
      if (hotelBelongsToChain(hotel.name, chain)) {
        hotelsByChain.get(chain)!.push(hotel);
        break;
      }
    }
  }

  const baseQuota = Math.floor(totalSlots / requestedChains.length);
  const remainder = totalSlots % requestedChains.length;
  const selected: LocalHotelData[] = [];
  const selectedKeys = new Set<string>();
  const selectedCounts = new Map<string, number>();

  // Calculate per-chain quotas upfront
  const chainQuotas = new Map<string, number>();
  requestedChains.forEach((chain, index) => {
    chainQuotas.set(chain, baseQuota + (index < remainder ? 1 : 0));
  });

  // Phase 1: Fill each chain's base quota
  requestedChains.forEach((chain) => {
    const requestedQuota = chainQuotas.get(chain)!;
    const chainHotels = hotelsByChain.get(chain) || [];
    const take = Math.min(requestedQuota, chainHotels.length);

    selectedCounts.set(chain, take);

    chainHotels.slice(0, take).forEach((hotel) => {
      const hotelKey = getHotelUniqueKey(hotel);
      if (!selectedKeys.has(hotelKey)) {
        selected.push(hotel);
        selectedKeys.add(hotelKey);
      }
    });
  });

  // Phase 2: Fill remaining slots with round-robin across chains to keep balance
  if (selected.length < totalSlots) {
    // Build leftover pool per chain (hotels beyond their initial quota)
    const leftoversByChain = new Map<string, LocalHotelData[]>();
    requestedChains.forEach((chain) => {
      const requestedQuota = chainQuotas.get(chain)!;
      const chainHotels = hotelsByChain.get(chain) || [];
      const leftovers = chainHotels
        .slice(Math.min(requestedQuota, chainHotels.length))
        .filter((hotel) => !selectedKeys.has(getHotelUniqueKey(hotel)));
      leftoversByChain.set(chain, leftovers);
    });

    // Round-robin: give one extra hotel to each chain in turn until slots are full
    // No hard cap here - round-robin naturally keeps balance when both chains have stock
    let filledThisRound = true;
    while (selected.length < totalSlots && filledThisRound) {
      filledThisRound = false;
      for (const chain of requestedChains) {
        if (selected.length >= totalSlots) break;

        const chainLeftovers = leftoversByChain.get(chain) || [];
        const nextHotel = chainLeftovers.shift();
        if (!nextHotel) continue;

        const hotelKey = getHotelUniqueKey(nextHotel);
        if (selectedKeys.has(hotelKey)) continue;

        selected.push(nextHotel);
        selectedKeys.add(hotelKey);
        selectedCounts.set(chain, (selectedCounts.get(chain) || 0) + 1);
        filledThisRound = true;
      }
    }

    // Phase 3: If still unfilled (some chains exhausted), fill remaining by price
    if (selected.length < totalSlots) {
      const allLeftovers = requestedChains
        .flatMap((chain) => leftoversByChain.get(chain) || [])
        .filter((hotel) => !selectedKeys.has(getHotelUniqueKey(hotel)))
        .sort((a, b) => getMinRoomPrice(a) - getMinRoomPrice(b));

      for (const hotel of allLeftovers) {
        if (selected.length >= totalSlots) break;
        const hotelKey = getHotelUniqueKey(hotel);
        if (selectedKeys.has(hotelKey)) continue;

        selected.push(hotel);
        selectedKeys.add(hotelKey);

        const matchedChain = requestedChains.find((c) => hotelBelongsToChain(hotel.name, c));
        if (matchedChain) {
          selectedCounts.set(matchedChain, (selectedCounts.get(matchedChain) || 0) + 1);
        }
      }
    }
  }

  const quotas: LocalHotelChainQuota[] = requestedChains.map((chain, index) => {
    const requestedQuota = baseQuota + (index < remainder ? 1 : 0);
    const availableHotels = (hotelsByChain.get(chain) || []).length;
    const selectedHotels = selectedCounts.get(chain) || 0;

    return {
      chain,
      requestedQuota,
      availableHotels,
      selectedHotels,
      status: availableHotels === 0 ? 'missing' : availableHotels < requestedQuota ? 'partial' : 'fulfilled'
    };
  });

  return {
    hotels: selected.slice(0, totalSlots),
    chainBalance: {
      requestedChains,
      totalSlots,
      quotas,
      strictBalanceApplied: true
    }
  };
}

function extractBrokerCode(hotel: LocalHotelData): string {
  const hotelAny = hotel as any;

  const fromUniqueId = typeof hotelAny.unique_id === 'string' ? hotelAny.unique_id : '';
  if (fromUniqueId.includes('|')) {
    return fromUniqueId.split('|')[0].toUpperCase();
  }

  const firstRoom = hotel.rooms?.[0] as any;
  const fareIdBroker = typeof firstRoom?.fare_id_broker === 'string' ? firstRoom.fare_id_broker : '';
  if (fareIdBroker.includes('|')) {
    return fareIdBroker.split('|')[0].toUpperCase();
  }

  return '';
}

function shouldReplaceDuplicateHotel(existing: LocalHotelData, candidate: LocalHotelData): boolean {
  const existingBroker = extractBrokerCode(existing);
  const candidateBroker = extractBrokerCode(candidate);

  // EUROVIPS portal parity: prefer AP broker when duplicates share same hotel name.
  if (existingBroker !== 'AP' && candidateBroker === 'AP') return true;
  if (existingBroker === 'AP' && candidateBroker !== 'AP') return false;

  // Otherwise keep the cheaper option.
  return getMinRoomPrice(candidate) < getMinRoomPrice(existing);
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
  requestedChains?: string[]  // ✅ UPDATED: Changed from singular to plural array
): LocalHotelData[] {
  // Solo aplicar filtro especial para Punta Cana
  if (!isPuntaCanaDestination(city)) {
    return hotels;
  }

  console.log('🌴 [PUNTA CANA FILTER] Applying special hotel whitelist filter');
  console.log(`📊 [PUNTA CANA FILTER] Hotels before filter: ${hotels.length}`);

  if (requestedChains && requestedChains.length > 0) {
    console.log(`🏨 [PUNTA CANA FILTER] User requested chains: ${requestedChains.join(', ')} - will allow all hotels from these chains`);
  }

  const filteredHotels = hotels.filter(hotel => {
    // FIRST: If user requested specific chains, allow ALL hotels from ANY of those chains
    if (requestedChains && requestedChains.length > 0) {
      const normalizedHotelName = normalizeText(hotel.name);

      for (const chain of requestedChains) {
        const normalizedChain = normalizeText(chain);
        if (normalizedHotelName.includes(normalizedChain)) {
          console.log(`✅ [PUNTA CANA FILTER] Allowed (matches requested chain "${chain}"): "${hotel.name}"`);
          return true;
        }
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
interface FlightSegmentData {
  arrival?: { time?: string; date?: string; airportCode?: string };
  departure?: { time?: string; date?: string; airportCode?: string };
  Arrival?: { Time?: string; Date?: string; AirportCode?: string };
  Departure?: { Time?: string; Date?: string; AirportCode?: string };
}

function calculateLayoverHours(arrivalSegment: FlightSegmentData, departureSegment: FlightSegmentData): number {
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

// Type for Starling API request parameters
interface StarlingRequestParams {
  Passengers: Array<{ Count: number; Type: string }>;
  Legs: Array<{ DepartureAirportCity: string; ArrivalAirportCity: string; FlightDate: string }>;
  Airlines: string[] | null;
  stops?: 'direct' | 'one_stop' | 'two_stops' | 'with_stops' | 'any' | string;
}

function buildHotelRequestFromSegment(segment: HotelStaySegment): HotelRequest {
  return {
    city: segment.city || '',
    hotelName: segment.hotelName,
    hotelNames: segment.hotelNames,
    checkinDate: segment.checkinDate || '',
    checkoutDate: segment.checkoutDate || '',
    adults: segment.adults ?? 0,
    adultsExplicit: segment.adultsExplicit,
    children: segment.children ?? 0,
    childrenAges: segment.childrenAges,
    infants: segment.infants,
    roomType: segment.roomType,
    hotelChains: segment.hotelChains,
    mealPlan: segment.mealPlan,
    freeCancellation: segment.freeCancellation,
    roomView: segment.roomView,
    roomCount: segment.roomCount
  };
}

// Handler functions WITHOUT N8N
export const handleFlightSearch = async (parsed: ParsedTravelRequest): Promise<SearchResult> => {
  console.log('✈️ [FLIGHT SEARCH] Starting flight search process');
  console.log('📋 Parsed request:', parsed);
  const timer = createDebugTimer('FLIGHT SEARCH', {
    origin: parsed.flights?.origin,
    destination: parsed.flights?.destination,
    tripType: parsed.flights?.tripType,
  });

  try {
    console.log('🔄 [FLIGHT SEARCH] Step 1: Formatting parameters for Starling API');
    const formatStart = nowMs();
    const starlingParams = await formatForStarling(parsed);
    logTimingStep('FLIGHT SEARCH', 'formatForStarling', formatStart, {
      origin: parsed.flights?.origin,
      destination: parsed.flights?.destination,
    });
    console.log('📊 Starling parameters:', starlingParams);

    // ✈️ PRE-FILTER: Add airline filter to STARLING request if user specified preferredAirline
    if (parsed?.flights?.preferredAirline) {
      console.log(`✈️ [PRE-FILTER] Resolving preferred airline: ${parsed.flights.preferredAirline}`);

      try {
        const resolvedAirline = await airlineResolver.resolveAirline(parsed.flights.preferredAirline);
        const airlineCode = resolvedAirline.code;

        // Add Airlines filter to STARLING API request
        if (starlingParams) {
          (starlingParams as StarlingRequestParams).Airlines = [airlineCode];
        }

        console.log(`✅ [PRE-FILTER] Added airline filter to STARLING: ${airlineCode} (${resolvedAirline.name})`);
        console.log(`📊 [PRE-FILTER] Updated starlingParams:`, starlingParams);
      } catch (error) {
        console.warn(`⚠️ [PRE-FILTER] Could not resolve airline code, will rely on POST-filter:`, error);
      }
    } else {
      console.log(`ℹ️ [PRE-FILTER] No preferred airline specified, searching all airlines`);
    }

    const invokeStarlingSearch = async (params: unknown) => {
      return supabase.functions.invoke('starling-flights', {
        body: {
          action: 'searchFlights',
          data: params
        }
      });
    };

    console.log('📤 [FLIGHT SEARCH] Step 2: About to call Starling API (Supabase Edge Function)');
    const invokeStart = nowMs();
    const response = await invokeStarlingSearch(starlingParams);
    logTimingStep('FLIGHT SEARCH', 'invoke Starling initial search', invokeStart, {
      hasError: Boolean(response.error),
    });

    console.log('✅ [FLIGHT SEARCH] Step 3: Starling API response received');
    console.log('📨 Response status:', response.error ? 'ERROR' : 'SUCCESS');

    if (response.error) {
      console.error('❌ [FLIGHT SEARCH] Starling API error:', response.error);
      throw new Error(response.error.message);
    }

    console.log('📊 [FLIGHT SEARCH] Raw response data:', response.data);

    console.log('🔄 [FLIGHT SEARCH] Step 4: Transforming Starling results');
    const transformStart = nowMs();
    const flightData = response.data?.data || response.data;
    let flights = await transformStarlingResults(flightData, parsed);
    logTimingStep('FLIGHT SEARCH', 'transformStarlingResults initial', transformStart, {
      flights: flights.length,
    });
    let broadenedSearchRetry = false;
    let forcedResultFallback = false;
    let checkedLuggageRelaxedFallback = false;
    let checkedLuggageRelaxedMode: 'partial_included' | 'all_relaxed' | null = null;

    // Hard gate: if initial search returns no flights, retry once with broader stops criteria.
    const shouldRetryBroadenedSearch =
      flights.length === 0 &&
      !parsed?.flights?.maxLayoverHours &&
      parsed?.flights?.stops !== 'any';

    if (shouldRetryBroadenedSearch) {
      const broadenedParams: StarlingRequestParams = {
        ...(starlingParams as StarlingRequestParams),
        stops: 'any'
      };

      console.log('🔁 [FLIGHT SEARCH] No results on first attempt, retrying with broader stops criteria (stops=any)');

      try {
        const broadenedSearchStart = nowMs();
        const broadenedResponse = await invokeStarlingSearch(broadenedParams);
        logTimingStep('FLIGHT SEARCH', 'invoke Starling broadened retry', broadenedSearchStart, {
          hasError: Boolean(broadenedResponse.error),
        });
        if (!broadenedResponse.error && broadenedResponse.data) {
          const broadenedFlightData = broadenedResponse.data?.data || broadenedResponse.data;
          const broadenedParsed: ParsedTravelRequest = {
            ...parsed,
            flights: parsed.flights
              ? { ...parsed.flights, stops: 'any' }
              : parsed.flights,
          };
          const broadenedFlights = await transformStarlingResults(broadenedFlightData, broadenedParsed);
          broadenedSearchRetry = true;
          console.log(`📊 [FLIGHT SEARCH] Broadened retry returned ${broadenedFlights.length} flights`);

          if (broadenedFlights.length > 0) {
            flights = broadenedFlights;
          }
        }
      } catch (error) {
        console.warn('⚠️ [FLIGHT SEARCH] Broadened retry failed, keeping original result set:', error);
      }
    }

    // Hard gate: do not return zero when provider has inventory but strict filters removed everything.
    if (flights.length === 0) {
      const emergencyParsed: ParsedTravelRequest = {
        ...parsed,
        flights: parsed.flights
          ? {
            ...parsed.flights,
            stops: 'any',
            maxLayoverHours: undefined,
            departureTimePreference: undefined,
            arrivalTimePreference: undefined,
          }
          : parsed.flights,
      };
      const emergencyFlights = await transformStarlingResults(flightData, emergencyParsed);
      if (emergencyFlights.length > 0) {
        flights = emergencyFlights;
        forcedResultFallback = true;
        console.log(`🛟 [FLIGHT SEARCH] Applied emergency relaxed-filter fallback: ${emergencyFlights.length} flights`);
      }
    }

    // If user specified maximum layover duration, we need to do a NEW SEARCH with more permissive stops
    // to find more options that can then be filtered by layover time
    if (parsed?.flights?.maxLayoverHours) {
      console.log(`⏰ [FLIGHT SEARCH] User requested layovers <= ${parsed.flights.maxLayoverHours} hours - doing expanded search`);

      // For layover filtering, we need to search with "any" stops to get more options
      // IMPORTANT: Keep airline filter if it was set
      const expandedStarlingParams: StarlingRequestParams & { stops?: string } = {
        ...starlingParams as StarlingRequestParams,
        stops: 'any' // Force expanded search to get more layover options
        // Airlines filter is preserved from starlingParams (if it was set)
      };

      console.log(`🔍 [LAYOVER FILTER] Doing expanded search with stops: any to find more layover options`);
      if (expandedStarlingParams.Airlines) {
        console.log(`✈️ [LAYOVER FILTER] Airline filter preserved: ${expandedStarlingParams.Airlines}`);
      }

      try {
        // Do a new search with expanded parameters using the same Starling API
        const expandedSearchStart = nowMs();
        const expandedResponse = await supabase.functions.invoke('starling-flights', {
          body: {
            action: 'searchFlights',
            data: expandedStarlingParams
          }
        });
        logTimingStep('FLIGHT SEARCH', 'invoke Starling expanded layover search', expandedSearchStart, {
          hasError: Boolean(expandedResponse.error),
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
        .map((flight: FlightData) => {
          const filteredLegs = (flight.legs || []).map((leg) => {
            const options = (leg.options || []).filter((opt) => {
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
          const allLegsHaveOptions = filteredLegs.every((leg) => (leg.options?.length || 0) > 0);
          if (!allLegsHaveOptions) return null;
          return { ...flight, legs: filteredLegs };
        })
        .filter((flight): flight is FlightData => flight !== null);

      if (flights.length === 0) {
        console.log(`⚠️ [LAYOVER FILTER] No flights available with layovers <= ${parsed.flights.maxLayoverHours} hours`);
      } else {
        console.log(`✅ [LAYOVER FILTER] Found ${flights.length} flights with layovers <= ${parsed.flights.maxLayoverHours} hours`);
      }
    }

    // 🕐 NUEVO: Aplicar filtros de horario DURANTE la búsqueda
    if (parsed?.flights?.departureTimePreference || parsed?.flights?.arrivalTimePreference) {
      console.log('🕐 [TIME FILTER] Applying time filters during search');

      // Importar mapper centralizado
      const { timePreferenceToRange, isTimeInRange, timeStringToNumber } = await import('@/features/chat/utils/timeSlotMapper');

      const departureRange = parsed.flights.departureTimePreference
        ? timePreferenceToRange(parsed.flights.departureTimePreference)
        : null;

      const arrivalRange = parsed.flights.arrivalTimePreference
        ? timePreferenceToRange(parsed.flights.arrivalTimePreference)
        : null;

      if (departureRange) {
        console.log(`🕐 [TIME FILTER] Departure time filter: ${departureRange[0]}-${departureRange[1]}`);
      }
      if (arrivalRange) {
        console.log(`🕐 [TIME FILTER] Arrival time filter: ${arrivalRange[0]}-${arrivalRange[1]}`);
      }

      flights = flights.filter(flight => {
        let passes = true;

        // Filtrar por hora de salida (primer leg)
        if (departureRange) {
          const departureTime = getFirstDepartureTime(flight);
          const inRange = isTimeInRange(departureTime, departureRange);

          if (!inRange) {
            console.log(`❌ [TIME FILTER] Filtered out flight ${flight.id}: departure time ${departureTime} not in range ${departureRange[0]}-${departureRange[1]}`);
          }

          passes = passes && inRange;
        }

        // Filtrar por hora de llegada (último leg)
        if (arrivalRange) {
          const arrivalTime = getLastArrivalTime(flight);
          const inRange = isTimeInRange(arrivalTime, arrivalRange);

          if (!inRange) {
            console.log(`❌ [TIME FILTER] Filtered out flight ${flight.id}: arrival time ${arrivalTime} not in range ${arrivalRange[0]}-${arrivalRange[1]}`);
          }

          passes = passes && inRange;
        }

        return passes;
      });

      console.log(`🕐 [TIME FILTER] After time filtering: ${flights.length} flights remain`);
    }

    // If strict checked-baggage requirement removes everything, relax ONLY that filter
    // while preserving the rest of the constraints (route/dates/airline/stops/layover/time).
    if (flights.length === 0 && parsed?.flights?.luggage === 'checked') {
      console.log('🧳 [FLIGHT SEARCH] No flights left with checked baggage on all legs; retrying with relaxed baggage filter');

      const relaxedBaggageParsed: ParsedTravelRequest = {
        ...parsed,
        flights: parsed.flights
          ? {
            ...parsed.flights,
            luggage: undefined,
          }
          : parsed.flights,
      };

      const relaxedBaggageFlights = await transformStarlingResults(flightData, relaxedBaggageParsed);
      const flightsWithPartialChecked = relaxedBaggageFlights.filter((flight: any) =>
        Array.isArray(flight?.baggageAnalysis) &&
        flight.baggageAnalysis.some((leg: any) => (leg?.baggageQuantity || 0) > 0)
      );

      const fallbackFlights = flightsWithPartialChecked.length > 0
        ? flightsWithPartialChecked
        : relaxedBaggageFlights;

      if (fallbackFlights.length > 0) {
        flights = fallbackFlights;
        checkedLuggageRelaxedFallback = true;
        checkedLuggageRelaxedMode = flightsWithPartialChecked.length > 0
          ? 'partial_included'
          : 'all_relaxed';

        console.log(`🧳 [FLIGHT SEARCH] Relaxed baggage fallback applied: ${flights.length} flights (${checkedLuggageRelaxedMode})`);
      }
    }

    // If user didn't specify stops, show mixed results (no filtering). Optionally we could prefer direct-first ordering later.
    console.log('✅ [FLIGHT SEARCH] Step 5: Flight data transformed successfully');
    console.log('✈️ Flights found:', flights.length);

    console.log('📝 [FLIGHT SEARCH] Step 6: Formatting response text');
    const formattedResponse = formatFlightResponse(flights);
    const responseWithWarnings = checkedLuggageRelaxedFallback
      ? `⚠️ **Equipaje de bodega**\n\nNo encontré opciones con equipaje de bodega incluido en todos los tramos. Te muestro alternativas que cumplen el resto de tus filtros para que puedas agregar bodega en la tarifa.\n\n${formattedResponse}`
      : formattedResponse;

    // 📊 BUILD EXTENDED METADATA for API responses
    const lightFareAirlines = ['LA', 'H2', 'AV', 'AM', 'JA', 'AR'];
    const userRequestedCarryOn = parsed?.flights?.luggage === 'carry_on';
    const userRequestedBackpack = parsed?.flights?.luggage === 'backpack';

    const metadata = {
      // Light fares exclusion (when user requests carry_on, light fare airlines are filtered out)
      // For backpack, light fare airlines are PREFERRED (they offer backpack)
      ...(userRequestedCarryOn && {
        light_fares_excluded: true,
        light_fare_airlines: lightFareAirlines
      }),
      ...(userRequestedBackpack && {
        light_fares_preferred: true,
        light_fare_airlines: lightFareAirlines
      }),
      ...(broadenedSearchRetry && {
        broadened_search_retry: true
      }),
      ...(forcedResultFallback && {
        forced_result_fallback: true
      }),
      ...(checkedLuggageRelaxedFallback && {
        checked_luggage_relaxed_fallback: true,
        checked_luggage_relaxed_mode: checkedLuggageRelaxedMode
      })
    };

    // Generate search ID and save ALL flights to localStorage for dynamic filtering
    const searchId = generateSearchId({
      origin: parsed.flights?.origin,
      destination: parsed.flights?.destination,
      departureDate: parsed.flights?.departureDate,
      returnDate: parsed.flights?.returnDate,
    });

// Save all flights to IndexedDB (for dynamic filtering in UI)
    await saveFlightsToStorage(searchId, flights, {
      origin: parsed.flights?.origin,
      destination: parsed.flights?.destination,
      departureDate: parsed.flights?.departureDate,
      returnDate: parsed.flights?.returnDate,
    });

    // Limit flights stored in DB to 5 (UI will get full list from localStorage)
    const MAX_FLIGHTS_FOR_DB = 5;
    const flightsForDb = flights.slice(0, MAX_FLIGHTS_FOR_DB);

    const result = {
      response: responseWithWarnings,
      data: {
        combinedData: {
          flights: flightsForDb,
          hotels: [],
          requestType: 'flights-only' as const,
          flightSearchId: searchId, // ID to retrieve full results from localStorage
        },
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      }
    };

    console.log('🎉 [FLIGHT SEARCH] Flight search completed successfully');
    console.log('📋 Final result:', result);
    timer.end('total', {
      flights: flights.length,
      broadenedSearchRetry,
      forcedResultFallback,
      checkedLuggageRelaxedFallback,
    });

    return result;
  } catch (error) {
    timer.fail('failed', error, {
      origin: parsed.flights?.origin,
      destination: parsed.flights?.destination,
    });
    console.error('❌ [FLIGHT SEARCH] Error in flight search process:', error);
    return {
      response: '❌ **Servicio de vuelos temporalmente no disponible**\n\nNuestros servicios de búsqueda de vuelos están siendo actualizados. Mientras tanto:\n\n✈️ **Puedo ayudarte con:**\n- Información general sobre destinos\n- Consultas sobre hoteles\n- Paquetes turísticos\n\n📞 **Para búsquedas de vuelos inmediatas:**\nContacta a nuestro equipo directamente para asistencia personalizada.',
      data: null
    };
  }
};

export const handleHotelSearch = async (
  parsed: ParsedTravelRequest,
  options: { allowFlightFallback?: boolean } = {}
): Promise<SearchResult> => {
  console.log('🏨 [HOTEL SEARCH] Starting hotel search process');
  console.log('📋 Parsed request:', parsed);
  console.log('🔍 [DEBUG] parsed.hotels?.roomType:', parsed.hotels?.roomType);
  console.log('🔍 [DEBUG] parsed.hotels?.mealPlan:', parsed.hotels?.mealPlan);
  const timer = createDebugTimer('HOTEL SEARCH', {
    city: parsed.hotels?.city,
    roomType: parsed.hotels?.roomType,
    mealPlan: parsed.hotels?.mealPlan,
  });

  try {
    const allowFlightFallback = options.allowFlightFallback ?? true;
    const hotelSegments = getHotelSegments(parsed.hotels);

    if (hotelSegments.length > 1) {
      console.log(`🧭 [HOTEL SEARCH] Multi-segment hotel search detected: ${hotelSegments.length} tramos`);

      const segmentResults = await Promise.all(
        hotelSegments.map(async (segment, index): Promise<LocalHotelSegmentResult> => {
          const segmentRequest = buildHotelRequestFromSegment(segment);
          const segmentParsed: ParsedTravelRequest = {
            ...parsed,
            hotels: segmentRequest
          };

          try {
            const segmentResult = await handleHotelSearch(segmentParsed, {
              allowFlightFallback: false
            });
            const combinedData = segmentResult.data?.combinedData;
            const hasHotels = (combinedData?.hotels?.length || 0) > 0;

            return {
              segmentId: segment.id || `hotel-segment-${index + 1}`,
              city: segment.city || segmentRequest.city,
              checkinDate: segment.checkinDate || segmentRequest.checkinDate,
              checkoutDate: segment.checkoutDate || segmentRequest.checkoutDate,
              requestedRoomType: combinedData?.requestedRoomType,
              requestedMealPlan: combinedData?.requestedMealPlan,
              requestedChains: segment.hotelChains,
              chainBalance: combinedData?.chainBalance,
              hotels: combinedData?.hotels || [],
              hotelSearchId: combinedData?.hotelSearchId,
              error: hasHotels ? undefined : segmentResult.response
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'No pude procesar este tramo.';
            return {
              segmentId: segment.id || `hotel-segment-${index + 1}`,
              city: segment.city || 'Destino',
              checkinDate: segment.checkinDate || '',
              checkoutDate: segment.checkoutDate || '',
              requestedRoomType: segment.roomType,
              requestedMealPlan: segment.mealPlan,
              requestedChains: segment.hotelChains,
              chainBalance: undefined,
              hotels: [],
              error: errorMessage
            };
          }
        })
      );

      const flattenedHotels = segmentResults.flatMap((segment) => segment.hotels);
      const hotelSearchIds = segmentResults
        .map((segment) => segment.hotelSearchId)
        .filter((searchId): searchId is string => Boolean(searchId));
      const formattedResponse = formatMultiSegmentHotelResponse(segmentResults);
      const primarySegment = hotelSegments[0];
      timer.end('multi-segment total', {
        segments: segmentResults.length,
        hotels: flattenedHotels.length,
      });

      return {
        response: formattedResponse,
        data: {
          eurovipsData: { hotels: flattenedHotels },
          combinedData: {
            flights: [],
            hotels: flattenedHotels,
            hotelSegments: segmentResults,
            requestType: 'hotels-only' as const,
            requestedRoomType: primarySegment?.roomType,
            requestedMealPlan: primarySegment?.mealPlan,
            hotelSearchId: hotelSearchIds[0],
            hotelSearchIds
          }
        }
      };
    }

    const primaryHotelRequest = getPrimaryHotelRequest(parsed.hotels) || parsed.hotels;

    // 🔄 STEP 0: Infer adults from roomType if not explicitly specified
    // This is a CRITICAL fallback in case the AI parser didn't correctly infer adults
    let inferredAdults = primaryHotelRequest?.adults || parsed.flights?.adults || 1;
    const roomType = primaryHotelRequest?.roomType;
    const totalChildren = (primaryHotelRequest?.children || parsed.flights?.children || 0)
      + (primaryHotelRequest?.infants || parsed.flights?.infants || 0);

    // Only infer adults from roomType if adults was NOT explicitly stated by user
    const adultsExplicit = primaryHotelRequest?.adultsExplicit || parsed.flights?.adultsExplicit || false;

    if (inferredAdults === 1 && totalChildren === 0 && roomType && !adultsExplicit) {
      // If adults is default (1), no children/infants specified, but roomType is specified, infer adults from roomType
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

    const inferredChildren = primaryHotelRequest?.children || parsed.flights?.children || 0;
    const inferredInfants = primaryHotelRequest?.infants || parsed.flights?.infants || 0;
    const normalizedChildrenAges = normalizeChildrenAges(primaryHotelRequest?.childrenAges, inferredChildren);

    // Enrich hotel params from flight context if missing (city/dates/pax).
    // For multi-segment hotel searches we disable date/city fallback from flights,
    // otherwise the outbound/return flight can contaminate individual hotel tramos.
    const enrichedParsed: ParsedTravelRequest = {
      ...parsed,
      hotels: {
        ...primaryHotelRequest,
        // Prefer existing hotel fields
        city: primaryHotelRequest?.city || (allowFlightFallback ? parsed.flights?.destination : '') || '',
        checkinDate: primaryHotelRequest?.checkinDate || (allowFlightFallback ? parsed.flights?.departureDate : '') || '',
        checkoutDate:
          primaryHotelRequest?.checkoutDate ||
          (allowFlightFallback ? parsed.flights?.returnDate : '') ||
          (allowFlightFallback && parsed.flights?.departureDate
            ? new Date(new Date(parsed.flights.departureDate).getTime() + 3 * 86400000)
              .toISOString()
              .split('T')[0]
            : ''),
        adults: inferredAdults,  // ✅ Use inferred adults from roomType
        children: inferredChildren,    // Niños 2-12 años
        childrenAges: normalizedChildrenAges, // Siempre enviar edades para paridad con portal
        infants: inferredInfants,       // Infantes 0-2 años
        roomType: primaryHotelRequest?.roomType,
        mealPlan: primaryHotelRequest?.mealPlan,
        hotelName: primaryHotelRequest?.hotelName,
        hotelNames: primaryHotelRequest?.hotelNames,
        hotelChains: primaryHotelRequest?.hotelChains  // ✅ UPDATED: Changed from singular to plural array
      }
    };

    console.log('🔍 [DEBUG] enrichedParsed.hotels.roomType:', enrichedParsed.hotels?.roomType);
    console.log('🔍 [DEBUG] enrichedParsed.hotels.mealPlan:', enrichedParsed.hotels?.mealPlan);
    console.log('🔍 [DEBUG] enrichedParsed.hotels.hotelChains:', enrichedParsed.hotels?.hotelChains);

    // Validate we have at least a city to look up
    if (!enrichedParsed.hotels?.city) {
      console.warn('⚠️ [HOTEL SEARCH] Missing city for hotel search after enrichment');
      timer.end('stopped - missing city', {
        allowFlightFallback,
      });
      return {
        response:
          '🏨 Necesito la ciudad o destino del hotel. ¿En qué ciudad quieres hospedarte?',
        data: null
      };
    }

    console.log('🔄 [HOTEL SEARCH] Step 1: Formatting parameters for EUROVIPS API');
    const formatStart = nowMs();
    const eurovipsParams = formatForEurovips(enrichedParsed);
    logTimingStep('HOTEL SEARCH', 'formatForEurovips', formatStart, {
      city: enrichedParsed.hotels?.city,
      adults: enrichedParsed.hotels?.adults,
    });
    console.log('📊 EUROVIPS parameters:', eurovipsParams);

    // Get city code from new optimized mapping service
    console.log('📍 [HOTEL SEARCH] Step 2: Resolving city code');
    console.log('🔍 Looking up city:', enrichedParsed.hotels?.city);

    const cityLookupStart = nowMs();
    const cityCode = await getCityCode(enrichedParsed.hotels?.city || '');
    logTimingStep('HOTEL SEARCH', 'resolve city code', cityLookupStart, {
      city: enrichedParsed.hotels?.city,
      cityCode,
    });
    console.log('✅ [HOTEL SEARCH] City code resolved:', `"${enrichedParsed.hotels?.city}" → ${cityCode}`);

    const invokeEurovipsSearch = async (requestBody: unknown, label: string) => {
      const invokeStart = nowMs();
      const response = await supabase.functions.invoke('eurovips-soap', {
        body: requestBody
      });
      logTimingStep('HOTEL SEARCH', label, invokeStart, {
        hasError: Boolean(response.error),
        hotels: response.data?.results?.length || 0,
      });
      return response;
    };

    // ✅ REGLA DE NEGOCIO (confirmada con Ruth/SOFTUR):
    // El campo <name> de EUROVIPS es el ÚNICO campo correcto para filtrar por:
    // - Cadena hotelera (Iberostar, Riu, Melia, etc.)
    // - Texto parcial del nombre del hotel (Ocean, Palace, etc.)

    // ✅ SEARCH STRATEGY (priority order):
    // 1. hotelNames (specific hotels like "Riu Republica") → N requests + merge
    // 2. hotelChains (chains like "RIU", "Iberostar") → N requests + merge
    // 3. hotelName (single name filter) → 1 request
    // 4. No filter → Get all hotels for city

    const hotelNames = enrichedParsed.hotels?.hotelNames || [];
    const hotelChains = enrichedParsed.hotels?.hotelChains || [];
    const hotelName = enrichedParsed.hotels?.hotelName || '';

    let allHotels: LocalHotelData[] = [];

    // =====================================================================
    // COMBINED SEARCH: Search by specific names AND chains (not exclusive)
    // When user says "cadena iberostar y riu lupita":
    // - hotelNames = ["RIU Lupita"] → search for this specific hotel
    // - hotelChains = ["Iberostar", "Riu"] → but "Riu" is covered by "RIU Lupita"
    // - So we search: Iberostar (chain) + RIU Lupita (specific name)
    // =====================================================================

    // Determine which chains are NOT covered by specific hotel names
    // A chain is "covered" if there's a specific hotel name starting with that chain
    const uncoveredChains = hotelChains.filter(chain => {
      const chainLower = chain.toLowerCase();
      const isCovered = hotelNames.some(name => name.toLowerCase().startsWith(chainLower));
      if (isCovered) {
        console.log(`🔗 [CHAIN COVERAGE] Chain "${chain}" is covered by a specific hotel name - will search by name instead`);
      }
      return !isCovered;
    });

    console.log(`🔍 [SEARCH STRATEGY] hotelNames: ${hotelNames.length}, hotelChains: ${hotelChains.length}, uncoveredChains: ${uncoveredChains.length}`);

    // STEP 1+2: Search by hotel names and uncovered chains in parallel (max 3 concurrent)
    const searchTasks: { label: string; searchTerm: string }[] = [
      ...hotelNames.map((name) => ({ label: `name:"${name}"`, searchTerm: name })),
      ...uncoveredChains.map((chain) => ({ label: `chain:"${chain}"`, searchTerm: getSearchTermForChain(chain) })),
    ];

    if (searchTasks.length > 0) {
      console.log(`🏨 [PARALLEL-SEARCH] Making ${searchTasks.length} API requests (max 3 concurrent):`, searchTasks.map(t => t.label));

      const results = await runWithConcurrency(
        searchTasks.map((task) => async () => {
          console.log(`📤 [PARALLEL-SEARCH] Searching for ${task.label}`);

          const response = await invokeEurovipsSearch({
            action: 'searchHotels',
            data: {
              ...eurovipsParams.hotelParams,
              cityCode: cityCode,
              hotelName: task.searchTerm,
            },
          }, `invoke EUROVIPS parallel ${task.label}`);

          if (response.error) {
            console.error(`❌ [PARALLEL-SEARCH] EUROVIPS API error for ${task.label}:`, response.error);
            return [];
          }

          const hotels = response.data.results || [];
          console.log(`✅ [PARALLEL-SEARCH] ${task.label}: Received ${hotels.length} hotels`);
          return hotels;
        }),
        3,
      );

      for (const hotels of results) {
        allHotels.push(...hotels);
      }

      console.log(`🔗 [PARALLEL-SEARCH] Total hotels from all searches: ${allHotels.length}`);
    }

    // STEP 3: Deduplication (if we had any searches)
    if (hotelNames.length > 0 || uncoveredChains.length > 0) {
      console.log(`🔗 [COMBINED] Total hotels before deduplication: ${allHotels.length}`);

      const dedupMap = new Map<string, LocalHotelData>();

      for (const hotel of allHotels) {
        const uniqueKey = hotel.hotel_id
          ? `id:${hotel.hotel_id}`
          : `name:${hotel.name.toLowerCase().trim()}`;

        const existing = dedupMap.get(uniqueKey);
        if (!existing) {
          dedupMap.set(uniqueKey, hotel);
          continue;
        }

        if (shouldReplaceDuplicateHotel(existing, hotel)) {
          dedupMap.set(uniqueKey, hotel);
          console.log(`🔁 [DEDUP] Replaced duplicate "${hotel.name}" with preferred broker ${extractBrokerCode(hotel) || 'N/A'}`);
        } else {
          console.log(`🗑️ [DEDUP] Removed duplicate: "${hotel.name}"`);
        }
      }

      allHotels = Array.from(dedupMap.values());
      console.log(`✅ [COMBINED] Total hotels after deduplication: ${allHotels.length}`);

    } else if (hotelChains.length > 0) {
      // MULTI-CHAIN: Make N requests (1 per chain)
      console.log(`🏨 [MULTI-CHAIN] Making ${hotelChains.length} API requests (1 per chain):`, hotelChains);

      const hotelsByChain: Map<string, LocalHotelData[]> = new Map();

      for (const chain of hotelChains) {
        console.log(`📤 [MULTI-CHAIN] Request ${hotelChains.indexOf(chain) + 1}/${hotelChains.length}: Searching hotels for chain "${chain}"`);

        const requestBody = {
          action: 'searchHotels',
          data: {
            ...eurovipsParams.hotelParams,
            cityCode: cityCode,
            hotelName: getSearchTermForChain(chain) // ✅ Filtro por <name> en EUROVIPS (una cadena por request)
          }
        };

        const response = await invokeEurovipsSearch(requestBody, `invoke EUROVIPS chain "${chain}"`);

        if (response.error) {
          console.error(`❌ [MULTI-CHAIN] EUROVIPS API error for chain "${chain}":`, response.error);
          // Continue with other chains instead of throwing
          continue;
        }

        const chainHotels = response.data.results || [];
        console.log(`✅ [MULTI-CHAIN] Chain "${chain}": Received ${chainHotels.length} hotels`);
        hotelsByChain.set(chain, chainHotels);

        allHotels.push(...chainHotels);
      }

      console.log(`🔗 [MULTI-CHAIN] Total hotels before deduplication: ${allHotels.length}`);

      // DEDUPLICATION: Remove duplicate hotels by hotel_id or name+city
      const dedupMap = new Map<string, LocalHotelData>();

      for (const hotel of allHotels) {
        // Use hotel_id if available, otherwise use name+city as unique key
        const uniqueKey = hotel.hotel_id
          ? `id:${hotel.hotel_id}`
          : `name:${hotel.name.toLowerCase().trim()}`;

        const existing = dedupMap.get(uniqueKey);
        if (!existing) {
          dedupMap.set(uniqueKey, hotel);
          continue;
        }

        if (shouldReplaceDuplicateHotel(existing, hotel)) {
          dedupMap.set(uniqueKey, hotel);
          console.log(`🔁 [DEDUP] Replaced duplicate: "${hotel.name}" (key: ${uniqueKey})`);
        } else {
          console.log(`🗑️ [DEDUP] Removed duplicate: "${hotel.name}" (key: ${uniqueKey})`);
        }
      }

      allHotels = Array.from(dedupMap.values());
      console.log(`✅ [MULTI-CHAIN] Total hotels after deduplication: ${allHotels.length}`);

    } else if (hotelName) {
      // SINGLE REQUEST: Filter by hotel name
      console.log(`🏨 [HOTEL SEARCH] Applying name filter to EUROVIPS: "${hotelName}"`);

      const requestBody = {
        action: 'searchHotels',
        data: {
          ...eurovipsParams.hotelParams,
          cityCode: cityCode,
          hotelName: hotelName
        }
      };

      console.log('📤 [HOTEL SEARCH] Step 3: About to call EUROVIPS API (Supabase Edge Function) with name filter');
      console.log('📋 Request body:', requestBody);

      const response = await invokeEurovipsSearch(requestBody, 'invoke EUROVIPS single hotel filter');

      console.log('✅ [HOTEL SEARCH] Step 4: EUROVIPS API response received');
      console.log('📨 Response status:', response.error ? 'ERROR' : 'SUCCESS');

      if (response.error) {
        console.error('❌ [HOTEL SEARCH] EUROVIPS API error:', response.error);
        throw new Error(response.error.message);
      }

      console.log('📊 [HOTEL SEARCH] Raw response data:', response.data);
      allHotels = response.data.results || [];

    } else {
      // NO FILTER: Get all hotels for city
      console.log('🏨 [HOTEL SEARCH] No chain or name filter - searching all hotels');

      const requestBody = {
        action: 'searchHotels',
        data: {
          ...eurovipsParams.hotelParams,
          cityCode: cityCode,
          hotelName: ''
        }
      };

      console.log('📤 [HOTEL SEARCH] Step 3: About to call EUROVIPS API (Supabase Edge Function) without filters');
      console.log('📋 Request body:', requestBody);

      const response = await invokeEurovipsSearch(requestBody, 'invoke EUROVIPS city search');

      console.log('✅ [HOTEL SEARCH] Step 4: EUROVIPS API response received');
      console.log('📨 Response status:', response.error ? 'ERROR' : 'SUCCESS');

      if (response.error) {
        console.error('❌ [HOTEL SEARCH] EUROVIPS API error:', response.error);
        throw new Error(response.error.message);
      }

      console.log('📊 [HOTEL SEARCH] Raw response data:', response.data);
      allHotels = response.data.results || [];
    }

    // 🔍 DEBUG: Log all hotel names received from EUROVIPS
    console.log(`📋 [EUROVIPS RESPONSE] Received ${allHotels.length} hotels:`);
    allHotels.forEach((hotel, index: number) => {
      console.log(`   ${index + 1}. "${hotel.name}"`);
    });

    // ✅ HOTELBEDS PARALLEL SEARCH: Search Hotelbeds and merge results (fail-open)
    try {
      console.log('[HOTELBEDS MERGE] Searching Hotelbeds in parallel...');
      const hotelbedsStart = nowMs();
      const hbResponse = await supabase.functions.invoke('hotelbeds-api', {
        body: {
          action: 'searchHotels',
          data: {
            cityCode: enrichedParsed.hotels?.city || '',
            checkinDate: enrichedParsed.hotels?.checkinDate || '',
            checkoutDate: enrichedParsed.hotels?.checkoutDate || '',
            adults: enrichedParsed.hotels?.adults || 2,
            children: enrichedParsed.hotels?.children || 0,
            childrenAges: enrichedParsed.hotels?.childrenAges || [],
            infants: enrichedParsed.hotels?.infants || 0,
            hotelName: enrichedParsed.hotels?.hotelName || '',
          },
        },
      });
      logTimingStep('HOTEL SEARCH', 'invoke Hotelbeds merge search', hotelbedsStart, {
        hasError: Boolean(hbResponse.error),
        hotels: hbResponse.data?.data?.results?.length || 0,
      });

      if (!hbResponse.error && hbResponse.data?.data?.results) {
        const hbHotels: LocalHotelData[] = hbResponse.data.data.results.map((h: any) => ({
          ...h,
          provider: 'HOTELBEDS' as const,
        }));
        console.log(`[HOTELBEDS MERGE] Received ${hbHotels.length} hotels from Hotelbeds`);

        // Merge: deduplicate by name, keep cheaper option
        const existingNames = new Set(allHotels.map(h => h.name?.toLowerCase().trim()));
        for (const hbHotel of hbHotels) {
          const key = hbHotel.name?.toLowerCase().trim();
          if (existingNames.has(key)) {
            // Find existing and compare price
            const existingIdx = allHotels.findIndex(h => h.name?.toLowerCase().trim() === key);
            if (existingIdx >= 0) {
              const existingMin = Math.min(...allHotels[existingIdx].rooms.map(r => r.total_price));
              const hbMin = Math.min(...hbHotel.rooms.map(r => r.total_price));
              if (hbMin < existingMin) {
                allHotels[existingIdx] = hbHotel;
                console.log(`[HOTELBEDS MERGE] Replaced "${key}" with cheaper Hotelbeds rate`);
              }
            }
          } else {
            allHotels.push(hbHotel);
            existingNames.add(key);
          }
        }
        console.log(`[HOTELBEDS MERGE] Total after merge: ${allHotels.length} hotels`);
      } else {
        console.warn('[HOTELBEDS MERGE] Hotelbeds returned no results or error:', hbResponse.error?.message);
      }
    } catch (hbError) {
      // Fail-open: Hotelbeds failure doesn't block EUROVIPS results
      console.warn('[HOTELBEDS MERGE] Hotelbeds search failed (continuing with EUROVIPS only):', hbError instanceof Error ? hbError.message : hbError);
    }

    // Attach search occupancy to each hotel so downstream components (CombinedTravelSelector, makeBudget) know the passenger mix
    const searchAdults = enrichedParsed.hotels?.adults || 1;
    const searchChildren = enrichedParsed.hotels?.children || 0;
    const searchInfants = enrichedParsed.hotels?.infants || 0;
    const searchChildrenAges = normalizeChildrenAges(enrichedParsed.hotels?.childrenAges, searchChildren);

    allHotels = allHotels.map(hotel => ({
      ...hotel,
      search_adults: searchAdults,
      search_children: searchChildren,
      search_childrenAges: searchChildrenAges,
      search_infants: searchInfants,
    }));

    // Fix hotel dates - EUROVIPS sometimes returns incorrect dates, so we force the correct ones.
    // Also enforce city alignment to avoid mixed-destination UI in a single search.
    const requestedCity = enrichedParsed.hotels?.city || '';
    const normalizedRequestedCity = normalizeText(requestedCity);
    let cityAlignmentFixes = 0;

    const correctedHotels = allHotels.map((hotel) => {
      const normalizedHotelCity = normalizeText(hotel.city || '');
      const cityMatchesRequested =
        !normalizedRequestedCity ||
        !normalizedHotelCity ||
        normalizedHotelCity === normalizedRequestedCity ||
        normalizedHotelCity.includes(normalizedRequestedCity) ||
        normalizedRequestedCity.includes(normalizedHotelCity);

      if (!cityMatchesRequested && requestedCity) {
        cityAlignmentFixes += 1;
      }

      return {
        ...hotel,
        city: !cityMatchesRequested && requestedCity ? requestedCity : hotel.city,
        check_in: enrichedParsed.hotels?.checkinDate || hotel.check_in,
        check_out: enrichedParsed.hotels?.checkoutDate || hotel.check_out,
        nights: hotel.nights // Keep calculated nights
      };
    });

    console.log('🔧 [HOTEL SEARCH] Corrected hotel dates:', {
      original: allHotels[0]?.check_in,
      corrected: correctedHotels[0]?.check_in,
      params: enrichedParsed.hotels?.checkinDate
    });
    if (cityAlignmentFixes > 0) {
      console.log(`🛡️ [HOTEL SEARCH] Enforced city alignment on ${cityAlignmentFixes} hotels: ${requestedCity}`);
    }

    // 🌴 Apply destination-specific filters (e.g., Punta Cana whitelist)
    // IMPORTANT: Pass hotelChains so the filter respects user's chain preference
    let destinationFilteredHotels = applyDestinationSpecificFilters(
      correctedHotels,
      enrichedParsed.hotels?.city || '',
      enrichedParsed.hotels?.hotelChains  // ✅ UPDATED: Pass array of requested chains
    );

    // 🏨 HOTEL CHAIN FILTER - Filter by hotel chains if specified (supports multiple chains)
    if (enrichedParsed.hotels?.hotelChains && enrichedParsed.hotels.hotelChains.length > 0) {
      const chainsFilter = enrichedParsed.hotels.hotelChains;
      console.log(`🏨 [CHAIN FILTER] Filtering hotels by chains: ${chainsFilter.join(', ')}`);
      console.log(`📊 [CHAIN FILTER] Hotels before filter: ${destinationFilteredHotels.length}`);

      destinationFilteredHotels = destinationFilteredHotels.filter(hotel => {
        const belongs = hotelBelongsToAnyChain(hotel.name, chainsFilter);
        if (belongs) {
          console.log(`✅ [CHAIN FILTER] Included: "${hotel.name}" (matches one of: ${chainsFilter.join(', ')})`);
        } else {
          console.log(`🚫 [CHAIN FILTER] Excluded: "${hotel.name}" (does not match any of: ${chainsFilter.join(', ')})`);
        }
        return belongs;
      });

      console.log(`📊 [CHAIN FILTER] Hotels after filter: ${destinationFilteredHotels.length}`);
    }

    // 🏨 HOTEL NAMES FILTER - Filter by specific hotel names if specified (supports multiple)
    // Only apply names filter if we searched ONLY by names (no uncovered chains)
    // If we also searched by chains, don't filter out the chain results
    if (enrichedParsed.hotels?.hotelNames && enrichedParsed.hotels.hotelNames.length > 0 && uncoveredChains.length === 0) {
      const namesFilter = enrichedParsed.hotels.hotelNames;
      console.log(`🏨 [NAMES FILTER] Filtering hotels by specific names: ${namesFilter.join(', ')}`);
      console.log(`📊 [NAMES FILTER] Hotels before filter: ${destinationFilteredHotels.length}`);

      destinationFilteredHotels = destinationFilteredHotels.filter(hotel => {
        const matches = hotelMatchesAnyName(hotel.name, namesFilter);
        if (matches) {
          console.log(`✅ [NAMES FILTER] Included: "${hotel.name}" (matches one of: ${namesFilter.join(', ')})`);
        } else {
          console.log(`🚫 [NAMES FILTER] Excluded: "${hotel.name}" (does not match any of: ${namesFilter.join(', ')})`);
        }
        return matches;
      });

      console.log(`📊 [NAMES FILTER] Hotels after filter: ${destinationFilteredHotels.length}`);
    }

    // 🏨 HOTEL NAME FILTER - Filter by specific hotel name if specified (single, legacy)
    if (enrichedParsed.hotels?.hotelName && !enrichedParsed.hotels?.hotelNames?.length) {
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

    // ✅ FILTER HOTELS BY MEAL PLAN (NOT by capacity - see note below)
    const filterHotelRooms = (hotel: LocalHotelData): LocalHotelData | null => {
      // 🚨 CRITICAL: Do NOT filter by capacity (roomType)
      // Reason: EUROVIPS already validates capacity in the request phase.
      // All returned rooms are guaranteed to accommodate the requested number of adults.
      // Filtering by roomType codes (TPL, DBL, etc.) rejects valid options because:
      //   1. EUROVIPS uses inconsistent room codes (SGL, JSU, SUI, ROO, DBL for 3 adults)
      //   2. "Triple" means CAPACITY (3 people) not CONFIGURATION (3 beds with TPL label)
      //   3. Post-filtering caused "habitación triple" to return 0 results (all 4,136 rooms rejected)
      //      while "habitación 3 adultos" worked fine (no filter applied)
      // See: docs/guides/HOTEL_ROOMTYPE_FILTER_ANALYSIS.md for detailed analysis

      // Cast rooms to expected type since API response may have optional fields
      const filteredRooms = filterRooms(hotel.rooms as Parameters<typeof filterRooms>[0], {
        capacity: undefined,  // Don't filter by capacity - provider already validated
        mealPlan: normalizedMealPlan
      });

      if (filteredRooms.length === 0) {
        console.log(`🚫 [FILTER] Hotel "${hotel.name}" has no rooms matching meal plan criteria (meal plan: ${normalizedMealPlan || 'any'})`);
        return null; // Skip hotel entirely
      }

      console.log(`✅ [FILTER] Hotel "${hotel.name}": ${hotel.rooms.length} → ${filteredRooms.length} rooms after meal plan filtering`);

      // Return hotel with filtered rooms
      return {
        ...hotel,
        rooms: filteredRooms
      };
    };

    // Apply filter and remove null hotels
    let filteredHotels = destinationFilteredHotels
      .map(filterHotelRooms)
      .filter((hotel): hotel is LocalHotelData => hotel !== null);

    let relaxedHotelFiltersApplied = false;
    let forcedHotelResultFallback = false;

    console.log(`📊 [FILTER] Hotels: ${destinationFilteredHotels.length} → ${filteredHotels.length} (after meal plan filtering)`);

    // Hard gate: if filtering removed everything but provider returned hotels, relax filters to keep results.
    if (filteredHotels.length === 0 && destinationFilteredHotels.length > 0) {
      filteredHotels = destinationFilteredHotels.filter((hotel) => (hotel.rooms?.length || 0) > 0);
      relaxedHotelFiltersApplied = true;
      console.log(`🛟 [HOTEL SEARCH] Relaxed meal/room filters to avoid zero-results: ${filteredHotels.length} hotels`);
    }

    if (filteredHotels.length === 0 && correctedHotels.length > 0) {
      filteredHotels = correctedHotels.filter((hotel) => (hotel.rooms?.length || 0) > 0);
      forcedHotelResultFallback = true;
      console.log(`🛟 [HOTEL SEARCH] Applied provider-level fallback to avoid zero-results: ${filteredHotels.length} hotels`);
    }

    // Sort hotels by lowest price (minimum room price)
    const sortedHotels = filteredHotels.sort((a: LocalHotelData, b: LocalHotelData) => {
      const minPriceA = Math.min(...a.rooms.map(r => r.total_price));
      const minPriceB = Math.min(...b.rooms.map(r => r.total_price));
      return minPriceA - minPriceB;
    });

    // 🎯 MULTI-CHAIN INTERLEAVING: If multiple chains requested, mix results evenly
    let hotels: LocalHotelData[];
    let chainBalance: LocalHotelChainBalance | undefined;
    const requestedChains = enrichedParsed.hotels?.hotelChains;

    if (requestedChains && requestedChains.length > 1) {
      console.log(`⚖️ [CHAIN BALANCE] Multiple chains requested (${requestedChains.length}): ${requestedChains.join(', ')}`);
      const balancedSelection = selectHotelsWithStrictChainBalance(sortedHotels, requestedChains, 5);
      hotels = balancedSelection.hotels;
      chainBalance = balancedSelection.chainBalance;
      chainBalance.quotas.forEach((quota) => {
        console.log(`  ⚖️ ${quota.chain}: quota ${quota.requestedQuota}, available ${quota.availableHotels}, selected ${quota.selectedHotels}, status ${quota.status}`);
      });

      // 🔀 Interleave hotels by chain for equitable display order
      const hotelsByMatchedChain = new Map<string, LocalHotelData[]>();
      const chainOrder: string[] = [];
      for (const hotel of hotels) {
        const matchedChain = requestedChains.find((c) => hotelBelongsToChain(hotel.name, c)) || '__other__';
        if (!hotelsByMatchedChain.has(matchedChain)) {
          hotelsByMatchedChain.set(matchedChain, []);
          chainOrder.push(matchedChain);
        }
        hotelsByMatchedChain.get(matchedChain)!.push(hotel);
      }

      if (chainOrder.length > 1) {
        const interleaved: LocalHotelData[] = [];
        const iterators = chainOrder.map((chain) => ({ chain, index: 0 }));
        while (interleaved.length < hotels.length) {
          let addedThisRound = false;
          for (const it of iterators) {
            const chainHotels = hotelsByMatchedChain.get(it.chain)!;
            if (it.index < chainHotels.length) {
              interleaved.push(chainHotels[it.index]);
              it.index++;
              addedThisRound = true;
            }
          }
          if (!addedThisRound) break;
        }
        hotels = interleaved;
        console.log(`🔀 [CHAIN INTERLEAVE] Reordered ${hotels.length} hotels: ${hotels.map(h => h.name).join(' → ')}`);
      }
    } else {
      // Single chain or no chain filter: just take top 5 by price
      hotels = sortedHotels.slice(0, 5);
    }

    // 📦 Save ALL hotels to IndexedDB for dynamic filtering in UI
    const hotelSearchId = generateHotelSearchId({
      destination: enrichedParsed.hotels?.city || enrichedParsed.flights?.destination,
      checkIn: enrichedParsed.hotels?.checkinDate,
      checkOut: enrichedParsed.hotels?.checkoutDate,
    });

    // Save all sorted hotels (before the slice) for dynamic filtering
    await saveHotelsToStorage(hotelSearchId, sortedHotels, {
      destination: enrichedParsed.hotels?.city || enrichedParsed.flights?.destination,
      checkIn: enrichedParsed.hotels?.checkinDate,
      checkOut: enrichedParsed.hotels?.checkoutDate,
    });
    console.log(`📦 [HOTEL SEARCH] Saved ${sortedHotels.length} hotels to IndexedDB with searchId: ${hotelSearchId}`);

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
    const formattedResponse = `${formatHotelResponse(hotels)}${chainBalance ? `\n\n${formatChainBalanceNote(chainBalance)}` : ''}`;

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
      }),
      ...(relaxedHotelFiltersApplied && {
        relaxed_hotel_filters_applied: true
      }),
      ...(forcedHotelResultFallback && {
        forced_hotel_result_fallback: true
      }),
      ...(chainBalance && {
        chain_balance: chainBalance
      })
    };

    const result = {
      response: formattedResponse,
      data: {
        eurovipsData: { hotels },
        combinedData: {
          flights: [],
          hotels, // ✅ Now contains ONLY hotels with matching rooms (Top 5)
          chainBalance,
          requestType: 'hotels-only' as const,
          requestedRoomType: normalizedRoomType,
          requestedMealPlan: normalizedMealPlan,
          hotelSearchId, // 🔑 Key to retrieve ALL hotels from IndexedDB
        },
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      }
    };

    console.log('🎉 [HOTEL SEARCH] Hotel search completed successfully');
    console.log('📋 Final result:', result);
    timer.end('total', {
      city: enrichedParsed.hotels?.city,
      hotels: hotels.length,
      totalProviderHotels: allHotels.length,
    });

    return result;
  } catch (error) {
    timer.fail('failed', error, {
      city: parsed.hotels?.city || parsed.flights?.destination,
    });
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

    const allPackages: LocalPackageData[] = response.data.results || [];
    // Sort packages by price (lowest first) and limit to 5
    const packages = allPackages
      .sort((a, b) => (a.price || 0) - (b.price || 0))
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

    const allServices: LocalServiceData[] = response.data.results || [];
    // Sort services by price (lowest first) and limit to 5
    const services = allServices
      .sort((a, b) => (a.price || 0) - (b.price || 0))
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
    const totalChildren = (parsed.hotels?.children || parsed.flights?.children || 0)
      + (parsed.hotels?.infants || parsed.flights?.infants || 0);
    const adultsExplicit = parsed.hotels?.adultsExplicit || parsed.flights?.adultsExplicit || false;

    if (inferredAdults === 1 && totalChildren === 0 && roomType && !adultsExplicit) {
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
    } else if (adultsExplicit && inferredAdults > 0) {
      console.log(`🧷 [COMBINED ADULTS INFERENCE] Keeping explicit adults=${inferredAdults} despite roomType=${roomType || 'none'}`);
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

    // Do not force hotel dates to match flight dates here.
    // `handleHotelSearch` already applies flight fallback for simple combined requests
    // when hotel dates are missing, and multi-segment hotel searches must preserve
    // their own explicit tramo dates.

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
      hotelSegments: hotelResult.data?.combinedData?.hotelSegments,
      requestType: 'combined' as const,
      requestedRoomType: hotelResult.data?.combinedData?.requestedRoomType,
      requestedMealPlan: hotelResult.data?.combinedData?.requestedMealPlan,
      flightSearchId: flightResult.data?.combinedData?.flightSearchId, // Pass through for localStorage lookup
      hotelSearchId: hotelResult.data?.combinedData?.hotelSearchId, // Pass through for IndexedDB lookup (hotel filter chips)
      hotelSearchIds: hotelResult.data?.combinedData?.hotelSearchIds,
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

export const handleItineraryRequest = async (
  parsed: ParsedTravelRequest,
  existingPlannerState?: TripPlannerState | null
): Promise<SearchResult> => {
  console.log('🗺️ [ITINERARY] Starting itinerary generation process');
  console.log('📋 Parsed request:', parsed);
  const timer = createDebugTimer('ITINERARY', {
    destinations: parsed.itinerary?.destinations?.length || 0,
    days: parsed.itinerary?.days,
    hasExistingPlanner: Boolean(existingPlannerState),
  });

  try {
    const itinerary = parsed.itinerary || {};
    const {
      destinations,
      days,
      startDate,
      endDate,
      isFlexibleDates,
      flexibleMonth,
      flexibleYear,
      budgetLevel,
      budgetAmount,
      interests,
      pace,
      travelers,
      constraints,
      hotelCategory,
      editIntent
    } = itinerary;
    const hasExactDates = hasExactItineraryDateRange(itinerary);
    const hasFlexibleDates = hasFlexibleItineraryDateSelection(itinerary);

    if (!hasUsableItineraryDates(itinerary)) {
      timer.end('stopped - missing usable dates', {
        hasExactDates,
        hasFlexibleDates,
      });
      return {
        response: generateMissingInfoMessage(['fechas exactas del viaje'], 'itinerary', {
          itinerary,
          originalMessage: parsed.originalMessage || ''
        }),
        data: null
      };
    }

    const resolvedDates = resolveItineraryDateRange(itinerary, parsed.originalMessage || '');
    const effectiveStartDate = resolvedDates.startDate || startDate;
    const effectiveEndDate = resolvedDates.endDate || endDate;
    const exactRangeDays = hasExactDates
      ? getInclusiveDateRangeDays(effectiveStartDate, effectiveEndDate)
      : undefined;

    const derivedDays = exactRangeDays || days || (
      effectiveStartDate && effectiveEndDate
        ? Math.max(1, Math.round((new Date(effectiveEndDate).getTime() - new Date(effectiveStartDate).getTime()) / 86400000) + 1)
        : undefined
    );

    if (
      !destinations ||
      destinations.length === 0 ||
      !derivedDays ||
      derivedDays < 1 ||
      (!hasExactDates && !hasFlexibleDates)
    ) {
      console.warn('⚠️ [ITINERARY] Missing required fields');
      timer.end('stopped - missing required fields', {
        hasDestinations: Boolean(destinations?.length),
        derivedDays,
        hasExactDates,
        hasFlexibleDates,
      });
      return {
        response: generateMissingInfoMessage(['destino(s)', 'fechas exactas del viaje'], 'itinerary', {
          itinerary,
          originalMessage: parsed.originalMessage || ''
        }),
        data: null
      };
    }

    console.log(`🔄 [ITINERARY] Generating itinerary for ${destinations.join(', ')} - ${derivedDays} days`);

    // Call the travel-itinerary Edge Function
    const invokeStart = nowMs();
    const response = await supabase.functions.invoke('travel-itinerary', {
      body: {
        destinations,
        days: derivedDays,
        startDate: hasExactDates ? effectiveStartDate : undefined,
        endDate: hasExactDates ? effectiveEndDate : undefined,
        isFlexibleDates,
        flexibleMonth,
        flexibleYear,
        budgetLevel,
        budgetAmount,
        interests,
        pace,
        travelers,
        constraints,
        hotelCategory,
        generationMode: editIntent ? 'full' : 'skeleton',
        editIntent,
        existingPlannerState
      }
    });
    logTimingStep('ITINERARY', 'invoke travel-itinerary', invokeStart, {
      hasError: Boolean(response.error),
      destinations: destinations.length,
      days: derivedDays,
    });

    if (response.error) {
      console.error('❌ [ITINERARY] Edge Function error:', response.error);
      throw new Error(response.error.message);
    }

    if (response.data?.timing) {
      console.log('⏱️ [ITINERARY BACKEND TIMING]', response.data.timing);
    }

    const itineraryData = response.data?.data;

    if (!itineraryData || (!itineraryData.itinerary && !itineraryData.segments)) {
      console.error('❌ [ITINERARY] Invalid response from Edge Function');
      throw new Error('Invalid itinerary response');
    }

    console.log('✅ [ITINERARY] Itinerary generated successfully');
    console.log(`📊 [ITINERARY] Generated ${itineraryData.itinerary?.length || itineraryData.days || 0} days`);

    const normalizeStart = nowMs();
    const plannerData = normalizePlannerState({
      ...itineraryData,
      startDate: hasExactDates ? (itineraryData.startDate || effectiveStartDate) : undefined,
      endDate: hasExactDates ? (itineraryData.endDate || effectiveEndDate) : undefined,
      isFlexibleDates: itineraryData.isFlexibleDates ?? isFlexibleDates,
      flexibleMonth: itineraryData.flexibleMonth || flexibleMonth,
      flexibleYear: itineraryData.flexibleYear || flexibleYear,
      budgetLevel: itineraryData.budgetLevel || budgetLevel,
      budgetAmount: itineraryData.budgetAmount || budgetAmount,
      interests: itineraryData.interests || interests,
      pace: itineraryData.pace || pace,
      travelers: itineraryData.travelers || travelers,
      constraints: itineraryData.constraints || constraints,
      generationMeta: {
        source: editIntent?.action === 'regenerate_day'
          ? 'regen_day'
          : editIntent?.action === 'regenerate_segment'
            ? 'regen_segment'
            : existingPlannerState
              ? 'regen_plan'
              : 'chat',
        updatedAt: new Date().toISOString(),
        version: (existingPlannerState?.generationMeta?.version || 0) + 1,
      },
    });
    logTimingStep('ITINERARY', 'normalizePlannerState', normalizeStart, {
      segments: plannerData.segments.length,
      days: plannerData.days,
    });

    // Format the response
    const summarizeStart = nowMs();
    const formattedResponse = summarizePlannerForChat(plannerData);
    logTimingStep('ITINERARY', 'summarizePlannerForChat', summarizeStart, {
      segments: plannerData.segments.length,
    });

    const result = {
      response: formattedResponse,
      data: {
        itineraryData,
        plannerData,
        messageType: 'trip_planner'
      }
    };

    console.log('🎉 [ITINERARY] Itinerary generation completed successfully');
    timer.end('total', {
      segments: plannerData.segments.length,
      days: plannerData.days,
    });

    return result;
  } catch (error) {
    timer.fail('failed', error, {
      destinations: parsed.itinerary?.destinations?.length || 0,
    });
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

// ✨ Helper functions for time filtering
function getFirstDepartureTime(flight: FlightData): number {
  const firstLeg = flight.legs[0];
  const firstSegment = firstLeg?.options?.[0]?.segments?.[0];
  return timeStringToNumber(firstSegment?.departure?.time || '');
}

function getLastArrivalTime(flight: FlightData): number {
  const lastLeg = flight.legs[flight.legs.length - 1];
  const lastOption = lastLeg?.options?.[0];
  const segments = lastOption?.segments || [];
  const lastSegment = segments[segments.length - 1];
  return timeStringToNumber(lastSegment?.arrival?.time || '');
}
