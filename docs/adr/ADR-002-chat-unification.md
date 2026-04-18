# ADR-002 — Unificación del chat B2B/B2C bajo un único surface con switch agency/passenger

**Fecha:** 2026-04-18
**Estado:** Aceptado
**Contexto técnico previo:** [`docs/context/2026-04-18-chat-unification-context.md`](../context/2026-04-18-chat-unification-context.md)
**Supersede parcialmente:** [`docs/handoffs/auditoria-b2b-b2c-emilia.md`](../handoffs/auditoria-b2b-b2c-emilia.md)

## Contexto

La auditoría original (febrero–marzo 2026) cerró con la tesis "motor compartido, productos separados": un único core de orquestación (parser, router, planner agent, search executors) sirviendo a dos surfaces independientes — el cotizador B2B (agentes de viaje) y la planificadora B2C "Emilia" (consumers self-serve). Sobre esa decisión se ejecutaron las Fases 0 → Paso 4 más Fase 1.2 (i18n): se montó el host `emilia.vibook.ai`, las rutas `/emilia/*` con guard `RequireConsumer`, los flujos de signup/login/profile consumer, el panel de itinerario vivo del companion, el modal de derivación humana (handoff) hacia leads B2B con `agency_id IS NULL`, y se cerraron migrations de RLS específicas para consumer (`20260409000002_b2c_ownership`, `20260411000001_b2c_handoff_leads`, `20260411000002_consumer_conversations_rls`). Esa entrega quedó funcional y testeada (220+ passed al cierre del 11 de abril).

El modelo de negocio cambió después de Paso 4. La hipótesis del handoff B2C→B2B no se sostuvo: los consumers que llegan vía Emilia no necesitan ser derivados a un agente, y los agentes no quieren un canal adicional de leads paralelo a su pipeline de cotización. Lo que sí emergió como necesidad fue la simétrica: que un agente pueda usar el modo "passenger" de Emilia como brainstorming/discovery para armar un itinerario propuesto al cliente, sin perder su flujo de cotización standard. Eso obliga a unificar ambos modos en el mismo surface.

## Decisión

Unificar el chat B2B y B2C en un único surface bajo el host `emilia.vibook.ai` con switch estricto agency/passenger en el header del chat. El switch deja de ser una decisión arquitectural materializada en rutas, layouts y orchestrator, y pasa a ser un parámetro de turno que el client setea explícitamente.

Las decisiones cerradas con el usuario para esta unificación son: (1) **solo agents ven el switch**; los consumers nunca acceden a agency mode. (2) Un agent con `agency_id` seteado arranca por default en agency mode; sin `agency_id`, en passenger. (3) **El switch es estricto por turno**: en agency mode el orchestrator solo puede emitir `standard_search` o `ask_minimal`; en passenger mode solo `planner_agent` o `ask_minimal`. El orchestrator deja de routear por contenido del mensaje. (4) `standard_itinerary` queda como código muerto y se elimina en la PR de purga. (5) **Ruta única `/emilia/chat` para ambos modos**; sobreviven `/emilia/signup`, `/emilia/login`, `/emilia/profile`, `/emilia` (landing). Las pantallas administrativas (`/users`, `/agencies`, `/tenants`, `/dashboard`) siguen accesibles para OWNER/SUPERADMIN desde el menú del avatar en el header — todo bajo prefijo `/emilia/*`. (6) `vibook.ai` (main host) pasa a redirigir a otra app fuera de este monorepo. (7) **Los trips siempre se crean con `account_type='agent'` cuando el caller es un agent**, incluso operando en passenger mode; nunca un agent genera un trip con `account_type='consumer'`. (8) **El modo del switch no se persiste en DB**; vive en client state, viaja como parámetro al orchestrator, y el historial queda ciego al modo del turno (tradeoff aceptado). (9) El handoff completo del companion (banner, modal, service, tabla `leads` columna `trip_id`, política RLS `consumer_insert_handoff_leads`) se borra en la PR de purga. (10) Para que el agent envíe la cotización al cliente final como PDF se reusa el **sistema custom existente** (HTML → jsPDF → Supabase Storage), no PDFMonkey. (11) El branding sigue siendo **Emilia** en todos los surfaces. (12) Las conversaciones existentes pueden borrarse — no se migra historia.

## Qué se revierte y qué se mantiene de la auditoría original

Se mantiene la tesis del **motor compartido**: parser, router scoring, planner agent, search executors (Starling, EUROVIPS, Foursquare), `tripService` con `accountType` parametrizado, `CanonicalItineraryResult` como salida unificada del pipeline, RLS multi-tenant por `agency_id`. Esa capa es agnóstica al producto y no se toca.

Se revierte la tesis de **productos separados**. Concretamente: la separación de surfaces (`/emilia/chat` distinto del `/chat` B2B), la separación de layouts (`CompanionLayout` vs `MainLayout`), la separación de sidebars (`ChatSidebarCompanion` vs `ChatSidebar`), el guard `RequireConsumer` aplicado solo a rutas companion, y todo el handoff B2C→B2B materializado como leads con `agency_id IS NULL`. Esas piezas dejan de tener razón de ser.

## Razón del cambio

El B2C es ahora self-serve puro. Un consumer que entra a Emilia arma su viaje, lo descarga o lo guarda, y se va — no hay derivación operativa hacia un agente. Lo que el agente necesita es la misma herramienta de planificación conversacional como acelerador interno cuando arma una cotización: usar passenger mode para destrabar destinos vagos, después switchear a agency mode para cotizar vuelos y hoteles concretos contra Starling/EUROVIPS, y finalmente exportar la cotización a PDF para mandarla al cliente. Mantener dos chats separados con dos URLs, dos layouts, dos sidebars y un router que routea por contenido obstaculiza ese flow.

## Consecuencias

Se borran del producto: las pantallas `CRM`, `Marketplace` y `Reports` (decisión del usuario, fuera del scope de unificación pero atadas a la reorganización de rutas), el dir entero `src/features/companion/` excepto los flujos de auth consumer (`consumerAuthService`, `consumerAuthSchema`, `authRedirectDecider`) que se mueven a la capa común, todos los componentes y servicios de handoff, el componente `ItineraryPanel` (su contenido se rehace dentro del nuevo surface unificado o se descarta si el TripPlannerWorkspace cubre la necesidad), `CompanionChatPage` (se reemplaza por la página unificada), las rutas y guard `RequireConsumer` aplicado a `/emilia/chat` (se reemplaza con un guard que admite agent y consumer y bifurca por `accountType` para el switch).

Se mantienen y refactorizan: `ChatFeature` se vuelve agnóstico al modo y consume el switch; `useChatState` y `useMessageHandler` reciben el modo como parámetro de turno; `conversationOrchestrator.resolveConversationTurn` se rediseña para aceptar un modo estricto y solo emitir las branches válidas para ese modo (no más routing por contenido); `tripService.upsertTrip` no cambia — ya soporta `accountType` desde su firma. La rama `standard_itinerary` se borra; la lógica de continuidad de contexto entre turnos (`previousParsedRequest` en `useChatState.ts:28`) se extiende para sobrevivir el cambio de modo.

Se agregan: el componente `ModeSwitch` en el header del chat (visible solo para `accountType='agent'`), el menú de avatar con los enlaces administrativos `/emilia/users|agencies|tenants|dashboard` para OWNER/SUPERADMIN, y un nuevo template + función en `customPdfGenerator` para exportar un `TripPlannerState` a PDF (no existe hoy — solo flight y combined, ver más abajo).

## Continuidad de contexto entre modos (Nivel 2 — MVP)

El MVP de la unificación implementa **Nivel 2** de continuidad: la `parsedRequest` que produce el orchestrator (destino, fechas, pasajeros, presupuesto, requestType, intent) cruza el switch agency↔passenger sin pérdida. Hoy esa pieza ya existe como `previousParsedRequest: ParsedTravelRequest | null` en el chat state (`src/features/chat/hooks/useChatState.ts:28`), se setea con cada turno (`updateChatState({ previousParsedRequest: request })`, línea 127), se limpia al cambiar de conversación (línea 62), y el orchestrator la lee como booleano `hasPreviousParsedRequest` (`useMessageHandler.ts:713`). Para Nivel 2 alcanza con verificar que esa pieza no se resetee al cambiar de modo dentro de la misma conversación — debería ser transparente porque el switch no toca chat state, solo agrega un parámetro al request del turno.

Las cotizaciones (cards de vuelos y hoteles que devuelve `standard_search`) siguen materializándose como `messages` en la DB con su payload estructurado, igual que hoy. El `TripPlannerState` sigue siendo propiedad exclusiva del lado planner (passenger mode) y no se modifica con cotizaciones de agency mode. Esto significa que un agente que cotiza vuelos contra Starling y después switchea a passenger para refinar el itinerario verá el itinerario actualizado pero NO verá los vuelos cotizados integrados al estado del viaje — los verá como cards separadas en el historial del chat. Aceptable para MVP.

**Roadmap futuro — Nivel 3** (no entra en esta unificación, requerirá su propio ADR cuando se aborde): integrar las cotizaciones al `TripPlannerState` como campos `flightSelections: FlightData[]` y `hotelSelections: HotelData[]`. El `planner_agent` los consumiría como estado vigente del viaje (sabría qué vuelos y hoteles ya cotizó el agent antes de proponer alternativas), y el `standard_search` los escribiría ahí cuando el agent confirme una selección. Eso unificaría el modelo mental del viaje entre ambos modos y habilitaría exports PDF que mezclen itinerario + cotización en un solo documento. Es un cambio de schema (`TripPlannerState` extendido), de migrations (la tabla `trips` necesita persistir esas selecciones), y de orchestrator (el planner_agent tendría que entender el shape extendido). Por costo y por no estar bloqueando el MVP, queda fuera de scope.

## Tradeoffs aceptados

**Primero**, el orchestrator deja de routear por contenido. Hoy un mensaje "armame un itinerario para Italia" desde agency mode caería en `standard_itinerary`; bajo la nueva regla, en agency mode ese mensaje cae en `ask_minimal` o `standard_search`, y si el agent quería un itinerario debería switchear a passenger primero. Para mitigar esto, en la PR del chat unificado (PR 3) se agrega una **UX de puente entre modos**: cuando el orchestrator detecta que el contenido del mensaje no matchea el modo actual (intent itinerary en agency, intent cotización en passenger), responde con una sugerencia guiada para cambiar de modo en lugar de procesar mal el turno. El detalle de copy y trigger se define en PR 3.

**Segundo**, el historial queda ciego al modo. Un mensaje persistido en `messages` no lleva un campo `mode_at_turn`, así que reabrir una conversación vieja muestra el contenido pero no el contexto de qué modo estaba activo cuando cada turno ocurrió. Aceptado porque el caso de uso primario es la conversación viva, no auditoría retrospectiva. Si en el futuro se necesita ese campo, se agrega como columna nullable en `messages` sin romper nada.

**Tercero**, la continuidad entre modos a Nivel 2 cubre la parsed request pero no el estado estructurado de cotizaciones. Un agent que cotiza vuelos en agency y después arma itinerario en passenger no ve los vuelos como parte del viaje en el panel de itinerario. Aceptado para MVP, resuelto cuando se aborde Nivel 3.

## Inventario de purga

Componentes a borrar (`src/features/companion/`): `components/HandoffBanner.tsx`, `components/HandoffModal.tsx`, `components/ItineraryPanel.tsx`, `services/handoffService.ts`, `utils/handoffFormSchema.ts`, `utils/hasItineraryContent.ts`, `types.ts` (parte de handoff). Tests asociados: `__tests__/handoffFormSchema.test.ts`, `__tests__/handoffService.test.ts`, `__tests__/hasItineraryContent.test.ts`. Sobreviven y se relocalizan a `src/features/chat/` o `src/features/auth/`: `services/consumerAuthService.ts`, `utils/authRedirectDecider.ts`, `utils/consumerAuthSchema.ts`, y sus tests.

Páginas a borrar: `src/pages/CRM.tsx`, `src/pages/Marketplace.tsx`, `src/pages/Reports.tsx`, `src/pages/CompanionChatPage.tsx`. Asociado: `src/features/crm/` entero (chequear si algo es reusable antes de borrar).

Migrations a revertir mediante una nueva migración `20260418000001_revert_b2c_handoff.sql` (no edición de las viejas): drop columna `leads.trip_id`, restaurar `NOT NULL` en `leads.agency_id` y `leads.tenant_id`, drop política RLS `consumer_insert_handoff_leads`, drop índices `idx_leads_trip_id` e `idx_leads_b2c_inbox`. La migration `20260411000002_consumer_conversations_rls.sql` se revisa caso por caso en la PR de purga: la parte que habilita a un consumer ver/crear sus propias conversaciones se mantiene (sigue siendo necesaria para el modo passenger del consumer); cualquier política específica al handoff se dropea.

Componentes/utils a borrar también: `ChatSidebarCompanion`, `CompanionLayout` (su lógica de header con LanguageSelector + avatar se absorbe en el layout unificado), `RequireConsumer` (se reemplaza por un guard genérico que admite ambos `accountType` y deriva al modo correcto).

## Sistema de PDF identificado

El sistema custom existente vive en `src/services/pdf/customPdfGenerator.ts`. Renderiza HTML a PDF blob con jsPDF + html2canvas (templates en `src/services/pdf/customPdfTemplates.ts`, CSS en `src/templates/pdf/combined-flight-hotel.css`) y sube el resultado a Supabase Storage devolviendo URL pública. Hoy expone `generateCustomFlightPdf(selectedFlights, brandingData)` y `generateCustomCombinedPdf(selectedFlights, selectedHotels, brandingData, isPriceModified)`. El facade `src/services/pdfMonkey.ts:152-184` ya rutea automáticamente a custom cuando la agencia tiene `pdf_provider='custom'` en DB.

**Lo que falta para PR 5:** ninguna función actual exporta un `TripPlannerState` a PDF (todas operan sobre `FlightData[]` y `HotelData[]`). PR 5 agrega `renderItineraryHtml(plannerState, brandingData)` en `customPdfTemplates.ts` y `generateCustomItineraryPdf(plannerState, brandingData)` en `customPdfGenerator.ts`, siguiendo el patrón de los existentes. La agencia Emilia (o el agent invocando) tendrá `pdf_provider='custom'`. Cero dependencia de PDFMonkey.

## Estado actual de la parsed request

`previousParsedRequest: ParsedTravelRequest | null` vive en el chat state (`src/features/chat/hooks/useChatState.ts:28`). Se setea con cada turno vía `updateChatState({ previousParsedRequest: request })` (línea 127), se limpia al switchear de conversación o al borrar mensajes (líneas 62, 178, 211, 223). Se lee en `ChatFeature.tsx` (líneas 54, 185, 251, 300, 519, 654) para hidratar el contexto del próximo turno y para decidir si el panel de planner debería estar abierto. Se pasa a `useMessageHandler` (línea 58) y se usa para mergear campos en el siguiente request (líneas 237-247, 332, 597, 1266) y se proyecta como booleano `hasPreviousParsedRequest` al orchestrator (línea 713).

Cubre todos los campos relevantes para Nivel 2: destino (origin/destination), fechas (departureDate/returnDate), pasajeros (adults/children/infants), `requestType` (flights/hotels/combined/itinerary/general), y campos derivados de intent. Para que cruce el switch sin pérdida, la PR 3 solo necesita garantizar que el switch no dispare el reset de `previousParsedRequest` (hoy solo se resetea por cambio de conversación, lo cual es deseable mantener — cambiar de modo dentro de la misma conversación NO debería resetearlo).

## Verificación previa al ADR

Baseline al 2026-04-18 sobre `main` sincronizado:

- `npm test`: **240 passed, 14 skipped, 0 failed** (20 archivos passed, 1 skipped por `SUPABASE_SERVICE_ROLE_KEY` no seteado — `b2cOwnershipRls.test.ts`). Mejor que el baseline 220/14/2 del B2C_STATUS doc.
- `npm run build`: limpio, exit 0.
- `npx tsc --noEmit`: sin errores, exit 0.
- Confirmado: `resolveConversationTurn` (`src/features/chat/services/conversationOrchestrator.ts:426-529`) **no consulta `workspace_mode`** en absoluto — la grep sobre el archivo entero devuelve 0 matches. Esto valida la asunción central del ADR: el orchestrator ya es agnóstico al modo, lo único que cambia en PR 3 es restringir las branches válidas según el parámetro de modo que recibirá.
- Confirmado: el único codepath que setea `account_type='consumer'` en trips es `tripService.ts:24,63,64`, y deriva del parámetro `accountType` que recibe — los callers desde un agent siempre pasan `'agent'` (por construcción del `AuthContext.accountType`), así que la regla "los trips de un agent siempre nacen `account_type='agent'`" se cumple por composición sin necesidad de cambio adicional. PR 3 solo debe asegurar que el modo del switch NO se confunda con el `accountType` del trip.

## PRs planeadas (split)

La unificación se entrega como cinco PRs independientes en este orden: **(1)** este ADR + scaffolding mínimo (carpeta `docs/adr/`, este documento, sin cambios de código). **(2)** Unificación de routing y layouts: ruta única `/emilia/chat`, layout unificado con header agnóstico al modo, guards refactorizados, eliminación del subpath `/chat` B2B, redirección `vibook.ai` a app externa. **(3)** Chat con switch agency/passenger + Nivel 2 de continuidad: componente `ModeSwitch`, `resolveConversationTurn` rediseñado para modo estricto, UX de puente entre modos, garantía de continuidad de `previousParsedRequest`. **(4)** Purga: borrado de companion handoff, CRM/Marketplace/Reports, `standard_itinerary`, migration de reverso para `leads`. **(5)** Export de itinerario a PDF: nuevo template y función `generateCustomItineraryPdf` en el sistema custom existente, integración en el chat para que el agent dispare el export desde un mensaje.

Cada PR es mergeable de forma independiente y deja el sistema en estado funcional. La PR 4 (purga) requiere que la PR 3 esté mergeada antes para no romper imports.
