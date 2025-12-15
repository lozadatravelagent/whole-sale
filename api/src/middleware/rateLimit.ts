/**
 * Rate Limiting Middleware
 *
 * Checks rate limits using Redis sliding window
 * Adds rate limit headers to response
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { checkRateLimitRedis } from '../lib/redis.js';

export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Middleware chain ensures apiKey exists (auth runs before this)
  if (!request.apiKey) {
    request.logger.error('RATE_LIMIT_ERROR', 'No API key found in request (auth middleware must run first)');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        status: 500
      }
    });
  }

  const apiKey = request.apiKey;

  // Check rate limit using Redis
  request.logger.info('RATE_LIMIT_CHECK', 'Checking rate limit (Redis: true)', {
    api_key_prefix: apiKey.key_prefix
  });

  const rateLimitResult = await checkRateLimitRedis(apiKey.id, {
    minute: apiKey.rate_limit_per_minute,
    hour: apiKey.rate_limit_per_hour,
    day: apiKey.rate_limit_per_day,
  });

  // Add rate limit headers to response
  reply.header('X-RateLimit-Limit', rateLimitResult.limit.toString());
  reply.header('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
  reply.header('X-RateLimit-Reset', Math.floor(rateLimitResult.reset_at.getTime() / 1000).toString());
  reply.header('X-RateLimit-Window', rateLimitResult.window);

  // Check if rate limit exceeded
  if (!rateLimitResult.allowed && rateLimitResult.error) {
    request.logger.warn('RATE_LIMIT_EXCEEDED', rateLimitResult.error.message, {
      api_key_prefix: apiKey.key_prefix,
      window: rateLimitResult.window,
      limit: rateLimitResult.limit
    });

    return reply.status(429).send({
      success: false,
      error: rateLimitResult.error
    });
  }

  request.logger.info('RATE_LIMIT_PASSED', 'Rate limit check passed', {
    remaining: rateLimitResult.remaining,
    window: rateLimitResult.window
  });
}
