# Plan: NLP Planner Agent — Arquitectura Agéntica para WholeSale Connect

## Objetivo
Replicar el patrón de Sabre (MCP Server + Agentic APIs + Agent Loop) adaptado a WholeSale Connect, transformando el flujo lineal actual en un **agente autónomo con loop iterativo, tool discovery, y orquestación inteligente**.

---

## Corrección de Arquitectura — Por qué NO va en `api/`

El frontend **NUNCA** llama al API Gateway (`api/`). Todo va directo a Supabase Edge Functions:

```
Frontend (React)
  └─ supabase.functions.invoke('starling-flights')   ← directo
  └─ supabase.functions.invoke('eurovips-soap')       ← directo
  └─ supabase.functions.invoke('ai-message-parser')   ← directo
  └─ supabase.functions.invoke('travel-itinerary')    ← directo

API Gateway (api/) ← solo para consumidores externos, el frontend NO lo usa
```

**El agente debe ser una Edge Function** (`supabase/functions/planner-agent/`), no código en `api/`. Así sigue el mismo patrón que el resto del sistema.

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
| Iteration Detection | `iterationDetection.ts` (frontend) | ✅ Funciona (regex patterns) |
| Context Persistence | `contextState.ts` + system messages | ✅ Funciona |
| City Code Resolution | `_shared/cityCodeResolver.ts` | ✅ Funciona |
| Advanced Filters | `_shared/advancedFilters.ts` | ✅ Funciona |
| Response Formatters | `responseFormatters.ts` | ✅ Funciona |
| Trip Planner UI | `src/features/trip-planner/` | ✅ Funciona |
| Workspace Mode | `conversation_workspace_mode: 'standard' \| 'planner'` | ✅ Existe en DB |

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

## Arquitectura Propuesta (Corregida)

```
┌─────────────────────────────────────────────────────────┐
│                    CHAT UI (React)                       │
│              useMessageHandler.ts                        │
│                                                          │
│  workspace_mode === 'planner'                            │
│    → supabase.functions.invoke('planner-agent')          │
│  workspace_mode === 'standard'                           │
│    → switch existente (sin cambios)                      │
└──────────────────────┬──────────────────────────────────┘
                       │ supabase.functions.invoke
                       ▼
┌─────────────────────────────────────────────────────────┐
│        PLANNER AGENT (Supabase Edge Function)            │
│        supabase/functions/planner-agent/                 │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  TOOL REGISTRY                                   │    │
│  │  Cada tool = { name, description, inputSchema,  │    │
│  │                execute }                          │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  AGENT LOOP                                      │    │
│  │                                                   │    │
│  │  1. PERCEIVE: User message + context + history   │    │
│  │  2. PLAN: LLM decides tools + sequence           │    │
│  │  3. ACT: Execute tool(s) via other Edge Fns      │    │
│  │  4. OBSERVE: Parse results, check completeness   │    │
│  │  5. DECIDE: Done? → respond. Need more? → loop   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  GUARDRAILS                                      │    │
│  │  - Max 5 iterations per request                  │    │
│  │  - Max 55s execution (Edge Fn limit ~60s)        │    │
│  │  - No booking without human confirmation         │    │
│  │  - Minors-only validation                        │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────┘
                       │ supabase.functions.invoke (server-to-server)
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐┌──────────────┐┌──────────────┐
│starling-     ││eurovips-     ││travel-       │
│flights       ││soap          ││itinerary     │
│(Edge Fn)     ││(Edge Fn)     ││(Edge Fn)     │
└──────────────┘└──────────────┘└──────────────┘
```

### Por qué Edge Function y no API Gateway

| Criterio | Edge Function | API Gateway (`api/`) |
|----------|:---:|:---:|
| Frontend ya lo consume | ✅ `supabase.functions.invoke()` | ❌ Nunca lo llama |
| Puede llamar otras Edge Fns | ✅ Server-to-server con service key | ⚠️ Puede, pero indirecto |
| Auth/RLS integrado | ✅ JWT + `withRateLimit()` | ❌ Tiene su propio auth (API keys) |
| Patrón consistente | ✅ Mismo patrón que ai-message-parser | ❌ Stack diferente (Fastify) |
| Shared utilities | ✅ `_shared/` ya tiene todo | ❌ Tiene copias propias |
| Deploy | ✅ `supabase functions deploy` | ❌ Railway (separado) |
| Caching | ✅ `_shared/cache.ts` (soft/hard TTL) | ✅ Redis |
| Rate limiting | ✅ `_shared/rateLimit.ts` (DB-based) | ✅ Redis-based |

---

## Plan de Implementación — 5 Pasos

### Paso 1: Edge Function `planner-agent` — Estructura Base
**Archivos nuevos en:** `supabase/functions/planner-agent/`

Siguiendo el patrón exacto de las Edge Functions existentes (`ai-message-parser`, `travel-itinerary`):

```typescript
// supabase/functions/planner-agent/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rateLimit.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { runAgentLoop } from './agentLoop.ts';
import { buildToolRegistry } from './tools/registry.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  return await withRateLimit(req, supabase,
    { action: 'api_call', resource: 'planner-agent' },
    async () => {
      const body = await req.json();
      const { message, conversation_id, context, conversationHistory, plannerState } = body;

      // Build tool registry with supabase client for Edge Fn calls
      const tools = buildToolRegistry(supabase);

      // Run agent loop
      const result = await runAgentLoop({
        userMessage: message,
        conversationHistory: conversationHistory || [],
        previousContext: context || null,
        plannerState: plannerState || null,
        tools,
      });

      return new Response(JSON.stringify({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  );
});
```

**Archivos a crear:**
```
supabase/functions/planner-agent/
├── index.ts              # Entry point (CORS + rate limit + serve)
├── agentLoop.ts          # Loop: perceive → plan → act → observe → decide
├── planner.ts            # LLM planning con OpenAI function calling
├── guardrails.ts         # Límites y validaciones
├── types.ts              # AgentContext, AgentStep, ToolResult, PlanResult
├── prompts/
│   └── system.ts         # System prompt del planner
└── tools/
    ├── registry.ts       # Tool registry + getToolsForLLM()
    ├── searchFlights.ts  # Wrapper → supabase.functions.invoke('starling-flights')
    ├── searchHotels.ts   # Wrapper → supabase.functions.invoke('eurovips-soap')
    ├── searchPackages.ts # Wrapper → supabase.functions.invoke('eurovips-soap')
    ├── generateItinerary.ts  # Wrapper → supabase.functions.invoke('travel-itinerary')
    ├── resolveCityCode.ts    # Wrapper → _shared/cityCodeResolver
    └── askUser.ts        # Retorna señal para pedir info
```

---

### Paso 2: Tool Registry — Wrappers sobre Edge Functions existentes

Cada tool wrapper llama a Edge Functions existentes via `supabase.functions.invoke()` — **no duplica lógica**:

```typescript
// supabase/functions/planner-agent/tools/registry.ts

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export function buildToolRegistry(supabase: SupabaseClient): ToolDefinition[] {
  return [
    buildSearchFlightsTool(supabase),
    buildSearchHotelsTool(supabase),
    buildSearchPackagesTool(supabase),
    buildGenerateItineraryTool(supabase),
    buildResolveCityCodeTool(),
    buildAskUserTool(),
  ];
}

export function getToolsForLLM(tools: ToolDefinition[]) {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}
```

```typescript
// supabase/functions/planner-agent/tools/searchFlights.ts

export function buildSearchFlightsTool(supabase: SupabaseClient): ToolDefinition {
  return {
    name: 'search_flights',
    description: 'Busca vuelos disponibles entre dos ciudades. Devuelve los 5 vuelos más baratos con precios, aerolíneas, escalas y duración. Usa códigos IATA (EZE, BCN, JFK) o nombres de ciudad.',
    inputSchema: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: 'Ciudad o código IATA de origen (ej: "Buenos Aires" o "EZE")' },
        destination: { type: 'string', description: 'Ciudad o código IATA de destino' },
        departureDate: { type: 'string', description: 'Fecha de salida YYYY-MM-DD' },
        returnDate: { type: 'string', description: 'Fecha de regreso YYYY-MM-DD (null para one-way)' },
        adults: { type: 'number', description: 'Cantidad de adultos (default 1)' },
        children: { type: 'number', description: 'Cantidad de niños' },
        infants: { type: 'number', description: 'Cantidad de bebés' },
        stops: { type: 'string', enum: ['direct', 'one_stop', 'any'], description: 'Preferencia de escalas' },
        luggage: { type: 'string', enum: ['carry_on', 'checked', 'both', 'none'] },
        preferredAirline: { type: 'string', description: 'Código IATA de aerolínea preferida' },
      },
      required: ['origin', 'destination', 'departureDate', 'adults'],
    },
    execute: async (params) => {
      // Llama a la MISMA Edge Function que ya usa searchHandlers.ts
      const { data, error } = await supabase.functions.invoke('starling-flights', {
        body: {
          action: 'searchFlights',
          data: formatParamsForStarling(params),
        },
      });
      if (error) return { success: false, error: error.message };
      return { success: true, flights: data?.data?.fares || [], count: data?.data?.fares?.length || 0 };
    },
  };
}
```

**Lo mismo para cada tool** — wrappers finos que llaman Edge Functions existentes.

**Tools a registrar:**

| Tool Name | Llama a | Descripción para LLM |
|-----------|---------|----------------------|
| `search_flights` | `starling-flights` | Buscar vuelos entre dos ciudades |
| `search_hotels` | `eurovips-soap` | Buscar hoteles en una ciudad |
| `search_packages` | `eurovips-soap` | Buscar paquetes turísticos |
| `generate_itinerary` | `travel-itinerary` | Generar itinerario día por día |
| `resolve_city_code` | `_shared/cityCodeResolver` | Resolver nombre de ciudad a código IATA |
| `ask_user` | — (señal) | Pedir información faltante al usuario |

---

### Paso 3: Agent Loop + Planner (LLM con function calling)

```typescript
// supabase/functions/planner-agent/agentLoop.ts

import { GUARDRAILS } from './guardrails.ts';
import { planNextAction } from './planner.ts';
import type { AgentContext, AgentStep, AgentResponse, ToolDefinition } from './types.ts';

export async function runAgentLoop(context: AgentContext): Promise<AgentResponse> {
  const steps: AgentStep[] = [];
  const startTime = Date.now();

  for (let iteration = 0; iteration < GUARDRAILS.maxIterations; iteration++) {
    // Timeout check (Edge Functions tienen ~60s límite)
    if (Date.now() - startTime > GUARDRAILS.maxExecutionTimeMs) {
      return { response: 'Se agotó el tiempo de procesamiento.', steps, timedOut: true };
    }

    // 1. PLAN: LLM decides what to do next
    const plan = await planNextAction(context, steps);

    // 2. If done, respond to user
    if (plan.action === 'respond') {
      return {
        response: plan.response,
        steps,
        structuredData: plan.structuredData || null,
        contextForNext: buildContextForNext(context, steps),
      };
    }

    // 3. If needs user input, signal frontend
    if (plan.action === 'ask_user') {
      return {
        response: plan.question,
        needsInput: true,
        missingFields: plan.missingFields,
        steps,
      };
    }

    // 4. ACT: Execute tool(s) — parallel if independent
    const results = await Promise.all(
      plan.toolCalls.map(async (call) => {
        const tool = context.tools.find(t => t.name === call.tool);
        if (!tool) return { tool: call.tool, error: `Tool "${call.tool}" not found` };
        try {
          return { tool: call.tool, result: await tool.execute(call.params) };
        } catch (err) {
          return { tool: call.tool, error: err.message };
        }
      })
    );

    // 5. OBSERVE: Record for next iteration
    steps.push({
      thought: plan.thought,
      toolCalls: plan.toolCalls,
      observations: results,
    });
  }

  return { response: 'Se alcanzó el límite de iteraciones.', steps };
}
```

```typescript
// supabase/functions/planner-agent/planner.ts

import { getToolsForLLM } from './tools/registry.ts';
import { SYSTEM_PROMPT } from './prompts/system.ts';
import type { AgentContext, AgentStep, PlanResult } from './types.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

export async function planNextAction(
  context: AgentContext,
  previousSteps: AgentStep[]
): Promise<PlanResult> {
  const toolDefs = getToolsForLLM(context.tools);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    // Conversation history (last 10 messages)
    ...context.conversationHistory.slice(-10).map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content.text,
    })),
    // Previous agent steps (so LLM knows what already happened)
    ...previousSteps.flatMap(step => [
      { role: 'assistant', content: step.thought, tool_calls: step.toolCalls },
      { role: 'tool', content: JSON.stringify(step.observations) },
    ]),
    // Current user message
    { role: 'user', content: context.userMessage },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',  // Best balance of function calling quality, speed, and cost for agentic loops
      messages,
      tools: toolDefs,
      tool_choice: 'auto',
      temperature: 0.1,
      max_tokens: 1500,
    }),
  });

  const data = await response.json();
  return parsePlanResult(data);
}
```

---

### Paso 4: Integración con Frontend
**Archivo a editar:** `src/features/chat/hooks/useMessageHandler.ts`

El cambio es un branch condicional que intercepta ANTES del switch (línea ~1245), solo cuando `workspace_mode === 'planner'`:

```typescript
// En handleSendMessage, ANTES del switch actual (línea ~1240)

if (isPlannerMode) {
  // Nuevo flujo agéntico — llama a la Edge Function
  setTypingMessage('El agente está planificando...', finalConversationId);

  const { data: agentResult, error: agentError } = await supabase.functions.invoke('planner-agent', {
    body: {
      message: currentMessage,
      conversation_id: finalConversationId,
      context: persistentState,
      conversationHistory: conversationHistoryForAI,
      plannerState: plannerState || null,
    },
  });

  if (agentError) throw agentError;

  assistantResponse = agentResult.response;
  structuredData = agentResult.structuredData;

  // Si el agente generó plannerData, persistir
  if (agentResult.structuredData?.plannerData && persistPlannerState) {
    await persistPlannerState(agentResult.structuredData.plannerData, 'chat');
  }
} else {
  // Flujo legacy (switch existente) — SIN CAMBIOS
  switch (parsedRequest.requestType) {
    case 'flights': ...
    case 'hotels': ...
    // ... todo igual
  }
}
```

**Cómo se determina `isPlannerMode`:**
- `ChatFeature.tsx` ya calcula `workspaceMode` (línea 145-151)
- Se pasa como prop a `useMessageHandler` (nuevo parámetro)
- La conversación ya tiene `workspace_mode: 'planner'` en la DB

**Archivos a editar:**
- `src/features/chat/hooks/useMessageHandler.ts` — Agregar branch condicional (~20 líneas)
- `src/features/chat/ChatFeature.tsx` — Pasar `workspaceMode` como prop al hook

---

### Paso 5: Guardrails

```typescript
// supabase/functions/planner-agent/guardrails.ts

export const GUARDRAILS = {
  maxIterations: 5,           // Max loops por request
  maxExecutionTimeMs: 55000,  // 55s (Edge Fn limit ~60s)
  maxToolCallsPerIteration: 3, // Max tools en paralelo
  requireHumanConfirmation: [  // Tools que requieren confirmación
    'create_booking',
    'process_payment',
  ],
  blockedPatterns: [           // Nunca ejecutar
    'minors_only_flight',      // Sin adultos = rechazar
  ],
};
```

---

## Estructura de Archivos Final

### Archivos NUEVOS (todos en Edge Functions)
```
supabase/functions/planner-agent/
├── index.ts              # Entry point (serve + CORS + rate limit)
├── agentLoop.ts          # Loop principal (perceive→plan→act→observe)
├── planner.ts            # LLM planning con OpenAI function calling
├── guardrails.ts         # Límites y validaciones
├── types.ts              # AgentContext, AgentStep, ToolResult, PlanResult
├── prompts/
│   └── system.ts         # System prompt del planner
└── tools/
    ├── registry.ts       # buildToolRegistry() + getToolsForLLM()
    ├── searchFlights.ts  # → supabase.functions.invoke('starling-flights')
    ├── searchHotels.ts   # → supabase.functions.invoke('eurovips-soap')
    ├── searchPackages.ts # → supabase.functions.invoke('eurovips-soap')
    ├── generateItinerary.ts  # → supabase.functions.invoke('travel-itinerary')
    ├── resolveCityCode.ts    # → _shared/cityCodeResolver
    └── askUser.ts        # Señal para pedir info al usuario
```

**Total: 13 archivos nuevos** — todos aislados en una nueva Edge Function.

### Archivos EXISTENTES a editar (2 archivos, cambios mínimos)

| Archivo | Cambio | Líneas afectadas |
|---------|--------|-----------------|
| `src/features/chat/hooks/useMessageHandler.ts` | Branch `if (isPlannerMode)` antes del switch | ~20 líneas nuevas, 0 líneas modificadas |
| `src/features/chat/ChatFeature.tsx` | Pasar `workspaceMode` como prop al hook | ~3 líneas |

### Archivos que NO se modifican (consumidos server-to-server)

| Edge Function | Cómo la consume el agente |
|---------------|--------------------------|
| `starling-flights` | `supabase.functions.invoke()` desde `searchFlights.ts` |
| `eurovips-soap` | `supabase.functions.invoke()` desde `searchHotels.ts` |
| `travel-itinerary` | `supabase.functions.invoke()` desde `generateItinerary.ts` |
| `ai-message-parser` | **No se usa** — el planner LLM hace NLU directo |
| `_shared/cityCodeResolver.ts` | Import directo desde `resolveCityCode.ts` |
| `_shared/rateLimit.ts` | Import en `index.ts` (patrón estándar) |
| `_shared/cors.ts` | Import en `index.ts` (patrón estándar) |

---

## Diagrama de Impacto Real

```
ARCHIVOS EDITADOS (2)              ARCHIVOS NUEVOS (13)
═════════════════════              ═════════════════════

useMessageHandler.ts ──────┐
  (+20 líneas: if branch)  │
                            │      supabase/functions/planner-agent/
ChatFeature.tsx ───────────┤      ├── index.ts ←── entry point
  (+3 líneas: prop)        │      ├── agentLoop.ts
                            │      ├── planner.ts ──→ OpenAI API
                            │      ├── guardrails.ts
                            └────→ ├── types.ts
                                   ├── prompts/system.ts
                                   └── tools/
                                       ├── registry.ts
                                       ├── searchFlights.ts ──→ starling-flights (Edge Fn)
                                       ├── searchHotels.ts ───→ eurovips-soap (Edge Fn)
                                       ├── searchPackages.ts ─→ eurovips-soap (Edge Fn)
                                       ├── generateItinerary.ts → travel-itinerary (Edge Fn)
                                       ├── resolveCityCode.ts ─→ _shared/cityCodeResolver
                                       └── askUser.ts

                              EDGE FUNCTIONS EXISTENTES (read-only, no se tocan)
                              ═════════════════════════════════════════════════
                              starling-flights/    ← consumida por searchFlights tool
                              eurovips-soap/       ← consumida por searchHotels tool
                              travel-itinerary/    ← consumida por generateItinerary tool
                              ai-message-parser/   ← NO se usa (planner tiene NLU propio)
                              _shared/             ← imports directos (cors, rateLimit, cityCode)
```

---

## Flujo Completo Corregido

```
MODO PLANNER (workspace_mode === 'planner')
════════════════════════════════════════════

User: "Quiero ir a ver el Barça-Real Madrid, vuelo desde Buenos Aires,
       hotel cerca del Camp Nou, all inclusive"
  │
  ▼
useMessageHandler.ts
  │ isPlannerMode === true
  │
  ▼
supabase.functions.invoke('planner-agent', {
  message, context, conversationHistory, plannerState
})
  │
  ▼
┌─────────────────────────────────────────────┐
│ PLANNER-AGENT (Edge Function)               │
│                                              │
│ ITERATION 1:                                 │
│   Thought: "Necesito vuelos EZE→BCN          │
│             y hoteles Barcelona all inclusive"│
│   Tool calls (parallel):                     │
│     → search_flights → starling-flights EF   │
│     → search_hotels  → eurovips-soap EF      │
│                                              │
│   Observations:                              │
│     flights: 4 resultados ✅                  │
│     hotels: 0 resultados con AI ❌            │
│                                              │
│ ITERATION 2:                                 │
│   Thought: "No hay AI en BCN centro.         │
│     Puedo: sugerir media pensión, o buscar   │
│     resorts en Costa Brava con AI"           │
│   Action: respond                            │
│   Response: "Encontré 4 vuelos EZE→BCN.      │
│     Barcelona centro no ofrece all inclusive. │
│     ¿Preferís media pensión o busco resorts  │
│     en la Costa Brava con all inclusive?"     │
│     1. Iberia directo — USD 1,240            │
│     2. Air France vía CDG — USD 980 ..."     │
└─────────────────────────────────────────────┘
  │
  ▼
Frontend recibe respuesta + structuredData
  → Muestra en chat
  → Persiste plannerState si existe
  → Guarda contextState para next iteration


MODO STANDARD (workspace_mode === 'standard')
═════════════════════════════════════════════
  │
  ▼
Switch existente — SIN CAMBIOS
  case 'flights': handleFlightSearch(...)
  case 'hotels': handleHotelSearch(...)
  case 'combined': handleCombinedSearch(...)
  ...
```

---

## Puntos de Intercepción en el Frontend

El agente intercepta en 4 puntos del ciclo de vida del planner:

| Punto | Ubicación | Cuándo | Qué hace el agente |
|-------|-----------|--------|-------------------|
| **A** | `useMessageHandler:1168` | Mensaje parseado como itinerary | Puede enriquecer el ParsedTravelRequest |
| **B** | `useMessageHandler:1313` | Pre-generación (draft_generating) | Puede modificar params antes de Edge Fn |
| **C** | `useMessageHandler:1349` | Post-generación (persistPlannerState) | Puede modificar plannerData antes de guardar |
| **D** | `useTripPlanner` mutations | User edita segmentos/días | Puede sugerir mejoras post-edit |

Con el agente, **los 4 puntos se unifican en un solo flujo**: el agent loop decide internamente qué hacer en cada paso, sin necesidad de hooks separados.

---

## Resumen de Riesgo

| Componente | Archivos tocados | Riesgo | Razón |
|-----------|-----------------|--------|-------|
| **Edge Function nueva** | 13 archivos nuevos | **Nulo** | Aislada, no modifica nada existente |
| **Frontend branch** | `useMessageHandler.ts` (+20 ln) | **Bajo** | `if/else` alrededor del switch, no modifica código interno |
| **ChatFeature prop** | `ChatFeature.tsx` (+3 ln) | **Bajo** | Solo pasa un prop existente |
| **Edge Functions existentes** | Ninguno | **Nulo** | Se consumen server-to-server |
| **Database** | Ninguno | **Nulo** | Usa `workspace_mode` que ya existe |
| **_shared utilities** | Ninguno | **Nulo** | Se importan, no se editan |

**Blast radius total**: 2 archivos existentes con cambios mínimos (~23 líneas) + 13 archivos nuevos aislados en una Edge Function nueva.

---

## Dependencias

- OpenAI API key (ya configurada como env var en Edge Functions: `OPENAI_API_KEY`)
- Supabase service role key (ya disponible en Edge Functions)
- `_shared/rateLimit.ts`, `_shared/cors.ts`, `_shared/cityCodeResolver.ts` (ya existen)
- **No se requieren nuevas dependencias** — todo usa Deno imports + shared utilities

## Deploy

```bash
supabase functions deploy planner-agent
```

Un solo comando. No afecta ninguna otra Edge Function ni el frontend existente.
