/**
 * Idempotency Helper
 *
 * Gestiona cache de requests para prevenir búsquedas duplicadas cuando el cliente hace retry.
 * TTL: 5 minutos
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export interface CachedResponse {
  request_id: string;
  search_id: string;
  response_data: any;
  api_key_id: string;
  created_at: string;
  expires_at: string;
}

export interface CheckCacheResult {
  exists: boolean;
  data?: any;
  cached_at?: string;
}

/**
 * Check if a request_id exists in cache and is still valid
 */
export async function checkCache(
  request_id: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<CheckCacheResult> {
  try {
    const { data, error } = await supabaseClient
      .from('api_request_cache')
      .select('*')
      .eq('request_id', request_id)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      // No cache found or expired
      if (error.code === 'PGRST116') {
        console.log(`[IDEMPOTENCY] No cache found for request_id: ${request_id}`);
        return { exists: false };
      }

      console.error('[IDEMPOTENCY] Error checking cache:', error);
      return { exists: false };
    }

    if (data) {
      console.log(`[IDEMPOTENCY] ✅ Cache HIT for request_id: ${request_id} (cached at: ${data.created_at})`);
      return {
        exists: true,
        data: data.response_data,
        cached_at: data.created_at
      };
    }

    return { exists: false };
  } catch (err) {
    console.error('[IDEMPOTENCY] Unexpected error checking cache:', err);
    return { exists: false };
  }
}

/**
 * Save a response to cache with 5 minute TTL
 */
export async function saveCache(
  request_id: string,
  search_id: string,
  response_data: any,
  api_key_id: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from('api_request_cache')
      .insert({
        request_id,
        search_id,
        response_data,
        api_key_id,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
      });

    if (error) {
      console.error('[IDEMPOTENCY] Error saving cache:', error);
      return false;
    }

    console.log(`[IDEMPOTENCY] ✅ Saved cache for request_id: ${request_id}, search_id: ${search_id}`);
    return true;
  } catch (err) {
    console.error('[IDEMPOTENCY] Unexpected error saving cache:', err);
    return false;
  }
}

/**
 * Generate a unique search_id
 */
export function generateSearchId(): string {
  return `srch_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Validate request_id format (should be a valid UUID or custom format)
 */
export function validateRequestId(request_id: string): boolean {
  if (!request_id || typeof request_id !== 'string') {
    return false;
  }

  // Allow UUID format or custom format starting with "req_"
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const customRegex = /^req_[a-zA-Z0-9_-]{10,}$/;

  return uuidRegex.test(request_id) || customRegex.test(request_id);
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats(
  api_key_id: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<{
  total_cached: number;
  valid_cached: number;
  expired_cached: number;
}> {
  try {
    // Total cache entries for this API key
    const { count: total } = await supabaseClient
      .from('api_request_cache')
      .select('*', { count: 'exact', head: true })
      .eq('api_key_id', api_key_id);

    // Valid (non-expired) entries
    const { count: valid } = await supabaseClient
      .from('api_request_cache')
      .select('*', { count: 'exact', head: true })
      .eq('api_key_id', api_key_id)
      .gt('expires_at', new Date().toISOString());

    const totalCached = total || 0;
    const validCached = valid || 0;
    const expiredCached = totalCached - validCached;

    return {
      total_cached: totalCached,
      valid_cached: validCached,
      expired_cached: expiredCached
    };
  } catch (err) {
    console.error('[IDEMPOTENCY] Error getting cache stats:', err);
    return {
      total_cached: 0,
      valid_cached: 0,
      expired_cached: 0
    };
  }
}
