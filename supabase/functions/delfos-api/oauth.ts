/**
 * Delfos OAuth2 client credentials with in-memory token cache.
 */

export interface DelfosToken {
  accessToken: string;
  expiresAtMs: number;
  scope?: string;
}

let cached: DelfosToken | null = null;
let inflight: Promise<DelfosToken> | null = null;

const SKEW_MS = 60_000;

export function clearDelfosTokenCache(): void {
  cached = null;
  inflight = null;
}

export async function getDelfosAccessToken(config: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs?: number;
  forceRefresh?: boolean;
}): Promise<DelfosToken> {
  const now = Date.now();
  if (!config.forceRefresh && cached && cached.expiresAtMs > now + SKEW_MS) {
    return cached;
  }

  if (inflight && !config.forceRefresh) {
    return inflight;
  }

  inflight = (async () => {
    const base = config.baseUrl.replace(/\/$/, '');
    const url = `${base}/v1/oauth/token`;
    const basic = btoa(`${config.clientId}:${config.clientSecret}`);
    const body = new URLSearchParams({ grant_type: 'client_credentials' });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
        Accept: 'application/json',
      },
      body,
      signal: AbortSignal.timeout(config.timeoutMs ?? 15_000),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Delfos OAuth failed: ${response.status} ${text.slice(0, 200)}`);
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Delfos OAuth returned non-JSON body');
    }

    const accessToken = String(json.access_token || '');
    if (!accessToken) throw new Error('Delfos OAuth missing access_token');

    const expiresIn = Number(json.expires_in) || 3600;
    const token: DelfosToken = {
      accessToken,
      expiresAtMs: Date.now() + expiresIn * 1000,
      scope: typeof json.scope === 'string' ? json.scope : undefined,
    };
    cached = token;
    return token;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
