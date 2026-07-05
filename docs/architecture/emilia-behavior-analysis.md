# Emilia — Cómo responde hoy

> **Para qué es este documento.** Es un retrato del comportamiento actual de
> Emilia tal como lo determina el código deployado. Cubre las cuatro piezas
> que decide cómo se forma cada respuesta: el **prompt** (`emilia-parser-v14`),
> el **router determinístico** (`routeRequest`), el **orquestador**
> (`conversationOrchestrator`) y la capa de **Context Engineering** (estado,
> tools, memoria). Los **modos** (`agency` / `passenger`) atraviesan toda la
> pipeline.
>
> No es una spec aspiracional. No compara con producto. Describe lo que el
> sistema hace hoy y dónde la respuesta queda determinada.

---

## 1. Anatomía de un turno

Cada mensaje del usuario atraviesa cinco etapas antes de que aparezca una
respuesta en la UI. El reparto de responsabilidades es estricto:

1. **Bootstrap del estado** — el cliente carga (o crea) el `EmiliaState` para
   esta conversación, aplica el modo actual (agency/passenger), refresca los
   `active_refs` (plan, quote, lead) y renderiza un bloque XML de memoria.
2. **Parsing** — el edge function `ai-message-parser` corre el prompt v14
   sobre el mensaje del usuario más el bloque de memoria. Extrae JSON
   estructurado: `requestType` + payload + campos opcionales como
   `placeDiscovery`, `productOrder`, `travelerType`, `editIntent`,
   `missingFields`, `message`, `ask`. Puede llamar tools mientras parsea.
3. **Routing** — el cliente le pasa el JSON parseado a `routeRequest`, una
   función pura sin LLM que asigna `QUOTE`, `COLLECT` o `PLAN` en función
   de un score sobre cinco dimensiones.
4. **Orquestación** — `conversationOrchestrator.resolveConversationTurn`
   combina la ruta, el modo, el `plannerState`, el `pending_action`, el
   `mode` actual y la historia para emitir una `executionBranch`
   (`standard_search`, `standard_itinerary`, `ask_minimal`, `mode_bridge`)
   y un `responseMode`.
5. **Render** — el handler dispara la acción concreta: una búsqueda, un
   armado de itinerario, una pregunta de aclaración, una propuesta de cambio
   de modo, o un mensaje de discovery con lugares. La respuesta visible al
   usuario es una **mezcla** de strings i18n cliente-side y campos de texto
   que escribió el modelo.

La línea importante: Emilia es un parser+router determinístico con un LLM
adentro, no un agente conversacional libre. La conversación se le impone al
modelo desde varios lugares.

---

## 2. Lo que el prompt extrae

El prompt v14 está escrito como un **extractor** que devuelve JSON con
Structured Outputs, no como un asistente que conversa. Tiene cuatro grandes
bloques de instrucciones:

**Persistencia.** Resolver end-to-end. No emitir "necesito más info" salvo
que un campo crítico sea genuinamente irrecuperable. Asumir defaults sensatos
para directivas ambiguas.

**Política de cierre conversacional.** Cada conversación está optimizada
para llegar a un outcome accionable en tres respuestas. La cuarta es **hard
cap**: no puede ser una pregunta abierta. A partir de la respuesta 2 hay un
bias fuerte contra `missing_info_request`; a partir de la 3 se suprime salvo
que el pedido sea imposible o inseguro.

**Selección de tools.** Reglas explícitas para cuándo llamar
`get_planner_state`, `get_quote`, `get_recent_searches`,
`get_lead_full_history`, `discover_places`, `save_memory_note`,
`apply_slot_values`, `confirm_pending_action` y `propose_planner_addition`.
La regla de oro: si hay un `<pending_action>` en el bloque de memoria, el
mensaje del usuario lo más probable es respuesta a ese pending — resolverlo
antes que cualquier otra cosa.

**Reglas de extracción.** El grueso del prompt (~1.000 líneas) son reglas
muy granulares para parsear vuelos, hoteles, paquetes, traslados, seguros,
itinerarios y discovery. Cada campo tiene su propia política de defaults
y de tolerancia a typos.

El output del prompt es JSON, no prosa. Los strings de cara al usuario van
en campos como `message`, `ask`, `explanation` y se escriben en el idioma
indicado por el parámetro `language` (es / en / pt).

---

## 3. La política de defaults visible

El sistema asume mucho. Algunos defaults se silencian, otros se enuncian.

### Defaults silenciosos
- **Stops** (escalas) ← `any` si no se mencionan.
- **Children** ← 0.
- **Infants** ← 0.
- **One-way** ← si hay `departureDate` y no hay `returnDate` ni `multi_city`.
- **Currency** ← `USD` para el planner state (hardcoded por una limitación
  schema que hoy se documenta como deuda).

### Defaults enunciados
- **Origen**: si el mensaje no lo da, usa
  `profile.default_origin_city` del perfil del usuario (geolocalizado
  upstream y persistido). Si tampoco hay perfil, queda como missing.
- **Fechas**: si no hay fecha → hoy + 3 días. Si hay duración pero no
  fecha → hoy + 3 días + duración. Si solo hay mes → día 1 del mes.
- **Adults**: 1 si no se menciona, con flag `adultsExplicit: false` para
  que el router sepa que fue inferido.
- **"Familia" sin número**: 2 adultos + 2 niños + 0 infantes.
- **Días de itinerario sin duración**: 3 días si hay destino.

### Defaults que el prompt explícitamente rehúsa asumir
- Equipaje (`luggage`).
- Aerolínea preferida (`preferredAirline`).
- Clase de cabina (`cabinClass`).
- Horarios de salida/llegada.
- Layover máximo.
- Tipo de habitación.
- Régimen alimentario (`mealPlan`).
- Cadena hotelera.
- Hotel específico.
- Traslados.
- Seguro de viaje.

La regla en estos casos es ultra-estricta: **escanear el mensaje actual
buscando keywords explícitas; si no aparecen, no incluir el campo**.

### Default-stating
La transparencia sobre lo asumido se construye **client-side**, no en el
prompt. `routeRequest.buildSearchSummary` arma una línea estilo
*"Busqué vuelo BUE→MAD, 12 mar al 19 mar, 1 adulto. Datos asumidos: 1
adulto (por defecto). Si querés cambiar algo, decime."* Esa línea aparece
solo cuando hay defaults inferidos para anunciar.

---

## 4. El router determinístico

`routeRequest` es la función que decide qué tipo de turno es este. Corre
en <1ms y no llama LLM. Le da un puntaje a cinco dimensiones:

| Dimensión | Peso | 1.0 | 0.5 | 0 |
|---|---:|---|---|---|
| Destino | 30 % | Ciudad concreta | País o región | Vacío |
| Fechas | 25 % | Fecha exacta | Mes flexible / días | Nada |
| Pasajeros | 15 % | `adultsExplicit` o "familia ≥4" | Default 1 adulto | "familia" sin número y sin default |
| Origen | 15 % | Dado, o tipo `hotels`/`packages` | `itinerary` (puede inferirse después) | Vacío para vuelos |
| Complejidad | 15 % | 1 destino / round-trip | Multi-city / 2-3 destinos | 4+ destinos |

Después suma ponderado y dispara una de tres rutas:

- `score ≥ 0.75` → **QUOTE** (ejecutar búsqueda).
- `score ≥ 0.40` → **COLLECT** (preguntar 1-2 campos).
- `score < 0.40` → **PLAN** (proponer estructura).

Hay overrides por intención que ganan al puntaje:

- Si el mensaje referencia el plan activo y tiene intención de cotización
  ("cotizame este viaje", "precio del recorrido") → `QUOTE` con
  `reason: 'quote_active_plan'`.
- Si `requestType === 'itinerary'` o el mensaje tiene verbos de
  planificación (*armame*, *planifica*, *itinerario*, *recorrido*,
  *ruta*, *circuito*, *viaje por*) → `PLAN`.
- Si el destino es región o país sin ciudades → `PLAN` por
  `'destination_too_vague'`.
- Si hay intención de cotización explícita y al menos ciudad-nivel →
  `QUOTE` o `COLLECT`.

El router también detecta **inferred fields** (campos asumidos por
default) para que el handler pueda exponerlos en el resumen. Hoy detecta
`adults=1 (default)` y `tripType=one_way (default)`.

---

## 5. El orquestador y las cuatro execution branches

`resolveConversationTurn` es la pieza que decide qué hacer una vez que
sabemos la ruta y el modo. Devuelve dos cosas:

- `executionBranch` ∈ `ask_minimal | standard_search | standard_itinerary | mode_bridge`.
- `responseMode` ∈ `proposal_first_plan | show_places | needs_input | quote_or_search | standard | needs_mode_switch`.

Las cuatro branches son **mutuamente excluyentes** y cada una desencadena
un comportamiento distinto:

**`standard_search`**. Modo agencia, ruta `QUOTE`, todos los campos
críticos presentes. Se ejecuta la búsqueda (Starling, EUROVIPS, lo que
corresponda). La respuesta es resultados de búsqueda con la línea de
*"Busqué… Datos asumidos…"* arriba. **Solo en modo agency.**

**`standard_itinerary`**. Modo passenger, ruta `PLAN` o `COLLECT` con
suficiente info, o `QUOTE` con destino vago. Se arma un itinerario via
`travel-itinerary`. La respuesta es el plan estructurado por días, ciudades,
mañana/tarde/noche, restaurantes. **Solo en modo passenger.**

**`ask_minimal`**. Cualquier modo, falta info crítica para avanzar
(`missingFields` no vacío) y no se cumplen los thresholds para asumir.
La respuesta es una pregunta corta que **siempre** lidera con el contexto
ya conocido (*"Listo, vuelo a Cancún para 2 personas. ¿Desde qué ciudad
salís?"*) — la copy se arma cliente-side con `buildConversationalMissingInfoMessage`
e i18n por idioma. Cap: máximo 2 campos por pregunta.

**`mode_bridge`**. La intención del usuario no encaja con el modo actual:
está en agency y pide armar itinerario, o está en passenger y pide cotizar
con disponibilidad real. Se ofrece switchear de modo con un chip
(`suggestedMode`). El usuario decide.

### Guards que suprimen `mode_bridge`
- **G1**: si el último mensaje fue `quote_active_plan`, no se ofrece
  bridge — el usuario ya está conversando con la cotización del plan.
- **G3**: si `pending_action` está activo, no se ofrece bridge —
  hay una pregunta pendiente que el usuario está respondiendo.
- **G4**: si el modo actual es agency y el usuario tiene un mensaje
  con `PLAN_INTENT` de alta confianza, no se ofrece bridge — se asume
  que la agencia está armando una propuesta.
- **G5**: si el plan ya está activo y el usuario quiere editarlo, no se
  bridges — se sigue editando.

---

## 6. Los dos modos

Los modos no son cosméticos. Cambian qué execution branches están
disponibles y cómo se resuelven los inputs ambiguos.

### Agency mode
- El usuario es un vendedor de la agencia armando una venta.
- Branches productivas: `standard_search` y `ask_minimal`. **Nunca**
  `standard_itinerary` directamente.
- Si la intención es claramente de planificación (*"armame un viaje"*),
  el orquestador puede emitir `mode_bridge` ofreciendo pasar a passenger.
  El guard G4 lo suprime cuando la intención de planning es muy
  explícita y la agencia probablemente quiere armar la propuesta sin
  saltar de modo.
- Defaults monetarios y de proveedor calibrados para EUROVIPS / Starling
  con disponibilidad real.

### Passenger mode
- El usuario es el viajero final explorando opciones.
- Branches productivas: `standard_itinerary` y `ask_minimal`. **Nunca**
  `standard_search` directamente — el modo passenger no consulta
  inventarios reales.
- Si la intención es cotizar con precios firmes (*"dame un vuelo a Madrid
  el 12"*), el orquestador puede emitir `mode_bridge` ofreciendo pasar a
  agency.
- El planner (`travel-itinerary`) trabaja con regiones, países, días
  flexibles y rutas predefinidas — está optimizado para inspiración,
  no para venta.

### Cambio de modo en vivo
`applyModeChange(state, newMode)` muta **únicamente** `state.mode`. El
`profile`, las memorias, los `active_refs`, el `trip_history`, el
`pending_action` y el `discovery_candidates` se preservan verbatim. La
conversación no se rebobina.

---

## 7. Context Engineering — el estado que sobrevive al turno

Por debajo del prompt y el orquestador hay una capa de estado persistente
que es la responsable de que Emilia "se acuerde" de cosas dentro de la
misma conversación.

### EmiliaState
Persistido por `conversation_id` en `agent_states` (RLS por `agency_id`).
Cada conversación es un slate fresco — no hay propagación cross-conversación
hoy. Contiene:

- `profile` — datos lentos del lead (origin city por geoloc, language,
  currency, preferences).
- `active_refs` — referencias activas que el modelo está manejando este
  turno (plan, quote, lead). Se sobreescriben por `(type, id)`.
- `global_memory` / `session_memory` — notas durables de la conversación.
  Lifecycle, no scope: ambos son per-conversación.
- `pending_action` — máquina de un slot. Cuando Emilia hace una pregunta,
  se setea con `kind`, `for`, `fields`, `prompt`, `issuedAt`. La próxima
  respuesta del usuario se interpreta como respuesta a esto.
- `discovery_candidates` — top-N de la última llamada a `discover_places`.
  Persistidos para que el modelo pueda referirse a "el primero" /
  "el segundo" en el siguiente turno sin volver a llamar al tool.
- `trip_history` — resúmenes de viajes pasados (≤5, ≤3 líneas cada uno).
- `mode` — `'passenger' | 'agency'`. Se muta sólo via `applyModeChange`.
- `meta` — bookkeeping (turn_count, schema_version, last_consolidated_at).

### Cómo se inyecta al modelo
El cliente renderiza `EmiliaState` a un bloque XML
(`<user_profile>`, `<current_mode>`, `<active_refs>`,
`<discovery_candidates>`, `<pending_action>`, `<memories>`,
`<trip_history>`) y lo pega al final del system prompt. Soft cap de 4.000
caracteres, con degradación progresiva: drop session memory → halve global
top-k → continuar bajando.

### Cómo se muta el estado
Solo a través de mutators con contrato fijo: `bootstrapStateIfMissing`,
`applyModeChange`, `setActiveRef`, `clearActiveRef`, `setPendingAction`,
`clearPendingAction`, `markPendingActionApplied`. Asignación directa a
campos del state está prohibida.

### Tools del modelo
- **Retrieval**: `get_planner_state`, `get_quote` (stub hoy),
  `get_recent_searches`, `get_lead_full_history`, `discover_places`.
- **Memoria**: `save_memory_note` (con guardrails regex
  non-negotiable contra PII, especulación e instrucciones).
- **Resolución de turn-state**: `apply_slot_values` (slot fill),
  `confirm_pending_action` (confirmación binaria).
- **Mutación de planner**: `propose_planner_addition` — propone, no
  muta; setea `pending_action.payload`; el cliente muta cuando el
  usuario confirma.

El tool loop tiene cap duro: 3 iteraciones, 4 tools en paralelo, 8s por
tool, 25s totales. Después fuerza una respuesta final.

---

## 8. Cómo se forma la respuesta visible

La respuesta que ve el usuario **no es un bloque de prosa que escribió el
modelo**. Es una composición:

- **El modelo escribió** los campos `message`, `ask`, `explanation` del
  JSON, y posiblemente llenó `placeDiscovery.places`, `editIntent`,
  `missingFields`.
- **El cliente compuso** el resto: la línea de "datos asumidos" arriba
  de los resultados, los chips de mode_bridge, la copy de la pregunta de
  `ask_minimal` (que es i18n templates por idioma + contexto conocido),
  los headings de discovery (cultura / comida / barrios), las CTAs.

Hay tres vehículos distintos que pueden producir texto al usuario en un
mismo turno:

1. **Output del modelo** en los campos `message`/`ask`/`explanation`.
2. **Templates i18n cliente-side** con sustitución de contexto
   (`buildConversationalMissingInfoMessage`, `buildPlanToQuoteResponse`,
   `formatDiscoveryResponse`, `buildModeBridgeMessage`).
3. **Resultados de búsqueda renderizados** como tarjetas estructuradas
   (vuelos, hoteles, lugares, segmentos del itinerario) — no son texto
   libre.

Esto explica por qué la voz de Emilia no es 100% consistente: distintos
vehículos producen distinto tono. Las copy de i18n son neutras
("Listo, vuelo a Cancún…"); el modelo puede escribir más conversacional
("Perfecto, busco vuelo a Cancún para vos…"); los resultados son
estructurados sin tono.

> **Phase 2 / sub-task D — Voice Layer (resuelto parcialmente).** Existe un
> punto de entrada unificado `buildEmiliaSearchNarrative`
> (`src/features/chat/services/emiliaNarrative.ts`) que produce UNA voz
> consistente para "qué entendí, qué busco, qué asumí, qué podés ajustar".
> Los 5 emisores client-side (`buildSearchSummary`,
> `buildConversationalMissingInfoMessage`, `buildPlanToQuoteResponse`,
> `buildModeBridgeMessage`, `buildItineraryProgressMessage`) son ahora
> wrappers que delegan en él, manteniendo sus firmas para no tocar los 9+
> call sites. Items diferidos a Phase 3: `formatDiscoveryResponse` (editorial
> distinto) y `buildCollectQuestion` (router-internal). El texto del modelo
> (`message`/`ask`) sigue saliendo del LLM y se sigue pudiendo desviar — eso
> es trabajo de la próxima fase del prompt.

---

## 9. Casos especiales que ya están conectados

### Plan-to-quote bridge
Si hay un planner activo y el usuario expresa intención de cotización
("cotizame esto"), `resolveTravelContextBridge` arma automáticamente un
`requestType: combined` desde el plannerState (con segments por hotel,
fechas heredadas, travelers heredados). La respuesta usa
`buildPlanToQuoteResponse` con copy específica.

### Quote-to-plan bridge
Si NO hay plan activo pero hay una búsqueda reciente y el usuario dice
"armame un itinerario con esto", el orquestador construye un
`requestType: itinerary` con destination/dates/travelers heredados de la
última búsqueda.

### Discovery con planner activo
Si hay un planner activo y el usuario pregunta por lugares concretos
(*"qué museos hay en París"*), discovery **gana** sobre planner-edit. Se
llama `discover_places` y se devuelve `placeDiscovery` sin tocar el plan.

### Planner edits
Si hay un planner activo y el mensaje tiene verbos de mutación
(*agregar*, *cambiar*, *reemplazar*, *eliminar*), se interpreta como
edición incremental. Se emite `editIntent` tipado: `replace_destination`,
`adjust_duration`, `regenerate_day`, etc.

### Destructive change warning
Antes de aplicar mutaciones del planner, `detectDestructiveChanges`
chequea si hay hoteles cotizados o vuelos seleccionados que se perderían.
Si los hay, devuelve un mensaje de confirmación que va al usuario antes
de ejecutar.

### Pending action resolution
Cuando el modelo llama `apply_slot_values` con valores válidos, el
servidor mergea en `pending_action.applied`, marca `complete: true` cuando
están todos los `fields`, y devuelve un `meta.pendingActionResolution` al
cliente. El cliente despacha por `for`: `quote_completion`,
`flight_completion`, `hotel_completion`, `combined_completion`,
`itinerary_completion`, `collect_clarification`, `add_places_to_itinerary`.

---

## 10. Lo que el sistema explícitamente NO hace

Saber qué Emilia no hace ayuda tanto como saber qué hace:

- **No mantiene memoria cross-conversación.** Cada conversación arranca
  con `agent_states` vacío. Si un lead vuelve, Emilia no se acuerda de él
  salvo que el cliente le pase un `lead_id` y el modelo llame
  `get_lead_full_history`.
- **No infiere campos sensibles.** Equipaje, aerolínea, cabina, horarios,
  régimen, habitación, cadena hotelera, traslados y seguro **nunca** se
  asumen — solo se incluyen si el usuario los menciona explícitamente.
- **No corrige al usuario.** Tipos, abreviaturas, audio mal transcripto:
  Emilia interpreta y avanza, no señala el error.
- **No bloquea por un solo campo faltante en multi-product.** Si falta
  un campo de uno de los productos pero el resto está completo, Emilia
  pregunta solo por ese campo y avanza con lo demás.
- **No emite missing_info_request en la respuesta 4 o más** salvo que el
  pedido sea genuinamente imposible o inseguro.
- **No guarda PII vía `save_memory_note`.** Pasaportes, pagos, fechas
  de nacimiento, SSN están bloqueados por regex.
- **No salta de modo sin permiso del usuario.** El switch passenger ↔
  agency se ofrece (`mode_bridge`) pero nunca se ejecuta unilateralmente.

---

## 11. Áreas grises del comportamiento actual

Tres lugares donde la respuesta es difícil de predecir incluso conociendo
las reglas:

### Frontera itinerary ↔ discovery
Hay reglas explícitas (duración mencionada → itinerary; categoría
preguntada → discovery), pero los inputs reales mezclan señales:
*"armame 5 días en Roma con buenos restaurantes"* es itinerary ("5 días"
gana), *"qué hacer en Roma 5 días"* puede inclinarse para cualquier lado.

### Voz del modelo vs voz del cliente
Cuando un mismo turno produce strings desde el LLM (`message`) y desde
i18n templates (`ask`), el tono puede inconsistir. No hay rule de
producto que armonice esto.

### Cuándo preguntar vs cuándo asumir
El sistema tiene tres mecanismos compitiendo:
- el prompt v14 dice "asumir defaults sensatos";
- el router dice "si score < 0.75, COLLECT";
- la closure policy dice "no preguntar a partir de la respuesta 3".

En conversaciones cortas estos están alineados; en conversaciones de
2-3 turnos ya empiezan a tirar para distintos lados, y el resultado
depende de la combinación específica de defaults aplicados, intent
detectado y modo activo.

### `pending_action` vs cambio de tema
Si Emilia hizo una pregunta y el usuario responde con algo aparentemente
no relacionado, el modelo tiene que decidir si "cambió de tema" o si
"está respondiendo a la pregunta de manera oblicua". La regla del prompt
dice *"si claramente cambió de tema, no llames a apply_slot_values"* —
"claramente" es subjetivo y la respuesta varía.

---

## 12. Cómo verificar este retrato empíricamente

Lo descrito acá es lo que el código quiere hacer. Para confirmar que es
lo que efectivamente pasa en producción hay tres vías:

- **Audit endpoint** (`agent-state-audit/`) — dado un `message_id`
  reproduce el `EmiliaState` que el modelo vio en ese turno, los tools
  llamados, y los tokens consumidos. Es la fuente más fiel turno-por-turno.
- **Telemetría agregada** — `[CTX-TOOL]`, `[CTX-MEMORY]`,
  `[CTX-DISCOVERY-GEOCODE]` se emiten en cada turno y permiten medir
  distribuciones (qué tools se usan, cuántas iteraciones, qué razones de
  rechazo de memoria, qué tasa de geocoding fallback).
- **Sample de `messages`** filtrado por `executionBranch` — cualquier
  hipótesis sobre comportamiento por modo o por branch se valida con
  ~50-100 mensajes reales.
