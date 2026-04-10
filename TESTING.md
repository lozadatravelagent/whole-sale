## Integration tests (RLS policies, migrations)

Tests que terminan en `*Rls.test.ts` o viven bajo `src/features/<domain>/__tests__/migration_*.test.ts`
requieren una instancia de Supabase local corriendo y la variable `SUPABASE_SERVICE_ROLE_KEY`.

### Requisitos

Este repo requiere Supabase CLI >= v2.84.x por compatibilidad con el container de Storage.
Usar `npx supabase@latest` o actualizar el CLI global. CLI v2.40.x falla con version mismatch.

### Como correrlos

1. `supabase start` — levanta la instancia local.
2. Seteá las tres variables de entorno. Los tests defaultean a la URL y anon key del
   remoto, así que para correr contra local hay que setear las tres:

   ```bash
   export SUPABASE_URL=$(supabase status -o env 2>/dev/null | grep API_URL | cut -d= -f2 | tr -d '"')
   export SUPABASE_ANON_KEY=$(supabase status -o env 2>/dev/null | grep ANON_KEY | cut -d= -f2 | tr -d '"')
   export SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env 2>/dev/null | grep SERVICE_ROLE_KEY | cut -d= -f2 | tr -d '"')
   ```

3. `npm test`

**Cuando correrlos obligatoriamente**: antes de cualquier PR que toque `supabase/migrations/`,
`auth policies`, o archivos de `src/features/*/services/*Service.ts` que ejecuten queries con RLS.

**En CI**: [TODO — definir si CI corre estos tests con un secret o los skippea con warning visible.]
