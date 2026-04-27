# AGENTS.md

Guidance for Codex when working with **WholeSale Connect AI** — a multi-tenant travel CRM SaaS platform.

## Stack Overview
- **Frontend**: React 18 + TypeScript, Vite, shadcn/ui, Tailwind CSS
- **State**: Custom hooks + Supabase Realtime (primary), React Context (AuthContext)
- **Backend**: Supabase PostgreSQL, Edge Functions, Fastify API Gateway (Node.js 20 + Railway)
- **Integrations**: Starling (flights), EUROVIPS (hotels), Foursquare (places/venues), Mapbox GL (map rendering), Wikipedia (photo hydration), PDFMonkey (quotes), OpenAI (central model policy for parser, itinerary generation, and JSON repair)
- **Caching**: Redis (rate limits, idempotency), IndexedDB (places, planner state — 7d TTL), in-memory LRU (places, geocoding), in-memory (country codes)

## Critical Rules
- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — ALWAYS prefer editing existing files
- NEVER proactively create documentation (*.md) unless explicitly requested
- NO over-engineering: only make requested changes, avoid unnecessary refactoring/comments/type annotations
- NO backwards-compatibility hacks: delete unused code completely
- `api/` is a SEPARATE project (Fastify API Gateway) — changes there NEVER impact the frontend (`src/`) and vice versa. They share zero code and deploy independently.

## Commands
- `npm run dev` — Development server (port 8080)
- `npm run build` — Production build (TypeScript + Vite)
- `npm run lint` — ESLint check
- `npm test` — Vitest suites (routing, editorial, regional expansion, signatures, structural mods, etc.)

## Project Structure
```
src/
├── components/ui/           # shadcn/ui library
├── contexts/                # AuthContext (role-based permissions)
├── data/                    # regional_routes.json, country_routes.json
├── features/
│   ├── chat/                # Chat system (Emilia 5.0)
│   │   ├── hooks/           # useMessageHandler, useChatState
│   │   └── services/        # routeRequest, conversationOrchestrator, discoveryService,
│   │                        # itineraryPipeline, searchHandlers, responseFormatters
│   ├── trip-planner/        # Trip planning workspace + places
│   │   ├── hooks/           # Specialized hooks (state, places, hotels, transport, ...)
│   │   ├── services/        # placesService, placesCache, tripService, plannerGeocoding
│   │   ├── components/      # TripPlannerWorkspace, TripPlannerMap, DayCarousel, panels
│   │   └── __tests__/       # Vitest suites
│   └── crm/                 # CRM & lead management
├── hooks/                   # Shared hooks (useChat, useLeads, useReports)
├── services/                # API integrations (hotelSearch, airfareSearch, pdfProcessor)
├── utils/                   # Utilities (parsers, filters, formatters)
├── types/                   # TypeScript types (index.ts, contextState.ts)
api/                         # Fastify API Gateway (Railway) — separate project
├── src/routes/v1/           # /search, /health
├── src/middleware/           # CORS, auth, rate limiting, correlation
├── src/services/            # searchExecutor, advancedFilters, cityCodeResolver
supabase/functions/          # Edge Functions
├── planner-agent/           # NLP agent loop (tools/, prompts/, guardrails)
├── foursquare-places/       # Eager place search
├── places-viewport/         # Viewport dynamic loading (multi-point, concurrency, partial retry)
├── place-details/           # Single place enrichment
├── place-photos/            # Photo retrieval
├── place-recommendations/   # Curated suggestions
├── place-hotel-candidates/  # Hotel matching by location
├── place-summary/           # AI place summary
├── _shared/places/          # Shared backend (foursquare, service, wikipedia, http, types)
├── starling-flights/        # Starling flight search
├── eurovips-soap/           # EUROVIPS hotel SOAP API
├── travel-itinerary/        # Itinerary generation
├── ai-message-parser/       # NLP message parsing
└── ...                      # add-message, create-user, api-auth, hotelbeds-*, pdf-*
```

## Database Schema
- **Multi-tenant**: tenants → agencies → users (OWNER, SUPERADMIN, ADMIN, SELLER)
- **CRM**: leads (trip details, status tracking)
- **Chat**: conversations → messages (client_id for deduplication, real-time subscriptions)
- **RLS**: Agency-level isolation via helper functions (is_owner, get_user_agency_id)

## Code Conventions
- **Imports**: Use `@/` alias (e.g., `import { Button } from "@/components/ui/button"`)
- **Types**: Major structures in `src/types/index.ts`, Supabase types in `src/integrations/supabase/types.ts`
- **Components**: Use shadcn/ui as building blocks
- **Forms**: React Hook Form + Zod validation
- **Dual-Mode**: Production (Edge Functions), Development (CORS proxy), detect via `import.meta.env.DEV`
- **Deduplication**: Use client_id field, 5-layer pattern from `useChat.ts`
- **Race condition guards**: All async hooks use version refs (increment before, check after), signature-based dedup, and/or AbortController. Never remove these guards.
- **Category Policy**: `CATEGORY_POLICY` in `usePlacesOrchestrator.ts` is the single source of truth for place-fetching behavior. Never hardcode category lists elsewhere.

## Chat Routing & Orchestration (Emilia 5.0)
- **Router** (`routeRequest.ts`): Deterministic scoring of parsed travel requests — no LLM call, <1ms. Routes to: QUOTE (search-ready), COLLECT (need fields), PLAN (propose trip structure).
- **Orchestrator** (`conversationOrchestrator.ts`): Maps route → execution branch: `planner_agent`, `ask_minimal`, `standard_itinerary`, or `standard_search`.
- **Itinerary Pipeline** (`itineraryPipeline.ts`): Produces `CanonicalItineraryResult` — the unified output shape from both AI parser and planner agent branches.
- **Discovery Service** (`discoveryService.ts`): Curated place suggestions with Foursquare data, quality scoring, bucket categorization, and telemetry.
- **Editorial** (`editorial.ts`): Pure function `TripPlannerState → PlannerEditorialData`. Modes: multi_city_country, multi_city_region, multi_country, single_city, route_refinement.

## Planner Agent
- Edge function at `supabase/functions/planner-agent/`. Uses OpenAI gpt-5.1 in an agent loop.
- **Tools**: search_flights, search_hotels, generate_itinerary, resolve_city_code, search_packages, ask_user.
- **Guardrails**: Iteration limit, execution timeout, parallel tool cap, human confirmation required for bookings/payments.
- **User context**: IP-based city/country detection used as default origin for flight searches.
- **Persona**: Emilia — expert travel agent, value-first, minimal asking, responds in Spanish neutral.

## Trip Planner & Places System

### Architecture
- `useTripPlanner.ts` is a thin composition root over specialized hooks: state management, location resolution, content generation, destination handling, place discovery, hotel search, and transport search.
- `TripPlannerWorkspace` orchestrates hooks and UI. `TripPlannerMap` (Mapbox GL) is presentation-only.

### Category Policy
- `CATEGORY_POLICY` in `usePlacesOrchestrator.ts` defines per-category flags: `eager`, `defaultActive`, `chatPush`, `viewportFetch`.
- All derived constants (`EAGER_FETCH_CATEGORIES`, `VIEWPORT_FETCH_CATEGORIES`, `CHAT_PUSH_CATEGORIES`, default active state) auto-compute from it.
- To change which categories are eager/lazy or on/off by default, edit the policy — nothing else.

### Viewport Loading
- Edge function `places-viewport` handles multi-point search with concurrency limits and per-task timeouts.
- Client builds adaptive search points (1–3) based on viewport size, with signature-based cache bucketing.
- Partial results are cached and retried once on next viewport change.

### Rate Limiting & Cooldown
- Client-side: rolling window rate limiter caps provider calls over a time window.
- Backend: per-invocation call cap prevents runaway Foursquare usage.
- Provider cooldown: backend propagates 429 Retry-After to client via `cooldownRemainingS`. Client skips fetches until cooldown expires.

### Caching
- **Memory LRU**: Fast layer for hot data (capped entries, TTL-based eviction).
- **IndexedDB**: Persistent layer for places, geocoding, planner state (7-day TTL).
- **Request-level dedup**: In-flight map prevents duplicate concurrent calls.
- **Viewport cache**: Client-side, keyed by viewport signature, tracks partial flag.

### Progressive Rendering
- Each eager category fires an independent fetch on segment load. Markers appear as each resolves — no all-or-nothing blocking.

### Status
- **Implemented**: Eager/lazy fetch, viewport loading, category policy, multi-tier caching, rate limiting, progressive rendering, provider cooldown propagation.
- **Partial**: Viewport partial retry (single retry, no escalation). Discovery telemetry (logging only, no dashboard).
- **Pending**: Place search quality feedback loop. Viewport prefetch on predicted pan direction.

## Regional Expansion
- Data files: `src/data/regional_routes.json`, `country_routes.json` — predefined routes with cities, suggested durations, seasonal hints.
- Smart defaults auto-fill days, budget, pace, and dates from region/country metadata.
- Seasonal detection: winter/summer keywords mapped to hemisphere-aware month ranges.
- Vague input expansion: region or country name → concrete city list with proportional day allocation.

## Testing & Verification
- `npm run build` — TypeScript + production build
- `npm run lint` — ESLint
- `npm test` — Vitest suites covering routing, orchestration, editorial, regional expansion, budget detection, signatures, and structural modifications
- Run tests after changes to: routing logic, orchestration branches, editorial processing, regional expansion, or scheduling

## Reglas de Seguridad Multi-tenant
- SIEMPRE respetar RLS (Row Level Security) — nunca bypass con service_role
- Cada query debe filtrar por agency_id via helpers (is_owner, get_user_agency_id)
- NUNCA exponer datos de un tenant a otro

## Supabase Edge Functions
- Deploy: `supabase functions deploy <nombre>`
- Test local: `supabase functions serve`
- Secrets: `supabase secrets set KEY=value`

### Function inventory (by domain)
- **Travel search**: starling-flights, eurovips-soap, search-coordinator
- **Places**: foursquare-places, places-viewport, place-details, place-photos, place-recommendations, place-hotel-candidates, place-summary
- **Agent**: planner-agent
- **Chat/AI**: ai-message-parser, travel-itinerary, add-message
- **Hotels**: hotelbeds-api, hotelbeds-content-sync, hotelbeds-cache-sync, hotelbeds-activities, hotelbeds-transfers
- **Other**: create-user, api-auth, pdf-ai-analyzer, pdf-text-extractor
- **Shared**: `_shared/places/` (Foursquare provider, service layer, Wikipedia hydration, types), `_shared/cors.ts`, `_shared/cache.ts`

## Invariants — Do Not Break
- **CATEGORY_POLICY** is the single source of truth for place-fetching behavior. All derived constants auto-compute from it. Never hardcode category lists elsewhere.
- **CanonicalItineraryResult** is the only shape that exits the itinerary pipeline. Both planner-agent and standard branches must produce it.
- **Race condition guards** (version refs, AbortController, signature dedup) protect all async hooks. Never remove them without understanding the concurrent flow they guard.
- **api/ and src/** are completely separate projects. Zero shared code, independent deploys.
- **RLS is mandatory**. Never use service_role to bypass row-level security.
- **Edge function CORS**: Always use `_shared/cors.ts`. Never hardcode CORS headers.
- **Provider cooldown propagation**: Backend 429 → client `cooldownUntilRef`. Never skip cooldown checks in viewport fetch.

## Deployment
- **Frontend**: Railway (`npm run start`)
- **Public API**: Railway (Docker, health check on `/v1/health`)
- **Edge Functions**: Supabase
- **Proxy**: Cloudflare Worker (routes `/v1/*` → Railway, `/search` → Supabase)
