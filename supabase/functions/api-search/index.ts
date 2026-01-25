/**
 * API Search Edge Function
 *
 * Endpoint principal para búsquedas de viajes via API.
 * Replica 100% el comportamiento del chat interno.
 *
 * POST /v1/search
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Import helpers
import {
  checkCache,
  saveCache,
  generateSearchId,
  validateRequestId
} from '../_shared/idempotency.ts';

import {
  extractApiKey,
  validateKey,
  checkScopes,
  checkRateLimit,
  getRateLimitHeaders,
  updateUsageStats,
  type ApiKey
} from '../_shared/apiKeyAuth.ts';

import {
  determineContextAction,
  type ParsedRequest,
  type SearchResults,
  type ContextManagement
} from '../_shared/contextManagement.ts';

import {
  buildExtendedMetadata,
  buildCompleteMetadata,
  addParsingDetails,
  calculateSearchTime,
  type SearchMetadata,
  type FiltersApplied
} from '../_shared/buildMetadata.ts';

import {
  executeSearch
} from '../_shared/searchExecutor.ts';

import {
  validateParsedRequest,
  type ValidationResult
} from '../_shared/validation.ts';

// Redis-based implementations (Phase 1 - Quick Wins)
import {
  checkRateLimitRedis
} from '../_shared/rateLimitRedis.ts';

import {
  checkCacheRedis,
  saveCacheRedis,
  generateSearchId as generateSearchIdRedis
} from '../_shared/idempotencyRedis.ts';

import {
  createLogger,
  extractCorrelationId
} from '../_shared/logger.ts';

// Feature flags
const USE_REDIS_RATE_LIMIT = Deno.env.get('USE_REDIS_RATE_LIMIT') === 'true';
const USE_REDIS_IDEMPOTENCY = Deno.env.get('USE_REDIS_IDEMPOTENCY') === 'true';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, x-api-key, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// =============================================================================
// REQUEST/RESPONSE INTERFACES
// =============================================================================

interface SearchRequest {
  request_id: string;  // REQUIRED - for idempotency
  prompt?: string;     // For natural language mode

  // Context
  context?: {
    previous_request?: any;
    conversation_history?: Array<{
      role: string;
      content: string;
      timestamp: string;
    }>;
  };

  // Or structured mode (no AI)
  flights?: any;
  hotels?: any;
  packages?: any;
  services?: any;

  // Optional metadata
  external_conversation_ref?: string;
  options?: {
    language?: string;
    max_results?: number;
    include_metadata?: boolean;
  };
}

interface SearchResponse {
  request_id: string;
  search_id: string;
  is_retry: boolean;
  cached_at?: string;
  status: 'completed' | 'incomplete' | 'error';
  external_conversation_ref?: string;

  parsed_request?: any;
  results?: any;
  context_management?: ContextManagement;
  metadata?: SearchMetadata;

  error?: {
    type: string;
    message: string;
    missing_fields?: any[];
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  const startTime = Date.now();

  // Extract correlation ID and create logger
  const correlationId = extractCorrelationId(req);
  const logger = createLogger(correlationId);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Only POST method is allowed',
          status: 405
        }
      }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Initialize Supabase client (service role for backend operations)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =========================================================================
    // STEP 1: VALIDATE API KEY & CHECK RATE LIMITS
    // =========================================================================

    const authHeader = req.headers.get('Authorization');
    const apiKeyHeader = req.headers.get('X-API-Key') || req.headers.get('apikey');
    const apiKey = extractApiKey(authHeader, apiKeyHeader);

    if (!apiKey) {
      return buildErrorResponse({
        code: 'MISSING_API_KEY',
        message: 'API key is required in X-API-Key or Authorization header',
        status: 401
      });
    }

    // Validate API key
    const authResult = await validateKey(apiKey, supabase);
    if (!authResult.success || !authResult.api_key) {
      return buildErrorResponse(authResult.error!);
    }

    const validatedKey: ApiKey = authResult.api_key;

    // Check scopes - require search scope
    const hasSearchScope = checkScopes(validatedKey, 'search:flights') ||
      checkScopes(validatedKey, 'search:hotels') ||
      checkScopes(validatedKey, 'search:*');

    if (!hasSearchScope) {
      return buildErrorResponse({
        code: 'INSUFFICIENT_SCOPE',
        message: 'API key does not have search permissions',
        status: 403
      });
    }

    // Check rate limits (Redis if enabled, otherwise PostgreSQL)
    logger.info('RATE_LIMIT_CHECK', `Checking rate limit (Redis: ${USE_REDIS_RATE_LIMIT})`, {
      api_key_prefix: validatedKey.key_prefix
    });

    const rateLimitResult = USE_REDIS_RATE_LIMIT
      ? await checkRateLimitRedis(validatedKey.id, {
          minute: validatedKey.rate_limit_per_minute,
          hour: validatedKey.rate_limit_per_hour,
          day: validatedKey.rate_limit_per_day,
        })
      : await checkRateLimit(validatedKey, supabase);

    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    if (!rateLimitResult.allowed) {
      return buildErrorResponse(rateLimitResult.error!, rateLimitHeaders);
    }

    // =========================================================================
    // STEP 2: PARSE REQUEST BODY & VALIDATE
    // =========================================================================

    let requestBody: SearchRequest;
    try {
      requestBody = await req.json();
    } catch {
      return buildErrorResponse({
        code: 'INVALID_JSON',
        message: 'Request body must be valid JSON',
        status: 400
      });
    }

    // Validate request_id (REQUIRED)
    if (!requestBody.request_id) {
      return buildErrorResponse({
        code: 'MISSING_REQUEST_ID',
        message: 'request_id is required for idempotency',
        status: 400
      });
    }

    if (!validateRequestId(requestBody.request_id)) {
      return buildErrorResponse({
        code: 'INVALID_REQUEST_ID',
        message: 'request_id must be a valid UUID or format "req_<string>"',
        status: 400
      });
    }

    // Validate input mode (must have either prompt or structured data)
    const hasPrompt = !!requestBody.prompt;
    const hasStructured = !!(requestBody.flights || requestBody.hotels || requestBody.packages || requestBody.services);

    if (!hasPrompt && !hasStructured) {
      return buildErrorResponse({
        code: 'MISSING_INPUT',
        message: 'Either "prompt" or structured data (flights/hotels/etc) is required',
        status: 400
      });
    }

    // =========================================================================
    // STEP 3: CHECK IDEMPOTENCY CACHE
    // =========================================================================

    logger.info('IDEMPOTENCY_CHECK', `Checking cache (Redis: ${USE_REDIS_IDEMPOTENCY})`, {
      request_id: requestBody.request_id
    });

    const cacheResult = USE_REDIS_IDEMPOTENCY
      ? await checkCacheRedis(requestBody.request_id)
      : await checkCache(requestBody.request_id, supabase);

    if (cacheResult.exists && cacheResult.data) {
      logger.info('CACHE_HIT', `Returning cached response for request_id: ${requestBody.request_id}`, {
        cached_at: cacheResult.cached_at
      });

      return new Response(
        JSON.stringify({
          ...cacheResult.data,
          is_retry: true,
          cached_at: cacheResult.cached_at
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            ...rateLimitHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // =========================================================================
    // STEP 4: PARSE MESSAGE WITH AI (or use structured data)
    // =========================================================================

    let parsedRequest: ParsedRequest;
    let preParsingTimeMs = 0;
    let aiParsingTimeMs = 0;

    if (hasPrompt) {
      // Natural language mode - use AI parser Edge Function
      console.log('[API_SEARCH] Calling ai-message-parser Edge Function');
      console.log('[API_SEARCH] Prompt:', requestBody.prompt);
      console.log('[API_SEARCH] Previous context:', requestBody.context?.previous_request);
      console.log('[API_SEARCH] Conversation history:', requestBody.context?.conversation_history?.length || 0, 'messages');

      const parsingStartTime = Date.now();

      const aiParserResponse = await supabase.functions.invoke('ai-message-parser', {
        body: {
          message: requestBody.prompt,
          language: requestBody.options?.language || 'es',
          currentDate: new Date().toISOString().split('T')[0],
          previousContext: requestBody.context?.previous_request,
          conversationHistory: requestBody.context?.conversation_history || []
        }
      });

      if (aiParserResponse.error) {
        console.error('[API_SEARCH] AI parsing error:', aiParserResponse.error);
        return buildErrorResponse({
          code: 'AI_PARSING_ERROR',
          message: 'Failed to parse message with AI',
          status: 500
        });
      }

      const parsed = aiParserResponse.data?.parsed;
      if (!parsed) {
        console.error('[API_SEARCH] No parsed result from AI');
        return buildErrorResponse({
          code: 'AI_PARSING_ERROR',
          message: 'No parsed result from AI service',
          status: 500
        });
      }

      aiParsingTimeMs = Date.now() - parsingStartTime;
      preParsingTimeMs = aiParserResponse.data?.preParsingTimeMs || 0;

      // Convert to our ParsedRequest format
      parsedRequest = {
        type: parsed.requestType as any,
        flights: parsed.flights,
        hotels: parsed.hotels,
        packages: parsed.packages,
        services: parsed.services,
        itinerary: parsed.itinerary,
        confidence: parsed.confidence || 0.8
      };

      console.log('[API_SEARCH] AI parsing result:', parsedRequest.type);

      // =========================================================================
      // POST-PROCESSING: Coerce to combined if user mentions both flight + hotel
      // This mirrors the logic from useMessageHandler.ts (internal chat)
      // =========================================================================
      const lowerPrompt = (requestBody.prompt || '').toLowerCase();

      // Detect explicit hotel keywords
      const explicitlyWantsHotel = /\b(hotel|hoteles|alojamiento|hospedaje|habitacion|habitación)\b/.test(lowerPrompt);
      // Detect explicit flight keywords
      const explicitlyWantsFlight = /\b(vuelo|vuelos|volar|avion|avión|aereo|aéreo|pasaje|pasajes)\b/.test(lowerPrompt);
      // Detect explicit rejection of hotel
      const explicitlyRejectsHotel = /\b(no quiero hotel|sin hotel|solo vuelo|solo el vuelo|no necesito hotel)\b/.test(lowerPrompt);

      // If user mentions BOTH flight AND hotel keywords, but AI didn't return "combined" → FORCE it
      if (explicitlyWantsHotel && explicitlyWantsFlight && !explicitlyRejectsHotel && parsedRequest.type !== 'combined') {
        console.log('🔀 [API_SEARCH] POST-PROCESS: Coercing to combined (user mentioned both flight + hotel keywords)');
        parsedRequest.type = 'combined';

        // Mirror city/dates from flights to hotels ONLY if missing (preserve user's explicit hotel city)
        const f = parsedRequest.flights;
        const existingHotels = parsedRequest.hotels || {};

        // Log what we're doing with the hotel city
        if (existingHotels.city) {
          console.log(`🏨 [API_SEARCH] Preserving user's hotel city: "${existingHotels.city}" (different from flight destination "${f?.destination}")`);
        } else {
          console.log(`🏨 [API_SEARCH] No hotel city specified, using flight destination: "${f?.destination}"`);
        }

        parsedRequest.hotels = {
          ...existingHotels,
          // IMPORTANT: Preserve hotel city if user specified it (e.g., "hotel playa del carmen")
          // Only fallback to flight destination if hotel city is NOT specified
          city: existingHotels.city || f?.destination,
          // If hotel dates not specified, use flight dates
          checkinDate: existingHotels.checkinDate || f?.departureDate,
          checkoutDate: existingHotels.checkoutDate || f?.returnDate,
          // If hotel adults not specified, use flight adults
          adults: existingHotels.adults || f?.adults,
          children: existingHotels.children ?? f?.children ?? 0
        };

        console.log('🔀 [API_SEARCH] POST-PROCESS: Final hotels config:', parsedRequest.hotels);
      }

      // If user explicitly rejects hotel but AI returned combined → force flights-only
      if (explicitlyRejectsHotel && parsedRequest.type === 'combined') {
        console.log('🚫 [API_SEARCH] POST-PROCESS: User explicitly rejects hotel - forcing flights-only');
        parsedRequest.type = 'flights';
        parsedRequest.hotels = undefined;
      }

      console.log('[API_SEARCH] Final parsed type after post-processing:', parsedRequest.type);
    } else {
      // Structured mode - use provided data directly
      parsedRequest = {
        type: requestBody.flights ? 'flights' :
          requestBody.hotels ? 'hotels' :
            requestBody.packages ? 'packages' :
              requestBody.services ? 'services' : 'general',
        flights: requestBody.flights,
        hotels: requestBody.hotels,
        packages: requestBody.packages,
        services: requestBody.services,
        confidence: 1.0
      };
    }

    // =========================================================================
    // STEP 5: VALIDATE REQUIRED FIELDS
    // =========================================================================

    // NOTE: This requires importing validation functions from src/
    // For now, simplified validation

    const validation = validateParsedRequest(parsedRequest);
    if (!validation.isValid) {
      // Return 422 with missing info
      const search_id = generateSearchId();
      const contextManagement = determineContextAction(parsedRequest, {
        status: 'incomplete'
      });

      const response: SearchResponse = {
        request_id: requestBody.request_id,
        search_id,
        is_retry: false,
        status: 'incomplete',
        parsed_request: parsedRequest,
        error: {
          type: 'missing_info',
          message: validation.message,
          missing_fields: validation.missingFields
        },
        context_management: contextManagement
      };

      // Save in cache (Redis if enabled, otherwise PostgreSQL)
      if (USE_REDIS_IDEMPOTENCY) {
        await saveCacheRedis(requestBody.request_id, search_id, response, validatedKey.id);
      } else {
        await saveCache(requestBody.request_id, search_id, response, validatedKey.id, supabase);
      }

      return new Response(
        JSON.stringify(response),
        {
          status: 422,
          headers: {
            ...corsHeaders,
            ...rateLimitHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // =========================================================================
    // STEP 6: EXECUTE SEARCH
    // =========================================================================

    console.log('[API_SEARCH] Executing search for type:', parsedRequest.type);

    let searchData: SearchResults;
    try {
      searchData = await executeSearch(parsedRequest, supabase);
      console.log('[API_SEARCH] Search completed with status:', searchData.status);
    } catch (error) {
      console.error('[API_SEARCH] Search execution error:', error);
      return buildErrorResponse({
        code: 'SEARCH_ERROR',
        message: 'Search execution failed',
        status: 500
      });
    }

    // =========================================================================
    // STEP 7: DETERMINE CONTEXT MANAGEMENT
    // =========================================================================

    const contextManagement = determineContextAction(parsedRequest, searchData);

    // =========================================================================
    // STEP 8: BUILD METADATA
    // =========================================================================

    // Extract filters applied from search data metadata
    const searchMetadata = (searchData as any).metadata || {};

    const filtersApplied: FiltersApplied = {
      stopsFilter: !!parsedRequest.flights?.stops && parsedRequest.flights.stops !== 'any',
      luggageFilter: !!parsedRequest.flights?.luggage,
      lightFaresExcluded: searchMetadata.light_fares_excluded || 0,
      hotelsExcludedNoRooms: searchMetadata.hotels_excluded_no_matching_rooms || 0,
      whitelistFilter: searchMetadata.destination_rules?.type === 'quality_whitelist',
      roomFilter: !!parsedRequest.hotels?.roomType || !!parsedRequest.hotels?.mealPlan
    };

    const metadata = buildCompleteMetadata(
      searchData.flights ? ['starling'] : searchData.hotels ? ['eurovips'] : [],
      calculateSearchTime(startTime),
      aiParsingTimeMs,
      preParsingTimeMs,
      buildExtendedMetadata(searchData, filtersApplied)
    );

    // =========================================================================
    // STEP 9: BUILD RESPONSE
    // =========================================================================

    const search_id = generateSearchId();
    const response: SearchResponse = {
      request_id: requestBody.request_id,
      search_id,
      is_retry: false,
      status: searchData.status,
      external_conversation_ref: requestBody.external_conversation_ref,
      parsed_request: addParsingDetails(
        parsedRequest,
        [],  // TODO: Extract from pre-parser
        [],  // TODO: Extract from AI parser
        preParsingTimeMs,
        aiParsingTimeMs
      ),
      results: searchData,
      context_management: contextManagement,
      metadata: requestBody.options?.include_metadata !== false ? metadata : undefined
    };

    // =========================================================================
    // STEP 10: SAVE TO CACHE & UPDATE STATS
    // =========================================================================

    await Promise.all([
      USE_REDIS_IDEMPOTENCY
        ? saveCacheRedis(requestBody.request_id, search_id, response, validatedKey.id)
        : saveCache(requestBody.request_id, search_id, response, validatedKey.id, supabase),
      updateUsageStats(validatedKey.id, supabase)
    ]);

    // =========================================================================
    // STEP 11: RETURN RESPONSE
    // =========================================================================

    logger.info('REQUEST_COMPLETED', 'Request completed successfully', {
      request_id: requestBody.request_id,
      search_id,
      type: parsedRequest.type,
      latency_ms: Date.now() - startTime
    });

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          ...rateLimitHeaders,
          'Content-Type': 'application/json',
          'X-Correlation-ID': correlationId
        }
      }
    );

  } catch (error) {
    console.error('[API_SEARCH] Unexpected error:', error);

    return buildErrorResponse({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      status: 500
    });
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildErrorResponse(
  error: { code: string; message: string; status: number },
  additionalHeaders?: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error
    }),
    {
      status: error.status,
      headers: {
        ...corsHeaders,
        ...additionalHeaders,
        'Content-Type': 'application/json'
      }
    }
  );
}

// Validation function is now imported from _shared/validation.ts
// No need for local implementation
