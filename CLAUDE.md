# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Development Rules

**CRITICAL GUIDELINES - ALWAYS FOLLOW:**
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files
- Only create documentation files if explicitly requested by the User

## Project Overview

This is a React-based wholesale travel CRM application called "WholeSale Connect AI" - a multi-tenant SaaS platform for travel agencies to manage leads, conversations, and booking integrations. The application is built using Vite, TypeScript, React Router, and shadcn/ui components with Tailwind CSS styling.

## Development Commands

#DON'T MAKE MOCK DATA

- `npm run dev` - Start development server (runs on port 8080)
- `npm run build` - Build for production
- `npm run build:dev` - Build for development mode
- `npm run lint` - Run ESLint to check code quality
- `npm run preview` - Preview production build
- `npm run start` - Serve production build (used by Railway deployment)
- `npm run mcp:check` - Check Model Context Protocol server version
- `npm run mcp:install` - Install MCP Supabase server

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite with SWC plugin for fast compilation
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system variables
- **State Management**: Custom hooks with Supabase Realtime, React Context (AuthContext), React Hook Form for forms, TanStack Query (minimal usage)
- **Routing**: React Router v6
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Authentication**: Supabase Auth with centralized AuthContext for role-based permissions
- NO hardcoded data ni mock data

### Project Structure

```
src/
├── components/
│   ├── ui/           # shadcn/ui component library
│   ├── crm/          # CRM-specific components (LeadCard, LeadDialog)
│   └── layout/       # Layout components (MainLayout)
├── contexts/         # React Context providers (AuthContext)
├── features/         # Feature-based modules
│   └── chat/         # Chat feature (components, hooks, services, transformers)
├── pages/            # Route-level page components
├── hooks/            # Custom React hooks (useChat, useLeads, useReports)
├── integrations/     # External service integrations (Supabase client & types)
├── lib/              # Utility libraries (utils, supabase-leads)
├── services/         # API integration services (hotelSearch, airfareSearch, cityCodeService)
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

### Key Features & Components

1. **Multi-tenant Architecture**: Supports agencies under tenants with role-based access (OWNER, SUPERADMIN, ADMIN, SELLER)
2. **CRM System**: Lead management with customizable sections, statuses, and Kanban board with drag-drop
3. **Chat System**: Advanced web chat with real-time messaging, 5-layer message deduplication, auto-reconnection, per-conversation typing indicators, and contextual memory for travel requests
4. **Travel Integrations**: Active integrations with STARLING (primary via Edge Functions), EUROVIPS (SOAP), and LOZADA credentials
5. **Flight Analysis**: Sophisticated search with per-leg connection metrics, airline-specific baggage analysis, light fare detection, and multi-stage filtering (stops, luggage, layover duration)
6. **Hotel Search**: EUROVIPS integration with getCountryList validation and searchHotelFares functionality
7. **Quote Generation**: PDFMonkey integration for customizable travel quotes with template support
8. **Dashboard**: Comprehensive metrics with personal performance, team tracking, tenant aggregation, and channel distribution

### Database Schema (Supabase)

Key entities include:
- `tenants` - Top-level organization
- `agencies` - Travel agencies within tenants
- `users` - Agency users with role-based permissions (OWNER, SUPERADMIN, ADMIN, SELLER)
- `leads` - Travel inquiries with contact, trip details, and status tracking
- `conversations` - Web chat conversations linked to leads with real-time subscriptions
- `messages` - Chat messages with client_id for deduplication, supports real-time updates
- `integrations` - External provider API credentials and status

**Real-time Features:**
- `conversations` and `messages` tables have Realtime subscriptions enabled
- Optimistic UI updates with temporary IDs before database persistence
- RLS policies enforce agency-level data isolation
- Custom RPC function: `get_conversations_with_agency` for efficient querying

### Styling System

The project uses a comprehensive design system with:
- CSS custom properties for colors, shadows, and transitions
- Extended Tailwind configuration with custom color palette
- Support for light/dark themes via `next-themes`
- Custom gradient backgrounds and shadow utilities

### State Management Patterns

The application uses a **hybrid approach** with multiple state management strategies:

- **Server State & Real-time**:
  - **Primary Pattern**: Custom hooks wrapping Supabase Realtime (useMessages, useConversations, useChat)
  - **Secondary**: TanStack Query (installed but minimal usage, QueryClient configured for potential expansion)
  - Real-time postgres_changes subscriptions for live updates
  - Auto-reconnection with exponential backoff (30s timeout, 30s heartbeat)

- **Global State**:
  - **AuthContext** (`src/contexts/AuthContext.tsx`) - Centralized authentication with role-based permissions
  - ThemeProvider for dark/light mode
  - Global event system (`window.dispatchEvent`) for cross-component communication

- **Form State**: React Hook Form with Zod validation for lead forms, travel selection, PDF templates

- **Component State**:
  - useState/useRef for local component state
  - Per-conversation typing indicators (`typingByConversation` object)
  - Optimistic UI updates with temporary IDs
  - Contextual memory for travel requests (`previousParsedRequest`)

**Note**: While TanStack Query is available, the dominant pattern is **Custom Hooks + Supabase Realtime + Context** for most data operations.

### Integration Points

- **Supabase**: Authentication with AuthContext, real-time database subscriptions, file storage, Edge Functions
- **Travel Providers**:
  - **STARLING** (Primary): Flight search via Supabase Edge Functions (`starling-search`)
  - **EUROVIPS**: Hotel and airfare search via SOAP WebService (dual-mode: Edge Function in production, CORS proxy in development)
  - **LOZADA**: Credentials for WebService authentication (username: LOZADAWS, agency: 20350)
  - **Note**: DELFOS and ICARO are defined in types but not actively implemented
- **PDF Generation**: PDFMonkey integration for customizable quote documents with template support
- **Dual-mode Architecture**:
  - Production: Supabase Edge Functions for API calls
  - Development: Direct SOAP calls via CORS proxy (`/api/hotel`, `/api/airfare`)
  - Mode detection: `import.meta.env.DEV`

### Deployment

- **Platform**: Railway
- **Environment Variables**: Configured in Railway dashboard for production deployment

## Advanced Features Implementation

### Authentication System (AuthContext)

**Location**: `src/contexts/AuthContext.tsx` (Added in commit 43f004b)

The application uses a centralized authentication context that provides:

**User Management**:
```typescript
interface AuthUser {
  id: string;
  email: string;
  role: Role; // OWNER | SUPERADMIN | ADMIN | SELLER
  tenant_id: string | null;
  agency_id: string | null;
  name?: string;
}
```

**Role Checks**: `isOwner`, `isSuperAdmin`, `isAdmin`, `isSeller`

**Permission Functions**:
- `canViewAllTenants` - OWNER can view all tenants
- `canViewAllAgencies` - OWNER and SUPERADMIN can view all agencies
- `canViewAgency(agencyId)` - Check if user can view specific agency
- `canViewLead(lead)` - Check if user can view specific lead based on assignment and agency

**Usage**: Import `useAuth()` hook in any component to access authentication state and permissions.

### Chat System Architecture

**Location**: `src/features/chat/` (Multiple commits: 1c66552, 509ac7b, 041e906, 9aaba34, 0a2731d)

The chat system is one of the most sophisticated parts of the application:

#### Message Deduplication (5-Layer System)

**Problem Solved**: Real-time subscriptions can cause duplicate messages due to race conditions, optimistic updates, and network issues.

**Solution** (`useChat.ts` - 960 lines):
1. **Global Message ID Tracking**: `globalProcessedMessageIds` Set prevents reprocessing
2. **Optimistic Client ID Tracking**: `globalPendingOptimisticClientIds` manages temporary messages
3. **Strong Deduplication**: Replace optimistic messages when real DB record arrives (by client_id)
4. **ID Uniqueness Check**: Verify message.id not already in state
5. **Heuristic Fallback**: Match by (role, content, timestamp) for edge cases

**Key Field**: `client_id` - UUID generated client-side before DB persistence, used for deduplication

#### Real-time Subscriptions

**Configuration** (`src/integrations/supabase/client.ts`):
```typescript
realtime: {
  timeout: 30000,
  heartbeatIntervalMs: 30000,
  params: { eventsPerSecond: 10 }
}
```

**Auto-reconnection**: Exponential backoff strategy for network failures

#### State Management

**Per-Conversation Features** (`useChatState.ts`):
- `typingByConversation: { [conversationId: string]: boolean }` - Track typing state per chat
- `previousParsedRequest: TravelRequest | null` - Contextual memory for follow-up travel requests
- Optimistic UI with temporary conversation IDs

#### Message Intent Detection

**Parser** (`useMessageHandler.ts` - 150+ lines):
- Detects travel intent: cheaper flights, price changes, hotel requests
- Routes to appropriate handler: flights, hotels, packages, services
- Analyzes PDFs for invoice/booking data
- Maintains conversation context for intelligent follow-ups

### Flight Analysis System

**Location**: `src/features/chat/transformers/flightTransformer.ts` (711 lines, enhanced in commit 732e1e3)

#### Per-Leg Connection Metrics

The system analyzes connections separately for outbound (ida) and return (vuelta) legs:

```typescript
perLegConnections: {
  minPerLeg: number;      // Minimum connections in any leg
  maxPerLeg: number;      // Maximum connections in any leg
  allLegsHaveSameConnections: boolean; // True if ida and vuelta have equal connections
}
```

**Direct Flight Detection**: No connections AND no technical stops on any leg

#### Airline-Specific Baggage Analysis

**Light Fare Airlines**: LA, H2, AV, AM, JA, AR (typically no checked baggage)

**Per-Leg Baggage**:
- Separate carry-on and checked baggage tracking for ida/vuelta
- Detects "NOBAG" and "1PC" codes
- Legacy baggage logic fallback for older data

#### Multi-Stage Filtering Pipeline

1. **Stops Preference**: direct, with_stops, one_stop, two_stops
2. **Luggage Preference**: checked, carry_on, both, none
3. **Max Layover Duration**: Filter by connection time limits
4. **Price Sorting**: Sort by cheapest, limit to top 5 results

#### Tax & Commission Breakdown

**Detailed Fare Info**:
- Per-passenger fare details (adult, child, infant)
- Net amounts, fees, commissions
- Full commission policy information
- IATA country and currency tracking
- Tax code descriptions (YQ, YR, etc.)

#### Airport Code Service

**Location**: `src/services/cityCodeService.ts`

- 500+ airport code mappings (3-letter IATA codes)
- Centralized service prevents duplicate API calls
- Bidirectional airline code-to-name conversion

### Hotel Search Integration

**Location**: `src/services/hotelSearch.ts`

#### Country/City Code Validation

**Function**: `getCountryList()` (line 16)
- Caches country/city codes to avoid repeated API calls
- Used for validating search parameters before calling `searchHotelFares`
- Dual-mode: Edge Function (production) vs SOAP proxy (development)

#### Hotel Search

**Function**: `searchHotelFares(params)` (line 406)
- Searches EUROVIPS for available hotels
- Uses validated city codes from `getCountryList`
- Returns structured hotel data with rooms, rates, and availability

## Development Guidelines

### Component Conventions
- Use shadcn/ui components as building blocks
- Follow the existing component structure in `src/components/ui/`
- Implement proper TypeScript types for all props and data structures
- Use the established color system and design tokens

### API Integration
- All Supabase interactions should go through the client in `src/integrations/supabase/client.ts`
- **Primary Pattern**: Custom hooks wrapping Supabase Realtime for real-time data (see `useChat.ts`, `useMessages.ts`, `useConversations.ts`)
- **Secondary Option**: TanStack Query is available for data fetching but currently has minimal usage in the codebase
- Follow the established patterns in hooks like `useChat.ts` (real-time with deduplication) and `useLeads.ts`
- For chat-related features, use the deduplication patterns in `useChat.ts` to prevent duplicate messages
- Travel provider integrations should use the dual-mode pattern (Edge Functions for production, CORS proxy for development)

### Path Resolution
- Use `@/` alias for imports from the src directory (configured in Vite and TypeScript)
- Example: `import { Button } from "@/components/ui/button"`

### Type Safety
- All major data structures are defined in `src/types/index.ts`
- Supabase types are auto-generated in `src/integrations/supabase/types.ts`
- Use proper TypeScript throughout - the project has relaxed some strict settings for development velocity

### Testing
- No specific test framework is configured - determine testing approach by examining the codebase if adding tests

## Documentation

All project documentation is organized in the `/docs` folder by category:

- **[docs/api/](docs/api/)** - External API integration guides (EUROVIPS, SOFTUR)
- **[docs/architecture/](docs/architecture/)** - System design, async search, rate limiting
- **[docs/guides/](docs/guides/)** - User guides for PDF templates, searches
- **[docs/business-rules/](docs/business-rules/)** - Permissions, role hierarchy
- **[docs/implementation/](docs/implementation/)** - Setup guides, migration status
- **[docs/archive/](docs/archive/)** - Historical docs for resolved issues

See **[docs/README.md](docs/README.md)** for complete documentation index and navigation guide.

### Quick Documentation Reference

- **User Management & Permissions**: [docs/business-rules/USER_MANAGEMENT_BUSINESS_RULES.md](docs/business-rules/USER_MANAGEMENT_BUSINESS_RULES.md)
- **Async Search System**: [docs/architecture/ASYNC_SEARCH_GUIDE.md](docs/architecture/ASYNC_SEARCH_GUIDE.md)
- **API Integration**: [docs/api/Softur - API GUIDE.md](docs/api/Softur%20-%20API%20GUIDE.md)
- **PDF Customization**: [docs/guides/CUSTOM_PDF_TEMPLATES_GUIDE.md](docs/guides/CUSTOM_PDF_TEMPLATES_GUIDE.md)

## EUROVIPS WebService Integration

### Servicios Combinados - Flujos de Trabajo

#### 1. Flujo Principal: Búsqueda → Presupuesto → Reserva
Secuencia básica del proceso completo de reserva:

```
Búsqueda de tarifas → Creación de presupuesto → Conversión a reserva

searchHotelFares/searchAirFares/searchPackageFares/searchServiceFares
↓
makeBudget (usando FareId obtenido)
↓
convertToBooking
```

#### 2. Servicios de Datos Estáticos (combinables con cualquier flujo)
Estos servicios se ejecutan **antes** de las búsquedas para validar parámetros:

- **getCountryList** - Para obtener códigos de ciudades válidos
- **getAirlineList** - Para obtener códigos de aerolíneas válidos

Se usan como validación previa para asegurar que las búsquedas usen códigos correctos.

#### 3. Servicios de Consulta de Tarifas Individuales
Se ejecutan **después** de las búsquedas para obtener detalles específicos:

- **getHotelFare** - Detalles de una tarifa de hotel específica
- **getPackageFare** - Detalles de un paquete específico  
- **getServiceFare** - Detalles de un servicio específico
- **getAirFare** - Detalles de una tarifa aérea específica

#### 4. Servicios de Gestión de Reservas
Se utilizan **después** de convertToBooking para gestionar la reserva:

```
getBookingList → getBooking (consultar reservas)
addBookingPassenger/modBookingPassenger/delBookingPassenger
addBookingTransportInfo/modBookingTransportInfo/delBookingTransportInfo
addBookingComment/ackBookingComment
```

#### 5. Servicios de Gestión de Presupuestos
Para gestionar presupuestos existentes o crear con eventos especiales:

```
getBudgetList → getBudget (consultar presupuestos existentes)
addEvent → makeBudget (para crear presupuestos con eventos especiales)
```

### Flujo Completo Típico Implementado:

```
1. getCountryList (obtener códigos válidos)
2. searchHotelFares (buscar hoteles disponibles)
3. getHotelFare (detalles de tarifa seleccionada) [OPCIONAL]
4. makeBudget (crear presupuesto) [FUTURO]
5. convertToBooking (convertir a reserva) [FUTURO]
6. addBookingPassenger (agregar pasajeros) [FUTURO]
7. getBooking (consultar reserva final) [FUTURO]
```

### Estado Actual de Implementación:

#### ✅ Implementado y Funcionando:
- **getCountryList** - Obtiene códigos de ciudades válidos con caché
- **searchHotelFares** - Busca hoteles con códigos validados

#### 🔄 Por Implementar:
- **makeBudget** - Crear presupuestos desde resultados de búsqueda
- **convertToBooking** - Convertir presupuestos en reservas
- **getHotelFare** - Detalles específicos de tarifas seleccionadas
- **Gestión de pasajeros y comentarios en reservas**

Los servicios están diseñados para trabajar en conjunto siguiendo el flujo lógico: **búsqueda → presupuestación → reserva → gestión**.

## Cambios Recientes (Diciembre 2025)

### Sistema de Expiración de Sesión por Inactividad

**Archivos**: `src/hooks/useSessionExpiration.ts`, `src/config/sessionConfig.ts`

Implementación de cierre automático de sesión tras inactividad:

- **Timeout**: 2 horas de inactividad (configurable en `SESSION_TIMEOUT_MS`)
- **Verificación**: Cada 1 minuto mediante intervalo
- **Eventos monitoreados**: `mousedown`, `mousemove`, `keydown`, `scroll`, `touchstart`, `click`, `focus`
- **Throttling**: Actualiza timestamp cada 10 segundos para evitar escrituras excesivas a localStorage
- **Limpieza**: Al expirar, elimina tokens de Supabase y redirige a `/login?expired=true`
- **Visibility Change**: Verifica expiración al volver a la pestaña del navegador

### Sistema de Detección de Aerolíneas (Alias Centralizados)

**Archivo**: `src/features/chat/data/airlineAliases.ts` (789 líneas)

Mapeo completo de nombres de aerolíneas a códigos IATA para filtrado de resultados:

```typescript
// Ejemplo de uso:
// Usuario escribe: "quiero volar con latam a madrid"
// Sistema detecta "latam" → código IATA "LA"
// Filtro usa "LA" para filtrar resultados de Starling
```

**Grupos de aerolíneas incluidos**:
- LATAM Group (LA, JJ, LP, XL, 4C, 4M)
- Avianca Group (AV, 2K, LR, TA)
- Iberia Group/IAG (IB, I2)
- American Airlines, Delta, United, Copa, Aeromexico, JetBlue, etc.

### Sistema de Detección de Cadenas Hoteleras

**Archivo**: `src/features/chat/data/hotelChainAliases.ts` (438 líneas)

Detección de cadenas hoteleras con variaciones y aliases:

```typescript
interface HotelChainInfo {
    name: string;       // Nombre canónico
    aliases: string[];  // Todas las variaciones conocidas
}
```

**Cadenas implementadas**: RIU, Iberostar, Meliá, Bahía Príncipe, Barceló, NH Hotels, Hilton, Marriott, Hyatt, IHG, Hard Rock, Secrets, Dreams, Sandals, Best Western, All Inclusive resorts, etc.

### Generador de Itinerarios de Viaje con IA

**Archivo**: `supabase/functions/travel-itinerary/index.ts` (263 líneas)

Nueva Edge Function que genera itinerarios detallados usando OpenAI:

**Input**:
```typescript
{ destinations: string[], days: number }
```

**Output estructurado**:
```typescript
interface ItineraryDay {
    day: number;
    title: string;
    morning: ItineraryActivity[];
    afternoon: ItineraryActivity[];
    evening: ItineraryActivity[];
    restaurants: ItineraryRestaurant[];
    travelTip: string;
}
```

**Formateador**: `formatItineraryResponse()` en `responseFormatters.ts` convierte el JSON a markdown legible.

### Sistema Avanzado de Filtrado de Habitaciones

**Archivo**: `src/utils/roomFilters.ts` (360 líneas)

Sistema experto de filtrado con lógica de dos filtros (AND):

**FILTRO A - Capacidad**:
- Códigos en `fare_id_broker`: SGL, DBL, TWN, TPL, QUA
- Keywords en descripción (español/inglés): "single", "doble", "triple", "cuádruple"
- Exclusiones para evitar falsos positivos (ej: filtro "double" excluye "TRIPLE")

**FILTRO B - Plan de Comidas**:
- `all_inclusive` → "ALL INCLUSIVE", "TODO INCLUIDO"
- `breakfast` → "BUFFET BREAKFAST", "DESAYUNO", "B&B"
- `half_board` → "HALF BOARD", "MEDIA PENSIÓN"
- `room_only` → "ROOM ONLY", "SOLO ALOJAMIENTO"

**Normalización bilingüe**:
```typescript
normalizeCapacity("doble") → "double"
normalizeMealPlan("todo incluido") → "all_inclusive"
```

### Filtro Especial de Hoteles Punta Cana

**Archivo**: `src/features/chat/services/searchHandlers.ts`

Whitelist de hoteles permitidos para búsquedas en Punta Cana:

```typescript
const PUNTA_CANA_ALLOWED_HOTELS = [
  ['riu', 'bambu'],
  ['iberostar', 'dominicana'],
  ['bahia', 'principe', 'grand', 'punta', 'cana'],
  ['sunscape', 'coco'],
  ['riu', 'republica']
];
```

**Excepción**: Si el usuario especifica una cadena hotelera (ej: "cadena iberostar"), TODOS los hoteles de esa cadena se permiten.

### Mejoras en AI Message Parser (Edge Function)

**Archivo**: `supabase/functions/ai-message-parser/index.ts`

**Detección mejorada de intención hotel vs vuelo**:
- Keywords de hotel tienen prioridad sobre patrones de vuelo
- Patrón "desde X a Y" con keywords de hotel → se interpreta como hotel (destino: Y), no vuelo
- Detección de cadenas hoteleras (`hotelChain` field)
- Detección de nombre específico de hotel (`hotelName` field)

**Historial de conversación expandido**:
- Ahora procesa últimos 20 mensajes (antes: 8)
- Smart truncation: mensajes recientes mantienen 800 chars, antiguos 300 chars
- Extracción de contexto de vuelos previos para búsquedas de hotel

**Nuevos campos parseados**:
```typescript
hotels?: {
    hotelChain?: string;  // Cadena hotelera detectada
    hotelName?: string;   // Nombre específico de hotel
    // ... otros campos
}
```

### Mejoras en PDF Processor

**Archivo**: `src/services/pdfProcessor.ts`

**Nuevos patrones regex para extracción de vuelos**:
- Soporte para nombres de aerolíneas complejos con sufijos corporativos
- Patrones mejorados para información de escalas (layovers)
- Preservación de información de conexiones en estructura de vuelo reconstruida

**Smart price parser**:
- Detecta automáticamente formato US (2,549.32) vs EU/Latino (2.549,32)
- Maneja múltiples símbolos de moneda

### Lógica de Adultos Inferidos

**Archivo**: `src/features/chat/services/searchHandlers.ts`

Cuando el usuario no especifica cantidad de adultos, el sistema infiere basándose en:
1. Contexto previo de la conversación
2. Tipo de habitación solicitada (doble → 2 adultos)
3. Default: 1 adulto si no hay contexto

### Response Formatters Actualizados

**Archivo**: `src/features/chat/services/responseFormatters.ts`

**Nuevas funciones**:
- `formatItineraryResponse()` - Formatea itinerarios AI en markdown
- Mejoras en `formatHotelResponse()` - Agrupación por tipo de habitación
- Mejoras en `formatFlightResponse()` - Detección de carry-on inconsistente

**Ordenamiento inteligente de habitaciones**:
1. Por tipo (SGL → DUS → DBL → TPL → QUA)
2. Por categoría (BASIC → STANDARD → COMFORT → SUPERIOR)
3. Por desayuno incluido
4. Por precio

### Sistema de Iteración de Búsquedas (Diciembre 2025)

**Archivos principales**:
- `src/features/chat/utils/iterationDetection.ts` (720 líneas)
- `src/features/chat/types/contextState.ts` (148 líneas)
- `src/features/chat/hooks/useContextualMemory.ts` (modificado)
- `src/features/chat/hooks/useMessageHandler.ts` (modificado)

Sistema que detecta cuando el usuario quiere **iterar sobre una búsqueda anterior** en vez de hacer una nueva:

#### Casos de Uso Principales

**Iteración de Hotel sobre Combined**:
```
Turno 1: "Vuelo + hotel a Punta Cana del 15 al 22 de enero, 2 adultos"
Turno 2: "Quiero la misma búsqueda pero con hotel RIU" 
→ Preserva vuelo, solo cambia filtro de hotel
```

**Iteración de Vuelo (escalas/equipaje/aerolínea)**:
```
Turno 1: "Vuelo a Madrid del 10 al 20 de marzo"
Turno 2: "El mismo pero directo" / "Con equipaje" / "En Iberia"
→ Preserva origen/destino/fechas, solo modifica filtros
```

#### Tipos de Contexto (`ContextState`)

```typescript
interface ContextState {
  lastSearch?: {
    requestType: 'flights' | 'hotels' | 'combined' | 'packages' | 'services';
    flightsParams?: FlightContextParams;  // origin, destination, dates, pax, cabin, stops, airline
    hotelsParams?: HotelContextParams;    // city, dates, pax, chain, name, stars, mealPlan
  };
  turnNumber: number;
  lastIntent?: string;
}
```

#### Patrones de Detección

**Referencias al contexto anterior**:
- "misma búsqueda", "mismo vuelo", "mismo hotel"
- "lo mismo pero", "igual pero", "repetí"

**Modificaciones de hotel**:
- Cadenas: "hotel RIU", "con Iberostar", "cadena Meliá"
- Estrellas: "5 estrellas", "mínimo 4 estrellas"
- Plan de comidas: "todo incluido", "all inclusive"

**Modificaciones de vuelo**:
- Escalas: "directo", "con escalas", "sin escalas"
- Equipaje: "con valija", "solo carry-on"
- Aerolínea: "con Iberia", "en Latam" (usa `detectAirlineInText()` del archivo centralizado)

#### Integración con Archivo de Aerolíneas

El sistema de iteración **usa el archivo centralizado** `src/features/chat/data/airlineAliases.ts` que contiene:
- **229 códigos IATA** de aerolíneas mundiales
- **~385 aliases** (variaciones de nombres que usuarios pueden escribir)
- **Función `detectAirlineInText()`** que detecta menciones con niveles de confianza (high/medium/low)

```typescript
// iterationDetection.ts usa:
import { detectAirlineInText } from '../data/airlineAliases';

// Ejemplo de detección:
detectAirlineInText("quiero volar con latam a madrid")
// Returns: { code: 'LA', name: 'latam', confidence: 'high' }
```

Esto permite detectar aerolíneas en iteraciones sin duplicar la lista de aliases.

#### Flujo de Merge

```
1. Usuario envía mensaje
2. detectIterationIntent() analiza contra ContextState previo
3. Si es iteración → mergeIterationContext() combina:
   - Parámetros previos (vuelo: origin, dest, dates, pax)
   - Nuevas modificaciones (hotel: chain, stars, etc.)
4. Se ejecuta búsqueda combined con parámetros mergeados
5. Se actualiza ContextState para próximo turno
```

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.