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

export function isEmiliaHost(host: string = getHostname()): boolean {
  return EMILIA_HOSTS.has(host);
}

export function isMainHost(host: string = getHostname()): boolean {
  return MAIN_HOSTS.has(host);
}

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

export function emiliaOrigin(): string {
  const { protocol, port } = window.location;
  const host = getHostname();
  if (host === 'localhost' || host === '127.0.0.1') {
    return `${protocol}//emilia.localhost${port ? `:${port}` : ''}`;
  }
  return 'https://emilia.vibook.ai';
}

export function isSafeReturnUrl(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return SAFE_RETURN_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
