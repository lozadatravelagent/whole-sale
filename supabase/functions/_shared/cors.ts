const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(o => o.trim()).filter(Boolean);

function isLocalDevOrigin(origin: string): boolean {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins.length === 1 ? allowedOrigins[0] : '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(o => o.trim());

  if (allowed.length === 0 || allowed[0] === '') {
    return {
      ...corsHeaders,
      'Access-Control-Allow-Origin': origin || '*',
    };
  }

  if (isLocalDevOrigin(origin)) {
    return {
      ...corsHeaders,
      'Access-Control-Allow-Origin': origin,
    };
  }

  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
  };
}
