# PR: Paso 2 — Modal de derivación humana (B2C handoff to CRM inbox)

## Scope

Cierra el Paso 2 del roadmap macro post-Fase 1.1: cuando un consumer en `/emilia/chat` tiene un viaje suficientemente claro (destino + fechas + viajeros + estructura razonable), Emilia muestra un banner sticky abajo del chat con el CTA "¿Querés que te ayude a buscar vuelos y hoteles?". Al clickear, se abre un modal con formulario pre-rellenado desde el plannerState. Al enviar, se crea un lead en la tabla `leads` con el contexto completo del viaje (trip_id, conversation_id, datos de contacto, descripción con `summarizePlannerForChat`), y el consumer recibe un toast de confirmación.

Continua después de Paso 1 (separación estructural). El motor compartido (`tripService`, `usePlannerState`, `useMessageHandler`, `conversationOrchestrator`, `planner-agent`) queda intacto. El flow B2B de leads (`createLead`, `CRM` page, `LeadDialog`, `useLeadManager`, `createComprehensiveLeadFromChat`) tampoco se toca.

## Problema que resuelve

Post-Paso 1, el consumer entra a `/emilia/chat`, conversa con Emilia, el planner_agent upserta el viaje en `trips`. Pero **no hay salida comercial**: el consumer puede planificar pero no hay manera de derivar al equipo humano para vuelos/hoteles. Esta PR cierra ese gap.

Antes de esta PR:
- Schema `leads` es 100% B2B. `agency_id` y `tenant_id` son `NOT NULL`. No existe `trip_id` (la relación es unidireccional vía `trips.lead_id`).
- RLS `leads_insert_policy` exige `agency_id = get_user_agency_id()` o `role = OWNER`. Un consumer (sin agency, sin tenant) no puede insertar.
- No existe función que determine cuándo un viaje está "listo" para derivación.
- No existe banner/modal de CTA en el companion chat.
- No existe `handoffService` — la función `createComprehensiveLeadFromChat` existente es exclusivamente B2B (asigna al SELLER actual, usa `userData` del agent).

## Que cambia

### Schema + RLS (`supabase/migrations/20260411000001_b2c_handoff_leads.sql`)

Migration SQL. NO se aplica a prod en esta PR — solo se agrega el archivo. El deploy lo hace el usuario con revisión posterior (política D13).

1. **`leads.agency_id` y `leads.tenant_id` pasan a NULLABLE**. Pattern de 1.1.a (`trips.agency_id`/`tenant_id` nullable). Consumer-originated leads carry NULL para ambos, identificándolos como "B2C inbox".
2. **FKs cambian a `ON DELETE SET NULL`** (antes eran `CASCADE`). Dynamic constraint name lookup para seguridad.
3. **Agrega `leads.trip_id UUID NULL` FK** a `trips.id` con `ON DELETE SET NULL`. Simétrico al `trips.lead_id` existente. Cuando un consumer envía handoff, el lead queda linkeado al trip row vía este campo.
4. **Índices nuevos**:
   - `idx_leads_trip_id` — para joins rápidos cuando el CRM busque el trip de un lead.
   - `idx_leads_b2c_inbox` (partial) — `(created_at DESC) WHERE agency_id IS NULL AND status = 'new'`. Para el listado del B2C inbox que los agents reclamarán (follow-up: vista UI del inbox).
5. **Nueva RLS policy `consumer_insert_handoff_leads`** — permite a un consumer insertar un lead **solo cuando**:
   - `account_type = 'consumer'`
   - `agency_id IS NULL AND tenant_id IS NULL AND assigned_user_id IS NULL`
   - `conversation_id IS NOT NULL` y apunta a una conversación donde `conversations.created_by = auth.uid()`

**Las policies existentes (`leads_select_policy`, `leads_insert_policy`, `leads_update_policy`) no se tocan**. El path B2B sigue funcionando idéntico; el consumer path usa la nueva policy y no puede shadowear la B2B porque requiere `account_type='consumer'` explícito.

### `src/features/trip-planner/handoffReadiness.ts` (nuevo)

Función pura `isTripReadyForHandoff(state: TripPlannerState | null): boolean` que devuelve `true` cuando el plannerState cumple:

- `destinations` tiene al menos una ciudad no vacía.
- `segments.length > 0` y cada segment tiene `city` no vacío.
- `startDate` + `endDate` O `isFlexibleDates === true`.
- `travelers.adults >= 1`.
- `generationMeta.uiPhase === 'ready'`.
- `generationMeta.isDraft !== true`.

Criterio conservador — intencionalmente evita gatillar para plannerStates a medio generar. Si el producto quiere CTAs más tempranos, se relaja `uiPhase`/`isDraft` en follow-up.

### `src/features/companion/` (nuevo directorio)

- **`types.ts`** — `HandoffFormDraft`, `HandoffUserContext`, re-export de `HandoffFormData`/`HandoffBudgetLevel`.
- **`utils/handoffFormSchema.ts`** — schema Zod del formulario con validación:
  - `name` required min 2.
  - `email` required formato email.
  - `phone` required min 6.
  - `origin` opcional.
  - `startDate`/`endDate` opcionales. Refinement: `endDate >= startDate` si ambos presentes.
  - `adults` int >= 1, max 20.
  - `children` int >= 0, max 20, default 0.
  - `budgetLevel` enum opcional (`'low' | 'mid' | 'high' | 'luxury'`).
  - `comment` opcional, max 4000 chars.
- **`services/handoffService.ts`** — tres funciones puras + una async:
  - `buildHandoffDraftFromPlanner(plannerState, user)` — construye valores iniciales para el form pre-rellenando desde plannerState y `user.email`.
  - `buildHandoffLeadPayload(formData, plannerState, conversationId, tripId)` — construye el payload para el insert. Guarda `agency_id/tenant_id/assigned_user_id = null`, setea `contact: { name, email, phone }`, denormaliza el trip en `trip: { type: 'b2c_handoff', origin, destinations, primary_city, start_date, end_date, is_flexible_dates, adults, children, budget_level }`, y construye el `description` con el comentario del usuario + `summarizePlannerForChat(plannerState)` como resumen del viaje.
  - `findTripIdForConversation(conversationId)` — lookup a `trips.id` filtrado por `conversation_id`, para linkear el lead con `trip_id`.
  - `requestHumanHandoff(formData, plannerState, conversationId, user)` — orquesta: trip lookup → payload → insert → devuelve `{ leadId }` o `null` si falla. Fire-and-forget error handling con `console.warn`.
- **`components/HandoffBanner.tsx`** — banner sticky ~30 líneas. Icon + texto + botón "Pedir ayuda humana". Se oculta cuando `visible === false`. Responsive (columna en mobile).
- **`components/HandoffModal.tsx`** — shadcn `Dialog` + `react-hook-form` + `zodResolver(handoffFormSchema)`. Pre-rellena defaults vía `buildHandoffDraftFromPlanner` en cada apertura (reset en `useEffect([open, plannerState?.id])`). Muestra loading spinner durante submit. Toasts para éxito/error. Cierra modal al éxito + dispara `onSubmitted(leadId)`.

### `src/features/chat/ChatFeature.tsx` (modificado)

Solo en el branch `mode === 'companion'`:

- Nuevo estado local: `isHandoffModalOpen` (boolean), `handoffSubmittedConversations` (Set\<string\> — conversaciones en las que el consumer ya envió handoff).
- Evaluación: `showHandoffBanner = selectedConversation && isTripReadyForHandoff(planner.plannerState) && !handoffSubmittedConversations.has(selectedConversation)`.
- Render: inside el main content del companion render, wrappea `ChatInterface` + `HandoffBanner` en un fragment. El banner queda sticky abajo del chat content.
- `HandoffModal` se monta a nivel del `CompanionLayout` root, al final. Se abre/cierra con el estado local. En `onSubmitted(leadId)`, agrega el `selectedConversation` al Set `handoffSubmittedConversations` para ocultar el banner inmediatamente.

**No toca el B2B render path**. No toca el motor (`useMessageHandler`, `useTripPlanner`, etc.). No cambia props existentes.

También extiende el destructure de `useAuth()` para incluir `user` (antes solo `isOwner`, `isSuperAdmin`) — necesario para pasar al modal.

### `vite.config.ts`

Agrega `src/features/companion/__tests__/*.test.ts` al `test.include` para que los tests nuevos sean recogidos por el runner.

## Que NO se toco

- **Motor compartido**: `tripService`, `usePlannerState`, `useMessageHandler`, `conversationOrchestrator`, `planner-agent/`, `useTripPlanner`. Nada.
- **`MainLayout`**, rutas B2B, `ChatSidebar` B2B, pages B2B — nada.
- **Flow B2B de leads**: `createLead` en `lib/supabase-leads.ts`, `useLeadManager`, `leadService`, `CRM` page, `LeadDialog`, `createComprehensiveLeadFromChat`, `TransferOwnerDialog`, `useReports`, `useAgencies`, `Agencies` page, `LeadSelector` — ninguno tocado.
- **Policies RLS existentes**: `leads_select_policy`, `leads_insert_policy`, `leads_update_policy`, owner/seller/admin policies, messages/conversations/trips policies — intactas. Solo se agrega `consumer_insert_handoff_leads` como policy nueva sin conflicto.
- **Schema columns**: solo se relajan constraints (agency_id/tenant_id NOT NULL → NULLABLE) y se agrega `trip_id` + índices. No se borra ni renombra nada.
- **`Role` type** — el gap con `'CONSUMER'` sigue (follow-up de Paso 1).
- **Paso 1 structural separation** — `CompanionLayout`, `ChatSidebarCompanion`, `RequireConsumer`, routing `/emilia/*`, legacy redirect — todo intacto.

## Tests

### 32 tests nuevos en 3 archivos

**`src/features/trip-planner/__tests__/isTripReadyForHandoff.test.ts`** (11 tests):

- `null` / `undefined` → `false`
- Trip completo, ready, non-draft → `true`
- Destinations vacío → `false`
- Destinations solo whitespace → `false`
- Sin segments → `false`
- Segment con city vacío → `false`
- Sin dates ni flexible → `false`
- Flexible dates sin startDate/endDate → `true`
- Adults = 0 → `false`
- `uiPhase !== 'ready'` → `false`
- `isDraft === true` → `false`

**`src/features/companion/__tests__/handoffFormSchema.test.ts`** (8 tests):

- Payload mínimo válido → pasa.
- Nombre vacío → error.
- Email inválido → error.
- Teléfono < 6 chars → error.
- Adults = 0 → error.
- Prefilled con dates/origin/budget/comment → pasa.
- `endDate < startDate` → error en `endDate`.
- `budgetLevel` desconocido → error.

**`src/features/companion/__tests__/handoffService.test.ts`** (13 tests):

- `buildHandoffDraftFromPlanner`:
  - Prefill desde plannerState + user.email (3 sub-casos incluyendo null planner y adults=0 → coerced to 1).
- `buildHandoffLeadPayload`:
  - Payload fully-shaped con agency/tenant null, status='new'.
  - Trim whitespace en contact fields.
  - Denormalización del trip en `trip` JSONB (origin, destinations, primary_city, dates, adults, children, budget_level, type='b2c_handoff').
  - Description incluye comentario + separator + `summarizePlannerForChat`.
  - Description sin separator cuando comentario vacío.
  - `trip_id` null cuando no se encuentra trip.
  - Fallback a `destinations[0]` cuando no hay segments.
- `requestHumanHandoff` (mocked supabase):
  - Insert con `trip_id='trip-123'` de lookup exitoso → devuelve `{ leadId: 'lead-456' }`.
  - Trip lookup sin row → insert con `trip_id: null` → éxito.
  - Error de insert → devuelve `null`.

### Tests NO escritos (scope cut)

- **Render tests** (`HandoffModal`, `HandoffBanner`, `ChatFeature` companion render) — la infra `@testing-library/react` + `jsdom` sigue sin estar (follow-up de Paso 1).
- **RLS integration tests** para la policy nueva (requieren `SUPABASE_SERVICE_ROLE_KEY`). La policy es declarativa y auditable manualmente; se verifica en smoke post-merge.
- **End-to-end del flow completo** (consumer clickea banner → completa form → submit → lead visible en DB) — requiere dev env con consumer user configurado.

### Baseline

- **Pre-PR**: 155 passed / 12 skipped / 2 failed suites (D11 localStorage) — post-merge de #64.
- **Post-PR**: **187 passed / 12 skipped / 2 failed suites (D11)** — 155 + 32 nuevos.
- **Build**: limpio (22.8s).
- **Lint**: warnings/errors pre-existentes en archivos que no toco (ChatFeature `any` types, etc.). Sin nuevas warnings en archivos nuevos o modificados.

## Verificación ejecutada

- [x] `npm test` — 187/12/2 ✅
- [x] `npm run build` limpio ✅
- [x] 11 unit tests `isTripReadyForHandoff` verdes (incluye flexible dates, draft exclusion, empty segments)
- [x] 8 unit tests `handoffFormSchema` verdes (incluye date refinement, budget enum)
- [x] 13 unit tests `handoffService` verdes (incluye supabase mock, error paths)
- [x] 155 tests pre-existentes verdes sin regresión
- [ ] Migration aplicada a prod — NO (política D13, el usuario revisa y aplica manualmente)
- [ ] Smoke manual con consumer user en `/emilia/chat` — requiere dev env
- [ ] Smoke manual: consumer ve el banner cuando plannerState está ready
- [ ] Smoke manual: consumer completa el modal y el lead aparece en la DB con `agency_id=NULL`, `trip_id=<id>`, `conversation_id=<id>`

## Riesgos

- **R1 — Migration `leads.agency_id` NULLABLE rompe queries B2B existentes** que asumen NOT NULL. **Mitigación**: verifiqué con grep todos los usages de `.from('leads')` — hay 8 archivos que leen/escriben leads (`supabase-leads.ts`, `chatToLead.ts`, `useReports.ts`, `useAgencies.ts`, `Agencies.tsx`, `LeadSelector.tsx`, `leadService.ts`, `TransferOwnerDialog.tsx`). Todos los INSERT paths del B2B pasan `agency_id` desde el user context (siempre set), así que no rompen el policy ni el tipo. Los SELECT paths no asumen non-null en runtime — TypeScript tendrá que aceptar `string | null`, pero el tipo regenerado post-migration resolverá eso.
- **R2 — RLS policy `consumer_insert_handoff_leads` no testeada sin key**. **Mitigación**: policy simple y declarativa. Conditions:
  1. `public.get_user_account_type() = 'consumer'` (helper existente de 1.1.a)
  2. `conversation_id → conversations.created_by = auth.uid()` (verificación de ownership)
  3. `agency_id/tenant_id/assigned_user_id IS NULL` (defense in depth contra inserción de lead B2B desde consumer)
  Verificación manual post-merge con un consumer test account.
- **R3 — Leads inserted por consumer no aparecen en CRM UI B2B existente** que filtra por `agency_id`. **Mitigación**: documentado como follow-up explícito — "vista Inbox B2C" en el CRM que liste leads con `agency_id IS NULL AND status = 'new'`. El índice parcial `idx_leads_b2c_inbox` está listo para soportar esa query.
- **R4 — `assigned_user_id = null` puede confundir el trigger `trigger_create_activity_on_lead_change`** (de `20251005000004_create_activities_table.sql:184`). **Mitigación**: el trigger parece no depender de `assigned_user_id` para funcionar; a confirmar en smoke post-migration.
- **R5 — Consumer puede spamear handoffs** (múltiples envíos por conversación). **Mitigación**: state local en ChatFeature oculta el banner después del primer submit. Al reload de la página, el Set se resetea y se puede volver a pedir — aceptable para MVP. Follow-up: persistencia con query a `leads.conversation_id` al cargar la conversación.
- **R6 — Heurística de "trip ready" puede ser demasiado estricta**. Requiere `uiPhase === 'ready'` + `!isDraft`. **Mitigación**: criterio conservador intencional. Se ajusta en follow-up según feedback del producto.
- **R7 — `summarizePlannerForChat` puede generar texto con markdown que se guarda literal en `description`**. **Mitigación**: aceptable — el CRM UI de leads renderiza `description` como texto plano hoy. Si se quiere renderizar markdown se puede migrar a `MarkdownContent` en el lead view (follow-up).
- **R8 — El comentario del usuario puede contener caracteres especiales que rompan Zod / SQL**. **Mitigación**: Zod valida string + max 4000, supabase-js hace escape correcto en el insert. Sin riesgo real.

## Follow-ups explícitos

1. **Vista B2C Inbox en el CRM** — nueva página o filtro en `CRM.tsx` que liste leads con `agency_id IS NULL AND status = 'new'`. El índice parcial ya está creado.
2. **Migration a prod** — el usuario aplica manualmente `20260411000001_b2c_handoff_leads.sql` tras revisión, según política D13.
3. **Regenerar `src/integrations/supabase/types.ts`** post-migration para que el TypeScript del cliente refleje `agency_id: string | null` + `trip_id` en `leads`. D13 también aplica.
4. **Verificar R1 en código B2B**: una vez regenerado `types.ts`, correr build + lint y fixear cualquier error de tipo en los 8 archivos que leen `leads.agency_id`.
5. **Persistencia del "handoff ya enviado"** — query a `leads.conversation_id` al cargar la conversación para determinar si ya existe un lead y ocultar el banner sin depender del state local.
6. **Email / notificación interna al CRM** cuando llega un nuevo lead B2C (opcional fase 1 según prompt del usuario).
7. **Render tests** de `HandoffModal` y `HandoffBanner` cuando se instale `@testing-library/react` + `jsdom`.
8. **RLS integration tests** para `consumer_insert_handoff_leads` cuando esté disponible `SUPABASE_SERVICE_ROLE_KEY` en CI/local.
9. **Follow-up del trigger `trigger_create_activity_on_lead_change`** — verificar que maneja correctamente `assigned_user_id = NULL` (R4).
10. **B2C handoff confirmation card** — en lugar del toast, mostrar una card persistente en el chat que reemplaza el banner con "Pedido enviado — te contactaremos pronto".

## Commits

1. `feat(schema): add B2C handoff leads migration (nullable agency, trip_id, consumer RLS)`
2. `feat(trip-planner): add isTripReadyForHandoff predicate`
3. `feat(companion): add handoffFormSchema (Zod) + types`
4. `feat(companion): add handoffService (payload builders + requestHumanHandoff)`
5. `feat(companion): add HandoffModal + HandoffBanner components`
6. `feat(chat): wire companion handoff banner + modal in ChatFeature`
7. `test: 32 unit tests for handoff readiness, form schema, and service`
8. `docs(prs): add Paso 2 human handoff modal PR description`

## Dependencias previas

- [Fase 1.1.a — B2C ownership schema](1.1.a-b2c-ownership.md) (merged)
- [Fase 1.1.b — upsertTrip adapter](1.1.b-upsert-trip-adapter.md) (merged)
- [Fase 1.1.c — trips as source of truth](1.1.c-trips-source-of-truth.md) (merged)
- [Fase 1.1.d — persist debounce + flush](1.1.d-persist-debounce.md) (merged)
- [Paso 1 — Structural separation](paso1-structural-separation.md) (merged PR #64)
- Fase 1.1.e/f/g — B2C trips cleanup — **PR #63 OPEN**, no merged. Paso 2 es funcionalmente independiente y no lo requiere.

## Next

Pasos 3-5 del roadmap macro:

3. Panel de itinerario vivo embedded en companion chat
4. Registro/perfil consumer (signup flow B2C dedicado)
5. Capa social (feed, perfiles públicos)

Y follow-ups técnicos del listado arriba.
