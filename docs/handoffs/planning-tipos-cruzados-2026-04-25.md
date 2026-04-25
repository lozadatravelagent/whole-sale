> **ESTADO: EJECUTADO** — 2026-04-25  
> Core ejecutado en PR #79 (FlightData/LocalHotelData → @/types/external). Remanentes cerrados en `refactor/types-cruzados-cleanup`: LocalPackageData/LocalServiceData movidos, mislabeling D27→D30 corregido, D37/D38 registrados. Ver TECH_DEBT.md.

---

# Planning B2 — Fronteras de tipos chat ↔ trip-planner
**Fecha:** 2026-04-25  
**Modo:** READ-ONLY. Sin cambios a src/. Sin commits.  
**Baseline tests:** 311 / 11 / 0

---

## 1. Resumen ejecutivo

El cruce entre chat y trip-planner es casi perfectamente simétrico en cantidad de líneas de import (26 vs 24), pero **asimétricamente incorrecto en semántica**: chat depende de trip-planner por razones arquitecturalmente válidas (orquestador usa dominio), pero trip-planner depende de chat porque `FlightData` / `LocalHotelData` nacieron en el módulo equivocado y `searchHandlers.ts` creció hasta ser servido por dos features. Los top 5 símbolos cruzados son: `TripPlannerState`, `LocalHotelData`, `FlightData`, `MessageRow`, `PlannerEditorialData`. Los tres primeros tienen dueño semántico incorrecto o no tienen dueño semántico en ninguna de las dos features. La recomendación es **Opción A + retención de servicios** (mover los tipos de API a `src/types/search/`, dejar searchHandlers donde está con documentación explícita).

---

## 2. Inventario completo

### 2.A — chat importa de trip-planner (output literal del grep)

```
src/features/chat/ChatFeature.tsx:23:import TripPlannerWorkspace from '@/features/trip-planner/components/TripPlannerWorkspace';
src/features/chat/ChatFeature.tsx:24:import useTripPlanner from '@/features/trip-planner/useTripPlanner';
src/features/chat/ChatFeature.tsx:25:import { buildPlannerPromptContext } from '@/features/trip-planner/utils';
src/features/chat/components/ChatInterface.tsx:7:import MissingFieldsInputPrompt from '@/features/trip-planner/components/MissingFieldsInputPrompt';
src/features/chat/components/DiscoveryMapPreview.tsx:2:import { HAS_MAP, MAPBOX_TOKEN } from '@/features/trip-planner/map';
src/features/chat/components/ItineraryPanel.tsx:17:import type { TripPlannerState } from '@/features/trip-planner/types';
src/features/chat/components/ItineraryPanel.tsx:24:} from '@/features/trip-planner/utils';
src/features/chat/components/MessageItem.tsx:14:import type { TripPlannerState } from '@/features/trip-planner/types';
src/features/chat/components/MessageItem.tsx:15:import type { PlannerEditorialData } from '@/features/trip-planner/editorial';
src/features/chat/components/MessageItem.tsx:16:import { formatBudgetLevel, formatDateRange, formatDestinationLabel, formatFlexibleMonth, formatPaceLabel } from '@/features/trip-planner/utils';
src/features/chat/components/PlannerEditorialBlock.tsx:5:import type { PlannerEditorialData, EditorialSegment, EditorialNextAction } from '@/features/trip-planner/editorial';
src/features/chat/components/SuggestionChips.tsx:5:import type { DiscoveryCard, PlannerSuggestion, PlannerSuggestionType } from '@/features/trip-planner/types';
src/features/chat/components/__tests__/ItineraryPanel.test.tsx:6:import type { TripPlannerState } from '@/features/trip-planner/types';
src/features/chat/hooks/useMessageHandler.ts:17:import type { PlannerFieldProvenance, TripPlannerState } from '@/features/trip-planner/types';
src/features/chat/hooks/useMessageHandler.ts:18:import { applySmartDefaults, normalizePlannerState } from '@/features/trip-planner/utils';
src/features/chat/hooks/useMessageHandler.ts:19:import { mergePlannerFieldUpdate, normalizeLocationLabel, buildPlannerHotelSearchSignature, buildPlannerTransportSearchSignature } from '@/features/trip-planner/helpers';
src/features/chat/hooks/useMessageHandler.ts:21:import { buildEditorialData } from '@/features/trip-planner/editorial';
src/features/chat/services/conversationOrchestrator.ts:2:import type { TripPlannerState, PlannerActivity, PlannerRestaurant } from '@/features/trip-planner/types';
src/features/chat/services/discoveryService.ts:5:import type { PlannerPlaceCandidate, PlannerPlaceCategory, TripPlannerState } from '@/features/trip-planner/types';
src/features/chat/services/itineraryPipeline.ts:8:import type { TripPlannerState, PlannerSegment } from '@/features/trip-planner/types';
src/features/chat/services/itineraryPipeline.ts:9:import type { PlannerEditorialData, BuildEditorialOptions } from '@/features/trip-planner/editorial';
src/features/chat/services/searchHandlers.ts:25:import type { TripPlannerState } from '@/features/trip-planner/types';
src/features/chat/services/searchHandlers.ts:26:import { expandDestinationsIfRegional, getInclusiveDateRangeDays, normalizePlannerState, summarizePlannerForChat } from '@/features/trip-planner';
src/features/chat/services/searchHandlers.ts:27:import { buildEditorialData } from '@/features/trip-planner/editorial';
src/features/chat/utils/hasItineraryContent.ts:1:import type { TripPlannerState } from '@/features/trip-planner/types';
src/features/chat/__tests__/hasItineraryContent.test.ts:3:import type { TripPlannerState } from '@/features/trip-planner/types';
```

**Total líneas de import: 26** (incluye 2 en tests).

| Archivo origen (chat) | Línea | Símbolo(s) importado(s) | Path destino | Tipo |
|---|---|---|---|---|
| ChatFeature.tsx | 23 | `TripPlannerWorkspace` | trip-planner/components/TripPlannerWorkspace | COMPONENT |
| ChatFeature.tsx | 24 | `useTripPlanner` | trip-planner/useTripPlanner | HOOK |
| ChatFeature.tsx | 25 | `buildPlannerPromptContext` | trip-planner/utils | UTIL_FN |
| ChatInterface.tsx | 7 | `MissingFieldsInputPrompt` | trip-planner/components/MissingFieldsInputPrompt | COMPONENT |
| DiscoveryMapPreview.tsx | 2 | `HAS_MAP, MAPBOX_TOKEN` | trip-planner/map | CONSTANT |
| ItineraryPanel.tsx | 17 | `TripPlannerState` | trip-planner/types | TYPE_INTERFACE |
| ItineraryPanel.tsx | 24 | `formatBudgetLevel, formatDateRange, formatDestinationLabel, ...` | trip-planner/utils | UTIL_FN |
| MessageItem.tsx | 14 | `TripPlannerState` | trip-planner/types | TYPE_INTERFACE |
| MessageItem.tsx | 15 | `PlannerEditorialData` | trip-planner/editorial | TYPE_INTERFACE |
| MessageItem.tsx | 16 | `formatBudgetLevel, formatDateRange, formatDestinationLabel, formatFlexibleMonth, formatPaceLabel` | trip-planner/utils | UTIL_FN |
| PlannerEditorialBlock.tsx | 5 | `PlannerEditorialData, EditorialSegment, EditorialNextAction` | trip-planner/editorial | TYPE_INTERFACE |
| SuggestionChips.tsx | 5 | `DiscoveryCard, PlannerSuggestion, PlannerSuggestionType` | trip-planner/types | TYPE_INTERFACE |
| ItineraryPanel.test.tsx | 6 | `TripPlannerState` | trip-planner/types | TYPE_INTERFACE (test) |
| useMessageHandler.ts | 17 | `PlannerFieldProvenance, TripPlannerState` | trip-planner/types | TYPE_INTERFACE |
| useMessageHandler.ts | 18 | `applySmartDefaults, normalizePlannerState` | trip-planner/utils | UTIL_FN |
| useMessageHandler.ts | 19 | `mergePlannerFieldUpdate, normalizeLocationLabel, buildPlannerHotelSearchSignature, buildPlannerTransportSearchSignature` | trip-planner/helpers | UTIL_FN |
| useMessageHandler.ts | 21 | `buildEditorialData` | trip-planner/editorial | UTIL_FN (pura, determinista) |
| conversationOrchestrator.ts | 2 | `TripPlannerState, PlannerActivity, PlannerRestaurant` | trip-planner/types | TYPE_INTERFACE |
| discoveryService.ts | 5 | `PlannerPlaceCandidate, PlannerPlaceCategory, TripPlannerState` | trip-planner/types | TYPE_INTERFACE |
| itineraryPipeline.ts | 8 | `TripPlannerState, PlannerSegment` | trip-planner/types | TYPE_INTERFACE |
| itineraryPipeline.ts | 9 | `PlannerEditorialData, BuildEditorialOptions` | trip-planner/editorial | TYPE_INTERFACE |
| searchHandlers.ts | 25 | `TripPlannerState` | trip-planner/types | TYPE_INTERFACE |
| searchHandlers.ts | 26 | `expandDestinationsIfRegional, getInclusiveDateRangeDays, normalizePlannerState, summarizePlannerForChat` | trip-planner (index) | UTIL_FN |
| searchHandlers.ts | 27 | `buildEditorialData` | trip-planner/editorial | UTIL_FN (pura) |
| hasItineraryContent.ts | 1 | `TripPlannerState` | trip-planner/types | TYPE_INTERFACE |
| hasItineraryContent.test.ts | 3 | `TripPlannerState` | trip-planner/types | TYPE_INTERFACE (test) |

---

### 2.B — trip-planner importa de chat (output literal del grep)

```
src/features/trip-planner/components/PlannerChatFlightCard.tsx:2:import type { FlightData } from '@/features/chat/types/chat';
src/features/trip-planner/components/PlannerChatHotelCard.tsx:2:import type { LocalHotelData } from '@/features/chat/types/chat';
src/features/trip-planner/components/PlannerContextSidebar.tsx:20:import type { LocalHotelData } from '@/features/chat/types/chat';
src/features/trip-planner/components/PlannerHotelInventoryDetailPanel.tsx:20:import type { LocalHotelData } from '@/features/chat/types/chat';
src/features/trip-planner/components/TripPlannerMap.tsx:20:import { getHotelsFromStorage } from '@/features/chat/services/hotelStorageService';
src/features/trip-planner/components/TripPlannerMap.tsx:21:import type { LocalHotelData } from '@/features/chat/types/chat';
src/features/trip-planner/components/TripPlannerWorkspace.tsx:10:import MessageInput from '@/features/chat/components/MessageInput';
src/features/trip-planner/components/TripPlannerWorkspace.tsx:11:import MessageItem from '@/features/chat/components/MessageItem';
src/features/trip-planner/components/TripPlannerWorkspace.tsx:12:import type { LocalHotelData, MessageRow } from '@/features/chat/types/chat';
src/features/trip-planner/components/TripPlannerWorkspace.tsx:67:import SuggestionChips from '@/features/chat/components/SuggestionChips';
src/features/trip-planner/helpers.ts:1:import type { MessageRow } from '@/features/chat/types/chat';
src/features/trip-planner/helpers.ts:2:import type { LocalHotelData } from '@/features/chat/types/chat';
src/features/trip-planner/hooks/usePlannerHotels.ts:3:import { handleHotelSearch } from '@/features/chat/services/searchHandlers';
src/features/trip-planner/hooks/usePlannerHotels.ts:5:import type { LocalHotelData } from '@/features/chat/types/chat';
src/features/trip-planner/hooks/usePlannerState.ts:3:import type { MessageRow } from '@/features/chat/types/chat';
src/features/trip-planner/hooks/usePlannerTransport.ts:3:import { handleFlightSearch } from '@/features/chat/services/searchHandlers';
src/features/trip-planner/services/plannerHotelMatcher.ts:2:import type { LocalHotelData } from '@/features/chat/types/chat';
src/features/trip-planner/types.ts:1:import type { FlightData, LocalHotelData } from '@/features/chat/types/chat';
src/features/trip-planner/utils.ts:3:import type { FlightData, LocalHotelData } from '@/features/chat/types/chat';
src/features/trip-planner/useTripPlanner.ts:2:import type { MessageRow } from '@/features/chat/types/chat';
src/features/trip-planner/__tests__/conversationOrchestrator.test.ts:8:} from '@/features/chat/services/conversationOrchestrator';
src/features/trip-planner/__tests__/conversationOrchestrator.test.ts:9:import { curateDiscoveryPlaces, detectDiscoverySubtype, hasStrongPlaceIdentity, isAttractionLikePlace } from '@/features/chat/services/discoveryService';
src/features/trip-planner/__tests__/itineraryPipeline.test.ts:10:} from '@/features/chat/services/itineraryPipeline';
src/features/trip-planner/__tests__/itineraryPipeline.test.ts:11:import type { ConversationTurnResolution } from '@/features/chat/services/conversationOrchestrator';
```

**Total líneas de import: 24** (incluye 4 en tests).

| Archivo origen (trip-planner) | Línea | Símbolo(s) importado(s) | Path destino | Tipo |
|---|---|---|---|---|
| PlannerChatFlightCard.tsx | 2 | `FlightData` | chat/types/chat | TYPE_INTERFACE |
| PlannerChatHotelCard.tsx | 2 | `LocalHotelData` | chat/types/chat | TYPE_INTERFACE |
| PlannerContextSidebar.tsx | 20 | `LocalHotelData` | chat/types/chat | TYPE_INTERFACE |
| PlannerHotelInventoryDetailPanel.tsx | 20 | `LocalHotelData` | chat/types/chat | TYPE_INTERFACE |
| TripPlannerMap.tsx | 20 | `getHotelsFromStorage` | chat/services/hotelStorageService | SERVICE (IndexedDB) |
| TripPlannerMap.tsx | 21 | `LocalHotelData` | chat/types/chat | TYPE_INTERFACE |
| TripPlannerWorkspace.tsx | 10 | `MessageInput` | chat/components/MessageInput | COMPONENT |
| TripPlannerWorkspace.tsx | 11 | `MessageItem` | chat/components/MessageItem | COMPONENT |
| TripPlannerWorkspace.tsx | 12 | `LocalHotelData, MessageRow` | chat/types/chat | TYPE_INTERFACE |
| TripPlannerWorkspace.tsx | 67 | `SuggestionChips` | chat/components/SuggestionChips | COMPONENT |
| helpers.ts | 1 | `MessageRow` | chat/types/chat | TYPE_INTERFACE |
| helpers.ts | 2 | `LocalHotelData` | chat/types/chat | TYPE_INTERFACE |
| usePlannerHotels.ts | 3 | `handleHotelSearch` | chat/services/searchHandlers | SERVICE (Supabase + fetch) |
| usePlannerHotels.ts | 5 | `LocalHotelData` | chat/types/chat | TYPE_INTERFACE |
| usePlannerState.ts | 3 | `MessageRow` | chat/types/chat | TYPE_INTERFACE |
| usePlannerTransport.ts | 3 | `handleFlightSearch` | chat/services/searchHandlers | SERVICE (Supabase + fetch) |
| plannerHotelMatcher.ts | 2 | `LocalHotelData` | chat/types/chat | TYPE_INTERFACE |
| types.ts | 1 | `FlightData, LocalHotelData` | chat/types/chat | TYPE_INTERFACE |
| utils.ts | 3 | `FlightData, LocalHotelData` | chat/types/chat | TYPE_INTERFACE |
| useTripPlanner.ts | 2 | `MessageRow` | chat/types/chat | TYPE_INTERFACE |
| __tests__/conversationOrchestrator.test.ts | 8–9 | servicios de conversationOrchestrator, discoveryService | chat/services/ | SERVICE (tests) |
| __tests__/itineraryPipeline.test.ts | 10–11 | servicios de itineraryPipeline, ConversationTurnResolution | chat/services/ | SERVICE + TYPE (tests) |

---

### 2.C — Conteo agregado por símbolo cruzado

| Símbolo | Definido en | Dirección | # archivos consumidores (no-test) | # uses totales |
|---|---|---|---|---|
| `TripPlannerState` | trip-planner/types.ts (ln 281, ~44 LOC) | trip-planner → chat | 8 | 31 |
| `LocalHotelData` | chat/types/chat.ts (ln 217, ~35 LOC) | chat → trip-planner | 10 | 31 |
| `FlightData` | chat/types/chat.ts (ln 15, ~200 LOC) | chat → trip-planner | 3 (+types.ts) | 16 |
| `MessageRow` | chat/types/chat.ts (ln 4, alias Supabase) | chat → trip-planner | 4 | 9 |
| `PlannerEditorialData` | trip-planner/editorial.ts (ln 57, ~11 LOC) | trip-planner → chat | 3–4 | 7 |
| `handleHotelSearch` | chat/services/searchHandlers.ts (ln 829) | chat → trip-planner | 1 | 2 |
| `handleFlightSearch` | chat/services/searchHandlers.ts (ln 414) | chat → trip-planner | 1 | 2 |
| `getHotelsFromStorage` | chat/services/hotelStorageService.ts | chat → trip-planner | 1 | 2 |

---

### 2.D — Núcleo del cruce: top 5 símbolos en detalle

#### 1. `TripPlannerState` (trip-planner/types.ts, ln 281–324, 44 LOC)

- **Tipo de símbolo:** `interface` pura — solo datos, sin métodos ni funciones embebidas.
- **Depende de:** `FlightData, LocalHotelData` (desde chat/types/chat.ts, línea 1 de types.ts), `HotelDistanceTag` (trip-planner/utils), y tipos locales: `PlannerBudgetLevel`, `PlannerPace`, `PlannerSegment`, `PlannerFieldProvenance`, `PlannerGenerationSource`.
- **Crítico:** El estado canónico del planner (`TripPlannerState`) embebe `LocalHotelData` y `FlightData` vía `PlannerSegment`. Esto significa que para definir TripPlannerState, trip-planner/types.ts importa de chat desde su primera línea.
- **Git log (types.ts):**  
  `c7f04b7b feat(chat): enhance chat feature with new sidebar and navigation improvements`  
  `4077486b feat(hotelbeds): integrate Hotelbeds API for hotel search and booking`  
  `22eebe76 feat(trip-planner): integrate Trip Planner feature into chat interface`

#### 2. `LocalHotelData` (chat/types/chat.ts, ln 217–251, 35 LOC)

- **Tipo de símbolo:** `interface` pura — solo datos (nombre, ciudad, rooms[], check_in, check_out, noches, proveedor).
- **Depende de:** solo primitivos TS. Sin imports.
- **Semántica real:** Forma del resultado de una búsqueda de hotel de EUROVIPS / HOTELBEDS. No es un concepto de "chat" — es un contrato de API externa.
- **Git log (chat.ts):**  
  `c7f04b7b feat(chat): enhance chat feature with new sidebar and navigation improvements`  
  `4077486b feat(hotelbeds): integrate Hotelbeds API for hotel search and booking`  
  `22eebe76 feat(trip-planner): integrate Trip Planner feature into chat interface`

#### 3. `FlightData` (chat/types/chat.ts, ln 15–215, ~200 LOC)

- **Tipo de símbolo:** `interface` pura — solo datos (vuelo, precio, escalas, aerolínea, etc.).
- **Depende de:** solo primitivos. Sin imports.
- **Semántica real:** Forma del resultado de una búsqueda de vuelo de Starling. No es un concepto de "chat" — es un contrato de API externa.

#### 4. `MessageRow` (chat/types/chat.ts, ln 4, 1 LOC)

- **Tipo de símbolo:** `type` alias — `Database['public']['Tables']['messages']['Row']` — mapeado desde Supabase.
- **Depende de:** `@/integrations/supabase/types` (generado automáticamente).
- **Semántica real:** Fila de la tabla `messages` de la BD. Es un concepto que pertenece a chat/conversación (no a trip-planner), pero trip-planner lo necesita porque `TripPlannerWorkspace` renderiza mensajes y los hooks de planner reciben el historial de mensajes como input.
- **Distinción:** Este cruce es conceptualmente distinto — trip-planner lo usa para renderizar UI compartida (MessageItem, MessageInput) dentro del workspace. Si se re-arquitecta `TripPlannerWorkspace` sin embeber el renderizado de mensajes, este cruce desaparece solo.

#### 5. `PlannerEditorialData` (trip-planner/editorial.ts, ln 57–83, ~27 LOC)

- **Tipo de símbolo:** `interface` pura — solo datos para la UI de chat (blocks, segments, nextActions).
- **Depende de:** tipos internos a editorial.ts (`EditorialSegment`, `EditorialNextAction`), que a su vez dependen de tipos en trip-planner/types.ts.
- **Función asociada:** `buildEditorialData(TripPlannerState) → PlannerEditorialData` — pura y determinista.
- **Semántica:** Este símbolo es el "output de presentación" del planner hacia el chat. Correcto que chat lo consuma. Dirección correcta.

---

### 2.E — Detección de ciclos

```
grep -rn "from.*trip-planner" src/features/chat/ ... | wc -l  → 26
grep -rn "from.*chat" src/features/trip-planner/ ... | wc -l  → 24
```

La auditoría previa reportaba "12+ vs 3+". Los números reales son **26 vs 24** — casi simétrico. El error anterior probablemente contó solo imports de `types` excluyendo servicios y componentes.

**Ciclos de servicio (los más críticos):**

Ciclo 1 — `usePlannerHotels ↔ searchHandlers`:
- `trip-planner/hooks/usePlannerHotels.ts` → `chat/services/searchHandlers.ts` (`handleHotelSearch`)
- `chat/services/searchHandlers.ts` → `trip-planner/types.ts` (`TripPlannerState`)
- `trip-planner/types.ts` → `chat/types/chat.ts` (`FlightData, LocalHotelData`)

Ciclo 2 — `usePlannerTransport ↔ searchHandlers`:
- `trip-planner/hooks/usePlannerTransport.ts` → `chat/services/searchHandlers.ts` (`handleFlightSearch`)
- `chat/services/searchHandlers.ts` → `trip-planner/types.ts` (`TripPlannerState`)
- `trip-planner/types.ts` → `chat/types/chat.ts` (mismo que arriba)

Ciclo 3 — `types.ts ↔ chat.ts` (fundacional):
- `trip-planner/types.ts` (línea 1) importa `FlightData, LocalHotelData` desde `chat/types/chat.ts`
- `chat/services/searchHandlers.ts` importa `TripPlannerState` desde `trip-planner/types.ts`
→ No es un ciclo de importación directo (TypeScript no lo rechaza), pero sí un ciclo conceptual: el módulo que define el estado del dominio depende del módulo de tipos de la capa de orquestación.

**Par simétrico exacto (máximo peligro):**  
`trip-planner/types.ts` importa de `chat/types/chat.ts` Y `chat/services/searchHandlers.ts` importa de `trip-planner/types.ts`. Es el ciclo fundacional.

---

## 3. Análisis por símbolo — dueño semántico

### `TripPlannerState`
**Dueño: trip-planner**. Es el estado canónico del workspace del planificador — origen, destinos, fechas, segmentos, presupuesto. Chat lo orquesta y lee, pero no lo define conceptualmente. Problema: embebe `LocalHotelData` y `FlightData` que están en chat.

### `LocalHotelData`
**Dueño: ninguno de los dos**. Es la forma del resultado de hoteles de EUROVIPS/HOTELBEDS — un contrato de API externa. Aterrizó en `chat/types/chat.ts` históricamente porque la búsqueda de hoteles se implementó primero en el chat, pero no representa un concepto de "conversación". El dueño correcto es `src/types/search/` o `src/services/types/`.

### `FlightData`
**Dueño: ninguno de los dos**. Mismo razonamiento: contrato de API Starling. 200 LOC de datos de vuelo que no son ni "chat" ni "planner". Aterrizó en chat por razones históricas. El dueño correcto es `src/types/search/`.

### `MessageRow`
**Dueño: chat**. Es un alias de la fila de la tabla `messages` de Supabase — pertenece al dominio de conversación. trip-planner lo necesita únicamente porque `TripPlannerWorkspace` renderiza mensajes dentro del workspace (embebe `MessageItem`, `MessageInput`). Si la arquitectura de workspace cambiara para separar "panel de mensajes" de "panel de planner", este cruce desaparecería naturalmente. No es un problema de tipo sino un acoplamiento de componentes.

### `PlannerEditorialData`
**Dueño: trip-planner**. Es la representación editorial del estado del planner para renderizar en chat. El flujo `TripPlannerState → buildEditorialData() → PlannerEditorialData → chat UI` es correcto y unidireccional. Este cruce NO es un problema — es diseño correcto.

---

## 4. Opciones arquitectónicas evaluadas

### Opción A — Common module (`src/types/search/`)

Mover `FlightData`, `LocalHotelData` (y tipos satélite: `LocalHotelSegmentResult`, `LocalCombinedTravelResults`, `LocalHotelChainBalance`, `LocalHotelChainQuota`) a `src/types/search/`. Tanto chat como trip-planner importan de ahí.

- **Pro:** Mecánico y correcto semánticamente. Los tipos son contratos de APIs externas — pertenecen a `src/types/` por convención del proyecto (donde ya viven otros tipos globales). Elimina el ciclo fundacional `trip-planner/types.ts → chat/types/chat.ts`.
- **Contra:** Es un movimiento de archivo, no una reestructuración. Requiere actualizar ~20 archivos de imports. Sin política explícita puede crecer. Riesgo de romperse si se incluyen tipos con lógica.
- **Política necesaria:** `src/types/search/` = solo tipos de datos, zero lógica, zero imports de features.
- **Esfuerzo:** 1–2 horas (grep + sed en imports). Sin cambio de lógica.
- **Riesgo:** Bajo. Solo cambio de paths en imports.

### Opción B — Inversión de dependencias

Chat define interfaces (`IHotelSearchProvider`, `IFlightSearchProvider`) en `chat/contracts/`. trip-planner implementa esos contratos o los consume vía DI.

- **Pro:** Elimina el ciclo de servicio (`usePlannerHotels → searchHandlers`). Chat queda agnóstico al implementador.
- **Contra:** Sobreingeniería. trip-planner es hoy el único consumidor de `handleHotelSearch` / `handleFlightSearch` fuera de chat. Añade boilerplate de interfaces y registros DI que no retorna valor proporcional. 
- **Esfuerzo:** Alto. Implica refactorizar `searchHandlers.ts` (1800+ LOC) para extraer interfaz + implementation.
- **Riesgo:** Medio-alto. searchHandlers es complejo, cualquier refactor introduce riesgo de regresión.

### Opción C — Status quo + linting

Aceptar el cruce actual. Agregar `eslint-plugin-boundaries` con reglas que documenten qué cruces están permitidos.

- **Pro:** Cero refactor. Formaliza estado actual. Detecta nuevos cruces no autorizados.
- **Contra:** Codifica el problema. `FlightData` y `LocalHotelData` seguirían en el módulo equivocado. El ciclo fundacional persiste. Cuando alguien modifique `chat/types/chat.ts` creyendo que es "solo para chat" romperá trip-planner.
- **Esfuerzo:** Bajo (1h setup de eslint-plugin-boundaries).
- **Riesgo:** Bajo en el corto plazo, acumula deuda.

### Opción D — Híbrido A + documentación de servicios

1. Mover `FlightData`, `LocalHotelData` y tipos satélite a `src/types/search/` (A).
2. Dejar `searchHandlers.ts` en chat, pero agregar un comentario de política en el encabezado del archivo que documente explícitamente que es shared entre chat y trip-planner.
3. NO extraer interfaces DI (rechazar B por ahora).
4. Añadir `eslint-plugin-boundaries` para bloquear nuevos cruces no autorizados (preventivo).

- **Pro:** Resuelve el ciclo fundacional (el más crítico). Costo bajo. Deja el ciclo de servicio documentado y estable. Habilita que trip-planner/types.ts deje de importar de chat.
- **Contra:** El ciclo de servicio (`usePlannerHotels → searchHandlers`) persiste. Aceptable si searchHandlers no va a ser partido.
- **Esfuerzo:** Medio (2–3h). Solo imports + config eslint.
- **Riesgo:** Bajo.

---

## 5. Recomendación con justificación numerada

**Recomendación: Opción D (Híbrido A + documentación de servicios)**

Justificación basada en los números del Paso 1:

1. **El ciclo fundacional es el problema principal.** `trip-planner/types.ts` línea 1 importa `FlightData, LocalHotelData` desde chat. Esto significa que el tipo canónico del dominio del planner (31 uses en chat, 8 archivos consumidores) depende de un módulo de orquestación. Ese cruce es incorrecto semánticamente y tiene solución mecánica sin riesgo.

2. **`FlightData` y `LocalHotelData` no pertenecen a chat.** Tienen 0 imports de chat internamente (solo primitivos). Aterrizaron ahí por historia, no por diseño. Con 31 uses en trip-planner y presencia en `trip-planner/types.ts` (el módulo más importado del codebase), el dueño correcto es neutral: `src/types/search/`.

3. **El ciclo de servicio (`usePlannerHotels/usePlannerTransport → searchHandlers`) no justifica refactor.** Son 2 call sites. `searchHandlers.ts` tiene 1800+ LOC — cualquier reestructuración para extraer contratos DI tiene alto riesgo de regresión y bajo retorno. Documentarlo explícitamente y bloquearlo con linting es suficiente.

4. **`PlannerEditorialData` y `TripPlannerState` en chat son correctos.** Chat orquesta y renderiza el planner — depender de sus tipos es diseño válido. Estos 20 de las 26 líneas de import son correctas y no deben moverse.

5. **`MessageRow` en trip-planner es un síntoma de arquitectura, no de tipos.** Desaparecería si `TripPlannerWorkspace` dejara de embeber el rendering de mensajes. No hay que resolver esto ahora.

**Plan concreto (si se aprueba):**

1. Crear `src/types/search/index.ts` con: `FlightData`, `LocalHotelData`, `LocalHotelSegmentResult`, `LocalCombinedTravelResults`, `LocalHotelChainBalance`, `LocalHotelChainQuota`, `LocalPackageData`, `LocalServiceData`.
2. Actualizar imports en ~20 archivos (grep-replace mecánico).
3. Añadir header comment en `searchHandlers.ts` marcándolo como shared service.
4. Configurar `eslint-plugin-boundaries` con regla: `trip-planner` NO puede importar de `chat/services/` ni `chat/components/` ni `chat/types/` — con excepciones documentadas para los 3 SERVICE calls actuales.

---

## 6. Decisión sobre orden B1 vs decisión de tipos (useContextualMemory)

**Bloque de imports literal de `useContextualMemory.ts` (primeras 30 líneas):**

```typescript
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { ContextState } from '../types/contextState';
import { isValidContextState } from '../types/contextState';
```

**Conclusión:** `useContextualMemory` importa únicamente de:
- `react`
- `@/integrations/supabase/client` (Supabase SDK)
- `@/services/aiMessageParser` (tipos de parsing NLP)
- `../types/contextState` (tipo interno a chat)

**Cero imports de trip-planner. Cero imports de chat/types/chat.ts.**

→ **B1 es completamente independiente de la decisión de tipos.** La extracción de `useContextualMemory` a `messageStorageService.ts` puede ejecutarse antes, después, o en paralelo con la migración de tipos. No hay bloqueo.

---

## 7. Preguntas abiertas que requieren decisión humana

1. **¿Aprobás mover `FlightData` / `LocalHotelData` a `src/types/search/`?**  
   Implica actualizar ~20 archivos de imports. Ningún cambio de lógica. ¿Qué nombre preferís para el módulo destino: `src/types/search/`, `src/types/api/`, `src/services/types/`?

2. **¿Aceptás que el ciclo de servicio `usePlannerHotels → searchHandlers` quede como deuda documentada, sin extraer contratos DI?**  
   La alternativa (Opción B) requeriría partir `searchHandlers.ts` de 1800 LOC — esfuerzo alto, sin retorno proporcional actual.

3. **¿Querés agregar `eslint-plugin-boundaries` ahora como parte de esta tarea, o es un paso separado?**  
   La configuración es ~30 líneas en `.eslintrc` pero requiere decisión sobre qué cruces se permiten explícitamente.

4. **`TripPlannerWorkspace` embebe `MessageInput`, `MessageItem`, `SuggestionChips` de chat** — 4 imports de COMPONENT desde trip-planner. ¿Esto está en scope de B2 o es arquitectura que se deja para más adelante?

5. **`MessageRow` en trip-planner:** ¿el workspace va a seguir renderizando mensajes dentro del mismo componente, o hay un plan de separar panel de chat de panel de planner? La respuesta define si `MessageRow` en trip-planner es permanente o transitorio.
