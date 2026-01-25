/**
 * API Authentication Edge Function
 *
 * Valida API keys, verifica scopes y aplica rate limiting.
 * Esta función es invocada por api-search antes de procesar cualquier búsqueda.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  extractApiKey,
  validateKey,
  checkScopes,
  checkRateLimit,
  getRateLimitHeaders,
  type ApiKey
} from '../_shared/apiKeyAuth.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface AuthRequest {
  required_scope?: string;
}

interface AuthResponse {
  success: boolean;
  api_key?: {
    id: string;
    tenant_id: string;
    agency_id: string | null;
    scopes: string[];
    environment: string;
  };
  error?: {
    code: string;
    message: string;
    status: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Only POST method is allowed',
          status: 405
        }
      }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract API key from Authorization header
    const authHeader = req.headers.get('Authorization');
    const apiKey = extractApiKey(authHeader);

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: 'API key is required. Provide it in the Authorization header.',
            status: 401
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body (optional - for scope checking)
    let requestBody: AuthRequest = {};
    try {
      requestBody = await req.json();
    } catch {
      // Empty body is ok
    }

    // Validate API key
    const authResult = await validateKey(apiKey, supabase);
    if (!authResult.success || !authResult.api_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: authResult.error
        }),
        {
          status: authResult.error?.status || 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const validatedKey: ApiKey = authResult.api_key;

    // Check scopes if required_scope is provided
    if (requestBody.required_scope) {
      const hasScope = checkScopes(validatedKey, requestBody.required_scope);
      if (!hasScope) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'INSUFFICIENT_SCOPE',
              message: `Missing required scope: ${requestBody.required_scope}`,
              status: 403,
              required_scope: requestBody.required_scope,
              available_scopes: validatedKey.scopes
            }
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Check rate limits
    const rateLimitResult = await checkRateLimit(validatedKey, supabase);
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: rateLimitResult.error
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            ...rateLimitHeaders,
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(
              (rateLimitResult.reset_at.getTime() - Date.now()) / 1000
            ).toString()
          }
        }
      );
    }

    // Success - return validated API key info
    const response: AuthResponse = {
      success: true,
      api_key: {
        id: validatedKey.id,
        tenant_id: validatedKey.tenant_id,
        agency_id: validatedKey.agency_id,
        scopes: validatedKey.scopes,
        environment: validatedKey.environment
      }
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          ...rateLimitHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('[API_AUTH] Unexpected error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal authentication error',
          status: 500
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
