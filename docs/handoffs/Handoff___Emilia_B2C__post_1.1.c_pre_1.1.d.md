# Handoff — Emilia B2C, post-1.1.c / pre-Fase 1.1.d

**Fecha del handoff:** 9 de Abril 2026
**Rama activa:** `main` (sincronizada con remoto)
**Ultima operacion:** Push a origin de merge 1.1.c + housekeeping (D10 cerrada, D16 nueva, TESTING.md actualizado)

---

## 1. Contexto del producto

Emilia es una plataforma que arranco como cotizador B2B para agencias de viaje (wholesale) y se esta reposicionando como producto B2C companion-first. Documentos de referencia en el proyecto:

- `Emilia_B2C` — definicion de Etapa 1 del producto.
- `auditoria-b2b-b2c-emilia.md` — decision arquitectonica rectora: **motor compartido, productos separados**. Un archivo queda compartido si necesita ramificar por `workspace_mode` para logica de negocio; se separa si ramifica para UI o navegacion. El unico punto de contacto B2C -> B2B es el handoff: cuando se implemente, un lead generado en companion aterriza en el CRM B2B.

Post-1.1.c, la tabla `trips` es ahora la source of truth para lectura del estado del planner. El dual-write a `messages` se mantiene como fallback para conversaciones pre-1.1.b y se eliminara en 1.1.g.

---

## 2. Roadmap y donde estamos

### Fases cerradas
- **Fase 0:** `workspace_mode='companion'` end-to-end, `planner_agent` extraido a modulo puro, entrypoint `?new=1&mode=companion`, badge Companion.
- **Fase 1.0:** routing mode-aware en orchestrator, fallback companion nunca cae en `standard_search`.
- **Fase 1.0.5:** `useMessageHandler` respeta `executionBranch` del orchestrator via switch autoritativo.
- **Fase 1.1.a:** Schema B2C en DB. PR #60 mergeada a main, aplicada a produccion (D12 cerrada).
- **Fase 1.1.b:** Adapter en `tripService.upsertTrip` + guard en `usePlannerState` para aceptar consumers + `accountType` en `AuthContext`. PR #61 mergeada a main. Deployada a prod (no bloqueada).
- **Fase 1.1.c:** Promover `trips` a source of truth en `loadPersistedPlannerState` con fallback a messages. Mergeada a main, pusheada a origin. Ver §3 para detalle.

### Sub-fases pendientes
- **1.1.d <-- aca vamos a arrancar.** Eliminar throttle 5s en `persistPlannerState`, reemplazar por debounce + flush en unmount.
- **1.1.e** — `listTripsByUser(userId, accountType)` para "Mis viajes" B2C.
- **1.1.f** — Estados B2C en `deriveTripStatus` (si hace falta).
- **1.1.g** — Eliminar dual-write a messages (despues de 1-2 semanas con `trips` como SoT estable).

### Mas alla de 1.1
Roadmap macro de la auditoria (paso 1 a 5): separacion estructural motor/producto (`B2BLayout` / `CompanionLayout`, routing `/emilia/*`, sidebars separados, guards de Auth), modal de derivacion humana + lead al CRM B2B, panel de itinerario vivo, registro/perfil consumer, capa social.

---

## 3. Que hizo Fase 1.1.c

### Cambios de codigo

#### `src/features/trip-planner/hooks/usePlannerState.ts`

- **`loadPersistedPlannerState` refactorizado** (lineas 163-252): el paso 2 (source of truth) ahora llama a `getTripByConversation(conversationId)` primero. Si retorna `TripPlannerState`, lo normaliza con `normalizePlannerState()` y lo usa. Si retorna `null` (no existe trip row), cae al query existente contra `messages`.
- **Import agregado**: `getTripByConversation` desde `tripService.ts` (linea 11).
- **Error handling**: si `getTripByConversation` tira excepcion (network, RLS, etc.), loguea con `console.error('[planner][1.1.c] getTripByConversation failed, falling back to messages:', error)` y cae al fallback de messages sin romper UX. El criterio: fallback por "trip no existe" (null) es silencioso y esperado; fallback por "query rota" (excepcion) es ruidoso y anomalo.
- **Telemetria debug-level**: `console.debug` en los 3 caminos de lectura:
  - `[planner][1.1.c] loaded from indexeddb cache`
  - `[planner][1.1.c] loaded from trips`
  - `[planner][1.1.c] loaded from messages (fallback, no trip row)`
  
  Debug-level para que sea filtrable. Efimera — se remueve en 1.1.g.

#### `src/features/trip-planner/services/tripService.ts`

- **`getTripByConversation` corregido** (lineas 157-165):
  - `single()` reemplazado por `maybeSingle()` — evita error PGRST116 cuando no hay trip row (esperado para conversaciones pre-1.1.b, donde `single()` trataba 0 rows como error).
  - Error de Supabase ahora se propaga via `throw` para que el caller pueda distinguir "no trip" (null) de "query rota" (excepcion).
- **Contrato nuevo**: retorna `TripPlannerState | null` (null = no trip row), tira excepcion solo en error real de Supabase. Pre-1.1.c, `single()` tiraba PGRST116 en 0 rows — eso ahora es `null`.
- **Call sites verificados**: solo 2 en todo `src/` — la definicion (linea 157) y el caller nuevo en `usePlannerState.ts` (linea 201). Ningun caller pre-existente existia — la funcion estaba definida pero no importada por nadie antes de 1.1.c. El cambio de contrato no rompio nada.

### Decisiones de diseno

- **Politica de conflictos trip-vs-message**: **trip wins siempre**. El dual-write en `persistPlannerState` escribe el mismo `normalizedState` a messages (linea 141) y a trips (linea 159). No hay divergencia de contenido posible. Si en el futuro se descubre un caso de divergencia real, se aborda como bug — no como feature de merge.
- **Estrategia para conversaciones viejas**: **fallback permanente a messages, sin backfill on-the-fly**. Las conversaciones pre-1.1.b nunca escribieron a `trips`. Backfill on-the-fly contaminaria `owner_user_id` con el usuario que casualmente abriera la conversacion primero. El dual-write se mantiene hasta 1.1.g; cualquier conversacion que se toque post-1.1.b ya escribe a ambos destinos.

### Flujo resultante de loadPersistedPlannerState

```
1. IndexedDB cache -> display instantaneo (sin cambio)
2. getTripByConversation(conversationId)
   |-- TripPlannerState -> normalizar, usar, actualizar cache -> FIN
   |-- null -> continuar a paso 3
   `-- throw -> log error, continuar a paso 3
3. Fallback: query a messages (role='system', meta.messageType='trip_planner_state')
   |-- encontrado -> normalizar, usar, actualizar cache -> FIN
   `-- null -> setPlannerState(null) -> FIN
```

### Tests anadidos

- **5 unit tests nuevos** en `src/features/trip-planner/__tests__/loadPlannerState.test.ts`:
  1. `getTripByConversation` retorna state cuando trip existe
  2. `getTripByConversation` retorna null cuando no hay trip row (pre-1.1.b)
  3. `getTripByConversation` tira excepcion en error de Supabase (network, RLS)
  4. `normalizePlannerState` produce output identico desde datos de trip y messages
  5. `normalizePlannerState` produce `TripPlannerState` valido con todos los campos requeridos

### Backwards compatibility

- **Agent flow identico**: `getTripByConversation` devuelve el mismo `TripPlannerState` que antes venia de messages, normalizado por la misma funcion (`normalizePlannerState`). Los 132 tests pre-existentes siguen verdes sin cambios.
- **Dual-write preservado**: `persistPlannerState` no se toco. Sigue escribiendo a messages y a trips (throttled 5s). Se elimina en 1.1.g.
- **Conversaciones pre-1.1.b**: fallback transparente a messages. Sin backfill.

### Housekeeping (commiteado a main antes de la rama feature)

- **D10 cerrada definitivamente**: `types.ts` regenerado desde produccion via `supabase gen types typescript --linked`. Diff de 311 lineas en 3 categorias (conversations nullable esperado, superadmin_agencies_view FKs removidas, cosmetic). Commit `29da012f`.
- **D16 abierta**: `superadmin_agencies_view` FK refs ausentes en types regenerado. Investigacion pendiente. No bloquea features.
- **TESTING.md actualizado**: clarificacion de que los tests RLS contra Supabase local requieren 3 variables de entorno (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) porque el test defaultea a la URL y anon key del remoto. Commit `0dfdae87`.

### Doc

- `docs/prs/1.1.c-trips-source-of-truth.md` con descripcion completa de la PR (commiteado en la rama feature, incluido en el merge).

---

## 4. Estado actual del arbol (al cierre de esta sesion)

### main contiene (ultimos 10 commits)

- Commit `0dfdae87` — `docs(testing): clarify RLS suite needs URL+ANON+SERVICE keys for local runs`
- Commit `3bfbe2de` — `Merge branch 'feat/1.1.c-trips-source-of-truth'`
- Commit `73da4abf` — `docs(prs): update 1.1.c PR description with RLS verification results`
- Commit `9de2b39d` — `docs(prs): add 1.1.c trips-source-of-truth PR description`
- Commit `af238543` — `test(planner): add loadPlannerState tests + fix getTripByConversation error handling`
- Commit `07dd4062` — `feat(planner): promote trips to source of truth in loadPersistedPlannerState`
- Commit `29da012f` — `chore(types): regenerate types.ts from prod schema, close D10, log D16`
- Commit `806a46b2` — `docs(debt): close D12 — 1.1.a migrations applied to prod via psql workaround`
- Commit `82b6df5f` — `docs(prs): add 1.1.b upsert-trip-adapter PR description`
- Commit `fba3e927` — `Merge pull request #61 from lozadatravelagent/feature/1.1.b-upsert-trip-adapter`

### Tests

- Baseline al cierre sin SERVICE_ROLE_KEY: **137 passed / 12 skipped / 2 failed** (D11 localStorage).
- Baseline al cierre con SERVICE_ROLE_KEY contra local: **146 passed / 3 skipped / 2 failed**.
  - 132 pre-existentes + 5 nuevos (loadPlannerState) + 9 RLS = 146.
  - 3 skipped = tests `.skip` (D14 companion routing specs).
  - 2 failed = D11 localStorage (pre-existente, `signatures.test.ts` y `structuralMods.test.ts`).

---

## 5. Estado de prod

- **1.1.a** aplicada y verificada (D12 cerrada).
- **1.1.b** en main, deployable a prod sin bloqueos. Si el pipeline deploya automaticamente desde main, ya esta activo.
- **1.1.c** en main, deployable a prod sin bloqueos. **No hay schema changes** — 1.1.c es codigo puro (lectura desde una tabla que ya existe post-1.1.a, con datos escritos por 1.1.b). No requiere migrations ni push a Supabase.
- **Dual-write a messages sigue activo**. `persistPlannerState` escribe a messages (source of truth historica) y a trips (source of truth nueva). El dual-write se elimina en 1.1.g despues de 1-2 semanas estables.
- **Throttle 5s en trips write sigue activo**. Se reemplaza por debounce + flush en 1.1.d.

---

## 6. Deuda tecnica vigente

| ID | Estado | Descripcion |
|---|---|---|
| D1, D3-D9 | Historica | Pre-1.1.a, no se tocan en 1.1.d. |
| D10 | ✅ CERRADA | 9 Apr 2026. types.ts regenerado desde prod, diff aceptado, commit `29da012f`. |
| D11 | 🟡 BAJA | 2 suites Vitest fallan por `localStorage is not defined`. Pre-existente. |
| D12 | ✅ CERRADA | 9 Apr 2026. Migrations 1.1.a aplicadas a prod. |
| D13 | 🟡 PROCESO | Politica: prohibido aplicar migrations a prod fuera de git. Vigente. |
| D14 | 🟡 SPEC PENDIENTE | Companion routing en `resolveConversationTurn`: 3 tests TDD `.skip`. No bloqueo 1.1.c. Verificar antes de tocar orchestrator o `useMessageHandler`. **No bloquea 1.1.d** en principio (1.1.d toca `persistPlannerState`, no routing), pero verificar en Paso 0 de 1.1.d. |
| D15 | 🟢 BAJA | `duplicateTrip` no setea `owner_user_id`. Sin call sites actuales. Fix trivial. |
| D16 | 🟢 BAJA | `superadmin_agencies_view`: types.ts regenerado desde prod no incluye FKs que si tenia la version local. Investigar si la vista fue alterada. No bloquea features. |

No se detecto deuda nueva durante 1.1.c.

---

## 7. Reglas de proceso aprendidas (acumulativas, no reset entre sesiones)

Heredadas de sesiones previas y reforzadas en esta:

1. **Separar planificacion de ejecucion.** Claude Code entrega plan en prosa, se aprueba, despues escribe codigo. Sin atajos.
2. **Checkpoints explicitos en operaciones destructivas** (merge a main, rebase, db push, ALTER en prod). Claude Code para y pregunta en vez de improvisar.
3. **Nada de `supabase db push` sin checklist explicito y OK humano.** D12 fue el caso canonico.
4. **Nada de archivos untracked importantes entre sesiones.** Si es trabajo real, va a rama feature commiteada regularmente.
5. **Tests "perdidos" no son ignorables.** Recuperar de stash/reflog/blobs huerfanos.
6. **Cuando Claude Code dice "esto no cambia comportamiento", verificar.** Es exactamente donde se cuelan los bugs.
7. **Manual approval (no bypass) en operaciones que tocan motor compartido o prod.** Cuesta poco, evita mucho.
8. **Discrepancias entre el prompt y la realidad del repo: PARAR siempre.** Caso real: prompt de 1.1.b decia "PR sin mergear", pero ya estaba mergeada. Claude Code paro y pregunto. Correcto.
9a. **Credenciales nunca van por chat — para humanos seteando env vars en su terminal:** tipear a mano la asignacion, no copy-paste de texto que pueda contener caracteres extra. `$env:NOMBRE = "<paste>"` con la `<paste>` justo entre las comillas. Verificar con `$env:NOMBRE.Length` que dio un numero razonable. `Clear-History` + `Remove-Item (Get-PSReadlineOption).HistorySavePath` despues. Releer el mensaje antes de mandarlo al chat: si aparece `eyJ...` en cualquier parte, borrarlo — es siempre un JWT.
9b. **Credenciales nunca van por chat — para Claude Code obteniendo env vars:** extraer programaticamente (ej. `supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2 | tr -d '"'`) o heredar del proceso. Nunca pedir credenciales por chat. Nunca pasarlas inline en el comando del Bash tool.
10. **Claude Code, al ejecutar `Bash` con env vars inline (`FOO=bar comando`), las loguea en el output del tool.** Para credenciales, heredar del ambiente del proceso o extraer programaticamente.
11. **Cuando una migration grande falla por timeout en `supabase db push`, no es necesariamente lock contention.** Diagnostico read-only primero.
12. **Patron de workaround para migrations grandes:** `psql --single-transaction --set ON_ERROR_STOP=on -f wrapped.sql`, con `SET LOCAL statement_timeout` al inicio.
13. **Preflight empirico antes de operaciones costosas.** Testear el mecanismo antes de usarlo en la operacion real.
14. **Para `pg_dump` contra Supabase Cloud, usar el Session pooler (puerto 5432 del pooler).**

### Aprendizajes nuevos de esta sesion (1.1.c)

15. **Tests RLS contra Supabase local requieren 3 variables**, no solo `SUPABASE_SERVICE_ROLE_KEY`. El test defaultea `SUPABASE_URL` y `SUPABASE_ANON_KEY` a la URL del remoto. Si solo se setea `SERVICE_ROLE_KEY`, los tests corren contra remoto con una key local — falla con "Invalid API key". Documentado en `TESTING.md`.
16. **Cuando se cambia el contrato de una funcion (ej. `single()` -> `maybeSingle()`), verificar TODOS los call sites** antes de mergear, no solo los que se modificaron. En 1.1.c, `getTripByConversation` no tenia call sites pre-existentes, asi que fue seguro. Pero el patron de verificacion es obligatorio.

---

## 8. Pre-requisitos de Fase 1.1.d

Estado al momento del handoff:

- ✅ 1.1.c mergeada a main y pusheada a origin.
- ✅ main sincronizada con remoto.
- ✅ D10 cerrada. types.ts sincronizado con prod.
- ✅ Tests baseline verificable: 137/12/2 (sin key), 146/3/2 (con key).
- ⚠️ **D14**: verificar que 1.1.d no toca routing/orchestrator/`useMessageHandler`. Si el scope se limita a `persistPlannerState` (que es lo esperado), D14 no bloquea.
- ⚠️ **Verificar working tree limpio** al inicio de la sesion. Actualmente hay untracked: `docs/handoffs/` y `nul`.

---

## 9. Que sigue: Fase 1.1.d

### Scope

Eliminar el throttle de 5 segundos en `persistPlannerState` (linea 156 de `usePlannerState.ts`: `now - lastTripUpsertRef.current > 5000`). Reemplazar por debounce + flush en unmount.

Hoy, `persistPlannerState` escribe a trips via `upsertTrip` como fire-and-forget con un throttle manual de 5s basado en un ref (`lastTripUpsertRef`). Esto significa que si el usuario hace varias ediciones rapidas y cierra el browser, el ultimo estado puede perderse si el throttle lo bloqueo.

Post-1.1.d, el write a trips deberia usar un debounce (ej. 2-3s) que se flushee obligatoriamente en unmount del componente o en `beforeunload`, garantizando que el ultimo estado siempre llegue a la DB.

### Decisiones a cerrar en Paso 1 de 1.1.d (no anticipar)

- Debounce time: 2s? 3s? Otro?
- Mecanismo de debounce: `setTimeout` manual con ref, o utilidad reutilizable (ej. lodash/debounce, custom hook)?
- Flush en unmount: cleanup del `useEffect` vs `useCallback` con `beforeunload`? Ambos?
- El write a messages (lineas 122-144) tambien esta sin throttle hoy (se ejecuta en cada llamada a `persistPlannerState`). Se debouncea tambien, o solo el write a trips?
- Interaccion con el `useEffect` de `beforeunload` existente (lineas 86-94) que guarda `activePlannerMutation`. Se puede reutilizar o es independiente?
- Tests: que se testea unitariamente? El debounce puro es dificil de testear sin timers falsos.

### Restricciones (no reabrir)

- **NO eliminar dual-write a messages.** Es 1.1.g.
- **NO agregar `listTripsByUser`.** Es 1.1.e.
- **NO tocar `deriveTripStatus`.** Es 1.1.f.
- **NO tocar `loadPersistedPlannerState`** (ya cerrado en 1.1.c).
- **NO tocar UI nueva, componentes, rutas, layouts, orchestrator, `useMessageHandler`, `planner_agent`.**
- **Una sola PR para todo 1.1.d.**
- **Agent flow no debe cambiar comportamiento observable.** Los 137 tests pre-existentes (sin key) deben seguir verdes.

---

## 10. Primeros pasos en la sesion nueva

### Para Claude (planning)
Leer este handoff + `Emilia_B2C` + `auditoria-b2b-b2c-emilia.md`. Confirmar entendimiento del estado. Generar prompt para Claude Code que implemente 1.1.d siguiendo el patron:

- **Paso 0:** verificacion de pre-requisitos (working tree limpio, main sync, baseline de tests, D14 no bloquea).
- **Paso 1:** auditoria del throttle actual en `persistPlannerState` + decisiones de diseno en prosa para aprobar.
- **Paso 2:** implementacion solo despues de OK.

### Para Claude Code (sesion nueva)
Antes de auditar el codigo de 1.1.d, verificar:
1. Rama = main, sync con origin, working tree limpio.
2. Los commits de 1.1.c estan en main (commit `3bfbe2de` merge, commit `07dd4062` feat).
3. `npm test` baseline = 137/12/2 (sin SERVICE_ROLE_KEY).
4. D14 no bloquea: confirmar que 1.1.d solo toca `persistPlannerState` en `usePlannerState.ts`, no routing/orchestrator/`useMessageHandler`.
5. Si algo no coincide con este handoff, **PARAR y preguntar.**

---

## 11. Archivos clave para orientarse

**Documentos del proyecto:**
- `Emilia_B2C` — definicion de Etapa 1 del producto.
- `auditoria-b2b-b2c-emilia.md` — decision arquitectonica motor/producto.
- `Handoff___Emilia_B2C__post_1.1.c_pre_1.1.d.md` — este documento.
- `Handoff___Emilia_B2C__post_D12_pre_1.1.c.md` — handoff anterior (contexto historico).

**Schema:**
- `supabase/migrations/20260409000001_add_consumer_role_value.sql`
- `supabase/migrations/20260409000002_b2c_ownership.sql`

**Codigo a tocar en 1.1.d:**
- `src/features/trip-planner/hooks/usePlannerState.ts` — `persistPlannerState` (la funcion a refactorizar, lineas 96-161). Especificamente el throttle en lineas 150-160 y el `lastTripUpsertRef`.

**Codigo tocado en 1.1.c (referencia):**
- `src/features/trip-planner/hooks/usePlannerState.ts` — `loadPersistedPlannerState` (lineas 163-252).
- `src/features/trip-planner/services/tripService.ts` — `getTripByConversation` (lineas 157-165).

**Tests:**
- `src/features/trip-planner/__tests__/loadPlannerState.test.ts` — 5 unit tests de 1.1.c.
- `src/features/trip-planner/__tests__/upsertTripAdapter.test.ts` — 6 unit tests de 1.1.b.
- `src/features/trip-planner/__tests__/b2cOwnershipRls.test.ts` — 9 integration tests RLS.

**Deuda y procesos:**
- `TECH_DEBT.md` — D10 a D16.
- `TESTING.md` — como correr integration tests (actualizado con 3 variables).
- `docs/prs/1.1.c-trips-source-of-truth.md` — PR description de 1.1.c.
- `docs/prs/1.1.b-upsert-trip-adapter.md` — PR description de 1.1.b (formato de referencia).

---

## 12. Notas operacionales

- **Credenciales filtradas en sesion de D12:** la service role key y la DB password de Vivook quedaron en el historial del chat de la sesion de D12. El usuario decidio no rotarlas. Si se exporta o comparte el chat de D12, son datos a tratar con cuidado.
- **Backup `~/backups/backup_pre_1.1.a_20260409_203300.sql`:** 2.38 GB en el disco activo del usuario. Decision pendiente sobre si archivar offline y borrar local o mantener.
- **Archivos untracked en working tree:** `docs/handoffs/` (handoffs no commiteados, no van a git).
