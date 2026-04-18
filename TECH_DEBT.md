# Technical Debt Registry

## D10 — Regeneracion de types.ts post-1.1.a ✅ CERRADA

**Cerrada parcial el**: 2026-04-09 (desde local, commit d071411c)
**Cerrada definitiva el**: 2026-04-09

types.ts regenerado desde produccion via `supabase gen types typescript --linked`
y comparado con la version local. Diff de 311 lineas en 3 categorias:

1. **conversations.agency_id/tenant_id nullable** (`string` → `string | null`):
   correccion esperada de 1.1.a. Aceptada.
2. **superadmin_agencies_view FK refs removidas**: la vista no aparece en el
   types regenerado desde prod. Investigacion pendiente (ver D16). Aceptada
   porque no afecta runtime (solo metadata de relaciones de una vista).
3. **Cosmetic**: header `__InternalSupabase` metadata block del CLI. Irrelevante.

types.ts reemplazado con la version de prod. Build y tests verificados sin
regresiones (132/12/2).

## D11 — Vitest localStorage failures

2 suites fallan por `localStorage is not defined` (`signatures.test.ts`, `structuralMods.test.ts`).
Pre-existentes desde antes de 1.1.a. Ruido en CI que puede camuflar fallos reales. Prioridad baja.

Causa raiz: importan modulos que transitivamente cargan `src/integrations/supabase/client.ts`,
el cual referencia `localStorage` en su config de auth. En entorno Node/Vitest no hay `localStorage`.
Fix: mock de `localStorage` en vitest setup o lazy-init del cliente Supabase.

## D12 — Push de migrations 1.1.a a produccion ✅ CERRADA

**Checklist ejecutado**:
- [x] Backup de la DB de produccion tomado.
- [x] Drift de migrations resuelto previamente (cerrado por commit 1c91cfb2).
- [x] Ventana de mantenimiento coordinada (aunque la migration sea aditiva).
- [x] Script de verificacion post-push (12 queries) corrido contra prod.
- [x] Plan de rollback documentado (3 niveles: pg_dump restore, SQL manual, dashboard backup).
- [x] Tests RLS de 1.1.a corridos contra prod post-push (9/9 verdes, cleanup verificado).

### Resolucion

- **Fecha**: 2026-04-09
- **Tier de Supabase**: Pro (verificado en dashboard)
- **Backup automatico verificado**: fisico del 9 Apr 2026 04:34 UTC
- **Backup manual pre-push**: pg_dump completo de schema public, 2.38 GB,
  archivado offline por el usuario
- **Migration A** (20260409000001): aplicada via `supabase db push --linked`
  sin incidentes
- **Migration B** (20260409000002): el push CLI murio por statement_timeout
  default de 2min en el rol postgres del session pooler. Aplicada
  manualmente via psql --single-transaction con SET LOCAL
  statement_timeout='10min'. Tiempo real de ejecucion: 6.9 segundos.
  Registrada manualmente en supabase_migrations.schema_migrations.
- **Verificacion post-push**: 12/12 queries verdes (enum CONSUMER, columnas
  trips/users con CHECKs y FKs correctas, 3 RLS policies consumer_*,
  INSERT policy B2B reforzada, sentinel user, invariantes en 0).
- **Tests RLS contra prod**: 9/9 verdes. Cleanup verificado limpio antes y
  despues del run.
- **Aprendizaje para futuras migrations grandes**: usar psql
  --single-transaction con SET LOCAL statement_timeout cuando la migration
  tenga muchas secciones DDL. El default de 2min del CLI no alcanza aunque
  cada statement individual sea trivial.

D13 (politica: prohibido aplicar migrations fuera de git) reforzada.
Migration B fue aplicada via psql pero el contenido SQL provino del archivo
commiteado en PR #60 sin modificaciones. La politica se cumple: el SQL
aplicado es exactamente el de git.

## D13 — Politica: prohibido aplicar migrations a prod fuera de git 🟡 PROCESO

**Origen**: Durante la verificacion de pre-requisitos de 1.1.b se descubrio
que la migration `20260407000001_add_companion_workspace_mode.sql` habia sido
aplicada al remoto en una sesion previa pero nunca commiteada al repo. El
archivo solo existia como untracked en el working directory y fue recuperado
de un stash. types.ts ya reflejaba el cambio porque alguien lo regenero post-push.

**Por que importa**:
- El repo deja de ser source of truth del schema.
- Cualquier `supabase db reset` local rompe porque le falta el archivo.
- Cualquier rebuild de DB (DR, staging fresco) pierde la migration.
- Auditorias futuras no encuentran el cambio en git history.

**Politica**:
1. Toda migration que se aplique a cualquier entorno (local, staging, prod)
   DEBE existir como archivo commiteado en `supabase/migrations/` antes de
   aplicarse.
2. Nadie corre `supabase db push` sobre un archivo untracked.
3. Si un fix de hotfix se aplica a prod via dashboard SQL editor (caso
   excepcional), el SQL se commitea como migration en el siguiente commit
   al repo, con timestamp posterior y comentario explicando el origen.

**Status**: politica nueva, requiere comunicacion al equipo. Cerrado el
incidente puntual con el commit 1c91cfb2.

## D14 — Companion routing en resolveConversationTurn 🟡 SPEC PENDIENTE

**Origen**: Durante recuperacion de archivos untracked en cierre de
prerrequisitos de 1.1.b se encontraron 3 tests TDD spec-first en
`conversationOrchestrator.test.ts` que asumen que `resolveConversationTurn`
acepta un parametro `workspaceMode` y devuelve un branch `companion_fallback`.

**Estado actual**: Companion routing NO existe en ningun layer del chat:
- `useMessageHandler.ts` acepta `workspaceMode` pero lo ignora para routing
  (linea 681: "route based on content, not workspace_mode").
- `resolveConversationTurn` no acepta `workspaceMode` ni devuelve branches
  companion.
- `routeRequest.ts` no menciona companion.

Los 3 tests estan marcados como `.skip` con TODO en
`conversationOrchestrator.test.ts`.

**Contradiccion a resolver**: El contexto de Fase 1.0/1.0.5 indicaba routing
companion implementado. La investigacion confirma posibilidad (b): Fase
1.0/1.0.5 cerraron parcial y companion routing quedo pendiente.

**Accion**: revisar antes de cualquier sub-fase que toque el orchestrator o
useMessageHandler. Decidir si:
  (a) los tests se reescriben para el layer correcto, o
  (b) se implementa la funcionalidad en resolveConversationTurn.

**Bloquea**: nada hoy. Pero bloquea que digamos "companion routing esta
cubierto por tests" hasta resolverlo.

## D15 — duplicateTrip no setea owner_user_id 🟡 BAJA

**Origen**: Detectado durante auditoria de 1.1.b.

`tripService.duplicateTrip` (linea 219) hace un `.insert()` sin incluir
`owner_user_id` ni `account_type`. Post-1.1.a, `owner_user_id` es NOT NULL
sin default, por lo que el INSERT falla contra cualquier DB con la migration
aplicada.

**Impacto actual**: Ninguno. `duplicateTrip` no tiene call sites en el
codebase (no se importa en ningun archivo fuera de tripService.ts).

**Fix**: Agregar `owner_user_id: userId` y opcionalmente `account_type: 'agent'`
al objeto de insert. Es un cambio de 2 lineas.

**Bloquea**: Cualquier feature futura que use `duplicateTrip` (ej. "duplicar
itinerario" en UI). Debe resolverse antes de conectar un call site.

## D16 — superadmin_agencies_view: FKs ausentes en types.ts regenerado 🟡 BAJA

**Origen**: Detectado durante cierre de D10 (2026-04-09).

El types.ts regenerado desde prod via `supabase gen types typescript --linked`
no incluye las FK references a `superadmin_agencies_view` que si tenia la
version local anterior. Multiples tablas (activities, api_keys, conversations,
leads, trips, users) tenian entradas de Relationships apuntando a esta vista.

**Posibles causas**:
- La vista fue dropeada o alterada en prod en algun momento sin tracking en
  migrations.
- El CLI de Supabase cambio su heuristica para incluir/excluir FK refs de
  vistas entre versiones.

**Impacto**: Ninguno en runtime. Las FK refs de vistas solo son metadata para
el type generator, no constraints reales de la DB.

**Accion**: Investigar si la vista existe en prod (`SELECT * FROM
information_schema.views WHERE table_name = 'superadmin_agencies_view'`) y si
sus columnas coinciden con lo esperado. No bloquea features.

## D17 — UnifiedLayout sin i18n para avatar menu y logout 🟡 UX

UnifiedLayout (introducido en PR 2 / C6) renderiza copy literal en español
para los items del avatar menu, el aria-label del trigger y los toasts de
logout. CompanionLayout — al que reemplaza — usaba useTranslation('auth') y
exponía el copy a través de los archivos i18n.

Regresión menor de Fase 1.2 (i18n para Emilia B2C, PR #72). Un consumer con
preferredLanguage distinto a 'es' verá el menú del avatar y el botón de
"Cerrar sesión" en español hasta que se porte UnifiedLayout a i18n.

No bloqueante para el lanzamiento. Fix recomendado: commit independiente
post-PR-2 o parte del polish pre-launch. Pasos:

1. Importar useTranslation en UnifiedLayout.tsx.
2. Mover los strings literales (Settings, Users, Agencies, Tenants, Dashboard,
   Profile, "Cerrar sesión", "Menú de usuario", toast titles) a las claves
   correspondientes en src/i18n/locales/{es,en,pt}/auth.json y common.json.
3. Decidir si los labels del menu (Settings, Users, etc.) viven en common o
   en un namespace nuevo "navigation".

**Origen**: detectado durante PR 2, C6.
