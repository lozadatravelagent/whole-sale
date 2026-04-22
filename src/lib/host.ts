export const COOKIE_DOMAIN =
  typeof window !== 'undefined' && window.location.hostname.endsWith('vibook.ai')
    ? '.vibook.ai'
    : undefined;
