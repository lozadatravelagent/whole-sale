# Technical Debt Registry

## D10 — Regeneracion de types.ts post-1.1.a

Post-merge de 1.1.a, correr:

    supabase gen types typescript --project-id ujigyazketblwlzcomve > src/integrations/supabase/types.ts

Sin esto, los siguientes simbolos no existen en TypeScript y bloquean 1.1.b:

- `trips.owner_user_id`
- `trips.account_type`
- `public.users.account_type`
- Valor `'CONSUMER'` del enum `user_role`
- `trips.status` con `'exploring'` y `'shared'`

**Bloqueante de**: 1.1.b (adapter en upsertTrip/guard en usePlannerState).

## D11 — Vitest localStorage failures

2 suites fallan por `localStorage is not defined` (`signatures.test.ts`, `structuralMods.test.ts`).
Pre-existentes desde antes de 1.1.a. Ruido en CI que puede camuflar fallos reales. Prioridad baja.

Causa raiz: importan modulos que transitivamente cargan `src/integrations/supabase/client.ts`,
el cual referencia `localStorage` en su config de auth. En entorno Node/Vitest no hay `localStorage`.
Fix: mock de `localStorage` en vitest setup o lazy-init del cliente Supabase.
