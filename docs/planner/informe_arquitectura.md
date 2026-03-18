# Informe de Arquitectura Técnica — Trip Planner

> **Autor**: Senior Solutions Architect (análisis automatizado)
> **Fecha**: 2026-03-16
> **Alcance**: Feature Trip Planner end-to-end (frontend + backend)
> **Codebase**: WholeSale Connect AI — Multi-tenant Travel CRM SaaS

---

## Resumen Ejecutivo

El Trip Planner es el feature más ambicioso del sistema: un planificador de viajes interactivo con mapa, IA generativa, búsqueda de hoteles/vuelos en inventario real, y geocoding multi-proveedor. Abarca **27 archivos frontend** (~12,340 LOC), **12 archivos en planner-agent** (~948 LOC) y **1 archivo en travel-itinerary** (~1,662 LOC) — **14,950 LOC totales** distribuidos en **40 archivos**.

El patrón arquitectónico es **Feature-Based + Hook-Centric** con un **Backend AI Agent Loop**. La fortaleza principal es la sofisticación funcional (loop agentic con tool-calling, geocoding con 4 niveles de fallback, skeleton-first rendering). La debilidad principal es la concentración excesiva de lógica: un solo hook de 2,649 líneas orquesta toda la funcionalidad.

---

## 1. Arquitectura del Sistema

### 1.1 Patrón Arquitectónico

**Feature-Based + Hook-Centric con Backend AI Agent Loop**

- **Frontend**: Un hook monolítico (`useTripPlanner`) actúa como controlador central de estado, orquestando 27 archivos entre componentes, servicios, utilidades y tipos.
- **Backend**: Dos Edge Functions en Supabase — `planner-agent` (loop agentic con tool-calling vía OpenAI) y `travel-itinerary` (generación de itinerarios con GPT-4o-mini en modo JSON).
- **Comunicación**: Request/Response directo (no Realtime para este feature). El frontend invoca Edge Functions vía `supabase.functions.invoke()`.

### 1.2 Estructura de Carpetas

```
src/features/trip-planner/               # 27 archivos — 12,340 LOC
├── index.ts                             #    11 LOC — Barrel export
├── types.ts                             #   241 LOC — 25+ tipos/interfaces core
├── utils.ts                             # 1,169 LOC — 30+ funciones (formateo, normalización, builders)
├── scheduling.ts                        #   475 LOC — Clasificación y scheduling de actividades
├── map.ts                               #     4 LOC — Config Google Maps API key + Map ID
├── useTripPlanner.ts                    # 2,649 LOC — Hook principal (god object)
│
├── components/                          # 16 archivos — 8,464 LOC
│   ├── TripPlannerWorkspace.tsx         # 2,044 LOC — Contenedor principal + lógica UI
│   ├── TripPlannerMap.tsx               # 1,405 LOC — Google Maps interactivo
│   ├── PlannerHotelInventoryDetailPanel.tsx  #   417 LOC — Detalle hotel (carrusel, rooms, precio)
│   ├── TripPlannerStarterTemplate.tsx   #   367 LOC — Template inicial (3 prompts sugeridos)
│   ├── PlannerChatDestinationCards.tsx  #   354 LOC — Cards de atracciones por destino
│   ├── PlannerContextSidebar.tsx        #   336 LOC — Sidebar responsive (hoteles/transporte/places)
│   ├── PlannerDateSelectionModal.tsx    #   312 LOC — Modal fechas exactas/flexibles
│   ├── PlannerPlaceDetailPanel.tsx      #   251 LOC — Detalle Google Place
│   ├── PlannerMapPlaceAssignModal.tsx   #   242 LOC — Asignar place a día/slot
│   ├── PlannerHotelMatchPanel.tsx       #   242 LOC — Matching Google Place ↔ inventario
│   ├── PlannerHotelInventorySection.tsx #   233 LOC — Lista hoteles EUROVIPS
│   ├── PlannerTransportSection.tsx      #   187 LOC — Opciones vuelos Starling
│   ├── TripPlannerWorkspaceSkeleton.tsx #   130 LOC — Skeleton loading state
│   ├── PlannerCircularLoadingState.tsx  #    22 LOC — Spinner circular
│   └── PlannerHotelLoadingState.tsx     #     1 LOC — Re-export
│
└── services/                            # 6 archivos — 1,248 LOC
    ├── placesService.ts                 #   510 LOC — Google Places API (nearby, details, hotels)
    ├── plannerGeocoding.ts              #   313 LOC — Geocoding multi-fallback
    ├── plannerPlaceMapper.ts            #   168 LOC — Mapper Places → tipos planner
    ├── geocodingCache.ts                #   125 LOC — IndexedDB cache (TTL 24h)
    ├── plannerStateCache.ts             #    78 LOC — IndexedDB persistencia estado
    └── plannerHotelMatcher.ts           #    54 LOC — Ranking inventario ↔ Google place

supabase/functions/planner-agent/        # 12 archivos — 948 LOC
├── index.ts                             #    68 LOC — Entry point HTTP + rate limiting
├── agentLoop.ts                         #   158 LOC — Loop agentic (5 iteraciones, 55s timeout)
├── planner.ts                           #   146 LOC — LLM planning (GPT-4.1-mini, tool_choice: auto)
├── types.ts                             #    41 LOC — AgentContext, ToolDefinition, AgentStep
├── guardrails.ts                        #    17 LOC — Límites (5 iter, 55s, 3 tools paralelos)
├── prompts/
│   └── system.ts                        #    34 LOC — System prompt ("Emilia", agente de viajes)
└── tools/
    ├── registry.ts                      #    58 LOC — Registro de 6 tools
    ├── searchFlights.ts                 #   108 LOC — Tool: Starling flights
    ├── searchHotels.ts                  #   115 LOC — Tool: EUROVIPS hotels
    ├── searchPackages.ts                #    83 LOC — Tool: EUROVIPS packages
    ├── generateItinerary.ts             #    87 LOC — Tool: invoca travel-itinerary
    └── resolveCityCode.ts               #    33 LOC — Tool: IATA/hotel codes

supabase/functions/travel-itinerary/     # 1 archivo — 1,662 LOC
└── index.ts                             # 1,662 LOC — Generación completa de itinerarios
```

### 1.3 Flujo de Datos End-to-End

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                           │
│                                                                     │
│  Chat Input ──→ useTripPlanner ──→ TripPlannerWorkspace             │
│                    │    │    │         │          │         │        │
│                    │    │    │    Map (Google)  Sidebar   Modals     │
│                    │    │    │                                       │
│            ┌───────┘    │    └──────────────┐                       │
│            ▼            ▼                   ▼                       │
│     placesService  plannerGeocoding  plannerStateCache              │
│     (Google API)   (Google/Nominatim) (IndexedDB)                  │
└─────────┬──────────────┬────────────────────────────────────────────┘
          │              │
          │   supabase.functions.invoke()
          ▼              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Supabase Edge Functions)                 │
│                                                                     │
│  planner-agent ─────────────────────→ travel-itinerary              │
│    │ (Agent Loop: 5 iter max)           │ (GPT-4o-mini JSON mode)  │
│    │                                    │                           │
│    ├──→ searchFlights ──→ starling-flights (Starling API)          │
│    ├──→ searchHotels  ──→ eurovips-soap  (EUROVIPS SOAP)           │
│    ├──→ searchPackages──→ eurovips-soap  (EUROVIPS SOAP)           │
│    ├──→ generateItinerary ──→ travel-itinerary (recursivo)         │
│    └──→ resolveCityCode (in-memory, sin API)                       │
│                                                                     │
│  travel-itinerary ──→ OpenAI API (gpt-4o-mini)                    │
│    └──→ importa scheduling.ts del frontend (dependencia cruzada)   │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.4 Modos de Generación

El sistema soporta tres modos de generación de itinerarios:

| Modo | Descripción | Tokens máx. | Uso |
|------|-------------|-------------|-----|
| `skeleton` | Solo highlights + títulos de días, sin actividades | 900-1,800 | Renderizado rápido inicial |
| `segment` | Enriquecimiento de un segmento específico | 1,400-3,200 | Carga lazy por destino |
| `full` | Plan completo con actividades, restaurantes, tips | 2,800-5,200 | Generación completa |

### 1.5 Ciclo de Vida del Estado

```
template → draft_parsing → draft_generating → ready
    │                                           │
    │  (usuario envía prompt en chat)           │  (regeneraciones parciales:
    └───────────────────────────────────────────│   día, segmento, o plan completo)
                                                │
                                                ▼
                                          Mutaciones UI:
                                          - addDestination / removeDestination
                                          - reorderDestinations
                                          - applyPlannerDateSelection
                                          - loadHotelsForSegment
                                          - selectHotel / confirmInventoryHotelMatch
                                          - loadTransportForSegment
                                          - selectTransportOption
                                          - addPlaceToPlanner
                                          - autoFillSegmentWithRealPlaces
```

---

## 2. Inventario de Servicios

### 2.1 Integraciones Externas

| # | Servicio | Protocolo | Responsabilidad | Instanciación | Archivo(s) |
|---|----------|-----------|-----------------|---------------|------------|
| 1 | **Google Maps JavaScript API** | SDK (`@vis.gl/react-google-maps`) | Mapa interactivo, markers, polylines, viewport | `<APIProvider>` en componente React | `TripPlannerMap.tsx`, `map.ts` |
| 2 | **Google Places API** | SDK (PlacesService, Geocoder) | Búsqueda nearby, detalles, fotos, geocoding | `new placesLib.PlacesService(map)` en ref | `placesService.ts`, `plannerGeocoding.ts` |
| 3 | **Nominatim (OpenStreetMap)** | REST HTTP | Geocoding fallback (cuando Google no disponible) | `fetch()` directo | `plannerGeocoding.ts` |
| 4 | **OpenAI API** | REST HTTP | Generación itinerarios (GPT-4o-mini), planning (GPT-4.1-mini), JSON repair | `fetch('https://api.openai.com/v1/chat/completions')` | `planner.ts`, `travel-itinerary/index.ts` |
| 5 | **Starling API** | Supabase → Edge Function | Búsqueda de vuelos reales | `supabase.functions.invoke('starling-flights')` | `tools/searchFlights.ts` |
| 6 | **EUROVIPS SOAP** | Supabase → Edge Function | Búsqueda de hoteles y paquetes | `supabase.functions.invoke('eurovips-soap')` | `tools/searchHotels.ts`, `tools/searchPackages.ts` |
| 7 | **Supabase** | SDK + Edge Functions | Persistencia, auth, rate limiting, invocación de funciones | `createClient()` singleton | `useTripPlanner.ts`, `planner-agent/index.ts` |
| 8 | **IndexedDB** | Browser API nativa | Cache local: estado planner + geocoding | `indexedDB.open()` manual | `plannerStateCache.ts`, `geocodingCache.ts` |

### 2.2 Detalle de Cada Integración

#### Google Maps / Places (Frontend)

- **Maps**: `@vis.gl/react-google-maps` — `APIProvider`, `Map`, `Marker`, `InfoWindow`
- **Places Service**: `nearbySearch()` (radio + categoría), `findPlaceFromQuery()`, `getDetails()` (20 campos)
- **Geocoder**: `google.maps.Geocoder` para resolución hotel-dirección → coordenadas
- **Polylines**: `google.maps.Polyline` conectando ciudades de segmentos con estilo dashed
- **Caching**: 3 Maps en memoria (details, nearby, inventory hotels) — sin TTL, persisten toda la sesión
- **Paginación**: Colecta hasta 3 páginas de resultados nearby
- **Concurrencia**: `runWithConcurrency()` pool size 4 para geocoding de hoteles inventario
- **Deduplicación**: Merge por `placeId`, scoring: `(rating × 18) + log10(ratings_total) × 22`

#### Nominatim (Frontend, Fallback)

- **Uso**: Solo cuando Google Maps Geocoder no disponible o falla
- **Chain**: Google Geocoder → Nominatim → Coordenadas hardcoded (53 ciudades)
- **Formato**: `https://nominatim.openstreetmap.org/search?q={city}&format=json`

#### OpenAI (Backend)

| Función | Modelo | Temp. | Max tokens | Modo |
|---------|--------|-------|------------|------|
| `planner-agent` (planning) | `gpt-4.1-mini` | 0.1 | 1,500 | Tool calling (`tool_choice: auto`) |
| `travel-itinerary` (generación) | `gpt-4o-mini` | 0.4 | 900–5,200 (dinámico) | `response_format: json_object` |
| `travel-itinerary` (repair) | `gpt-4o-mini` | 0.0 | 40-50% del input | `response_format: json_object` |

#### Starling (Vuelos)

- **Payload**: `{Passengers, Legs, stops?, Airlines?}` — hasta 2 legs (ida/vuelta)
- **Response**: Array de vuelos con pricing, segments, legs
- **Extracción**: Top 5 por precio, mapeados a `{price, airline, stops, departure, arrival}`

#### EUROVIPS SOAP (Hoteles / Paquetes)

- **Hotels**: `{CityCode, CheckIn, CheckOut, Rooms[{Adults, Children, ChildrenAges, Infants}]}`
- **Packages**: `{cityCode, dateFrom, dateTo, packageClass}`
- **Response**: Rooms con pricing y meal plans, o paquetes con servicios incluidos

#### IndexedDB (Persistencia Local)

| Base de Datos | Store | Key | TTL | Propósito |
|---------------|-------|-----|-----|-----------|
| `PlannerStateDB` | `states` | `conversationId` | Sin TTL | Persistir `TripPlannerState` entre sesiones |
| `PlannerCacheDB` | `geocoding` | `city_key` | 24 horas | Cache de geocoding (lat/lng por ciudad) |

---

## 3. Auditoría de Implementación

### 3.1 God Objects

#### `useTripPlanner.ts` — 2,649 LOC

**Diagnóstico**: Hook monolítico que actúa como controlador, modelo, y orquestador de todo el feature.

**Evidencia**:
- **12 variables de estado** (`plannerState`, `isLoadingPlanner`, `plannerError`, `activePlannerMutation`, `isResolvingLocations`, `plannerLocationWarning`, + estado síncrono `trackedConversationId`)
- **6 refs** para gestión de mutaciones y optimización (`resolvingSignatureRef`, `isAutoLoadingHotelsRef`, `isAutoLoadingTransportRef`, `pendingSegmentEnrichmentRef`, `pendingRealPlacesHydrationRef`, `plannerConversationIdRef`, `suppressNextPersistedLoadUiRef`)
- **6 useEffect** hooks con dependencias complejas
- **28+ funciones exportadas** que cubren: CRUD destinos, gestión fechas, regeneración IA, búsqueda hoteles, matching inventario, quoting, transporte, places, autofill
- **Múltiples helpers internos no exportados**: `loadPersistedPlannerState`, `persistPlannerState`, `mergePlannerHotels`, `mergeEnrichedSegmentState`, `getRealPlacesCandidatePool`, `buildSegmentRealPlaceSequence`, `rankInventoryHotelsForPlace`, etc.

**Impacto**: Cada cambio en este archivo arriesga regresiones en funcionalidades no relacionadas. Testing unitario es prácticamente imposible sin mocking extensivo.

#### `TripPlannerWorkspace.tsx` — 2,044 LOC

**Diagnóstico**: Componente que mezcla orquestación de UI, gestión de estado local, y lógica de negocio.

**Evidencia**:
- **28 props** pasados al componente (prop drilling severo)
- **14+ useState** slices: `newDestination`, `activeHeaderPanel`, `mobileTab`, `pendingPlannerDateRequest`, `mapActiveCategories`, `draggedSegmentId`, `dropTargetSegmentId`, `activeMapSegmentId`, `assistantWidth`, `isAssistantCollapsed`, `hotelDetailState`, `placeDetailState`, `discoveryPlacesBySegment`, `inventoryHotelPlacesMap`, etc.
- **4 refs**: `segmentRefs`, `segmentVisibilityRef`, `resizeStartXRef`, `resizeStartWidthRef`
- **14+ useEffect** hooks para: scroll, localStorage, IntersectionObserver, reordering, sync, resize
- **Lógica de drag-and-drop** inline (~140 LOC para `handleDragSegment`, `handleDropTarget`)
- **Sub-componente `DayCarousel`** embebido (196-340) que debería ser extraído

**Impacto**: Candidato a desglosar en 5-6 componentes + un `useWorkspaceState` hook.

#### `TripPlannerMap.tsx` — 1,405 LOC

**Diagnóstico**: Componente de mapa con 3 sub-componentes internos y excesivos side effects.

**Evidencia**:
- **22+ useEffect** hooks — la mayoría para sincronización de markers, polylines, viewport, fetching
- **3 sub-componentes internos**: `RoutePolyline`, `PlannerViewportManager`, `PlannerGoogleMapScene`
- **10+ event handlers** para interacción de mapa
- **Google Maps API directa** mezclada con wrapper React

### 3.2 Uso de `any`

**Total identificado: ~30 instancias** distribuidas en:

| Archivo | Instancias | Contexto |
|---------|-----------|----------|
| `utils.ts` | ~13 | Normalización de datos LLM (`normalizePlannerState`, `normalizeSegment`) |
| `useTripPlanner.ts` | ~8 | `message.meta as any` (×3), catch blocks `(error: any)` (×5+) |
| `placesService.ts` | ~8 | `type: 'lodging' as any` (workaround Google types) |
| `planner.ts` (backend) | ~2 | Tool call mapping `(tc: any)` |
| `searchFlights.ts` | ~1 | Flight mapping `(f: any)` |
| `searchHotels.ts` | ~2 | Hotel/room mapping `(h: any, r: any)` |
| `searchPackages.ts` | ~3 | Package sorting/mapping |
| `travel-itinerary/index.ts` | ~3 | LLM response handling (`raw: any`) |

**Riesgo**: Los `any` en normalización (`utils.ts`) silencian errores de contrato — si el backend cambia la estructura del response, el frontend coerce silenciosamente a defaults sin alertar.

### 3.3 Console Logs en Producción

**Total identificado: ~20+ instancias** con prefijos emoji (`⏱️`, `❌`, `⚠️`, `🗺️`):

| Archivo | Tipo | Ejemplos |
|---------|------|----------|
| `useTripPlanner.ts` | warn/error/log | `'⏱️ [TRIP PLANNER BACKEND TIMING]'`, `'❌ [TRIP PLANNER] Regeneration failed'` |
| `TripPlannerMap.tsx` | warn/log/error | Viewport changes, inventory markers, diagnostics |
| `placesService.ts` | log | `'🗺️ [PLANNER MAP HOTELS] Inventory hotel geocoding completed'` |
| `planner-agent/*` | log/error | `'[PLANNER AGENT]'` prefixed debugging |
| `travel-itinerary/index.ts` | log/error | `'[TIMING]'` scoped timing, `'[TRAVEL-ITINERARY]'` errors |

**Riesgo**: Exponen información interna en la consola del navegador del usuario. Los logs de timing del backend son aceptables para observabilidad en Deno, pero los del frontend deberían usar logging condicional.

### 3.4 Memory Leaks

| # | Ubicación | Descripción | Severidad |
|---|-----------|-------------|-----------|
| 1 | `placesService.ts` — 3 Maps in-memory | Caches de details, nearby, y inventory sin TTL ni eviction. Persisten toda la sesión sin límite de tamaño. | **Media** |
| 2 | `TripPlannerMap.tsx:406` | `new placesLib.PlacesService(map)` asignado a ref, nunca destruido en unmount | **Baja** |
| 3 | `TripPlannerMap.tsx:533-540` | `fetchPlaceDetails()` promise no cancelable si el componente desmonta antes de completar | **Media** |
| 4 | `TripPlannerMap.tsx:554-598` | Múltiples `fetchInventoryHotelPlaces()` concurrentes si la selección cambia rápidamente | **Media** |
| 5 | `TripPlannerMap.tsx:425` | Timer creado sin cleanup completo en todos los paths de ejecución | **Baja** |
| 6 | `useTripPlanner.ts` | 6+ refs nunca limpiados en unmount (`resolvingSignatureRef`, `isAutoLoadingHotelsRef`, etc.) | **Baja** |
| 7 | `TripPlannerWorkspace.tsx` | `segmentRefs` Map no limpia entradas cuando segmentos son eliminados | **Baja** |
| 8 | `geocodingCache.ts` | Entradas expiradas en IndexedDB no se limpian proactivamente — solo se filtran en lectura | **Baja** |
| 9 | `plannerGeocoding.ts:251-273` | `initGeocodingCache()` precarga TODAS las entradas de IndexedDB a memoria en module load | **Baja** (pero escalable a media con miles de entradas) |

### 3.5 Race Conditions

| # | Ubicación | Descripción | Severidad |
|---|-----------|-------------|-----------|
| 1 | `useTripPlanner.ts:704-722` | Location enrichment usa flag `cancelled` pero `persistPlannerState` es async y no se awaita. Múltiples resoluciones concurrentes pueden corromper estado. | **Alta** |
| 2 | `TripPlannerMap.tsx:414-420` | `selectedSegment` usado en el efecto pero dependency array solo tiene `selectedSegmentId`. Si datos del segmento cambian sin cambiar ID, no se actualiza. | **Media** |
| 3 | `useTripPlanner.ts:2225-2269` | Auto-load hotels usa `isAutoLoadingHotelsRef.current` como guard pero sin garantía de atomicidad — dos renders rápidos podrían disparar búsquedas duplicadas. | **Media** |
| 4 | `useTripPlanner.ts:2572-2581` | Auto-load transport usa `CancelToken` pattern pero no espera a que la cancelación se complete antes de iniciar la nueva carga. | **Baja** |
| 5 | `plannerStateCache.ts` | `setPlannerStateInCache()` retorna `Promise<void>` pero se llama con `void` operator (sin await) en `useTripPlanner:751`. Si IDB write falla mid-transaction, no se surfacea error. | **Baja** |

### 3.6 Error Handling

**Patrón general: Pasivo**

- **Frontend**: Los errores se capturan con `try/catch` genéricos y se asignan a strings (`plannerError`, `contentError`). No hay discriminación por tipo de error, no hay retry automático, no hay circuit breaker.
- **Backend `planner-agent`**: Errores per-tool envueltos en `{success: false, error: string}` — sin códigos de error estructurados.
- **Backend `travel-itinerary`**: JSON repair con 4 niveles de fallback (direct → regex → sanitize → OpenAI repair) — robusto para parsing, pero status codes genéricos (500/502).
- **`plannerStateCache.ts`**: Todos los errores silenciados (return null/undefined). Si IndexedDB falla, el usuario pierde estado sin notificación.
- **`geocodingCache.ts`**: Expired entries limpiadas async con `.catch(() => {})`.

### 3.7 Testing

**0 tests unitarios o de integración** para todo el feature Trip Planner.

No existen archivos `*.test.ts`, `*.spec.ts`, ni `__tests__/` en ninguna de las carpetas del feature. Esto afecta:
- `scheduling.ts` (475 LOC de lógica pura, ideal para unit testing)
- `utils.ts` (1,169 LOC de funciones puras, ideal para unit testing)
- `plannerGeocoding.ts` (cadena de fallback, ideal para integration testing)
- Todos los builders de payload (`buildPlannerGenerationPayload`, `buildMakeBudgetOccupancies`)
- JSON parsing/repair en `travel-itinerary` (4 niveles de fallback)

### 3.8 Dependencia Cruzada Frontend ↔ Backend

**Hallazgo crítico**: `travel-itinerary/index.ts` importa directamente desde el frontend:

```typescript
import { normalizePlannerSegmentsScheduling } from '../../../src/features/trip-planner/scheduling.ts';
```

Esto viola la separación `api/` ↔ `src/` documentada en CLAUDE.md y crea un acoplamiento peligroso:
- Si `scheduling.ts` cambia, el comportamiento de la Edge Function cambia sin deploy explícito
- Deno (Edge Functions) y Vite (frontend) tienen resolución de módulos diferente
- No hay versionamiento de esta dependencia compartida

---

## 4. Mapa de Dependencias

### 4.1 Dependencias Externas (npm / CDN)

| Paquete | Versión | Uso en Trip Planner | Archivos |
|---------|---------|---------------------|----------|
| `@vis.gl/react-google-maps` | — | Mapa interactivo, APIProvider, Markers | `TripPlannerMap.tsx`, `TripPlannerStarterTemplate.tsx`, `PlannerChatDestinationCards.tsx` |
| `@supabase/supabase-js` | v2 | SDK cliente + Edge Function invocations | `useTripPlanner.ts`, `planner-agent/index.ts` |
| `react-day-picker` | — | Calendar widget en modal de fechas | `PlannerDateSelectionModal.tsx` |
| `date-fns` | — | Formateo de fechas (`format`, `addDays`, `differenceInDays`) | `utils.ts`, `scheduling.ts` |
| `lucide-react` | — | Iconos (Plane, Hotel, MapPin, etc.) | Múltiples componentes |
| shadcn/ui | — | Dialog, Sheet, Tabs, Badge, Button, ScrollArea | Múltiples componentes |

### 4.2 APIs del Navegador

| API | Uso | Archivos |
|-----|-----|----------|
| `IndexedDB` | Persistencia local (estado planner + geocoding cache) | `plannerStateCache.ts`, `geocodingCache.ts` |
| `localStorage` | Ancho de panel asistente, estado collapsed | `TripPlannerWorkspace.tsx` |
| `IntersectionObserver` | Visibilidad de segmentos para auto-selección en mapa | `TripPlannerWorkspace.tsx` |
| `performance.now()` | Timing de operaciones | `travel-itinerary/index.ts` |

### 4.3 Servicios Compartidos del Sistema

| Servicio | Módulo origen | Uso en Trip Planner |
|----------|--------------|---------------------|
| `handleFlightSearch` | `src/features/chat/services/` | Búsqueda de vuelos Starling desde el hook |
| `handleHotelSearch` | `src/features/chat/services/` | Búsqueda de hoteles EUROVIPS desde el hook |
| `makeBudget` | `src/services/` | Budget estimation para hoteles |
| `supabase` client | `src/integrations/supabase/client` | Cliente singleton Supabase |
| `debugTiming` | `src/utils/` (implícito) | Logging de timing |
| `concurrencyPool` | — | Control de concurrencia (pool size 4) |

### 4.4 Dependencias Implícitas (Cross-Feature)

| Dependencia | Dirección | Riesgo |
|-------------|-----------|--------|
| `scheduling.ts` ← `travel-itinerary` | Backend importa frontend | **Alto** — acoplamiento cruzado |
| `useTripPlanner` ← `chat/services` | Trip Planner depende de chat services | **Bajo** — reutilización legítima |
| `types.ts` ← `utils.ts` ← `scheduling.ts` | Cadena de dependencia interna | **Bajo** — esperado |
| `plannerGeocoding.ts` ← `geocodingCache.ts` | Servicio ← cache | **Bajo** — esperado |
| `placesService.ts` ← `plannerPlaceMapper.ts` | Servicio ← mapper | **Bajo** — esperado |

### 4.5 Grafo de Dependencias (Simplificado)

```
                    useTripPlanner.ts (2,649 LOC)
                    /    |     |     \        \
                   /     |     |      \        \
            types.ts  utils.ts  scheduling.ts  services/*  chat/services
              │         │           │              │
              │         │           │         ┌────┼────────┐────────┐
              │         │           │     places  geocoding  cache   matcher
              │         │           │     Service  Service   (IDB)   Service
              │         │           │         │       │
              │         │           │    Google API  Google/Nominatim
              │         │           │
              │         │           ▼
              │         │    travel-itinerary (1,662 LOC) ◄── IMPORT CRUZADO
              │         │           │
              │         │      OpenAI API
              │         │
              │         ▼
              │    planner-agent (948 LOC)
              │         │
              │    ┌────┼────────┐────────┐────────┐
              │    │    │        │        │        │
              │ flights hotels packages itinerary cityCode
              │    │    │        │        │
              │ Starling EUROVIPS EUROVIPS travel-   in-memory
              │                          itinerary
              ▼
        TripPlannerWorkspace (2,044 LOC)
           /        |          \
     Map (1,405)  Sidebar    Modals/Sections
          │        (336)     (Date, Place, Hotel, Transport)
     Google Maps
     JavaScript API
```

---

## 5. Roadmap de Mejoras

### P0 — Crítico (Deuda Técnica Estructural)

#### P0.1: Split `useTripPlanner.ts` en 5-7 hooks especializados

**Estado actual**: 2,649 LOC, 28+ funciones exportadas, 12 state vars, 6 refs, 6 effects.

**Propuesta de descomposición**:

| Hook | Responsabilidad | LOC est. |
|------|-----------------|----------|
| `usePlannerState` | Estado core, persistencia IndexedDB, carga/guardado | ~400 |
| `usePlannerGeneration` | Regeneración (planner, segment, day) vía Edge Functions | ~350 |
| `usePlannerHotels` | Búsqueda hoteles, matching inventario, quoting | ~500 |
| `usePlannerTransport` | Búsqueda vuelos, selección, auto-load | ~300 |
| `usePlannerPlaces` | Google Places enrichment, autofill, add place | ~400 |
| `usePlannerLocations` | Geocoding, resolución de coordenadas, warnings | ~250 |
| `useTripPlanner` (orquestador) | Composición de los hooks anteriores, API pública | ~300 |

**Beneficio**: Testing unitario posible, menor blast radius por cambio, colocalización de lógica.

#### P0.2: Split `TripPlannerWorkspace.tsx`

**Estado actual**: 2,044 LOC, 28 props, 14+ useState, 14+ useEffect.

**Propuesta**:
- Extraer `DayCarousel` a componente propio
- Extraer lógica de resize a `useResizablePanel` hook
- Extraer drag-and-drop a `useDragReorder` hook
- Extraer `useWorkspaceLayout` (mobileTab, assistantWidth, collapsed, sidebar)
- Reducir props con Context o composición

#### P0.3: Eliminar dependencia cruzada `travel-itinerary` → `scheduling.ts`

**Acción**: Copiar `normalizePlannerSegmentsScheduling` y sus dependencias a `supabase/functions/_shared/scheduling.ts`. Mantener como source-of-truth el frontend y sincronizar con un script de build o test.

---

### P1 — Alto (Correctness & Reliability)

#### P1.1: Eliminar `any` types (~30 instancias)

| Grupo | Acción |
|-------|--------|
| `message.meta as any` (×3) | Definir `PlannerMessageMeta` interface |
| `catch (error: any)` (×5+) | Usar `catch (error: unknown)` + type guards |
| `normalizePlannerState` (×13 en utils.ts) | Definir `RawPlannerResponse` interface para datos LLM |
| Google Places `as any` (×8) | Usar `@types/google.maps` correctamente o wrappers tipados |
| Backend tool responses (×8) | Definir `FlightResult`, `HotelResult`, `PackageResult` interfaces |

#### P1.2: Abort signals para operaciones async

Implementar `AbortController` en:
- `regeneratePlanner()`, `regenerateSegment()`, `regenerateDay()` — cancelar si el componente desmonta
- `loadHotelsForSegment()` — cancelar si el segmento cambia antes de completar
- `fetchPlaceDetails()`, `fetchNearbyPlacesByCategory()` — cancelar en re-render rápido
- `enrichPlannerWithLocations()` — cancelar si `conversationId` cambia

#### P1.3: Cache eviction

| Cache | Acción |
|-------|--------|
| `placesService.ts` — 3 Maps in-memory | Implementar LRU con máx. 500 entradas o TTL de 30 minutos |
| `geocodingCache.ts` — IndexedDB | Agregar limpieza proactiva de entradas expiradas (no solo skip en lectura) |
| `plannerStateCache.ts` — IndexedDB | Agregar TTL de 7 días y limpieza en `initGeocodingCache()` |

#### P1.4: Fix race conditions identificadas

- **Location enrichment** (P0 severity): Awaitar `persistPlannerState`, usar ref de versión para descartar writes obsoletos
- **Missing dependency** (`TripPlannerMap:414`): Agregar `selectedSegment` al dependency array
- **Auto-load guards**: Usar signature-based dedup con timestamps en lugar de boolean refs

---

### P2 — Medio (Quality & Observability)

#### P2.1: Tests unitarios

**Prioridad de testing por ROI**:

| Archivo | Tipo de test | Cobertura target | Justificación |
|---------|-------------|------------------|---------------|
| `scheduling.ts` (475 LOC) | Unit | 90%+ | Lógica pura, determinística, 16 reglas de clasificación |
| `utils.ts` — normalización (500 LOC) | Unit | 80%+ | Funciones puras, critical path |
| `utils.ts` — formateo (400 LOC) | Unit | 70%+ | Funciones puras, locale-dependent |
| `plannerGeocoding.ts` | Integration | 70%+ | Cadena de fallback (4 niveles) |
| `travel-itinerary` — JSON parsing | Unit | 90%+ | 4 niveles de repair, edge cases |
| `planner-agent` — agentLoop | Integration | 60%+ | Loop con timeout y guardrails |

#### P2.2: Logging estructurado

Reemplazar `console.log`/`console.error` con:
- **Frontend**: Logger condicional (`import.meta.env.DEV` guard) o integración con servicio de telemetría
- **Backend**: Ya aceptable para Deno Edge Functions, pero beneficiaría de log levels y request IDs consistentes

#### P2.3: Virtualización

`TripPlannerWorkspace` renderiza todos los segmentos/días en el DOM. Para viajes de 20+ días:
- Implementar virtualización con `react-window` o `@tanstack/react-virtual` para la lista de días
- Lazy render de contenido de segmentos no visibles

---

### P3 — Bajo (Polish & Future-Proofing)

#### P3.1: Accesibilidad

- Los componentes de loading ya usan `aria-live` y `aria-busy` (bien)
- Faltan: keyboard navigation en mapa, focus management en modales de hotel, screen reader labels en drag-and-drop de destinos
- Google Maps markers no tienen `aria-label` descriptivos

#### P3.2: Data-driven scheduling rules

`scheduling.ts` tiene 16 reglas hardcoded por keywords. Migrar a configuración:
```typescript
// De: regex inline en código
// A: JSON de reglas cargable/editable
const SCHEDULING_RULES: SchedulingRule[] = loadRules('scheduling-rules.json');
```

#### P3.3: Monolito `travel-itinerary/index.ts` (1,662 LOC)

Descomponer en módulos internos:
- `validation.ts` — validación de request
- `blueprints.ts` — distribución de días y blueprints de segmentos
- `prompts.ts` — construcción de prompts (system + user)
- `openai.ts` — llamadas OpenAI + JSON repair
- `normalization.ts` — normalización y expansión de response
- `index.ts` — handler HTTP (orquestador)

#### P3.4: Error handling estructurado

Definir un catálogo de errores tipados:
```typescript
type PlannerErrorCode =
  | 'GEOCODING_FAILED'
  | 'HOTEL_SEARCH_TIMEOUT'
  | 'LLM_PARSE_FAILED'
  | 'INVENTORY_MATCH_NOT_FOUND'
  | ...;
```

Permitiría retry inteligente, mensajes específicos al usuario, y métricas de error por tipo.

---

## Apéndice A: Métricas Resumidas

| Métrica | Valor |
|---------|-------|
| Archivos totales | 40 |
| LOC totales | 14,950 |
| LOC frontend | 12,340 (27 archivos) |
| LOC backend `planner-agent` | 948 (12 archivos) |
| LOC backend `travel-itinerary` | 1,662 (1 archivo) |
| Integraciones externas | 8 |
| Instancias de `any` | ~30 |
| Console logs en producción | ~20+ |
| Memory leaks identificados | 9 |
| Race conditions identificadas | 5 |
| Tests unitarios | 0 |
| Componentes >1,000 LOC | 3 (TripPlannerWorkspace, TripPlannerMap, useTripPlanner) |
| useEffect hooks totales (top 3 archivos) | 42+ |
| Modelos LLM usados | 2 (gpt-4.1-mini, gpt-4o-mini) |

## Apéndice B: Tipo Core — `TripPlannerState`

```typescript
interface TripPlannerState {
  id: string;
  conversationId: string;
  title: string;
  summary: string;
  startDate?: string;        // YYYY-MM-DD
  endDate?: string;
  isFlexibleDates: boolean;
  flexibleMonth?: string;
  flexibleYear?: number;
  days: number;
  budgetLevel: PlannerBudgetLevel;   // 'low' | 'mid' | 'high' | 'luxury'
  budgetAmount?: number;
  pace: PlannerPace;                  // 'relaxed' | 'balanced' | 'fast'
  travelers: { adults: number; children: number; infants: number };
  interests: string[];
  constraints: string[];
  destinations: string[];
  segments: PlannerSegment[];         // 1 por destino
  notes?: string;
  generalTips?: string[];
  generationMeta: {
    source: PlannerGenerationSource;
    updatedAt: string;
    version: number;
    uiPhase: PlannerUiPhase;
    isDraft: boolean;
    draftOriginMessage?: string;
  };
}
```

## Apéndice C: Agent Loop — Flujo de Decisión

```
                    ┌──────────────────┐
                    │  Mensaje usuario  │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
              ┌────►│  planNextAction() │◄────────────┐
              │     │  (GPT-4.1-mini)  │              │
              │     └────────┬─────────┘              │
              │              │                         │
              │     ┌────────┼────────────┐           │
              │     ▼        ▼            ▼           │
              │  respond   ask_user   use_tools       │
              │     │        │            │           │
              │     ▼        ▼            ▼           │
              │  Return   Return      Execute 1-3    │
              │  answer   needsInput  tools parallel  │
              │                           │           │
              │                    Store results      │
              │                           │           │
              │                    iteration < 5?     │
              │                    timeout < 55s?     │
              │                      │         │      │
              │                     YES        NO     │
              │                      │         │      │
              └──────────────────────┘    Return best │
                                          response    │
                                          from steps──┘
```
