/**
 * CORS Middleware Configuration
 *
 * Configures CORS headers for the Fastify API
 */

export const corsOptions = {
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:8080,http://localhost:5173')
    .split(',')
    .map(o => o.trim()),
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
