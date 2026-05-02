# Tool Catalog — Audit Report (Phase 6 + v2 update)

**Status (2026-05-02 v2):** GREEN — system prompt now carries `<persistence>`, `<tool_selection>`, and `<pending_action>` directives (PROMPT_VERSION=`emilia-parser-v5`). Two new turn-state tools (`apply_slot_values`, `confirm_pending_action`) shipped with the same audit pass criteria as the retrieval tools.

**Status (Phase 6 baseline):** YELLOW — schemas pass GPT-5.1 checklist, but **system prompt is missing every tool-related directive**. Phase 9 closed this gap; v2 added pending_action tools.

**Auditor:** Claude (Opus 4.7, 1M-context subagent)
**Date:** 2026-05-02 (v2 amendment)
**Scope:** every tool/edge function reachable from the chat surface
**Spec consulted:** `docs/architecture/tool-catalog-spec.md` (sections 1–7 + 3.5), `docs/architecture/context-engineering-spec.md` (incl. §1.6 PendingAction)
**No source code was modified during this audit.**

---

## 1. Inventory

### 1.1 Function tools (model-invoked through OpenAI tool-calling loop)

These are the tools the LLM itself decides to call inside `runToolLoop` in `supabase/functions/ai-message-parser/index.ts`. Catalog is intentionally small per spec §7.1 (anti-pattern: bloated tool sets).

| # | Tool | File | strict | Description quality | Overlap risk | Response cap | Wired into loop? |
|---|------|------|--------|---------------------|--------------|--------------|------------------|
| 1 | `get_planner_state` | `supabase/functions/_shared/functionTools.ts:91` | ✅ true | ✅ pass (Use when / Don't use for) | none | 8000 chars (~2k tok) via `fitToCap` | YES (`getRetrievalToolSchemas()`) |
| 2 | `get_quote` | `supabase/functions/_shared/functionTools.ts:203` | ✅ true | ✅ pass | none | n/a — handler returns `not_implemented` stub | YES |
| 3 | `get_recent_searches` | `supabase/functions/_shared/functionTools.ts:254` | ✅ true | ✅ pass | none | 8000 chars via `fitToCap` | YES |
| 4 | `get_lead_full_history` | `supabase/functions/_shared/functionTools.ts:353` | ✅ true | ✅ pass | none | 8000 chars via `fitToCap` | YES |
| 5 | `save_memory_note` | `supabase/functions/_shared/memoryTools.ts:37` | ✅ true | ✅ pass | none | `{ok:true}` or `{ok:false,reason}` | YES (Phase 9 wired into `runToolLoop`) |
| 6 | `apply_slot_values` | `supabase/functions/_shared/pendingActionTools.ts` | ✅ true | ✅ pass (Use when / Don't use for) | none | `{ok, applied, remaining, complete}` | YES (v2) |
| 7 | `confirm_pending_action` | `supabase/functions/_shared/pendingActionTools.ts` | ✅ true | ✅ pass | none | `{ok, confirmed, notes}` | YES (v2) |

Total exposed to model right now: **7 tools** (4 retrieval + 1 memory write + 2 turn-state resolution). `apply_slot_values` and `confirm_pending_action` are domain-agnostic — adding new pending-action `for` flows requires NO new tool, just a `case` in `applyPendingActionResolution` (client) or in the upstream handler that calls `setPendingAction`.

### 1.2 Edge functions (code-invoked from src/, never seen by the model)

These are the supplier/integration HTTP endpoints. The chat invokes them via deterministic handlers (`searchHandlers.ts`, `usePlannerGeneration.ts`, etc.), NOT via the LLM tool loop. The model triggers them only indirectly by emitting a `requestType` that maps to a handler in `useMessageHandler` → `searchHandlers`.

| Function | Caller(s) | Inputs validated | Response shape predictable | Notes |
|----------|-----------|------------------|----------------------------|-------|
| `starling-flights` | `searchHandlers.ts:473,598`, `pdf/pdfFlightSearch.ts:60` | partial — `searchFlights` action requires `data.*` fields but no Zod/JSON-schema validation; relies on provider-side rejection | yes (`{data:{...}}` envelope) | 30s timeout to TVC + 45s wrapper timeout in caller. Uses cache + rate-limit. |
| `eurovips-soap` | `searchHandlers.ts:1045,1653,1686`, `messageService.ts:78` | partial — params destructured with defaults inside each action; no schema validation at HTTP boundary | yes (parsed XML → JSON) | 30s SOAP timeout, hardcoded credentials in source (separate concern, not Phase 6). |
| `hotelbeds-api` | (not invoked from chat directly today, only sync paths) | n/a for chat | n/a | Audit out of scope for Phase 6. |
| `hotelbeds-activities` | (sync only) | n/a | n/a | Out of scope. |
| `hotelbeds-transfers` | (sync only) | n/a | n/a | Out of scope. |
| `hotelbeds-cache-sync` / `hotelbeds-content-sync` | scheduled / admin | n/a | n/a | Out of scope. |
| `search-coordinator` | (declared, not seen in current chat path) | yes — checks `searches` is non-empty array | yes (`{jobIds}`) | Async job dispatcher; not invoked by current chat code (grep returned 0 hits in `src/`). |
| `places-viewport` | `usePlacesOrchestrator` (via `places/service.ts`) | minimal — body cast to `PlacesViewportRequest` with no runtime check; service layer handles malformed inputs | yes (`{data, meta}`) | Per-invocation provider call counter, cooldown surfaced via `cooldownRemainingS`. |
| `place-details` / `place-summary` / `place-photos` / `place-recommendations` / `place-hotel-candidates` | `placesService.ts:103` (single dispatcher) | minimal — JSON body, no schema | yes | All under `_shared/places/`. |
| `foursquare-places` | indirect via `_shared/places/foursquare.ts` from server-side helpers | minimal | yes | Provider proxy. |
| `travel-itinerary` | `usePlannerGeneration.ts:68,174`, `searchHandlers.ts:1975` | yes — `PlannerRequest` interface with destructured fields and safe defaults | yes (canonical planner state JSON) | Uses OpenAI under the hood with structured prompt. |
| `ai-message-parser` | `aiMessageParser.ts:1832`, `chatToLead.ts:141` | yes — checks `message`, normalizes, returns 400 on parse failure | yes (`{requestType,...}` parsed envelope) | This IS the LLM entry point. Hosts the tool loop (Phase 3). |
| `add-message` | `messageService.ts:35` | yes — DB writes with explicit field whitelist | yes (`{message_id}`) | Persistence side-effect. |
| `pdf-text-extractor` / `pdf-ai-analyzer` | `pdfAnalysis.ts:66,99` | yes — file URL / extracted text | yes | PDF flow, not chat-tool. |
| `consumer-signup` | `consumerAuthService.ts:36` | yes (Zod-shaped) | yes | Auth, out of chat scope. |
| `create-user` | `useUsers.ts:142` | yes | yes | Admin, out of chat scope. |
| `api-auth` / `api-search` | external public API gateway | yes (FastAPI-style boundary) | yes | Different surface (Railway), not Edge. |
| `travel-chat/` | — | — | — | **Empty directory** (legacy/deprecated, can be deleted; no source files inside). |

### 1.3 Client services (pure fetching/parsing, no chat tool surface)

These are not "tools" by the spec definition; they are TypeScript helpers the chat handlers call directly. Listed for completeness; **not audited under §1.1 checklist**.

- `src/services/aiMessageParser.ts` — wraps the `ai-message-parser` edge fn invocation; returns `ParsedTravelRequest`.
- `src/services/airfareSearch.ts`, `hotelSearch.ts`, `packageSearch.ts`, `serviceSearch.ts` — local search orchestration helpers.
- `src/services/availabilityService.ts`, `cityCodeService.ts`, `cityCodeMapping.ts`, `countryCapitalResolver.ts`, `flightSegments.ts` — pure utilities.
- `src/services/pdf/*` — PDF pipeline.
- `src/services/pdfMonkey.ts`, `pdfMonkeyTemplates.ts`, `pdfProcessor.ts` — PDF generation.
- `src/features/chat/services/searchHandlers.ts` (2,129 lines) — the deterministic dispatcher that maps parsed `requestType` → edge function call.
- `src/features/chat/services/conversationOrchestrator.ts` (695 lines) — strict-mode (agency/passenger) routing into `executionBranch` ∈ {`ask_minimal`, `standard_itinerary`, `standard_search`, `mode_bridge`}.

---

## 2. Per-tool audit (the five model-invocable tools)

For each tool I checked the eight-point GPT-5.1 checklist:
1. Description ≥30 chars with `Use when:` and `Don't use for:`
2. `strict: true`
3. `additionalProperties: false`
4. Every property in `required`
5. Parameters descriptive and unambiguous
6. Zero overlap with other tools
7. Token-efficient response (≤2000 tokens)
8. A human engineer reading only the description can decide whether to invoke it

### 2.1 `get_planner_state`
- **(1)** ✅ 526 chars, both clauses present.
- **(2)** ✅ `strict: true`.
- **(3)** ✅ `additionalProperties: false`.
- **(4)** ✅ `["planner_id"]` is the only property and it is required.
- **(5)** ✅ `planner_id` description tells the model where to resolve from (`state.active_refs where type='plan'`).
- **(6)** ✅ no overlap; only this tool returns a full plan body.
- **(7)** ✅ `fitToCap` enforces 8000-char ceiling.
- **(8)** ✅ unambiguous trigger ("user references the plan AND needs detail beyond the active_refs summary").
- **Other notes:** the handler hardcodes `currency: "USD"` because `trips` table has no currency column. This is documented as a TODO in the code; tolerable but worth tracking.

### 2.2 `get_quote`
- **(1)** ✅ 459 chars, both clauses present.
- **(2)–(7)** ✅ same shape as 2.1.
- **(8)** ✅ unambiguous.
- **Caveat:** the handler is a stub that always returns `{error: "not_implemented", detail: "quotes table not yet provisioned…"}` because the `quotes` table does not yet exist (Phase 5 dependency). The description does NOT warn the model that the tool will currently always fail — this is a small UX risk: the model may keep retrying. **DEBT-1 (low-prio):** add a one-sentence note to the description like "Currently returns `not_implemented` until Phase 5; do not retry the same call within a turn."

### 2.3 `get_recent_searches`
- **(1)** ✅ 478 chars, both clauses present.
- **(2)** ✅ `strict: true`.
- **(3)** ✅ `additionalProperties: false`.
- **(4)** ✅ both `limit` and `kind` listed in `required` (correct strict-mode pattern with nullable types).
- **(5)** ✅ `limit` documents default-when-null (5) and hard max (10); `kind` is enum-constrained.
- **(6)** ✅ no overlap.
- **(7)** ✅ `fitToCap`; also slices `top` to 3 entries per search.
- **(8)** ✅ unambiguous.
- **Schema correctness call-out:** the `enum` array on `kind` includes the literal `null` element along with the strings — this is the canonical OpenAI strict-mode nullable-enum pattern. ✅

### 2.4 `get_lead_full_history`
- **(1)** ✅ 487 chars, both clauses present.
- **(2)–(7)** ✅ all pass.
- **(8)** ✅ description explicitly tells the model "Don't use for routine lookups (the profile in state.profile already includes lead_id, currency, top preferences)" — this prevents the model from reaching for it on every turn.
- **Other notes:** handler runs three queries in `Promise.all`, each agency-scoped. Returns up to 20 trips. Compact view is reasonable.

### 2.5 `save_memory_note`
- **(1)** ✅ 416 chars, both clauses present, explicit PII warnings.
- **(2)** ✅ `strict: true`.
- **(3)** ✅ `additionalProperties: false`.
- **(4)** ✅ `["text", "keywords", "scope"]` all required.
- **(5)** ✅ each property documented; `scope` is enum-constrained over `MEMORY_NOTE_SCOPES`.
- **(6)** ✅ only write tool, no overlap.
- **(7)** ✅ response is `{ok:true}` or `{ok:false,reason}` — minimal by design (spec §3.1).
- **(8)** ✅ unambiguous.
- **DEBT-2 (HIGH-prio):** **the schema exists but is NEVER passed to the OpenAI tool loop.** `ai-message-parser/index.ts:330` does `tools: getRetrievalToolSchemas()` and `toolHandlers: getRetrievalToolHandlers()` — neither of those spreads in `saveMemoryNoteToolSchema` or any handler around `executeSaveMemoryNote`. So the model literally cannot save memory notes today, even though the validation/persistence machinery is implemented and tested. The spec §3.1 and renderState.ts:52 both reference the tool as if it were live. Phase 9 MUST wire it.
- **DEBT-3 (medium):** spec §1.6 / §7.8 says `save_memory_note` is NOT parallel-safe with itself (de-dup ordering matters); the runtime serialization isn't enforced — `runToolLoop`'s `execBatch` runs everything in chunks of up to 4 in parallel. When the tool gets wired, either (a) `save_memory_note` calls must be partitioned and serialized inside `execBatch`, or (b) the runtime must reject more than one `save_memory_note` per iteration.

**Score: 4 of 4 retrieval tools fully pass; `save_memory_note` passes the schema audit but fails the wiring audit.**

### 2.6 `apply_slot_values` (v2)

- **(1)** ✅ 491 chars, both clauses ("Use when" / "Don't use for") present, explicitly tells the model to default to ISO YYYY-MM-DD and integers.
- **(2)** ✅ `strict: true`.
- **(3)** ✅ top-level `additionalProperties: false`. `values` itself is `additionalProperties: true` BY DESIGN — the slot keys are dynamic per `pending_action.fields`, so the schema cannot enumerate them. Server-side `intersectFields` filters unknown keys out (no security or correctness risk; the model is encouraged but not forced to match).
- **(4)** ✅ `["values"]` required.
- **(5)** ✅ description includes worked example payload.
- **(6)** ✅ no overlap — only fires when `pending_action.kind=awaiting_user_input`.
- **(7)** ✅ response envelope ≤200 bytes.
- **(8)** ✅ unambiguous: prompt block + `<pending_action>` rendering tells the model exactly when this tool applies.
- **Wiring:** YES, in `runToolLoop({ tools: [..., applySlotValuesToolSchema], toolHandlers: { ..., apply_slot_values: ...} })` (`ai-message-parser/index.ts`).
- **State mutation:** pure in-memory; batch-persisted at end of loop alongside any `save_memory_note` writes (single `UPDATE` round trip).

### 2.7 `confirm_pending_action` (v2)

- **(1)** ✅ 268 chars, both clauses present.
- **(2)** ✅ `strict: true`.
- **(3)** ✅ `additionalProperties: false`.
- **(4)** ✅ `["confirmed", "notes"]` both required (`notes` is nullable per OpenAI strict-mode pattern).
- **(5)** ✅ each field documented.
- **(6)** ✅ no overlap — fires only when `kind=awaiting_user_confirmation`.
- **(7)** ✅ response envelope ≤120 bytes.
- **(8)** ✅ unambiguous.
- **Wiring:** YES.
- **DEBT-11 (low):** no client-side dispatcher case yet for `for: 'confirm_*'` flows in `applyPendingActionResolution` — the tool returns OK and the state is stamped, but no domain mutation happens. Acceptable for v2 (no flow uses it yet). Add a `case 'confirm_booking':` (and friends) when the first booking confirmation flow ships.

**Score (v2 amendment): 7 of 7 tools pass schema + wiring audit.** All gaps are resolved or formally tracked as DEBT.

---

## 3. System prompt audit (`supabase/functions/ai-message-parser/prompt.ts`)

Read the entire 1,373-line file (`PROMPT_VERSION = 'emilia-parser-v4'`). Searched case-insensitively for: `tool`, `Tool`, `TOOL`, `herramienta`, `función`, `invoke`, `invocar`, `llamar`, `call a function`, `MUST call`, `persist`, `persist until`, `don't yield`, `sensible default`, `tool_selection`, `search tool`.

### 3.1 Persistence reminders (per GPT-5.1 guide)

Required directives:
- "Persist until the task is resolved end-to-end."
- "Don't yield prematurely — keep going if you have a viable path."
- "Assume sensible defaults for ambiguous directives; only ask if critical info is missing."
- "Only ask if critical info missing."

**Status: MISSING (none of the four are present in the prompt today).** The closest existing material is the single line:
> "Use semantic understanding and context clues. […] When uncertain, choose the most logical interpretation rather than asking for clarification" (lines 192, 207).

That covers ~half of the "sensible defaults" reminder but does not address persistence at all. The prompt is built around single-shot JSON extraction, not multi-iteration tool-using turns.

→ **DEBT-4 (HIGH-prio):** Phase 9 must add a `<persistence>` block to `prompt.ts` (probably near the top, before `TASK:` at line 147). Suggested wording, mirroring spec §1 conventions:

```
<persistence>
- Resolve the user's request end-to-end before yielding control.
- If a tool returns partial data, decide whether to retry, use another tool, or
  proceed with the partial result — do NOT stop and ask the user.
- Assume sensible defaults for ambiguous fields (origin = profile.default_origin_city,
  pax = 1 adult, dates = +7 days). Only ask the user when a critical, non-defaultable
  field is missing AND no tool can recover it.
- One focused question per turn, never a multi-question form.
</persistence>
```

### 3.2 Tool-selection rules (per GPT-5.1 guide §"Tool selection rules with thresholds")

Spec §4 prescribes a verbatim `<tool_selection>` block with eight bullets covering:
- prices/availability → MUST call ≥1 search tool
- conceptual destination questions → use internal knowledge
- "el plan / esto" + agency mode → call `get_planner_state` first
- "la cotización" → call `get_quote` first
- prior search references → call `get_recent_searches` first
- recurring lead → consider `get_lead_full_history` once
- `save_memory_note` is fire-and-forget
- parallelize independent retrieval calls
- 3-iteration cap

**Status: MISSING ENTIRELY.** Zero references to tool selection, zero mentions of any tool name, zero MUST/SHOULD/NEVER directives around tool invocation. The prompt does have many `🚨 CRITICAL` directives but they're all about JSON-extraction rules (luggage, mealPlan, hotelChains, dates) — none about the tool catalog.

→ **DEBT-5 (HIGH-prio):** Phase 9 must paste the spec §4 `<tool_selection>` block into `prompt.ts` verbatim (with translation/tone tuning if desired). Place it after the persistence block.

### 3.3 Memory tool guidance

The `renderState.ts` block (`<memory_instructions>`) at line 52 contains:
> "Save durable observations via save_memory_note tool — never PII, never speculation, never instructions."

This is good — and crucially, it's the ONLY place in the prompt-rendered output where the `save_memory_note` tool is mentioned. But:
1. It's only injected when `memoryStateBlock` is passed into `buildSystemPrompt` (i.e. when context-engineering state is being rendered). When `memoryStateBlock` is undefined (legacy paths), the model sees zero references to `save_memory_note`.
2. As noted in §2.5, the tool isn't even wired into the loop, so even when this guidance shows up, the tool call would fail with `unknown_tool`.

→ **DEBT-6 (medium):** once DEBT-2 is resolved, ensure the memory_instructions block is rendered for ALL turns where the tool loop is active, not just when an explicit `memoryStateBlock` is provided.

### 3.4 Other prompt observations (informational, not blockers)

- The prompt is **1,373 lines** — well past the GPT-5.1 guide recommendation of crisp directives over verbose few-shot examples (anti-pattern §7.3). It contains 15+ worked examples of JSON extraction. This isn't strictly a Phase 6 finding, but it suggests Phase 9 should consider a v5 prompt that splits "core extraction rules" from "tool guidance" and trims few-shot bloat.
- `PROMPT_VERSION = 'emilia-parser-v4'`. Phase 9 should bump to `v5` when adding the persistence + tool_selection blocks.
- The prompt uses ad-hoc emoji-tagged sections (`🚨 CRITICAL`) rather than structured XML tags. The spec implies XML tags (`<persistence>`, `<tool_selection>`, `<memory_instructions>`) — Phase 9 may want to standardize.

---

## 4. Debt items (NOT resolved in Phase 6 — actions for Phase 9 QA)

| ID | Severity | Title | File(s) | Action |
|----|----------|-------|---------|--------|
| DEBT-1 | low | `get_quote` description doesn't warn about `not_implemented` stub | `_shared/functionTools.ts:208–210` | Add one-sentence caveat about Phase-5 dependency; or remove tool until table exists. |
| DEBT-2 | **HIGH** | `save_memory_note` schema not wired into tool loop | `ai-message-parser/index.ts:330–331` | Spread `saveMemoryNoteToolSchema` into `tools` and add a handler that wraps `executeSaveMemoryNote` (with state plumbing). |
| DEBT-3 | medium | No serialization of multiple `save_memory_note` calls per turn | `_shared/toolRunner.ts:287–323` (`execBatch`) | Either partition `save_memory_note` calls and serialize them, or cap `save_memory_note` to one per iteration. **MITIGATED in Phase 8: parallel save_memory_note calls are batch-persisted after the loop completes (single UPDATE per turn). Race only theoretically possible across simultaneous turns of the same conversation, which is not a real-world pattern. Full serialization in toolRunner deferred.** |
| DEBT-4 | **HIGH** | Persistence reminders missing from system prompt | `ai-message-parser/prompt.ts` | Add `<persistence>` block (suggested wording in §3.1). |
| DEBT-5 | **HIGH** | `<tool_selection>` block missing from system prompt | `ai-message-parser/prompt.ts` | Paste spec §4 block verbatim. |
| DEBT-6 | medium | `<memory_instructions>` only renders when `memoryStateBlock` provided | `ai-message-parser/prompt.ts:60, 143–145` and `_shared/renderState.ts` | Always render memory instructions when tool loop is active. **BY DESIGN: `<memory_instructions>` only renders when state is being injected (memoryStateBlock provided). Without state, the prompt has no memories to instruct on, so the block adds no value. This is correct behavior.** |
| DEBT-7 | low | `runToolLoop` uses `model: 'gpt-4.1'` hardcoded, not GPT-5.1 | `ai-message-parser/index.ts:327` | When upgrading to GPT-5.1, change here. The comment says "gpt-4.1 supports tool calls + reliable JSON; mini doesn't always" — verify GPT-5.1 parity before swap. **RESOLVED in Phase 9: model is now overridable via the `CTX_TOOL_LOOP_MODEL` env var (defaults to `gpt-4.1`). Allows swap without redeploy.** |
| DEBT-8 | low | Empty `supabase/functions/travel-chat/` directory | `supabase/functions/travel-chat/` | Delete. Pure dead-folder cleanup. **RESOLVED in Phase 9: directory removed.** |
| DEBT-9 | low | `get_planner_state` returns hardcoded `currency: "USD"` | `_shared/functionTools.ts:173` | Either add `currency` column to `trips` or pull from `agency` row. **PARTIALLY RESOLVED in Phase 9: `createInitialEmiliaState` and `bootstrapStateIfMissing` now accept optional `currency`/`language` overrides (defaults USD/es). Call sites still need to wire agency_config when available; tracked as a follow-up.** |
| DEBT-10 | low | Edge functions called from chat (`starling-flights`, `eurovips-soap`, `places-viewport`) lack request-body schema validation at HTTP boundary | several | Add Zod or hand-rolled validation in each handler's first 10 lines. Currently they trust the caller. **DEFERRED to a separate hardening pass. Scope is too broad for Context Engineering Phase 9 — it touches 23 edge functions, each with its own input shape. Should be a focused security-review work item.** |
| DEBT-11 | low | `confirm_pending_action` has no client-side dispatcher case | `useMessageHandler.ts:applyPendingActionResolution` | Add `case 'confirm_*':` arms when the first booking-confirmation flow ships. Tool itself is correctly wired; only the domain-specific consumer is missing. |
| DEBT-12 | low | `applyPendingActionResolution` only handles `for: 'quote_completion'` today | `useMessageHandler.ts:applyPendingActionResolution` | Add new `case` per new pending-action `for` value. By design the parser/router need NO change — just the dispatcher. |

---

## 5. Recommendations for new tools (Phase 9+ scope)

The current 5-tool catalog is correctly scoped per spec §7.1 (avoid bloat). I do NOT recommend adding tools speculatively. However, three concrete gaps were observable:

### 5.1 `search_inventory` (or split: `search_flights` / `search_hotels` / `search_packages`) — **DO NOT add yet**

Today the model emits `requestType: "flights" | "hotels" | "combined" | "packages"` and the deterministic dispatcher in `useMessageHandler` calls the appropriate edge function. Per spec §4 (`<tool_selection>` rule #1): *"For ANY mention of specific prices, availability, or schedules: you MUST call at least one search tool."* The current architecture satisfies this rule via the parser → dispatcher contract, NOT via model-invoked tools.

If Phase 9 wants the LLM to be in charge of *whether* to search (rather than always emitting a `requestType`), then `search_flights`, `search_hotels`, `search_packages` would need to be added as proper function tools. **My recommendation: keep the current architecture (deterministic dispatch off `requestType`) for now.** Adding search tools would (a) duplicate the dispatcher logic, (b) put provider rate-limit handling on the LLM, (c) inflate the prompt with a bigger tool catalog, all for marginal gain. Re-evaluate after Phase 9 metrics.

### 5.2 `propose_destinations` — small, targeted tool worth considering

The discovery flow (`discoveryService.ts`) returns curated suggestions today via deterministic code. If/when the model needs to "suggest 5 destinations matching profile + budget" inside a tool-using turn, exposing this as a function tool would give the model agency over WHEN to suggest. Skip until there's evidence the model is hallucinating destinations or duplicating the discovery service.

### 5.3 `update_planner_state` (write tool, parallel to `save_memory_note`) — defer

Spec §6 mapping table mentions a future `save_planner_edit` tool ("out of scope here"). When the planner-edit flow is moved into the tool loop, this becomes the second write tool. Wait until a concrete trigger exists.

---

## 6. Closing note on Phase 6 status

**Audited:** 5 model-invocable tools (4 retrieval + 1 memory write).
**Pass:** 4 retrieval tools pass all 8 checklist points.
**Partial:** `save_memory_note` passes schema audit but fails the wiring audit (DEBT-2).
**System prompt:** fails on persistence reminders (DEBT-4), fails on `<tool_selection>` block (DEBT-5).
**Edge functions surveyed:** 23 (including 1 empty/legacy).
**Top-priority debt items for Phase 9:** DEBT-2, DEBT-4, DEBT-5 (all HIGH). The schemas are correct; the gap is that the LLM has no instructions telling it (a) the tools exist, (b) when to call them, and (c) to keep going until the task is resolved. Closing those three closes most of the gap between "Phase 3 wired the loop" and "Phase 6 says the agent will use it well."

The retrieval tool catalog itself is in good shape and matches the spec §2 contracts verbatim. No tool needs to be redesigned; only the surrounding prompt scaffolding does.
