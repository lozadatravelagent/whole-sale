/**
 * API Key Authentication Service (Node.js version)
 *
 * Validates API keys, checks scopes, and updates usage stats
 * Ported from Deno Edge Functions to Node.js/Fastify
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

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

/**
 * Extract API key from headers
 * Tries X-API-Key first, then falls back to Authorization
 */
export function extractApiKey(authHeader: string | undefined, apiKeyHeader?: string | undefined): string | null {
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
function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Validate and retrieve API key from database
 */
export async function validateKey(
  apiKey: string,
  supabaseClient: SupabaseClient
): Promise<AuthResult> {
  try {
    // Hash the provided key
    const keyHash = hashApiKey(apiKey);

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
 * Update usage statistics for API key
 */
export async function updateUsageStats(
  apiKeyId: string,
  supabaseClient: SupabaseClient
): Promise<void> {
  try {
    await supabaseClient
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
      })
      .eq('id', apiKeyId);

    // Increment usage_count (done via trigger in Supabase)
    console.log(`[API_KEY_AUTH] Updated usage stats for key: ${apiKeyId}`);
  } catch (err) {
    console.error('[API_KEY_AUTH] Error updating usage stats:', err);
    // Don't fail the request if usage stats update fails
  }
}
