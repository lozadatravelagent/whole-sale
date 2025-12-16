/**
 * Redis Client and Rate Limiting/Idempotency Functions
 *
 * Centralized Redis client using Upstash REST API
 * Provides rate limiting (sliding window) and idempotency caching
 */

import { Redis } from '@upstash/redis';

// Validate environment variables
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  console.error('[REDIS] ❌ Missing environment variables:');
  console.error(`  - UPSTASH_REDIS_REST_URL: ${redisUrl ? '✅' : '❌ missing'}`);
  console.error(`  - UPSTASH_REDIS_REST_TOKEN: ${redisToken ? '✅' : '❌ missing'}`);
  throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables');
}

console.log('[REDIS] ✅ Initializing Redis client...');

// Initialize Redis client
const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

console.log('[REDIS] ✅ Redis client initialized');

// =========================================================================
// RATE LIMITING (Sliding Window)
// =========================================================================

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_at: Date;
  window: 'minute' | 'hour' | 'day';
  error?: {
    code: string;
    message: string;
    status: number;
  };
}

/**
 * Check rate limit using Redis sliding window
 *
 * @param apiKeyId - API key UUID
 * @param limits - Rate limits for minute/hour/day windows
 * @returns RateLimitResult with allowed status and remaining count
 */
export async function checkRateLimitRedis(
  apiKeyId: string,
  limits: { minute: number; hour: number; day: number }
): Promise<RateLimitResult> {
  const now = Date.now();
  const windows = [
    { name: 'minute' as const, seconds: 60, limit: limits.minute },
    { name: 'hour' as const, seconds: 3600, limit: limits.hour },
    { name: 'day' as const, seconds: 86400, limit: limits.day },
  ];

  for (const { name, seconds, limit } of windows) {
    const windowStart = Math.floor(now / (seconds * 1000));
    const key = `ratelimit:${apiKeyId}:${name}:${windowStart}`;

    // Pipeline: INCR + EXPIRE (atomic operation)
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, seconds + 1);

    const results = await pipeline.exec();
    const count = results[0] as number;

    if (count > limit) {
      const resetAt = new Date((windowStart + 1) * seconds * 1000);
      return {
        allowed: false,
        limit,
        remaining: 0,
        reset_at: resetAt,
        window: name,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded: ${limit} requests per ${name}`,
          status: 429,
        },
      };
    }
  }

  // All rate limits passed - return current minute window stats
  const minuteKey = `ratelimit:${apiKeyId}:minute:${Math.floor(now / 60000)}`;
  const currentCount = (await redis.get<number>(minuteKey)) || 0;

  return {
    allowed: true,
    limit: limits.minute,
    remaining: Math.max(0, limits.minute - currentCount),
    reset_at: new Date(Math.ceil(now / 60000) * 60000),
    window: 'minute',
  };
}

// =========================================================================
// IDEMPOTENCY CACHE
// =========================================================================

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

export { redis };
