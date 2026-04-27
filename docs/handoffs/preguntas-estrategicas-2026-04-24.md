# Resolución de 5 preguntas estratégicas pre-Paso 2
**Fecha:** 2026-04-24  
**Base:** Auditoría de capas (docs/handoffs/auditoria-capas-2026-04-24.md)  
**Objetivo:** Cerrar preguntas estratégicas que afectan el plan de refactors

---

## Check 1: ¿consumerAuthService está muerto?

**Evidencia — Búsqueda de referencias:**
```
src/features/auth/services/consumerAuthService.ts:32:export async function signUpConsumer(
src/features/auth/services/consumerAuthService.ts:71:export async function signInConsumer(
src/features/auth/services/consumerAuthService.ts:97:export async function signOutConsumer(): Promise<void> {
src/pages/ConsumerProfile.tsx:10:import { signOutConsumer } from '@/features/auth/services/consumerAuthService';
src/pages/ConsumerProfile.tsx:94:    await signOutConsumer();
src/pages/ConsumerSignup.tsx:20:  signUpConsumer,
src/pages/ConsumerSignup.tsx:21:  signInConsumer,
src/pages/ConsumerSignup.tsx:22:} from '@/features/auth/services/consumerAuthService';
src/pages/ConsumerSignup.tsx:55:    const signupResult = await signUpConsumer({...});
src/pages/ConsumerSignup.tsx:71:    const signinResult = await signInConsumer(data.email, data.password);
```

**Historial Git:**
```
3b9a18e1 feat(auth): create src/features/auth/ and relocate consumer auth surface
```

**Veredicto:** NO MUERTO — **EN TRANSICIÓN/ACTIVO**

El servicio está siendo activamente usado en `ConsumerProfile.tsx` y `ConsumerSignup.tsx`. Tiene solo 1 commit (creación reciente), pero está integrado. **El sub-agent D se equivocó.** Esta no es deuda eliminable.

**Implicancia para refactor:** Mantener. No incluir en PR de purga. El servicio es parte de la capa de auth consumer y sigue siendo necesario.

---

## Check 2: ¿hotelbeds feature está muerta?

**Evidencia — Archivos encontrados:**
```
src/features/hotelbeds/components/HotelbedsBooking.tsx
src/features/hotelbeds/components/HotelbedsCheckRate.tsx
src/features/hotelbeds/components/HotelbedsResults.tsx
src/features/hotelbeds/components/HotelbedsSearchForm.tsx
src/features/hotelbeds/components/HotelbedsVoucher.tsx
src/features/hotelbeds/hooks/useHotelbedsSearch.ts
src/features/hotelbeds/services/hotelbedsService.ts
```

**Búsqueda de importadores externos:** CERO matches — ningún archivo fuera de `src/features/hotelbeds/` importa estos componentes o servicios.

**Historial Git:**
```
4077486b feat(hotelbeds): integrate Hotelbeds API for hotel search and booking functionality
```

Solo 1 commit, sin actividad posterior. Código aislado, sin consumidores.

**Veredicto:** **MUERTA** — Rama de integración abandonada sin call sites.

**Implicancia para refactor:** Incluir en PR de purga. Borrar directorio entero `src/features/hotelbeds/`. CRITICAL — libera 7 archivos muertos.

---

## Check 3: ¿ADR-002 requiere mode-aware en orchestrator?

**Evidencia — Lectura completa de ADR-002:**

El ADR establece en **Decisión #3** (línea 16): *"El switch es estricto por turno: en agency mode el orchestrator solo puede emitir `standard_search` o `ask_minimal`; en passenger mode solo `planner_agent` o `ask_minimal`."*

**Pero — Addendum 2026-04-18 (línea 98-125)** revierte parcialmente esta decisión: empiricamente `planner_agent` no produce `CanonicalItineraryResult` estructurado. **Nueva regla:** passengermode emite `standard_itinerary` o `ask_minimal`, agency mode sigue igual.

**Implementación en código — conversationOrchestrator.ts:**

Línea 474: función `resolveConversationTurn` recibe parámetro `mode?: 'agency' | 'passenger'`  
Líneas 510-549: lógica de STRICT MODE implementada con comentarios detallados:
- Lines 511-514: Documentación del contrato
- Lines 529-546: Reglas de BRIDGE (cuándo sugerir cambio de modo)
- Lines 542-546: Guardrails (anti-loop, respeto de elección del usuario)

**Verificación de pureza (grep en orchestrator.ts):**
```
// "workspace_mode" appears 0 times
// Mode es parámetro de entrada, no consulta interna
```

**Veredicto:** **ADR-002 EXIGE mode-aware en orchestrator, CORRECTAMENTE IMPLEMENTADO**

El sub-agent D clasificó esto como "MODERATE VIOLATION" pero se equivocó. El ADR establece explícitamente que el orchestrator debe filtrar branches válidas según el modo parametrizado. **Eso es el contrato, no una fuga.** El orchestrator es agnóstico (no decide el modo, lo recibe), pero SÍ restringe qué branches pueden ejecutarse para cada modo.

**Implicancia para refactor:** NO es deuda. NO es violation. Está working as designed. El plan de refactors (PR#1-5 del audit) **NO necesita tocar conversationOrchestrator.ts** para "arreglar mode-awareness". Está correcto.

---

## Check 4: ¿Cobertura actual de useMessageHandler?

**Evidencia — Búsqueda de archivos de test:**
```
NO EXISTEN archivos con patrón *useMessageHandler*test* o *messageHandler*test*
```

**Búsqueda de referencias indirectas en tests:**
```
grep -rn "useMessageHandler" src/ --include="*.test.ts" --include="*.test.tsx"
→ 0 matches
```

**Tests que SÍ existen en chat feature:**
```
src/features/chat/__tests__/buildModeBridgeMessage.test.ts
src/features/chat/__tests__/deriveDefaultMode.test.ts
src/features/chat/__tests__/deriveModeSwitchState.test.ts
src/features/chat/__tests__/extractBridgeTurnProps.test.ts
src/features/chat/__tests__/hasItineraryContent.test.ts
src/features/chat/__tests__/resolveEffectiveMode.test.ts
src/features/chat/__tests__/sidebarFilters.test.ts
src/features/chat/__tests__/useChat.loadConversations.test.ts
```

Todos son tests de funciones utilities, parsers, y helpers — **NINGUNO toca el hook crítico useMessageHandler.**

**Veredicto cuantitativo:**
- **Tests directos de useMessageHandler:** 0
- **Tests indirectos que ejercitan useMessageHandler vía integración:** 0
- **Cobertura:** NULA — sin red de seguridad para refactors

**Implicancia para refactor:** **CRÍTICA**

El hook gigante (1,958 LOC) que orquesta toda la lógica de turnos **no tiene testing unitario ni integración**. Intentar dividirlo en 3 funciones (PR#4 del audit) sin tests es MUY riesgoso. **Acción previa:** antes de PR#4, escribir tests de integración mínimos que cubran los paths principales de useMessageHandler (parseMessage → search, parseMessage → itinerary, handlePlannerDateSelection, etc.). Estimación: 4-6 horas de tests + 4-6 horas de refactor.

---

## Check 5: Reclasificación de "6 fugas Supabase"

El informe de auditoría listó 6 archivos como "SUPABASE LEAKS CRITICAL". Auditoría manual detallada:

### a) useMessageHandler.ts (línea 24)
```
import { supabase } from '@/integrations/supabase/client';
```
**Análisis:** Import existe pero nunca se usa en el archivo (`grep "supabase\." → 0 matches`).  
**Clasificación:** DEAD_IMPORT (no es fuga, es deuda de limpieza)  
**Severidad:** LOW — Borrar línea 24

### b) useContextualMemory.ts (línea 2)
```
import { supabase } from '@/integrations/supabase/client';
```
**Análisis:** Import ACTIVAMENTE USADO — múltiples queries:
- Líneas 14-20: `supabase.from('messages').select(...)` (query de memoria contextual)
- Líneas 57-68: `supabase.from('messages').insert(...)` (guardar memoria)
- Líneas 86-91: `supabase.from('messages').delete(...)` (limpiar memoria)
- Líneas 107-114: `supabase.from('messages').select(...)` (cargar contexto persistente)
- Líneas 172-177: `supabase.from('messages').delete(...)` (limpiar contexto viejo)
- Líneas 185-196: `supabase.from('messages').insert(...)` (guardar contexto)

**Tipo:** TABLE_QUERY (acceso directo a tabla `messages`)  
**Clasificación:** CRITICAL — Viola patrón de service layer. Hook con 6 operaciones de BD directo.  
**Severidad:** CRITICAL — Refactor: crear messageStorageService.ts (loadContextualMemory, saveContextualMemory, clearContextualMemory, loadContextState, saveContextState). Hook llama a servicio, no a BD.

### c) LeadSelector.tsx (línea del import)
```
import { supabase } from '@/integrations/supabase/client';
```
**Análisis:** Import existe pero nunca se usa (`grep "supabase\." → 0 matches`).  
**Clasificación:** DEAD_IMPORT  
**Severidad:** LOW — Borrar import

### d) LeadTripsList.tsx (línea del import)
```
import { supabase } from '@/integrations/supabase/client';
```
**Análisis:** Import existe pero nunca se usa.  
**Clasificación:** DEAD_IMPORT  
**Severidad:** LOW — Borrar import

### e) usePlannerGeneration.ts (línea 68, 174)
```
const response = await supabase.functions.invoke('travel-itinerary', {...});
```
**Análisis:** Edge Function invocation (no es query tabla).  
**Tipo:** EDGE_INVOKE  
**Clasificación:** NOT_A_LEAK — Los Edge Functions son servicios remotos. Invocarlos directo desde hooks es patrón aceptado (ya existe en placesService.ts, usePlannerGeneration.ts). La alternativa sería crear un wrapper service, pero agrega complejidad mínima.  
**Severidad:** ACCEPTABLE — Mantener como está. Si en futuro hay patrón de múltiples Edge Functions, considerar abstracción.

### f) usePlannerState.ts (líneas 200-207)
```
const { data, error } = await supabase
  .from('messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .eq('role', 'system')
  .contains('meta', { messageType: 'trip_planner_state' })
  .order('created_at', { ascending: false })
  .limit(1);
```
**Contexto:** Comentario línea 199: "Fallback to messages (conversations pre-1.1.b without trip row)"  
**Tipo:** TABLE_QUERY (fallback a `messages` para datos legacy)  
**Clasificación:** ACCEPTABLE_FALLBACK — Intencional, para migración pre-1.1.b. Comentario justifica.  
**Severidad:** MODERATE — No es crítico (fallback), pero debería estar en servicio. Opción: dejar como está hasta que se deprece 1.1.b, o mover a messageStorageService.ts junto con useContextualMemory.

---

## Tabla de decisiones recomendadas

| Pregunta | Respuesta | Implicancia | Acción |
|----------|-----------|------------|--------|
| **Q1: ¿consumerAuthService está muerto?** | NO — está activo en ConsumerSignup/Profile | Mantener el servicio | No incluir en PR purga |
| **Q2: ¿hotelbeds feature está muerta?** | SÍ — 0 callers, 1 commit, aislado | Eliminar rama | Incluir en PR#4 purga |
| **Q3: ¿ADR-002 exige mode-aware en orchestrator?** | SÍ, CORRECTAMENTE IMPLEMENTADO | No es violation, es contrato | No refactorizar orchestrator |
| **Q4: ¿Cobertura de useMessageHandler?** | NULA — 0 tests directos/indirectos | CRÍTICO para refactor | Escribir tests antes de PR#4 |
| **Q5a: Dead imports (useMessageHandler, LeadSelector, LeadTripsList)?** | CONFIRMADO 3 dead imports | Deuda técnica menor | Borrar en PR limpieza (5 min) |
| **Q5b: useContextualMemory (6 table queries)?** | CONFIRMADO — CRITICAL | Viola service layer pattern | Crear messageStorageService.ts (2-3 h) |
| **Q5c: usePlannerGeneration (Edge Function)?** | NOT_A_LEAK — patrón aceptado | Invocar Edge Functions directo es OK | Mantener como está |
| **Q5d: usePlannerState fallback (legacy)?** | ACCEPTABLE_FALLBACK documentado | Intencional, justificado | Migrar a service si se depreca 1.1.b |

---

## Síntesis de hallazgos críticos

### Correcciones al informe de auditoría

1. **consumerAuthService NO está muerto.** El sub-agent D se equivocó — está activamente usado en ConsumerSignup y ConsumerProfile.
2. **Dead imports en useMessageHandler, LeadSelector, LeadTripsList:** El audit reportó como "SUPABASE LEAKS" pero son **imports sin usar** — deuda técnica menor, no architectural violation.
3. **Mode-aware en orchestrator NO es violation.** Es el contrato de ADR-002, correctamente implementado. No requiere refactor.
4. **useContextualMemory es la fuga real crítica** — 6 operaciones de BD directo, deberían estar en messageStorageService.ts.

### Riesgos nuevamente priorizados

| Riesgo | Severidad | Causa | Acción |
|--------|-----------|-------|--------|
| useContextualMemory (6 table queries) | CRITICAL | Viola service layer pattern | Crear messageStorageService.ts |
| useMessageHandler sin tests | CRITICAL | 1,958 LOC sin cobertura | Escribir tests antes de refactor |
| Dead imports (3 archivos) | LOW | Deuda técnica menor | Limpiar en PR limpieza |
| Hotelbeds branch muerto | MODERATE | 0 callers, nunca integrado | Borrar en PR purga |

---

## Plan de fixes revisado (POST-Q&A)

Orden de ejecución con nueva información:

1. **PR#0 (Nuevo): Tests para useMessageHandler**  
   - Escribir 8-10 integration tests que cubran paths principales (search, itinerary, planner interaction)  
   - Esfuerzo: 4-6 horas | Risk: LOW
   - **Prerequisito de PR#4 (refactor useMessageHandler)**

2. **PR#1: Aislar Supabase en chat (messageStorageService.ts)**  
   - Mover 6 operaciones de useContextualMemory a messageStorageService  
   - Mover useMessageHandler import muerto (borrar línea 24)  
   - Esfuerzo: 2-3 horas | Risk: LOW

3. **PR#2: Aislar Supabase en trip-planner (leadService.ts)**  
   - Borrar dead imports en LeadSelector, LeadTripsList (3 archivos)  
   - Esfuerzo: 30 min | Risk: NONE

4. **PR#3: Crear types/ compartido (desacoplar chat↔trip-planner)**  
   - Esfuerzo: 1 hora | Risk: LOW

5. **PR#4 (ya con tests): Refactor useMessageHandler**  
   - Partir en 3 funciones (messageHandler.ts puro, messageService.ts, messageTransforms.ts)  
   - Esfuerzo: 4-6 horas | Risk: MEDIUM (ya cubierto con tests de PR#0)

6. **PR#5: Descomponer TripPlannerWorkspace**  
   - Esfuerzo: 6-8 horas | Risk: MEDIUM

7. **PR#6: Purga (hotelbeds, etc.)**  
   - Borrar hotelbeds feature, standard_itinerary (fuera de ADR-002 scope), migration reverso  
   - Esfuerzo: 2-3 horas | Risk: LOW

---

## Conclusión

**La auditoría original fue ~80% correcta pero cometió 4 errores específicos** que se corrigen aquí. El plan de refactors (5 PRs) es válido pero requiere un **PR#0 previo de testing** antes de tocar useMessageHandler. El modo-aware en orchestrator **no es deuda**, es contrato cumplido. El verdadero leak crítico es **useContextualMemory con 6 table queries directo**, que debe moverse a servicio.

**Ruta recomendada:** PR#0 (tests) → PR#1-2 (aislar Supabase) → PR#3 (tipos compartidos) → PR#4 (refactor useMessageHandler con tests verdes) → PR#5-6 (purga + grandes refactors).

---

**Fecha verificación:** 2026-04-24  
**Estado:** COMPLETO — Esperando OK al Paso 2 (decisión de plan de fixes)
