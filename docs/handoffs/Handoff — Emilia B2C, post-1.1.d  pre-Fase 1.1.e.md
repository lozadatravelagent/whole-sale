# Handoff — Emilia B2C, post-1.1.d / pre-Fase 1.1.e

**Fecha del handoff:** 9 de Abril 2026
**Rama activa:** `main` (sincronizada con remoto)
**Última operación:** Merge de PR #62 (1.1.d persist debounce) a main + delete de rama feature.

---

## 1. Contexto del producto

Emilia es una plataforma que arrancó como cotizador B2B para agencias de viaje (wholesale) y se está reposicionando como producto B2C companion-first. Documentos de referencia en el proyecto:

- `Emilia_B2C` — definición de Etapa 1 del producto.
- `auditoria-b2b-b2c-emilia.md` — decisión arquitectónica rectora: **motor compartido, productos separados**. Un archivo queda compartido si necesita ramificar por `workspace_mode` para lógica de negocio; se separa si ramifica para UI o navegación. El único punto de contacto B2C → B2B es el handoff: cuando se implemente, un lead generado en companion aterriza en el CRM B2B.

Post-1.1.c, la tabla `trips` es la source of truth para lectura del estado del planner. Post-1.1.d, el write a `trips` es debouncedo (3s) con flush garantizado en unmount, `beforeunload` y cambio de conversación, cerrando la ventana de pérdida de datos del throttle anterior. El dual-write a `messages` sigue activo como fallback histórico y se elimina recién en 1.1.g.

---

## 2. Roadmap y dónde estamos

### Fases cerradas
- **Fase 0:** `workspace_mode='companion'` end-to-end, `planner_agent` extraído a módulo puro, entrypoint `?new=1&mode=companion`, badge Companion.
- **Fase 1.0:** routing mode-aware en orchestrator, fallback companion nunca cae en `standard_search`.
- **Fase 1.0.5:** `useMessageHandler` respeta `executionBranch` del orchestrator vía switch autoritativo.
- **Fase 1.1.a:** Schema B2C en DB. PR #60 mergeada a main, aplicada a producción (D12 cerrada).
- **Fase 1.1.b:** Adapter en `tripService.upsertTrip` + guard en `usePlannerState` para aceptar consumers + `accountType` en `AuthContext`. PR #61 mergeada a main.
- **Fase 1.1.c:** Promover `trips` a source of truth en `loadPersistedPlannerState` con fallback a messages. Mergeada a main.
- **Fase 1.1.d:** Reemplazar throttle 5s en `persistPlannerState` por debounce 3s + flush en unmount/beforeunload/cambio de conversación. PR #62 mergeada a main, rama feature borrada. Ver §3 para detalle.

### Sub-fases pendientes
- **1.1.e ← acá vamos a arrancar.** `listTripsByUser(userId, accountType)` para "Mis viajes" B2C.
- **1.1.f** — Estados B2C en `deriveTripStatus` (si hace falta).
- **1.1.g** — Eliminar dual-write a messages (después de 1-2 semanas con `trips` como SoT estable).

### Más allá de 1.1
Roadmap macro de la auditoría (paso 1 a 5): separación estructural motor/producto (`B2BLayout` / `CompanionLayout`, routing `/emilia/*`, sidebars separados, guards de Auth), modal de derivación humana + lead al CRM B2B, panel de itinerario vivo, registro/perfil consumer, capa social.

---

## 3. Qué hizo Fase 1.1.d (PR #62)

### Cambios de código

#### `src/features/trip-planner/hooks/createDebouncedFlusher.ts` (nuevo)
Utility pura module-level (no hook, no React). Exporta `createDebouncedFlusher(delayMs)` que retorna `{ schedule, flush, cancel }`. Trailing debounce: múltiples `schedule()` rápidos colapsan en una sola ejecución de la última closure después del delay. `flush()` ejecuta el callback pendiente inmediatamente y cancela el timer (no-op si no hay pendiente). `cancel()` descarta sin ejecutar.

Decisión de no extender `src/utils/debounce.ts`: esa utility tiene un contrato Promise-based. Agregarle `flush` cambiaría su API para consumidores que no lo necesitan.

#### `src/features/trip-planner/hooks/usePlannerState.ts`
- Import de `createDebouncedFlusher` agregado.
- `lastTripUpsertRef = useRef(0)` reemplazado por `tripUpsertDebounceRef = useRef(createDebouncedFlusher(3000))`. Identidad estable vía `useRef`, instancia única por mount del hook.
- Bloque throttle (antiguo `now - lastTripUpsertRef.current > 5000`) reemplazado por `tripUpsertDebounceRef.current.schedule(() => upsertTrip(...).catch(() => {}))`. El `canPersist` guard se mantiene idéntico (consumer requiere `user.id`; agent requiere `user.id` + `agency_id` + `tenant_id`).
- Nuevo `useEffect` con deps `[]`: registra handler `beforeunload` que flushea el debounce; cleanup del effect flushea en unmount (cubre cambio de ruta sin cierre de browser). Independiente del `useEffect` existente de warning UX para mutations activas — concerns separados.
- Flush explícito en bloque de cambio de conversación (`if (conversationId !== trackedConversationId)`): `tripUpsertDebounceRef.current.flush()` es la primera línea, antes del reset de estado. Si hay un upsert pendiente para la conversación anterior, se ejecuta con el `conversationId` viejo capturado en el closure.

### Tests añadidos
- **7 unit tests nuevos** en `src/features/trip-planner/__tests__/tripUpsertDebounce.test.ts`, todos con `vi.useFakeTimers()`:
  1. Debounce agrupa múltiples llamadas rápidas en un solo fire (de la última closure scheduleada).
  2. `flush()` dispara el write pendiente inmediatamente.
  3. `flush()` es no-op sin pendiente (no throw).
  4. `cancel()` descarta sin ejecutar (no fire después de advance timers).
  5. Timer se reinicia en cada `schedule()` (necesita 3s completos desde el último schedule).
  6. No double-fire después de `flush()` + timer expiry.
  7. `flush()` después de fire natural es no-op.

Los casos de regression para agent/consumer flow no requirieron tests nuevos: ya están cubiertos por `upsertTripAdapter.test.ts` (1.1.b) que valida los payloads de `upsertTrip` con ambos `accountType`. La interfaz pública de `updatePlannerState` no cambió.

### Backwards compatibility
- **Agent flow idéntico**: `upsertTrip` recibe los mismos parámetros (`accountType='agent'`, `agencyId`, `tenantId`). Solo cambia el timing interno (debounce en vez de throttle). Los 137 tests pre-existentes no invocan el hook directamente.
- **Consumer flow idéntico**: `accountType='consumer'`, `ownerUserId` se derivan igual del `AuthContext`.
- **Error handling idéntico**: `upsertTrip(...).catch(() => {})` fire-and-forget, misma semántica.
- **Sin schema changes**. 1.1.d es código puro. No requiere migrations ni push a Supabase.

### Tradeoff documentado (notado durante review, candidato a anotar en doc post-merge)
Con el throttle anterior, el **primer** write tras un período idle se ejecutaba inmediatamente (throttle fresh, ventana 0). Con el debounce nuevo, incluso el primer write espera 3s. Esto introduce una regresión marginal en el caso "edit único + crash duro del tab antes de cualquier unmount/beforeunload": antes el write llegaba a `trips` instantáneamente, ahora puede perderse. Mitigaciones: (a) IndexedDB sigue escribiendo sincrónicamente como cache local, (b) `messages` sigue escribiendo sincrónicamente como fallback histórico, (c) `loadPersistedPlannerState` (1.1.c) ya tiene el chain `trips → messages → null`. El net sigue siendo mejor que el throttle anterior porque ese dropeaba los writes posteriores en la ventana de 5s, que era el caso de pérdida más común. **Tradeoff aceptado conscientemente**, no documentado explícitamente en `docs/prs/1.1.d-persist-debounce.md`. Se puede anexar como commit doc-only o cubrir en el cleanup de 1.1.g.

### Doc
- `docs/prs/1.1.d-persist-debounce.md` con descripción completa de la PR (commiteado en la rama feature, incluido en el merge).

---

## 4. Estado actual del árbol (al cierre de esta sesión)

### main contiene (commits relevantes de 1.1.d, sobre lo que ya estaba post-1.1.c)

- Merge commit de PR #62 — `feat(planner): replace 5s trip upsert throttle with 3s debounce + flush (1.1.d)`
- `1307ec34` — `docs(prs): add 1.1.d persist-debounce PR description`
- `a0474287` — `feat(planner): replace 5s trip upsert throttle with 3s debounce + flush (1.1.d)`
- `539bdcfd` — `test(planner): add createDebouncedFlusher unit tests for 1.1.d`

(Los commits anteriores de 1.1.c, 1.1.b, 1.1.a, D12 y D10 siguen intactos. Ver handoff anterior para la lista completa.)

### Estado de prod
- 1.1.a aplicada y verificada (D12 cerrada).
- 1.1.b en main, deployable.
- 1.1.c en main, deployable. Sin schema changes.
- 1.1.d en main, **deployable a prod sin bloqueos**. Sin schema changes, sin migrations, código puro. Si el pipeline deploya automáticamente desde main, ya está activo.
- Dual-write a `messages` sigue activo (se elimina en 1.1.g).
- Write a `trips` ahora debouncedo 3s con flush garantizado.

### Tests
- Baseline al cierre **sin** `SUPABASE_SERVICE_ROLE_KEY`: **144 passed / 12 skipped / 2 failed** (D11 `localStorage` pre-existente en `signatures.test.ts` y `structuralMods.test.ts`).
- Baseline al cierre **con** `SUPABASE_SERVICE_ROLE_KEY` contra local: **153 passed / 3 skipped / 2 failed** (144 + 9 RLS).
- Build limpio.

---

## 5. Deuda técnica vigente

| ID | Estado | Descripción |
|---|---|---|
| D1, D3-D9 | Histórica | Pre-1.1.a, no se tocan en 1.1.e. |
| D10 | ✅ CERRADA | 9 Apr 2026. `types.ts` regenerado desde prod. |
| D11 | 🟡 BAJA | 2 suites Vitest fallan por `localStorage is not defined`. Pre-existente. |
| D12 | ✅ CERRADA | 9 Apr 2026. Migrations 1.1.a aplicadas a prod. |
| D13 | 🟡 PROCESO | Política: prohibido aplicar migrations a prod fuera de git. Vigente. |
| D14 | 🟡 SPEC PENDIENTE | Companion routing en `resolveConversationTurn`: 3 tests TDD `.skip`. **No bloquea 1.1.e** en principio (1.1.e toca `tripService` + UI futura, no routing), pero verificar en Paso 0. |
| D15 | 🟢 BAJA | `duplicateTrip` no setea `owner_user_id`. Sin call sites actuales. Fix trivial. |
| D16 | 🟢 BAJA | `superadmin_agencies_view` FK refs ausentes en types regenerado. Investigación pendiente. No bloquea features. |
| **D17** | 🟢 BAJA (nueva, opcional) | Tradeoff del primer write en 1.1.d (ver §3) no está documentado explícitamente en `docs/prs/1.1.d-persist-debounce.md`. Opcional: agregar nota o cubrir en cleanup de 1.1.g. |

No se detectó deuda nueva grave durante 1.1.d. D17 es cosmética.

---

## 6. Reglas de proceso aprendidas (acumulativas, no reset entre sesiones)

Heredadas y vigentes (ver handoff anterior para texto completo de 1-16). Resumen:

1. Separar planificación de ejecución.
2. Checkpoints explícitos en operaciones destructivas.
3. Nada de `supabase db push` sin checklist + OK humano.
4. Nada de archivos untracked importantes entre sesiones.
5. Tests "perdidos" no son ignorables.
6. "Esto no cambia comportamiento" hay que demostrarlo, no afirmarlo.
7. Manual approval (no bypass) en operaciones que tocan motor compartido o prod.
8. Discrepancias entre prompt y realidad del repo: PARAR siempre.
9a/9b. Credenciales nunca por chat ni inline en comandos Bash.
10. Claude Code loguea env vars inline en el output del Bash tool.
11. Timeout en `db push` no es necesariamente lock contention.
12. Patrón de workaround: `psql --single-transaction` + `SET LOCAL statement_timeout`.
13. Preflight empírico antes de operaciones costosas.
14. `pg_dump` contra Supabase Cloud → Session pooler.
15. Tests RLS contra local requieren 3 variables, no solo `SERVICE_ROLE_KEY`.
16. Cambio de contrato de función → verificar TODOS los call sites.

### Aprendizajes nuevos de esta sesión (1.1.d)

17. **Tradeoffs marginales se documentan en el PR aunque sean aceptables.** En 1.1.d, el primer write pasó de t=0 (throttle fresh) a t=3s (debounce). El net es mejor pero el caso edge "edit único + crash duro" empeora. Aceptado, pero conviene anotarlo en el PR description para que quede en la historia. Lección: cuando el reviewer marca un tradeoff durante el plan y dice "documentalo", llevarlo al PR description, no solo dejarlo en el chat.
18. **Plan en prosa antes de código sigue dando dividendos.** En 1.1.d, las 8 decisiones de diseño (delay time, mecanismo, flush points, write a messages, semántica de error, etc.) quedaron cerradas en el Paso 1. La implementación del Paso 2 fue mecánica: 3 commits, 0 idas y vueltas, baseline verde a la primera.

---

## 7. Pre-requisitos de Fase 1.1.e

Estado al momento del handoff:

- ✅ PR #62 (1.1.d) mergeada a main, rama feature borrada.
- ✅ main sincronizada con remoto.
- ✅ Tests baseline verificable: 144/12/2 (sin key), 153/3/2 (con key).
- ✅ Build limpio.
- ✅ D10, D12 cerradas. D14 no bloquea (1.1.e no toca routing/orchestrator/`useMessageHandler`).
- ⚠️ **Verificar working tree limpio** al inicio de la sesión nueva. Untracked esperados: `docs/handoffs/`, `nul`.

---

## 8. Qué sigue: Fase 1.1.e

### Scope

Implementar `listTripsByUser(userId, accountType)` en `tripService.ts` — la query de lectura para la futura vista "Mis viajes" del consumer.

Hoy `tripService.ts` tiene `listTripsByAgency` (B2B) que filtra por `agency_id`. Para B2C necesitamos análogo que filtre por `owner_user_id`. La función debe ser polimórfica por `accountType`: `'agent'` mantiene comportamiento actual (filtra por `agency_id` que se pasa como parámetro), `'consumer'` filtra por `owner_user_id`.

### Decisiones a cerrar en Paso 1 de 1.1.e (no anticipar)

- **Signature exacta**: `listTripsByUser(userId, accountType)` vs `listTripsByOwner(ownerUserId)` separado, dejando `listTripsByAgency` intacto. ¿Una función polimórfica o dos funciones hermanas?
- **Filtros adicionales**: ¿soporta paginación? `limit`/`offset`? ¿Ordering por `updated_at desc` por default? ¿Filtro opcional por `status`?
- **Shape de retorno**: ¿`TripRow[]` (la fila completa) o un proyectado liviano (`{ id, conversationId, title, updatedAt, status }`) optimizado para listado?
- **RLS**: la query corre con la JWT del consumer. Las policies `consumer_select_own_trips` ya garantizan que solo ve sus propios trips. Verificar que el filtro `owner_user_id = userId` es redundante con RLS pero aún así explícito (defense in depth).
- **Estados a incluir**: ¿filtra `'shared'` y `'exploring'`? ¿Excluye algún estado?
- **Tests**: extender `b2cOwnershipRls.test.ts` con casos de listado, o archivo nuevo `listTripsByUser.test.ts`. Casos mínimos: consumer ve sus trips, consumer no ve trips de otro consumer (RLS), agent puede llamar la función con su `userId` pero no obtiene nada (porque agent trips no tienen `owner_user_id` = agent.id necesariamente — verificar este caso).
- **¿Toca UI?** Por scope, **no**. 1.1.e es solo el método del service. La vista "Mis viajes" se construye después en una fase de UI separada (parte de los pasos 3-5 del roadmap macro de la auditoría).

### Restricciones (no reabrir)

- **NO eliminar dual-write a messages.** Es 1.1.g.
- **NO tocar `deriveTripStatus`.** Es 1.1.f.
- **NO tocar `loadPersistedPlannerState` ni `persistPlannerState`.** Cerrados en 1.1.c y 1.1.d.
- **NO tocar UI nueva, componentes, rutas, layouts, orchestrator, `useMessageHandler`, `planner_agent`.**
- **NO tocar `listTripsByAgency`.** El B2B sigue funcionando idéntico.
- **Una sola PR para todo 1.1.e.**
- **Agent flow no debe cambiar comportamiento observable.** Los 144 tests pre-existentes (sin key) deben seguir verdes.

---

## 9. Primeros pasos en la sesión nueva

### Para Claude (planning)
Leer este handoff + `Emilia_B2C` + `auditoria-b2b-b2c-emilia.md`. Confirmar entendimiento del estado. Generar prompt para Claude Code que implemente 1.1.e siguiendo el patrón:

- **Paso 0:** verificación de prerrequisitos (working tree limpio, main sync, baseline 144/12/2, D14 no bloquea, lectura inicial de `tripService.ts` enfocada en `listTripsByAgency`).
- **Paso 1:** auditoría del estado actual + decisiones de diseño en prosa (las 6+ del §8) para aprobar.
- **Paso 2:** implementación solo después de OK.

### Para Claude Code (sesión nueva)
Antes de auditar, verificar:
1. Rama = main, sync con origin, working tree limpio.
2. Los commits de 1.1.d están en main (`539bdcfd`, `a0474287`, `1307ec34`, + merge commit de PR #62).
3. `npm test` baseline = 144/12/2 (sin `SERVICE_ROLE_KEY`).
4. `npm run build` limpio.
5. D14 no bloquea: confirmar que 1.1.e solo toca `tripService.ts` y tests, no routing/orchestrator/`useMessageHandler`.
6. Si algo no coincide con este handoff, **PARAR y preguntar.**

---

## 10. Archivos clave para orientarse

**Documentos del proyecto:**
- `Emilia_B2C` — definición de Etapa 1 del producto.
- `auditoria-b2b-b2c-emilia.md` — decisión arquitectónica motor/producto.
- `Handoff___Emilia_B2C__post_1.1.d_pre_1.1.e.md` — este documento.
- `Handoff___Emilia_B2C__post_1.1.c_pre_1.1.d.md` — handoff anterior.
- `Handoff___Emilia_B2C__post_D12_pre_1.1.c.md` — handoff anterior al anterior.

**Schema:**
- `supabase/migrations/20260409000001_add_consumer_role_value.sql`
- `supabase/migrations/20260409000002_b2c_ownership.sql`

**Código a tocar en 1.1.e:**
- `src/features/trip-planner/services/tripService.ts` — agregar `listTripsByUser` (o `listTripsByOwner`). Referencia: `listTripsByAgency` ya existente para mantener consistencia de patrón.

**Código tocado en 1.1.d (referencia):**
- `src/features/trip-planner/hooks/createDebouncedFlusher.ts` — utility nueva.
- `src/features/trip-planner/hooks/usePlannerState.ts` — `persistPlannerState` con debounce + flush.

**Tests:**
- `src/features/trip-planner/__tests__/tripUpsertDebounce.test.ts` — 7 unit tests de 1.1.d.
- `src/features/trip-planner/__tests__/loadPlannerState.test.ts` — 5 unit tests de 1.1.c.
- `src/features/trip-planner/__tests__/upsertTripAdapter.test.ts` — 6 unit tests de 1.1.b.
- `src/features/trip-planner/__tests__/b2cOwnershipRls.test.ts` — 9 integration tests RLS (referencia para tests nuevos de listado).

**Deuda y procesos:**
- `TECH_DEBT.md` — D10 a D17.
- `TESTING.md` — cómo correr integration tests.
- `docs/prs/1.1.d-persist-debounce.md` — PR description de 1.1.d.
- `docs/prs/1.1.c-trips-source-of-truth.md` — PR description de 1.1.c (formato de referencia).
- `docs/prs/1.1.b-upsert-trip-adapter.md` — PR description de 1.1.b.

---

## 11. Notas operacionales

- **Credenciales filtradas en sesión de D12:** la service role key y la DB password de Vivook quedaron en el historial del chat de la sesión de D12. El usuario decidió no rotarlas. Si se exporta o comparte el chat de D12, son datos a tratar con cuidado.
- **Backup `~/backups/backup_pre_1.1.a_20260409_203300.sql`:** 2.38 GB en el disco activo del usuario. Decisión pendiente sobre archivar offline.
- **Archivos untracked en working tree:** `docs/handoffs/`, `nul` — esperados, no van a git.