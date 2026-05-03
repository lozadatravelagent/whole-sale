# CLAUDE.md

Guidance for Claude Code on **WholeSale Connect AI** — multi-tenant travel CRM SaaS.

## Stack
- **Frontend**: React 18 + TS, Vite, shadcn/ui, Tailwind. State: custom hooks + Supabase Realtime + AuthContext.
- **Backend**: Supabase (Postgres, Edge Functions), Fastify API Gateway (Node 20, Railway).
- **Integrations**: Starling (flights), EUROVIPS (hotels), Foursquare (places), Mapbox GL, Wikipedia (photos), PDFMonkey, OpenAI.
- **Caching**: Redis (rate limits, idempotency), IndexedDB (places, planner state — 7d TTL), in-memory LRU.

## Commands
- `npm run dev` (port 8080) · `npm run build` · `npm run lint` · `npm test` (Vitest)
- Run tests after changes to routing, orchestration, editorial, regional expansion, or scheduling.
- Edge Functions: `supabase functions deploy <name>` · `supabase functions serve` · `supabase secrets set KEY=value`

## Code Conventions
- Imports use `@/` alias. Types in `src/types/index.ts`, Supabase types in `src/integrations/supabase/types.ts`.
- Forms: React Hook Form + Zod. Components built on shadcn/ui.
- Dual-mode: Production hits Edge Functions, dev uses CORS proxy — detect via `import.meta.env.DEV`.
- Deduplication: `client_id` field, 5-layer pattern from `useChat.ts`.

## Database
- Multi-tenant: tenants → agencies → users (OWNER, SUPERADMIN, ADMIN, SELLER).
- CRM: leads (trip details, status). Chat: conversations → messages.
- RLS via helpers: `is_owner`, `get_user_agency_id`.

## Chat Routing & Orchestration (Emilia 5.0)
- **Router** (`features/chat/services/routeRequest.ts`): deterministic scoring, no LLM, <1ms. Routes: QUOTE / COLLECT / PLAN.
- **Orchestrator** (`conversationOrchestrator.ts`): maps route → `planner_agent` | `ask_minimal` | `standard_itinerary` | `standard_search`.
- **Itinerary Pipeline** (`itineraryPipeline.ts`): produces `CanonicalItineraryResult` — unified shape from both AI parser and planner-agent branches.
- **Discovery** (`discoveryService.ts`): curated suggestions, quality scoring, bucket categorization, telemetry.
- **Editorial** (`editorial.ts`): pure `TripPlannerState → PlannerEditorialData`. Modes: multi_city_country, multi_city_region, multi_country, single_city, route_refinement.

## Planner Agent
- `supabase/functions/planner-agent/`. OpenAI gpt-5.1 in agent loop.
- Tools: search_flights, search_hotels, generate_itinerary, resolve_city_code, search_packages, ask_user.
- Guardrails: iteration limit, execution timeout, parallel tool cap, human confirmation for bookings/payments.
- Default origin: IP-based city/country detection. Persona: Emilia, expert agent, value-first, Spanish neutral.

## Trip Planner & Places
- `useTripPlanner.ts` is a thin composition root over specialized hooks (state, location, content, destinations, places, hotels, transport).
- `TripPlannerWorkspace` orchestrates hooks/UI; `TripPlannerMap` (Mapbox GL) is presentation-only.
- **Viewport loading** (`places-viewport` edge fn): multi-point search (1–3 adaptive points), concurrency limits, per-task timeouts, signature-based cache, single retry on partial.
- **Rate limiting**: client rolling window + backend per-invocation cap. Backend 429 Retry-After → client `cooldownRemainingS` / `cooldownUntilRef`.
- **Caching**: memory LRU + IndexedDB (7d) + in-flight dedup map + viewport signature cache.
- **Progressive rendering**: each eager category fetches independently — markers appear as each resolves.

## Regional Expansion
- `src/data/regional_routes.json`, `country_routes.json`: predefined routes (cities, durations, seasonal hints).
- Smart defaults auto-fill days, budget, pace, dates. Seasonal detection is hemisphere-aware.
- Vague input (region/country) expands to concrete cities with proportional day allocation.

## Invariants — Do Not Break
- **`CATEGORY_POLICY`** in `usePlacesOrchestrator.ts` is the single source of truth for place-fetching behavior. All derived constants (`EAGER_FETCH_CATEGORIES`, `VIEWPORT_FETCH_CATEGORIES`, `CHAT_PUSH_CATEGORIES`, default active state) auto-compute from it. Never hardcode category lists elsewhere.
- **`CanonicalItineraryResult`** is the only shape that exits the itinerary pipeline.
- **Race condition guards** (version refs, AbortController, signature dedup) protect all async hooks. Never remove without understanding the concurrent flow.
- **`api/` and `src/` are separate projects.** Zero shared code, independent deploys. Changes in one never impact the other.
- **RLS is mandatory.** Filter every query by `agency_id` via helpers. Never bypass with service_role. Never expose one tenant's data to another.
- **Edge function CORS**: always use `_shared/cors.ts`. Never hardcode headers.
- **Provider cooldown propagation**: backend 429 → client `cooldownUntilRef`. Never skip cooldown checks in viewport fetch.
- **Context Engineering (Option A — per-conversation isolation):** EmiliaState lives in `agent_states` keyed by `conversation_id`. Each conversation is a fresh slate; there is NO cross-conversation memory propagation. `global_memory` despite the name is per-conversation (lifecycle position, not scope). The `chatMode` change MUST only mutate `state.mode` — never clear `state.profile`, `state.global_memory`, `state.session_memory`, or `state.active_refs`. Spec: `docs/architecture/context-engineering-spec.md`. If product needs evolve toward cross-conversation memory (Option B), introduce a separate `lead_memory` table; do NOT retrofit `global_memory`.
- **Memory tool rejections are non-negotiable:** `save_memory_note` rejects PII (passport, payment, DOB, SSN), instruction-shaped phrases ("remember that", "always do"), and speculation markers ("I think", "maybe"). These regex rules are in `supabase/functions/_shared/memoryTools.ts:PII_PATTERNS`. Removing or weakening them risks prompt injection and PII leakage.
- **Tool loop telemetry:** Every turn through `runToolLoop` emits `[CTX-TOOL]` (and `[CTX-MEMORY]` when applicable) via `_shared/telemetry.ts`. Do not delete these emissions; rollback decisions depend on them.
- **`pending_action` is a single-slot state machine.** Mutate ONLY via `setPendingAction` / `clearPendingAction` / `markPendingActionApplied` from `state/contextEngineeringIntegration.ts`. Never assign `state.pending_action` directly — `kind` + `for` + `fields` + `prompt` + `issuedAt` belong together; partial writes break the renderer and the tool guards. Two tools resolve it: `apply_slot_values` (kind=awaiting_user_input) and `confirm_pending_action` (kind=awaiting_user_confirmation). Domain mutations (planner, quote, etc.) live client-side in `applyPendingActionResolution` keyed by `for`. Adding a new flow = `setPendingAction({for:'X', ...})` somewhere upstream + a `case 'X'` in the dispatcher; the parser/router need NO changes. The orchestrator's `mode_bridge` is suppressed while `pending_action` is set — never bypass that guard.

## Deployment
- Frontend: Railway (`npm run start`). Public API: Railway (Docker, health check `/v1/health`). Edge Functions: Supabase.
- Cloudflare Worker proxy: `/v1/*` → Railway, `/search` → Supabase.

## Context Engineering Layer
- **Spec docs**: `docs/architecture/context-engineering-spec.md`, `tool-catalog-spec.md`
- **Operational docs**: `docs/architecture/context-engineering-overview.md`, `memory-lifecycle.md`, `rollback-plan.md`
- **Audit & DEBT**: `docs/architecture/tool-catalog.md`
- **No feature flags**: the CE layer is the only path. Flags (`VITE_USE_CONTEXT_ENGINEERING`, `USE_FUNCTION_TOOLS`, `x-use-tool-loop`) and the legacy single-shot/state-less paths were removed in the cleanup migration (commits `63ac42f0..10e626ed`). Rollback is via `git revert <commit>` + redeploy.
- **Audit endpoint**: `supabase/functions/agent-state-audit/` — debug what the model saw at a specific turn
