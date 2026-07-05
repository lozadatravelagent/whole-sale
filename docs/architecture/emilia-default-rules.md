# Emilia Chat — Reglas por Default

> **Qué es este documento.** Catálogo verificable de las reglas que Emilia
> aplica por default cuando interpreta un mensaje del usuario. Cada regla cita
> el archivo donde está implementada. No es spec aspiracional ni descripción
> de producto — describe lo que el código hace hoy.
>
> **Pipeline asumido.** Cliente → `ai-message-parser` (prompt v22) → JSON
> estructurado → `routeRequest` (router determinístico) →
> `conversationOrchestrator.resolveConversationTurn` (branch + responseMode)
> → handler. Fuentes:
> - `supabase/functions/ai-message-parser/prompt.ts` (PROMPT_VERSION =
>   `emilia-parser-v22`)
> - `src/features/chat/services/routeRequest.ts`
> - `src/features/chat/services/conversationOrchestrator.ts`
> - `supabase/functions/_shared/searchDefaults.ts`
> - `supabase/functions/_shared/memoryTools.ts`

---

## 1. Persistencia y cierre conversacional

Reglas del bloque `<persistence>` + `<conversation_closure_policy>` del prompt
(`prompt.ts:79–95`):

| Regla | Default |
|---|---|
| Resolución end-to-end | No emitir "necesito más info" salvo que un campo crítico sea genuinamente irrecuperable |
| Defaults sobre preguntas | Para directivas ambiguas: asumir defaults sensatos (pax típico, mes corriente, origen común) |
| Tope de turnos | 3 respuestas para llegar a outcome accionable. La 4ª es **hard cap**: no puede ser pregunta abierta |
| Bias contra `missing_info_request` | Desde la 2ª respuesta: bias fuerte. Desde la 3ª: suprimido salvo imposibilidad/seguridad |
| Vague regions | `Caribe` / `Europa` / `playa` → elegir ciudades representativas en lugar de `missing_info_request` |

Campos críticos que sí justifican preguntar: destino, headcount cuando no
está implícito, fechas exactas cuando son explícitamente requeridas.

---

## 2. Smart defaults de campos individuales

Bloque `SMART DEFAULTS` y reglas asociadas en `prompt.ts:284–308`,
mirroreados en `supabase/functions/_shared/searchDefaults.ts` y
`src/services/searchDefaults.ts` (drift test:
`src/services/__tests__/searchDefaults.drift.test.ts`).

### 2.1 Vuelos
| Campo | Default |
|---|---|
| `stops` | `"any"` si no se especifica |
| `children` | `0` si no se especifica |
| `luggage` | **NO incluir** salvo mención explícita (valija/equipaje/carry-on/mochila/backpack) |
| `preferredAirline` | **NO incluir** salvo mención explícita del nombre |
| `cabinClass` | **NO incluir** salvo mención explícita (económica/business/primera) |
| `maxLayoverHours` | **NO incluir** salvo mención explícita de tope ("no más de X horas") |
| `departureTimePreference` / `arrivalTimePreference` | **NO incluir** salvo mención explícita de horario |
| `origin` (smart default) | Si hay destino pero no origen: usar `profile.default_origin_city` del bloque MEMORY STATE. El origen explícito siempre gana. Nunca se inventa |
| `tripType` (1 segmento) | `one_way` |
| `tripType` (2 segmentos, el 2º invierte el 1º) | `round_trip` |
| `tripType` (segmentos no reversos) | `multi_city` (máx 3 segmentos) |

### 2.2 Fechas
| Caso | Default |
|---|---|
| Nombre de mes (sin día) | Primer día del mes |
| "primera semana de [mes]" | Primer día del mes |
| **Año** — fecha (mes+día) no pasó este año | Año actual |
| **Año** — fecha (mes+día) ya pasó este año | Año siguiente |
| Sin fecha mencionada | `current date + 3 días` (`SEARCH_START_OFFSET_DAYS`) |
| Hay duración pero no fecha exacta | Inicio = `current date + 3 días`; fin = inicio + duración |
| Sin fecha NI duración | Ventana de 7 días (`SEARCH_STAY_NIGHTS`) desde `current date + 3 días` |
| "vuelta" / "regreso" / "ida y vuelta" | Requiere `returnDate` |

Fuente de hoy: el bloque DYNAMIC CONTEXT (`FECHA ACTUAL`), nunca el cutoff
del modelo.

### 2.3 Pasajeros
Reglas en `prompt.ts:343–350`:

| Frase | Default |
|---|---|
| "[N] personas" | adults = N, children = 0 |
| "una persona" | adults = 1, children = 0 |
| "familia" / "mi familia" / "flia" sin número | adults = 2, children = 2, infants = 0 (total `DEFAULT_FAMILY_TRAVELERS_TOTAL = 4`) |
| "X adultos y Y menores/niños" | adults = X, children = Y |
| "X adultos, Y niños y Z bebés" | adults = X, children = Y, infants = Z |
| Sin pax mencionado (vuelo) | adults = 1 (marcado `adultsExplicit = false`) |

El router (`routeRequest.ts:285–308`) trata `adults = 1 ∧ !adultsExplicit`
como **safe default**, NO como missing.

### 2.4 Equipaje (interpretación)
Sólo cuando el usuario menciona equipaje (`prompt.ts:360–380`):

| Valor | Disparadores |
|---|---|
| `backpack` | mochila, solo mochila, item personal, bolso personal |
| `carry_on` | carry on, equipaje de mano, cabina, sin bodega, sin valija |
| `checked` | valija, bodega, facturado, maleta, despachado |
| `both` | mano y bodega, equipaje completo |
| `none` | sin equipaje, nada de equipaje |

Sin mención → **no se emite el campo**.

### 2.5 Stops, cabina, horarios
- `stops`: `direct` / `with_stops` / `one_stop` / `two_stops` / `any`
  (`prompt.ts:382–388`). Default `any`.
- `cabinClass`: `economy` / `premium_economy` / `business` / `first`.
  Sólo si hay mención explícita.
- `departureTimePreference` / `arrivalTimePreference`:
  `morning` (6–12h) / `afternoon` (12–18h) / `evening` (18–22h) /
  `night` (22–6h). Sólo si hay mención explícita.

### 2.6 Locations
- Conversión a IATA con conocimiento del modelo (`prompt.ts:352–358`).
- Ciudades con múltiples aeropuertos: Buenos Aires → EZE (internacional) /
  AEP (doméstico); New York → JFK/LGA/EWR.
- Resorts/playas: usar aeropuerto más cercano (Riviera Maya → CZM,
  Punta Cana → PUJ).

---

## 3. Detección de intención (campos top-level)

Todos los siguientes son **semánticos y multilingües** (es/en/pt). El prompt
prohíbe explícitamente que se detecten por keyword surface — se mapea el
significado al enum canónico en inglés.

| Campo | Valores | Semántica |
|---|---|---|
| `travelerType` (§TRAVELER TYPE, `prompt.ts:666–714`) | `solo` / `couple` / `family` / `group` | Cue relacional explícito (pareja/wife/familia/amigos). NO emitir si sólo hay número ("dos personas") |
| `relativeDateHint` (§RELATIVE DATE HINTS) | `tomorrow` / `this_weekend` / `next_week` / `next_month` | Sólo cuando el usuario expresa fecha relativa. Si hay fecha explícita o duración → omitir |
| `partialStay` (§PARTIAL STAY) | `{ flightIntent, hotelNights?, extendsBeyondHotel, signalsCaught }` | Vuelo + hotel parcial (resto del viaje sin alojamiento pago) |
| `quoteIntent` (§QUOTE INTENT) | bool | Intención de obtener precio/availability YA. Excluye exploración conceptual |
| `planIntent` (§PLAN INTENT) | bool | Construir itinerario/route. Compatible con `quoteIntent=true` simultáneamente |
| `referencesCurrentPlan` (§CURRENT PLAN REFERENCE) | bool | Anáfora a un plan/cotización previo ("este", "lo que armamos") |
| `commercialIntent` (§COMMERCIAL INTENT) | `{ kind, agencyContext, confidence, rationale }` | 13 `kind`s: flight_search, hotel_search, specific_hotel_search, package_search, ordered_multi_product_search, budget_based_search, price_sensitive_search, family_trip_search, premium_experience_search, active_search_refinement, correction, add_product, contradiction_detected, trip_planning |
| `turnContinuity` (§TURN CONTINUITY) | `{ relation, target, confidence, rationale }` | `continues_previous` / `answers_pending_question` / `refines_active_search` / `selects_active_result` / `adds_product` / `changes_slot` / `new_independent_request` |
| `iterationIntent` (§ITERATION INTENT DETECTION) | `{ isIteration, type, modifiedFields, rationale }` | `duration_change` / `destination_swap` / `pax_change` / `preference_change` / `continuation` / `unrelated` |
| `searchSeeds` (§SEARCH SEEDS) | `{ destination, travelerType?, budgetHint?, occasionHint?, productsImplied[], adults?, children? }` | Mensajes exploratorios con destino + contexto, no QUOTE-ready. Default `productsImplied` por ocasión: anniversary/honeymoon/family/business → `['flight','hotel']` |
| `productOrder` (§OPERATIONAL ORDER) | `["flight"\|"hotel"\|"transfer", ...]` | Sólo si el usuario menciona 2+ productos en orden. NO emitir con palabra paraguas ("paquete"/"package") |

### 3.1 Default cuando el modo es ambiguo

- Si hay duda entre "continuación" y "request nueva" → elegir **continuación**
  con confidence menor y emitir el mejor merged request.
- Mensaje "corto / parcial / correctivo / comparativo / aditivo" después de
  una búsqueda → **continuidad por default**.
- `new_independent_request` requiere identidad de viaje claramente nueva:
  destino DISTINTO **Y** intent distinto, sin referencia al artefacto previo.

---

## 4. Merge con `previousContext`

Bloque CONTEXT MERGING RULES (`prompt.ts:155–187`):

1. Modificación de preferencias ("con escalas", "con valija") → merge,
   sólo se actualiza el campo mencionado.
2. Info que se agrega → merge.
3. Request completamente nueva (origen/destino diferentes) → **ignorar**
   previousContext.
4. Nunca preguntar info ya presente en contexto.
5. **PAX modification after error**: si el usuario dice "agrega X adultos"
   tras una búsqueda fallida con sólo menores → extraer todo del previous,
   sobreescribir adults.
6. **Planner follow-ups**: si `previousContext.requestType === 'itinerary'`
   y el user pide cambios ("make it more relaxed", "replace Paris with
   Lisbon") → mantener `requestType='itinerary'` + populate `editIntent`.
7. **SEARCH REFINEMENT — preserve requestType**: cualquier modificación de
   slot sobre `flights`/`hotels`/`combined` PRESERVA el `requestType`. Si
   cambia la duración, se recomputa `returnDate`/`checkoutDate`.

NO re-clasificar como `itinerary` por mencionar una duración más larga. Sólo
emitir `requestType='itinerary'` cuando hay verbos planner explícitos
("armame", "planificame", "qué hacer en", "ruta por", "circuito por").

---

## 5. Reglas de tools (selección)

Bloque `<tool_selection>` del prompt (`prompt.ts:97–125`):

### 5.1 Prioridad MÁXIMA — `pending_action`

Si MEMORY STATE incluye un bloque `<pending_action>`, la respuesta del usuario
probablemente lo contesta. Resolver ANTES de cualquier otra cosa:

- `kind="awaiting_user_input"` → `apply_slot_values({values_json: "{...}"})`
  con JSON-encoded string (no objeto). Claves coinciden con `fields`;
  ciudades como string, fechas ISO `YYYY-MM-DD`, conteos como int.
- `kind="awaiting_user_confirmation"` → `confirm_pending_action({confirmed: true|false, notes})`.
- Si el usuario cambió de tema (off-topic, saludo, request nueva) → NO
  llamar las tools, proceder normal.

### 5.2 Retrieval tools

| Tool | Cuándo |
|---|---|
| `get_planner_state(planner_id)` | Antes de cotizar/editar si el user dice "el plan"/"el itinerario"/"esto" **Y** hay plan ref activo en MEMORY STATE |
| `get_recent_searches(limit)` | Referencias a búsquedas previas ("esa búsqueda", "los vuelos que vimos") |
| `get_lead_full_history(lead_id)` | Sólo si conversación y profile son insuficientes y el user pregunta sobre historia del lead |
| `get_quote(quote_id)` | Sólo cuando hay quote ref activo y el user lo referencia |
| `discover_places(...)` | Lugares concretos no-hotel/no-flight en un destino: things to do, restaurants, cafes, bars, museums, sights, parks, shopping, neighborhoods. Emite `requestType: "itinerary"` + `placeDiscovery`. **NO** para vuelos/hotels/pricing/preguntas conceptuales |

### 5.3 Memory tool

`save_memory_note(text, keywords, scope)` — sólo cuando el usuario explícita
y durablemente declara preferencia/constraint/decisión.

**Rechazos (no negociables)** en `memoryTools.ts:77–93`:
- `pii_passport`: `[A-Z]{1,2}\d{6,9}` (AR/US passport shape)
- `pii_ssn`: `\d{3}-?\d{2}-?\d{4}`
- `pii_dob`: ISO date `\d{4}[-/]\d{2}[-/]\d{2}`
- `pii_payment`: `\d{13,19}` (PAN range)
- `instruction_shaped`: "remember that", "always do", "your rule is", "never do"
- `speculation`: "i think", "probably", "maybe", "i guess"
- `too_long`: > 500 chars
- `invalid_keywords`: fuera de [1..6] o vacíos
- `invalid_scope`: fuera de `['planning','pricing','lead-context','decisions']`

### 5.4 Planner mutation

`propose_planner_addition({place_ids, segment_id, day_index, note})` —
cuando el user quiere agregar lugares del `discover_places` previo al planner
("agregá el primero al día 2"). `place_ids` se resuelven contra
`<discovery_candidates>` en MEMORY STATE (0-indexed). Crea confirmation;
el próximo yes/no del user resuelve vía `confirm_pending_action`.

### 5.5 Reglas generales

- NO tools para preguntas conceptuales sobre destinos o conocimiento general.
- NO tools para chitchat o acknowledgements.
- Preferir parallel tool calls cuando son independientes.
- Máximo **3 tool-call rounds por turno**.
- Nunca llamar la misma tool con los mismos args dos veces.

---

## 6. Router determinístico (`routeRequest.ts`)

Sin LLM, < 1ms. Decide entre `QUOTE` / `COLLECT` / `PLAN`.

### 6.1 Scoring por dimensión

Pesos (`routeRequest.ts:79–85`):

```
destination 0.30   dates 0.25   passengers 0.15   origin 0.15   complexity 0.15
```

Thresholds:
- `QUOTE_THRESHOLD = 0.75`
- `PLAN_THRESHOLD = 0.40`
- `score < 0.40` → PLAN (`low_definition`)

### 6.2 Dimensiones

| Dimensión | Scoring |
|---|---|
| destination | 1.0 si ciudad clara, 0.5 si región/país (`REGIONS`/`COUNTRIES` sets), 0 si ausente |
| dates | 1.0 con `departureDate`/`checkinDate+checkoutDate`/`startDate`; 0.5 con `isFlexibleDates + flexibleMonth`; 0.3 con sólo `days > 0`; 0 si nada |
| passengers | 1.0 si `adultsExplicit` o safe default; 0 si "familia" sin adults; 0.5 ambiguo |
| origin | 1.0 con origin; 1.0 para `hotels`/`packages` (no aplica); 0.5 para `itinerary`; 0 si falta en flight-bearing |
| complexity | 1.0 simple; 0.5 si multi-city o 2–3 destinations; 0 si > 3 destinations |

### 6.3 Intent overrides (en orden)

1. **`quote_active_plan`** — si hay planner activo + `quoteIntent` + (anáfora al plan OR `editIntent`) → `QUOTE`.
2. **`contradiction_detected`** — del `commercialIntent` → `COLLECT`.
3. **`trip_planning` (commercial)** → `PLAN`.
4. **Commercial search intent** con destino ≥ 0.5 → score-based dentro de la rama search.
5. **`requestType==='itinerary'` o `planIntent`** → `PLAN`.
6. **Destination región/país** → `PLAN` con `destination_too_vague`.
7. **`quoteIntent` + destino ciudad** → `QUOTE` o `COLLECT` según score.

### 6.4 Reason codes de router

`quote_active_plan`, `edit_existing_plan`, `itinerary_request`,
`destination_too_vague`, `quote_intent_complete`, `quote_intent_incomplete`,
`high_definition`, `needs_clarification`, `low_definition`,
`safe_defaults_applied`, `ordered_products_ready`, `hotel_exact_ready`,
`origin_missing_no_geo`, `minor_ages_needed`, `contradiction_detected`,
`exploratory_with_seeds`.

---

## 7. Orquestador (modo)

`conversationOrchestrator.resolveConversationTurn` — strict mode routing
(`conversationOrchestrator.ts:720–820`).

### 7.1 Branches válidos por modo

| Modo | Branch para intent match | Branch para mismatch |
|---|---|---|
| `agency` | `standard_search` o `ask_minimal` | `mode_bridge` (sugiere `passenger`) |
| `passenger` | `standard_itinerary` o `ask_minimal` | `mode_bridge` (sugiere `agency`) |

### 7.2 Branches especiales

- **`standard_itinerary` con `responseMode='show_places'`** — discovery
  (placeDiscoveryResult OK). Mode-agnostic, sale ANTES del bridge.
- **`proposal_chip` con `responseMode='proposal_first_search'`** — sólo en
  modo `agency`, cuando `reason='exploratory_with_seeds'` + searchSeeds +
  sin pending_action. Renderiza chips de propuesta de búsqueda.

### 7.3 Bridge guards (G1–G5)

`mode_bridge` se suprime cuando:
- **G1** previousMessageType ya fue `mode_bridge` (anti-loop).
- **G2** `forceCurrentMode === true` (user clickeó "seguir en este modo").
- **G3** `pending_action` activo con planner activo (mid-ask).
- **G4** previousMessageType fue `quote_active_plan` (slot fill answer).
- **G5** alta confianza + planIntent explícito multilingüe.

### 7.4 `shouldAskMinimalQuestion`

Sólo `true` cuando: `route === 'COLLECT'` + hay `collectQuestion` + no se
agotaron los turnos (`recentCollectCount < maxCollectTurns = 3`) Y
(missing incluye `passengers` OR `reason === 'quote_intent_incomplete'`
sin contexto previo).

---

## 8. Defaults derivados / numéricos (drift-tested)

Constantes en `_shared/searchDefaults.ts` y `src/services/searchDefaults.ts`:

| Constante | Valor | Uso |
|---|---|---|
| `SEARCH_START_OFFSET_DAYS` | `3` | Hoy + 3 cuando falta fecha |
| `SEARCH_STAY_NIGHTS` | `7` | Ventana default cuando falta fecha y duración |
| `DEFAULT_FAMILY_TRAVELERS_TOTAL` | `4` | "familia" sin número = 4 (2 adults + 2 children) |

Si una de estas constantes diverge del prompt, falla el test
`src/services/__tests__/searchDefaults.drift.test.ts`.

---

## 9. Idioma de la respuesta

- Toda string natural emitida en el JSON (`message`, `ask`, `explanation`,
  missing-field prompts, etc.) se escribe en el idioma indicado por el
  parámetro `language` (`'es' | 'en' | 'pt'`, BCP-47 short code).
- Las claves JSON, enum values, códigos IATA/ciudad y fechas ISO **siempre
  permanecen en forma canónica**, sin importar el idioma del usuario.

---

## 10. Invariantes (CLAUDE.md)

Reglas que **no deben** romperse al editar la pipeline:

- **`pending_action` es un state machine single-slot**. Mutar SÓLO vía
  `setPendingAction` / `clearPendingAction` / `markPendingActionApplied`.
  `mode_bridge` se suprime mientras `pending_action` esté seteado.
- **`CanonicalItineraryResult`** es la única shape que sale del itinerary
  pipeline; rama productiva = `standard_itinerary`.
- **Contexto Engineering Option A** — `EmiliaState` en `agent_states`
  keyed por `conversation_id`. NO hay memoria cross-conversación;
  `global_memory` despite the name es per-conversation.
- **Memory tool rejections** son no-negociables (PII + instruction-shaped +
  speculation). Removerlas habilita prompt injection y PII leak.
- **Tool loop telemetry** `[CTX-TOOL]` / `[CTX-MEMORY]` no se borra:
  rollback decisions dependen de los eventos.

---

## Apéndice — Versión y referencias

- `PROMPT_VERSION` actual: `emilia-parser-v22` (`prompt.ts:1`).
- `PROMPT_CONTRACT_SNIPPETS` (lista de "anchors" auditados por
  `staticPrompt.contract.test.ts`): ver `prompt.ts:2–27`.
- Audit endpoint para inspeccionar lo que el modelo vio en un turno:
  `supabase/functions/agent-state-audit/`.
- Specs vivas:
  - `docs/architecture/context-engineering-overview.md` — runtime
  - `docs/architecture/context-engineering-spec.md` — state contract
  - `docs/architecture/tool-catalog.md` — tool inventory + debt
