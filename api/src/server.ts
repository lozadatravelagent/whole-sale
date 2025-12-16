/**
 * Fastify API Server
 *
 * Main server entry point for WholeSale Connect AI API Gateway
 * Middleware chain: CORS → Correlation ID → Auth → Rate Limit → Execute
 */

console.log('[SERVER] 🚀 Starting server initialization...');

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

// Wrap entire initialization in try-catch to catch any errors
async function startServer() {
  try {
    console.log('[SERVER] 📦 Loading dependencies...');
    const Fastify = (await import('fastify')).default;
    const cors = (await import('@fastify/cors')).default;
    const { baseLogger } = await import('./lib/logger.js');
    const { supabase } = await import('./lib/supabase.js');
    const { corsOptions } = await import('./middleware/cors.js');
    const { correlationMiddleware } = await import('./middleware/correlation.js');
    const { authMiddleware } = await import('./middleware/auth.js');
    const { rateLimitMiddleware } = await import('./middleware/rateLimit.js');
    const { healthRoutes } = await import('./routes/v1/health.js');
    const { searchRoutes } = await import('./routes/v1/search.js');

    console.log('[SERVER] ✅ Dependencies loaded');

    // Log environment check (without exposing secrets)
    const PORT = parseInt(process.env.PORT || '3000', 10);
    const HOST = process.env.HOST || '0.0.0.0';

    console.log('🔧 Environment check:');
    console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`  - PORT: ${PORT}`);
    console.log(`  - HOST: ${HOST}`);
    console.log(`  - SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ set' : '❌ missing'}`);
    console.log(`  - SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ set' : '❌ missing'}`);
    console.log(`  - UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? '✅ set' : '❌ missing'}`);
    console.log(`  - UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ set' : '❌ missing'}`);

    // Initialize Fastify with Pino logger
    console.log('[SERVER] 🔨 Creating Fastify instance...');
    const fastify = Fastify({
      logger: baseLogger,
      requestIdHeader: 'x-correlation-id',
      requestIdLogLabel: 'correlation_id',
    });

    // Decorate fastify instance with supabase client
    fastify.decorate('supabase', supabase);

    // Register CORS plugin
    console.log('[SERVER] 🌐 Registering CORS...');
    await fastify.register(cors, corsOptions);

    // Global hooks - applied to all routes
    console.log('[SERVER] 🔗 Setting up middleware...');
    fastify.addHook('onRequest', correlationMiddleware);

    // Register health routes (no auth required)
    console.log('[SERVER] ❤️  Registering health routes...');
    await fastify.register(healthRoutes, { prefix: '/v1' });

    // Register protected routes (requires auth + rate limiting)
    console.log('[SERVER] 🔒 Registering protected routes...');
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
    console.log('[SERVER] 🚀 Starting Fastify server...');
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`✅ Fastify API Gateway listening on http://${HOST}:${PORT}`);
    console.log(`📊 Health check: http://${HOST}:${PORT}/v1/health`);
    console.log(`🔍 Search endpoint: http://${HOST}:${PORT}/v1/search`);

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n${signal} received, gracefully shutting down...`);
        await fastify.close();
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('❌ Fatal error during server initialization:');
    console.error(err);
    if (err instanceof Error) {
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
    }
    process.exit(1);
  }
}

// Start the server
startServer();
