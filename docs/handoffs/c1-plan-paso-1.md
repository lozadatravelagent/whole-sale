# C1 — Tests para useMessageHandler: Plan Paso 1

**Fecha**: 2026-04-25  
**Bloque**: C1 (post-auditoría de capas)  
**Archivo objetivo**: `src/features/chat/hooks/useMessageHandler.ts` (1957 líneas, 31 params, 0 tests existentes)

---

## Sección 1 — Subdivisión: C1.a / C1.b / C1.c vs PR único

**Recomendación: 3 sub-bloques, 3 PRs.**

El hook tiene 1957 líneas y 31 parámetros. Un PR único que cubre toda la suite sería irrevisoble y el riesgo de conflictos durante review es alto. La subdivisión natural sigue el flujo interno del hook:

- **C1.a** (fundación): Guards/early-exits + missing_info_request + infraestructura de mocks. Líneas 156–352 y case `missing_info_request`. Establece `src/test-utils/useMessageHandlerFactory.ts` y los module mocks que C1.b y C1.c reutilizan. Debe mergear antes de que los otros comiencen.

- **C1.b** (routing/COLLECT): COLLECT exhaustion, mode_bridge, iteration merge, preloadedContext, requestType normalization. Líneas ~353–1484 (todo antes del switch de ejecución). Depende de C1.a (usa la factory). Puede paralelizarse con C1.c una vez que C1.a está mergeado.

- **C1.c** (ejecución): Todos los cases del switch (lines 1485+): flights, hotels, combined (incluido domain-lock), itinerary (show_places y draft_generating), package, service, error handling. Depende de C1.a. Paralelo con C1.b.

Justificación adicional: C1.a tiene ~10 tests y toma ~6h. Hacerlo primero permite detectar si el hook es testeable antes de invertir en C1.b y C1.c. Si C1.a revela que el hook necesita refactor para ser testeable, se para y se abre issue antes de escribir 20 tests más que romperían.

---

## Sección 2 — Inventario de branches priorizado

Los branches están ordenados de mayor a menor prioridad de cobertura. La prioridad combina: riesgo de regresión, frecuencia de ejecución en producción, y facilidad de testeo.

### Prioridad 1 — Guards/early-exits (C1.a)
1. **Mensaje vacío** (ln 156): `currentMessage.trim() === ''` → retorno inmediato, ningún efecto secundario
2. **Sin conversationId** (ln 156): `currentConversationId === null` → retorno inmediato
3. **Cheaper flights shortcut** (ln ~166): `isCheaperFlightRequest` true → delega a `handleCheaperFlightsSearch`, no llama a `parseMessageWithAI`
4. **Add hotel request** (ln ~247): `isAddHotelRequest` true → branch separado
5. **Price change request** (ln ~353): `isPriceChangeRequest` true → delega a `handlePriceChangeRequest`

### Prioridad 2 — UI state management (C1.a)
6. **setIsLoading true/false**: Se activa al inicio y se limpia en finally (branch nominal)
7. **setIsTyping true/false**: Mismo patrón que loading
8. **setMessage("")**: Se llama para limpiar el input tras enviar

### Prioridad 3 — missing_info_request case (C1.a)
9. **Response assembly**: `assistantResponse` se toma de `parsedRequest.message`
10. **saveContextualMemory call**: Se guarda `originalRequest` para contexto de memoria

### Prioridad 4 — COLLECT + routing (C1.b)
11. **COLLECT con < 3 turnos**: `routeRequest` devuelve COLLECT → `buildConversationalMissingInfoMessage` → no llama searchHandlers
12. **COLLECT exhaustion en turno 3**: Fuerza search a pesar del routing COLLECT
13. **preloadedContext provided**: Omite llamada a `loadContextualMemory` (usa el contexto pre-cargado)
14. **Sin preloadedContext**: Llama `loadContextualMemory(conversationId)`
15. **Iteration intent detectado**: `detectIterationIntent` true → `mergeIterationContext` → `parsedRequest` combinado
16. **Mode bridge**: `resolveEffectiveMode` detecta mismatch → inserta `buildModeBridgeMessage` y continúa

### Prioridad 5 — Execution switch (C1.c)
17. **flights case**: Llama `handleFlightSearch(parsedRequest)`, propaga `response` y `data`
18. **hotels case**: Llama `handleHotelSearch(parsedRequest)`
19. **combined case (activeDomain null)**: Llama `handleCombinedSearch`
20. **combined con domain-lock hotels**: `activeDomain === 'hotels'` → llama `handleHotelSearch` en su lugar
21. **itinerary show_places**: `responseMode === 'show_places'` → `buildDiscoveryResponsePayload`
22. **itinerary draft_generating**: Llama `handleItineraryRequest` + canonical pipeline (`buildCanonicalResultFromStandard`)
23. **package case**: Llama `handlePackageSearch`
24. **service case**: Llama `handleServiceSearch`

### Prioridad 6 — Error handling (C1.c)
25. **parseMessageWithAI throws**: Se llama `toast` con error, se llama `removeOptimisticMessage`
26. **handleFlightSearch throws**: Mismo patrón
27. **addMessageViaSupabase falla**: Comportamiento degradado sin crash

### Prioridad 7 — handlePlannerDateSelection (C1.a o C1.b)
28. **Fecha flexible seleccionada**: Formato de mensaje con `flexibleLabel`
29. **Fechas concretas seleccionadas**: Formato `startDate al endDate`

---

## Sección 3 — Infraestructura de mocks

### 3.1 Factory de props

Crear `src/test-utils/useMessageHandlerFactory.ts`. Exporta una función `buildProps()` que devuelve el objeto completo con defaults sensatos:

```typescript
// src/test-utils/useMessageHandlerFactory.ts
import { vi } from 'vitest';

export function buildProps(overrides: Partial<ReturnType<typeof buildProps>> = {}) {
  const props = {
    // Required — data
    selectedConversation: 'conv-123',
    selectedConversationRef: { current: 'conv-123' },
    messages: [],
    previousParsedRequest: null,
    plannerContextRequest: null,
    plannerState: null,
    // Required — callbacks (vi.fn())
    setPreviousParsedRequest: vi.fn(),
    loadContextualMemory: vi.fn().mockResolvedValue(null),
    saveContextualMemory: vi.fn().mockResolvedValue(undefined),
    clearContextualMemory: vi.fn().mockResolvedValue(undefined),
    loadContextState: vi.fn().mockResolvedValue(null),
    saveContextState: vi.fn().mockResolvedValue(undefined),
    updateMessageStatus: vi.fn().mockResolvedValue(undefined),
    updateConversationTitle: vi.fn().mockResolvedValue(undefined),
    handleCheaperFlightsSearch: vi.fn().mockResolvedValue(null),
    handlePriceChangeRequest: vi.fn().mockResolvedValue(null),
    setIsLoading: vi.fn(),
    setIsTyping: vi.fn(),
    setMessage: vi.fn(),
    toast: { error: vi.fn(), success: vi.fn() },
    setTypingMessage: vi.fn(),
    addOptimisticMessage: vi.fn(),
    updateOptimisticMessage: vi.fn(),
    removeOptimisticMessage: vi.fn(),
    // Optional — default undefined
    persistPlannerState: undefined,
    setDraftPlannerFromRequest: undefined,
    setPlannerDraftPhase: undefined,
    updatePlannerState: undefined,
    preloadedContext: undefined,
    workspaceMode: undefined,
    chatMode: undefined,
  };
  return { ...props, ...overrides };
}
```

Cada test llama `const props = buildProps({ ... })` y llama `renderHook(() => useMessageHandler(...Object.values(props)))` — o mejor, spread con un helper wrapper.

**Nota sobre el spread**: El hook recibe props posicionalmente (no como objeto). El wrapper de test tiene que spreadearlo en el orden exacto de la firma. Mejor definir un helper local en cada archivo de tests:

```typescript
function renderHandler(overrides = {}) {
  const p = buildProps(overrides);
  return renderHook(() => useMessageHandler(
    p.selectedConversation, p.selectedConversationRef, p.messages,
    p.previousParsedRequest, p.setPreviousParsedRequest,
    p.loadContextualMemory, p.saveContextualMemory, p.clearContextualMemory,
    p.loadContextState, p.saveContextState,
    p.updateMessageStatus, p.updateConversationTitle,
    p.handleCheaperFlightsSearch, p.handlePriceChangeRequest,
    p.setIsLoading, p.setIsTyping, p.setMessage, p.toast, p.setTypingMessage,
    p.addOptimisticMessage, p.updateOptimisticMessage, p.removeOptimisticMessage,
    p.plannerContextRequest, p.plannerState,
    p.persistPlannerState, p.setDraftPlannerFromRequest, p.setPlannerDraftPhase,
    p.updatePlannerState, p.preloadedContext, p.workspaceMode, p.chatMode,
  ));
}
```

### 3.2 Module mocks (vi.mock)

**Crítico**: useMessageHandler no importa supabase directamente. El cliente Supabase está aislado en `messageStorageService` y `messageService`, que se mockean a nivel módulo. No se necesita mock de `@/integrations/supabase/client` en estos tests.

Mocks necesarios en cada archivo de test (vi.mock es hoisted, va al top):

```typescript
vi.mock('@/services/aiMessageParser', () => ({
  parseMessageWithAI: vi.fn(),
  combineWithPreviousRequest: vi.fn(),
  validateFlightRequiredFields: vi.fn().mockReturnValue([]),
  validateHotelRequiredFields: vi.fn().mockReturnValue([]),
  validateItineraryRequiredFields: vi.fn().mockReturnValue([]),
  generateMissingInfoMessage: vi.fn().mockReturnValue('missing info'),
}));

vi.mock('../services/searchHandlers', () => ({
  handleFlightSearch: vi.fn().mockResolvedValue({ response: 'flights ok', data: {} }),
  handleHotelSearch: vi.fn().mockResolvedValue({ response: 'hotels ok', data: {} }),
  handleCombinedSearch: vi.fn().mockResolvedValue({ response: 'combined ok', data: {} }),
  handlePackageSearch: vi.fn().mockResolvedValue({ response: 'package ok', data: {} }),
  handleServiceSearch: vi.fn().mockResolvedValue({ response: 'service ok', data: {} }),
  handleGeneralQuery: vi.fn().mockResolvedValue({ response: 'general ok', data: {} }),
  handleItineraryRequest: vi.fn().mockResolvedValue({ response: 'itinerary ok', data: {} }),
}));

vi.mock('../services/messageService', () => ({
  addMessageViaSupabase: vi.fn().mockResolvedValue({ id: 'msg-1', role: 'assistant' }),
}));

vi.mock('../services/routeRequest', () => ({
  routeRequest: vi.fn().mockReturnValue({ route: 'QUOTE' }),
  buildSearchSummary: vi.fn().mockReturnValue(''),
  getInferredFieldDetails: vi.fn().mockReturnValue([]),
}));

vi.mock('../services/conversationOrchestrator', () => ({
  buildConversationalMissingInfoMessage: vi.fn().mockReturnValue('missing'),
  buildModeBridgeMessage: vi.fn().mockReturnValue('bridge'),
  resolveConversationTurn: vi.fn().mockReturnValue({ responseMode: 'standard', turnNumber: 1 }),
}));

vi.mock('../utils/intentDetection', () => ({
  isAddHotelRequest: vi.fn().mockReturnValue(false),
  isCheaperFlightRequest: vi.fn().mockReturnValue(false),
  isPriceChangeRequest: vi.fn().mockReturnValue(false),
}));

vi.mock('../utils/iterationDetection', () => ({
  detectIterationIntent: vi.fn().mockReturnValue(false),
  mergeIterationContext: vi.fn(),
  generateIterationExplanation: vi.fn().mockReturnValue(''),
}));
```

Los mocks de `discoveryService`, `itineraryPipeline`, y `resolveEffectiveMode` se añaden solo en C1.c donde hacen falta.

### 3.3 Patrón act/await

Todos los asserts contra `handleSendMessage` deben usar `act`:

```typescript
await act(async () => {
  await result.current.handleSendMessage('quiero vuelos a Madrid');
});
expect(handleFlightSearch).toHaveBeenCalledWith(expect.objectContaining({ requestType: 'flights' }));
```

---

## Sección 4 — Lista nominal de tests (~28 ítems)

Los nombres siguen la convención `describe > it` y son suficientemente concretos para implementarse sin ambigüedad.

### C1.a — `useMessageHandler.guards.test.ts` (10 tests)
```
describe('handleSendMessage - guards')
  it('returns early when message is empty string')
  it('returns early when message is whitespace only')
  it('returns early when selectedConversationRef.current is null')
  it('calls handleCheaperFlightsSearch when isCheaperFlightRequest is true')
  it('does NOT call parseMessageWithAI when cheaper flights shortcut is taken')
  it('calls handlePriceChangeRequest when isPriceChangeRequest is true')
  it('sets isLoading true before parseMessageWithAI and false in finally')
  it('sets isTyping true before response and false in finally')
  it('calls setMessage("") after sending')
  it('calls removeOptimisticMessage when parseMessageWithAI throws')

describe('handleSendMessage - missing_info_request case')
  it('sets assistantResponse from parsedRequest.message')
  it('calls saveContextualMemory with the originalRequest')

describe('handlePlannerDateSelection')
  it('calls handleSendMessage with formatted flexible date message')
  it('calls handleSendMessage with formatted concrete date range message')
```
Total C1.a: 14 tests.

### C1.b — `useMessageHandler.routing.test.ts` (7 tests)
```
describe('handleSendMessage - context loading')
  it('calls loadContextualMemory when preloadedContext is undefined')
  it('skips loadContextualMemory when preloadedContext is provided')
  it('uses contextualMemory from preloadedContext.contextualMemory')

describe('handleSendMessage - COLLECT routing')
  it('returns missing info message when route is COLLECT and turn < 3')
  it('proceeds to search when COLLECT exhaustion (turn >= 3)')

describe('handleSendMessage - iteration merge')
  it('calls mergeIterationContext when detectIterationIntent returns true')
  it('does NOT call mergeIterationContext when detectIterationIntent returns false')
```
Total C1.b: 7 tests.

### C1.c — `useMessageHandler.execution.test.ts` (12 tests)
```
describe('handleSendMessage - execution switch')
  it('calls handleFlightSearch for requestType flights')
  it('calls handleHotelSearch for requestType hotels')
  it('calls handleCombinedSearch for requestType combined when activeDomain is null')
  it('calls handleHotelSearch for requestType combined when activeDomain is hotels')
  it('calls handlePackageSearch for requestType package')
  it('calls handleServiceSearch for requestType service')
  it('calls buildDiscoveryResponsePayload for itinerary when responseMode is show_places')
  it('calls handleItineraryRequest for itinerary when responseMode is not show_places')
  it('calls addMessageViaSupabase after flight search with structuredData')
  it('calls addMessageViaSupabase after hotel search with structuredData')

describe('handleSendMessage - error handling')
  it('calls toast.error when handleFlightSearch throws')
  it('calls removeOptimisticMessage when search handler throws')
```
Total C1.c: 12 tests.

**Total global**: 33 tests.

---

## Sección 5 — Estimación honesta

### C1.a
- Build `useMessageHandlerFactory.ts` + vi.mock boilerplate: **1.5h**
- Resolver issues de renderHook + act (primeros tests): **1.5h**
- 14 tests: **3h** (promedio 12min/test para guards simples)
- Buffer: **1h** (imports path relativos incorrectos, act warnings)
- **Total C1.a**: ~7h

### C1.b
- Mocks adicionales (routeRequest, orchestrator): **0.5h**
- 7 tests: **2.5h** (promedio 20min/test — requieren setup de state entre turns)
- **Total C1.b**: ~3h

### C1.c
- Mocks adicionales (itineraryPipeline, discoveryService): **0.5h**
- 12 tests: **4h** (promedio 20min/test — flujos async más largos)
- **Total C1.c**: ~4.5h

**Total wall time** (con C1.b y C1.c paralelos): ~7h + max(3h, 4.5h) = **~11.5h**  
**Total persona-hours**: ~14.5h

Riesgo principal: si `renderHook` + `act` revela que el hook no es testeable tal como está (e.g., refs internos que no se pueden seedar desde afuera), C1.a puede escalar 2–3h. Trigger de stop-and-ask si eso ocurre (ver Sección 7).

---

## Sección 6 — Estrategia de subagentes

### C1.a: main thread, secuencial
C1.a se ejecuta primero en el hilo principal. Razón: establece la infraestructura (`useMessageHandlerFactory.ts`, patrón de vi.mock, helper `renderHandler`) que C1.b y C1.c necesitan. Si C1.a descubre que el hook requiere refactor para ser testeable, se para antes de invertir en los otros.

Entregable de C1.a: PR con `useMessageHandlerFactory.ts` + `useMessageHandler.guards.test.ts` + test run verde (0 failed). Docs/PR guardado en `docs/prs/`.

### C1.b + C1.c: subagentes paralelos post-merge de C1.a
Una vez que C1.a está mergeado y `useMessageHandlerFactory.ts` existe en main, se lanzan dos subagentes simultáneos:

**Subagente C1.b** recibe:
- Path a `useMessageHandlerFactory.ts` (para import)
- Patrón de vi.mock de C1.a (copiar y añadir mocks de routeRequest/orchestrator)
- Lista de 7 tests de la Sección 4 C1.b
- Instrucción: crear `src/features/chat/hooks/__tests__/useMessageHandler.routing.test.ts`
- Instrucción: NO modificar useMessageHandler.ts
- Stop-and-ask triggers de Sección 7

**Subagente C1.c** recibe:
- Mismo factory + patrón de mocks
- Mocks adicionales: itineraryPipeline, discoveryService, resolveEffectiveMode
- Lista de 12 tests de la Sección 4 C1.c
- Instrucción: crear `src/features/chat/hooks/__tests__/useMessageHandler.execution.test.ts`
- Instrucción: NO modificar useMessageHandler.ts
- Stop-and-ask triggers de Sección 7

Cada subagente entrega: test file con todos los tests verdes, reporte de lint en el archivo tocado, PR description listo para pegar.

---

## Sección 7 — Stop-and-ask triggers

Los siguientes eventos deben interrumpir la ejecución y esperar OK explícito:

1. **Refactor necesario para testear**: Cualquier test requiere modificar `useMessageHandler.ts` para ser testeable (e.g., extraer función interna, inyectar dependencia). Reportar cuál branch, por qué, y qué cambio mínimo resolvería. No modificar sin aprobación.

2. **Branch no inventariado**: Un test de la lista nominal resulta imposible sin entender un branch que no estaba en este plan (e.g., algún path en líneas 900–1090 no documentado aquí). Reportar la brecha antes de improvisar.

3. **Module mock rompe test existente**: Si añadir un `vi.mock` de un módulo compartido (e.g., `searchHandlers`) rompe tests existentes en otro archivo de la suite. Reportar conflicto y esperar resolución.

4. **`renderHook` no puede seedar estado interno**: Si el hook usa refs internos (e.g., `activeDomain`) que no son accesibles/seteables desde fuera y eso hace imposible testear un caso de la lista. Reportar cuál test, cuál ref, posible solución.

5. **Más de 3 tests de la lista requieren > 45min cada uno**: Indicador de que el scope fue subestimado. Reportar cuáles y por qué antes de continuar.

6. **Subagente propone cambiar la firma del hook**: Prohibido en C1. Reportar y esperar OK.

7. **Lint introduce regresión**: Diferencia negativa respecto al baseline de 920 problemas en los archivos tocados. Reportar el delta antes de abrir PR.
