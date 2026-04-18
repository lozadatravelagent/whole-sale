const EMILIA_HOSTS = new Set(['emilia.vibook.ai', 'emilia.localhost']);
const MAIN_HOSTS = new Set(['vibook.ai', 'www.vibook.ai', 'localhost', '127.0.0.1']);

const SAFE_RETURN_HOSTS = new Set([
  'vibook.ai',
  'www.vibook.ai',
  'emilia.vibook.ai',
  'localhost',
  '127.0.0.1',
  'emilia.localhost',
]);

export const COOKIE_DOMAIN =
  typeof window !== 'undefined' && window.location.hostname.endsWith('vibook.ai')
    ? '.vibook.ai'
    : undefined;

export function getHostname(): string {
  return typeof window === 'undefined' ? '' : window.location.hostname;
}

/**
 * @deprecated Dual-host architecture collapsed in PR 2. The repo only serves
 * `emilia.vibook.ai` now. This helper has no remaining consumers and PR 4
 * removes it together with `isMainHost`, `mainOrigin`, `emiliaOrigin`,
 * `isSafeReturnUrl`, `EMILIA_HOSTS`, `MAIN_HOSTS`, `SAFE_RETURN_HOSTS`.
 */
export function isEmiliaHost(host: string = getHostname()): boolean {
  return EMILIA_HOSTS.has(host);
}

/** @deprecated See `isEmiliaHost`. PR 4 removes. */
export function isMainHost(host: string = getHostname()): boolean {
  return MAIN_HOSTS.has(host);
}

/** @deprecated No callers in src/. PR 4 confirms with dynamic analysis and removes. */
export function mainOrigin(): string {
  const { protocol, port } = window.location;
  const host = getHostname();
  if (host === 'emilia.localhost') {
    return `${protocol}//localhost${port ? `:${port}` : ''}`;
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return `${protocol}//${host}${port ? `:${port}` : ''}`;
  }
  return 'https://vibook.ai';
}

/** @deprecated No callers in src/. PR 4 confirms with dynamic analysis and removes. */
export function emiliaOrigin(): string {
  const { protocol, port } = window.location;
  const host = getHostname();
  if (host === 'localhost' || host === '127.0.0.1') {
    return `${protocol}//emilia.localhost${port ? `:${port}` : ''}`;
  }
  return 'https://emilia.vibook.ai';
}

/** @deprecated No callers in src/. PR 4 confirms with dynamic analysis and removes. */
export function isSafeReturnUrl(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return SAFE_RETURN_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
