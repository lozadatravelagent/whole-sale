/**
 * CORS Middleware Configuration
 *
 * Configures CORS headers for the Fastify API
 */

export const corsOptions = {
  origin: true, // Allow all origins (change to whitelist in production)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Correlation-ID',
    'apikey',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-RateLimit-Window',
    'X-Correlation-ID',
  ],
};
