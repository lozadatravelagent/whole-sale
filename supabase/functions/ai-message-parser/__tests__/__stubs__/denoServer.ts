// Vitest stub for `https://deno.land/std@0.168.0/http/server.ts`.
// `serve()` is a no-op in tests; we only need the module to load so the
// parser's `index.ts` can be imported and its exported helpers called.
export function serve(_handler: (req: Request) => Response | Promise<Response>): void {
  // intentionally empty
}
