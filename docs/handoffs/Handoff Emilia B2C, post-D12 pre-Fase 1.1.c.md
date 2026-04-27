# Handoff — Emilia B2C, post-D12 / pre-Fase 1.1.c

**Fecha del handoff:** 9 de Abril 2026
**Rama activa:** `main` (sincronizada con remoto)
**Última operación:** Cierre de D12 (push de migrations 1.1.a a producción) tras merge de 1.1.b

---

## 1. Contexto del producto

Emilia es una plataforma que arrancó como cotizador B2B para agencias de viaje (wholesale) y se está reposicionando como producto B2C companion-first. Documentos de referencia en el proyecto:

- `Emilia_B2C` — definición de Etapa 1 del producto.
- `auditoria-b2b-b2c-emilia.md` — decisión arquitectónica rectora: **motor compartido, productos separados**. Un archivo queda compartido si necesita ramificar por `workspace_mode` para lógica de negocio; se separa si ramifica para UI o navegación. El único punto de contacto B2C → B2B es el handoff: cuando se implemente, un lead generado en companion aterriza en el CRM B2B.

---

## 2. Roadmap y dónde estamos

### Fases cerradas
- **Fase 0:** `workspace_mode='companion'` end-to-end, `planner_agent` extraído a módulo puro, entrypoint `?new=1&mode=companion`, badge Companion.
- **Fase 1.0:** routing mode-aware en orchestrator, fallback companion nunca cae en `standard_search`.
- **Fase 1.0.5:** `useMessageHandler` respeta `executionBranch` del orchestrator vía switch autoritativo.
- **Fase 1.1.a:** Schema B2C en DB. PR #60 mergeada a main, **aplicada a producción** (D12 cerrada, ver §4).
- **Fase 1.1.b:** Adapter en `tripService.upsertTrip` + guard en `usePlannerState` para aceptar consumers + `accountType` en `AuthContext`. PR #61 mergeada a main. Lista para deploy a prod (no bloqueada).

### Sub-fases pendientes
- **1.1.c ← acá vamos a arrancar.** Promover `trips` a source of truth en `loadPersistedPlannerState` con fallback a messages.
- **1.1.d** — Eliminar throttle 5s, reemplazar por debounce + flush en unmount.
- **1.1.e** — `listTripsByUser(userId, accountType)` para "Mis viajes" B2C.
- **1.1.f** — Estados B2C en `deriveTripStatus` (si hace falta).
- **1.1.g** — Eliminar dual-write a messages (después de 1-2 semanas con `trips` como SoT estable).

### Más allá de 1.1
Roadmap macro de la auditoría (paso 1 a 5): separación estructural motor/producto (`B2BLayout` / `CompanionLayout`, routing `/emilia/*`, sidebars separados, guards de Auth), modal de derivación humana + lead al CRM B2B, panel de itinerario vivo, registro/perfil consumer, capa social.

---

## 3. Qué hizo Fase 1.1.b (PR #61, commit 6 atómico)

### Cambios de código
- **`src/contexts/AuthContext.tsx`**: `AuthUser` expone `accountType: 'agent' | 'consumer'`. Query a `public.users` incluye `account_type`. Safety net `|| 'agent'` para users sin la columna (default seguro).
- **`src/features/trip-planner/services/tripService.ts`**: nueva signature de `upsertTrip` con `agencyId`/`tenantId` nullable y `accountType: 'agent' | 'consumer' = 'agent'`. Validaciones pre-DB. `tripData` incluye `owner_user_id` (siempre) y `account_type`. Para consumer, `agency_id`/`tenant_id` se nulean explícitamente.
- **`src/features/trip-planner/hooks/usePlannerState.ts`**: guard de `persistPlannerState` extendido. Agents siguen exigiendo `agency_id`+`tenant_id`. Consumers pasan sin esos campos. Llamada a `upsertTrip` pasa `accountType` derivado del `AuthUser`.

### Tests añadidos
- 6 unit tests en `src/features/trip-planner/__tests__/upsertTripAdapter.test.ts` con mock de Supabase.
- 2 integration tests adicionales en `b2cOwnershipRls.test.ts`: consumer persiste vía `upsertTrip` end-to-end, agent persiste vía `upsertTrip` (regression).

### Backwards compatibility
- Default `accountType='agent'` → único call site existente (`usePlannerState.ts:154`) funciona idéntico.
- `|| 'agent'` en AuthContext → código corre contra prod aunque la columna no exista.
- Único call site modificado de `upsertTrip` en todo el codebase. `listTripsByAgency`, `updateTripLeadId`, `TripRow` quedan intactos.

### Doc
- `docs/prs/1.1.b-upsert-trip-adapter.md` con descripción completa de la PR (commiteado directo a main post-merge).

---

## 4. Qué hizo D12 (cierre de migrations 1.1.a a prod)

### Operación
- **Tier de Supabase:** Pro (verificado en dashboard).
- **Backup automático verificado:** físico del 9 Apr 2026 04:34 UTC.
- **Backup manual pre-push:** `pg_dump --schema=public --no-owner --no-privileges` vía session pooler. Resultado: 2.38 GB, archivado por el usuario fuera del repo.
- **Migration A (`20260409000001_add_consumer_role_value`):** aplicada vía `supabase db push --linked` sin incidentes.
- **Migration B (`20260409000002_b2c_ownership`):** el push CLI murió por `statement_timeout` default de 2 min. Causa raíz: el rol `postgres` del session pooler tiene `statement_timeout = '2min'` configurado a nivel DB, y aunque cada statement individual de la migration es trivial, el agregado de 15 secciones DDL excedió el límite.

### Resolución de Migration B
Aplicada manualmente vía `psql --single-transaction --set ON_ERROR_STOP=on` con un wrapped file en `/tmp/migration_b_wrapped.sql` que prependa `SET LOCAL statement_timeout = '10min'; SET LOCAL lock_timeout = '30s';` al contenido literal de la migration original. Tiempo real de ejecución: **6.9 segundos** (todo el problema era overhead del CLI). Registrada manualmente en `supabase_migrations.schema_migrations` con un statements descriptivo apuntando a D12 + commit 7ce0aa20 + PR #60.

### Verificación post-push
12/12 queries verdes:
1. Enum `user_role` contiene `CONSUMER`.
2. `trips.owner_user_id` existe, NOT NULL, FK ON DELETE SET NULL.
3. `trips.account_type` con CHECK `IN ('agent','consumer')` y DEFAULT `'agent'`.
4. `users.account_type` con mismo CHECK.
5. CHECK XOR en `users` (agent→OWNER/SUPERADMIN/ADMIN/SELLER, consumer→CONSUMER).
6. `trips.agency_id` y `trips.tenant_id` con FK ON DELETE SET NULL.
7. `trips.status` CHECK incluye `'exploring'` y `'shared'`.
8. 3 RLS policies `consumer_*` (insert, select, update).
9. INSERT policy B2B reforzada con `account_type = 'agent'`.
10. Función `public.get_user_account_type()` existe.
11. Sentinel user `00000000-0000-0000-0000-000000000000` con `account_type='agent'`, `role='OWNER'`.
12. Invariantes: `trips_without_owner=0`, `agent_trips_without_agency=0`.

### Tests RLS contra prod
9/9 verdes. Cleanup verificado limpio antes y después del run (0 residuales con patrón `@b2c-rls.test`).

### Cierre formal
- TECH_DEBT.md: D12 marcada como ✅ CERRADA. Commit `806a46b2` directo a main.
- D13 (política: prohibido aplicar migrations fuera de git) **se mantiene**. Migration B fue aplicada vía psql pero el SQL aplicado es exactamente el del archivo commiteado en PR #60, sin modificaciones. La política se cumple.

---

## 5. Estado actual del árbol (al cierre de esta sesión)

### main contiene
- Commit `27e192c4` — Merge PR #59 (fixes legacy de migrations).
- Commit `7ce0aa20` — Merge PR #60 (1.1.a B2C ownership schema).
- Commit `fba3e927` — Merge PR #61 (1.1.b upsert adapter).
- Commit `82b6df5f` — `docs(prs): add 1.1.b PR description`.
- Commit `806a46b2` — `docs(debt): close D12 — 1.1.a migrations applied to prod via psql workaround`.

### Estado de prod
- 1.1.a aplicada y verificada.
- Código de 1.1.b en main, **deployable a prod sin bloqueos**.
- Si el pipeline deploya automáticamente desde main, ya está activo.

### Tests
- Baseline al cierre: **132 passed / 12 skipped / 2 failed** (D11 localStorage pre-existente).
- Con `SUPABASE_SERVICE_ROLE_KEY` set: 134 passed / 10 skipped / 2 failed.

---

## 6. Deuda técnica vigente

| ID | Estado | Descripción |
|---|---|---|
| D1, D3-D9 | Histórica | Pre-1.1.a, no se tocan en 1.1.c. |
| D10 | 🟡 PARCIAL | `types.ts` regenerado desde local. Schema de prod ahora coincide con local post-D12, pero conviene re-regenerar `types.ts` para confirmar y cerrar formalmente. **Acción sugerida en pre-requisitos de 1.1.c.** |
| D11 | 🟡 BAJA | 2 suites de Vitest fallan por `localStorage is not defined`, pre-existente. |
| D12 | ✅ CERRADA | 9 Apr 2026. Ver §4. |
| D13 | 🟡 PROCESO | Política: prohibido aplicar migrations a prod fuera de git. Reforzada por D12 (Migration B se aplicó manualmente vía psql, pero el SQL provino del archivo commiteado, política respetada). |
| D14 | 🟡 SPEC PENDIENTE | Companion routing en `resolveConversationTurn`: hay 3 tests TDD `.skip` que asumen que `resolveConversationTurn` acepta `workspaceMode` y devuelve `companion_fallback`. El código actual no lo hace. El routing companion vive en otro layer. Verificar antes de cualquier trabajo que toque orchestrator o `useMessageHandler`. **No bloquea 1.1.c.** |
| **D15** | 🟢 BAJA | `duplicateTrip` en `tripService.ts` no setea `owner_user_id`. Falla contra DB con NOT NULL post-1.1.a. **Sin call sites actuales**, fix trivial (una línea). Documentado durante 1.1.b. |

### Deuda nueva detectada en D12 (sin issue formal aún)
- **Caches grandes en prod**: el `pg_dump` reveló 2.38 GB de datos, gran parte en `search_cache` y `api_request_cache`. Candidato a revisión de TTL/cleanup. No urgente.
- **4 archivos SQL sueltos sin timestamp** en `supabase/migrations/` (`APPLY_THIS_MANUALLY.sql`, `CREATE_OWNER_USER.sql`, `CREATE_TENANT_AND_ASSIGN_AGENCIES.sql`, `FIX_CAN_CREATE_USER_FUNCTION.sql`). Skippeados por el CLI (no son migrations formales). Candidatos a mover a `scripts/sql/` para no contaminar el directorio de migrations.
- **`statement_timeout = 2min` del rol `postgres` en prod**: causa raíz del fallo del CLI en D12. Anotado para futuras migrations grandes — usar el patrón psql + `SET LOCAL` o aumentar timeout temporalmente vía dashboard.

---

## 7. Reglas de proceso aprendidas (acumulativas, no reset entre sesiones)

Heredadas de sesiones previas y reforzadas en esta:

1. **Separar planificación de ejecución.** Claude Code entrega plan en prosa, se aprueba, después escribe código. Sin atajos.
2. **Checkpoints explícitos en operaciones destructivas** (merge a main, rebase, db push, ALTER en prod). Claude Code para y pregunta en vez de improvisar.
3. **Nada de `supabase db push` sin checklist explícito y OK humano.** D12 fue el caso canónico.
4. **Nada de archivos untracked importantes entre sesiones.** Si es trabajo real, va a rama feature commiteada regularmente.
5. **Tests "perdidos" no son ignorables.** Recuperar de stash/reflog/blobs huérfanos.
6. **Cuando Claude Code dice "esto no cambia comportamiento", verificar.** Es exactamente donde se cuelan los bugs.
7. **Manual approval (no bypass) en operaciones que tocan motor compartido o prod.** Cuesta poco, evita mucho.

### Aprendizajes nuevos de esta sesión (D12)

8. **Discrepancias entre el prompt y la realidad del repo: PARAR siempre.** Caso real: el prompt para crear `docs/prs/1.1.b-...md` decía "PR #61 sin mergear, rama feature activa", pero PR #61 ya estaba mergeada a main. Claude Code paró y preguntó. Correcto.
9. **Credenciales de cualquier tipo nunca van por chat.** En esta sesión la service role key de Supabase se filtró 4 veces al chat por copy-paste accidentales y errores de PowerShell (`env:` sin `$`). Lección operacional:
   - Cuando una credencial tiene que ir a un proceso, se setea como **env var en la terminal local**, **tipeando a mano** la asignación, sin copy-paste de texto que pueda contener caracteres extra.
   - El comando para setear se tipea, no se copia: `$env:NOMBRE = "<paste>"` con la `<paste>` justo entre las comillas.
   - Verificar con `$env:NOMBRE.Length` que dio un número razonable.
   - `Clear-History` + `Remove-Item (Get-PSReadlineOption).HistorySavePath` después.
   - **Releer el mensaje antes de mandarlo al chat:** si aparece `eyJ...` en cualquier parte, borrarlo. Es siempre un JWT.
10. **Claude Code, al ejecutar `Bash` con env vars inline (`FOO=bar comando`), las loguea en el output del tool.** Para credenciales, el prompt tiene que decir explícitamente: "heredá del ambiente del proceso, no las pases inline en el comando". Asumir herencia automática es frágil.
11. **Cuando una migration grande falla por timeout en `supabase db push`, no es necesariamente lock contention.** El default de `statement_timeout` del rol del CLI puede ser bajo (2min en este proyecto). Diagnóstico read-only primero (`pg_stat_activity`, `pg_locks`, `SHOW statement_timeout`), recién después decidir el workaround.
12. **Patrón de workaround para migrations grandes:** `psql --single-transaction --set ON_ERROR_STOP=on -f wrapped.sql`, donde `wrapped.sql` empieza con `SET LOCAL statement_timeout = '10min'; SET LOCAL lock_timeout = '30s';` y sigue con el contenido literal de la migration. Después insertar manualmente en `supabase_migrations.schema_migrations` con un statements descriptivo apuntando al issue de tracking.
13. **Preflight empírico antes de operaciones costosas.** Antes del retry de Migration B se corrió `BEGIN; SET LOCAL statement_timeout='5min'; SELECT pg_sleep(130); COMMIT;` para confirmar empíricamente que el session pooler respeta el override. Costó 2 minutos y dio certeza.
14. **Para `pg_dump` contra Supabase Cloud, usar el Session pooler (puerto 5432 del pooler), no el Transaction pooler (6543) ni el Direct connection (que no es IPv4 en proyectos nuevos sin IPv4 add-on).** Connection string: `postgresql://postgres.<ref>:<pwd>@aws-1-<region>.pooler.supabase.com:5432/postgres`.

---

## 8. Pre-requisitos de Fase 1.1.c

Estado al momento del handoff:

- ✅ PR #60 (1.1.a) mergeada a main.
- ✅ PR #61 (1.1.b) mergeada a main.
- ✅ D12 cerrada: schema 1.1.a aplicado a prod, registrado, verificado.
- ✅ Tests RLS contra prod verdes (9/9).
- ✅ TECH_DEBT.md actualizado.
- ⚠️ **D10 (`types.ts` regenerado desde local) sigue marcada como parcial.** Ahora que prod tiene el schema, conviene re-regenerar `types.ts` desde el remoto (`supabase gen types typescript --linked`) y comparar con la versión actual del repo. Si son idénticos → cerrar D10. Si hay diff → investigar.
- ⚠️ **Verificar baseline local de tests** antes de arrancar 1.1.c. Esperado: 132/12/2 (sin `SUPABASE_SERVICE_ROLE_KEY`).

---

## 9. Qué sigue: Fase 1.1.c

### Scope
Promover `trips` a source of truth en `loadPersistedPlannerState` (en `usePlannerState.ts`), con fallback a messages. Hoy `loadPersistedPlannerState` lee el estado del planner desde el último mensaje del assistant (donde está embebido como JSON). Post-1.1.c debe leer desde `trips` (donde 1.1.b ya escribe) y caer a messages solo si no hay registro en `trips` (caso de conversaciones viejas pre-1.1.b).

### Decisiones a cerrar en Paso 1 de 1.1.c (no anticipar)
- ¿Cómo se identifica el `trip` correspondiente a una conversación? (Probablemente vía `conversation_id`, que ya es FK en `trips`.)
- ¿Qué pasa si hay un `trip` pero el último mensaje tiene un estado más reciente? (Resolver conflictos: trip wins, message wins, o merge.)
- ¿Cómo se maneja la transición para conversaciones viejas que solo tienen estado en messages? (Backfill on-the-fly al primer load, o permanente fallback.)
- ¿Tests nuevos requeridos? Mínimo: load desde `trips`, fallback a messages, conflicto trip vs message.

### Restricciones (no reabrir)
- **NO eliminar dual-write a messages.** Es 1.1.g, después de 1-2 semanas estables.
- **NO tocar throttle 5s.** Es 1.1.d.
- **NO agregar `listTripsByUser`.** Es 1.1.e.
- **NO tocar UI nueva, componentes, rutas, layouts, orchestrator, `useMessageHandler`, `planner_agent`.**
- **Una sola PR para todo 1.1.c.**
- **Agent flow no debe cambiar comportamiento observable.** Las 132 tests pre-existentes deben seguir verdes.

---

## 10. Primeros pasos en la sesión nueva

### Para Claude (planning)
Leer este handoff + `Emilia_B2C` + `auditoria-b2b-b2c-emilia.md`. Confirmar entendimiento del estado. Generar prompt para Claude Code que implemente 1.1.c siguiendo el patrón:

- **Paso 0:** verificación de pre-requisitos (incluido el chequeo de D10 / `types.ts` re-regenerado).
- **Paso 1:** auditoría del código actual de `loadPersistedPlannerState` + decisiones de diseño en prosa para aprobar.
- **Paso 2:** implementación solo después de OK.

El prompt debe explicitar todas las restricciones del §9 y el criterio de verificación (132 tests pre-existentes verdes, tests nuevos verdes, integration suite RLS verde).

### Para Claude Code (sesión nueva)
Antes de auditar el código de 1.1.c, verificar:
1. Rama = main, sync con origin, working tree limpio.
2. Los 5 commits del §5 están en main.
3. `npm test` baseline = 132/12/2.
4. Re-regenerar `types.ts` desde el remoto y comparar con el actual. Reportar diff (esperado: ninguno o trivial).
5. Si algo no coincide con este handoff, **PARAR y preguntar.**

---

## 11. Archivos clave para orientarse

**Documentos del proyecto (no en git):**
- `Emilia_B2C` — definición de Etapa 1 del producto.
- `auditoria-b2b-b2c-emilia.md` — decisión arquitectónica motor/producto.
- `Handoff___Emilia_B2C__post_D12_pre_1.1.c.md` — este documento.

**Schema:**
- `supabase/migrations/20260409000001_add_consumer_role_value.sql`
- `supabase/migrations/20260409000002_b2c_ownership.sql`

**Código a tocar en 1.1.c:**
- `src/features/trip-planner/hooks/usePlannerState.ts` — `loadPersistedPlannerState` (la función a refactorizar).
- `src/features/trip-planner/services/tripService.ts` — posiblemente nuevo método `getTripByConversation` (ya existe pero verificar si sirve) o uno nuevo según necesidad de 1.1.c.

**Tests:**
- `src/features/trip-planner/__tests__/upsertTripAdapter.test.ts` — referencia para unit tests de tripService.
- `src/features/trip-planner/__tests__/b2cOwnershipRls.test.ts` — referencia para integration tests con RLS.

**Deuda y procesos:**
- `TECH_DEBT.md` — D10 a D15.
- `TESTING.md` — cómo correr integration tests.
- `docs/prs/1.1.a-b2c-ownership.md` y `docs/prs/1.1.b-upsert-trip-adapter.md` — referencia de formato para futuros PR descriptions.

---

## 12. Notas operacionales

- **Credenciales filtradas en sesión anterior:** la service role key y la DB password de Vivook quedaron en el historial del chat de la sesión de D12. El usuario decidió no rotarlas. Mantener esto en mente: el chat de D12 contiene material sensible. Si se exporta o comparte, son datos a tratar con cuidado.
- **Backup `~/backups/backup_pre_1.1.a_20260409_203300.sql`:** 2.38 GB en el disco activo del usuario. Decisión pendiente sobre si archivar offline y borrar local o mantener.
- **`/tmp/migration_b_wrapped.sql`:** archivo efímero usado durante D12. Puede borrarse, ya cumplió su rol como evidencia (registrado en TECH_DEBT.md y en commit 806a46b2).