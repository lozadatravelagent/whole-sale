/**
 * Search Route
 *
 * Handles travel search requests (flights, hotels, combined, packages, services, itinerary)
 * Full implementation ported from api-search Edge Function
 */

import type { FastifyInstance } from 'fastify';
import { checkCacheRedis, saveCacheRedis, generateSearchId } from '../../lib/redis.js';
import { updateUsageStats } from '../../services/apiKeyAuth.js';
import { executeSearch } from '../../services/searchExecutor.js';
import { validateParsedRequest } from '../../services/validation.js';
import { buildCompleteMetadata } from '../../services/buildMetadata.js';

interface SearchRequest {
  request_id: string;
  prompt: string;
}

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: SearchRequest }>('/search', async (request, reply) => {
    const startTime = Date.now();
    const { request_id, prompt } = request.body;

    // Validate request_id format
    const requestIdPattern = /^(req_[a-zA-Z0-9_-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
    if (!requestIdPattern.test(request_id)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_REQUEST_ID',
          message: 'request_id must be a valid UUID or format "req_<string>"',
          status: 400
        }
      });
    }

    // Check idempotency cache
    request.logger.info('IDEMPOTENCY_CHECK', `Checking cache (Redis: true)`, {
      request_id
    });

    const cacheResult = await checkCacheRedis(request_id);

    if (cacheResult.exists && cacheResult.data) {
      request.logger.info('CACHE_HIT', `Returning cached response for request_id: ${request_id}`, {
        cached_at: cacheResult.cached_at
      });

      return reply.send({
        ...cacheResult.data,
        is_retry: true,
        cached_at: cacheResult.cached_at
      });
    }

    // Generate search ID
    const search_id = generateSearchId();

    try {
      // STEP 1: Parse prompt with AI
      request.logger.info('AI_PARSING', `Calling ai-message-parser for request_id: ${request_id}`);
      const aiParseStart = Date.now();

      const parseResponse = await fastify.supabase.functions.invoke('ai-message-parser', {
        body: { prompt, request_id }
      });

      const aiParsingTimeMs = Date.now() - aiParseStart;

      if (parseResponse.error) {
        request.logger.error('AI_PARSE_ERROR', 'AI message parser failed', {
          error: parseResponse.error
        });

        throw new Error(`AI parsing failed: ${parseResponse.error.message || 'Unknown error'}`);
      }

      // Extract parsed data from Edge Function response
      const responseData = parseResponse.data;

      // Edge Function returns { success, parsed, ... }
      if (!responseData.success) {
        throw new Error(`AI parsing failed: ${responseData.error || 'Unknown error'}`);
      }

      // Extract the parsed object and map requestType to type
      const parsedRequest = {
        type: responseData.parsed.requestType,
        ...responseData.parsed
      };

      request.logger.info('AI_PARSE_SUCCESS', `Parsed as type: ${parsedRequest.type}`, {
        type: parsedRequest.type,
        latency_ms: aiParsingTimeMs
      });

      // STEP 2: Validate parsed request
      const validationResult = validateParsedRequest(parsedRequest);

      if (!validationResult.isValid) {
        request.logger.warn('VALIDATION_FAILED', 'Request validation failed', {
          missing_fields: validationResult.missingFields
        });

        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.message,
            missing_fields: validationResult.missingFields,
            status: 400
          }
        });
      }

      // STEP 3: Execute search
      request.logger.info('SEARCH_EXECUTION', 'Starting search execution', {
        type: parsedRequest.type
      });

      const searchStart = Date.now();
      const searchResults = await executeSearch(parsedRequest, fastify.supabase);
      const searchTimeMs = Date.now() - searchStart;

      request.logger.info('SEARCH_COMPLETED', 'Search execution completed', {
        type: parsedRequest.type,
        status: searchResults.status,
        latency_ms: searchTimeMs
      });

      // STEP 4: Build complete response
      const totalTimeMs = Date.now() - startTime;

      // Extract providers_used from searchResults metadata
      const providersUsed: string[] = [];
      if (searchResults.flights && searchResults.flights.count > 0) {
        providersUsed.push('starling');
      }
      if (searchResults.hotels && searchResults.hotels.count > 0) {
        providersUsed.push('eurovips');
      }
      if (searchResults.packages && searchResults.packages.count > 0) {
        providersUsed.push('eurovips');
      }
      if (searchResults.services && searchResults.services.count > 0) {
        providersUsed.push('eurovips');
      }
      if (searchResults.itinerary) {
        providersUsed.push('openai');
      }

      const completeMetadata = buildCompleteMetadata(
        providersUsed.length > 0 ? providersUsed : ['none'],
        searchTimeMs,
        aiParsingTimeMs,
        undefined, // pre_parsing not used in Fastify version
        searchResults.metadata || {}
      );

      // Destructure to avoid duplicating status and metadata
      const { status, metadata: _searchMetadata, ...searchData } = searchResults;

      const response = {
        request_id,
        search_id,
        is_retry: false,
        status,
        parsed_request: {
          type: parsedRequest.type,
          ...parsedRequest
        },
        ...searchData,
        metadata: {
          ...completeMetadata,
          gateway: 'fastify',
          version: '1.0.0',
          total_time_ms: totalTimeMs
        }
      };

      // STEP 5: Save to cache and update usage stats
      if (request.apiKey) {
        await saveCacheRedis(request_id, search_id, response, request.apiKey.id);
        await updateUsageStats(request.apiKey.id, fastify.supabase);
      }

      request.logger.info('REQUEST_COMPLETED', 'Request completed successfully', {
        request_id,
        search_id,
        type: parsedRequest.type,
        status: searchResults.status,
        total_latency_ms: totalTimeMs
      });

      return reply.send(response);

    } catch (error: any) {
      const totalTimeMs = Date.now() - startTime;

      request.logger.error('SEARCH_ERROR', 'Search request failed', {
        error: error.message,
        stack: error.stack
      });

      // Build error response
      const errorResponse = {
        request_id,
        search_id,
        is_retry: false,
        success: false,
        status: 'error',
        error: {
          code: 'SEARCH_ERROR',
          message: error.message || 'An unexpected error occurred',
          status: 500
        },
        metadata: {
          search_time_ms: totalTimeMs,
          providers_used: [],
          gateway: 'fastify',
          version: '1.0.0'
        }
      };

      // Save error response to cache
      if (request.apiKey) {
        await saveCacheRedis(request_id, search_id, errorResponse, request.apiKey.id);
      }

      return reply.status(500).send(errorResponse);
    }
  });
}

// Extend Fastify instance type to include supabase
declare module 'fastify' {
  interface FastifyInstance {
    supabase: any;
  }
}
