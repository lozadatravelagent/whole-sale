import { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number;
  reset_at: string;
}

export interface RateLimitOptions {
  action: 'search' | 'message' | 'api_call';
  windowMinutes?: number; // Default 60 (1 hour)
  resource?: string; // Optional: specific resource being accessed
}

/**
 * Check if a user is within their rate limit
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { action, windowMinutes = 60, resource } = options;

  try {
    // Call database function to check rate limit
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId,
      p_tenant_id: tenantId,
      p_action: action,
      p_window_minutes: windowMinutes
    });

    if (error) {
      console.error('❌ Rate limit check error:', error);
      // Fail open - allow request if rate limit check fails
      return {
        allowed: true,
        limit: 1000,
        current: 0,
        remaining: 1000,
        reset_at: new Date(Date.now() + windowMinutes * 60 * 1000).toISOString()
      };
    }

    return data as RateLimitResult;
  } catch (error) {
    console.error('❌ Rate limit check exception:', error);
    // Fail open
    return {
      allowed: true,
      limit: 1000,
      current: 0,
      remaining: 1000,
      reset_at: new Date(Date.now() + windowMinutes * 60 * 1000).toISOString()
    };
  }
}

/**
 * Record rate limit usage (call after successful request)
 */
export async function recordRateLimitUsage(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  action: string,
  resource?: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('record_rate_limit_usage', {
      p_user_id: userId,
      p_tenant_id: tenantId,
      p_action: action,
      p_resource: resource
    });

    if (error) {
      console.error('❌ Failed to record rate limit usage:', error);
      // Don't throw - this is fire-and-forget
    }
  } catch (error) {
    console.error('❌ Exception recording rate limit usage:', error);
    // Don't throw - this is fire-and-forget
  }
}

/**
 * Create rate limit exceeded response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  const resetDate = new Date(result.reset_at);
  const retryAfterSeconds = Math.ceil((resetDate.getTime() - Date.now()) / 1000);

  return new Response(JSON.stringify({
    success: false,
    error: 'Rate limit exceeded',
    message: `You have exceeded your rate limit of ${result.limit} requests. Please try again later.`,
    limit: result.limit,
    current: result.current,
    remaining: result.remaining,
    reset_at: result.reset_at,
    retry_after: retryAfterSeconds
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': retryAfterSeconds.toString(),
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.reset_at
    }
  });
}

/**
 * Extract user and tenant IDs from request headers
 * Returns null if not authenticated (anonymous user)
 */
export function extractIdentifiers(req: Request): { userId: string | null, tenantId: string | null } {
  // Try to get from custom headers (set by frontend)
  const userId = req.headers.get('x-user-id');
  const tenantId = req.headers.get('x-tenant-id');

  if (userId && tenantId) {
    return { userId, tenantId };
  }

  // Try to extract from Authorization header (JWT)
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const payload = JSON.parse(atob(token.split('.')[1]));

      return {
        userId: payload.sub || null,
        tenantId: payload.tenant_id || null
      };
    } catch (error) {
      console.warn('Failed to parse JWT:', error);
    }
  }

  // Anonymous user
  return { userId: null, tenantId: null };
}

/**
 * Apply rate limiting to a request handler
 * Middleware-style wrapper
 */
export async function withRateLimit(
  req: Request,
  supabase: SupabaseClient,
  options: RateLimitOptions,
  handler: () => Promise<Response>
): Promise<Response> {
  // Extract identifiers
  const { userId, tenantId } = extractIdentifiers(req);

  // Skip rate limiting for anonymous users (rely on Cloudflare)
  if (!userId || !tenantId) {
    console.log('⚠️ Skipping rate limit check for anonymous user');
    return await handler();
  }

  // Check rate limit
  const rateLimitResult = await checkRateLimit(supabase, userId, tenantId, options);

  if (!rateLimitResult.allowed) {
    console.warn(`🚫 Rate limit exceeded for user ${userId} (${options.action})`);
    return createRateLimitResponse(rateLimitResult);
  }

  // Log remaining requests
  console.log(`✅ Rate limit OK: ${rateLimitResult.remaining}/${rateLimitResult.limit} remaining`);

  // Execute handler
  const response = await handler();

  // Record usage (fire and forget)
  if (response.status < 400) {
    recordRateLimitUsage(supabase, userId, tenantId, options.action, options.resource);
  }

  // Add rate limit headers to response
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
  headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
  headers.set('X-RateLimit-Reset', rateLimitResult.reset_at);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}
