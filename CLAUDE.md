# CLAUDE.md

Guidance for Claude Code when working with **WholeSale Connect AI** - a multi-tenant travel CRM SaaS platform.

## Stack Overview
- **Frontend**: React 18 + TypeScript, Vite, shadcn/ui, Tailwind CSS
- **State**: Custom hooks + Supabase Realtime (primary), React Context (AuthContext)
- **Backend**: Supabase PostgreSQL, Edge Functions, Fastify API Gateway (Node.js 20 + Railway)
- **Integrations**: Starling (flights), EUROVIPS (hotels), PDFMonkey (quotes), OpenAI (NLP)
- **Caching**: Redis (rate limits, idempotency), in-memory (country codes)
- **Observability**: Pino structured logging, correlation IDs, health checks

## Critical Rules
- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files
- NEVER proactively create documentation (*.md) unless explicitly requested

## Commands
- `npm run dev` - Development server (port 8080)
- `npm run build` - Production build
- `npm run lint` - ESLint check

## Project Structure
```
src/
├── components/ui/        # shadcn/ui library
├── contexts/             # AuthContext
├── features/chat/        # Chat system (hooks, services, transformers, data)
├── pages/                # Route components
├── hooks/                # Custom hooks (useChat, useLeads, useReports)
├── services/             # API integrations (hotelSearch, airfareSearch, pdfProcessor)
├── utils/                # Utilities (parsers, filters, formatters)
api/
├── src/routes/v1/        # /search, /health
├── src/middleware/       # CORS, auth, rate limiting, correlation
├── src/services/         # searchExecutor, advancedFilters, cityCodeResolver
```

## Database Schema
- **Multi-tenant**: tenants → agencies → users (OWNER, SUPERADMIN, ADMIN, SELLER)
- **CRM**: leads (trip details, status tracking)
- **Chat**: conversations → messages (client_id for deduplication, real-time subscriptions)
- **Integrations**: API credentials, search cache, rate limits
- **RLS**: Agency-level isolation via helper functions (is_owner, get_user_agency_id)

## Core Features

### 1. Authentication & Permissions
**Location**: `src/contexts/AuthContext.tsx`
- Role-based permissions: canViewAllTenants, canViewAllAgencies, canViewAgency(id), canViewLead(lead)
- Session expiration (2h timeout, activity monitoring): `src/hooks/useSessionExpiration.ts`

### 2. Chat System
**Location**: `src/features/chat/` + `src/hooks/useChat.ts`
- **5-Layer Deduplication**: globalProcessedMessageIds, globalPendingOptimisticClientIds, client_id field, ID uniqueness, heuristic fallback
- **Real-time**: 30s timeout, 30s heartbeat, exponential backoff, optimistic UI updates
- **Message Handler** (`useMessageHandler.ts`, 1223 lines): Routes flights/hotels/packages/services/PDFs, maintains contextual memory
- **AI Parser** (`supabase/functions/ai-message-parser/`, 1120 lines): OpenAI integration, 20-message history, smart truncation
- **Intent Detection** (`utils/intentDetection.ts`): Travel intent, price changes, economic/premium commands

### 3. Flight Search & Analysis
**Location**: `src/features/chat/transformers/flightTransformer.ts` (711 lines)
- **Per-Leg Metrics**: perLegConnections (minPerLeg, maxPerLeg, allLegsHaveSameConnections), direct flight detection
- **Baggage Analysis** (`src/utils/baggageUtils.ts`): 8 types, light fare airlines (LA, H2, AV, AM, JA, AR), per-leg ida/vuelta
- **Multi-Stage Filtering**: Stops → Luggage → Max Layover → Price sort → Top 5
- **Starling Integration**: Primary provider via Edge Functions

### 4. Hotel Search & Filtering
**Location**: `src/services/hotelSearch.ts` + `src/utils/roomFilters.ts`
- **EUROVIPS Integration**: getCountryList (cache), searchHotelFares, LOZADA credentials
- **Advanced Filtering** (360 lines): Capacity (SGL/DBL/TPL/QUA) + Meal Plan (all_inclusive/breakfast/half_board/room_only)
- **Punta Cana Whitelist**: 5 allowed hotels, exception for chain-based searches
- **Hotel Chain Detection** (`data/hotelChainAliases.ts`, 544 lines): 20+ chains, multilingual aliases

### 5. Iteration Detection
**Location**: `src/features/chat/utils/iterationDetection.ts` (719 lines) + `api/src/services/iterationDetection.ts`
- **Client-side**: detectIterationIntent, mergeIterationContext, pattern detection ("misma búsqueda pero...", "lo mismo pero directo")
- **Context State** (`types/contextState.ts`): lastSearch (requestType, flightsParams, hotelsParams), turnNumber
- **Airline Detection**: Uses centralized `airlineAliases.ts` (229 IATA codes, ~385 aliases, confidence levels)
- **Server-side**: API Gateway handles context merge/replace/clear, follow-up suggestions

### 6. PDF System
**Location**: `src/services/pdfProcessor.ts` (4207 lines)
- **Multi-Hotel Pricing** (lines 350-373, 568-595, 2139-2198):
  - Auto-detects 2+ hotels → shows Economic (cheapest) + Premium (expensive)
  - Proportional price adjustment: `adjustmentRatio = requestedPrice / originalPackagePrice`
  - Commands: "cambia el precio económico a X", "cambia el precio premium a Y"
- **Price Correction**: Subtracts cheapest hotel from package total during extraction
- **PDF Analysis**: Extracts flights, hotels, prices, passengers from uploaded PDFs
- **PDFMonkey Integration**: Customizable templates, Supabase Storage persistence

### 7. CRM & Lead Management
**Locations**: `src/hooks/useLeads.ts`, `src/features/crm/`
- **Lead Operations**: Create, update, delete, status/section transitions, priority scoring (Budget 5 + Due Date 5 + Status 5)
- **Kanban Board** (`hooks/useKanbanBoard.ts`, 222 lines): dnd-kit drag-drop, optimistic updates
- **Chat-to-Lead** (`src/utils/chatToLead.ts`, 1024 lines): Smart context ID resolution, multi-level fallback
- **Activity Tracking** (`src/hooks/useActivities.ts`): 7 event types (lead_created, lead_won, quote_sent), audit log
- **CSV Export** (`src/utils/csvExport.ts`): Spanish formatting, proper escaping

### 8. Reports & Metrics
**Location**: `src/hooks/useReports.ts`
- **12+ Metrics**: Conversion rate, loss analysis, top destinations, channel distribution, trends, trip types
- **Role-Based**: OWNER → tenants, ADMIN → team, SELLER → personal
- **Dashboard**: Personal performance, team tracking, tenant aggregation

### 9. Fastify API Gateway
**Location**: `api/` (separate directory, deployed on Railway)
- **Middleware Chain**: CORS → Correlation ID → Auth → Rate Limit → Execute
- **Rate Limiting**: Redis sliding window (minute/hour/day), ~80-160ms faster than PostgreSQL
- **Idempotency**: 5-min cache, 95%+ faster on retries
- **Services**:
  - `searchExecutor.ts` (33KB): Provider orchestration, timeouts, retries, failover
  - `cityCodeResolver.ts` (21KB): 700+ city mappings (IATA + hotel codes)
  - `advancedFilters.ts` (14KB): Punta Cana whitelist, room filtering, light fare exclusion
  - `validation.ts`, `contextManagement.ts`, `buildMetadata.ts`
- **Endpoints**: POST `/v1/search` (requires X-API-Key), GET `/v1/health`, GET `/v1/health/detailed`
- **Logging**: Pino structured JSON with correlation IDs

### 10. Additional Services
- **Package Search**: `src/services/packageSearch.ts` (EUROVIPS tours)
- **Service Search**: `src/services/serviceSearch.ts` (transfers, excursions)
- **Travel Itinerary**: `supabase/functions/travel-itinerary/` (OpenAI-powered, 263 lines)
- **Availability Service**: `src/services/availabilityService.ts` (check destinations, suggest alternatives, 220 lines)
- **Price Calculator**: `src/features/crm/services/priceCalculator.ts` (3-level room priority, per-night rates, 317 lines)

## Development Guidelines

### Architecture Patterns
- **Primary**: Custom hooks wrapping Supabase Realtime (useChat, useMessages, useConversations)
- **Forms**: React Hook Form + Zod validation
- **Deduplication**: Use client_id field, 5-layer pattern from `useChat.ts`
- **Dual-Mode**: Production (Edge Functions), Development (CORS proxy), detect via `import.meta.env.DEV`

### Code Conventions
- **Imports**: Use `@/` alias (e.g., `import { Button } from "@/components/ui/button"`)
- **Types**: Major structures in `src/types/index.ts`, Supabase types auto-generated in `src/integrations/supabase/types.ts`
- **Components**: Use shadcn/ui as building blocks, follow existing structure in `src/components/ui/`
- **NO over-engineering**: Only make requested changes, avoid unnecessary refactoring/comments/type annotations
- **NO backwards-compatibility hacks**: Delete unused code completely

### Key Files Reference
- **Auth**: `src/contexts/AuthContext.tsx` (196 lines)
- **Chat Deduplication**: `src/hooks/useChat.ts`
- **Flight Analysis**: `src/features/chat/transformers/flightTransformer.ts` (711 lines)
- **Hotel Search**: `src/services/hotelSearch.ts` (500+ lines)
- **PDF Multi-Hotel**: `src/services/pdfProcessor.ts` (4207 lines, see lines 350-373, 568-595, 2139-2198)
- **Iteration Detection**: `src/features/chat/utils/iterationDetection.ts` (719 lines)
- **Airline Aliases**: `src/features/chat/data/airlineAliases.ts` (797 lines)
- **Hotel Chains**: `src/features/chat/data/hotelChainAliases.ts` (544 lines)
- **Room Filters**: `src/utils/roomFilters.ts` (360 lines)
- **Message Handler**: `src/features/chat/hooks/useMessageHandler.ts` (1223 lines)
- **API Gateway Server**: `api/src/server.ts`
- **Search Executor**: `api/src/services/searchExecutor.ts` (33KB)

## Deployment
- **Frontend**: Railway (production build via `npm run start`)
- **API Gateway**: Railway (Docker multi-stage build, health check on `/v1/health`)
- **Edge Functions**: Supabase (starling-search, eurovips-soap, ai-message-parser, travel-itinerary)
- **Proxy**: Cloudflare Worker (routes `/v1/*` → Railway API, `/search` → Supabase Edge Functions)

## Known Limitations
- **Testing**: No automated tests configured (manual QA only)
- **EUROVIPS**: Only getCountryList + searchHotelFares implemented (makeBudget, convertToBooking, getHotelFare pending)

## Documentation
- **Architecture**: [docs/architecture/](docs/architecture/) - Async search, rate limiting
- **API Integration**: [docs/api/](docs/api/) - EUROVIPS, SOFTUR guides
- **Business Rules**: [docs/business-rules/](docs/business-rules/) - Permissions, role hierarchy
- **User Guides**: [docs/guides/](docs/guides/) - PDF templates, searches
- Full index: [docs/README.md](docs/README.md)

---


