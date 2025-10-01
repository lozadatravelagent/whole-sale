import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Generate a consistent cache key from search parameters
 */
export function generateCacheKey(searchType: string, params: Record<string, any>): string {
  // Sort keys for consistent hashing
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, any>);

  const paramsString = JSON.stringify(sortedParams);
  return `${searchType}:${hashString(paramsString)}`;
}

/**
 * Simple hash function for cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get cached search results
 */
export async function getCachedSearch(
  supabase: SupabaseClient,
  searchType: string,
  params: Record<string, any>,
  tenantId?: string
): Promise<any | null> {
  const cacheKey = generateCacheKey(searchType, params);

  const { data, error } = await supabase
    .from('search_cache')
    .select('results, hit_count')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  // Increment hit count asynchronously (fire and forget)
  supabase
    .from('search_cache')
    .update({ hit_count: data.hit_count + 1 })
    .eq('cache_key', cacheKey)
    .then(() => {});

  return data.results;
}

/**
 * Store search results in cache
 */
export async function setCachedSearch(
  supabase: SupabaseClient,
  searchType: string,
  params: Record<string, any>,
  results: any,
  tenantId?: string,
  ttlHours: number = 24
): Promise<void> {
  const cacheKey = generateCacheKey(searchType, params);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);

  const { error } = await supabase
    .from('search_cache')
    .upsert({
      cache_key: cacheKey,
      search_type: searchType,
      params,
      results,
      tenant_id: tenantId,
      expires_at: expiresAt.toISOString(),
      hit_count: 0,
    }, {
      onConflict: 'cache_key'
    });

  if (error) {
    console.error('Error caching search results:', error);
  }
}

/**
 * Invalidate cache for specific search type
 */
export async function invalidateCache(
  supabase: SupabaseClient,
  searchType: string,
  tenantId?: string
): Promise<void> {
  let query = supabase
    .from('search_cache')
    .delete()
    .eq('search_type', searchType);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  await query;
}
