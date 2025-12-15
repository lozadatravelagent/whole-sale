/**
 * Search Route
 *
 * Handles travel search requests (flights, hotels, combined)
 * This is a placeholder - full implementation will be ported from api-search Edge Function
 */

import type { FastifyInstance } from 'fastify';
import { checkCacheRedis, saveCacheRedis, generateSearchId } from '../../lib/redis.js';
import { updateUsageStats } from '../../services/apiKeyAuth.js';

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

    // TODO: Port full search logic from api-search Edge Function
    // For now, return a placeholder response
    const response = {
      request_id,
      search_id,
      is_retry: false,
      status: 'success',
      message: 'Fastify API Gateway is operational - full search logic to be implemented',
      parsed_request: {
        prompt,
        type: 'placeholder'
      },
      metadata: {
        search_time_ms: Date.now() - startTime,
        providers_used: [],
        gateway: 'fastify',
        version: '1.0.0'
      }
    };

    // Save to cache
    if (request.apiKey) {
      await saveCacheRedis(request_id, search_id, response, request.apiKey.id);
      await updateUsageStats(request.apiKey.id, fastify.supabase);
    }

    request.logger.info('REQUEST_COMPLETED', 'Request completed successfully', {
      request_id,
      search_id,
      latency_ms: Date.now() - startTime
    });

    return reply.send(response);
  });
}

// Extend Fastify instance type to include supabase
declare module 'fastify' {
  interface FastifyInstance {
    supabase: any;
  }
}
