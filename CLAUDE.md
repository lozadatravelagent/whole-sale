# CLAUDE.md

Guidance for Claude Code when working with **WholeSale Connect AI** — a multi-tenant travel CRM SaaS platform.

## Stack Overview
- **Frontend**: React 18 + TypeScript, Vite, shadcn/ui, Tailwind CSS
- **State**: Custom hooks + Supabase Realtime (primary), React Context (AuthContext)
- **Backend**: Supabase PostgreSQL, Edge Functions, Fastify API Gateway (Node.js 20 + Railway)
- **Integrations**: Starling (flights), EUROVIPS (hotels), PDFMonkey (quotes), OpenAI (NLP)
- **Caching**: Redis (rate limits, idempotency), in-memory (country codes)

## Critical Rules
- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — ALWAYS prefer editing existing files
- NEVER proactively create documentation (*.md) unless explicitly requested
- NO over-engineering: only make requested changes, avoid unnecessary refactoring/comments/type annotations
- NO backwards-compatibility hacks: delete unused code completely
- `api/` is a SEPARATE project (Fastify API Gateway) — changes there NEVER impact the frontend (`src/`) and vice versa. They share zero code and deploy independently.

## Commands
- `npm run dev` — Development server (port 8080)
- `npm run build` — Production build
- `npm run lint` — ESLint check

## Project Structure
```
src/
├── components/ui/        # shadcn/ui library
├── contexts/             # AuthContext (role-based permissions)
├── features/chat/        # Chat system (hooks, services, transformers, data)
├── features/crm/         # CRM & lead management
├── pages/                # Route components
├── hooks/                # Custom hooks (useChat, useLeads, useReports)
├── services/             # API integrations (hotelSearch, airfareSearch, pdfProcessor)
├── utils/                # Utilities (parsers, filters, formatters)
├── types/                # TypeScript types (index.ts, contextState.ts)
api/                      # Fastify API Gateway (Railway)
├── src/routes/v1/        # /search, /health
├── src/middleware/        # CORS, auth, rate limiting, correlation
├── src/services/          # searchExecutor, advancedFilters, cityCodeResolver
supabase/functions/       # Edge Functions (starling-search, eurovips-soap, ai-message-parser)
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

## Deployment
- **Frontend**: Railway (`npm run start`)
- **Public API**: Railway (Docker, health check on `/v1/health`)
- **Edge Functions**: Supabase
- **Proxy**: Cloudflare Worker (routes `/v1/*` → Railway, `/search` → Supabase)
