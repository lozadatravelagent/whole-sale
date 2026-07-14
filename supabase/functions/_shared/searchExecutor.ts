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
import { getNormalizedFlightSegments, normalizeFlightRequest } from './flightSegments.ts';
import { selectDistinctPriceFlights } from './flightSelection.ts';
import { isDelfosSearchEnabled } from './providers/flags.ts';
import { mergeFlights, normalizeFlightAirlines } from './providers/mergeFlights.ts';
import { mergeHotels } from './providers/mergeHotels.ts';
import type { ProviderErrorEntry, TravelSearchProvider } from './providers/types.ts';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const PROVIDER_TIMEOUT_MS = 45000; // 45 seconds
const EUROVIPS_ASYNC_POLL_INTERVAL_MS = 2000;
const EUROVIPS_ASYNC_MAX_WAIT_MS = 120000;
const HOTEL_CHAIN_ASYNC_THRESHOLD = 3;
const HOTEL_CHAIN_CONCURRENCY_LIMIT = 2;
const HOTEL_CHAIN_MAX_COUNT = 4;
const HOTEL_RESULT_CURRENCY = 'USD';
const HOTEL_CHAIN_SEARCH_TERMS: Record<string, string> = {
  riu: 'RIU',
  iberostar: 'Iberostar',
  melia: 'Melia',
  bahia_principe: 'Bahia Principe',
  bahia: 'Bahia Principe',
  barcelo: 'Barcelo',
  occidental: 'Occidental',
  nh: 'NH',
  hilton: 'Hilton',
  marriott: 'Marriott',
  hyatt: 'Hyatt',
  accor: 'Accor',
  sunscape: 'Sunscape',
  hard_rock: 'Hard Rock',
  excellence: 'Excellence',
  secrets: 'Secrets',
  dreams: 'Dreams',
  lopesan: 'Lopesan',
  viva: 'Viva',
};

const HOTEL_CHAIN_MATCHERS: Record<string, string[]> = {
  barcelo: ['barcelo', 'occidental'],
  bahia_principe: ['bahia principe', 'bahia', 'grand bahia'],
  bahia: ['bahia principe', 'bahia', 'grand bahia'],
  melia: ['melia', 'sol melia', 'zel'],
  riu: ['riu'],
  iberostar: ['iberostar', 'ibero star'],
};

function normalizeHotelCurrencyUsd(hotel: any): any {
  return {
    ...hotel,
    currency: HOTEL_RESULT_CURRENCY,
    rooms: Array.isArray(hotel?.rooms)
      ? hotel.rooms.map((room: any) => ({
        ...room,
        currency: HOTEL_RESULT_CURRENCY
      }))
      : hotel?.rooms
  };
}

function normalizeHotelText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeHotelChains(hotels: any): string[] {
  const values = [
    ...(Array.isArray(hotels?.hotelChains) ? hotels.hotelChains : []),
    hotels?.hotelChain,
  ];
  const seen = new Set<string>();
  const chains: string[] = [];

  for (const value of values) {
    const chain = typeof value === 'string' ? value.trim() : '';
    if (!chain) continue;

    const key = normalizeHotelText(chain);
    if (seen.has(key)) continue;

    seen.add(key);
    chains.push(chain);
  }

  if (chains.length > HOTEL_CHAIN_MAX_COUNT) {
    console.warn(`[HOTEL_SEARCH] Limiting ${chains.length} requested chains to ${HOTEL_CHAIN_MAX_COUNT} to stay within the turn deadline`);
  }
  return chains.slice(0, HOTEL_CHAIN_MAX_COUNT);
}

function getSearchTermForChain(chain: string): string {
  const normalized = normalizeHotelText(chain).replace(/\s+/g, '_');
  return HOTEL_CHAIN_SEARCH_TERMS[normalized] || HOTEL_CHAIN_SEARCH_TERMS[normalizeHotelText(chain)] || chain;
}

function getChainMatchers(chain: string): string[] {
  const normalized = normalizeHotelText(chain).replace(/\s+/g, '_');
  const explicitMatchers = HOTEL_CHAIN_MATCHERS[normalized] || HOTEL_CHAIN_MATCHERS[normalizeHotelText(chain)] || [];
  return [
    chain,
    getSearchTermForChain(chain),
    ...explicitMatchers,
  ]
    .map(normalizeHotelText)
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function hotelMatchesRequestedChain(hotel: any, chain: string): boolean {
  const hotelName = normalizeHotelText(hotel?.name);
  if (!hotelName) return false;
  return getChainMatchers(chain).some((matcher) => hotelName.includes(matcher));
}

function filterHotelsByRequestedChains(hotels: any[], chains: string[]): any[] {
  if (chains.length === 0) return hotels;
  const filtered = hotels.filter((hotel) => chains.some((chain) => hotelMatchesRequestedChain(hotel, chain)));

  if (filtered.length === 0 && hotels.length > 0) {
    console.warn('[HOTEL_SEARCH] Chain post-filter removed all hotels; returning provider results to avoid false empty search');
    return hotels;
  }

  return filtered;
}

function interleaveHotelsByChain(hotels: any[], chains: string[]): any[] {
  if (chains.length <= 1) return hotels;

  const byChain = new Map<string, any[]>();
  const unassigned: any[] = [];
  chains.forEach((chain) => byChain.set(normalizeHotelText(chain), []));

  for (const hotel of hotels) {
    const chain = chains.find((candidate) => hotelMatchesRequestedChain(hotel, candidate));
    if (chain) {
      byChain.get(normalizeHotelText(chain))!.push(hotel);
    } else {
      unassigned.push(hotel);
    }
  }

  const result: any[] = [];
  let round = 0;
  while (result.length < hotels.length) {
    let added = false;
    for (const chain of chains) {
      const group = byChain.get(normalizeHotelText(chain)) || [];
      if (round < group.length) {
        result.push(group[round]);
        added = true;
      }
    }
    if (!added) break;
    round++;
  }

  return [...result, ...unassigned];
}

function getMinRoomPrice(hotel: any): number {
  if (!Array.isArray(hotel?.rooms) || hotel.rooms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...hotel.rooms.map((room: any) => room?.total_price || Number.POSITIVE_INFINITY));
}

function extractBrokerCode(hotel: any): string {
  const uniqueId = typeof hotel?.unique_id === 'string' ? hotel.unique_id : '';
  if (uniqueId.includes('|')) return uniqueId.split('|')[0].toUpperCase();

  const firstRoom = Array.isArray(hotel?.rooms) ? hotel.rooms[0] : undefined;
  const fareIdBroker = typeof firstRoom?.fare_id_broker === 'string' ? firstRoom.fare_id_broker : '';
  if (fareIdBroker.includes('|')) return fareIdBroker.split('|')[0].toUpperCase();

  return '';
}

function shouldReplaceDuplicateHotel(existing: any, candidate: any): boolean {
  const existingBroker = extractBrokerCode(existing);
  const candidateBroker = extractBrokerCode(candidate);

  if (existingBroker !== 'AP' && candidateBroker === 'AP') return true;
  if (existingBroker === 'AP' && candidateBroker !== 'AP') return false;

  return getMinRoomPrice(candidate) < getMinRoomPrice(existing);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createJobId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workerCount = Math.min(Math.max(limit, 1), tasks.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

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

async function pollEurovipsJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
): Promise<any> {
  const deadline = Date.now() + EUROVIPS_ASYNC_MAX_WAIT_MS;
  let lastStatus = '';

  while (Date.now() < deadline) {
    await sleep(EUROVIPS_ASYNC_POLL_INTERVAL_MS);

    const { data, error } = await supabase
      .from('search_jobs')
      .select('status, results, error, completed_at')
      .eq('id', jobId)
      .maybeSingle();

    if (error) {
      console.warn(`[EUROVIPS_ASYNC] Poll failed for job ${jobId}:`, error.message);
      continue;
    }
    const jobRow = data as {
      status?: string | null;
      results?: unknown;
      error?: string | null;
      completed_at?: string | null;
    } | null;

    if (!jobRow) continue;

    const status = String(jobRow.status || '');
    if (status !== lastStatus) {
      console.log(`[EUROVIPS_ASYNC] Job ${jobId} status: ${status}`);
      lastStatus = status;
    }

    if (status === 'completed') {
      return {
        success: true,
        action: 'searchHotels',
        results: jobRow.results || [],
        jobId,
        cached: false,
        provider: 'EUROVIPS',
        timestamp: jobRow.completed_at || new Date().toISOString(),
      };
    }

    if (status === 'failed') {
      throw new Error(jobRow.error || `EUROVIPS async job ${jobId} failed`);
    }
  }

  throw new Error(`EUROVIPS async job ${jobId} timed out after ${EUROVIPS_ASYNC_MAX_WAIT_MS}ms`);
}

/**
 * Search flights via Delfos edge adapter (canonical items).
 * Returns empty + skip on UNSUPPORTED_ITINERARY so multi-city stays Starling-only.
 */
async function searchDelfosFlights(
  supabase: ReturnType<typeof createClient>,
  normalizedFlights: any,
  flightSegments: Array<{ origin: string; destination: string; departureDate: string }>,
): Promise<{ items: any[]; skipped?: boolean; error?: string }> {
  const segments = flightSegments.map((segment) => {
    const { originCode, destinationCode } = resolveFlightCodes(segment.origin, segment.destination);
    return {
      origin: originCode,
      destination: destinationCode,
      departureDate: segment.departureDate,
    };
  });

  try {
    const response = await invokeWithTimeout<any>(supabase, 'delfos-api', {
      action: 'searchFlights',
      data: {
        segments,
        adults: normalizedFlights?.adults || 1,
        children: normalizedFlights?.children || 0,
        infants: normalizedFlights?.infants || 0,
        tripType: normalizedFlights?.tripType,
        maxResults: 20,
      },
    });

    if (response?.skipped || response?.code === 'UNSUPPORTED_ITINERARY') {
      return { items: [], skipped: true };
    }
    if (response?.success === false) {
      return { items: [], error: response.detail || response.error || 'Delfos flight search failed' };
    }
    const items = Array.isArray(response?.results) ? response.results : [];
    return { items: items.map((f: any) => ({ ...f, provider: f.provider || 'DELFOS' })) };
  } catch (error: any) {
    return { items: [], error: error?.message || String(error) };
  }
}

async function searchDelfosHotels(
  supabase: ReturnType<typeof createClient>,
  hotels: any,
  adults: number,
  childrenAges: number[],
): Promise<{ items: any[]; error?: string }> {
  try {
    const response = await invokeWithTimeout<any>(supabase, 'delfos-api', {
      action: 'searchHotels',
      data: {
        checkIn: hotels.checkinDate,
        checkOut: hotels.checkoutDate,
        adults,
        children: hotels.children || 0,
        infants: hotels.infants || 0,
        childrenAges,
        city: hotels.city,
      },
    });

    if (response?.success === false) {
      return { items: [], error: response.detail || response.error || 'Delfos hotel search failed' };
    }
    const items = Array.isArray(response?.results) ? response.results : [];
    return {
      items: items.map((h: any) => ({
        ...h,
        provider: h.provider || 'DELFOS',
        city: h.city || hotels.city || '',
      })),
    };
  } catch (error: any) {
    return { items: [], error: error?.message || String(error) };
  }
}

async function invokeEurovipsSearch(
  supabase: ReturnType<typeof createClient>,
  body: { action: string; data: Record<string, unknown> },
  useAsync: boolean,
): Promise<any> {
  if (!useAsync) {
    return await invokeWithTimeout<any>(supabase, 'eurovips-soap', body);
  }

  const jobId = createJobId();
  console.log(`[EUROVIPS_ASYNC] Dispatching ${body.action} as job ${jobId}`);

  const dispatch = await supabase.functions.invoke('eurovips-soap', {
    body: {
      ...body,
      jobId,
    },
  });

  if (dispatch.error) {
    throw new Error(dispatch.error.message || 'EUROVIPS async dispatch failed');
  }

  const payload = dispatch.data as any;
  if (payload?.success === false) {
    throw new Error(payload.detail || payload.error || 'EUROVIPS async dispatch failed');
  }

  if (!payload?.async) {
    console.log(`[EUROVIPS_ASYNC] ${body.action} answered synchronously for job ${jobId}`);
    return payload;
  }

  return await pollEurovipsJob(supabase, jobId);
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

function normalizeChildrenAges(childrenAges: unknown, childrenCount: number): number[] {
  if (!childrenCount || childrenCount <= 0) return [];
  if (!Array.isArray(childrenAges)) return Array.from({ length: childrenCount }, () => 8);

  const validAges = childrenAges
    .filter((age) => typeof age === 'number' && Number.isFinite(age) && age > 0)
    .map((age) => Math.round(age));

  const normalized = validAges.slice(0, childrenCount);
  while (normalized.length < childrenCount) {
    normalized.push(8);
  }
  return normalized;
}

function resolveAdultsWithExplicitGuard(
  hotels: any,
  flights?: any
): number {
  const explicitAdults = hotels?.adults ?? flights?.adults ?? 1;
  const adultsExplicit = Boolean(hotels?.adultsExplicit || flights?.adultsExplicit);
  const roomType = hotels?.roomType;
  const totalChildren = (hotels?.children ?? flights?.children ?? 0) +
    (hotels?.infants ?? flights?.infants ?? 0);

  if (adultsExplicit && explicitAdults > 0) {
    return explicitAdults;
  }

  if (explicitAdults !== 1 || totalChildren > 0 || !roomType) {
    return explicitAdults;
  }

  return inferAdultsFromRoomType(explicitAdults, roomType);
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

    case 'activities':
      return await executeActivitySearch(parsedRequest, supabase);

    case 'transfers':
      return await executeTransferSearch(parsedRequest, supabase);

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
  const normalizedFlights = normalizeFlightRequest(flights);
  const flightSegments = getNormalizedFlightSegments(normalizedFlights);

  // ✅ REGLA DE NEGOCIO: Convertir nombres de ciudades a códigos IATA
  // Usa la misma lógica que el chat interno (src/services/cityCodeService.ts)
  // Buenos Aires: EZE para vuelos internacionales, AEP para domésticos
  console.log('[FLIGHT_SEARCH] Converting city names to IATA codes...');
  console.log(`   Trip type: "${normalizedFlights?.tripType || 'one_way'}"`);

  const providersSearched: TravelSearchProvider[] = ['STARLING'];
  const providersSucceeded: TravelSearchProvider[] = [];
  const providerErrors: ProviderErrorEntry[] = [];
  const delfosEnabled = isDelfosSearchEnabled();
  if (delfosEnabled) providersSearched.push('DELFOS');
  // Kick Delfos in parallel with Starling (ADR-003 fan-out)
  const delfosPromise = delfosEnabled
    ? searchDelfosFlights(supabase, normalizedFlights, flightSegments)
    : Promise.resolve({ items: [] as any[], skipped: true as boolean | undefined, error: undefined as string | undefined });

  // Build Starling API request - passengers
  const passengers: Array<{ Count: number; Type: string }> = [];

  // Add adults
  if ((normalizedFlights?.adults || 1) > 0) {
    passengers.push({
      Count: normalizedFlights.adults || 1,
      Type: 'ADT'
    });
  }

  // Add children if present
  if (normalizedFlights?.children && normalizedFlights.children > 0) {
    passengers.push({
      Count: normalizedFlights.children,
      Type: 'CHD'
    });
  }

  const starlingRequest: any = {
    Passengers: passengers,
    Legs: []
  };

  for (const segment of flightSegments) {
    const { originCode, destinationCode } = resolveFlightCodes(
      segment.origin,
      segment.destination
    );

    console.log('[FLIGHT_SEARCH] IATA codes resolved:');
    console.log(`   "${segment.origin}" → ${originCode}`);
    console.log(`   "${segment.destination}" → ${destinationCode}`);

    starlingRequest.Legs.push({
      DepartureAirportCity: originCode,
      ArrivalAirportCity: destinationCode,
      FlightDate: segment.departureDate
    });
  }

  // Add airline filter if specified
  if (normalizedFlights?.preferredAirline) {
    starlingRequest.Airlines = [normalizedFlights.preferredAirline];
  }

  console.log('[FLIGHT_SEARCH] Starling request:', JSON.stringify(starlingRequest, null, 2));

  console.log('[FLIGHT_SEARCH] Calling starling-flights Edge Function');

  // Call starling-flights Edge Function with timeout
  let response;
  let starlingHardError: string | null = null;
  try {
    response = await invokeWithTimeout(supabase, 'starling-flights', {
      action: 'searchFlights',
      data: starlingRequest
    });
  } catch (error) {
    console.error('[FLIGHT_SEARCH] Starling API error:', error);
    starlingHardError = error.message || 'Flight search failed';
    providerErrors.push({ provider: 'STARLING', message: starlingHardError });
    response = null;
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

  const tvcResponse = response ? (response.data || response) : null;

  // Extract fares from TVC response (Fares or Recommendations depending on API version)
  const rawFares = tvcResponse?.Fares || tvcResponse?.Recommendations || [];

  console.log('[FLIGHT_SEARCH] TVC Response received:', {
    success: response?.success,
    hasFares: !!tvcResponse?.Fares,
    hasRecommendations: !!tvcResponse?.Recommendations,
    faresCount: rawFares?.length || 0,
    transactionId: tvcResponse?.TransactionID,
    starlingHardError,
  });

  // Transform TVC fares to our standard flight format (empty if Starling failed / no fares)
  let flights_results = (rawFares || []).map((fare: any, index: number) => {
    const legs = fare.Legs || [];
    const firstLeg = legs[0] || {};
    const firstOption = firstLeg.Options?.[0] || {};
    const firstSegment = firstOption.Segments?.[0] || {};
    const lastSegment = firstOption.Segments?.[firstOption.Segments?.length - 1] || firstSegment;

    // Get return date if round trip
    const isRoundTrip = normalizedFlights?.tripType === 'round_trip';
    let returnDate = null;
    if (isRoundTrip && legs.length > 1) {
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
      adults: normalizedFlights?.adults || 1,
      children: normalizedFlights?.children || 0,
      departure_date: firstSegment.Departure?.Date || normalizedFlights?.departureDate,
      departure_time: firstSegment.Departure?.Time || '',
      arrival_date: lastSegment.Arrival?.Date || '',
      arrival_time: lastSegment.Arrival?.Time || '',
      return_date: returnDate,
      trip_type: normalizedFlights?.tripType,
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
      provider: 'STARLING',
      transactionId: tvcResponse?.TransactionID || ''
    };
  });

  if (flights_results.length > 0) {
    providersSucceeded.push('STARLING');
  } else if (!starlingHardError) {
    console.log('[FLIGHT_SEARCH] No fares found in TVC response');
  }

  console.log('[FLIGHT_SEARCH] Transformed', flights_results.length, 'flights from TVC');

  // Merge Delfos inventory when enabled (partial failure OK)
  const delfosResult = await delfosPromise;
  if (delfosEnabled && !delfosResult.skipped) {
    if (delfosResult.error) {
      providerErrors.push({ provider: 'DELFOS', message: delfosResult.error });
      console.warn('[FLIGHT_SEARCH] Delfos error:', delfosResult.error);
    } else {
      if (delfosResult.items.length > 0) providersSucceeded.push('DELFOS');
      console.log('[FLIGHT_SEARCH] Delfos returned', delfosResult.items.length, 'flights');
      flights_results = mergeFlights([flights_results, delfosResult.items]);
      console.log('[FLIGHT_SEARCH] Merged flights total:', flights_results.length);
    }
  }

  flights_results = normalizeFlightAirlines(flights_results);

  if (flights_results.length === 0 && starlingHardError && providersSucceeded.length === 0) {
    return {
      status: 'error',
      type: 'flights',
      error: {
        message: starlingHardError,
        details: { provider_errors: providerErrors },
      },
      metadata: {
        providers_searched: providersSearched,
        providers_succeeded: providersSucceeded,
        provider_errors: providerErrors,
      },
    };
  }

  // ✅ CRITICAL FIX: Filter by maxLayoverHours if specified (mirrors chat internal logic)
  // This ensures API searches respect layover duration constraints just like internal chat
  let excludedByLayover = 0;

  if (normalizedFlights?.maxLayoverHours) {
    const maxLayover = normalizedFlights.maxLayoverHours;
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
  const userRequestedCarryOn = normalizedFlights?.luggage === 'carry_on';

  if (userRequestedCarryOn) {
    console.log('🧳 [LIGHT FARE FILTER] User requested carry_on, filtering light fares');

    const beforeFilter = flights_results.length;

    flights_results = flights_results.filter((flight: any) => {
      // Extract airline code from flight data
      const airlineCode = flight.airline?.code || flight.airlineCode;

      if (shouldExcludeLightFare(airlineCode, normalizedFlights?.luggage)) {
        console.log(`🚫 [LIGHT FARE] Excluded flight from ${airlineCode} (light fare airline)`);
        lightFaresExcluded++;
        return false;
      }

      return true;
    });

    console.log(`📊 [LIGHT FARE FILTER] Flights: ${beforeFilter} → ${flights_results.length} (excluded: ${lightFaresExcluded})`);
  }

  // ✅ STEP 2: One flight per distinct price (fewest escalas on ties), all distinct prices — no cap
  const finalFlights = selectDistinctPriceFlights(flights_results);

  console.log('[FLIGHT_SEARCH] Final result:', finalFlights.length, 'flights');

  // ✅ STEP 3: Build extended metadata
  const metadata: any = {};

  // Add layover filter metadata if applied
  if (normalizedFlights?.maxLayoverHours) {
    metadata.layover_filter_applied = {
      max_hours: normalizedFlights.maxLayoverHours,
      excluded_count: excludedByLayover
    };
  }

  // Add light fare filter metadata if applied
  if (userRequestedCarryOn) {
    metadata.light_fares_excluded = lightFaresExcluded;
    metadata.light_fare_airlines = getLightFareAirlines();
  }

  metadata.providers_searched = providersSearched;
  metadata.providers_succeeded = providersSucceeded;
  if (providerErrors.length > 0) metadata.provider_errors = providerErrors;
  metadata.provider_counts = {
    starling: providersSucceeded.includes('STARLING') ? flights_results.filter((f: any) => f.provider === 'STARLING').length : 0,
    delfos: providersSucceeded.includes('DELFOS') ? finalFlights.filter((f: any) => f.provider === 'DELFOS').length : 0,
    merged_total: finalFlights.length,
  };

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
  const inferredAdults = resolveAdultsWithExplicitGuard(hotels, parsedRequest.flights);

  console.log(`📊 [HOTEL_SEARCH] Adults: ${inferredAdults} (roomType: ${hotels.roomType || 'not specified'})`);

  // ✅ STEP 1: Resolve city name to EUROVIPS city code
  console.log(`🔍 [HOTEL_SEARCH] Resolving city code for: "${hotels.city}"`);
  const cityCode = resolveHotelCode(hotels.city);
  console.log(`✅ [HOTEL_SEARCH] City code resolved: "${hotels.city}" → ${cityCode}`);

  const hotelChains = normalizeHotelChains(hotels);
  const hotelName = typeof hotels.hotelName === 'string' ? hotels.hotelName.trim() : '';
  const childrenCount = hotels.children || 0;
  const childrenAges = normalizeChildrenAges((hotels as any).childrenAges, childrenCount);

  const baseParams = {
    cityCode,
    checkinDate: hotels.checkinDate,
    checkoutDate: hotels.checkoutDate,
    adults: inferredAdults,
    children: childrenCount,
    childrenAges,
    infants: hotels.infants || 0,
  };

  let eurovipsHotels: any[] = [];
  let delfosHotels: any[] = [];
  const providersSearched: TravelSearchProvider[] = ['EUROVIPS'];
  const providersSucceeded: TravelSearchProvider[] = [];
  const providerErrors: ProviderErrorEntry[] = [];
  const shouldUseAsyncEurovips = !hotelName && (
    hotelChains.length === 0 ||
    hotelChains.length >= HOTEL_CHAIN_ASYNC_THRESHOLD ||
    (parsedRequest.type === 'combined' && hotelChains.length > 1)
  );
  const delfosEnabled = isDelfosSearchEnabled();
  if (delfosEnabled) providersSearched.push('DELFOS');
  const delfosPromise = delfosEnabled
    ? searchDelfosHotels(supabase, hotels, inferredAdults, childrenAges)
    : Promise.resolve({ items: [] as any[], error: undefined as string | undefined });

  try {
    if (hotelName) {
      console.log(`🏨 [HOTEL_SEARCH] Applying exact/partial hotel name filter to EUROVIPS: "${hotelName}"`);
      const eurovipsResult = await invokeEurovipsSearch(supabase, {
        action: 'searchHotels',
        data: { ...baseParams, hotelName },
      }, false);
      eurovipsHotels = (eurovipsResult?.results || []).map((h: any) => ({ ...h, provider: 'EUROVIPS' }));
      providersSucceeded.push('EUROVIPS');
    } else if (hotelChains.length > 1) {
      console.log(`🏨 [HOTEL_SEARCH] Applying multi-chain filters to EUROVIPS: ${hotelChains.join(', ')} (${shouldUseAsyncEurovips ? 'async' : 'sync'})`);
      const chainResults = await runWithConcurrency(
        hotelChains.map((chain) => async () => {
          const searchTerm = getSearchTermForChain(chain);
          try {
            const result = await invokeEurovipsSearch(supabase, {
              action: 'searchHotels',
              data: { ...baseParams, hotelName: searchTerm },
            }, shouldUseAsyncEurovips);
            const chainHotels = (result?.results || []).map((h: any) => ({ ...h, provider: 'EUROVIPS' }));
            console.log(`✅ [HOTEL_SEARCH] Chain "${chain}" returned ${chainHotels.length} hotels`);
            return chainHotels;
          } catch (error: any) {
            const message = error?.message || String(error);
            providerErrors.push({ provider: 'EUROVIPS', chain, message });
            console.error(`❌ [HOTEL_SEARCH] Chain "${chain}" failed:`, message);
            return [];
          }
        }),
        HOTEL_CHAIN_CONCURRENCY_LIMIT,
      );

      eurovipsHotels = chainResults.flat();
      if (eurovipsHotels.length > 0) providersSucceeded.push('EUROVIPS');
    } else {
      const chainFilter = hotelChains[0] ? getSearchTermForChain(hotelChains[0]) : '';
      if (chainFilter) {
        console.log(`🏨 [HOTEL_SEARCH] Applying chain filter to EUROVIPS: "${chainFilter}"`);
      } else {
        console.log('🏨 [HOTEL_SEARCH] No name or chain filter - searching all hotels');
      }

      const eurovipsResult = await invokeEurovipsSearch(supabase, {
        action: 'searchHotels',
        data: { ...baseParams, hotelName: chainFilter },
      }, shouldUseAsyncEurovips);
      eurovipsHotels = (eurovipsResult?.results || []).map((h: any) => ({ ...h, provider: 'EUROVIPS' }));
      providersSucceeded.push('EUROVIPS');
    }

    console.log(`[HOTEL_SEARCH] EUROVIPS returned ${eurovipsHotels.length} hotels`);

    const delfosResult = await delfosPromise;
    if (delfosEnabled) {
      if (delfosResult.error) {
        providerErrors.push({ provider: 'DELFOS', message: delfosResult.error });
        console.warn('[HOTEL_SEARCH] Delfos error:', delfosResult.error);
      } else {
        delfosHotels = delfosResult.items;
        if (delfosHotels.length > 0) providersSucceeded.push('DELFOS');
        console.log(`[HOTEL_SEARCH] Delfos returned ${delfosHotels.length} hotels`);
      }
    }

    if (eurovipsHotels.length === 0 && delfosHotels.length === 0 && providerErrors.length > 0) {
      return {
        status: 'error',
        type: 'hotels',
        error: {
          message: 'Hotel provider failed for all requested providers/chains',
          details: providerErrors
        },
        metadata: {
          providers_searched: providersSearched,
          providers_succeeded: providersSucceeded,
          provider_errors: providerErrors,
          async_eurovips: shouldUseAsyncEurovips,
        }
      };
    }
  } catch (error: any) {
    console.error('[HOTEL_SEARCH] EUROVIPS failed:', error?.message);
    providerErrors.push({
      provider: 'EUROVIPS',
      message: error?.message || 'Hotel search failed',
    });
    // Still try Delfos if it was running in parallel
    const delfosResult = await delfosPromise;
    if (delfosEnabled && !delfosResult.error && delfosResult.items.length > 0) {
      delfosHotels = delfosResult.items;
      providersSucceeded.push('DELFOS');
    } else if (delfosEnabled && delfosResult.error) {
      providerErrors.push({ provider: 'DELFOS', message: delfosResult.error });
    }
    if (delfosHotels.length === 0) {
      return {
        status: 'error',
        type: 'hotels',
        error: {
          message: error?.message || 'Hotel search failed',
          details: { provider_errors: providerErrors },
        },
        metadata: {
          providers_searched: providersSearched,
          providers_succeeded: providersSucceeded,
          provider_errors: providerErrors,
        },
      };
    }
  }

  const deduped = new Map<string, any>();

  for (const hotel of eurovipsHotels) {
    const key = hotel.hotel_id || hotel.name?.toLowerCase().trim() || hotel.unique_id;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, hotel);
    } else if (shouldReplaceDuplicateHotel(existing, hotel)) {
      deduped.set(key, hotel);
    }
  }

  const eurovipsDeduped = Array.from(deduped.values());
  let allHotels = mergeHotels([eurovipsDeduped, delfosHotels]);
  const totalFromProvider = allHotels.length;

  console.log(
    `[HOTEL_SEARCH] Merged: eurovips=${eurovipsDeduped.length} delfos=${delfosHotels.length} → ${totalFromProvider} hotels (after multi-provider merge)`,
  );

  if (!hotelName && hotelChains.length > 0) {
    const beforeChainFilter = allHotels.length;
    allHotels = filterHotelsByRequestedChains(allHotels, hotelChains);
    if (hotelChains.length > 1) {
      allHotels = interleaveHotelsByChain(allHotels, hotelChains);
    }
    console.log(`[HOTEL_SEARCH] Chain post-filter: ${beforeChainFilter} → ${allHotels.length} hotels`);
  }

  // ✅ STEP 1: Apply destination-specific filters (e.g., Punta Cana whitelist)
  const beforeWhitelist = allHotels.length;
  if (hotelChains.length > 1) {
    console.log('[HOTEL_SEARCH] Multiple explicit chains requested; skipping destination whitelist so requested chains are not removed');
  } else {
    allHotels = applyDestinationWhitelist(
      allHotels,
      hotels.city || '',
      hotelName || hotelChains[0]
    );
  }
  const afterWhitelist = allHotels.length;

  // ✅ STEP 2: Apply room-level filtering (if roomType or mealPlan specified)
  const { hotels: filteredHotels, excludedCount } = applyRoomFiltering(
    allHotels,
    hotels.roomType,
    hotels.mealPlan
  );

  // STEP 3: Sort by price and return all matching hotels
  const usdHotels = filteredHotels.map(normalizeHotelCurrencyUsd);

  const sortedHotels = usdHotels
    .sort((a: any, b: any) => {
      return getMinRoomPrice(a) - getMinRoomPrice(b);
    });

  console.log('[HOTEL_SEARCH] Final result:', sortedHotels.length, 'hotels');

  // ✅ STEP 4: Build extended metadata
  const isPuntaCana = hotels.city?.toLowerCase().includes('punta') &&
    hotels.city?.toLowerCase().includes('cana');

  const metadata: any = {};
  metadata.currency = HOTEL_RESULT_CURRENCY;

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
  if (hotelName || hotelChains.length > 0) {
    metadata.name_filter_applied = {
      filter_value: hotelName || hotelChains.join(', '),
      filter_source: hotelName ? 'hotelName' : 'hotelChains',
      chains: hotelChains.length > 0 ? hotelChains : undefined,
      hotel_name: hotelName || undefined,
      multi_chain_search: hotelChains.length > 1,
      applied_to: 'EUROVIPS <name> field',
    };
  }

  // Provider metadata
  metadata.providers_searched = providersSearched;
  metadata.providers_succeeded = providersSucceeded;
  if (providerErrors.length > 0) {
    metadata.provider_errors = providerErrors;
  }
  metadata.async_eurovips = shouldUseAsyncEurovips;
  metadata.provider_counts = {
    eurovips: eurovipsDeduped.length,
    delfos: delfosHotels.length,
    merged_total: totalFromProvider,
  };

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
  const inferredAdults = resolveAdultsWithExplicitGuard(parsedRequest.hotels, parsedRequest.flights);

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
  if (flightResult.status === 'error' || hotelResult.status === 'error') {
    combinedMetadata.partial_errors = {
      ...(flightResult.status === 'error' ? { flights: flightResult.error } : {}),
      ...(hotelResult.status === 'error' ? { hotels: hotelResult.error } : {}),
    };
  }

  return {
    status: flightResult.status === 'error' || hotelResult.status === 'error' ? 'incomplete' : 'completed',
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
// ACTIVITY SEARCH (Hotelbeds Activities API)
// =============================================================================

async function executeActivitySearch(
  parsedRequest: ParsedRequest,
  supabase: ReturnType<typeof createClient>
): Promise<SearchResults> {
  console.log('[ACTIVITY_SEARCH] Starting activity search');

  const activityParams = (parsedRequest as any).activities || parsedRequest.services;
  if (!activityParams) {
    throw new Error('No activity data in parsed request');
  }

  const destCode = resolveHotelbedsDestination(activityParams.city || activityParams.destination || '');

  let response;
  try {
    response = await invokeWithTimeout(supabase, 'hotelbeds-activities', {
      action: 'searchActivities',
      data: {
        destination: destCode,
        dateFrom: activityParams.dateFrom || activityParams.checkinDate,
        dateTo: activityParams.dateTo || activityParams.checkoutDate,
        adults: activityParams.adults || 2,
        children: activityParams.children || 0,
        childrenAges: activityParams.childrenAges || [],
      }
    });
  } catch (error) {
    console.error('[ACTIVITY_SEARCH] Hotelbeds Activities API error:', error);
    return {
      status: 'error',
      type: 'activities',
      error: {
        message: error.message || 'Activity search failed',
        details: error
      }
    };
  }

  const activityData = response?.data?.results || response?.results || [];

  return {
    status: 'completed',
    type: 'activities',
    activities: {
      count: activityData.length,
      items: activityData.slice(0, 10)
    }
  };
}

// =============================================================================
// TRANSFER SEARCH (Hotelbeds Transfers API)
// =============================================================================

async function executeTransferSearch(
  parsedRequest: ParsedRequest,
  supabase: ReturnType<typeof createClient>
): Promise<SearchResults> {
  console.log('[TRANSFER_SEARCH] Starting transfer search');

  const transferParams = (parsedRequest as any).transfers || parsedRequest.services;
  if (!transferParams) {
    throw new Error('No transfer data in parsed request');
  }

  let response;
  try {
    response = await invokeWithTimeout(supabase, 'hotelbeds-transfers', {
      action: 'searchTransfers',
      data: {
        fromType: transferParams.fromType || 'ATLAS',
        fromCode: transferParams.fromCode || transferParams.airportCode || '',
        toType: transferParams.toType || 'ATLAS',
        toCode: transferParams.toCode || transferParams.hotelCode || '',
        outboundDate: transferParams.dateFrom || transferParams.date || '',
        inboundDate: transferParams.dateTo,
        adults: transferParams.adults || 2,
        children: transferParams.children || 0,
        infants: transferParams.infants || 0,
      }
    });
  } catch (error) {
    console.error('[TRANSFER_SEARCH] Hotelbeds Transfers API error:', error);
    return {
      status: 'error',
      type: 'transfers',
      error: {
        message: error.message || 'Transfer search failed',
        details: error
      }
    };
  }

  const transferData = response?.data?.results || response?.results || [];

  return {
    status: 'completed',
    type: 'transfers',
    transfers: {
      count: transferData.length,
      items: transferData.slice(0, 10)
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
