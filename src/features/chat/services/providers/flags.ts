/**
 * Client-side Delfos search flag (Vite).
 * Edge also checks DELFOS_SEARCH_ENABLED; keep both aligned in deploy.
 */

export function isDelfosSearchEnabledClient(): boolean {
  try {
    const raw = import.meta.env.VITE_DELFOS_SEARCH_ENABLED as string | undefined;
    if (!raw) return false;
    const v = String(raw).trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  } catch {
    return false;
  }
}
