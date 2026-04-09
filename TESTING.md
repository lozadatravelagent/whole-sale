## Integration tests (RLS policies, migrations)

Tests que terminan en `*Rls.test.ts` o viven bajo `src/features/<domain>/__tests__/migration_*.test.ts`
requieren una instancia de Supabase local corriendo y la variable `SUPABASE_SERVICE_ROLE_KEY`.

### Requisitos

Este repo requiere Supabase CLI >= v2.84.x por compatibilidad con el container de Storage.
Usar `npx supabase@latest` o actualizar el CLI global. CLI v2.40.x falla con version mismatch.

### Como correrlos

1. `supabase start` — levanta la instancia local.
2. Copia el `service_role key` del output.
3. `SUPABASE_SERVICE_ROLE_KEY=<key> npm test`

**Cuando correrlos obligatoriamente**: antes de cualquier PR que toque `supabase/migrations/`,
`auth policies`, o archivos de `src/features/*/services/*Service.ts` que ejecuten queries con RLS.

**En CI**: [TODO — definir si CI corre estos tests con un secret o los skippea con warning visible.]
