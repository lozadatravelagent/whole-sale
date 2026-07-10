/**
 * Feature flags for multi-provider search (edge / Deno).
 */

function parseBool(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function defaultEnvGet(key: string): string | undefined {
  try {
    // Deno edge runtime
    const deno = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno;
    if (deno?.env?.get) return deno.env.get(key);
  } catch {
    // ignore
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    if (proc?.env) return proc.env[key];
  } catch {
    // ignore
  }
  return undefined;
}

/** When false (default), executors never call delfos-api. */
export function isDelfosSearchEnabled(
  env: { get(key: string): string | undefined } = { get: defaultEnvGet },
): boolean {
  return parseBool(env.get('DELFOS_SEARCH_ENABLED'));
}

/** Same truthy rules — for unit tests without env. */
export function parseEnvFlag(raw: string | undefined | null): boolean {
  return parseBool(raw);
}
