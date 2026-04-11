# PR: Paso 1 — Structural separation motor/producto (B2C companion entrypoint)

## Scope

Abre el primer paso del roadmap macro post-Fase 1.1: separación UI/routing/layouts entre B2B y B2C sin tocar el motor compartido. Introduce la primera superficie B2C funcional (`/emilia/chat`) con su propio layout, sidebar filtrado a `'companion'`, y guard de acceso por `accountType='consumer'`.

Continua después de Fase 1.1 (trips como source of truth + read path + cleanup de dual-write). El motor compartido (`tripService`, `usePlannerState`, `useMessageHandler`, `conversationOrchestrator`, `planner-agent`) queda intacto.

## Problema que resuelve

Post-Fase 1.1, la capa de persistencia B2C está cerrada (trips write + read por owner_user_id, status `'exploring'`). Lo que **no** existía era una superficie B2C visible:

- No había `CompanionLayout` — el único layout de la app es `MainLayout`, con navegación completa de agencia (Dashboard, CRM, Marketplace, Reports, etc.).
- No había rutas `/emilia/*` autenticadas — `/emilia` era una landing pública estática.
- `ChatSidebar` filtraba positivamente a `'standard'` y `'planner'`, dejando conversaciones `'companion'` invisibles (aislamiento por omisión, no por filtrado defensivo explícito).
- Ningún caller creaba conversaciones `workspace_mode='companion'` — el enum DB existía pero la UI nunca lo disparaba.
- No había guard para proteger rutas B2C de acceso por agents ni para bloquear a consumers de acceso a rutas B2B.
- `?mode=companion` — entrypoint documentado en Fase 0 — nunca llegó al código.

Esta PR cierra ese gap estructural con código puro (sin schema changes, sin motor tocado).

## Que cambia

### `src/contexts/AuthContext.tsx` — Account type helpers

Agrega dos booleanos derivados al contexto:

```ts
isAgent: boolean;     // user?.accountType === 'agent'
isConsumer: boolean;  // user?.accountType === 'consumer'
```

El tipo `AuthUser` ya exponía `accountType` desde Fase 1.1.b. Ningún consumidor actual (Dashboard, CRM, etc.) los usa aún — son el anclaje para los guards y para futura lógica condicional basada en producto.

### `src/components/RequireConsumer.tsx` + `requireConsumerLogic.ts` — Guard component

Sigue el pattern de `ProtectedRoute`. Maneja 4 estados:

- `'wait'`: auth loading → render spinner
- `'redirect-login'`: sin user → navigate a `/login` con `state.from`
- `'redirect-home'`: user sin `isConsumer` → navigate a `/`
- `'render'`: consumer autenticado → render children

La lógica de decisión está extraída a `decideRequireConsumerAction()` en `requireConsumerLogic.ts` para testabilidad pura (sin DOM, sin React router). El componente consume la función y materializa los side effects.

**No se implementa `RequireAgent`**. Retrofittear a las rutas B2B existentes agrega riesgo de regresión (cada ruta es un punto de falla) y el usuario explícitamente marcó este scope como follow-up. Los agents que entren a `/emilia/chat` son redirigidos a `/`; los consumers que entren a `/crm` siguen viendo una página rota con data filtrada por RLS — sin cambio respecto al comportamiento actual (gap documentado).

### `src/components/layouts/CompanionLayout.tsx` — Chrome mínimo B2C

Layout limpio ~90 líneas:

- Header con brand "Emilia" (Sparkles icon + texto) y popover de user menu con logout
- `main` slot para children a full viewport minus header
- Sin navegación principal (no CRM, no Dashboard, no Reports, no admin screens)
- Sin `userRole` props ni rol checks
- Usa shadcn `Popover` / `Button` para coherencia visual con el resto de la app
- Directorio nuevo: `src/components/layouts/` (convive con `src/components/layout/MainLayout.tsx` singular — no renombro el existente para evitar churn)

### `src/features/chat/components/ChatSidebarCompanion.tsx` — Sidebar filtrado a `'companion'`

~90 líneas. Renderiza solo conversaciones `workspace_mode === 'companion'` **y** `state === 'active'`. Sin sección "Trips" (planner workspace es B2B-only en esta PR), sin search, sin archive, sin tabs. Botón "Nueva conversación" (`MessageCirclePlus`) que dispara `onCreateNewChat`. Estado vacío cuando no hay conversaciones.

El filtrado usa la nueva función pura `filterCompanionConversations(conversations)` extraída en `sidebarFilters.ts` — misma ubicación que los helpers existentes `getChatModeFilter` / `resolveVisibleHistoryMode`.

### `src/features/chat/utils/sidebarFilters.ts` — Helper de filtrado compartido

Agrega `filterCompanionConversations(conversations): ConversationWithAgency[]` — filter por `workspace_mode === 'companion' && state === 'active'`. Función pura, testeable sin DOM.

### `src/features/chat/hooks/useChatState.ts` — `defaultWorkspaceMode` option

Acepta un parámetro opcional:

```ts
const useChatState = (options: { defaultWorkspaceMode?: ConversationWorkspaceMode } = {}) => { ... }
```

Cuando se pasa, el estado inicial `workspaceMode` y `historyMode` usan ese default (en lugar del hardcoded `'standard'`). Además, el handler de `?new=1` URL param usa el `defaultWorkspaceMode` cuando crea la conversación automáticamente, así que `/emilia/chat?new=1` crea una conversación `companion`.

Los tipos de `setWorkspaceMode` y `setHistoryMode` se amplían de `'standard' | 'planner'` a `ConversationWorkspaceMode` (incluyendo `'companion'`) para consistencia. Ningún caller existente rompe — todos siguen llamando con `'standard'` o `'planner'`.

### `src/features/chat/ChatFeature.tsx` — `mode` prop opcional

Agrega `mode?: 'b2b' | 'companion'` (default `'b2b'`). Cuando `mode === 'companion'`:

1. `useChatState({ defaultWorkspaceMode: 'companion' })` — arranca en modo companion.
2. Nuevo handler `handleCreateCompanionConversation` que llama `createNewChat(undefined, 'companion')`.
3. **Render alternativo** antes del return de `MainLayout`: devuelve `<CompanionLayout>` con `ChatSidebarCompanion` + `ChatInterface` + `EmptyState`. Sin mobile split complejo (responsive simple), sin overlay sidebar, sin `TripPlannerWorkspace` (planner embedded es scope-out explícito, follow-up).

El engine (todos los hooks: `useMessages`, `useMessageHandler`, `useTripPlanner`, `useContextualMemory`, `usePdfAnalysis`, etc.) se reusa al 100%. Solo el outermost render branches. B2B default inalterado — cualquier consumer sin `mode` prop sigue renderizando el layout/sidebar/flow original.

**Nota arquitectónica**: esta parametrización es "Opción A" del plan (vs "Opción B" que era extraer a un hook + dos componentes hermanos). La Opción A es más quirúrgica y mantiene el engine en un solo lugar. El tradeoff: `ChatFeature` queda "mode-aware" en lugar de separado. La auditoría dice "separar cuando ramifica por UI/navegación" — esta PR ramifica vía un prop, no vía archivos. Gris defendible; el refactor completo puede venir más tarde cuando haya más claridad sobre qué diverge entre los dos productos.

### `src/pages/CompanionChatPage.tsx` — Page wrapper delgado

4 líneas: renderiza `<ChatFeature mode="companion" />`. Existe para tener un punto de anclaje nombrado en el routing y para facilitar lazy-loading.

### `src/App.tsx` — Rutas `/emilia/*` + legacy redirect

- Lazy import de `CompanionChatPage`.
- Rutas nuevas:
  - `/emilia/chat` → `<RequireConsumer><CompanionChatPage /></RequireConsumer>`
  - `/emilia/chat/:conversationId` → igual (deep-link placeholder para futuro; por ahora el conversation se maneja desde estado del hook).
- `/emilia` (landing pública) queda intacta.
- Nuevo componente `LegacyCompanionRedirect` que corre como sibling de `<Routes>` dentro de `BrowserRouter`: si detecta `?mode=companion` en la URL, `navigate('/emilia/chat', { replace: true })` preservando otros query params. Previene links hardcodeados externos con el param documentado en Fase 0 que nunca llegó al código.

## Que NO se toco

- **Motor compartido**: `tripService.ts`, `usePlannerState.ts`, `useMessageHandler.ts`, `conversationOrchestrator.ts`, `planner-agent/` edge function. Nada.
- **`MainLayout`**: B2B chrome intacto bit-a-bit.
- **`ChatSidebar` (B2B)**: filtros positivos a `'standard'` y `'planner'` siguen como están — ya son defense-in-depth efectivo (rechazan `'companion'` por no matchear).
- **Rutas B2B** existentes (`/dashboard`, `/chat`, `/crm`, `/marketplace`, `/reports`, `/users`, `/agencies`, `/tenants`, `/settings`, `/hotelbeds-test`) — siguen con `ProtectedRoute` sin retrofit de `RequireAgent`. Follow-up explícito.
- **`EmiliaLanding`** en `/emilia` — landing pública intacta.
- **`listTripsByUser`, `listTripsByAgency`, `deriveTripStatus`, `upsertTrip`** — lógica de Fase 1.1 intacta.
- **RLS policies** — sin cambios de schema.
- **`Role` type** — no se incluye `'CONSUMER'` en el enum frontend. Gap tipológico separado (la DB ya soporta `role='CONSUMER'`, el frontend debería reflejar eso en follow-up).
- **`?new=1` handling** — preservado, solo se extendió para respetar `defaultWorkspaceMode`.
- **Mobile split complejo del B2B chat view** — companion tiene un layout responsivo más simple (sidebar hidden en mobile cuando hay conversación seleccionada).

## Tests

### 11 tests nuevos en 2 archivos

**`src/features/chat/__tests__/sidebarFilters.test.ts`** (extendido, 5 tests nuevos):

- Caso defense-in-depth explícito: `getChatModeFilter('standard')` no deja pasar ninguna companion row aunque estén mezcladas en el array.
- `filterCompanionConversations` devuelve solo companion activas (4 sub-casos: mixed modes, archived excluded, empty, id-decoy que no leak).

**`src/components/__tests__/requireConsumerLogic.test.ts`** (nuevo archivo, 6 tests):

- Estado `loading` → `'wait'`.
- Sin user → `'redirect-login'`.
- User sin consumer → `'redirect-home'`.
- Consumer autenticado → `'render'`.
- Loading prioritiza sobre todo lo demás.
- Agent (non-consumer) nunca obtiene `'render'`.

### Tests NO escritos (por restricción de infra)

- **Tests de render JSX** (`@testing-library/react` + jsdom) quedaron fuera: la infraestructura actual de Vitest no tiene `@testing-library/react` instalado ni environment `jsdom`. Agregar esa infra es scope creep. Los componentes `ChatSidebarCompanion`, `CompanionLayout`, `RequireConsumer` son thin wrappers alrededor de funciones puras ya cubiertas, y del punto de vista de lógica de negocio están testeados.
- **Smoke manual** recomendado antes de merge (ver sección de verificación).

### Vitest config

`vite.config.ts` agrega `src/components/__tests__/*.test.ts` al `test.include` (antes solo estaban `trip-planner` y `chat`). Es la única entrada para que el nuevo test de `requireConsumerLogic` sea recogido por el runner. Cambio minimal.

## Baseline de tests

- **Pre-PR**: `144 passed | 12 skipped | 2 failed suites (D11)` (post-main sync)
- **Post-PR sin key**: `155 passed | 12 skipped | 2 failed suites (D11)` — 144 + 11 nuevos
- **Post-PR con key** (esperado): `164 passed | 3 skipped | 2 failed suites (D11)` — 155 + 9 RLS existentes
- **Build**: limpio
- **Lint**: sin nuevas warnings en archivos tocados (pre-existentes en otros archivos siguen)

## Verificación ejecutada

- [x] `npm run build` limpio (15s, chunks dentro del budget)
- [x] `npm test`: 155/12/2 ✅
- [x] 11 tests nuevos verdes (5 sidebarFilters + 6 requireConsumerLogic)
- [x] 144 tests pre-existentes verdes (sin regresión)
- [x] 2 failed suites pre-existentes (D11 localStorage) sin cambio
- [ ] Smoke manual con consumer user en `/emilia/chat` (pendiente — requiere entorno dev con user consumer creado)
- [ ] Smoke manual: agent intentando acceder a `/emilia/chat` → redirect a `/`
- [ ] Smoke manual: `/chat?mode=companion` → redirect a `/emilia/chat`
- [ ] Smoke manual: consumer en `/chat` → puede acceder (no hay RequireAgent aún — comportamiento conocido, follow-up)

## Riesgos

- **R1 — `ChatFeature` como código "mode-aware" en lugar de separado**: tradeoff consciente. La Opción B (extraer a hook + dos componentes hermanos) es el ideal arquitectónico pero duplica el wiring de ~25 hooks y ~15 handlers. Opción A (actual) añade ~55 líneas al archivo existente y un conditional render. Refactor completo cuando haya más claridad de qué diverge entre productos.
- **R2 — Consumer sin segments en companion no ve trip workspace embedded**: scope-out explícito. El planner_agent sigue funcionando (motor compartido) y los upserts a `trips` funcionan (logica en usePlannerState). Lo que falta es el render visual del `TripPlannerWorkspace` dentro de la companion page. Es una regresión de producto respecto al B2B pero no del motor. Follow-up.
- **R3 — Agents pueden seguir accediendo a `/crm` como consumer**: el gating B2B↔B2C es asimétrico. Esta PR protege `/emilia/*` de agents pero no protege `/crm`/`/dashboard`/etc. de consumers (comportamiento pre-PR sin cambio). Follow-up con `RequireAgent`.
- **R4 — `ChatFeature` crece en complejidad**: de 869 a ~920 líneas. Sigue siendo grande pero la complejidad nueva está localizada en un bloque condicional claramente marcado. El refactor a hook + wrappers separados reduciría esto significativamente.
- **R5 — Mobile UX mínimo en CompanionChatPage**: responsive básico (sidebar hidden en mobile cuando hay conversación seleccionada). Sin overlay drawer, sin hamburger menu. Aceptable para MVP, follow-up para polish.

## Follow-ups explícitos

1. **`RequireAgent`** en rutas B2B — proteger `/dashboard`, `/crm`, `/marketplace`, `/reports`, `/users`, `/agencies`, `/tenants`, `/settings`, `/hotelbeds-test` para redirigir consumers a `/emilia/chat` con mensaje explicativo.
2. **Extender `Role` type** en `src/types/index.ts` para incluir `'CONSUMER'` (la DB ya lo soporta vía CHECK constraint en migration 1.1.a).
3. **TripPlannerWorkspace embedded en companion** — decidir si el consumer ve el workspace visual para trips en curso, y renderizarlo en CompanionChatPage.
4. **Separación completa de ChatFeature** — extraer `useChatFeatureLogic()` hook, crear `CompanionChatFeature` y `B2BChatFeature` como wrappers distintos. Alinea con la auditoría pura.
5. **Mis viajes** — nueva página `/emilia/mis-viajes` que consume `listTripsByUser(user.id, 'consumer')` de Fase 1.1.e.
6. **Consumer signup flow** — flujo de creación de cuenta B2C dedicado (hoy solo hay login B2B en `/login`).
7. **EmiliaLanding redirect inteligente** — si un consumer logueado entra a `/emilia` (landing), redirigir automáticamente a `/emilia/chat`.
8. **Polish mobile UX** de `CompanionLayout` (hamburger menu, drawer sidebar).
9. **Tests de render** con `@testing-library/react` + jsdom para cubrir los componentes React (hoy solo cubrimos las funciones puras).
10. **`@testing-library/react` infra** — instalar + configurar jsdom env en vitest.

## Commits

1. `feat(auth): add isAgent/isConsumer helpers + RequireConsumer guard`
2. `feat(layout): add CompanionLayout for B2C chrome`
3. `feat(chat): add ChatSidebarCompanion + filterCompanionConversations helper`
4. `feat(chat): parametrize useChatState + ChatFeature with companion mode`
5. `feat(routes): add /emilia/chat + ?mode=companion legacy redirect`
6. `test: 11 unit tests for structural separation (sidebarFilters + requireConsumerLogic)`
7. `docs(prs): add Paso 1 structural separation PR description`

## Dependencias previas

- [Fase 1.1.a — B2C ownership schema](1.1.a-b2c-ownership.md)
- [Fase 1.1.b — upsertTrip adapter](1.1.b-upsert-trip-adapter.md)
- [Fase 1.1.c — trips as source of truth](1.1.c-trips-source-of-truth.md)
- [Fase 1.1.d — persist debounce + flush](1.1.d-persist-debounce.md)
- [Fase 1.1.e/f/g — B2C trips cleanup](1.1.e-f-g-b2c-trips-cleanup.md) (pending merge, PR #63)

## Next

Pasos 2-5 del roadmap macro:

2. Modal de derivación humana → lead al CRM B2B (handoff B2C → B2B)
3. Panel de itinerario vivo en companion
4. Registro / perfil consumer
5. Capa social (feed, perfiles públicos)
