/**
 * Redis-based Idempotency Cache
 *
 * Stores responses by request_id to prevent duplicate processing
 * TTL: 5 minutes (300 seconds)
 * Key pattern: idempotency:{request_id}
 */

import { Redis } from 'https://esm.sh/@upstash/redis@1.28.0';

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_REST_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!,
});

const TTL_SECONDS = 300; // 5 minutes

export interface CachedResponse {
  request_id: string;
  search_id: string;
  response_data: any;
  api_key_id: string;
  created_at: string;
}

export interface CheckCacheResult {
  exists: boolean;
  data?: any;
  cached_at?: string;
}

/**
 * Check if request_id exists in Redis cache
 *
 * @param request_id - Unique request identifier (UUID or req_<string>)
 * @returns CheckCacheResult with exists, data, cached_at
 */
export async function checkCacheRedis(request_id: string): Promise<CheckCacheResult> {
  const key = `idempotency:${request_id}`;

  try {
    const cached = await redis.get<CachedResponse>(key);

    if (cached) {
      console.log(`[IDEMPOTENCY_REDIS] ✅ Cache HIT for ${request_id} (cached at: ${cached.created_at})`);
      return {
        exists: true,
        data: cached.response_data,
        cached_at: cached.created_at,
      };
    }

    console.log(`[IDEMPOTENCY_REDIS] ❌ Cache MISS for ${request_id}`);
    return { exists: false };
  } catch (err) {
    console.error('[IDEMPOTENCY_REDIS] Error checking cache:', err);
    return { exists: false };
  }
}

/**
 * Save response to Redis cache with 5 minute TTL
 *
 * @param request_id - Unique request identifier
 * @param search_id - Generated search ID
 * @param response_data - Full response object to cache
 * @param api_key_id - API key UUID (for tracking)
 * @returns boolean - true if saved successfully
 */
export async function saveCacheRedis(
  request_id: string,
  search_id: string,
  response_data: any,
  api_key_id: string
): Promise<boolean> {
  const key = `idempotency:${request_id}`;

  const cached: CachedResponse = {
    request_id,
    search_id,
    response_data,
    api_key_id,
    created_at: new Date().toISOString(),
  };

  try {
    await redis.set(key, cached, { ex: TTL_SECONDS });
    console.log(`[IDEMPOTENCY_REDIS] ✅ Saved ${request_id} with TTL ${TTL_SECONDS}s`);
    return true;
  } catch (err) {
    console.error('[IDEMPOTENCY_REDIS] Error saving cache:', err);
    return false;
  }
}

/**
 * Generate unique search_id
 * Format: srch_<timestamp>_<random>
 */
export function generateSearchId(): string {
  return `srch_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
