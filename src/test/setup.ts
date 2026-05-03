import '@testing-library/jest-dom/vitest';

// Provide a minimal `Deno` global so Supabase edge-function modules (which
// access `Deno.env.get(...)` at module load) can be imported by vitest. Real
// edge runtime keeps this; vitest needs the shim. Tests never depend on actual
// env values — modules read once and fall back to '' / undefined.
if (typeof (globalThis as { Deno?: unknown }).Deno === 'undefined') {
  (globalThis as { Deno?: unknown }).Deno = {
    env: {
      get: (_key: string): string | undefined => undefined,
    },
  };
}
