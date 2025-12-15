/**
 * Cloudflare Worker: Vibook API Router
 *
 * Routes:
 * - /search → Supabase Edge Functions (legacy)
 * - /v1/* → Railway Fastify API (new)
 *
 * Deploy: Cloudflare Dashboard → Workers & Pages → Create Worker
 * Custom Domain: api.vibook.ai
 */

const SUPABASE_URL = 'https://ujigyazketblwlzcomve.supabase.co/functions/v1/api-search';
const RAILWAY_URL = 'https://whole-sale-production.up.railway.app';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsemNvbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODk2MTEsImV4cCI6MjA3MjM2NTYxMX0.X6YvJfgQnCAzFXa37nli47yQxuRG-7WJnJeIDrqg5EA';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Health check del worker
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(JSON.stringify({
        status: 'ok',
        worker: 'vibook-api-router',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        routes: {
          legacy: '/search → Supabase Edge Functions',
          v1: '/v1/* → Railway Fastify API'
        }
      }, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders()
        }
      });
    }

    // Ruta /v1/* → Railway Fastify API
    if (url.pathname.startsWith('/v1/')) {
      return proxyToRailway(request, url);
    }

    // Ruta /search → Supabase Edge Functions (legacy)
    if (url.pathname === '/search') {
      return proxyToSupabase(request);
    }

    // 404 para rutas no reconocidas
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: 'Valid routes: /search (legacy), /v1/search (new), /v1/health, /health',
      documentation: 'https://github.com/lozadatravelagent/whole-sale/blob/main/CLOUDFLARE_PROXY_FASTIFY_GUIDE.md'
    }, null, 2), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders()
      }
    });
  }
};

/**
 * Proxy request to Railway Fastify API
 */
async function proxyToRailway(request, url) {
  const targetUrl = new URL(url.pathname + url.search, RAILWAY_URL);

  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  try {
    const response = await fetch(modifiedRequest);

    // Clone response to modify headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-Proxy-Source', 'cloudflare-worker');
    newHeaders.set('X-Gateway', 'railway-fastify');

    // Add CORS headers
    Object.entries(getCORSHeaders()).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Gateway Error',
      message: 'Failed to connect to Railway Fastify API',
      details: error.message
    }, null, 2), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders()
      }
    });
  }
}

/**
 * Proxy request to Supabase Edge Functions (legacy)
 */
async function proxyToSupabase(request) {
  const headers = new Headers(request.headers);

  // Add Supabase anon key if not present
  if (!headers.has('apikey')) {
    headers.set('apikey', SUPABASE_ANON_KEY);
  }
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
  }

  const modifiedRequest = new Request(SUPABASE_URL, {
    method: request.method,
    headers: headers,
    body: request.body,
  });

  try {
    const response = await fetch(modifiedRequest);

    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-Proxy-Source', 'cloudflare-worker');
    newHeaders.set('X-Gateway', 'supabase-edge-functions');

    // Add CORS headers
    Object.entries(getCORSHeaders()).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Gateway Error',
      message: 'Failed to connect to Supabase Edge Functions',
      details: error.message
    }, null, 2), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders()
      }
    });
  }
}

/**
 * Get CORS headers
 */
function getCORSHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Correlation-ID, apikey',
    'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Window, X-Correlation-ID, X-Gateway, X-Proxy-Source',
    'Access-Control-Max-Age': '86400'
  };
}

/**
 * Handle CORS preflight
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: getCORSHeaders()
  });
}
