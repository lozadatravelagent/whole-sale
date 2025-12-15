/**
 * Authentication Middleware
 *
 * Validates API key and attaches authenticated key to request
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../lib/supabase.js';
import { extractApiKey, validateKey, type ApiKey } from '../services/apiKeyAuth.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKey;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Extract API key from headers
  const authHeader = request.headers['authorization'] as string | undefined;
  const apiKeyHeader = (request.headers['x-api-key'] || request.headers['apikey']) as string | undefined;
  const apiKey = extractApiKey(authHeader, apiKeyHeader);

  if (!apiKey) {
    request.logger.warn('AUTH_FAILED', 'Missing API key');
    return reply.status(401).send({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key is required in X-API-Key or Authorization header',
        status: 401
      }
    });
  }

  // Validate API key
  const authResult = await validateKey(apiKey, supabase);

  if (!authResult.success || !authResult.api_key) {
    request.logger.warn('AUTH_FAILED', authResult.error?.message || 'Authentication failed', {
      error_code: authResult.error?.code
    });
    return reply.status(authResult.error?.status || 401).send({
      success: false,
      error: authResult.error
    });
  }

  // Attach authenticated API key to request
  request.apiKey = authResult.api_key;

  request.logger.info('AUTH_SUCCESS', 'API key validated', {
    api_key_prefix: authResult.api_key.key_prefix,
    tenant_id: authResult.api_key.tenant_id
  });
}
