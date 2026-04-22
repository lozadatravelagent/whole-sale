# PR 3 — Chat unification: switch estricto agency/passenger + mode_bridge + migración B2B a UnifiedLayout

## Scope

Unifica el chat B2B y B2C en un unico surface con switch estricto agency/passenger en el header, materializa la UX de puente entre modos (`mode_bridge`), migra la rama B2B de `ChatFeature` a `UnifiedLayout` y cierra la deuda residual dejada por PR 2 (D14/D21). Implementa las decisiones del [ADR-002](../adr/ADR-002-chat-unification.md) — incluyendo la reversion parcial documentada en el addendum del 2026-04-18 (commit `8e3c6fda`, ver §3.2). Continua [PR 2 (unificacion routing/layouts)](../../docs/B2C_STATUS.md#unificación-b2bb2c-en-progreso).

El contrato resultante: el orchestrator deja de routear por contenido del mensaje y pasa a routear estricto por modo — agency → `standard_search` | `ask_minimal`, passenger → `standard_itinerary` | `ask_minimal`. Cuando el contenido del mensaje no matchea el modo activo, el orchestrator emite `mode_bridge` y el chat renderiza una sugerencia guiada de cambio de modo en lugar de procesar mal el turno. El switch vive en client state (no persiste en DB) y viaja como parametro por turno.

## Que NO se toca en esta PR

- **Purga de `src/features/companion/`** (HandoffBanner, HandoffModal, ItineraryPanel, handoffService, etc.): sigue vivo, PR 4.
- **Paginas CRM / Marketplace / Reports**: siguen vivas, PR 4.
- **Migration de reverso del handoff** (`leads.trip_id`, `consumer_insert_handoff_leads`, etc.): PR 4.
- **`standard_itinerary`**: queda como **codigo vivo y permanente** — es la rama productiva del modo planner desde C7.1.e (ver §3.2). La purga originalmente planeada en PR 4 se **cancela**.
- **`planner_agent` edge function + handler**: vivo pero sin call sites de routing productivos. Decision sobre eliminar/reescribir diferida a PR futura, fuera del alcance de PR 3–5.
- **Dual-write a `messages`** en `persistPlannerState`: sigue activo, se elimina en PR 4.
- **`MainLayout.tsx`**: sobrevive solo para los skeletons `CRMSkeleton`/`ReportsSkeleton` — se borra en PR 4 junto con las pages.
- **Export de itinerario a PDF** (`generateCustomItineraryPdf`): PR 5.

## Decisiones arquitectonicas

### 3.1 — Strict mode routing (ADR-002 decision #3)

Hasta PR 2, `resolveConversationTurn` routeaba por contenido: un mensaje "armame un itinerario para Italia" desde agency mode caia en `standard_itinerary`, un mensaje "cotizame vuelos a Roma" desde passenger mode caia en `standard_search`. El modo era una decision arquitectural materializada en rutas y layouts separados, no un parametro del turno.

PR 3 invierte la regla. El orchestrator recibe `mode: 'agency' | 'passenger'` como parametro explicito del request y solo puede emitir las branches validas para ese modo. Cuando el contenido no matchea, emite `mode_bridge` con el modo sugerido — el chat renderiza una tarjeta con CTA de cambio. Guardrails G1 (agent nunca en passenger sin accountType valido) y G2 (consumer nunca ve agency) se implementan dentro de `resolveConversationTurn`.

El switch es **visible solo para agents** (consumers no tienen alternativa valida). Agent con `agency_id` seteado arranca por default en agency mode; sin `agency_id`, en passenger. El modo NO se persiste en DB — vive en `chatMode` de `ChatFeature`, viaja como parametro al orchestrator, y el historial queda ciego al modo del turno (tradeoff aceptado en ADR-002).

### 3.2 — Reversion parcial C7.1.e: planner mode → `standard_itinerary`

El ADR-002 original (decision #3) afirmaba que en passenger mode el orchestrator solo podia emitir `planner_agent` o `ask_minimal`, asumiendo que `planner_agent` producia `CanonicalItineraryResult` con segments + editorial + recommendedPlaces estructurados. **Ese supuesto es incorrecto**: empiricamente `planner_agent` solo emite prosa conversacional; no hidrata el panel derecho del workspace.

Diagnostico empirico (input identico "armame un viaje a Europa 14 dias"):

| Escenario                              | executionBranch      | hasPlannerData | segmentCount | recommendedPlacesCount |
|----------------------------------------|----------------------|----------------|--------------|------------------------|
| Consumer (legacy path)                 | `standard_itinerary` | **true**       | 4            | 6                      |
| Agent planner mode (strict ADR-002)    | `planner_agent`      | **false**      | 0            | 0                      |

El commit `8e3c6fda` reemplaza la regla "passenger solo `planner_agent` o `ask_minimal`" por "passenger solo `standard_itinerary` o `ask_minimal`". Modo agency queda intacto. `mode_bridge` y guardrails G1/G2 sin cambios. `planner_agent` (edge function + handler `handlePlannerAgentTurn`) queda como **codigo vivo sin call sites de routing**; su remocion o reescritura requiere un nuevo ADR.

**Consecuencia sobre el plan de PRs**: la PR 4 originalmente planeada para eliminar `standard_itinerary` se **cancela** en esa parte. La PR 4 conserva su alcance de purga (handoff, CRM/Marketplace/Reports, migration de reverso) pero NO toca `standard_itinerary`.

**Invariantes nuevas** (documentadas en el addendum de ADR-002):

- El modo planner es soberano sobre `standard_itinerary`; quitar esa rama requeriria un nuevo ADR.
- `planner_agent` no puede volver a tener call sites de routing sin re-emision del diagnostico empirico que justifique su uso (debe producir `plannerData` estructurado o no se route-a).

## Que cambia

### A+B — Scaffolding del orchestrator + strict mode routing

Dos commits en secuencia, intencionalmente separados para que el cambio de contrato sea auditable:

- `8330edd2` feat(chat): add optional mode param to resolveConversationTurn (no-op) — agrega el parametro `mode` opcional a la signature sin modificar ninguna rama. El test nuevo demuestra que con `mode` undefined el comportamiento es identico al pre-PR-3. Es un **no-op deliberado**: deja el terreno preparado para el cambio real del commit siguiente sin mezclarlo con cambio de contrato.
- `3dadeb12` feat(chat): strict mode routing in resolveConversationTurn + mode_bridge — implementa la regla ADR-002 #3 (strict branches por modo) + la rama `mode_bridge` cuando el contenido no matchea el modo. Adapta los 3 tests `.skip` de D14 al nuevo contrato (no los reactiva tal cual): el contrato cambio de `workspaceMode='companion' → companion_fallback` a `mode='passenger' → planner_agent | mode_bridge` (y luego → `standard_itinerary` tras C7.1.e).

Archivos: `src/features/chat/services/conversationOrchestrator.ts`, `src/features/chat/__tests__/conversationOrchestrator.test.ts`.

### C — ModeSwitch component + derivacion pura del estado

- `5557db38` feat(chat): add ModeSwitch component + pure state derivation — nuevo `src/features/chat/components/ModeSwitch.tsx` (visible solo para agents) y util puro `src/features/chat/utils/deriveModeSwitchState.ts` que deriva `{ visible, disabled, activeMode }` desde `accountType` + `currentMode`. Tests unitarios de la derivacion como funcion pura. i18n es/en/pt agregado en `locales/*/chat.json`.

### D — Render del mode_bridge turn + thread handler opts

- `49240f53` feat(chat): render mode_bridge turn + thread handler options — materializa el turno `mode_bridge` como mensaje renderable en el thread. Nuevos utils `buildModeBridgeMessage.ts` + `extractBridgeTurnProps.ts` con tests unitarios. `useMessageHandler` extendido con opciones de thread para inyectar el turno. Orchestrator agrega el shape del payload `mode_bridge`. i18n es/en/pt para el copy del bridge.

### E+F — Wiring del chatMode state + migracion B2B a UnifiedLayout

Dos commits narran la integracion UI + la unificacion visual:

- `a1250728` feat(chat): wire chatMode state + bridge handlers + accountType prop rename — `ChatFeature` agrega `chatMode` state (inicializado por `deriveDefaultMode` segun `accountType` + `agency_id`), handlers de bridge pasados a `ChatInterface`, rename de la prop de `userRole` → `accountType` (mejor matchea el tipo de `AuthContext`). Nuevo util puro `deriveDefaultMode.ts` con test.
- `20e1a6f2` feat(chat): integrate ModeSwitch into ChatHeader — **primer cambio visual** de PR 3: el switch aparece en el header para agents. Solo cambios de wiring, ninguna logica nueva.
- `c32c88b5` refactor(chat): migrate B2B branch to UnifiedLayout — elimina `MainLayout` del codepath B2B; ambos flujos (agent y consumer) renderizan bajo `UnifiedLayout`. Reduccion neta de 77 lineas en `ChatFeature.tsx`. Esta unificacion visual era el TODO explicito que PR 2 dejo abierto en `B2C_STATUS.md`.

### G — Fixes post-smoke

Cuatro fixes detectados durante smoke de la rama unificada:

- `15e976da` fix(chat): pass mode override to handler to avoid stale closure in bridge switch — al switchear de modo dentro de un turno en vuelo, el closure capturado en el handler podia disparar con el modo viejo. Nuevo util puro `resolveEffectiveMode.ts` con test.
- `d2d30739` fix(chat): suppress redundant branding in ChatHeader for agents under UnifiedLayout — evita doble branding "Emilia" cuando el agent ya ve el chrome del `UnifiedLayout`.
- `18b122dc` fix(chat): prevent horizontal overflow in recommended places carousel under UnifiedLayout (v2) — overflow-x del carousel bajo el nuevo layout.
- `f26039b2` fix(chat): add scroll affordance to recommended places carousel via gradient fade — gradient fade visual como pista de scroll horizontal en el carousel de recommended places.

### H — Reversion parcial C7.1.e

- `8e3c6fda` fix(routing): route agent planner mode to standard_itinerary (reverts ADR-002 partial) — ver §3.2. Este commit toca `ADR-002-chat-unification.md` (addendum +28 lineas), `conversationOrchestrator.ts` (regla passenger: `planner_agent` → `standard_itinerary`) y adapta 5 tests en `conversationOrchestrator.test.ts`.

### I — Fix D21: sidebar consumer cargando la RPC B2B

Dos commits — el documento primero, el fix despues:

- `d49824f7` chore(docs): document D21 sidebar consumer RPC mismatch — documenta el bug detectado durante smoke de C7.1.b: consumers con historial ven "Aun no hay conversaciones" porque el sidebar llama `get_conversations_with_agency` que filtra por `agency_id`, y los consumers no tienen agency. Bug pre-existente, no introducido por PR 3.
- `c2507101` fix(chat): load consumer sidebar conversations without agency filter (C7.1.f, closes D21) — doble fix en un solo commit:
  1. `loadConversations` en `useChat.ts` branchea por `accountType`: consumer → select directo sobre `conversations` con `eq('created_by', userId)`; agent → RPC existente `get_conversations_with_agency`.
  2. `inferConversationWorkspaceMode` en `useChatState.ts` preserva el valor `'companion'` de la columna en lugar de degradarlo a `'standard'` — bug paralelo que mantenia conversaciones companion invisibles aun con la RPC corregida.

Tests: nuevo `useChat.loadConversations.test.ts` (+74 lineas) cubre los dos branches + la preservacion del mode.

**Nota**: el cierre formal de D21 en `TECH_DEBT.md` vive en el commit de cleanup `877a6c66` (grupo J); el fix productivo vive en este commit.

### J — Cleanup de deuda + housekeeping

- `877a6c66` chore(debt): close D21, review D11/D14/D17, add D22, untrack supabase cli-latest — cierra formalmente D11/D14/D21 en `TECH_DEBT.md`, documenta D17 como diferida (polish pre-launch), abre D22 (doble fetch en `loadConversations` al mount, prioridad baja), agrega `supabase/.temp/cli-latest` al flujo de untracked (archivo generado por el CLI de Supabase que no debe vivir en git).

## Tests

Delta vs baseline PR 2:

- **Pre-PR-3** (post-PR-2, sobre `feat/pr2-unification-routing-layouts`): 251 passed / 14 skipped / 0 failed.
- **PR 3 final** (sobre `feat/pr3-chat-unification` HEAD): **330 passed / 11 skipped / 0 failed**. Delta: **+79 passed, -3 skipped**.

Test files nuevos (6):

1. `src/features/chat/__tests__/deriveModeSwitchState.test.ts` — derivacion pura del estado del switch.
2. `src/features/chat/__tests__/buildModeBridgeMessage.test.ts` — shape del mensaje de bridge.
3. `src/features/chat/__tests__/extractBridgeTurnProps.test.ts` — extraccion de props del turno para render.
4. `src/features/chat/__tests__/deriveDefaultMode.test.ts` — modo default segun accountType + agency_id.
5. `src/features/chat/__tests__/resolveEffectiveMode.test.ts` — resolucion del mode override (fix del stale closure).
6. `src/hooks/__tests__/useChat.loadConversations.test.ts` — branching por accountType + preservacion de workspace_mode.

Tests adaptados:

- `src/features/chat/__tests__/conversationOrchestrator.test.ts` — cierre de D14 por adaptacion (los 3 `.skip` pasan al contrato vigente de strict mode) + 5 casos adaptados en C7.1.e (`planner_agent` → `standard_itinerary`).

Los -3 skipped reflejan los 3 tests de D14 que pasaron de `.skip` a activos bajo el contrato adaptado. El test de pipeline `itineraryPipeline.test.ts` (`buildCanonicalResultFromAgent`) se mantiene: testea el wrap canonico del handler `planner_agent`, que sigue vivo aunque sin call sites de routing.

## Backwards compatibility

- **Agent flow B2B identico** al nivel de orchestrator cuando el mensaje matchea agency mode: el request cae en `standard_search` o `ask_minimal` exactamente como antes. Lo unico que cambia es que el orchestrator ahora rechaza (via `mode_bridge`) los mensajes de intent itinerary en agency mode — pero esto es el comportamiento deseado post-ADR-002.
- **Consumer flow B2C identico** al nivel de orchestrator: el request cae en `standard_itinerary` (post-C7.1.e) tal como caia pre-PR-3 en el legacy path.
- **Sin schema changes**: no hay migrations en este PR. `workspace_mode`, `account_type`, `owner_user_id` siguen identicos.
- **Dual-write a `messages` preservado**: `persistPlannerState` escribe a `trips` (via debounce 3s de 1.1.d) y a `messages`. Se elimina en PR 4.
- **Continuidad Nivel 2 garantizada**: `previousParsedRequest` sobrevive el switch de modo dentro de la misma conversacion — se resetea solo al cambiar de conversacion, comportamiento identico a pre-PR-3.

## Deuda documentada

Cerradas en PR 3:

- **D11** — vitest localStorage failures: no reproduce en 6 ciclos de test + verificacion empirica.
- **D14** — companion routing en resolveConversationTurn: 3 tests `.skip` adaptados al contrato strict mode (no reactivados tal cual).
- **D21** — sidebar consumer cargando RPC B2B: fix productivo en `c2507101`, cierre formal en `877a6c66`.

Diferida fuera de scope PR 3:

- **D17** — UnifiedLayout sin i18n para avatar menu y logout. Candidata a polish pre-launch. Usuario consumer con `preferredLanguage ≠ 'es'` ve el menu del avatar y "Cerrar sesion" en español hasta que se porte.

Nueva abierta en PR 3:

- **D22** — doble fetch en `loadConversations` al mount: `useEffect` dispara un primer fetch con `accountType=undefined` antes de que `AuthContext` resuelva, luego re-run con los valores correctos. Funcionalmente correcto (segundo fetch pisa el primero), performance minor en cold-start. Prioridad baja.

Debt item agregado (no es un riesgo operacional):

- **`planner_agent` sin call sites productivos** — la edge function + `handlePlannerAgentTurn` quedan vivos pero ninguna branch de `resolveConversationTurn` los invoca. Candidato a eliminacion en una PR futura; hoy se deja por conservadurismo (evita el costo de decidir si borrar la edge function deployada). Invariante ADR-002 nuevo: no puede volver a ser routing target sin re-emision del diagnostico empirico.
- **`standard_itinerary` NO se purga en PR 4** — revertido por C7.1.e. Es ahora la rama productiva del modo planner.
- **Dual-write a `messages` sigue activo hasta PR 4**.

## Riesgos

- **R1 — Historial ciego al modo del turno**: un mensaje persistido en `messages` no lleva `mode_at_turn`. Reabrir una conversacion vieja muestra el contenido pero no el contexto de qué modo estaba activo cuando cada turno ocurrio. Aceptado en ADR-002 porque el caso de uso primario es la conversacion viva, no auditoria retrospectiva. Si en el futuro se necesita ese campo, se agrega como columna nullable sin romper nada.
- **R2 — Continuidad Nivel 2 no integra cotizaciones al TripPlannerState**: un agent que cotiza vuelos en agency mode y despues arma itinerario en passenger mode ve el itinerario actualizado pero NO ve los vuelos cotizados integrados al estado del viaje — los ve como cards separadas en el historial del chat. Aceptado para MVP, resuelto cuando se aborde Nivel 3 (requerira su propio ADR).

## Verificacion ejecutada

- [x] `npm test -- --run`: 330 passed / 11 skipped / 0 failed (32 test files, 1 skipped por falta de `SUPABASE_SERVICE_ROLE_KEY` — `b2cOwnershipRls.test.ts`).
- [x] `npm run build`: limpio, exit 0 (warning esperado de chunk size de `ChatFeature`, no error).
- [x] `npx tsc --noEmit`: sin errores, exit 0.
- [x] RLS integration suite contra Supabase local (con `SUPABASE_SERVICE_ROLE_KEY`): 11/11 verdes.
- [x] Smoke manual en `/emilia/chat` con cuentas agent (OWNER, SELLER) y consumer (`tester@tester.com`): switch visible solo para agents, sidebar consumer lista 16 conversaciones companion, sidebar agent lista 36 conversaciones con RPC, `mode_bridge` dispara en intent cruzado.

<details>
<summary>Output — npm test (sin SUPABASE_SERVICE_ROLE_KEY)</summary>

```
 Test Files  31 passed | 1 skipped (32)
      Tests  330 passed | 11 skipped (341)
```

1 skipped = `b2cOwnershipRls.test.ts` (requiere `SUPABASE_SERVICE_ROLE_KEY`). 11 skipped restantes = tests marcados `.skip` en otras suites (no afectados por PR 3).
</details>

<details>
<summary>Output — npm run build</summary>

```
✓ built in 29.75s
```

Warning informativo de chunk size sobre `ChatFeature-*.js` (2.6 MB). Pre-existente, no introducido por PR 3. Se aborda con code-split dedicado en PR futura.
</details>

<details>
<summary>Output — npx tsc --noEmit</summary>

```
(sin output — exit 0)
```
</details>

<details>
<summary>Output — RLS integration suite (con SUPABASE_SERVICE_ROLE_KEY contra local)</summary>

```
 Test Files  1 passed (1)
      Tests  11 passed (11)
```
</details>

## Commits

Agrupados por categoria (ver §4). Orden cronologico:

**A+B — Scaffolding + strict mode routing**
1. `8330edd2` feat(chat): add optional mode param to resolveConversationTurn (no-op)
2. `3dadeb12` feat(chat): strict mode routing in resolveConversationTurn + mode_bridge

**C — ModeSwitch component**
3. `5557db38` feat(chat): add ModeSwitch component + pure state derivation

**D — Render del mode_bridge turn**
4. `49240f53` feat(chat): render mode_bridge turn + thread handler options

**E+F — Wiring + migracion B2B a UnifiedLayout**
5. `a1250728` feat(chat): wire chatMode state + bridge handlers + accountType prop rename
6. `20e1a6f2` feat(chat): integrate ModeSwitch into ChatHeader — first visual change
7. `c32c88b5` refactor(chat): migrate B2B branch to UnifiedLayout

**G — Fixes post-smoke**
8. `15e976da` fix(chat): pass mode override to handler to avoid stale closure in bridge switch
9. `d2d30739` fix(chat): suppress redundant branding in ChatHeader for agents under UnifiedLayout
10. `18b122dc` fix(chat): prevent horizontal overflow in recommended places carousel under UnifiedLayout (v2)
11. `f26039b2` fix(chat): add scroll affordance to recommended places carousel via gradient fade

**H — Reversion parcial C7.1.e**
12. `8e3c6fda` fix(routing): route agent planner mode to standard_itinerary (reverts ADR-002 partial)

**I — Fix D21 sidebar consumer**
13. `d49824f7` chore(docs): document D21 sidebar consumer RPC mismatch
14. `c2507101` fix(chat): load consumer sidebar conversations without agency filter (C7.1.f, closes D21)

**J — Cleanup de deuda + housekeeping**
15. `877a6c66` chore(debt): close D21, review D11/D14/D17, add D22, untrack supabase cli-latest

## Dependencia previa

- [PR 2 — Unificacion de routing y layouts](../B2C_STATUS.md#unificación-b2bb2c-en-progreso) (mergeada en rama `feat/pr2-unification-routing-layouts`).
- [ADR-002 — Unificacion del chat B2B/B2C](../adr/ADR-002-chat-unification.md) + addendum 2026-04-18 (reversion parcial C7.1.e).

## Next

- **PR 4** (alcance reformulado post-C7.1.e): purga de `src/features/companion/` (handoff), CRM/Marketplace/Reports pages, `MainLayout`, skeletons asociados, migration de reverso del handoff en `leads`. **NO toca `standard_itinerary`** (cancelado).
- **PR 5**: export de itinerario a PDF (`generateCustomItineraryPdf` sobre el sistema custom existente).
