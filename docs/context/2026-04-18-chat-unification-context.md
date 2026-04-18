# Contexto para sesión de unificación: chat B2B (cotizador) ↔ chat B2C (Emilia Planificadora)

**Fecha:** 18 Abril 2026
**Propósito:** Mapear el estado actual de ambos chats antes de evaluar su fusión en un único surface con switch agency/passenger. Este documento NO propone arquitectura — describe lo que existe.
**Modo de captura:** read-only sobre `main` en commit `d3c4124a`.

---

## 1. Entry points y routing

El router vive en `src/App.tsx` y arranca con una decisión host-based en la línea 225: `const AppRoutes = () => (isEmiliaHost() ? <EmiliaHostRoutes /> : <MainHostRoutes />);`. La función `isEmiliaHost()` (`src/lib/host.ts:22-24`) compara `window.location.hostname` contra el array `EMILIA_HOSTS = ['emilia.vibook.ai', 'emilia.localhost']`. En main host se sirven dos suites paralelas de rutas; en Emilia host se sirve una versión reducida pensada para consumers nativos del subdominio.

Las rutas relevantes en main host (`src/App.tsx`):
- **B2B agente:** `/dashboard` (141-145), `/chat` (148-153), `/crm` (156-161), `/marketplace` (164-169), `/settings` (172-177), `/reports` (180-185), `/users` (188-193), `/agencies` (196-201), `/tenants` (204-209). Todas envueltas en `<ProtectedRoute>`.
- **B2C consumer (Emilia):** `/emilia` landing (112), `/emilia/signup` (113), `/emilia/login` (114), `/emilia/chat` y `/emilia/chat/:conversationId` (116-129), `/emilia/profile` (132-137). Las tres últimas envueltas en `<RequireConsumer>`.

En Emilia host (`src/App.tsx:78-100`) las rutas son `/`, `/chat` (ambas `<ProtectedRoute><Chat />`), `/login` y `/auth/callback`. Es decir: en el subdominio Emilia se reusa el componente `Chat` de B2B sin guard de consumer, presumiblemente para seguir hospedando agentes desde otro DNS.

Cómo se crea una conversación nueva en cada producto:

**B2B** (`src/hooks/useChat.ts:187-296`) — `createConversation` arma el payload en líneas 241-250 con `workspace_mode: (params?.workspaceMode || 'standard')`. El default es `'standard'`. Los campos `agency_id` y `tenant_id` se derivan del usuario según rol (líneas 224-235): OWNER y SUPERADMIN pueden tener `agency_id = null`; ADMIN y SELLER siempre cargan el del perfil. `created_by` es siempre `user.id`.

**B2C** (`src/features/chat/hooks/useChatState.ts:135-233`) — `createNewChat` recibe `workspaceMode: ConversationWorkspaceMode = 'standard'` por default. La distinción se hace upstream: `CompanionChatPage` (`src/pages/CompanionChatPage.tsx:1-4`) renderiza `<ChatFeature mode="companion" />`, y `ChatFeature.tsx:82` traduce `mode === 'companion' ? 'companion' : 'standard'` antes de pasarlo a `useChatState`. Es decir: el modo se ramifica una sola vez, en el page-level wrapper. `consumer-signup` (`supabase/functions/consumer-signup/index.ts`) NO crea conversación al registro — la conversación se crea on-demand en la primera visita a `/emilia/chat`.

Sobre el switch actual: **no existe UI para alternar entre agencia y pasajero dentro de la misma sesión.** El acceso es route-locked y account-locked. El query param `?mode=companion` aparece en `src/App.tsx:59-76` solo como redirect legacy hacia `/emilia/chat` (preservando otros params); nunca llegó a producción como switch interactivo. La única "conversión" runtime es defensiva: `ConsumerLogin.tsx:69-77` detecta credenciales de agente y redirige a `/dashboard` con toast.

---

## 2. Orchestrator y routing de turnos

El cerebro está en `src/features/chat/services/conversationOrchestrator.ts`. La unión autoritativa de branches está en línea 26: `export type ConversationExecutionBranch = 'planner_agent' | 'ask_minimal' | 'standard_itinerary' | 'standard_search';`.

La decisión vive en `resolveConversationTurn` (líneas 426-529). Las tres condiciones core:

```typescript
// línea 450
const shouldUsePlannerAgent =
  routeResult.route === 'PLAN' && hasActivePlanner && !isDiscoveryIntent;

// líneas 451-458
const shouldAskMinimalQuestion =
  routeResult.route === 'COLLECT' &&
  Boolean(routeResult.collectQuestion) &&
  !collectExhausted &&
  (normalizedMissingFields.includes('passengers') ||
   (routeResult.reason === 'quote_intent_incomplete' && !hasPreviousParsedRequest && !hasPersistentContext));

// líneas 460-462
const shouldUseStandardItinerary =
  !shouldUsePlannerAgent &&
  (parsedRequest.requestType === 'itinerary' || routeResult.route === 'PLAN');
```

Si nada de lo anterior se cumple, cae al default `standard_search` (línea 516). Cada rama produce un objeto con `executionBranch`, `responseMode`, `messageType` y un `uiMeta` opcional.

Sobre `workspace_mode`: el parámetro está declarado en la firma de `resolveConversationTurn` (línea 88) **pero nunca se lee** dentro del cuerpo. El comentario en línea 681-682 del archivo lo confirma de manera explícita: "Always parse first, then route based on content (not workspace_mode)". O sea: hoy el modo companion **no influye** en la elección de rama. La rama se elige por contenido del mensaje + estado del planner, sea B2B o B2C.

Esto conecta con D14 / `resolveConversationTurn`: el archivo de tests `src/features/trip-planner/__tests__/conversationOrchestrator.test.ts` contiene un bloque `describe.skip('companion mode routing', ...)` en líneas 493-617 con tres casos:
- `companion mode: fallback routes to planner_agent with active planner` (esperado: `executionBranch = 'planner_agent'`, `uiMeta.reason = 'companion_fallback'`)
- `companion mode: fallback routes to ask_minimal without planner` (esperado: `'ask_minimal'`, `responseMode = 'needs_input'`)
- `standard mode: fallback unchanged when same input as companion test` (sanity check de no-regresión)

El comentario en líneas 488-492 dice: "Fase 1.0/1.0.5 closed partial — companion routing was not implemented. Recovered from stash during 1.1.b prerequisites verification. See D14 in TECH_DEBT.md."

**Lectura para la unificación:** D14 está pendiente. El routing companion-aware es aspiracional. Hoy ambos productos usan exactamente el mismo árbol de decisión y la separación se materializa solo arriba (en el dispatch UI / layout) y abajo (en RLS y `account_type`). El orchestrator ya es agnóstico — eso es bueno para una fusión.

`routeRequest.ts` (`src/features/chat/services/routeRequest.ts`) es el paso previo: scoring determinista de la request parseada con pesos `destination 0.30 / dates 0.25 / passengers 0.15 / origin 0.15 / complexity 0.15`. Devuelve `{ route: 'QUOTE'|'COLLECT'|'PLAN', score, reason, inferredFields, missingFields, collectQuestion }`. Las reglas:
- **QUOTE** (382-415): intent explícito `cotiz|precio|cuanto sale|cuanto cuesta` + destino con score ≥ 1.0 y total ≥ 0.75.
- **COLLECT** (393-403, 418-428): QUOTE intent incompleto, o request general entre 0.40 y 0.75.
- **PLAN** (343-379, 432-439): intent explícito `arma|planifica|itinerario|recorrido|ruta|circuito` o `parsedRequest.requestType === 'itinerary'`, o destino vago, o score < 0.40.

---

## 3. useMessageHandler y branches

`src/features/chat/hooks/useMessageHandler.ts` es el dispatcher autoritativo. Pesa más de 1900 líneas y combina dos niveles de routing: primero respeta lo que el orchestrator decidió, después dispatcha por `parsedRequest.requestType` cuando el orchestrator cae al default standard.

Switch principal (síntesis):

```typescript
// líneas 720-1171: rama planner_agent (alta prioridad)
if (conversationTurn.shouldUsePlannerAgent) {
  // supabase.functions.invoke('planner-agent', { ... })
  // ver líneas 830-857
}

// líneas 1185-1221: rama ask_minimal
if (conversationTurn.shouldAskMinimalQuestion && routeResult.collectQuestion) {
  // buildConversationalMissingInfoMessage(...)
  // persiste como messageType: 'collect_question'
}

// líneas 1866-1971: dispatch standard por requestType
switch (parsedRequest.requestType) {
  case 'flights':   return handleFlightSearch(parsedRequest);    // standard_search
  case 'hotels':    return handleHotelSearch(parsedRequest);     // standard_search
  case 'combined':  return handleCombinedSearch(parsedRequest);  // standard_search
  case 'itinerary': return handleItineraryRequest(parsedRequest, plannerState); // standard_itinerary
  default:          return handleGeneralQuery(parsedRequest);    // standard_search
}
```

Implementaciones de cada rama:
- `planner_agent` → edge function `supabase/functions/planner-agent/index.ts` (loop con OpenAI gpt-5.1, tools, guardrails). Timeout 50s con fallback a skeleton.
- `ask_minimal` → función pura `buildConversationalMissingInfoMessage` en `conversationOrchestrator.ts:171-192`.
- `standard_itinerary` → `handleItineraryRequest` en `src/features/chat/services/searchHandlers.ts`. Genera `TripPlannerState` y luego envuelve via `buildCanonicalResultFromStandard`.
- `standard_search` → `handleFlightSearch`, `handleHotelSearch`, `handleCombinedSearch`, `handleGeneralQuery` (todos en `searchHandlers.ts`). Salen contra Starling (vuelos) y EUROVIPS (hoteles), formatean cards.

Toda la salida (excepto `ask_minimal`) pasa por `itineraryPipeline.ts` y termina en `CanonicalItineraryResult`:

```typescript
// src/features/chat/services/itineraryPipeline.ts:16-35
export interface CanonicalItineraryResult {
  response: string;
  plannerData: TripPlannerState | null;
  flights: unknown[];
  hotels: unknown[];
  recommendedPlaces: ChatRecommendedPlace[];
  responseMode: ConversationResponseMode;
  conversationTurn: ConversationTurnResolution;
  source: 'AI_PARSER + EUROVIPS' | 'planner-agent';
  // ... emiliaRoute, requestText, actionChips, itineraryData, agentInjectData, editorial
}
```

Dos paths producen este shape: `buildCanonicalResultFromStandard` (líneas 153-189, source `'AI_PARSER + EUROVIPS'`) y `buildCanonicalResultFromAgent` (líneas 192-223, source `'planner-agent'`). Que ambas ramas converjan en un mismo tipo es el invariante explícito en `CLAUDE.md` y juega a favor de la unificación: el consumer del resultado (UI) no necesita conocer la rama.

---

## 4. UI layer diferencial

**MainLayout** (`src/components/layout/MainLayout.tsx:47-64`): nav rail vertical con Dashboard, Chat, CRM, Marketplace, Reports y sección admin (Settings, Users, Agencies, Tenants). Tiene sidebar lateral de 272px, rail de 72px, panel de chat en overlay de 360px. Incluye theme toggle, mobile menu, user menu con rol. Es el layout pesado del producto B2B.

**CompanionLayout** (`src/components/layouts/CompanionLayout.tsx:47-89`): header de 56px con icono Sparkles + label "Emilia", `LanguageSelector`, popover de usuario con iniciales. El cuerpo es `flex-1` con `calc(100vh - HEADER_HEIGHT)`. No tiene sidebar lateral, no tiene navegación multi-sección, no tiene admin. Es minimalista y consumer-facing.

Diferencias netas: MainLayout tiene nav admin, theme toggle y overlay panel de chat; CompanionLayout tiene LanguageSelector visible y branding Emilia. El sidebar de "Mis conversaciones" en companion vive dentro del surface de chat (`ChatSidebarCompanion`), no en el layout.

**Sidebars de chat:**

`src/features/chat/components/ChatSidebar.tsx` (B2B) en líneas 145-149 y 192 ramifica por `conversation.workspace_mode === 'planner'` vs `'standard'` para separar viajes de chats. La query subyacente es `get_conversations_with_agency()`, filtrada implícitamente por RLS según rol del agente.

`src/features/chat/components/ChatSidebarCompanion.tsx` líneas 35-37 llama a `filterCompanionConversations(conversations)`. La función vive en `src/features/chat/utils/sidebarFilters.ts:21-27`:

```typescript
export function filterCompanionConversations(conversations) {
  return conversations.filter(
    (conversation) => conversation.workspace_mode === 'companion' && conversation.state === 'active'
  );
}
```

O sea: el sidebar B2C muestra solo `workspace_mode === 'companion' && state === 'active'`, y RLS garantiza que solo vea las propias del consumer (`owner_user_id = auth.uid()`). El sidebar B2B muestra `'standard'` y `'planner'`, con RLS por agency.

**Itinerary panel:** `src/features/companion/components/ItineraryPanel.tsx` (líneas 27-29 props, 63-225 render) recibe solo `plannerState: TripPlannerState | null`, `onRequestChanges`, `className`. **No tiene referencia a `workspace_mode` ni a `accountType`**. Es agnóstico estructuralmente — el único acoplamiento es cosmético (labels en español, branding Emilia implícito en el contenedor). Para B2B existe `TripPlannerWorkspace` (`src/features/trip-planner/components/TripPlannerWorkspace.tsx`), que es read/write completo. ItineraryPanel es el resumen vivo read-only del companion; no tiene equivalente directo en B2B.

**Guards:** `RequireConsumer` (`src/components/RequireConsumer.tsx`) consulta `useAuth().isConsumer` y delega la decisión a `decideRequireConsumerAction` (`src/components/requireConsumerLogic.ts:1-23`):

```typescript
if (inputs.loading) return 'wait';
if (!inputs.userPresent) return 'redirect-login';   // → /emilia/login
if (!inputs.isConsumer) return 'redirect-home';      // → /
return 'render';
```

`ProtectedRoute` (`src/components/ProtectedRoute.tsx:10-41`) solo chequea autenticación; no discrimina por `accountType`. **No hay un `RequireAgent` formal** — los routes B2B confían en RLS server-side y en helpers como `get_user_role()`, `get_user_agency_id()`. Esto significa que un consumer logueado podría técnicamente navegar a `/dashboard` (la URL existe en MainHostRoutes) y solo no vería datos por RLS; no hay redirect proactivo en client.

---

## 5. Auth y account_type

`src/contexts/AuthContext.tsx` define la forma en líneas 8-16:

```typescript
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  tenant_id: string | null;
  agency_id: string | null;
  accountType: 'agent' | 'consumer';
  preferredLanguage: SupportedLanguage;
}
```

La derivación está en línea 100: `accountType: (userData.account_type as 'agent' | 'consumer') || 'agent'`. El default es `'agent'` cuando la columna está vacía — riesgo histórico para usuarios pre-migración. Los booleanos derivados en líneas 193-194: `const isAgent = user?.accountType === 'agent'; const isConsumer = user?.accountType === 'consumer';`. Se exponen en el value del context (218-219).

Lugares que leen `accountType` o sus derivados:
- `src/contexts/AuthContext.tsx` (100, 193-194, 218-219) — origen
- `src/components/RequireConsumer.tsx` (12) — guard
- `src/components/requireConsumerLogic.ts` (21) — lógica del guard
- `src/pages/ConsumerLogin.tsx` (29, 69) — `isConsumer` + `fetchUserAccountType()` para detectar agentes que entran por puerta de consumer
- `src/pages/ConsumerSignup.tsx` (28, 35) — `isConsumer`
- `src/features/companion/services/authRedirectDecider.ts` (32-33) — decide redirect post-login según tipo
- `src/features/trip-planner/services/tripService.ts` (21, 24, 56, 63-67, 141) — cambia status del trip y nullea `agency_id`/`tenant_id` cuando es consumer
- `src/features/trip-planner/hooks/usePlannerState.ts` — flag `isConsumer`

**Rutas con comportamiento ramificado por `accountType` en client:** `/emilia/login` (redirect a `/dashboard` si llega un agent), `/emilia/chat` y `/emilia/profile` (redirect a `/` si no es consumer vía `RequireConsumer`). Para el resto, la ramificación está en la lógica de creación de trips/leads, no en el routing.

---

## 6. Modelo de datos relevante

**`conversations.workspace_mode`** (enum Postgres `conversation_workspace_mode`):
- Migración base `20260307000001_add_conversation_workspace_mode.sql` línea 8: valores iniciales `'standard'`, `'planner'`. Default `'standard'` (línea 13).
- Migración de extensión `20260407000001_add_companion_workspace_mode.sql` línea 3: `ALTER TYPE ... ADD VALUE 'companion'`. No cambió comportamiento por sí sola — solo abrió el valor.
- Quien lo setea en runtime: `useChat.createConversation` (default 'standard') y `useChatState.createNewChat` (recibe el modo de `ChatFeature` que viene de la prop `mode`).

**`users.account_type`** (`20260409000002_b2c_ownership.sql`):
- Líneas 70-71: `ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'agent'`.
- CHECK línea 91-94: `account_type IN ('agent', 'consumer')`.
- CHECK acoplado a role líneas 102-108: `(account_type='agent' AND role IN ('OWNER','SUPERADMIN','ADMIN','SELLER')) OR (account_type='consumer' AND role='CONSUMER')`. **Esto es duro: un consumer no puede tener role agente y viceversa.**

**`trips.account_type` y `trips.owner_user_id`** (mismo migration):
- Líneas 120-122: `ALTER TABLE trips ADD COLUMN owner_user_id UUID FK users(id)`.
- Líneas 135-141: backfill `owner_user_id = COALESCE(created_by, last_edited_by, sentinel_uuid)`.
- Líneas 167-168: `ALTER TABLE trips ADD COLUMN account_type TEXT NOT NULL DEFAULT 'agent'`.
- Líneas 243-286: cambio de FK de `agency_id`/`tenant_id` de CASCADE a SET NULL (necesario para trips de consumer sin agencia).

Cómo se setea en cada flujo:
- **B2B:** `tripService.upsertTrip` setea `owner_user_id = current_user.id`, `account_type = 'agent'`, `agency_id` y `tenant_id` desde el perfil del agente.
- **B2C:** mismo `upsertTrip` con `accountType: 'consumer'` (línea 141 de `tripService.ts`), nullea `agency_id` y `tenant_id`. El `owner_user_id` es el consumer.

RLS para trips (sección 10-11 del migration):
```sql
CREATE POLICY "consumer_select_own_trips" ON trips
  USING (get_user_role()='CONSUMER' AND owner_user_id=auth.uid());
CREATE POLICY "consumer_insert_own_trips" ON trips
  WITH CHECK (get_user_role()='CONSUMER' AND owner_user_id=auth.uid() AND account_type='consumer');
```

**`leads`** (`20260411000001_b2c_handoff_leads.sql`):
- Líneas 42-43: `agency_id` y `tenant_id` ahora nullables.
- Línea 101-103: nueva columna `trip_id UUID FK trips(id) ON DELETE SET NULL`.
- Líneas 110-116: índices nuevos `idx_leads_trip_id` y `idx_leads_b2c_inbox` (parcial: `WHERE agency_id IS NULL AND status='new'`) — anticipan el inbox B2C que está pendiente.
- Política `consumer_insert_handoff_leads` (142-155): exige `get_user_account_type()='consumer'`, `agency_id IS NULL`, `tenant_id IS NULL`, `assigned_user_id IS NULL`, `conversation_id` no nulo y que la conversation pertenezca al consumer.

Generación de leads:
- **B2C:** `src/features/companion/services/handoffService.ts` (líneas 43-85). `buildHandoffLeadPayload` arma explícitamente `agency_id: null`, `tenant_id: null`, `assigned_user_id: null`, `status: 'new'`, `trip: { type: 'b2c_handoff', ... }`. Inserta directo via cliente Supabase y RLS valida.
- **B2B:** no hay un creador centralizado en `src/features/crm/` ni en `src/features/chat/` que se llame "createLead". Los leads B2B se generan implícitamente desde otros flujos (probablemente por trigger o desde el agent loop). La inspección no encontró un único punto de entrada — esto es un dato a confirmar antes de unificar el inbox.

---

## 7. Tests actuales que cubren ramificación B2B vs B2C

- `src/components/__tests__/requireConsumerLogic.test.ts` — decisiones del guard (wait/redirect-login/redirect-home/render).
- `src/features/chat/__tests__/sidebarFilters.test.ts` — `filterCompanionConversations`, `getChatModeFilter('companion')`, exclusión de companion en filtros B2B.
- `src/features/companion/__tests__/authRedirectDecider.test.ts` — destino post-login según tipo de cuenta.
- `src/features/companion/__tests__/consumerAuthSchema.test.ts` — validación zod del registro consumer.
- `src/features/companion/__tests__/handoffFormSchema.test.ts` — validación del form de handoff.
- `src/features/companion/__tests__/handoffService.test.ts` — construcción del payload del lead (NULLs forzados).
- `src/features/trip-planner/__tests__/b2cOwnershipRls.test.ts` — RLS para trips de consumer (`describe.skipIf` condicional según env, no siempre corre).
- `src/features/trip-planner/__tests__/conversationOrchestrator.test.ts` — routing core; **incluye `describe.skip('companion mode routing', ...)` en líneas 493-617** (D14, sin implementar).
- `src/features/trip-planner/__tests__/listTripsByUser.test.ts` — listado de trips diferenciando agente vs consumer.
- `src/features/trip-planner/__tests__/itineraryPipeline.test.ts` — builders del canonical result (no ramifica por producto, pero valida invariante).

---

## 8. Inventario de hardcoding por producto

Comparaciones explícitas con el modo o el tipo de cuenta, **excluyendo orchestrator y useMessageHandler**:

`workspace_mode === 'companion'` o equivalente:
- `src/features/chat/ChatFeature.tsx:82` — `mode === 'companion' ? 'companion' : 'standard'` para el default workspace.
- `src/features/chat/ChatFeature.tsx:792` — `if (mode === 'companion')` selecciona layout companion vs B2B.
- `src/features/chat/utils/sidebarFilters.ts:4, 12, 25` — strings `'companion'` y `'standard'` cableados en helpers de filtrado.
- `src/features/chat/components/ChatSidebar.tsx:145, 149, 192` — chequeos `workspace_mode === 'planner'` / `'standard'` para separar viajes de chats en B2B.
- `src/hooks/useChat.ts:25` — `workspace_mode === 'planner'` para inferencia legacy.

`accountType === 'consumer'` o equivalente:
- `src/features/trip-planner/services/tripService.ts:21, 24, 56, 63-67, 141` — deriva status del trip (`exploring` vs `draft`) y nullea agency/tenant.
- `src/features/trip-planner/hooks/usePlannerState.ts` — flag `isConsumer` para decisiones en el planner.
- `src/pages/ConsumerLogin.tsx:69-77` — detecta agente que entró por `/emilia/login` y lo manda a `/dashboard`.

Componentes hoy companion-only que necesitarían volverse agnósticos o ramificar en un chat unificado:
- `src/features/companion/components/HandoffBanner.tsx` y `HandoffModal.tsx` — UI exclusiva de derivación a humano. Si el chat unificado debe servir B2C, hay que decidir si el banner aparece según `accountType` o se reemplaza con otra acción para agentes.
- `src/features/companion/components/ItineraryPanel.tsx` — estructuralmente agnóstico (no chequea modo), pero las labels en español y el branding implícito Emilia lo atan al consumer.
- `src/components/layouts/CompanionLayout.tsx` — actualmente único hosting de `LanguageSelector` visible en header. En unificación el header tendría que decidir qué chrome muestra.
- `src/features/chat/components/ChatSidebarCompanion.tsx` — duplicado parcial de `ChatSidebar`. Una sidebar única tendría que filtrar por `accountType` o por `workspace_mode` selecto del usuario.
- `src/pages/CompanionChatPage.tsx` y `src/pages/Chat.tsx` — page-level wrappers. Hoy son dos archivos casi simétricos que difieren solo en `mode="companion"` vs default.

**No hay componentes B2B-only que excluyan activamente al consumer.** Las páginas B2B (`Dashboard`, `CRM`, etc.) confían en RLS server-side y no chequean `isConsumer` en client. Esto es un punto de exposición: en un chat unificado conviene endurecer guards client-side antes de abrir surfaces compartidos.

---

## 9. Riesgos y acoplamientos no obvios

1. **Doble path de host (`emilia.vibook.ai` vs `vibook.ai/emilia/*`)**. Hoy conviven dos formas de servir B2C: subdominio dedicado (`EmiliaHostRoutes` reusa `Chat` de B2B sin guard de consumer) y subpath en main (`/emilia/*` con `RequireConsumer`). Si la unificación tiende hacia un chat único en main, el subdominio Emilia queda como zombie o como white-label específico. Definir el destino de ese host antes de mover código.

2. **`workspace_mode` está en la tabla pero el orchestrator lo ignora.** El orchestrator decide por contenido del mensaje. Eso significa que la "diferencia entre productos" hoy vive en el dispatch UI (qué layout, qué sidebar), no en el cerebro del chat. Es buena noticia para la fusión, pero implica que renombrar a `'standard'` los chats companion no rompería nada del routing — pero sí rompería el filtro del sidebar y el flujo de leads. Cualquier migración del enum requiere coordinar UI y RLS de leads simultáneamente.

3. **D14 sigue abierto y los tests skipeados marcan una intención.** Los tests companion están escritos esperando que `workspace_mode` sí ramifique (companion + sin planner → ask_minimal). Si se decide unificar bajo un solo modo "passenger" o un toggle, hay que decidir explícitamente si esa intención de companion-aware routing se implementa o se descarta. Hoy está en limbo.

4. **`AuthContext` defaultea `accountType` a `'agent'` cuando `account_type` está vacío** (`AuthContext.tsx:100`). Si un usuario migrado pre-`20260409000002` no tiene la columna seteada, queda como agent automáticamente. Riesgo: un consumer mal migrado no entra al guard de consumer y termina en B2B. Auditar antes de unificar.

5. **No hay `RequireAgent` en client.** Toda la protección B2B es server-side via RLS. En un chat unificado con switch en runtime (digamos un toggle accesible para usuarios duales si existieran), cualquier ruta sensible necesita guard client + server. Hoy un consumer logueado puede navegar a URLs B2B y solo no vería datos. Cosmético, pero ruidoso.

6. **`leads` B2B no tiene un creador centralizado visible en `src/`.** Para el inbox unificado o para coordinar leads B2B+B2C en una misma vista, necesitamos saber dónde nacen los leads de agente — buscar en triggers Postgres, en el flujo del agent loop, o en `pdf-ai-analyzer`. La exploración no lo encontró.

7. **`ChatSidebar` tiene tres caminos (`'standard'`, `'planner'`, `'companion'`)** distribuidos entre el sidebar B2B y el companion. La unificación necesita decidir si el sidebar único muestra las tres categorías como tabs, las filtra por `accountType`, o introduce un cuarto modo "all". Cualquier opción rompe los filtros actuales.

8. **`tripService.upsertTrip` ya soporta ambos `accountType` con un solo entry point.** Esto es un activo: el motor de trips ya es unificado, no hay que reescribirlo. La unificación del chat puede apoyarse en este patrón (un solo creator, ramifica internamente por contexto).

9. **Branding y localización viven en lugares distintos por producto.** `LanguageSelector` solo está en `CompanionLayout` (B2B no lo expone visualmente, aunque la i18n está). Branding "Emilia" está hardcodeado en `CompanionLayout` y en strings de `ConsumerLogin/Signup`. Una unificación con switch dinámico necesita extraer el branding a una capa configurable — hoy está acoplado al layout.

10. **Documentación paralela en `docs/handoffs/`** (untracked): seis documentos de handoff de fase + auditoría B2B/B2C + propuesta comercial. Antes de la sesión de planning conviene revisar `docs/handoffs/auditoria-b2b-b2c-emilia.md` y `Emilia B2C.md` para no duplicar contexto ya capturado por handoffs anteriores.

---

## Apéndice: archivos-mapa rápido

- Routing: `src/App.tsx`, `src/lib/host.ts`
- Orchestration: `src/features/chat/services/conversationOrchestrator.ts`, `routeRequest.ts`, `itineraryPipeline.ts`
- Dispatch: `src/features/chat/hooks/useMessageHandler.ts`, `src/features/chat/services/searchHandlers.ts`
- Branches B2C: `src/pages/CompanionChatPage.tsx`, `src/features/chat/ChatFeature.tsx`, `src/features/companion/`
- Branches B2B: `src/pages/Chat.tsx`, `src/hooks/useChat.ts`, `src/features/chat/components/ChatSidebar.tsx`
- Auth: `src/contexts/AuthContext.tsx`, `src/components/RequireConsumer.tsx`, `src/components/ProtectedRoute.tsx`
- Trips: `src/features/trip-planner/services/tripService.ts`, `usePlannerState.ts`, `TripPlannerWorkspace.tsx`
- Leads: `src/features/companion/services/handoffService.ts` (B2C), creador B2B no localizado
- Schema: `supabase/migrations/20260307000001_add_conversation_workspace_mode.sql`, `20260407000001_add_companion_workspace_mode.sql`, `20260409000002_b2c_ownership.sql`, `20260411000001_b2c_handoff_leads.sql`, `20260411000002_consumer_conversations_rls.sql`
- Tests con ramificación: ver sección 7
