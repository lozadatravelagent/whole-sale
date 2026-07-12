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
  getLightFareAirlines
} from './advancedFilters.js';
import { resolveFlightCodes, resolveHotelCode } from './cityCodeResolver.js';
import { getNormalizedFlightSegments, normalizeFlightRequest } from './flightSegments.js';
import { transformFare, type TransformOptions } from './flightTransformer.js';
import { selectDistinctPriceFlights } from './flightSelection.js';
import { isDelfosSearchEnabled } from './providers/flags.js';
import { mergeFlights, normalizeFlightAirlines } from './providers/mergeFlights.js';
import { mergeHotels } from './providers/mergeHotels.js';
import type { ProviderErrorEntry, TravelSearchProvider } from './providers/types.js';
import { matchesLuggagePreference } from './baggageUtils.js';
import { filterFlightsByTimePreference, timePreferenceToRange, timeRangeToLabel } from './timeSlotMapper.js';
import {
  getSearchTermForChain,
  hotelBelongsToChain,
  normalizeHotelChainName
} from '../data/hotelChainAliases.js';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const PROVIDER_TIMEOUT_MS = 45000; // 45 seconds (Starling puede tardar 20-30s en búsquedas internacionales)
const EUROVIPS_ASYNC_POLL_INTERVAL_MS = 2000;
const EUROVIPS_ASYNC_MAX_WAIT_MS = 120000;
const HOTEL_CHAIN_ASYNC_THRESHOLD = 3;
const HOTEL_CHAIN_CONCURRENCY_LIMIT = 2;
const HOTEL_RESULT_CURRENCY = 'USD';

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
    hotels?.hotelChain
  ];
  const seen = new Set<string>();
  const chains: string[] = [];

  for (const value of values) {
    const chain = typeof value === 'string' ? normalizeHotelChainName(value.trim()) : '';
    if (!chain) continue;

    const key = normalizeHotelText(chain);
    if (seen.has(key)) continue;

    seen.add(key);
    chains.push(chain);
  }

  return chains;
}

function getProviderSearchTermForChain(chain: string): string {
  return getSearchTermForChain(normalizeHotelChainName(chain));
}

function hotelMatchesRequestedChain(hotel: any, chain: string): boolean {
  const hotelName = typeof hotel?.name === 'string' ? hotel.name : '';
  if (!hotelName) return false;

  return hotelBelongsToChain(hotelName, chain) ||
    hotelBelongsToChain(hotelName, getProviderSearchTermForChain(chain));
}

function filterHotelsByRequestedChains(hotels: any[], chains: string[]): any[] {
  if (chains.length === 0) return hotels;

  const filtered = hotels.filter((hotel) =>
    chains.some((chain) => hotelMatchesRequestedChain(hotel, chain))
  );

  if (filtered.length === 0 && hotels.length > 0) {
    console.warn('[HOTEL_SEARCH] Chain post-filter removed all hotels; returning provider results to avoid false empty search');
    return hotels;
  }

  return filtered;
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
 * Interleave hotels from different chains in round-robin fashion
 * Ensures fair representation of each chain in results
 */
function interleaveHotelsByChain(hotels: any[], chains: string[]): any[] {
  if (chains.length <= 1) return hotels;

  const byChain = new Map<string, any[]>();
  const unassigned: any[] = [];
  chains.forEach(c => byChain.set(normalizeHotelText(c), []));

  for (const hotel of hotels) {
    const chain = chains.find((candidate) => hotelMatchesRequestedChain(hotel, candidate));
    if (chain) {
      byChain.get(normalizeHotelText(chain))!.push(hotel);
    } else {
      unassigned.push(hotel);
    }
  }

  // Log distribution
  for (const [chain, chainHotels] of byChain.entries()) {
    console.log(`📍 [INTERLEAVE] ${chain}: ${chainHotels.length} hotels`);
  }

  const result: any[] = [];
  let round = 0;

  while (result.length < hotels.length) {
    let addedThisRound = false;

    for (const chain of chains) {
      const chainHotels = byChain.get(normalizeHotelText(chain))!;
      if (round < chainHotels.length && result.length < hotels.length) {
        result.push(chainHotels[round]);
        console.log(`✅ [INTERLEAVE] Round ${round + 1}: Added "${chainHotels[round].name}" from ${chain}`);
        addedThisRound = true;
      }
    }

    if (!addedThisRound) break; // No more hotels to add from any chain
    round++;
  }

  result.push(...unassigned);

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
  limit: number
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

async function pollEurovipsJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string
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
        timestamp: jobRow.completed_at || new Date().toISOString()
      };
    }

    if (status === 'failed') {
      throw new Error(jobRow.error || `EUROVIPS async job ${jobId} failed`);
    }
  }

  throw new Error(`EUROVIPS async job ${jobId} timed out after ${EUROVIPS_ASYNC_MAX_WAIT_MS}ms`);
}

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
  useAsync: boolean
): Promise<any> {
  if (!useAsync) {
    return await invokeWithTimeout<any>(supabase, 'eurovips-soap', body);
  }

  const jobId = createJobId();
  console.log(`[EUROVIPS_ASYNC] Dispatching ${body.action} as job ${jobId}`);

  const dispatch = await supabase.functions.invoke('eurovips-soap', {
    body: {
      ...body,
      jobId
    }
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

function getMinRoomPrice(hotel: any): number {
  if (!Array.isArray(hotel?.rooms) || hotel.rooms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...hotel.rooms.map((room: any) => room?.total_price || Number.POSITIVE_INFINITY));
}

function sortHotelsByMinRoomPrice(hotels: any[]): any[] {
  return [...hotels].sort((a: any, b: any) => getMinRoomPrice(a) - getMinRoomPrice(b));
}

function extractBrokerCode(hotel: any): string {
  const uniqueId = typeof hotel?.unique_id === 'string' ? hotel.unique_id : '';
  if (uniqueId.includes('|')) {
    return uniqueId.split('|')[0].toUpperCase();
  }

  const firstRoom = Array.isArray(hotel?.rooms) ? hotel.rooms[0] : undefined;
  const fareIdBroker = typeof firstRoom?.fare_id_broker === 'string' ? firstRoom.fare_id_broker : '';
  if (fareIdBroker.includes('|')) {
    return fareIdBroker.split('|')[0].toUpperCase();
  }

  return '';
}

function shouldReplaceDuplicateHotel(existing: any, candidate: any): boolean {
  const existingBroker = extractBrokerCode(existing);
  const candidateBroker = extractBrokerCode(candidate);

  // EUROVIPS portal parity: prefer AP broker when duplicate hotel names appear.
  if (existingBroker !== 'AP' && candidateBroker === 'AP') return true;
  if (existingBroker === 'AP' && candidateBroker !== 'AP') return false;

  return getMinRoomPrice(candidate) < getMinRoomPrice(existing);
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
  const delfosPromise = delfosEnabled
    ? searchDelfosFlights(supabase, normalizedFlights, flightSegments)
    : Promise.resolve({ items: [] as any[], skipped: true as boolean | undefined, error: undefined as string | undefined });

  // Build Starling API request - passengers
  const passengers: Array<{ Count: number; Type: string }> = [];

  // Add adults (ADT)
  const adultsCount = normalizedFlights?.adults || 1;
  if (adultsCount > 0) {
    passengers.push({
      Count: adultsCount,
      Type: 'ADT'
    });
  }

  // Add children if present (CHD - 2-12 años)
  if (normalizedFlights?.children && normalizedFlights.children > 0) {
    passengers.push({
      Count: normalizedFlights.children,
      Type: 'CHD'
    });
  }

  // Add infants if present (INF - 0-2 años, viajan en brazos de adulto)
  // IMPORTANTE: No puede haber más infantes que adultos
  if (normalizedFlights?.infants && normalizedFlights.infants > 0) {
    // Validar restricción: max 1 infante por adulto
    const validInfants = Math.min(normalizedFlights.infants, adultsCount);
    if (validInfants !== normalizedFlights.infants) {
      console.warn(`[FLIGHT_SEARCH] ⚠️ Infants adjusted from ${normalizedFlights.infants} to ${validInfants} (max 1 infant per adult)`);
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
  let response: any = null;
  let starlingHardError: string | null = null;
  try {
    response = await invokeWithTimeout(supabase, 'starling-flights', {
      action: 'searchFlights',
      data: starlingRequest
    });
  } catch (error: any) {
    console.error('[FLIGHT_SEARCH] Starling API error:', error);
    starlingHardError = error.message || 'Flight search failed';
    providerErrors.push({ provider: 'STARLING', message: starlingHardError || 'Flight search failed' });
  }

  // ============================================================================
  // PARSE STARLING TVC RESPONSE
  // ============================================================================

  const tvcResponse = response ? ((response as any).data || response) : null;

  // Extract fares from TVC response (Fares or Recommendations depending on API version)
  const rawFares = tvcResponse?.Fares || tvcResponse?.Recommendations || [];

  console.log('[FLIGHT_SEARCH] TVC Response received:', {
    success: (response as any)?.success,
    hasFares: !!tvcResponse?.Fares,
    hasRecommendations: !!tvcResponse?.Recommendations,
    faresCount: rawFares?.length || 0,
    transactionId: tvcResponse?.TransactionID,
    starlingHardError,
  });

  // ✅ Transform TVC fares using the new transformer with extended features
  const transformOptions: TransformOptions = {
    adults: normalizedFlights?.adults || 1,
    children: normalizedFlights?.children || 0,
    infants: normalizedFlights?.infants || 0,
    tripType: normalizedFlights?.tripType,
    baseCurrency: tvcResponse?.BaseCurrency || 'USD'
  };

  let flights_results = (rawFares || []).map((fare: any, index: number) =>
    transformFare(fare, index, tvcResponse || {}, transformOptions)
  );

  if (flights_results.length > 0) providersSucceeded.push('STARLING');
  console.log('[FLIGHT_SEARCH] Transformed', flights_results.length, 'flights from TVC with extended features');

  const delfosResult = await delfosPromise;
  if (delfosEnabled && !delfosResult.skipped) {
    if (delfosResult.error) {
      providerErrors.push({ provider: 'DELFOS', message: delfosResult.error });
      console.warn('[FLIGHT_SEARCH] Delfos error:', delfosResult.error);
    } else {
      if (delfosResult.items.length > 0) providersSucceeded.push('DELFOS');
      console.log('[FLIGHT_SEARCH] Delfos returned', delfosResult.items.length, 'flights');
      flights_results = mergeFlights([flights_results, delfosResult.items]);
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

  // ✅ STEP 2: Apply time preference filtering (if specified)
  let timeFilterExcluded = 0;
  const timePreference = normalizedFlights?.timePreference || normalizedFlights?.departureTimePreference;

  if (timePreference) {
    console.log(`🕐 [TIME FILTER] Applying time preference: ${timePreference}`);
    const { flights: timeFiltered, excludedCount } = filterFlightsByTimePreference(flights_results, timePreference);
    timeFilterExcluded = excludedCount;
    flights_results = timeFiltered;
  }

  // ✅ STEP 3: Apply enhanced luggage filtering using per-leg analysis
  let luggageFilterExcluded = 0;

  if (normalizedFlights?.luggage && normalizedFlights.luggage !== 'any') {
    console.log(`🧳 [LUGGAGE FILTER] Filtering by luggage preference: ${normalizedFlights.luggage}`);
    const beforeLuggage = flights_results.length;

    flights_results = flights_results.filter((flight: any) => {
      const baggageAnalysis = flight.baggageAnalysis || [];

      // If no baggage analysis, fall back to basic check
      if (baggageAnalysis.length === 0) {
        console.log(`   ⚠️ Flight ${flight.id}: No baggageAnalysis, using basic check`);
        const hasChecked = flight.baggage?.included || false;
        const hasCarryOn = parseInt(flight.baggage?.carryOnQuantity || '0') > 0;

        switch (normalizedFlights.luggage) {
          case 'checked': return hasChecked;
          case 'carry_on': return hasCarryOn || (!hasChecked && !hasCarryOn);
          case 'both': return hasChecked && hasCarryOn;
          case 'none': return !hasChecked && !hasCarryOn;
          default: return true;
        }
      }

      const matches = matchesLuggagePreference(baggageAnalysis, normalizedFlights.luggage);
      if (!matches) {
        console.log(`   ❌ Flight ${flight.id}: Does not match ${normalizedFlights?.luggage} preference`);
        luggageFilterExcluded++;
      }
      return matches;
    });

    console.log(`📊 [LUGGAGE FILTER] Flights: ${beforeLuggage} → ${flights_results.length} (excluded: ${luggageFilterExcluded})`);
  }

  // ✅ STEP 4: One flight per distinct price (fewest escalas on ties), all distinct prices — no cap
  const finalFlights = selectDistinctPriceFlights(flights_results);

  console.log('[FLIGHT_SEARCH] Final result:', finalFlights.length, 'flights');

  // ✅ STEP 5: Build extended metadata with new features
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
  if (normalizedFlights?.luggage && normalizedFlights.luggage !== 'any') {
    metadata.luggage_filter_applied = {
      preference: normalizedFlights.luggage,
      excluded_count: luggageFilterExcluded
    };
  }

  metadata.providers_searched = providersSearched;
  metadata.providers_succeeded = providersSucceeded;
  if (providerErrors.length > 0) metadata.provider_errors = providerErrors;
  metadata.provider_counts = {
    starling: finalFlights.filter((f: any) => f.provider === 'STARLING' || !f.provider).length,
    delfos: finalFlights.filter((f: any) => f.provider === 'DELFOS').length,
    merged_total: finalFlights.length,
  };

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
      // All distinct-price flights are returned; nothing is withheld
      fullResultsAvailable: false,
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
  const inferredAdults = resolveAdultsWithExplicitGuard(hotels, parsedRequest.flights);

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
  const hotelChains = normalizeHotelChains(hotels);
  const hotelName = typeof hotels.hotelName === 'string' ? hotels.hotelName.trim() : '';

  // Base params for all requests
  const childrenCount = hotels.children || 0;
  const childrenAges = normalizeChildrenAges((hotels as any).childrenAges, childrenCount);
  const baseParams = {
    cityCode: cityCode,
    checkinDate: hotels.checkinDate,
    checkoutDate: hotels.checkoutDate,
    adults: inferredAdults,
    children: childrenCount,
    childrenAges,
    infants: hotels.infants || 0
  };

  let allHotels: any[] = [];
  let totalFromProvider = 0;
  const providersSearchedHotels: TravelSearchProvider[] = ['EUROVIPS'];
  const providersSucceededHotels: TravelSearchProvider[] = [];
  const providerErrors: ProviderErrorEntry[] = [];
  const shouldUseAsyncEurovips = !hotelName && (
    hotelChains.length === 0 ||
    hotelChains.length >= HOTEL_CHAIN_ASYNC_THRESHOLD ||
    (parsedRequest.type === 'combined' && hotelChains.length > 1)
  );
  const delfosHotelEnabled = isDelfosSearchEnabled();
  if (delfosHotelEnabled) providersSearchedHotels.push('DELFOS');
  const delfosHotelPromise = delfosHotelEnabled
    ? searchDelfosHotels(supabase, hotels, inferredAdults, childrenAges)
    : Promise.resolve({ items: [] as any[], error: undefined as string | undefined });

  try {
    if (hotelChains.length > 1) {
      // ✅ MULTI-CHAIN: Make N parallel requests (1 per chain)
      console.log(`🏨 [MULTI-CHAIN] Making ${hotelChains.length} API requests for chains (${shouldUseAsyncEurovips ? 'async' : 'sync'}):`, hotelChains);

      const chainResults = await runWithConcurrency(
        hotelChains.map((chain: string) => async () => {
          console.log(`📤 [MULTI-CHAIN] Requesting hotels for chain: "${chain}"`);
          try {
            const result = await invokeEurovipsSearch(supabase, {
              action: 'searchHotels',
              data: { ...baseParams, hotelName: getProviderSearchTermForChain(chain) }
            }, shouldUseAsyncEurovips);
            const hotels = (result as any)?.results || [];
            console.log(`✅ [MULTI-CHAIN] Chain "${chain}": received ${hotels.length} hotels`);
            return { chain, hotels };
          } catch (error: any) {
            const message = error?.message || String(error);
            providerErrors.push({ provider: 'EUROVIPS', chain, message });
            console.error(`❌ [MULTI-CHAIN] Chain "${chain}" failed:`, message);
            return { chain, hotels: [] };
          }
        }),
        HOTEL_CHAIN_CONCURRENCY_LIMIT
      );

      // Flatten all results
      for (const { hotels: chainHotels } of chainResults) {
        totalFromProvider += chainHotels.length;
        allHotels.push(...chainHotels);
      }

      console.log(`🔗 [MULTI-CHAIN] Total hotels before deduplication: ${allHotels.length}`);

      // Deduplicate by hotel_id or name, preferring AP broker for portal parity.
      const dedupMap = new Map<string, any>();
      for (const hotel of allHotels) {
        const key = hotel.hotel_id || hotel.name?.toLowerCase().trim();
        if (!key) continue;

        const existing = dedupMap.get(key);
        if (!existing) {
          dedupMap.set(key, hotel);
          continue;
        }

        if (shouldReplaceDuplicateHotel(existing, hotel)) {
          dedupMap.set(key, hotel);
          console.log(`🔁 [DEDUP] Replaced duplicate "${hotel.name}" with broker ${extractBrokerCode(hotel) || 'N/A'}`);
        } else {
          console.log(`🗑️ [DEDUP] Removed duplicate: "${hotel.name}"`);
        }
      }
      allHotels = Array.from(dedupMap.values()).map((h: any) => ({ ...h, provider: h.provider || 'EUROVIPS' }));
      if (allHotels.length > 0) providersSucceededHotels.push('EUROVIPS');

      console.log(`✅ [MULTI-CHAIN] After deduplication: ${allHotels.length} hotels`);

    } else {
      // ✅ SINGLE REQUEST: Use first chain, hotelName, or no filter
      const nameFilter = hotelChains[0] ? getProviderSearchTermForChain(hotelChains[0]) : (hotelName || '');

      if (nameFilter) {
        console.log(`🏨 [HOTEL_SEARCH] Applying name filter to EUROVIPS: "${nameFilter}"`);
      } else {
        console.log('🏨 [HOTEL_SEARCH] No chain or name filter - searching all hotels');
      }

      console.log(`📤 [HOTEL_SEARCH] Calling eurovips-soap Edge Function`);
      console.log(`   → cityCode: ${cityCode}, dates: ${hotels.checkinDate} to ${hotels.checkoutDate}, adults: ${inferredAdults}`);

      const response = await invokeEurovipsSearch(supabase, {
        action: 'searchHotels',
        data: { ...baseParams, hotelName: nameFilter }
      }, shouldUseAsyncEurovips);

      allHotels = ((response as any)?.results || []).map((h: any) => ({ ...h, provider: h.provider || 'EUROVIPS' }));
      totalFromProvider = allHotels.length;
      if (allHotels.length > 0) providersSucceededHotels.push('EUROVIPS');

      console.log('[HOTEL_SEARCH] Found', totalFromProvider, 'hotels from provider');
    }

    const delfosHotelResult = await delfosHotelPromise;
    if (delfosHotelEnabled) {
      if (delfosHotelResult.error) {
        providerErrors.push({ provider: 'DELFOS', message: delfosHotelResult.error });
        console.warn('[HOTEL_SEARCH] Delfos error:', delfosHotelResult.error);
      } else if (delfosHotelResult.items.length > 0) {
        providersSucceededHotels.push('DELFOS');
        const eurovipsCount = allHotels.length;
        allHotels = mergeHotels([allHotels, delfosHotelResult.items]);
        totalFromProvider = allHotels.length;
        console.log(`[HOTEL_SEARCH] Merged EUROVIPS(${eurovipsCount}) + Delfos(${delfosHotelResult.items.length}) → ${allHotels.length}`);
      }
    }

    if (allHotels.length === 0 && providerErrors.length > 0) {
      return {
        status: 'error',
        type: 'hotels',
        error: {
          message: 'Hotel provider failed for all requested providers/chains',
          details: providerErrors
        },
        metadata: {
          providers_searched: providersSearchedHotels,
          providers_succeeded: providersSucceededHotels,
          provider_errors: providerErrors,
          async_eurovips: shouldUseAsyncEurovips
        }
      };
    }
  } catch (error: any) {
    console.error('[HOTEL_SEARCH] EUROVIPS API error:', error);
    const delfosHotelResult = await delfosHotelPromise;
    if (delfosHotelEnabled && !delfosHotelResult.error && delfosHotelResult.items.length > 0) {
      allHotels = delfosHotelResult.items;
      totalFromProvider = allHotels.length;
      providersSucceededHotels.push('DELFOS');
    } else {
      return {
        status: 'error',
        type: 'hotels',
        error: {
          message: error.message || 'Hotel search failed',
          details: error,
        },
        metadata: {
          providers_searched: providersSearchedHotels,
          providers_succeeded: providersSucceededHotels,
          provider_errors: providerErrors,
        },
      };
    }
  }

  console.log('[HOTEL_SEARCH] Found', totalFromProvider, 'hotels from provider');

  if (!hotelName && hotelChains.length > 0) {
    const beforeChainFilter = allHotels.length;
    allHotels = filterHotelsByRequestedChains(allHotels, hotelChains);
    if (hotelChains.length > 1) {
      allHotels = interleaveHotelsByChain(allHotels, hotelChains);
    }
    console.log(`[HOTEL_SEARCH] Chain post-filter: ${beforeChainFilter} → ${allHotels.length} hotels`);
  }

  // ✅ STEP 1: Apply destination-specific filters (e.g., Punta Cana whitelist)
  allHotels = applyDestinationWhitelist(
    allHotels,
    hotels.city || '',
    hotelChains.length > 0 ? hotelChains : hotelName
  );
  const afterWhitelist = allHotels.length;

  // ✅ STEP 2: Apply room-level filtering (if roomType or mealPlan specified)
  const { hotels: filteredHotels, excludedCount } = applyRoomFiltering(
    allHotels,
    hotels.roomType,
    hotels.mealPlan
  );

  // STEP 3: Sort by price and return all matching hotels
  const usdHotels = filteredHotels.map(normalizeHotelCurrencyUsd);

  const priceSortedHotels = sortHotelsByMinRoomPrice(usdHotels);
  const rankedHotels = !hotelName && hotelChains.length > 1
    ? interleaveHotelsByChain(priceSortedHotels, hotelChains)
    : priceSortedHotels;
  const sortedHotels = rankedHotels;

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

  // Chain/Name filter applied
  if (hotelChains.length > 0 || hotelName) {
    metadata.chain_filter_applied = {
      chains: hotelChains.length > 0 ? hotelChains : undefined,
      hotel_name: hotelName || undefined,
      multi_chain_search: hotelChains.length > 1,
      applied_to: 'EUROVIPS <name> field'
    };
  }
  if (providerErrors.length > 0) {
    metadata.provider_errors = providerErrors;
  }
  metadata.providers_searched = providersSearchedHotels;
  metadata.providers_succeeded = providersSucceededHotels;
  metadata.provider_counts = {
    eurovips: sortedHotels.filter((h: any) => h.provider === 'EUROVIPS' || !h.provider).length,
    delfos: sortedHotels.filter((h: any) => h.provider === 'DELFOS').length,
    merged_total: sortedHotels.length,
  };
  metadata.async_eurovips = shouldUseAsyncEurovips;

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
      fullResultsAvailable: false,
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
  if (flightResult.status === 'error' || hotelResult.status === 'error') {
    combinedMetadata.partial_errors = {
      ...(flightResult.status === 'error' ? { flights: flightResult.error } : {}),
      ...(hotelResult.status === 'error' ? { hotels: hotelResult.error } : {})
    };
  }

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
