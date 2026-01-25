/**
 * API Key Authentication & Rate Limiting Helper
 *
 * Valida API keys, verifica scopes y aplica rate limiting.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export interface ApiKey {
  id: string;
  key_prefix: string;
  key_hash: string;
  tenant_id: string;
  agency_id: string | null;
  scopes: string[];
  rate_limit_per_minute: number;
  rate_limit_per_hour: number;
  rate_limit_per_day: number;
  name: string | null;
  environment: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
}

export interface AuthResult {
  success: boolean;
  api_key?: ApiKey;
  error?: {
    code: string;
    message: string;
    status: number;
  };
}

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
 * Extract API key from headers
 * Tries X-API-Key first, then falls back to Authorization
 */
export function extractApiKey(authHeader: string | null, apiKeyHeader?: string | null): string | null {
  // First try X-API-Key header (preferred for custom API keys)
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Fall back to Authorization header
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <key>" and raw key
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return authHeader;
}

/**
 * Hash API key using SHA-256
 */
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Validate and retrieve API key from database
 */
export async function validateKey(
  apiKey: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<AuthResult> {
  try {
    // Hash the provided key
    const keyHash = await hashApiKey(apiKey);

    // Query database for API key
    const { data, error } = await supabaseClient
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .single();

    if (error || !data) {
      console.warn('[API_KEY_AUTH] Invalid API key provided');
      return {
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid or expired API key',
          status: 401
        }
      };
    }

    // Check if key is active
    if (!data.is_active) {
      console.warn(`[API_KEY_AUTH] Inactive API key: ${data.key_prefix}`);
      return {
        success: false,
        error: {
          code: 'INACTIVE_API_KEY',
          message: 'API key has been revoked',
          status: 401
        }
      };
    }

    // Check if key has expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      console.warn(`[API_KEY_AUTH] Expired API key: ${data.key_prefix}`);
      return {
        success: false,
        error: {
          code: 'EXPIRED_API_KEY',
          message: 'API key has expired',
          status: 401
        }
      };
    }

    console.log(`[API_KEY_AUTH] ✅ Valid API key: ${data.key_prefix} (tenant: ${data.tenant_id})`);
    return {
      success: true,
      api_key: data as ApiKey
    };
  } catch (err) {
    console.error('[API_KEY_AUTH] Error validating API key:', err);
    return {
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication error',
        status: 500
      }
    };
  }
}

/**
 * Check if API key has required scope
 */
export function checkScopes(apiKey: ApiKey, requiredScope: string): boolean {
  // 'search:*' grants all search scopes
  if (apiKey.scopes.includes('search:*')) {
    return true;
  }

  // Check if exact scope exists
  if (apiKey.scopes.includes(requiredScope)) {
    return true;
  }

  console.warn(`[API_KEY_AUTH] Missing scope: ${requiredScope} (has: ${apiKey.scopes.join(', ')})`);
  return false;
}

/**
 * Check rate limits for API key
 */
export async function checkRateLimit(
  apiKey: ApiKey,
  supabaseClient: ReturnType<typeof createClient>
): Promise<RateLimitResult> {
  try {
    const now = new Date();

    // Check per-minute rate limit
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const { count: minuteCount } = await supabaseClient
      .from('api_request_cache')
      .select('*', { count: 'exact', head: true })
      .eq('api_key_id', apiKey.id)
      .gte('created_at', oneMinuteAgo.toISOString());

    if ((minuteCount || 0) >= apiKey.rate_limit_per_minute) {
      const resetAt = new Date(oneMinuteAgo.getTime() + 60 * 1000);
      return {
        allowed: false,
        limit: apiKey.rate_limit_per_minute,
        remaining: 0,
        reset_at: resetAt,
        window: 'minute',
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded: ${apiKey.rate_limit_per_minute} requests per minute`,
          status: 429
        }
      };
    }

    // Check per-hour rate limit
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const { count: hourCount } = await supabaseClient
      .from('api_request_cache')
      .select('*', { count: 'exact', head: true })
      .eq('api_key_id', apiKey.id)
      .gte('created_at', oneHourAgo.toISOString());

    if ((hourCount || 0) >= apiKey.rate_limit_per_hour) {
      const resetAt = new Date(oneHourAgo.getTime() + 60 * 60 * 1000);
      return {
        allowed: false,
        limit: apiKey.rate_limit_per_hour,
        remaining: 0,
        reset_at: resetAt,
        window: 'hour',
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded: ${apiKey.rate_limit_per_hour} requests per hour`,
          status: 429
        }
      };
    }

    // Check per-day rate limit
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { count: dayCount } = await supabaseClient
      .from('api_request_cache')
      .select('*', { count: 'exact', head: true })
      .eq('api_key_id', apiKey.id)
      .gte('created_at', oneDayAgo.toISOString());

    if ((dayCount || 0) >= apiKey.rate_limit_per_day) {
      const resetAt = new Date(oneDayAgo.getTime() + 24 * 60 * 60 * 1000);
      return {
        allowed: false,
        limit: apiKey.rate_limit_per_day,
        remaining: 0,
        reset_at: resetAt,
        window: 'day',
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded: ${apiKey.rate_limit_per_day} requests per day`,
          status: 429
        }
      };
    }

    // All rate limits passed
    const remaining = apiKey.rate_limit_per_minute - (minuteCount || 0);
    const resetAt = new Date(oneMinuteAgo.getTime() + 60 * 1000);

    return {
      allowed: true,
      limit: apiKey.rate_limit_per_minute,
      remaining,
      reset_at: resetAt,
      window: 'minute'
    };
  } catch (err) {
    console.error('[API_KEY_AUTH] Error checking rate limit:', err);
    // On error, allow the request but log it
    return {
      allowed: true,
      limit: apiKey.rate_limit_per_minute,
      remaining: apiKey.rate_limit_per_minute,
      reset_at: new Date(Date.now() + 60 * 1000),
      window: 'minute'
    };
  }
}

/**
 * Update usage statistics for API key
 */
export async function updateUsageStats(
  apiKeyId: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<void> {
  try {
    await supabaseClient
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: supabaseClient.rpc('increment', { row_id: apiKeyId })
      })
      .eq('id', apiKeyId);

    console.log(`[API_KEY_AUTH] Updated usage stats for key: ${apiKeyId}`);
  } catch (err) {
    console.error('[API_KEY_AUTH] Error updating usage stats:', err);
    // Don't fail the request if usage stats update fails
  }
}

/**
 * Generate rate limit headers for response
 */
export function getRateLimitHeaders(rateLimitResult: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': rateLimitResult.limit.toString(),
    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(rateLimitResult.reset_at.getTime() / 1000).toString(),
    'X-RateLimit-Window': rateLimitResult.window
  };
}
