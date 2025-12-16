/**
 * Fastify API Server
 *
 * Main server entry point for WholeSale Connect AI API Gateway
 * Middleware chain: CORS → Correlation ID → Auth → Rate Limit → Execute
 */

console.log('[SERVER] 🚀 Starting server initialization...');

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { baseLogger } from './lib/logger.js';
import { supabase } from './lib/supabase.js';
import { corsOptions } from './middleware/cors.js';
import { correlationMiddleware } from './middleware/correlation.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { healthRoutes } from './routes/v1/health.js';
import { searchRoutes } from './routes/v1/search.js';

// Initialize Fastify with Pino logger
const fastify = Fastify({
  logger: baseLogger,
  requestIdHeader: 'x-correlation-id',
  requestIdLogLabel: 'correlation_id',
});

// Decorate fastify instance with supabase client
fastify.decorate('supabase', supabase);

// Register CORS plugin
await fastify.register(cors, corsOptions);

// Global hooks - applied to all routes
fastify.addHook('onRequest', correlationMiddleware);

// Register health routes (no auth required)
await fastify.register(healthRoutes, { prefix: '/v1' });

// Register protected routes (requires auth + rate limiting)
await fastify.register(async (protectedRoutes) => {
  // Apply auth and rate limit middleware to all routes in this scope
  protectedRoutes.addHook('onRequest', authMiddleware);
  protectedRoutes.addHook('onRequest', rateLimitMiddleware);

  // Register search routes
  await protectedRoutes.register(searchRoutes, { prefix: '/v1' });
}, { prefix: '' });

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  request.logger.error('UNHANDLED_ERROR', error.message, {
    stack: error.stack,
    statusCode: error.statusCode || 500
  });

  reply.status(error.statusCode || 500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message,
      status: error.statusCode || 500
    }
  });
});

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Log environment check (without exposing secrets)
console.log('🔧 Environment check:');
console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`  - PORT: ${PORT}`);
console.log(`  - HOST: ${HOST}`);
console.log(`  - SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ set' : '❌ missing'}`);
console.log(`  - SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ set' : '❌ missing'}`);
console.log(`  - UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? '✅ set' : '❌ missing'}`);
console.log(`  - UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ set' : '❌ missing'}`);

try {
  console.log('🚀 Starting Fastify server...');
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`✅ Fastify API Gateway listening on http://${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/v1/health`);
  console.log(`🔍 Search endpoint: http://${HOST}:${PORT}/v1/search`);
} catch (err) {
  console.error('❌ Failed to start server:', err);
  fastify.log.error(err);
  process.exit(1);
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n${signal} received, gracefully shutting down...`);
    await fastify.close();
    process.exit(0);
  });
});
