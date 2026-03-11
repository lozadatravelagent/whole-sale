# Plan: NLP Planner Agent — Arquitectura Agéntica para WholeSale Connect

## Objetivo
Replicar el patrón de Sabre (MCP Server + Agentic APIs + Agent Loop) adaptado a WholeSale Connect, transformando el flujo lineal actual en un **agente autónomo con loop iterativo, tool discovery, y orquestación inteligente**.

---

## Diagnóstico: Estado Actual vs. Objetivo

### Lo que YA existe (piezas de abajo)
| Componente | Archivo | Estado |
|-----------|---------|--------|
| NLP Parser | `supabase/functions/ai-message-parser/` | ✅ Sólido (emilia-parser-v3) |
| Flight Search | `searchHandlers.ts` → `starling-flights` | ✅ Funciona |
| Hotel Search | `searchHandlers.ts` → `eurovips-soap` | ✅ Funciona |
| Package/Service Search | `searchHandlers.ts` → `eurovips-soap` | ✅ Funciona |
| Itinerary Generator | `travel-itinerary` edge function | ✅ Funciona |
| Iteration Detection | `iterationDetection.ts` | ✅ Funciona (regex patterns) |
| Context Persistence | `contextState.ts` + system messages | ✅ Funciona |
| City Code Resolution | `cityCodeResolver.ts` | ✅ Funciona |
| Advanced Filters | `advancedFilters.ts` | ✅ Funciona |
| Response Formatters | `responseFormatters.ts` | ✅ Funciona |
| Redis Cache | `api/src/lib/redis.ts` | ✅ Funciona |
| API Gateway | `api/src/server.ts` + routes | ✅ Funciona |

### Lo que FALTA (capa del medio — el "MCP")
| Componente | Equivalente Sabre | Estado |
|-----------|-------------------|--------|
| Tool Registry | MCP Tool Definitions | ❌ No existe |
| Agent Loop (Perceive→Reason→Act→Observe) | Agent orchestration | ❌ Lineal, no iterativo |
| Planner/Reasoner | LLM-based planning | ❌ No existe |
| Tool Executor | MCP Server executor | ❌ Hardcoded switch |
| Observation Parser | Response → next action | ❌ No existe |
| Governance Guardrails | Policy compliance | ⚠️ Parcial (validation.ts) |
| Multi-step Planning | Complex workflow orchestration | ❌ No existe |

### El Problema Central
`useMessageHandler.ts` es un **switch gigante de 1700+ líneas** que rutea manualmente:

```
parsedRequest.requestType → switch → handleFlightSearch / handleHotelSearch / ...
```

Esto es el equivalente a las APIs de Sabre **antes** del MCP. Funciona, pero:
- No puede planificar workflows multi-paso
- No puede decidir dinámicamente qué tools usar
- No puede observar resultados y re-planificar
- Cada nuevo tipo de búsqueda requiere más código en el switch

---

## Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────┐
│                    CHAT UI (React)                       │
│              useMessageHandler.ts (simplificado)         │
└──────────────────────┬──────────────────────────────────┘
                       │ POST /v1/agent
                       ▼
┌─────────────────────────────────────────────────────────┐
│              PLANNER AGENT (Edge Function)               │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  TOOL REGISTRY                                   │    │
│  │  Cada tool = { name, description, inputSchema,  │    │
│  │                execute, outputSchema }            │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  AGENT LOOP                                      │    │
│  │                                                   │    │
│  │  1. PERCEIVE: User message + context + history   │    │
│  │  2. PLAN: LLM decides tools + sequence           │    │
│  │  3. ACT: Execute tool(s), parallel if possible   │    │
│  │  4. OBSERVE: Parse results, check completeness   │    │
│  │  5. DECIDE: Done? → respond. Need more? → loop   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  GUARDRAILS                                      │    │
│  │  - Max 5 iterations per request                  │    │
│  │  - Max 60s total execution time                  │    │
│  │  - No booking without human confirmation         │    │
│  │  - Minors-only validation                        │    │
│  │  - Budget/policy compliance                      │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐┌──────────────┐┌──────────────┐
│ search_flights││search_hotels ││ generate_    │  ... más tools
│ (starling)   ││ (eurovips)   ││ itinerary    │
└──────────────┘└──────────────┘└──────────────┘
```

---

## Plan de Implementación — 6 Pasos

### Paso 1: Tool Registry — Definición de Tools
**Archivo nuevo:** `api/src/agent/tools/registry.ts`

Crear un registry tipado donde cada tool existente se registra con:
- `name`: Identificador único (ej: `search_flights`)
- `description`: Descripción en lenguaje natural para el LLM
- `inputSchema`: JSON Schema de parámetros (derivado de los tipos existentes)
- `execute`: Función que ejecuta la lógica existente
- `outputSchema`: Descripción de qué devuelve

```typescript
// api/src/agent/tools/registry.ts

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute: (params: any, context: AgentContext) => Promise<ToolResult>;
}

const toolRegistry: Record<string, ToolDefinition> = {};

function registerTool(tool: ToolDefinition) {
  toolRegistry[tool.name] = tool;
}

function getToolsForLLM(): ToolDefinition[] {
  return Object.values(toolRegistry).map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}
```

**Tools a registrar (wrappers sobre lógica existente):**

| Tool Name | Wraps | Descripción para LLM |
|-----------|-------|----------------------|
| `search_flights` | `executeFlightSearch()` | Buscar vuelos disponibles entre dos ciudades |
| `search_hotels` | `executeHotelSearch()` | Buscar hoteles disponibles en una ciudad |
| `search_packages` | `executePackageSearch()` | Buscar paquetes turísticos |
| `search_services` | `executeServiceSearch()` | Buscar transfers y excursiones |
| `generate_itinerary` | `travel-itinerary` | Generar itinerario de viaje día por día |
| `resolve_city_code` | `cityCodeResolver` | Resolver nombre de ciudad a código IATA |
| `check_fare_rules` | Nuevo (parse de fare data) | Consultar reglas de tarifa de un vuelo |
| `get_context` | `loadContextState()` | Obtener contexto de búsqueda anterior |
| `ask_user` | Nuevo | Pedir información faltante al usuario |

**Archivos a crear:**
- `api/src/agent/tools/registry.ts` — Registry central
- `api/src/agent/tools/searchFlights.ts` — Tool wrapper
- `api/src/agent/tools/searchHotels.ts` — Tool wrapper
- `api/src/agent/tools/searchPackages.ts` — Tool wrapper
- `api/src/agent/tools/searchServices.ts` — Tool wrapper
- `api/src/agent/tools/generateItinerary.ts` — Tool wrapper
- `api/src/agent/tools/resolveCityCode.ts` — Tool wrapper
- `api/src/agent/tools/askUser.ts` — Tool para pedir info

Cada tool wrapper llama a la lógica existente en `searchExecutor.ts` — **no duplica lógica**.

---

### Paso 2: Agent Loop — El Orquestador
**Archivo nuevo:** `api/src/agent/agentLoop.ts`

Implementar el loop Perceive → Plan → Act → Observe → Decide:

```typescript
// api/src/agent/agentLoop.ts

interface AgentContext {
  userMessage: string;
  conversationHistory: Message[];
  previousContext: ContextState | null;
  tenantId: string;
  agencyId: string;
  turnNumber: number;
}

interface AgentStep {
  thought: string;
  toolCalls: Array<{ tool: string; params: any }>;
  observations: any[];
}

async function runAgentLoop(context: AgentContext): Promise<AgentResponse> {
  const tools = getToolsForLLM();
  const steps: AgentStep[] = [];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // 1. PLAN: LLM decides what to do
    const plan = await planNextAction(context, tools, steps);

    if (plan.action === 'respond') {
      return { response: plan.response, steps, context: updatedContext };
    }

    if (plan.action === 'ask_user') {
      return { response: plan.question, needsInput: true, steps };
    }

    // 2. ACT: Execute tool(s) — parallel if independent
    const results = await executeTools(plan.toolCalls);

    // 3. OBSERVE: Record results
    steps.push({
      thought: plan.thought,
      toolCalls: plan.toolCalls,
      observations: results,
    });

    // Update context with results for next iteration
    context = updateContext(context, results);
  }

  return { response: 'Límite de iteraciones alcanzado', steps };
}
```

**Archivos a crear:**
- `api/src/agent/agentLoop.ts` — Loop principal
- `api/src/agent/planner.ts` — LLM planning (prompt + OpenAI call)
- `api/src/agent/executor.ts` — Tool execution engine
- `api/src/agent/types.ts` — Tipos del agente

---

### Paso 3: Planner Prompt — El "Cerebro"
**Archivo nuevo:** `api/src/agent/planner.ts`

El planner es una llamada a OpenAI con **function calling** (tool_use). El system prompt incluye:

1. Las herramientas disponibles (del registry)
2. El contexto de la conversación
3. Reglas de dominio (fare rules, validaciones, restricciones)
4. Instrucciones de cuándo pedir info vs. asumir defaults

```typescript
// api/src/agent/planner.ts

async function planNextAction(
  context: AgentContext,
  tools: ToolDefinition[],
  previousSteps: AgentStep[]
): Promise<PlanResult> {

  const systemPrompt = buildPlannerPrompt(tools, context);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...formatConversationHistory(context),
      ...formatPreviousSteps(previousSteps),
      { role: 'user', content: context.userMessage },
    ],
    tools: tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      }
    })),
    tool_choice: 'auto',
  });

  return parsePlanResult(response);
}
```

**El prompt del planner reusa la lógica de `emilia-parser-v3`** para interpretación de mensajes, pero agrega la capa de planning y tool selection.

**Archivos a crear:**
- `api/src/agent/planner.ts` — LLM planner con function calling
- `api/src/agent/prompts/plannerSystem.ts` — System prompt del planner

---

### Paso 4: Ruta del Agente en API Gateway
**Archivo a editar:** `api/src/routes/v1/` (agregar nueva ruta)
**Archivo nuevo:** `api/src/routes/v1/agent.ts`

```typescript
// api/src/routes/v1/agent.ts

// POST /v1/agent
// Input: { message, conversation_id, context? }
// Output: { response, tool_calls_made, context_for_next, needs_input? }
```

Esta ruta:
1. Recibe el mensaje del usuario
2. Carga contexto de la conversación
3. Ejecuta `runAgentLoop()`
4. Devuelve respuesta + metadata de tools usados
5. Cachea en Redis (idempotencia)

**Archivos a crear:**
- `api/src/routes/v1/agent.ts` — Nueva ruta

**Archivos a editar:**
- `api/src/server.ts` — Registrar nueva ruta

---

### Paso 5: Integración con Frontend
**Archivo a editar:** `src/features/chat/hooks/useMessageHandler.ts`

El cambio principal en el frontend es **simplificar el switch gigante**. En vez de 1700 líneas de routing manual, el handler llama al agente:

```typescript
// En useMessageHandler.ts — el nuevo flujo (modo planner)

if (workspaceMode === 'planner') {
  // Nuevo flujo agéntico
  const agentResponse = await fetch('/v1/agent', {
    method: 'POST',
    body: JSON.stringify({
      message: currentMessage,
      conversation_id: selectedConversation,
      context: persistentState,
    }),
  });

  // El agente ya hizo todo: parseó, buscó, filtró, formateó
  assistantResponse = agentResponse.response;
  structuredData = agentResponse.data;
} else {
  // Flujo legacy (switch existente) — sin cambios
  switch (parsedRequest.requestType) { ... }
}
```

**Estrategia**: Feature flag usando `conversation_workspace_mode` que ya existe en la DB (`'standard'` | `'planner'`). El modo `planner` usa el agente, el modo `standard` mantiene el flujo actual.

**Archivos a editar:**
- `src/features/chat/hooks/useMessageHandler.ts` — Agregar branch para modo planner

---

### Paso 6: Guardrails y Observabilidad
**Archivo nuevo:** `api/src/agent/guardrails.ts`

Reglas server-side que el agente NO puede bypassear:

```typescript
const GUARDRAILS = {
  maxIterations: 5,           // Max loops por request
  maxExecutionTimeMs: 60000,  // 60 segundos total
  maxToolCallsPerIteration: 3, // Max tools en paralelo
  requireHumanConfirmation: [  // Tools que requieren confirmación
    'create_booking',
    'process_payment',
    'cancel_booking',
  ],
  blockedPatterns: [           // Nunca ejecutar
    'minors_only_flight',
  ],
};
```

**Archivos a crear:**
- `api/src/agent/guardrails.ts` — Reglas de seguridad

---

## Estructura de Archivos Final

```
api/src/agent/
├── types.ts              # AgentContext, AgentStep, ToolResult, etc.
├── agentLoop.ts          # Loop principal (perceive→plan→act→observe)
├── planner.ts            # LLM planning con function calling
├── executor.ts           # Ejecuta tools del registry
├── guardrails.ts         # Límites y validaciones server-side
├── prompts/
│   └── plannerSystem.ts  # System prompt del planner
└── tools/
    ├── registry.ts       # Tool registry + discovery
    ├── searchFlights.ts  # Wrapper → executeFlightSearch
    ├── searchHotels.ts   # Wrapper → executeHotelSearch
    ├── searchPackages.ts # Wrapper → executePackageSearch
    ├── searchServices.ts # Wrapper → executeServiceSearch
    ├── generateItinerary.ts # Wrapper → travel-itinerary
    ├── resolveCityCode.ts   # Wrapper → cityCodeResolver
    └── askUser.ts        # Pedir info al usuario
```

**Archivos existentes a editar:**
- `api/src/server.ts` — Registrar ruta `/v1/agent`
- `src/features/chat/hooks/useMessageHandler.ts` — Branch para modo planner

---

## Ejemplo de Flujo Completo

**Usuario:** "Quiero ir a ver el Barça-Real Madrid el 26 de octubre, vuelo desde Buenos Aires, hotel cerca del Camp Nou, all inclusive"

**Agent Loop:**

```
ITERATION 1:
  Thought: "Necesito buscar vuelos EZE→BCN y hoteles en Barcelona
            cerca del Camp Nou con all inclusive"
  Tool calls:
    - search_flights({ origin: "EZE", destination: "BCN",
                       departureDate: "2026-10-25", returnDate: "2026-10-28",
                       adults: 1 })
    - search_hotels({ city: "Barcelona", checkinDate: "2026-10-25",
                      checkoutDate: "2026-10-28", adults: 1,
                      mealPlan: "all_inclusive" })

  Observations:
    - flights: 4 resultados (AR, IB, AF, LH)
    - hotels: 0 resultados con all inclusive en Barcelona centro

ITERATION 2:
  Thought: "No hay all inclusive en Barcelona centro
            (es más común en resorts). Debo informar al usuario
            y sugerir alternativa: media pensión o solo desayuno"
  Action: respond
  Response: "Encontré 4 opciones de vuelo EZE→BCN.
             Para hoteles, Barcelona centro no suele ofrecer
             all inclusive. ¿Preferís media pensión o solo desayuno?
             Te muestro los vuelos mientras tanto:
             1. Iberia directo — USD 1,240
             2. Air France vía CDG — USD 980
             ..."
```

**Esto es lo que el switch actual NO puede hacer**: el agente observó que no hay resultados de hotel, razonó por qué (domain knowledge), y adaptó la respuesta — todo en el mismo request.

---

## Principios de Diseño

1. **No duplicar lógica** — Los tools son wrappers finos sobre `searchExecutor.ts`
2. **Feature flag** — `workspace_mode: 'planner'` activa el agente; `'standard'` mantiene el flujo actual
3. **Incremental** — Se puede lanzar solo con `search_flights` + `search_hotels` e ir agregando tools
4. **Model-agnostic** — El planner usa OpenAI hoy pero la interfaz es abstracta
5. **Observable** — Cada step del loop se logguea con correlation_id para debugging

---

## Dependencias

- OpenAI API (ya configurada para `ai-message-parser`)
- Redis (ya configurado para caching)
- Supabase Edge Functions (ya deployadas)
- No se requieren nuevas dependencias npm

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Latencia del agent loop (múltiples LLM calls) | gpt-4o-mini para planning, cache agresivo |
| LLM toma decisiones incorrectas | Guardrails server-side + human confirmation para booking |
| Costo de API (más calls a OpenAI) | Limitar a 5 iteraciones, usar modelo mini |
| Regresión en flujo existente | Feature flag, modo standard intacto |
