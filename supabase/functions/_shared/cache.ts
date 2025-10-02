import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Smart TTL configuration for different search types
 */
export const CACHE_CONFIG = {
  'searchFlights': {
    soft_ttl_minutes: 2,   // Trigger background refresh after 2 minutes
    hard_ttl_minutes: 30,  // Force API call after 30 minutes
  },
  'searchHotels': {
    soft_ttl_minutes: 5,   // Trigger background refresh after 5 minutes
    hard_ttl_minutes: 60,  // Force API call after 1 hour
  },
  'searchPackages': {
    soft_ttl_minutes: 15,
    hard_ttl_minutes: 120,
  },
  'searchServices': {
    soft_ttl_minutes: 15,
    hard_ttl_minutes: 120,
  },
  'getCountryList': {
    soft_ttl_minutes: 60,   // Static data - refresh after 1 hour
    hard_ttl_minutes: 480,  // Force refresh after 8 hours
  },
  'getAirlineList': {
    soft_ttl_minutes: 60,
    hard_ttl_minutes: 480,
  },
  'default': {
    soft_ttl_minutes: 10,
    hard_ttl_minutes: 60,
  }
};

export type CacheStatus = 'fresh' | 'stale' | 'expired';

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
 * Get cached search results with smart TTL (soft/hard expiration)
 * Returns: { results, status: 'fresh' | 'stale' | 'expired', needsRefresh: boolean }
 */
export async function getCachedSearch(
  supabase: SupabaseClient,
  searchType: string,
  params: Record<string, any>,
  tenantId?: string
): Promise<{ results: any; status: CacheStatus; needsRefresh: boolean } | null> {
  const cacheKey = generateCacheKey(searchType, params);
  const config = CACHE_CONFIG[searchType as keyof typeof CACHE_CONFIG] || CACHE_CONFIG.default;

  const { data, error } = await supabase
    .from('search_cache')
    .select('results, hit_count, created_at, soft_expires_at, hard_expires_at')
    .eq('cache_key', cacheKey)
    .single();

  if (error || !data) {
    return null;
  }

  const now = new Date();
  const softExpiry = new Date(data.soft_expires_at);
  const hardExpiry = new Date(data.hard_expires_at);

  // Check expiration status
  let status: CacheStatus;
  let needsRefresh = false;

  if (now > hardExpiry) {
    // Hard expired - don't use cache
    console.log(`❌ Cache HARD EXPIRED for ${searchType} (age: ${Math.round((now.getTime() - new Date(data.created_at).getTime()) / 60000)} min)`);
    return null;
  } else if (now > softExpiry) {
    // Soft expired - use cache but trigger background refresh
    status = 'stale';
    needsRefresh = true;
    console.log(`⚠️ Cache STALE for ${searchType} - will refresh in background`);
  } else {
    // Fresh cache
    status = 'fresh';
    console.log(`✅ Cache FRESH for ${searchType} (age: ${Math.round((now.getTime() - new Date(data.created_at).getTime()) / 1000)} sec)`);
  }

  // Increment hit count asynchronously (fire and forget)
  supabase
    .from('search_cache')
    .update({ hit_count: data.hit_count + 1 })
    .eq('cache_key', cacheKey)
    .then(() => {});

  return {
    results: data.results,
    status,
    needsRefresh
  };
}

/**
 * Store search results in cache with smart soft/hard TTL
 */
export async function setCachedSearch(
  supabase: SupabaseClient,
  searchType: string,
  params: Record<string, any>,
  results: any,
  tenantId?: string
): Promise<void> {
  const cacheKey = generateCacheKey(searchType, params);
  const config = CACHE_CONFIG[searchType as keyof typeof CACHE_CONFIG] || CACHE_CONFIG.default;

  const now = new Date();
  const softExpiresAt = new Date(now.getTime() + config.soft_ttl_minutes * 60 * 1000);
  const hardExpiresAt = new Date(now.getTime() + config.hard_ttl_minutes * 60 * 1000);

  console.log(`💾 Caching ${searchType} with soft TTL: ${config.soft_ttl_minutes}min, hard TTL: ${config.hard_ttl_minutes}min`);

  const { error } = await supabase
    .from('search_cache')
    .upsert({
      cache_key: cacheKey,
      search_type: searchType,
      params,
      results,
      tenant_id: tenantId,
      soft_expires_at: softExpiresAt.toISOString(),
      hard_expires_at: hardExpiresAt.toISOString(),
      hit_count: 0,
    }, {
      onConflict: 'cache_key'
    });

  if (error) {
    console.error('Error caching search results:', error);
  }
}

/**
 * Trigger background refresh for stale cache
 * This is called asynchronously - doesn't block the response to user
 */
export async function triggerBackgroundRefresh(
  supabase: SupabaseClient,
  searchType: string,
  params: Record<string, any>,
  functionUrl: string
): Promise<void> {
  console.log(`🔄 Triggering background refresh for ${searchType}`);

  // Call the search function again in the background to update cache
  // This is fire-and-forget - we don't wait for the response
  fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
    },
    body: JSON.stringify({
      action: searchType,
      data: params,
      _background_refresh: true, // Flag to indicate this is a background refresh
    }),
  }).catch(err => {
    console.error(`Failed to trigger background refresh for ${searchType}:`, err);
  });
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
