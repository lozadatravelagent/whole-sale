/**
 * Health Check Route
 *
 * Simple health check endpoint for monitoring and load balancers
 */

import type { FastifyInstance } from 'fastify';
import { redis } from '../../lib/redis.js';
import { supabase } from '../../lib/supabase.js';

export async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    };
  });

  // Detailed health check with dependencies
  fastify.get('/health/detailed', async (request, reply) => {
    const checks = {
      redis: false,
      supabase: false,
    };

    // Check Redis
    try {
      await redis.ping();
      checks.redis = true;
    } catch (err) {
      request.logger.error('HEALTH_CHECK', 'Redis health check failed', { error: err });
    }

    // Check Supabase
    try {
      const { error } = await supabase.from('api_keys').select('id').limit(1);
      checks.supabase = !error;
    } catch (err) {
      request.logger.error('HEALTH_CHECK', 'Supabase health check failed', { error: err });
    }

    const allHealthy = checks.redis && checks.supabase;

    return reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      checks
    });
  });
}
