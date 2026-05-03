# Context Engineering — Overview

> **Audience**: a developer new to the project who needs to understand how Emilia keeps state across turns and decides which tools to call. Read this **before** touching anything in `src/features/chat/state/`, `supabase/functions/_shared/{memoryTools,functionTools,toolRunner,renderState,lifecycleHooks,consolidateMemory}.ts`, or `supabase/functions/ai-message-parser/`.
>
> **Status**: This document describes the current `/emilia/chat` Context Engineering runtime. Open audit notes and remaining debt live in `docs/architecture/tool-catalog.md`.

---

## 1. Problem

Two real-world failures motivated this work:

1. **Mode switch lost context.** When a user moved from `chatMode = passenger` (planner UI) to `chatMode = agency` (CRM/quote UI), `plannerContext` was gated behind a conditional in `ChatFeature.tsx` and dropped. Emilia would forget the active plan mid-conversation and ask the user to re-state the trip.
2. **Push-first context was wasteful and brittle.** Every turn re-injected the conversation history, lead profile, and any extra knowledge the orchestrator had on hand into the system prompt. This wasted tokens, exposed Emilia to context rot in long conversations, and gave the model no way to *fetch only what it needed* for the current question.

We didn't want to bolt on another ad-hoc fix. We wanted a structured, documented memory architecture — so the next surface (e.g. agency settings page, post-trip follow-up) inherits the same primitives instead of inventing its own.

---

## 2. Approach

A faithful TypeScript port of the OpenAI Agents SDK / Cookbook *Context Engineering for Personalization* recipe, anchored to the GPT-5.1 Prompting Guide. Three layers:

- **Structured state** (`EmiliaState`) — a single typed object with `profile`, `global_memory`, `session_memory`, `active_refs`, `mode`, `trip_history`, and bookkeeping `meta`. Persisted per `conversation_id` in `agent_states`. This is what the cookbook calls `TravelState`.
- **Just-in-time function tools** — the model calls `get_planner_state`, `get_quote`, `get_recent_searches`, `get_lead_full_history` only when it needs that detail. Plus one write tool: `save_memory_note`.
- **Lifecycle helpers** — turn-start behavior is wired through `messageTurnContext.ts` + `useMessageHandler.ts`; turn count is bumped after parse; consolidation helpers (`lifecycleHooks.ts`, `consolidateMemory.ts`) exist but are not wired into the main chat runtime yet.

Why not adopt the Python Agents SDK directly? Our stack is fully TS (React 18 frontend, Supabase Edge Functions in Deno, Fastify gateway in Node 20). Adding a Python service would introduce duplicate domain types, cross-language RPC for everything Emilia touches, and a new ops surface. We needed the **patterns** — structured state, lifecycle hooks, sessions, function tools, precedence rules — not the runtime. The patterns are language-agnostic. See `docs/architecture/context-engineering-spec.md` §5 for the full mapping table.

---

## 3. Architecture diagram (one user turn)

```
User message in chat UI
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ src/features/chat/hooks/useMessageHandler.ts                            │
│                                                                         │
│   state = bootstrapStateIfMissing({conversationId, agencyId, ...})      │
│   state = applyModeChange(state, desiredMode) // only if drifted        │
│   state = setActiveRef(state, {type:'plan', id, summary, ts}) // opt.   │
│   memoryStateBlock = buildMemoryStateBlockFromState(state) // string    │
│   parseMessageWithAI({ message, memoryStateBlock, ... })                │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ supabase/functions/ai-message-parser/index.ts                           │
│                                                                         │
│   prompt = buildSystemPrompt({ ..., memoryStateBlock })                 │
│            └─ contains <persistence>, <tool_selection>,                 │
│               and (if memoryStateBlock) <user_profile>/<memories>/...   │
│                                                                         │
│   runToolLoop({                                                         │
│     tools: [...getRetrievalToolSchemas(), saveMemoryNoteToolSchema,     │
│             applySlotValuesToolSchema, confirmPendingActionToolSchema], │
│     handlers: { ...getRetrievalToolHandlers(),                          │
│                 save_memory_note: validate→trace→batch persist,         │
│                 apply_slot_values, confirm_pending_action }             │
│   })                                                                    │
│     └─ up to 3 iterations, parallel tool calls (cap 4),                 │
│        per-tool 8s, total 25s, force-final-answer fallback              │
│                                                                         │
│   batch-persist accepted save_memory_note results + pending_action      │
│   mutations into agent_states.state (Option A scope)                    │
│                                                                         │
│   emitTelemetry({ category: 'CTX-TOOL', ...iterations, tokens, ... })   │
│   if (memoryAttempted > 0):                                             │
│     emitTelemetry({ category: 'CTX-MEMORY', accepted, rejected, ... })  │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
   Parsed JSON envelope back to client
         │
         ▼
   Persist message (+ optional toolLoop meta) → render in chat
```

---

## 4. Key files (absolute paths)

| Concern | File | Notes |
|---|---|---|
| **State types (client)** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\src\features\chat\state\emiliaState.ts` | Source of truth for `EmiliaState`, `EmiliaProfile`, `MemoryNote`, `ContextRef`, `TripSummary`, factories. `MAX_GLOBAL_NOTES=6`, `MAX_SESSION_NOTES=8`, `SCHEMA_VERSION=1`. |
| **State types (edge)** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\_shared\emiliaStateTypes.ts` | Intentional duplicate of the client types — Deno requires `.ts` extensions; the bundler does not. Keep both files in sync on shape changes; bump `SCHEMA_VERSION` in both. |
| **RunContext** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\src\features\chat\state\runContext.ts` | TS analogue of `RunContextWrapper[T]`. `getState()` / `mutateState(updater)` / `subscribe(cb)`. Defensive `structuredClone` on construct + each mutate. |
| **Persistence** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\src\features\chat\state\persistence.ts` | `loadEmiliaState` / `saveEmiliaState` / `deleteEmiliaState` against `public.agent_states` (PK `conversation_id`, RLS by `agency_id`). Refuses loads if stored `schema_version > EMILIA_STATE_SCHEMA_VERSION`. |
| **React glue** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\src\features\chat\state\useEmiliaState.ts` | `useEmiliaState(conversationId)` (read) + `useUpdateState(conversationId)` (write). Built on `useSyncExternalStore` + a module-level `Map<conversationId, RunContext>` registry. |
| **Integration helpers** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\src\features\chat\state\contextEngineeringIntegration.ts` | Pure functions called by `useMessageHandler`: `bootstrapStateIfMissing`, `applyModeChange`, `setActiveRef`, `clearActiveRef`, `buildMemoryStateBlockFromState`. |
| **Render (client)** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\src\features\chat\state\renderClientState.ts` | Renders `EmiliaState` → XML-tagged block (`<user_profile>` YAML + `<current_mode>` + `<active_refs>` + `<memories>` + `<memory_instructions>`). Soft cap 4000 chars. |
| **Render (edge)** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\_shared\renderState.ts` | Edge-side mirror, identical contract. Tests assert both sides produce the same block for the same input. |
| **Memory tool** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\_shared\memoryTools.ts` | `saveMemoryNoteToolSchema` + `validateMemoryNote` + `executeSaveMemoryNote`. PII / instruction-shaped / speculation regex rejection. |
| **Retrieval tools** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\_shared\functionTools.ts` | `get_planner_state`, `get_quote` (stub), `get_recent_searches`, `get_lead_full_history`. All `strict: true`, `additionalProperties: false`, `fitToCap` (~8000 chars ≈ 2000 tokens). |
| **Tool loop** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\_shared\toolRunner.ts` | `runToolLoop` — generic OpenAI tool-calling loop. Iteration cap 3, per-tool 8s, total 25s, parallel cap 4, force-final-answer on cap/timeout. |
| **Lifecycle helpers** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\_shared\lifecycleHooks.ts` | `createLifecycleHooks()` returning `{onTurnStart, onTurnEnd, onSessionEnd}`. Pure; no I/O. Available helper API, not wired into the main chat runtime today. |
| **Consolidate helper** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\_shared\consolidateMemory.ts` | `consolidateMemory(state, openai)` — gpt-4.1, temp 0.1. On any failure returns the original state unchanged. Implemented helper; runtime integration remains open. |
| **Telemetry** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\_shared\telemetry.ts` | `emitTelemetry({ category: 'CTX-STATE'\|'CTX-TOOL'\|'CTX-MEMORY', ... })`. Plain `console.log` today, swappable for a sink in Phase 9 without touching call sites. |
| **System prompt** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\ai-message-parser\prompt.ts` | `PROMPT_VERSION = 'emilia-parser-v5'`. Carries `<persistence>` + `<tool_selection>` blocks; injects `MEMORY STATE` section when `memoryStateBlock` is provided. |
| **Parser entry** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\ai-message-parser\index.ts` | Hosts the tool loop (Phase 3). Internal network-resilience fallbacks for unparseable JSON / runToolLoop throw. |
| **Client parser wrapper** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\src\services\aiMessageParser.ts` | Forwards `memoryStateBlock` from the message handler into the edge function body. |
| **Audit endpoint** | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\agent-state-audit\index.ts` (+ `audit.ts`, `__tests__/audit.test.ts`) | Read-only debug endpoint: given a `message_id`, returns the EmiliaState snapshot, surrounding messages, tool calls, token usage. JWT-bound, RLS still applies. |

---

## 5. Lifecycle of one turn

1. **Client**: `useMessageHandler` calls `bootstrapStateIfMissing` — either loads an existing `agent_states` row for this conversation, or creates a fresh one via `createInitialEmiliaState` and persists it. The fresh state has empty `global_memory`, `session_memory`, `active_refs`, and `trip_history`; no cross-conversation pre-loading.
2. **Client**: if the desired chat mode differs from `state.mode`, `applyModeChange(state, newMode)` returns a new state with **only** `mode` mutated. Profile, memories, refs, and trip history are preserved.
3. **Client**: if there is an active planner / quote / lead the orchestrator wants Emilia to know about, `setActiveRef(state, ref)` adds or replaces a ref by `(type, id)`.
4. **Client**: `buildMemoryStateBlockFromState(state)` renders the XML block (`<user_profile>` YAML, `<current_mode>`, optional `<active_refs>`, `<memories>` markdown, constant `<memory_instructions>`). Soft cap 4000 chars; the renderer drops session memory first, then trims `MAX_GLOBAL_NOTES` down to 1, then to 0 if still over budget.
5. **Edge**: `ai-message-parser` builds the system prompt (`buildSystemPrompt` always carries `<persistence>` + `<tool_selection>`; `MEMORY STATE` section appears only when `memoryStateBlock` is present).
6. **Edge**: `runToolLoop` runs with the four retrieval tools + `save_memory_note` + `apply_slot_values` + `confirm_pending_action` (7 tools total).
7. **Edge**: any `save_memory_note` calls are validated; accepted notes are batched and appended to `agent_states.session_memory.notes` after the loop completes (avoids races when the model parallel-calls the tool). Persistence failures log a warning and never break the conversation.
8. **Edge**: `emitTelemetry({ category: 'CTX-TOOL', iterations, tools_called, errors, hit_cap, hit_timeout, prompt/completion/cached tokens, redundant_calls })`. If at least one `save_memory_note` was attempted: `emitTelemetry({ category: 'CTX-MEMORY', attempted, accepted, rejected, rejection_reasons })`.
9. **Edge**: response is the parsed JSON envelope plus a `meta.toolLoop` block (iteration count, trace) when the loop ran.
10. **Client**: if `meta.pendingActionResolution` is present, `consumePendingActionResolution` dispatches it to `pendingActionDispatcher`, mutates domain state when needed, then clears `pending_action`.
11. **Client**: persist the message, render. Re-iterate.

`onSessionEnd` / `consolidateMemory` are implemented as shared helpers, but the main chat turn loop does **not** currently call them when a conversation closes, idles, or reaches N=20 turns. Treat consolidation as available infrastructure pending runtime integration, not as active production behavior.

---

## 5.1 Source of truth

- **Runtime flow**: `src/features/chat/hooks/useMessageHandler.ts`, `src/features/chat/state/messageTurnContext.ts`, `supabase/functions/ai-message-parser/index.ts`.
- **State contract**: `docs/architecture/context-engineering-spec.md`.
- **Tool inventory and debt**: `docs/architecture/tool-catalog.md`.
- **Agent instructions**: `CLAUDE.md` and `AGENTS.md` should point here instead of duplicating runtime details.

---

## 6. Scope decision (Option A — full conversation isolation)

**This is the single most important decision in the spec. Repeat it before changing anything in `agent_states`, `bootstrapStateIfMissing`, or `consolidateMemory`.**

- `agent_states` is **per-conversation** (PK `conversation_id`). Each conversation is a fresh slate.
- `global_memory` is **per-conversation, not per-lead**, despite the name. The "global vs session" distinction is a **lifecycle** distinction (consolidated vs ephemeral within this conversation), not a scope distinction.
- A new conversation starts with `global_memory: { notes: [] }` and `session_memory: { notes: [] }`. Nothing is loaded from `LeadAiProfile` or from prior conversations of the same lead.
- `profile.lead_id` is a **CRM linkage** (this conversation belongs to lead X) but does NOT trigger any preference loading. If the same lead opens a new conversation, Emilia does not "remember" them — by design.
- If product needs evolve toward cross-conversation memory (Option B), introduce a separate `lead_memory` table with its own load-time merge step. **Do NOT retrofit `global_memory` to span conversations** — it would break the layer boundary, conflate lifecycle with scope, and require touching every consumer of the rendered block.

This decision is documented in `docs/architecture/context-engineering-spec.md` §1 and is reaffirmed in the doc-comments on `EmiliaState.global_memory` in both `emiliaState.ts` and `emiliaStateTypes.ts`.

---

## 7. Migration history

The CE layer was originally feature-flagged behind `VITE_USE_CONTEXT_ENGINEERING` (client) and `USE_FUNCTION_TOOLS` env / `x-use-tool-loop` header (edge). Both flags were removed in the cleanup migration once the layer was stable. The legacy paths (push-context system prompt + single-shot Chat Completions) are no longer in the codebase. To roll back, see `docs/architecture/rollback-plan.md`.

---

## 8. Token budget

Steady-state per turn, no tool round-trips. From `context-engineering-spec.md` §2:

| Section | Target | Hard cap |
|---|---:|---:|
| System prompt base + `<persistence>` + `<tool_selection>` | ≤ 1 500 | 1 800 |
| State injection (`<user_profile>` YAML + `<memories>` + `<active_refs>`) | ≤ 1 000 | 1 100 |
| Conversation tail (last ~6 user turns) | ≤ 2 000 | 2 800 |
| **Total normal turn (no tool calls)** | **~ 4 500** | 6 000 |
| Tool round-trip (when triggered) | +1 200 to +2 500 | per call |

Legacy single-shot path was running at roughly **~8 000 tokens** because it pushed `previousContext`, `conversationSummary`, `leadProfile`, **and** `plannerContext` JSON-stringified into every turn. The Context-Engineering path replaces those four blobs with a structured state block (~1 000 tokens) and has the model fetch full detail via tools only when needed.

The renderer enforces the state-injection cap with progressive degradation: drop session memory → halve global top-k → continue down to 0 memories.

---

## 9. Invariants — do not break

- **`agent_states` is per-conversation (Option A)**. PK `conversation_id`. Never add a load-step that pulls from prior conversations or from `lead_ai_profiles`. If you need cross-conversation memory, add a separate table.
- **`applyModeChange` mutates only `state.mode`**. Profile, `global_memory`, `session_memory`, `active_refs`, `trip_history`, `meta` are all preserved verbatim. The reciprocity tests in `src/features/chat/state/__tests__/reciprocity.test.ts` enforce this; do not weaken them.
- **`save_memory_note` rejection rules are non-negotiable.** PII (passport / payment / DOB / SSN), instruction-shaped phrases, speculation markers — all hard rejections. The regexes live in `supabase/functions/_shared/memoryTools.ts:PII_PATTERNS` / `INSTRUCTION_PATTERN` / `SPECULATION_PATTERN`. Loosening them risks PII leakage and prompt injection.
- **Precedence rules** (in `<memory_instructions>`, rendered every turn): user message > active refs > profile > session memory > global memory. Tools that surface conflicts must do so to the user, not silently pick a side.
- **Telemetry emissions are part of the contract.** `[CTX-TOOL]` fires every tool-loop turn; `[CTX-MEMORY]` fires whenever the model attempts at least one `save_memory_note`. Rollback decisions and the audit endpoint depend on these — do not remove the `emitTelemetry` calls.
- **Schema duplication is intentional.** `src/features/chat/state/emiliaState.ts` and `supabase/functions/_shared/emiliaStateTypes.ts` are two copies of the same shape. Bundler vs Deno resolution rules force this. Keep them in sync; bump `SCHEMA_VERSION` in both on breaking changes.
- **Persistence-layer schema-version refusal**: `loadEmiliaState` throws when the stored `schema_version > client version`. Don't catch and swallow — let the conversation surface the error rather than corrupt the row.

---

## 10. Status & open DEBT

- Phase 9 audit: `docs/architecture/tool-catalog.md`. The retrieval tool schemas pass the GPT-5.1 checklist; the system prompt carries `<persistence>` and `<tool_selection>` blocks in `PROMPT_VERSION = 'emilia-parser-v5'`.
- `get_quote` returns `{ error: "not_implemented" }` until the `quotes` table lands (Phase 5 dependency), and its tool description now warns the model not to retry it.
- Remaining open items are tracked in `docs/architecture/tool-catalog.md`, including save-memory-note serialization, compact-view currency sourcing, edge-function HTTP input validation, and dispatcher cases for future confirmation flows.
- Telemetry today writes structured `console.log` lines. A future sink (table or external) can replace the body without touching call sites.
- The old empty `supabase/functions/travel-chat/` directory has been removed.

---

## 11. References

- Plan: `C:\Users\Fran\.claude\plans\analiza-como-es-el-parallel-patterson.md`
- State spec: `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\docs\architecture\context-engineering-spec.md`
- Tool catalog spec: `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\docs\architecture\tool-catalog-spec.md`
- Phase 6 audit: `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\docs\architecture\tool-catalog.md`
- Memory lifecycle deep-dive: `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\docs\architecture\memory-lifecycle.md`
- Rollback plan: `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\docs\architecture\rollback-plan.md`
- Authoritative external sources cited throughout the spec: OpenAI Cookbook *Context Engineering for Personalization with Agents SDK* (`[CB-CTX]`), *Short-Term Memory Management with Sessions* (`[CB-SESS]`), *GPT-5.1 Prompting Guide* (`[GPT5.1]`), *Function Calling Guide* (`[FC]`).
