# Handoff — Emilia B2C, post-PR-3 / pre-PR-4

**Fecha del handoff:** 22 de Abril 2026
**Rama activa:** `main` (sincronizada con remoto en `26fcae8b`, un commit arriba del merge de PR 3 `d82ac244`).
**Última operación:** Merge de PR 3 (chat unification) a main vía `d82ac244` (PR #75) + doc `docs/prs/pr3-chat-unification.md` (`a5adebfa`) + update de `docs/B2C_STATUS.md` post-PR-3 (`26fcae8b`). Push a `origin/main` confirmado.

---

## 1. Contexto del producto

Emilia arrancó como cotizador B2B para agencias de viaje (wholesale) y se reposicionó como producto B2C self-serve. La auditoría original (`docs/handoffs/auditoria-b2b-b2c-emilia.md`) fijó la decisión rectora **motor compartido, productos separados**. Esa tesis se revisó en **ADR-002** (`docs/adr/ADR-002-chat-unification.md`, mergeado a main en `dda48aac` el 17-Abr): el motor sigue compartido pero los productos se fusionan en un único surface con switch estricto agency/passenger. La razón del cambio: el handoff B2C→B2B no se sostuvo (los consumers no necesitan derivación operativa) y los agents quieren usar el modo passenger como acelerador de planificación cuando arman cotizaciones.

PR 2 cerró la capa de routing + layouts. **PR 3 cerró el chat con switch**: introdujo el `ModeSwitch`, rediseñó `resolveConversationTurn` para modo estricto, agregó `mode_bridge` como UX de puente, unificó visualmente las dos ramas de `ChatFeature` bajo `UnifiedLayout`. Durante PR 3 se descubrió empíricamente que el supuesto "passenger mode → `planner_agent`" del ADR-002 original era falso: `planner_agent` no hidrata el panel derecho del workspace. La reversión parcial quedó documentada en el **addendum C7.1.e** del ADR (commit `8e3c6fda`): passenger mode pasa a `standard_itinerary`. Consecuencia directa: `standard_itinerary` deja de ser "código muerto candidato a purga en PR 4" y pasa a ser **rama productiva permanente**. `planner_agent` queda vivo pero sin call sites de routing productivos.

Quedan dos PRs: **PR 4** (purga de dead code acumulado, handoff completo, pages deprecadas, dual-write a `messages`) con scope reformulado post-C7.1.e; y **PR 5** (export de itinerario a PDF sobre el sistema custom existente).

---

## 2. Roadmap y dónde estamos

### Fases cerradas (hasta PR 3 inclusive)

- **Fase 0:** `workspace_mode='companion'` end-to-end, `planner_agent` extraído a módulo puro.
- **Fase 1.0/1.0.5:** routing mode-aware en orchestrator, `useMessageHandler` respeta `executionBranch`.
- **Fase 1.1.a/b/c/d/e-g:** schema B2C, `upsertTrip` con `accountType`, `trips` source of truth, debounce 3s + flush, `listTripsByUser`/`deriveTripStatus`, eliminar dual-write (1.1.g pendiente — ver §5.bis).
- **Pasos 1-4 (auditoría original):** `CompanionLayout`, rutas `/emilia/*`, `RequireConsumer`, modal de derivación humana, panel de itinerario vivo, registro/login/profile consumer.
- **Fase 1.2:** internacionalización (i18n) con `LanguageSelector` y auto-detección de idioma.
- **PR 1 unificación:** ADR-002 + scaffolding (`dda48aac`).
- **PR 2 unificación:** routing + layouts + 3 fixes post-smoke (`4ce93f67`).
- **PR 3 unificación:** chat con switch agency/passenger + `mode_bridge` + migración B2B a `UnifiedLayout` + cierre de D14/D21 + reversión parcial C7.1.e (`d82ac244`, PR #75). **Cerrada en esta sesión.**

### Pendiente

- **PR 4 — purga de CRM/Marketplace/Reports, handoff completo, migration de reverso de `leads`, dead code acumulado, eliminar dual-write a `messages` (1.1.g). NO purga `standard_itinerary`. ← acá vamos a arrancar.**
- **PR 5 — export de itinerario a PDF (sistema custom existente, no PDFMonkey).**

---

## 3. Qué hizo PR 3 (resumen operacional)

PR 3 transformó el orchestrator de "routea por contenido del mensaje" a "routea estricto por modo del switch". El cambio se hizo en dos commits intencionalmente separados para auditabilidad: `8330edd2` agregó el parámetro `mode` opcional a `resolveConversationTurn` como **no-op deliberado** (la firma cambió, ningún comportamiento se alteró; test nuevo demuestra equivalencia), y `3dadeb12` implementó la regla estricta + la rama `mode_bridge`. El contrato resultante: agency mode → `standard_search` | `ask_minimal`; passenger mode → `planner_agent` | `ask_minimal` (revisado por C7.1.e, ver abajo). Cuando el contenido no matchea el modo activo, el orchestrator emite `mode_bridge` con el modo sugerido — el chat renderiza una tarjeta con CTA para cambiar. Guardrails G1 (agent nunca en passenger sin accountType válido) y G2 (consumer nunca ve agency) se implementan dentro de `resolveConversationTurn`.

El componente `ModeSwitch` (`5557db38`) vive en `src/features/chat/components/`, visible sólo para agents (consumers no tienen alternativa válida). Un agent con `agency_id` seteado arranca en agency mode por default; sin `agency_id`, en passenger. La derivación del estado del switch se hizo en una función pura (`deriveModeSwitchState`) con test unitario. El turno `mode_bridge` se materializa como mensaje renderable via `buildModeBridgeMessage` + `extractBridgeTurnProps` (`49240f53`), con thread handler options extendidas en `useMessageHandler`. El wiring end-to-end en `ChatFeature` + `ChatHeader` + `ChatInterface` quedó en `a1250728` (incluye rename de prop `userRole` → `accountType`) y `20e1a6f2` (primer cambio visual: el switch aparece en el header).

La rama B2B de `ChatFeature` se migró a `UnifiedLayout` en `c32c86b5` (reducción neta de 77 líneas). Era el TODO explícito que PR 2 había dejado abierto: post-PR-3 agents y consumers comparten layout, chrome, guard y entry point. Los 4 fixes post-smoke: stale closure en el handler al switchear modo en un turno en vuelo (`15e976da` — nuevo util puro `resolveEffectiveMode`), supresión de branding redundante "Emilia" en el `ChatHeader` bajo `UnifiedLayout` (`d2d30739`), overflow horizontal del carousel de recommended places bajo el nuevo layout (`18b122dc`), y gradient fade como scroll affordance visual (`f26039b2`).

La reversión parcial C7.1.e (`8e3c6fda`) fue el giro arquitectónico de PR 3. Input empírico `"armame un viaje a Europa 14 días"` comparado entre legacy path (consumer) y strict mode path (agent planner) mostró que `planner_agent` devuelve `hasPlannerData=false` / 0 segments / 0 places mientras `standard_itinerary` devuelve `true` / 4 segments / 6 places. El ADR-002 asumía que `planner_agent` producía `CanonicalItineraryResult` completo; empíricamente sólo emite prosa conversacional. El commit reescribe la regla "passenger sólo `planner_agent` o `ask_minimal`" → "passenger sólo `standard_itinerary` o `ask_minimal`". Modo agency intacto. `mode_bridge` y guardrails sin cambios. El addendum al ADR-002 (+28 líneas) documenta la decisión + tabla empírica + invariantes nuevas (el modo planner es soberano sobre `standard_itinerary`; `planner_agent` no puede volver a ser routing target sin re-emisión del diagnóstico).

El fix D21 (sidebar consumer mostrando vacío a pesar de tener 16 conversaciones companion) se dividió en dos commits: `d49824f7` documentó la causa raíz en `TECH_DEBT.md`, `c2507101` implementó el doble fix — `loadConversations` branchea por `accountType` (consumer → select directo sobre `conversations` con `eq('created_by', userId)`; agent → RPC existente `get_conversations_with_agency`), e `inferConversationWorkspaceMode` preserva el valor `'companion'` en lugar de degradarlo a `'standard'`. Test nuevo `useChat.loadConversations.test.ts` cubre los dos branches + la preservación del mode.

El cleanup final (`877a6c66`) cerró formalmente D11/D14/D21 en `TECH_DEBT.md`, documentó D17 como diferida (polish pre-launch), abrió D22 (doble fetch en `loadConversations` al mount, prioridad baja), y agregó `supabase/.temp/cli-latest` al flujo untracked.

**15 commits** mergeados a main vía `d82ac244` (merge `--no-ff` desde PR #75). Lista cronológica desde el más antiguo al más nuevo:

```
8330edd2 feat(chat): add optional mode param to resolveConversationTurn (no-op)
5557db38 feat(chat): add ModeSwitch component + pure state derivation
3dadeb12 feat(chat): strict mode routing in resolveConversationTurn + mode_bridge
49240f53 feat(chat): render mode_bridge turn + thread handler options
a1250728 feat(chat): wire chatMode state + bridge handlers + accountType prop rename
20e1a6f2 feat(chat): integrate ModeSwitch into ChatHeader — first visual change
c32c88b5 refactor(chat): migrate B2B branch to UnifiedLayout
15e976da fix(chat): pass mode override to handler to avoid stale closure in bridge switch
d2d30739 fix(chat): suppress redundant branding in ChatHeader for agents under UnifiedLayout
18b122dc fix(chat): prevent horizontal overflow in recommended places carousel under UnifiedLayout (v2)
f26039b2 fix(chat): add scroll affordance to recommended places carousel via gradient fade
8e3c6fda fix(routing): route agent planner mode to standard_itinerary (reverts ADR-002 partial)
d49824f7 chore(docs): document D21 sidebar consumer RPC mismatch
c2507101 fix(chat): load consumer sidebar conversations without agency filter (C7.1.f, closes D21)
877a6c66 chore(debt): close D21, review D11/D14/D17, add D22, untrack supabase cli-latest
d82ac244 Merge pull request #75 from lozadatravelagent/feat/pr3-chat-unification ← merge commit
a5adebfa docs(prs): add PR 3 chat unification PR description ← commit post-merge de doc
26fcae8b docs(status): mark PR 3 closed, update PR 4 scope post-C7.1.e ← commit de cierre documental
```

---

## 4. Estado actual del repo

- **Rama:** `main`, sincronizada con `origin/main` en `26fcae8b`.
- **Tests:** `npm test -- --run` → **330 passed / 11 skipped / 0 failed** (sin `SUPABASE_SERVICE_ROLE_KEY`). +79 vs el baseline post-PR-2 de 251/14/0: 6 test files nuevos en PR 3 (`deriveModeSwitchState`, `buildModeBridgeMessage`, `extractBridgeTurnProps`, `deriveDefaultMode`, `resolveEffectiveMode`, `useChat.loadConversations`) + adaptación de los 3 tests `.skip` de D14 al contrato vigente de strict mode.
- **Build:** `npm run build` limpio (warning informativo de chunk size de `ChatFeature-*.js` ~2.6 MB pre-existente, no error).
- **TSC:** `npx tsc --noEmit` limpio.
- **Working tree:** solo untracked esperados — `docs/handoffs/` (con este handoff y los anteriores), `docs/propuestas/`. Sin tracked modificados.

---

## 5. Deuda técnica vigente

| ID | Estado | Descripción |
|---|---|---|
| D1, D3-D9 | Histórica | Pre-1.1.a, no se tocan en PR 4. |
| D10 | ✅ CERRADA | 9 Apr 2026. `types.ts` regenerado desde prod. |
| D11 | ✅ CERRADA | 22 Apr 2026. Las dos fallas históricas `localStorage is not defined` no reaparecieron en el baseline 330/11/0 post-PR-3 ni en los 6 ciclos de test de PR 2. Cierre formal en `TECH_DEBT.md` commit `877a6c66`. Reservado: si reaparece en CI o entorno distinto, reabrir con contexto. |
| D12 | ✅ CERRADA | 9 Apr 2026. Migrations 1.1.a aplicadas a prod. |
| D13 | 🟡 PROCESO | Política: prohibido aplicar migrations a prod fuera de git. **Vigente para PR 4** (migration de reverso de `leads`). |
| D14 | ✅ CERRADA | 22 Apr 2026 (PR 3 / C3). Los 3 tests `.skip` de companion routing se adaptaron al contrato de strict mode (`workspaceMode='companion' → companion_fallback` pasó a `mode='passenger' → planner_agent | mode_bridge`, y luego a `standard_itinerary | mode_bridge` tras C7.1.e). No se reactivaron tal cual: el contrato cambió, los tests se re-escribieron para el contrato vigente. |
| D15 | 🟢 BAJA | `duplicateTrip` no setea `owner_user_id`. Sin call sites actuales. Fix trivial. |
| D16 | 🟢 BAJA | `superadmin_agencies_view` FK refs ausentes en types regenerado. Investigación pendiente. No bloquea features. |
| D17 | 🟢 UX DIFERIDA | `UnifiedLayout` sin i18n para avatar menu y logout. Decisión 2026-04-22: diferida fuera de scope PR 3, candidata a polish pre-launch. Consumer con `preferredLanguage ≠ 'es'` ve menú + "Cerrar sesión" en español hasta que se porte. |
| D21 | ✅ CERRADA | 22 Apr 2026. Sidebar consumer cargando RPC B2B equivocada. Fix productivo en `c2507101` (C7.1.f): doble branching en `loadConversations` + preservación de `workspace_mode='companion'`. Cierre formal en `877a6c66`. |
| **D22** | 🟢 BAJA (nueva) | Doble fetch en `loadConversations` al mount. `useCallback` con deps `[accountType, userId]` dispara un primer fetch con `accountType=undefined` antes de que `AuthContext` resuelva, luego re-run con los valores correctos. Funcionalmente correcto (segundo fetch pisa el primero), performance minor en cold-start. Fix sugerido: guard en el hook hasta que las deps estén resueltas. No bloquea PR 4. |

### 5.bis — Dead code consolidado para PR 4

PR 2 y PR 3 dejaron deliberadamente código sin consumers productivos para que PR 4 lo barra junto en una sola pasada atomic. Cambios vs el inventario que armamos pre-PR-3 (diff explícito para el reviewer):

**Sin cambios (vienen de PR 2):**
- `src/components/layouts/CompanionLayout.tsx` — sin consumers post-C7.
- `src/features/companion/utils/consumerAuthSchema.ts` exports `consumerLoginSchema` y `ConsumerLoginFormData` — sin callers productivos post-borrado de `ConsumerLogin.tsx`. El test `consumerAuthSchema.test.ts` sigue ejerciéndolos.
- `src/features/companion/services/consumerAuthService.ts` export `fetchUserAccountType` — `@deprecated` en C5b. Único caller era la lógica "agent entrando por puerta consumer".
- `src/lib/host.ts` exports `isEmiliaHost`, `isMainHost`, `mainOrigin`, `emiliaOrigin`, `isSafeReturnUrl`, `getHostname`, `EMILIA_HOSTS`, `MAIN_HOSTS`, `SAFE_RETURN_HOSTS` — todas `@deprecated` en C1/C2. Solo `COOKIE_DOMAIN` sobrevive.
- `src/components/skeletons/CRMSkeleton.tsx` y `ReportsSkeleton.tsx` — siguen importando `MainLayout`, mueren con sus pages.
- Pages completas: `src/pages/CRM.tsx`, `src/pages/Marketplace.tsx`, `src/pages/Reports.tsx`, `src/pages/HotelbedsTest.tsx`. Y todo `src/features/crm/` (chequear reusabilidad antes de borrar).

**Actualizados en PR 3:**
- `src/components/layout/MainLayout.tsx` — el status pre-PR-3 era "sobrevive para rama B2B de `ChatFeature` + skeletons". Post-PR-3 es **sólo skeletons**: PR 3 (`c32c88b5`) migró la rama B2B a `UnifiedLayout`. Se borra en PR 4 junto con los skeletons + sus pages.

**Nuevos post-PR-3:**
- `supabase/functions/planner-agent/` + handler `handlePlannerAgentTurn` en `src/features/chat/hooks/useMessageHandler.ts` — vivos pero **sin call sites de routing productivos** post-C7.1.e (passenger mode pasó a `standard_itinerary`). Candidato a eliminación en PR 4. La decisión de borrar o diferir se cierra en Paso 1 de PR 4 (requiere verificar consumers externos de la edge function deployada antes del drop). Invariante ADR-002 nuevo: no puede volver a ser routing target sin re-emisión del diagnóstico empírico que justifique su uso.
- **Dual-write a `messages` en `persistPlannerState`** (`src/features/trip-planner/hooks/usePlannerState.ts`) — desde 1.1.c, `trips` es source of truth para `loadPersistedPlannerState`; el dual-write sigue vivo como fallback para conversaciones pre-1.1.b. PR 4 lo elimina (1.1.g del roadmap original).

**Explícitamente NO en este inventario (cancelado por C7.1.e):**
- `standard_itinerary`. Es ahora la rama productiva del modo planner. Quitarla requeriría un nuevo ADR.

---

## 6. Reglas de proceso aprendidas (acumulativas)

Heredadas 1-21 de handoffs anteriores (ver `pre-PR-3.md` §6 para texto completo). Resumen:

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
15. Tests RLS contra local requieren 3 variables, no sólo `SERVICE_ROLE_KEY`.
16. Cambio de contrato de función → verificar TODOS los call sites.
17. Tradeoffs marginales se documentan en el PR aunque sean aceptables.
18. El patrón Paso 0 (read-only) + Paso 1 (plan en prosa) + Paso 2 (ejecución por commit) escala a PRs grandes.
19. Cinco reglas operacionales en ambigüedad: A (parar en duda), B (ningún commit fuera de lista), C (smoke es smoke, no razonamiento), D (decidí y actuá dentro del espíritu de instrucciones previas), E (micro-decisiones cosméticas documentadas).
20. Cambios empíricos requieren validación empírica.
21. Re-smokear cuando un path nuevo entra bajo `UnifiedLayout`.

### Aprendizajes nuevos de PR 3

**22. El "no-op separado" como patrón de cambio de contrato.** Cuando toca extender la firma de una función central (ej. `resolveConversationTurn`), dividir el cambio en dos commits: (a) agregar el parámetro opcional como no-op con test que demuestre equivalencia; (b) cambiar el comportamiento. Ventajas: auditabilidad, rollback granular, review split. PR 3 aplicó esto con `8330edd2` + `3dadeb12`. Reutilizable en futuras PRs que toquen contratos de funciones core.

**23. Reversión parcial de un ADR se documenta como addendum + commit explícito, no edit silencioso.** C7.1.e (commit `8e3c6fda`) modificó el ADR-002 con un addendum datado que incluye (a) supuesto falso identificado, (b) diagnóstico empírico con tabla, (c) nueva regla, (d) consecuencias sobre el plan de PRs, (e) invariantes nuevas. El commit de código y el commit de doc van juntos en la misma pasada. Evita que el reviewer/futuro yo tenga que adivinar si el ADR sigue vigente o se abandonó.

**24. La adaptación de tests `.skip` es válida cuando el contrato cambió; no hay que reactivar el texto literal del test si ese contrato ya no existe.** D14 (3 tests `.skip` de companion routing con contrato `workspaceMode='companion' → companion_fallback`) se cerró adaptando los tests al nuevo contrato de strict mode (`mode='passenger' → planner_agent | mode_bridge`, luego `→ standard_itinerary | mode_bridge` tras C7.1.e). No se reactivaron literalmente porque el contrato que testeaban ya no existe. Cierre válido; documentar en el commit de adaptación que se trata de cierre por re-escritura, no por reactivación.

---

## 7. Pre-requisitos de PR 4

Estado al cierre de esta sesión, verificable al inicio de la sesión nueva:

- ✅ ADR-002 + addendum C7.1.e mergeados a main.
- ✅ PR 3 (`d82ac244`, PR #75) mergeada. `git log --oneline -3` debe mostrar `26fcae8b` (status) arriba de `a5adebfa` (PR description) arriba de `d82ac244` (merge).
- ✅ main sincronizada con `origin/main`. `git pull --ff-only` debe decir "Already up to date".
- ✅ Tests baseline verificable: **330 / 11 / 0** sin `SUPABASE_SERVICE_ROLE_KEY`.
- ✅ Build limpio, TSC limpio.
- ✅ Working tree limpio al inicio. Untracked esperados: `docs/handoffs/` (con este handoff), `docs/propuestas/`.
- ⚠️ **D22 documentada pero no bloqueante.** Doble fetch en `loadConversations`, prioridad baja. Puede resolverse como fix independiente o dentro de PR 4 si toca `useChat.ts`.
- 🚨 **Pre-check crítico contra prod antes de correr la migration de reverso:** `SELECT count(*) FROM leads WHERE agency_id IS NULL`. Si > 0, decidir destino de esas filas en Paso 1 de PR 4 (drop vs reasignación a agency sentinel) **antes** de restaurar la constraint `NOT NULL`. Ver §11 para detalle operacional.

---

## 8. Qué sigue: PR 4

### Scope según ADR-002 + addendum C7.1.e

PR 4 es la PR de **purga** del roadmap original + cierre de deuda acumulada, con scope **reformulado** por C7.1.e. Qué entra:

- **Borrado de `src/features/companion/`:** `HandoffBanner`, `HandoffModal`, `handoffService`, `hasItineraryContent`, `handoffFormSchema`, `types.ts` (parte de handoff) y sus tests (`handoffFormSchema.test.ts`, `handoffService.test.ts`, `hasItineraryContent.test.ts`). Sobreviven y se relocalizan a `src/features/chat/` o `src/features/auth/`: `services/consumerAuthService.ts`, `utils/authRedirectDecider.ts`, `utils/consumerAuthSchema.ts` (y sus tests).
- **Migration de reverso `20260418000001_revert_b2c_handoff.sql`** (nueva, no edit de las viejas): drop columna `leads.trip_id`, restaurar `NOT NULL` en `leads.agency_id` y `leads.tenant_id`, drop policy RLS `consumer_insert_handoff_leads`, drop índices `idx_leads_trip_id` e `idx_leads_b2c_inbox`. Revisar `20260411000002_consumer_conversations_rls.sql` caso por caso: la parte que habilita consumer ver/crear sus propias conversaciones se mantiene; cualquier policy específica al handoff se dropea.
- **Borrado de pages:** `src/pages/CRM.tsx`, `src/pages/Marketplace.tsx`, `src/pages/Reports.tsx`, `src/pages/HotelbedsTest.tsx`. Y `src/features/crm/` entero (chequear reusabilidad antes de borrar).
- **Borrado de `MainLayout.tsx`** post-borrado de los skeletons que lo consumen.
- **Borrado de `CompanionLayout.tsx`** (ya sin consumers).
- **Borrado de `CRMSkeleton.tsx` y `ReportsSkeleton.tsx`** junto con sus pages.
- **Eliminación de dual-write a `messages` en `persistPlannerState`** (1.1.g del roadmap original). `trips` ya es source of truth para lectura desde 1.1.c.
- **Cleanup de deprecated exports:** `src/lib/host.ts`, `consumerAuthSchema.ts`, `consumerAuthService.ts::fetchUserAccountType`.

### Decisiones a cerrar en Paso 1 de PR 4 (no anticipar)

- **`planner_agent`: borrar o diferir.** Edge function `supabase/functions/planner-agent/` + handler `handlePlannerAgentTurn` en `useMessageHandler` siguen vivos sin call sites de routing productivos post-C7.1.e. Pro borrar: cleanup atómico, menos superficie que mantener. Pro diferir: la edge function está deployada (ver `B2C_STATUS.md` → "Edge functions deployadas") y puede tener consumers externos no registrados en el repo. Decisión requiere audit de consumers antes del drop.
- **Migration de reverso: condiciones de ejecución.** Si el pre-check de §7 devuelve `count > 0`, decidir destino de esas filas: (a) drop (asume que son handoffs de testing), (b) reasignación a una agency sentinel (preserva historial), (c) abort + investigar. La decisión se cierra en Paso 1 **con el count real en mano**, no antes.
- **`CompanionChatPage.tsx`: renombrar o mantener.** El nombre heredado ya no refleja el contenido (la page sirve tanto agent como consumer desde PR 2 / C7). Rename a `EmiliaChatPage.tsx` o similar es candidato, pero renombrar una page afecta imports en `App.tsx` y eventualmente en tests. Decisión de ergonomía vs churn.
- **Tests de routing legacy.** `App.tsx` tiene 6 redirects legacy de PR 2 (`/chat`, `/dashboard`, etc. → `/emilia/*`). Cuando PR 4 borre las pages CRM/Marketplace/Reports, algunos redirects pueden quedar huérfanos (el destino desaparece) o apuntar a rutas que ya no existen. Decisión: (a) agregar tests que validen que cada redirect devuelve 301/302 al destino vigente post-purga, (b) borrar los redirects cuyo destino desaparece y confirmar que el RootRedirect cubre el caso, (c) dejar los redirects tal cual y aceptar 404 eventual.
- **Test strategy.** Baseline post-purga esperado: tests de handoff desaparecen junto con su código; los 330 passed actuales deberían reducirse marginalmente. Definir cobertura mínima pre-merge: imports huérfanos cero, redirects verificados, RLS suite 11/11 contra local con migration de reverso aplicada.

### Restricciones (no reabrir)

- **NO tocar `standard_itinerary`.** Cancelado por C7.1.e. Es rama productiva permanente.
- **NO tocar `resolveConversationTurn` ni orchestrator.** Cerrado en PR 3.
- **NO modificar `TripPlannerState`** (Nivel 3, requeriría su propio ADR).
- **NO persistir el mode en DB** (decisión ADR-002).
- **NO introducir features nuevas.** PR 4 es estrictamente cleanup.
- **Una sola PR para todo el scope de PR 4.**
- **Los 330 tests pre-PR-4 deben seguir verdes** menos los que hablan de handoff (esos se borran junto con el código que testean; el delta esperado se cuantifica en Paso 0 de PR 4).

---

## 9. Primeros pasos en la sesión nueva

### Para Claude (planning)

Leer este handoff + `docs/adr/ADR-002-chat-unification.md` (incluyendo el addendum C7.1.e) + `docs/prs/pr3-chat-unification.md` (inventario autoritativo de qué cerró PR 3). Confirmar entendimiento del estado y del scope reformulado de PR 4. Generar prompt para Claude Code que arranque PR 4 siguiendo el patrón:

- **Paso 0 (read-only):** verificación de prerrequisitos (working tree limpio, main sync en `26fcae8b`, baseline 330/11/0, pre-check del SQL de `leads`, audit de consumers de `planner-agent` edge function).
- **Paso 1 (plan en prosa):** auditoría del estado + decisiones de §8 (planner_agent, migration de reverso condiciones, rename de CompanionChatPage, tests de redirects legacy, test strategy) en prosa para aprobar antes de tocar código.
- **Paso 2 (ejecución por commit):** implementación sólo después de OK explícito del Paso 1, con checkpoints estructurales (probables: purga de handoff, drop de pages, migration de reverso, cleanup de deprecated, eliminar dual-write, smoke final, docs).

### Para Claude Code (sesión nueva)

Antes de planning o auditoría, verificar:

1. Rama = `main`, sync con `origin/main` en `26fcae8b`, working tree limpio (untracked esperados: `docs/handoffs/`, `docs/propuestas/`).
2. Los 15 commits de PR 3 + el merge `d82ac244` + `a5adebfa` (doc) + `26fcae8b` (status) están en main. `git log --oneline -5` debe matchear.
3. `npm test -- --run` baseline = **330 passed / 11 skipped / 0 failed** (sin `SERVICE_ROLE_KEY`).
4. `npm run build` limpio.
5. `npx tsc --noEmit` limpio.
6. Si algo no coincide con este handoff, **PARAR y preguntar.**

---

## 10. Archivos clave para orientarse

**Documentos del proyecto:**
- `docs/adr/ADR-002-chat-unification.md` — decisión arquitectónica de la unificación + addendum C7.1.e (reversión parcial). Lectura obligatoria.
- `docs/prs/pr3-chat-unification.md` — inventario consolidado de qué cerró PR 3. Fuente autoritativa para §3 de este handoff.
- `docs/B2C_STATUS.md` — estado del producto post-PR-3 (actualizado en `26fcae8b`). Tiene secciones explícitas "Dead code pendiente para PR 4" y "TODO pre-PR-4".
- `docs/handoffs/Handoff___Emilia_B2C__post_PR-3__pre_PR-4.md` — este documento.
- `docs/handoffs/Handoff — Emilia B2C, post-PR-2 / pre-PR-3.md` — handoff anterior (formato de referencia).
- `TECH_DEBT.md` — registry de deuda, estado actualizado al 2026-04-22.

**Código a tocar en PR 4:**
- `src/features/companion/` — subdirectorio entero salvo los 3 archivos de auth consumer que se relocalizan.
- `src/pages/CRM.tsx`, `Marketplace.tsx`, `Reports.tsx`, `HotelbedsTest.tsx` — borrado completo.
- `src/features/crm/` — subdirectorio entero (pre-check reusabilidad).
- `src/components/layout/MainLayout.tsx`, `src/components/layouts/CompanionLayout.tsx` — borrado.
- `src/components/skeletons/CRMSkeleton.tsx`, `ReportsSkeleton.tsx` — borrado.
- `src/features/trip-planner/hooks/usePlannerState.ts` — eliminar dual-write a `messages` en `persistPlannerState` (1.1.g).
- `src/lib/host.ts` — eliminar deprecated exports, dejar sólo `COOKIE_DOMAIN`.
- `src/features/companion/utils/consumerAuthSchema.ts` — eliminar exports sin callers productivos.
- `src/features/companion/services/consumerAuthService.ts` — eliminar `fetchUserAccountType`.
- `supabase/migrations/20260418000001_revert_b2c_handoff.sql` — nueva migration.
- `supabase/functions/planner-agent/` + `src/features/chat/hooks/useMessageHandler.ts::handlePlannerAgentTurn` — según decisión de Paso 1.
- `src/App.tsx` — cleanup de redirects legacy según decisión de Paso 1.
- `src/pages/CompanionChatPage.tsx` — eventual rename según decisión de Paso 1.

**Referencia para imports huérfanos:**
- `git grep -l "HandoffBanner\|HandoffModal\|handoffService"` antes del drop debe devolver sólo archivos dentro de `src/features/companion/` + `CompanionChatPage.tsx`. Si aparece otro path, investigar antes de borrar.

---

## 11. Notas operacionales

- **🚨 Pre-check crítico contra prod antes de la migration de reverso de `leads`:** ejecutar `SELECT count(*), min(created_at), max(created_at) FROM public.leads WHERE agency_id IS NULL;` contra la DB de producción **antes** de correr `supabase db push` con la migration `20260418000001_revert_b2c_handoff.sql`. Si el count es > 0, son handoffs B2C→B2B reales que se hicieron antes de la decisión de ADR-002. La constraint `NOT NULL` va a fallar sobre esas filas. Decisión obligatoria en Paso 1 de PR 4 **con el count real en mano**: (a) drop (si son de testing), (b) reasignación a agency sentinel. **NO correr `supabase db push` antes de validar.** D13 (política: prohibido aplicar migrations a prod fuera de git) aplica: la migration se commitea al repo primero, después se aplica.
- **Credenciales filtradas en sesión de D12:** la service role key y la DB password de Vibook quedaron en el historial del chat de la sesión de D12. El usuario decidió no rotarlas. Si se exporta o comparte ese chat, son datos a tratar con cuidado.
- **Backup `~/backups/backup_pre_1.1.a_20260409_203300.sql`:** 2.38 GB en el disco activo del usuario. Decisión pendiente sobre archivar offline.
- **`docs/handoffs/` sigue untracked por convención.** Este archivo se queda en disco para que el usuario lo lea y lo suba a otro chat. No commitear acá.
- **`docs/propuestas/` también untracked por convención.** Mismo criterio.
- **`supabase/.temp/cli-latest`** agregado al flujo untracked en PR 3 (commit `877a6c66`). Archivo generado por el CLI de Supabase, no debe vivir en git.
- **`vite.config.ts::test.include`:** la allowlist es explícita, no glob recursivo. Si en PR 4 aparece un test file nuevo fuera de los paths listados, hay que agregarlo — los 6 tests files nuevos de PR 3 ya están cubiertos.
- **Consumer externo de `planner-agent` edge function:** antes de borrar la edge function en PR 4 (si esa es la decisión), audit de consumers externos. La edge function está deployada a Supabase; eliminarla del repo no la dropea de Supabase automáticamente. `supabase functions delete planner-agent --linked` es un paso separado explícito.
- **Smoke post-purga obligatorio:** el riesgo más alto de PR 4 es borrar algo que un path todavía importa transitivamente. Smoke en `/emilia/chat` agent + consumer, `/emilia/profile`, `/emilia/signup`, `/login`, `/emilia` (landing), cada admin page migrada. Working tree debe quedar limpio, TSC sin errores, tests passing (menos los que testeaban handoff, borrados junto con el código).
