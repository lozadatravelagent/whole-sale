# Auditoría estructural de capas — Emilia frontend
**Fecha:** 2026-04-24  
**Contexto:** Post-PR-5 (PDF export), mid-D24. Enfoque: limpieza de arquitectura de capas, aislamiento de features, cumplimiento ADR-002 (motor agnóstico + ramificación en productos).

---

## Resumen ejecutivo

**La arquitectura de capas tiene contaminación moderada pero con riesgos críticos.** El feature core (chat) está bien separado en servicios puros, pero viola el patrón de acceso a datos: 6 hooks/componentes hablan directamente a Supabase en lugar de delegar a servicios. Además, chat y trip-planner tienen dependencia bidireccional asimétrica (chat depende fuertemente de trip-planner types/utils), lo que degrada la independencia de módulos. La ramificación por modo/accountType vive parcialmente en el motor core en lugar de en adaptadores top-level, violando ADR-002. Auth + layouts están limpios.

**Nivel global:** Moderadamente contaminado — funciona, pero refactors urgentes necesarios para escala futura.

---

## 1. Inventario estructural por feature

### Sub-Agent A: Feature Chat (1,958 LOC en hook crítico)

**Estructura:**
- 25 componentes UI (MessageItem 520 LOC, MessageInput, SuggestionChips, etc.)
- 7 hooks (useMessageHandler 1,958 LOC, useChatState 324 LOC, otros especializados)
- 13 servicios puros (conversationOrchestrator 695 LOC, searchHandlers 2,099 LOC, itineraryPipeline, routeRequest, discoveryService, etc.)
- 2 tipos, 9 utils, 2 data files, tests

**Fortalezas:**
- Services puros: conversationOrchestrator, routeRequest, discoveryService, itineraryPipeline **NO tienen React ni Supabase directo**. 100% determinísticos.
- searchHandlers.ts (2,099 LOC) es puro — ejecuta búsquedas (flights, hotels, packages) sin side effects, solo transformación.
- Lógica de iteración bien encapsulada en iterationDetection.ts.

**Debilidades críticas:**
1. **useMessageHandler (1,958 LOC)** es un hook-gordo que centraliza **toda** la orquestación de turnos: parsing IA, routing, búsqueda, persistencia, editorial, detección de intención — en un solo archivo. Cambios en orquestación requieren editar 1,958 líneas.
2. **ChatFeature.tsx (917 LOC)** es componente gigante que coordina 7+ hooks (useChatState, useMessages, usePdfAnalysis, useContextualMemory, useMessageHandler, useTripPlanner). Refactoring muy difícil.
3. **Ciclo de dependencias bidireccional con trip-planner:**
   - Chat exporta: tipos (FlightData, LocalHotelData), servicios (searchHandlers, discoveryService, hotelStorageService), componentes (MessageInput, MessageItem, SuggestionChips)
   - Chat importa desde trip-planner: tipos (TripPlannerState, PlannerActivity, PlannerEditorialData), utilidades (normalizePlannerState, buildEditorialData, buildPlannerPromptContext)
   - **Riesgo:** Cambios en tipos de chat requieren updates en 20+ sitios; cambios en trip-planner types requieren actualizar chat orquestador.

**Exporta 30 referencias a otros features** (trip-planner: 18, public-chat: 5, landing: 1, tests: 2).

---

### Sub-Agent B: Feature Trip-Planner (20,663 LOC total, aislado horizontalmente)

**Estructura:**
- 24 componentes (TripPlannerWorkspace 2,235 LOC, TripPlannerMap 1,052 LOC, LeadSelector, LeadTripsList, paneles, etc.)
- 17 hooks (usePlannerHotels 1,101 LOC, usePlannerState 345 LOC, especializados por dominio)
- 8 servicios (tripService 296 LOC, placesService 462 LOC, etc.)
- Utilities, editorial, helpers, scheduling, tests

**Fortalezas:**
- **Aislamiento horizontal perfecto:** CERO imports cruzados con otros features. trip-planner no importa nada de chat, landing, crm, auth.

**Debilidades críticas:**
1. **Supabase contaminado en 5+ puntos en lugar de 1:**
   - tripService.ts ✓ Controlador intencional
   - usePlannerState.ts ✗ Query directa a tabla `messages` (línea 200-207, fallback legacy pre-1.1.b)
   - LeadSelector.tsx ✗ Query directo a `leads`
   - LeadTripsList.tsx ✗ Query directo a `lead_trips`
   - usePlannerGeneration.ts ✗ Invoca Edge Function `travel-itinerary` directo
   - placesService.ts ✗ Invoca Edge Function `foursquare-places` directo

2. **usePlannerState (345 LOC) mezcla 3 capas:**
   - React state (useState)
   - Persistencia IndexedDB (getPlannerStateFromCache, setPlannerStateInCache)
   - Persistencia Supabase (debounced upsertTrip via tripUpsertDebounceRef)
   - Debería existir `usePersistencePlanner` separado que delegue a servicios.

3. **TripPlannerWorkspace.tsx (2,235 LOC)** es dios componente — orquesta 13+ hooks, renderiza múltiples dominios (mapa, paneles, modales), gestiona estado anidado. Candidato primo para descomposición.

4. **utils.ts (1,899 LOC)** es depósito monolítico de funciones de transformación sin cohesión clara. Merece distribución por dominio (hotels, flights, scheduling, etc.).

---

### Sub-Agent C: Feature Auth + Layouts (Limpio, caveat menor)

**Estructura:**
- auth/: servicios puros (consumerAuthService), utilities (authRedirectDecider), schemas (Zod)
- layouts/: UnifiedLayout, menuBuilder, RequireAgent, RequireConsumer, guards

**Fortalezas:**
- **AuthContext es puro:** Solo Supabase session + DB user fetch, sin lógica de negocio.
- **Guards son puros:** Decisión logic extraída (requireAgentLogic.ts, requireConsumerLogic.ts), sin fetch/DB calls — basada 100% en AuthContext.
- **UnifiedLayout es presentación-only:** Menú dinámico por rol, pero estructura fija — sin ramificación de layout.
- Tests completos para guards y redirects.

**Debilidades menores:**
1. **AuthContext.value no memoizado** — En cada render de AuthProvider, todos los 20+ useAuth() hooks se re-suscriben. Visible en DevTools profiler, no critical.
2. **UserProfileHeader.tsx contamina layout** — Fetches async de agencyName/tenantName con useEffect, no integrado en AuthContext. Funcional pero violría DRY.
3. **ProtectedRoute + RequireAgent stacking:** Algunos routes usan ambos (`<ProtectedRoute><RequireAgent>...</RequireAgent></ProtectedRoute>`). Verificar si overlap es intencional o deuda.

**Dead code detectado:**
- consumerAuthService.ts: 0 imports actuales (poliza pre-planeada sin callers).
- authRedirectDecider.ts, consumerAuthSchema.ts: 1 import cada uno (tests son sus únicos consumers).

---

## 2. Violaciones cross-feature (Sub-Agent D — Transversal)

### 2.1 Importaciones cruzadas entre features

| Origen → Destino | Tipo | Ejemplos de dependencia |
|---|---|---|
| **chat → trip-planner** (12+) | Types, services, utils | useMessageHandler importa TripPlannerState, normalizePlannerState, buildEditorialData |
| **trip-planner → chat** (3+) | Services | usePlannerHotels importa searchHandlers, LocalHotelData |
| **chat → landing** (1) | Libs | useChatState importa consumePendingPrompt |

**Veredicto:** Acoplamiento asimétrico esperado (Emilia orquesta ambos), pero sugiere jerarquía confusa. Chat debería ser orquestador de servicios agnósticos, no consumidor simétrico de trip-planner.

### 2.2 Supabase imports fuera de service layer (CRITICAL)

```
❌ /src/features/chat/hooks/useMessageHandler.ts
   import { supabase } from '@/integrations/supabase/client'  [300+ líneas con DB logic]

❌ /src/features/chat/hooks/useContextualMemory.ts
   import { supabase }

❌ /src/features/trip-planner/components/LeadSelector.tsx
   import { supabase }  [Direct query to leads table]

❌ /src/features/trip-planner/components/LeadTripsList.tsx
   import { supabase }  [Direct query to lead_trips table]

❌ /src/features/trip-planner/hooks/usePlannerGeneration.ts
   import { supabase }  [Direct Edge Function invoke]

❌ /src/features/trip-planner/hooks/usePlannerState.ts:200-207
   import { supabase }  [Fallback query to messages table — legacy pre-1.1.b]
```

**Impacto:**
- Viola patrón de acceso a datos (should isolate in service layer)
- Complica testing (hard to mock)
- Tight coupling a Supabase client internals
- useMessageHandler es offender más grave: 300+ líneas de lógica compleja con DB access directo

### 2.3 Dead code candidatos

1. **consumerAuthService.ts** (0 imports) — Exported funcs: signUpConsumer, signInConsumer, signOutConsumer. Sin callers actuales.
2. **useHotelResultsCache.ts** (0 imports) — Caching specializado; posible obsoleto.
3. **useSearchResultsCache.ts** (0 imports) — Similar.
4. **hotelbeds feature: HotelbedsBooking.tsx, HotelbedsCheckRate.tsx, HotelbedsResults.tsx, HotelbedsSearchForm.tsx** (0 imports) — Rama muerta de integración.

### 2.4 Ubicaciones canónicas vs raras

✓ **Hooks globales en src/hooks/** — OK (cross-cutting: useChat, useLeads, useReports, etc.)
✓ **Servicios globales en src/services/** — OK (APIs terceros: aiMessageParser 51K, pdfMonkey 65K, hotelSearch, airfareSearch)
✓ **Components en src/components/** — OK (shadcn/ui lib)

**Sin ubicaciones raras detectadas.**

### 2.5 Violación de ADR-002: Modo en motor core

**ADR-002 establece:** Motor agnóstico a mode/accountType → ramificación en productos (páginas top-level).

**Realidad encontrada:**
- conversationOrchestrator.ts: 15+ líneas con `mode === 'agency'`, `mode === 'passenger'` (lógica de modo en el motor)
- deriveDefaultMode.ts, deriveModeSwitchState.ts: Lógica de switching de modo
- ChatHeader.tsx: Mode display logic
- useMessageHandler.ts: Contextual memory mezcla con ramificación de modo

**Severidad:** MODERATE VIOLATION. La lógica de modo bridge es productiva (B2C vs B2B routing diferenciado), pero debería estar en capa adaptador, no en motor de orquestación.

---

## 3. Top 5 riesgos ordenados por severidad

### Riesgo 1: Supabase Leaks (CRITICAL)
**Ubicación:** 6 archivos (useMessageHandler, useContextualMemory, LeadSelector, LeadTripsList, usePlannerGeneration, usePlannerState:200-207)  
**Impacto:** Arquitectura de datos comprometida. Testing casi imposible. Cambios en Supabase client internals rompen múltiples features.  
**Acción urgente:** Mover todo a service layer en un PR atómico (messageService.ts, plannerStateService.ts, leadService.ts).

### Riesgo 2: useMessageHandler hook-gordo (HIGH)
**Ubicación:** src/features/chat/hooks/useMessageHandler.ts (1,958 LOC)  
**Impacto:** Imposible cambiar orquestación sin editar archivo gigante. Lógica mixta (parsing, routing, persistencia, editorial). Sin tests unitarios aislados.  
**Acción urgente:** Refactor en PR separado — dividir en messageHandler.ts (orquestación pura) + messageService.ts (BD) + messageTransforms.ts (mappings).

### Riesgo 3: Chat ↔ Trip-Planner bidireccional (HIGH)
**Ubicación:** Múltiples imports cruzados (chat→trip-planner: 12+, trip-planner→chat: 3+)  
**Impacto:** Cambios en tipos de chat requieren updates en 20+ sitios. Ciclo potencial si no cuidado.  
**Acción urgente:** Invertir dependencias — trip-planner como librería agnóstica, chat como consumidor. Crear types/ compartido (src/types/shared-chat-trip-planner.ts) para desacoplar.

### Riesgo 4: TripPlannerWorkspace dios componente (MODERATE)
**Ubicación:** src/features/trip-planner/components/TripPlannerWorkspace.tsx (2,235 LOC)  
**Impacto:** Refactoring imposible. Múltiples concerns (mapa, paneles, modales, estado). Testing por captura de snapshot, no unitario.  
**Acción:** PR de descomposición — extraer subcomponents (MapController, PanelManager, ModalHandler).

### Riesgo 5: Mode ramificación en motor core (MODERATE)
**Ubicación:** conversationOrchestrator.ts, deriveDefaultMode.ts, useMessageHandler.ts (ramificaciones mode/accountType)  
**Impacto:** Motor no es agnóstico. Cambios en modo de negocio requieren tocar core. Violación de ADR-002.  
**Acción:** Crear adaptador chatModeRouter.ts que envuelva orchestrator con lógica de modo transparente.

---

## 4. Propuesta de fixes por severidad

### Severidad CRITICAL (1 commit atómico cada uno — PRs secuenciales, no paralelas)

#### PR#1: Aislar acceso a Supabase en chat feature
**Scope:** useMessageHandler, useContextualMemory
- Crear messageService.ts con funciones async puras: saveMessageContext(), fetchMessageHistory(), etc.
- Mover import { supabase } de hooks a messageService.ts
- Hooks llaman a messageService, no a supabase directo
- **Esfuerzo:** 2-3 horas | **Risk:** MEDIUM (múltiples callers de useMessageHandler)
- **Fallback:** Crear wrapper service sin cambiar hook signature

#### PR#2: Aislar acceso a Supabase en trip-planner feature
**Scope:** LeadSelector, LeadTripsList, usePlannerState fallback
- Crear leadService.ts (queries a leads, lead_trips) + plannerStateService.ts (queries a messages)
- Componentes + hooks llaman a servicios, no a supabase directo
- **Esfuerzo:** 2 horas | **Risk:** LOW (componentes aislados)

#### PR#3: Crear types/ compartido y desacoplar chat ↔ trip-planner
**Scope:** Extraer tipos intermedios
- Crear src/types/shared-chat-planner.ts (FlightData, LocalHotelData, EditorialContext, etc.)
- chat importa de shared, trip-planner importa de shared, no cruzados directo
- **Esfuerzo:** 1 hora | **Risk:** LOW (refactoring de imports, sin lógica)

---

### Severidad HIGH (1-2 PRs, diferibles a sprint siguiente)

#### PR#4: Refactor useMessageHandler en 3 funciones especializadas
**Scope:** Partir 1,958 LOC en 3 modules
- messageHandler.ts: orquestación pura (sans React, sans DB)
- messageService.ts: BD (ya creado en PR#2)
- messageTransforms.ts: transformaciones de datos (parsing, formatting)
- **Esfuerzo:** 4-6 horas | **Risk:** MEDIUM (refactoring crítico)

#### PR#5: Descomponer TripPlannerWorkspace en 3-4 subcomponents
**Scope:** Partir 2,235 LOC
- MapController.tsx (manejo de mapa)
- PanelManager.tsx (sidebar + side panel)
- ModalHandler.tsx (modales)
- Main composition llamando a cada uno
- **Esfuerzo:** 6-8 horas | **Risk:** MEDIUM (breaking changes en props drilling)

---

### Severidad MODERATE (Deuda diferible pero documentada)

#### PR#6: Crear adaptador de modo (chatModeRouter.ts)
**Scope:** Extraer lógica de modo de conversationOrchestrator
- chatModeRouter.ts: wraps orchestrator, injected mode/accountType
- conversationOrchestrator.ts: puro, sin condicionales de modo
- **Esfuerzo:** 2-3 horas | **Risk:** LOW
- **Prioridad:** Post-initial-refactors

#### Ticket#7: Dead code cleanup
**Scope:** Borrar consumerAuthService, hotelbeds components, cache hooks
- consumerAuthService.ts (0 imports)
- useHotelResultsCache.ts, useSearchResultsCache.ts
- HotelbedsBooking.tsx, HotelbedsCheckRate.tsx, HotelbedsResults.tsx, HotelbedsSearchForm.tsx
- **Esfuerzo:** 30 min | **Risk:** VERY LOW (grep, delete, no consumers)

---

## 5. Preguntas estratégicas para resolver antes de next sprint

1. **¿Tipo compartido es viablemente el ownership del chat o trip-planner?**  
   Propuesta: Crear src/types/orchestration.ts (owned by chat, pero agnóstico a feature implementations).

2. **¿consumerAuthService está muerto o en transición?**  
   Si muerto, borrarlo en PR#7. Si en transición, completar migraciones pendientes.

3. **¿hotelbeds feature es rama muerta o futura integración?**  
   Si rama muerta, borrar en PR#7. Si futura, documentar bloqueos actuales.

4. **¿ProtectedRoute + RequireAgent stacking es intencional?**  
   Posible redundancia. Verificar si ambos guards se necesitan en las mismas routes.

5. **¿AuthContext.value debería memoizarse?**  
   Posiblemente sí — evitaría cascadas de re-renders en 20+ consumers. Validar con DevTools.

---

## Cronograma propuesto

**Inmediato (Sprint actual):**
- PR#1, PR#2, PR#3 (aislar Supabase, desacoplar chat/trip-planner) — 5-6 horas total
- Ejecutar en orden secuencial (PR#1 → PR#2 → PR#3, no paralelas)

**Próximo sprint:**
- PR#4, PR#5 (refactor grandes hooks/componentes) — 10-14 horas total
- PR#6 (adaptador de modo) — 2-3 horas
- Ticket#7 (dead code) — 30 min

**Control de calidad:**
- Post cada PR: `npm run lint`, `npm run build`, `npm test`
- No merges en main sin pasar suite completa

---

## Conclusión

La arquitectura es funcional pero tiene brechas de aislamiento que impactarán mantenibilidad a escala. Supabase leaks y hook-gordo son críticos; refactor en PRs pequeñas y secuenciales es viable en 2 sprints. Después: arquitectura limpia, testeable, escalable.

**Fecha auditoría:** 2026-04-24  
**Realizada por:** 4 sub-agents (A: chat feature, B: trip-planner, C: auth+layouts, D: transversal)  
**Estado:** COMPLETE — Esperando aprobación del lead antes de fixes.
