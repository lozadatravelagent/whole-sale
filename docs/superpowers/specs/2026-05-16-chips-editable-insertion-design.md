# Chips: inserción editable + chips de refinamiento

**Fecha:** 2026-05-16
**Estado:** Diseño aprobado — pendiente de plan de implementación
**Enfoque elegido:** Enfoque 2 (hook/util de inserción compartido + función pura de refinamiento)

## Problema

Hoy los chips con texto del chat tienen comportamiento inconsistente y mayormente
auto-envían al hacer click:

- **Sistema 2 — Suggested Actions** (`ChatInterface.tsx:516-539`, vienen de
  `meta.suggestedActions`): el click envía `action.prompt` inmediatamente.
- **Sistema 3 — Narrative Chips** (`meta.emiliaNarrative.chips`,
  `ChatInterface.tsx:559-565`): `kind:'submit'` envía; `kind:'prefill'` rellena.
- **Sistema 1 — Suggestion Chips Trip Planner** (`SuggestionChips.tsx`): el click
  dispara una acción.
- **Sistema 4 — Filter Chips** (`FilterChips.tsx`, `HotelFilterChips.tsx`): filtran
  resultados, no llevan texto. **Fuera de alcance.**

El usuario no puede revisar ni editar el texto antes de enviarlo, y no existe una
regla arquitectónica única que garantice ese comportamiento para chips futuros.

## Objetivos

### A — Comportamiento global de chips (cambio arquitectónico)

Todo chip con texto (Sistemas 1, 2, 3) al tocarlo **inserta su texto en el input
del chat, editable, sin enviar**. "No auto-send" pasa a ser el default del sistema,
no un caso particular.

Inserción "append inteligente":

- `message` vacío o solo whitespace → `setMessage(text)`
- `message` con contenido → `setMessage(value.trimEnd() + " " + text)`
  (separador = un espacio)
- Siempre: enfocar el `<Textarea>` y posicionar el cursor al final

El pipeline de envío real (Enter / botón Send) queda intacto.

### B — Chips de refinamiento post-búsqueda (nuevos)

Chips derivados **en el cliente** desde `ContextState` (parámetros de la última
búsqueda del chat), de `type: 'refine'`, generados por una función pura nueva e
inyectados vía `buildSuggestedActions()`.

| Chip | Condición de disparo | Texto insertado (valor inferido) |
|------|----------------------|----------------------------------|
| Ida y Vuelta | `flightsParams.tripType === 'one-way'` y hay `departureDate` | `Cambiá la búsqueda a ida y vuelta, volviendo el {departureDate + DEFAULT_FALLBACK_STAY_NIGHTS}` |
| Agregar/quitar días | hay rango de fechas (vuelo round-trip u hotel) | `Modificá la duración del viaje (actualmente {N} noches)` |
| Modificar pasajeros | hay pax conocidos | `Modificá los pasajeros (actualmente {A} adultos, {C} niños, {I} bebés)` |
| Modificar la búsqueda | hay alguna última búsqueda | `Quiero modificar la búsqueda de {destino}` |

Los valores inferidos (p. ej. fecha de vuelta = salida + noches por default)
**reusan exclusivamente las constantes de `src/services/searchDefaults.ts`**
(`DEFAULT_SEARCH_START_OFFSET_DAYS`, `DEFAULT_FALLBACK_STAY_NIGHTS`), la misma
lógica de defaults que ya usa `proposedSearchBuilder.ts`. Sin valores ad-hoc.

## Arquitectura

Tres unidades aisladas, cada una con un propósito y testeable de forma
independiente:

### Unidad 1 — `useChipInsertion`

- **Archivo (nuevo):** `src/features/chat/hooks/useChipInsertion.ts`
- **Propósito:** única fuente de verdad del append inteligente + foco + cursor.
- **Interfaz:** `useChipInsertion({ value, onChange, inputRef })` →
  `{ insertChipText(text: string): void }`
- **Dependencias:** estado `message` y su setter (hoy en `ChatFeature`), ref del
  `<Textarea>`.
- **Detalle de wiring:** el ref del `<Textarea>` vive hoy dentro de
  `ChatInputDock`. Se eleva a `ChatFeature` (donde vive el estado `message`) y se
  pasa como prop `inputRef` a `ChatInputDock`, que lo adjunta al `<Textarea>`.

### Unidad 2 — Rewire de los 3 sistemas de chips

- **Archivos:** `ChatInterface.tsx`, `SuggestionChips.tsx`, `ChatFeature.tsx`
  (cableado del nuevo prop `onChipInsert`).
- **Sistema 2** (`ChatInterface.tsx:530`): `onSuggestedAction?.(action.prompt)` →
  `onChipInsert?.(action.prompt)`.
- **Sistema 3** (`ChatInterface.tsx:559-565`): se colapsan las ramas
  `submit`/`prefill` a una sola → `onChipInsert?.(chip.action.text)`. El campo
  `action.kind` permanece en el tipo por compatibilidad pero **ya no dispara
  envío** (queda deprecado; documentar en el tipo).
- **Sistema 1** (`SuggestionChips.tsx` / su consumidor en Trip Planner): el click
  reenruta a inserción en el input. `PlannerSuggestion` no tiene `prompt`, se
  inserta `suggestion.label`.
- `onSuggestedAction` / camino de auto-send se elimina del árbol de chips. El
  envío programático no relacionado a chips (si existiera) no se toca.

### Unidad 3 — `buildRefinementChips`

- **Archivo (nuevo):** `src/features/chat/services/refinementChipsBuilder.ts`
- **Firma:** `buildRefinementChips(ctx: ContextState, now: Date, language): ChatSuggestedAction[]`
- **Propósito:** función pura que mapea la última búsqueda a chips `'refine'`.
- **Integración:** invocada dentro de `buildSuggestedActions()`
  (`useMessageHandler.ts:416-481`); el resultado se mergea con los suggested
  actions existentes y se ordena por `priority`.
- **Dependencias:** `searchDefaults.ts`, tipo `ContextState`
  (`flightsParams` / `hotelsParams`), util de formato de fecha existente.

## Flujo de datos

**Inserción:** click en chip → `onChipInsert(text)` → `insertChipText(text)` →
`setMessage` (append inteligente) + `focus()` + cursor al final → usuario edita →
Enter / Send → pipeline de envío existente (sin cambios).

**Refinamiento:** termina turno del asistente → `useMessageHandler` arma `meta` →
`buildSuggestedActions()` ahora también llama `buildRefinementChips(contextState)`
→ array mergeado y ordenado por `priority` → `meta.suggestedActions` →
`ChatInterface` renderiza (cap `.slice(0, 3)`) → click → `onChipInsert`.

## Manejo de errores

- `buildRefinementChips` es pura y defensiva: dato faltante → ese chip se omite;
  sin contexto → `[]`. Nunca lanza.
- `insertChipText` tolera `inputRef` nulo (foco best-effort, no rompe la inserción
  del texto).
- Sin red ni async en ninguna de las tres unidades.

## Testing

- **`refinementChipsBuilder.test.ts`** (nuevo): one-way → emite chip Ida y Vuelta
  con fecha inferida correcta (assert contra `DEFAULT_FALLBACK_STAY_NIGHTS`);
  round-trip → no emite Ida y Vuelta; variantes de pax y fechas; contexto vacío →
  `[]`.
- **`useChipInsertion.test.ts`** (nuevo): vacío → reemplaza; con texto → append
  con separador; foco y cursor al final (jsdom).
- **Tests de render de chips** (existentes en `__tests__`): ajustar para verificar
  que el click ya no envía (no llama `onSuggestedAction`) y sí llama
  `onChipInsert`.
- **Verificación:** `npm run lint` + `npm test` + `npm run build`
  (CLAUDE.md exige correr tests tras cambios en orquestación/chat).

## Decisiones y supuestos confirmados

1. Los chips alternativos pre-búsqueda de `proposedSearchBuilder.ts` (adults-only,
   only-hotel, 5-nights, económico) **quedan como están**. Los de refinamiento son
   un set distinto, post-búsqueda.
2. El cap de 3 chips visibles (`ChatInterface.tsx:317`, `.slice(0, 3)`) **se
   mantiene**. Los refinement chips compiten por `priority`; el esquema de
   prioridades concreto se define en el plan de implementación.
3. **Trip Planner (Sistema 1) — comportamiento híbrido por tipo de acción.**
   `PlannerSuggestion.action` es heterogéneo; insertar texto editable solo aplica
   a los chips que son prompts. Reparto definitivo:
   - **Solo acción directa (sin texto):** `confirm_field`, `confirm_location_dates`
     → conservan `handleSuggestionClick` original (escritura de estado de 1 clic).
   - **Modal + texto:** `select_dates` → llama `handleSuggestionClick` (abre el
     modal selector de fechas vía `onOpenDateSelector`) **y además** inserta en el
     input un texto entendible por el LLM (p. ej. `"Quiero elegir las fechas
     exactas del viaje."`) para que la intención quede explícita en el editor.
   - **Insertan texto editable (`suggestion.label`):** `search_transport`,
     `search_hotels`, `fill_slot`, `add_transfers` (y cualquier acción futura no
     listada → default a insertar `.label`).
   Consecuencia: `handleSuggestionClick` y `loadingActionId` siguen vivos (no hay
   código muerto). El supuesto original "se inserta `suggestion.label` para todos"
   queda **revisado** por esta decisión (descubierta en code review de Task 7).
4. Sistema 4 (Filter Chips) queda **fuera de alcance**.
5. Separador de append = un espacio.
6. `NarrativeChipShape.action.kind` se conserva en el tipo por compatibilidad pero
   queda deprecado (ya no afecta el envío).

## Fuera de alcance (YAGNI)

- Módulo de policy configurable por tipo de chip.
- Cambiar el cap de chips visibles.
- Cambiar `searchDefaults.ts`.
- Generación de chips de refinamiento server-side (se eligió derivación cliente).
- Tocar Filter Chips.
