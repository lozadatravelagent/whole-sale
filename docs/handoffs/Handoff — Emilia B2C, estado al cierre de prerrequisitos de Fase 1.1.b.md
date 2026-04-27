
Fecha del handoff: 9 de Abril 2026
Rama activa: main (sincronizada con remoto)
Última sesión: cierre de prerrequisitos de 1.1.b después de mergear 1.1.a
1. Contexto del producto
Emilia es una plataforma que arrancó como cotizador B2B para agencias de viaje (wholesale) y se está reposicionando como producto B2C companion-first (ver Emilia_B2C en el proyecto para la definición de Etapa 1). Hay una auditoría arquitectónica (auditoria-b2b-b2c-emilia.md en el proyecto) que establece la decisión rectora: motor compartido, productos separados. Un archivo queda compartido si necesita ramificar por workspace_mode para lógica de negocio; se separa si ramifica para UI o navegación. El único punto de contacto B2C → B2B es el handoff: cuando se implemente, un lead generado en companion aterriza en el CRM B2B.
2. Roadmap y dónde estamos
Fases cerradas:

Fase 0: workspace_mode='companion' end-to-end, planner_agent extraído a módulo puro, entrypoint ?new=1&mode=companion, badge Companion.
Fase 1.0: routing mode-aware en orchestrator, fallback companion nunca cae en standard_search. (Ver D14: hay una contradicción menor pendiente de verificar sobre dónde vive exactamente este routing.)
Fase 1.0.5: useMessageHandler respeta executionBranch del orchestrator vía switch autoritativo. Bug principal (companion corriendo búsquedas en vez de ask_minimal) resuelto.
Fase 1.1.a: Migration de schema para habilitar ownership B2C en trips y public.users. Mergeada a main vía PR #60. Aplicada a DB local. NO aplicada a producción (ver D12).

Sub-fases de 1.1 pendientes:

1.1.b ← acá vamos a arrancar. Adapter en upsertTrip + guard en usePlannerState para aceptar consumers.
1.1.c — Promover trips a source of truth en loadPersistedPlannerState con fallback a messages.
1.1.d — Eliminar throttle 5s, reemplazar por debounce + flush en unmount.
1.1.e — listTripsByUser(userId, accountType) para "Mis viajes" B2C.
1.1.f — Estados B2C en deriveTripStatus (si hace falta).
1.1.g — Eliminar dual-write a messages (después de 1-2 semanas con trips como SoT estable).

3. Qué hizo exactamente Fase 1.1.a
Dos migrations hermanas (separadas por limitación de Postgres: no se puede usar un ADD VALUE de enum en CHECKs dentro de la misma transacción):

20260409000001_add_consumer_role_value.sql — agrega 'CONSUMER' al enum user_role.
20260409000002_b2c_ownership.sql — todo lo demás.

Cambios estructurales:

Nueva columna trips.owner_user_id UUID (FK → public.users(id) ON DELETE SET NULL).
Nueva columna trips.account_type TEXT NOT NULL DEFAULT 'agent' con CHECK IN ('agent', 'consumer').
Nueva columna public.users.account_type TEXT NOT NULL DEFAULT 'agent' con CHECK análogo.
CHECK XOR en public.users: (account_type='agent' AND role IN ('OWNER','SUPERADMIN','ADMIN','SELLER')) OR (account_type='consumer' AND role='CONSUMER').
trips.agency_id y trips.tenant_id pasan de ON DELETE CASCADE a ON DELETE SET NULL.
CHECK de trips.status ampliado: agrega 'exploring' y 'shared' (se setean explícitamente desde código companion en sub-fases futuras, no se tocan en deriveTripStatus).
3 RLS policies nuevas con prefijo consumer_: consumer_select_own_trips, consumer_insert_own_trips, consumer_update_own_trips (no hay DELETE, consumers no borran trips).
Refuerzo de la INSERT policy B2B existente con AND trips.account_type = 'agent'. Nombre preservado. Impacto B2B cero porque el DEFAULT del código actual es 'agent'.
Trigger JWT actualizado para incluir account_type en raw_app_meta_data.
Helper function public.get_user_account_type() con fallback JWT → tabla.
Backfill: user sentinel 00000000-0000-0000-0000-000000000000 (account_type='agent', role='OWNER'), y owner_user_id = COALESCE(created_by, last_edited_by, sentinel) para trips existentes.
Invariantes forzados post-backfill: owner_user_id NOT NULL (no hay trips sin owner), agent trips without agency = 0.

Invariantes preservados:

Las 129 tests pre-existentes pasan sin cambios.
Un agent no puede crear un trip con account_type='consumer' ni viceversa (CHECK + RLS).
Un agent no puede crear trip sin agency_id (enforcement vía RLS INSERT policy reforzada, no CHECK, porque ON DELETE SET NULL puede dejar agency_id=NULL en trips de agent cuando se borra la agency).
Un user es agent XOR consumer. public.users.id = auth.uid() es PK, no hay dual.

Tests nuevos de 1.1.a:
7 integration tests en src/features/trip-planner/__tests__/b2cOwnershipRls.test.ts:

Agent no puede crear trip con account_type='consumer'.
Consumer no puede crear trip con account_type='agent'.
Agent no puede crear trip sin agency_id.
Consumer puede crear trip sin agency_id.
Consumer solo ve sus propios trips.
Agent sigue viendo trips de su agency (regression).
Regresión de R4 (policy legacy "SELLER can view own trips" no leakea trips de consumer).

Requieren SUPABASE_SERVICE_ROLE_KEY para correr. Si no está seteado, skippean con warning visible por stderr.
4. Estado actual del árbol
Commiteado en main:

Migrations de 1.1.a aplicadas a DB local (NO a producción).
sidebarFilters.ts + sidebarFilters.test.ts (10 tests verdes, recuperados de stash). Son el fix del bug medio de la auditoría (ChatSidebar.tsx:149 filtro relajado que dejaba colar conversaciones companion al sidebar B2B).
3 tests .skip en conversationOrchestrator.test.ts con TODO referenciando D14 (ver más abajo).
Fix del include pattern de vite.config.ts para levantar los tests recuperados.
types.ts regenerado desde local (contiene owner_user_id, account_type, 'CONSUMER'). NO está sincronizado con el schema de producción.
10 migrations legacy con fixes de replay-compatibility (PR #59, mergeada): reorders, IF NOT EXISTS, enum casts, storage permission fallbacks, DECLARE faltantes, dollar-quoting fix en cron.schedule. Todas son no-ops en prod (ya aplicadas, Supabase CLI trackea por timestamp no por hash).

npm test al cierre de la sesión anterior:

126 passed, 10 skipped (7 RLS + 3 companion TDD), 2 failed (D11 pre-existente, localStorage no definido en Vitest).

npm run build: limpio.
supabase db reset en local: aplica las 54 migrations sin errores.
5. Deuda técnica vigente
TECH_DEBT.md tiene las siguientes entradas activas relevantes:

D1, D3-D9: deudas históricas pre-1.1.a, no se tocan en 1.1.b.
D10 ⚠️ CERRADA PARCIAL: types.ts regenerado desde local. Funciona para desarrollo de 1.1.b pero está desincronizado de prod.
D11 🟡 BAJA: 2 suites de Vitest fallan por localStorage is not defined, pre-existente, ruido en CI. Prioridad baja.
D12 🔴 BLOQUEANTE: Push de migrations 1.1.a a producción. Bloquea cualquier deploy a prod de código que use owner_user_id, account_type, 'CONSUMER', o las RLS policies consumer_*. Checklist propio: backup, ventana de mantenimiento, script de verificación post-push (12 queries), plan de rollback, tests RLS contra prod post-push con cleanup garantizado. Deadline: antes del primer deploy de código de 1.1.b o posterior.
D13 🟡 PROCESO: Política nueva: prohibido aplicar migrations a prod fuera de git. Origen: durante prerrequisitos de 1.1.b se descubrió que 20260407000001_add_companion_workspace_mode.sql había sido aplicada al remoto en una sesión previa pero nunca commiteada al repo, solo existía como untracked en working directory. Recuperada de stash y commiteada. La política ahora es: toda migration que se aplique a cualquier entorno debe estar commiteada primero.
D14 🟡 SPEC PENDIENTE: Companion routing en resolveConversationTurn. Durante recuperación se encontraron 3 tests TDD spec-first que asumen que resolveConversationTurn acepta workspaceMode y devuelve companion_fallback. El código actual no lo hace. El routing companion vive en otro layer (probablemente routeRequest o el switch de useMessageHandler). Contradice el contexto de Fase 1.0/1.0.5. Los 3 tests están en .skip. Hay que verificar dónde vive companion routing realmente antes de cualquier trabajo que toque el orchestrator o useMessageHandler.

6. Reglas de proceso aprendidas
Durante la sesión anterior aparecieron varios problemas de proceso. Las reglas que quedaron:

Separar planificación de ejecución en dos pasos: Claude Code entrega un plan en prosa, se aprueba, después escribe código.
Checkpoints explícitos en operaciones destructivas (merge a main, rebase, db push). Claude Code para y pregunta en vez de improvisar.
Nada de supabase db push sin checklist explícito y OK humano. D12 existe justamente por esto.
Nada de archivos untracked importantes viviendo en working directory entre sesiones. Si es trabajo real, va a rama feature commiteada regularmente. D13 cubre migrations, el principio es más general.
Tests que se "pierden" no son ignorables, aunque nunca hayan estado en main. Hay que recuperarlos de stash/reflog/blobs huérfanos.
Cuando Claude Code dice "esto no es regresión" o "esto no cambia comportamiento", verificar. Ese tipo de afirmación es exactamente donde se cuelan los bugs.
types.ts puede regenerarse desde local (supabase gen types typescript --local) para desbloquear desarrollo sin tocar prod, pero hay que documentar explícitamente el desincronización.
Los tests de integración RLS requieren SUPABASE_SERVICE_ROLE_KEY + Supabase local corriendo + Docker Desktop + CLI ≥ v2.84.x. Todo documentado en TESTING.md.

7. Qué sigue: Fase 1.1.b
Scope de 1.1.b:

Cambiar signature de tripService.upsertTrip para aceptar accountType: 'agent' | 'consumer' explícito (no inferirlo). Para 'agent', agencyId y tenantId siguen siendo requeridos (comportamiento B2B idéntico). Para 'consumer', ownerUserId es requerido, agencyId/tenantId ambos opcionales/null.
Mantener backwards compatibility con call sites B2B: defaultear accountType='agent' cuando no se pasa, para no romper los call sites existentes.
Cambiar el guard en usePlannerState para leer accountType del AuthContext y llamar a upsertTrip con los params correctos según el tipo de user.
Exponer accountType en AuthContext si no está ya (debería estar disponible vía JWT claim post-1.1.a porque el trigger actualizado lo populó).
Tests unitarios del adapter + tests de integración extendiendo b2cOwnershipRls.test.ts o creando uno nuevo.

Decisiones cerradas para 1.1.b (no reabrir):

upsertTrip recibe accountType explícito, no lo infiere.
Comportamiento agent idéntico al actual. Las 129 tests no cambian.
Consumer: ownerUserId requerido, agencyId/tenantId ambos opcionales/null.
usePlannerState lee accountType del AuthContext.
NO tocar deriveTripStatus. Los estados 'exploring'/'shared' se setean explícitamente desde código companion en sub-fases futuras.
NO tocar loadPersistedPlannerState (es 1.1.c).
NO eliminar dual-write a messages (es 1.1.g).
NO tocar throttle de 5s (es 1.1.d).
NO agregar listTripsByUser (es 1.1.e).
NO tocar UI nueva, componentes, rutas, layouts. Solo tripService, usePlannerState, AuthContext (mínimo) y tests.
Una sola PR para todo 1.1.b.

8. Pre-requisitos de 1.1.b
Todos ✅ al momento del handoff:

PR #59 (fixes de migrations legacy) mergeada a main.
PR #60 (1.1.a B2C ownership schema) mergeada a main.
types.ts regenerado desde local, commiteado a main (D10 cerrada parcial).
Drift de 20260407000001 resuelto (commiteado desde stash).
Archivos untracked recuperados (sidebarFilters, 3 tests TDD companion).

9. Primeros pasos en la sesión nueva
Para Claude (planning): Leé este handoff + el doc Emilia_B2C + auditoria-b2b-b2c-emilia.md (ambos en el proyecto). Confirmá que entendiste el estado, preguntá cualquier ambigüedad. Después generame el prompt para Claude Code que implemente 1.1.b siguiendo el patrón de sesiones anteriores: Paso 1 = auditoría del código actual + plan en prosa para aprobar; Paso 2 = implementación solo después de OK. El prompt tiene que explicitar todas las decisiones cerradas de la sección 7, todas las restricciones de "no tocar X", y el criterio de verificación (129+ tests pre-existentes verdes, nuevos tests verdes, integration suite RLS verde).
Para Claude Code (nueva sesión): Cuando te pase el prompt, arrancá por verificar pre-requisitos (PRs mergeadas, types.ts con los campos nuevos, D10 marcada como cerrada parcial, Supabase local levantado con supabase start). Si algo no coincide con este handoff, parás y preguntás en vez de improvisar. No arranques el Paso 1 de auditoría del código hasta que los pre-requisitos estén confirmados.
10. Archivos clave para orientarse

Emilia_B2C (en el proyecto, no en git) — definición de Etapa 1 del producto.
auditoria-b2b-b2c-emilia.md (en el proyecto, no en git) — decisión arquitectónica motor/producto.
supabase/migrations/20260409000001_add_consumer_role_value.sql — migration hermana A de 1.1.a.
supabase/migrations/20260409000002_b2c_ownership.sql — migration principal de 1.1.a.
src/features/trip-planner/__tests__/b2cOwnershipRls.test.ts — 7 tests de integración RLS.
src/features/trip-planner/services/tripService.ts — upsertTrip (el que hay que modificar en 1.1.b).
src/features/trip-planner/hooks/usePlannerState.ts — guard que hay que modificar en 1.1.b.
src/contexts/AuthContext.tsx (o donde viva) — context que posiblemente haya que extender con accountType.
TECH_DEBT.md — deuda vigente.
TESTING.md — cómo correr integration tests.
docs/prs/1.1.a-b2c-ownership.md — PR description de 1.1.a con verificación ejecutada.