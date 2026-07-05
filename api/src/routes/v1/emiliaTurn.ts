/**
 * Emilia Turn Route
 *
 * Public API turn endpoint. The gateway owns API-key auth, scope checks,
 * rate limiting and idempotency; the Supabase Edge runtime owns Emilia state
 * and message persistence.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { checkCacheRedis, generateSearchId, saveCacheRedis } from '../../lib/redis.js';
import { checkScopes, updateUsageStats } from '../../services/apiKeyAuth.js';

const requestIdSchema = z.string().regex(
  /^(req_[a-zA-Z0-9_-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/,
  'request_id must be a valid UUID or format "req_<string>"',
);

const emiliaTurnSchema = z.object({
  request_id: requestIdSchema,
  message: z.string().trim().min(1),
  conversation_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  mode: z.enum(['agency', 'passenger']).default('agency'),
  workspace_mode: z.enum(['standard', 'planner', 'companion']).default('standard'),
  planner_state: z.unknown().nullable().optional(),
  language: z.enum(['es', 'en', 'pt']).optional(),
  external_conversation_ref: z.string().trim().min(1).max(180).optional(),
});

type EmiliaTurnRequest = z.infer<typeof emiliaTurnSchema>;

export async function emiliaTurnRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: EmiliaTurnRequest }>('/emilia/turn', async (request, reply) => {
    const startTime = Date.now();

    if (!request.apiKey) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'API key context is missing after auth middleware',
          status: 500,
        },
      });
    }

    if (!checkScopes(request.apiKey, 'emilia:turn')) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: 'API key must include emilia:turn or emilia:*',
          status: 403,
        },
      });
    }

    if (!request.apiKey.agency_id) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'API_KEY_MISSING_AGENCY',
          message: 'This endpoint requires an API key associated with an agency',
          status: 403,
        },
      });
    }

    const parsedBody = emiliaTurnSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid Emilia turn request',
          details: parsedBody.error.flatten(),
          status: 400,
        },
      });
    }

    const body = parsedBody.data;
    const apiTurnBody: EmiliaTurnRequest = {
      ...body,
      mode: 'agency',
      workspace_mode: 'standard',
      planner_state: null,
    };
    request.apiUsageRequestId = body.request_id;
    const turnId = generateSearchId().replace(/^srch_/, 'turn_');

    const cacheResult = await checkCacheRedis(body.request_id);
    if (cacheResult.exists && cacheResult.data) {
      request.apiUsageCached = true;
      request.logger.info('CACHE_HIT', `Returning cached Emilia turn for request_id: ${body.request_id}`, {
        cached_at: cacheResult.cached_at,
      });
      return reply.send(cacheResult.data);
    }

    try {
      request.logger.info('EMILIA_TURN_INVOKE', 'Calling emilia-turn Edge runtime', {
        request_id: body.request_id,
        conversation_id: body.conversation_id,
        requested_mode: body.mode,
        requested_workspace_mode: body.workspace_mode,
        effective_mode: apiTurnBody.mode,
        effective_workspace_mode: apiTurnBody.workspace_mode,
        api_key_prefix: request.apiKey.key_prefix,
      });

      const edgeStart = Date.now();
      const edgeResponse = await fastify.supabase.functions.invoke('emilia-turn', {
        body: {
          ...apiTurnBody,
          api_key_context: {
            id: request.apiKey.id,
            key_prefix: request.apiKey.key_prefix,
            tenant_id: request.apiKey.tenant_id,
            agency_id: request.apiKey.agency_id,
            created_by: request.apiKey.created_by,
            scopes: request.apiKey.scopes,
            environment: request.apiKey.environment,
            name: request.apiKey.name,
          },
        },
      });

      const edgeTimeMs = Date.now() - edgeStart;

      if (edgeResponse.error) {
        const context = (edgeResponse.error as { context?: { status?: number; json?: () => Promise<unknown> } }).context;
        const errorBody = context?.json ? await context.json().catch(() => null) : null;
        const status = Number((errorBody as { error?: { status?: number } } | null)?.error?.status || context?.status || 500);
        const response = {
          ...(errorBody && typeof errorBody === 'object'
            ? errorBody as Record<string, unknown>
            : {
                success: false,
                error: {
                  code: 'EMILIA_TURN_ERROR',
                  message: edgeResponse.error.message || 'emilia-turn Edge runtime failed',
                  status,
                },
              }),
          request_id: body.request_id,
          metadata: {
            gateway: 'fastify',
            runtime: 'emilia-turn',
            edge_time_ms: edgeTimeMs,
            total_time_ms: Date.now() - startTime,
          },
        };

        await saveCacheRedis(body.request_id, turnId, response, request.apiKey.id);
        await updateUsageStats(request.apiKey.id, fastify.supabase);
        return reply.status(status).send(response);
      }

      const edgeData = edgeResponse.data;
      const status = Number(edgeData?.error?.status || (edgeData?.success === false ? 500 : 200));
      const response = {
        ...edgeData,
        request_id: body.request_id,
        metadata: {
          ...(edgeData?.metadata || {}),
          gateway: 'fastify',
          runtime: 'emilia-turn',
          edge_time_ms: edgeTimeMs,
          total_time_ms: Date.now() - startTime,
        },
      };

      await saveCacheRedis(body.request_id, turnId, response, request.apiKey.id);
      await updateUsageStats(request.apiKey.id, fastify.supabase);

      return reply.status(status).send(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      request.logger.error('EMILIA_TURN_ERROR', 'Emilia turn failed', {
        request_id: body.request_id,
        error: message,
      });

      const response = {
        success: false,
        request_id: body.request_id,
        error: {
          code: 'EMILIA_TURN_ERROR',
          message: 'Emilia turn failed. Please try again.',
          status: 500,
        },
        metadata: {
          gateway: 'fastify',
          runtime: 'emilia-turn',
          total_time_ms: Date.now() - startTime,
        },
      };

      await saveCacheRedis(body.request_id, turnId, response, request.apiKey.id);
      return reply.status(500).send(response);
    }
  });
}
