/**
 * Cloudflare Worker: Vibook API Proxy to Railway Fastify Gateway
 *
 * Routes all traffic to Railway Fastify API Gateway
 * No legacy Supabase support (fresh start)
 *
 * Deploy: Cloudflare Dashboard → Workers & Pages → vibook-api-proxy
 * Custom Domain: api.vibook.ai
 */

const RAILWAY_URL = 'https://whole-sale-production.up.railway.app';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCORSHeaders()
      });
    }

    // Health check del worker
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        worker: 'vibook-api-proxy',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        backend: 'Railway Fastify API Gateway',
        backend_url: RAILWAY_URL
      }, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders()
        }
      });
    }

    // Mapeo de rutas para Railway Fastify
    let railwayPath = url.pathname;

    // /search → /v1/search (Fastify espera /v1/search)
    if (url.pathname === '/search') {
      railwayPath = '/v1/search';
    }
    // /auth → /v1/auth (si implementas auth en el futuro)
    else if (url.pathname === '/auth') {
      railwayPath = '/v1/auth';
    }
    // Rutas que ya son /v1/* pasan directo
    else if (url.pathname.startsWith('/v1/')) {
      railwayPath = url.pathname;
    }
    // Cualquier otra ruta → agregar /v1/ prefix
    else {
      railwayPath = '/v1' + url.pathname;
    }

    const targetUrl = `${RAILWAY_URL}${railwayPath}${url.search}`;

    console.log(`[PROXY] ${request.method} ${url.pathname} → ${targetUrl}`);

    // Clonar headers
    const headers = new Headers(request.headers);

    // Agregar/preservar correlation ID
    if (!headers.has('X-Correlation-ID')) {
      headers.set('X-Correlation-ID', crypto.randomUUID());
    }

    // Hacer la petición a Railway Fastify
    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      });

      // Crear response con CORS headers
      const responseHeaders = new Headers(response.headers);

      // Agregar CORS headers
      Object.entries(getCORSHeaders()).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      // Headers informativos
      responseHeaders.set('X-Proxy-Source', 'cloudflare-worker');
      responseHeaders.set('X-Gateway', 'railway-fastify');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });

    } catch (error) {
      // Error al conectar con Railway
      console.error(`[PROXY ERROR] ${error.message}`);

      return new Response(JSON.stringify({
        error: 'Gateway Error',
        message: 'Failed to connect to Railway Fastify API',
        details: error.message,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders()
        }
      });
    }
  }
};

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
