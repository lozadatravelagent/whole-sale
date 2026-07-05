/**
 * API usage tracking middleware.
 *
 * Records one immutable event for every request that has passed API-key auth.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabase } from '../lib/supabase.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiUsageStartedAt?: number;
    apiUsageCached?: boolean;
    apiUsageRequestId?: string;
    apiUsageErrorCode?: string;
  }
}

export async function usageStartMiddleware(request: FastifyRequest) {
  request.apiUsageStartedAt = Date.now();
}

function extractRequestId(request: FastifyRequest): string | null {
  if (request.apiUsageRequestId) {
    return request.apiUsageRequestId;
  }

  const body = request.body;
  if (!body || typeof body !== 'object') {
    return null;
  }

  const maybeRequestId = (body as Record<string, unknown>).request_id
    || (body as Record<string, unknown>).requestId;

  return typeof maybeRequestId === 'string' ? maybeRequestId : null;
}

function normalizeEndpoint(request: FastifyRequest): string {
  return request.url.split('?')[0] || request.url;
}

export async function usageRecordMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.apiKey) {
    return;
  }

  const startedAt = request.apiUsageStartedAt || Date.now();
  const durationMs = Math.max(0, Date.now() - startedAt);

  const { error } = await supabase
    .from('api_usage_events')
    .insert({
      api_key_id: request.apiKey.id,
      tenant_id: request.apiKey.tenant_id,
      agency_id: request.apiKey.agency_id,
      endpoint: normalizeEndpoint(request),
      method: request.method,
      request_id: extractRequestId(request),
      correlation_id: request.correlationId,
      status_code: reply.statusCode,
      duration_ms: durationMs,
      cached: Boolean(request.apiUsageCached),
      error_code: request.apiUsageErrorCode || null,
      user_agent: request.headers['user-agent'] || null,
      metadata: {
        environment: request.apiKey.environment,
        api_key_prefix: request.apiKey.key_prefix,
      },
    });

  if (error) {
    request.logger.error('API_USAGE_LOG_FAILED', 'Failed to persist API usage event', {
      error: error.message,
      api_key_prefix: request.apiKey.key_prefix,
      endpoint: normalizeEndpoint(request),
      status_code: reply.statusCode,
    });
  }
}
