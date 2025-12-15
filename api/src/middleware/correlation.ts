/**
 * Correlation ID Middleware
 *
 * Extracts or generates correlation ID for request tracing
 * Attaches logger instance to request context
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger, extractCorrelationId } from '../lib/logger.js';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
    logger: ReturnType<typeof createLogger>;
  }
}

export async function correlationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Extract or generate correlation ID
  const correlationId = extractCorrelationId(request.headers as Record<string, string | undefined>);

  // Attach to request
  request.correlationId = correlationId;
  request.logger = createLogger(correlationId);

  // Add to response headers
  reply.header('X-Correlation-ID', correlationId);
}
