/**
 * Redis-based Rate Limiting
 *
 * Sliding window rate limiter using Redis INCR + EXPIRE
 * Replaces 3 COUNT queries to PostgreSQL with O(1) Redis operations
 */

import { Redis } from 'https://esm.sh/@upstash/redis@1.28.0';

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_REST_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!,
});

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_at: Date;
  window: 'minute' | 'hour' | 'day';
  error?: { code: string; message: string; status: number };
}

/**
 * Check rate limit using Redis sliding window
 *
 * Uses atomic INCR + EXPIRE operations for accurate counting
 * Checks minute, hour, and day windows in sequence
 *
 * @param apiKeyId - API key UUID
 * @param limits - Rate limits per window { minute, hour, day }
 * @returns RateLimitResult with allowed/remaining/reset_at
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

    // Pipeline: INCR + EXPIRE (atomic)
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, seconds + 1); // +1 to avoid edge cases

    const results = await pipeline.exec();
    const count = results[0] as number;

    if (count > limit) {
      const resetAt = new Date((windowStart + 1) * seconds * 1000);
      console.warn(`[RATE_LIMIT_REDIS] ❌ Exceeded for ${apiKeyId} (${name}): ${count}/${limit}`);

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

  // All windows passed - calculate remaining for minute window
  const minuteKey = `ratelimit:${apiKeyId}:minute:${Math.floor(now / 60000)}`;
  const currentCount = (await redis.get<number>(minuteKey)) || 0;

  console.log(`[RATE_LIMIT_REDIS] ✅ Allowed for ${apiKeyId}: ${currentCount}/${limits.minute} (minute)`);

  return {
    allowed: true,
    limit: limits.minute,
    remaining: Math.max(0, limits.minute - currentCount),
    reset_at: new Date(Math.ceil(now / 60000) * 60000),
    window: 'minute',
  };
}
