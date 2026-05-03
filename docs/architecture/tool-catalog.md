# Tool Catalog — Audit Report (Phase 6 + v2 update)

**Status (2026-05-03 v3):** GREEN — discovery flow consolidated end-to-end:
- `discover_places` retrieval tool added (semantic place search via Foursquare with internal geocoding fallback).
- `propose_planner_addition` planner-mutation proposal tool added (sets `pending_action.payload`; resolves on user confirm via `confirm_pending_action`; client dispatcher mutates `TripPlannerState`).
- Legacy client-side discovery curation (~700 LOC of regex / heuristic) deleted; tool path is the only path.
- Discovery candidates persisted to `state.discovery_candidates` (top-N, overwrite-on-next-call) and rendered into `<discovery_candidates>` block of the system prompt for next-turn referential resolution.

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
| 5 | `discover_places` | `supabase/functions/_shared/functionTools.ts:634` | ✅ true | ✅ pass (Use when / Don't use for) | none | `{ok, intent, destination, categories, places, meta}` | YES (`getRetrievalToolSchemas()`); top-N persisted to `state.discovery_candidates` via wrapper in `index.ts` |
| 6 | `save_memory_note` | `supabase/functions/_shared/memoryTools.ts:37` | ✅ true | ✅ pass | none | `{ok:true}` or `{ok:false,reason}` | YES (Phase 9 wired into `runToolLoop`) |
| 7 | `apply_slot_values` | `supabase/functions/_shared/pendingActionTools.ts:81` | ✅ true | ✅ pass (Use when / Don't use for) | none | `{ok, applied, remaining, complete}` | YES (v2) |
| 8 | `confirm_pending_action` | `supabase/functions/_shared/pendingActionTools.ts:109` | ✅ true | ✅ pass | none | `{ok, confirmed, notes}` | YES (v2); forwards `pending_action.payload` to client |
| 9 | `propose_planner_addition` | `supabase/functions/_shared/pendingActionTools.ts:338` | ✅ true | ✅ pass (Use when / Don't use for) | none | `{ok, pending_action_set, places_count, segment_id, day_index, resolved_names}` | YES (v3) — sets `pending_action.payload.resolved_places` for client dispatcher case `add_places_to_itinerary` |

Total exposed to model right now: **9 tools** (5 retrieval + 1 memory write + 2 turn-state resolution + 1 planner-mutation proposal). The two confirmation tools (`apply_slot_values`, `confirm_pending_action`) are domain-agnostic — adding new pending-action `for` flows requires NO new tool, just a `case` in `pendingActionDispatcher` (client) or in the upstream handler that calls `setPendingAction` / `executeProposePlannerAddition`.

`propose_planner_addition` is the first **domain proposal** tool (it does not mutate state directly; it stashes the resolved domain payload on `pending_action.payload` and waits for the user's yes/no via `confirm_pending_action`). When the user confirms, the server forwards `payload` in the resolution envelope and the client's `add_places_to_itinerary` dispatcher case mutates `TripPlannerState`.

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
| `travel-chat/` | — | — | — | **Removed** legacy directory. Not present in the current tree. |

### 1.3 Client services (pure fetching/parsing, no chat tool surface)

These are not "tools" by the spec definition; they are TypeScript helpers the chat handlers call directly. Listed for completeness; **not audited under §1.1 checklist**.

- `src/services/aiMessageParser.ts` — wraps the `ai-message-parser` edge fn invocation; returns `ParsedTravelRequest`.
- `src/services/airfareSearch.ts`, `hotelSearch.ts`, `packageSearch.ts`, `serviceSearch.ts` — local search orchestration helpers.
- `src/services/availabilityService.ts`, `cityCodeService.ts`, `cityCodeMapping.ts`, `countryCapitalResolver.ts`, `flightSegments.ts` — pure utilities.
- `src/services/pdf/*` — PDF pipeline.
- `src/services/pdfMonkey.ts`, `pdfMonkeyTemplates.ts`, `pdfProcessor.ts` — PDF generation.
- `src/features/chat/services/searchHandlers.ts` (2,129 lines) — the deterministic dispatcher that maps parsed `requestType` → edge function call.
- `src/features/chat/services/conversationOrchestrator.ts` — strict-mode (agency/passenger) routing into `executionBranch` ∈ {`ask_minimal`, `standard_itinerary`, `standard_search`, `mode_bridge`}.

---

## 2. Per-tool audit (the nine model-invocable tools)

> **Note (v3):** sections 2.1–2.7 below cover the original 7 tools. `discover_places` (tool #5) and `propose_planner_addition` (tool #9) ship with the same schema-audit pass criteria (`strict:true`, `additionalProperties:false`, `Use when / Don't use for` directives) but their full per-tool sub-section is deferred until a follow-up audit. See §2.8 below for the abbreviated v3 entries.

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
- **Caveat:** the handler is a stub that always returns `{error: "not_implemented", detail: "quotes table not yet provisioned…"}` because the `quotes` table does not yet exist (Phase 5 dependency). The tool description now explicitly warns the model that it currently returns `not_implemented` and should not be invoked until the table is provisioned. **DEBT-1 is resolved; the remaining product dependency is the missing `quotes` table / real handler.**

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
- **DEBT-2 (HIGH-prio): RESOLVED in Phase 9.** `saveMemoryNoteToolSchema` is now spread into `tools` and a `saveMemoryNoteHandler` is registered (`ai-message-parser/index.ts:387–401, 457, 463`). Accepted notes are batch-persisted to `agent_states.session_memory.notes` at the end of the tool loop alongside any pending-action mutations (single UPDATE per turn). Telemetry emits `[CTX-MEMORY]` with attempted/accepted/rejected counts.
- **DEBT-3 (medium):** multiple `save_memory_note` calls are batch-persisted after the loop, so same-turn parallel writes no longer clobber each other. Full serialization is still not enforced inside `toolRunner.execBatch`; the remaining risk is simultaneous turns on the same conversation, or future de-dup logic that depends on strict call order.

**Score: 9 of 9 tools shipped (7 fully audited per §§2.1–2.7, 2 abbreviated per §2.8).**

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

**Score (v3 amendment): 9 of 9 tools pass schema + wiring audit.** Tools #5 (`discover_places`) and #9 (`propose_planner_addition`) added in v3; per-tool sections deferred (see §2.8 for abbreviated entries). All wiring verified by tests at `supabase/functions/_shared/__tests__/{functionTools,pendingActionTools}.test.ts` and `src/features/chat/state/__tests__/pendingActionDispatcher.test.ts`.

### 2.8 v3 additions — abbreviated audit

#### `discover_places` (v3 — semantic place search)

- **(1)** ✅ description ≥30 chars, `Use when:` and `Don't use for:` present (`prompt.ts:95`).
- **(2)** ✅ `strict: true`.
- **(3)** ✅ `additionalProperties: false`.
- **(4)** ✅ all properties in `required` (per strict-mode contract).
- **(5)** ✅ parameters documented (`destination_city, destination_country, lat, lng, categories, intent, limit_per_category, radius_m`).
- **(6)** ✅ no overlap — only place-discovery tool. Replaces former client-side regex curation (deleted in v3).
- **(7)** ✅ response includes compact `{places: [...]}`. Top-N persisted to `state.discovery_candidates` server-side (Phase 2 wrapper in `index.ts`).
- **(8)** ✅ unambiguous; `Use when` lists the place kinds explicitly.
- **Wiring:** YES (`getRetrievalToolSchemas()` + persistence wrapper at `index.ts:451`).
- **Lat/lng resolution:** internal Foursquare geocoding fallback at `_shared/places/service.ts:resolveCityCoordinates` (Phase 1C). Telemetry: `[CTX-DISCOVERY-GEOCODE]` + `meta.geocodingUsed: 'llm' | 'internal' | 'none'`.
- **Fallback path:** when lat/lng cannot be resolved, falls back to `fetchPlaceRecommendations` which now respects `categories` (Phase 1B — `bars in {city}` etc., not the previous broad `top tourist attractions in {city}`).

#### `propose_planner_addition` (v3 — planner mutation proposal)

- **(1)** ✅ description ≥30 chars, `Use when:` and `Don't use for:` present.
- **(2)** ✅ `strict: true`.
- **(3)** ✅ `additionalProperties: false`.
- **(4)** ✅ `["place_ids", "segment_id", "day_index", "note"]` all required (nullables per strict-mode).
- **(5)** ✅ each field documented; cross-references `state.discovery_candidates`.
- **(6)** ✅ no overlap — first domain-proposal tool. Distinct from `apply_slot_values` / `confirm_pending_action` (which RESOLVE existing pending_actions).
- **(7)** ✅ response ≤200 bytes (`{ok, pending_action_set, places_count, segment_id, day_index, resolved_names}`).
- **(8)** ✅ semantically unambiguous — explicitly says it does NOT mutate, only proposes.
- **Wiring:** YES — schema in `tools` array, handler in `toolHandlers` (`index.ts:480-499`). Mutates `stateForTools.pending_action.payload`; persistence flushes via `hasPendingActionWrite` guard (`index.ts:543`).
- **Resolution:** when user confirms via `confirm_pending_action`, the modified `confirmPendingActionHandler` (`index.ts:434`) forwards `pending_action.payload` in the resolution envelope. Client `pendingActionDispatcher.ts:handleAddPlacesToItinerary` reads `payload.resolved_places` + `segment_id` + `day_index` + `note` and mutates `TripPlannerState` via `updatePlannerState`.
- **Block heuristic (client):** `restaurant`/`cafe`/`nightlife` → evening; `museum`/`sights`/`culture` → morning; otherwise afternoon. Day index clamped to available days.
- **Token cost:** schema adds ~700 tokens to every input (charged per turn). Justified by enabling deterministic planner mutations from natural language without an extra LLM round-trip.

---

## 3. System prompt audit (`supabase/functions/ai-message-parser/prompt.ts`)

Original audit was on `PROMPT_VERSION = 'emilia-parser-v4'`. Phase 9 bumped to `v5`; the audit below is amended in-place to reflect the v5 state.

### 3.1 Persistence reminders (per GPT-5.1 guide)

Required directives:
- "Persist until the task is resolved end-to-end."
- "Don't yield prematurely — keep going if you have a viable path."
- "Assume sensible defaults for ambiguous directives; only ask if critical info is missing."
- "Only ask if critical info missing."
- "One focused question per turn, never a multi-question form."

**Status: PARTIALLY RESOLVED in v5.** A `<persistence>` block now exists at `prompt.ts:77–82`:

```
<persistence>
- Persist until the parsing task is fully resolved end-to-end. Don't yield prematurely with partial JSON or "needs more info" unless a critical field is truly missing.
- For ambiguous directives, assume sensible defaults (typical traveler counts, current month dates, common origin) rather than asking back.
- Only signal "missing info" for hard requirements: destination city, headcount when not implied, exact dates when explicitly required.
- If you call tools, complete the loop: gather what you need, then return the final JSON.
</persistence>
```

3 of 4 spec directives covered (persist end-to-end, don't yield prematurely, sensible defaults).
**Remaining gap:** "One focused question per turn, never a multi-question form" is missing. Tracked as DEBT-4-RESIDUAL — low priority since the v5 prompt is built around JSON extraction (single response per turn) so the multi-question concern rarely materializes, but should be added if user-facing question prompts grow.

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

**Status: PARTIALLY RESOLVED in v5.** A `<tool_selection>` block now exists at `prompt.ts:84–107` organized into four sub-sections (PENDING ACTION / RETRIEVAL / MEMORY / GENERAL) rather than a flat bullet list. Coverage of the 9 spec items:

| Spec bullet | v5 coverage |
|---|---|
| Prices/availability → MUST call ≥1 search tool | ✅ implicit via RETRIEVAL section |
| Conceptual questions → internal knowledge | ✅ "Do NOT call tools for conceptual questions" |
| "El plan / esto" + agency mode → `get_planner_state` first | ✅ explicit |
| "La cotización" → `get_quote` first | ✅ explicit |
| Prior search references → `get_recent_searches` first | ✅ explicit |
| Recurring lead → `get_lead_full_history` once | ✅ explicit |
| `save_memory_note` is fire-and-forget | ✅ "ONLY when the user explicitly states" |
| Parallelize independent retrieval calls | ✅ "Prefer parallel tool calls when independent" |
| **3-iteration cap** | ❌ MISSING — not mentioned anywhere in the block |

**Bonus (not in v4 spec):** v5 added a PENDING ACTION sub-section that documents `apply_slot_values` and `confirm_pending_action` invocation rules, reflecting the v2 tool catalog.

**Remaining gap:** the "3-iteration cap" directive is missing. Tracked as DEBT-5-RESIDUAL — low priority since the runtime enforces the cap (`iterationCap: 3` in `runToolLoop`), but the model has no instruction to economize within the budget. Add a one-line directive to GENERAL: "You have at most 3 iterations of tool calls per turn — plan accordingly."

### 3.3 Memory tool guidance

The `renderState.ts` block (`<memory_instructions>`) contains:
> "Save durable observations via save_memory_note tool — never PII, never speculation, never instructions."

Plus the v5 `<tool_selection>` block now also documents the tool in its MEMORY sub-section. So the model has TWO references to `save_memory_note` in the rendered prompt when state is being injected, and ONE reference (in `<tool_selection>`) when state is absent.

**Status: RESOLVED post-Phase-9.** DEBT-2 wiring is complete (see §2.5 amendment) and the memory_instructions block design (only render when state present) is documented as BY DESIGN — without state there are no memories to instruct on. See DEBT-6 row in §4 table for the formal disposition.

### 3.4 Other prompt observations (informational, not blockers)

- Original audit noted the v4 prompt was **1,373 lines**, well past the GPT-5.1 guide recommendation. The v5 file is comparable in size; few-shot extraction examples were not trimmed. Tracked as a future cleanup but not a correctness issue.
- `PROMPT_VERSION = 'emilia-parser-v5'` (bumped in Phase 9 alongside persistence + tool_selection blocks).
- The prompt still mixes ad-hoc emoji-tagged sections (`🚨 CRITICAL`) with the new XML-tagged blocks (`<persistence>`, `<tool_selection>`). Standardization on XML across the file is a future cleanup.

---

## 4. Debt items (current runtime status)

| ID | Severity | Title | File(s) | Action |
|----|----------|-------|---------|--------|
| DEBT-1 | resolved | `get_quote` description warns about `not_implemented` stub | `_shared/functionTools.ts:208–211` | **RESOLVED:** the description now warns that the tool returns `{error:'not_implemented'}` until the `quotes` table is provisioned and tells the model not to invoke it. Remaining product work: provision `quotes` + replace the stub handler. |
| DEBT-2 | ~~HIGH~~ | `save_memory_note` schema not wired into tool loop | `ai-message-parser/index.ts:330–331` | ~~Spread `saveMemoryNoteToolSchema` into `tools` and add a handler that wraps `executeSaveMemoryNote` (with state plumbing).~~ **RESOLVED in Phase 9: tool wired at `index.ts:457`, handler at `:387–401`. Notes batch-persisted to `agent_states.session_memory.notes` after the loop. `[CTX-MEMORY]` telemetry emitted with attempted/accepted/rejected counts.** |
| DEBT-3 | medium | No strict serialization of multiple `save_memory_note` calls in `toolRunner` | `_shared/toolRunner.ts:287–323` (`execBatch`) | **MITIGATED:** accepted notes are batch-persisted after the loop in a single `agent_states` update. Remaining work, if needed: partition `save_memory_note` calls inside `execBatch` or cap to one per iteration for strict ordering guarantees. |
| DEBT-4 | ~~HIGH~~ → low | Persistence reminders missing from system prompt | `ai-message-parser/prompt.ts:77–82` | ~~Add `<persistence>` block~~ **RESOLVED in Phase 9 (v5):** block added covering 3 of 4 directives. Residual: "one focused question per turn" line still missing — low-priority follow-up. |
| DEBT-5 | ~~HIGH~~ → low | `<tool_selection>` block missing from system prompt | `ai-message-parser/prompt.ts:84–107` | ~~Paste spec §4 block verbatim~~ **RESOLVED in Phase 9 (v5):** block added with 4 sub-sections (PENDING ACTION / RETRIEVAL / MEMORY / GENERAL) plus v2 turn-state tools. Residual: "3-iteration cap" directive missing (runtime enforces it but model has no instruction to economize) — low-priority one-line addition. |
| DEBT-6 | medium | `<memory_instructions>` only renders when `memoryStateBlock` provided | `ai-message-parser/prompt.ts:60, 143–145` and `_shared/renderState.ts` | Always render memory instructions when tool loop is active. **BY DESIGN: `<memory_instructions>` only renders when state is being injected (memoryStateBlock provided). Without state, the prompt has no memories to instruct on, so the block adds no value. This is correct behavior.** |
| DEBT-7 | low | `runToolLoop` uses `model: 'gpt-4.1'` hardcoded, not GPT-5.1 | `ai-message-parser/index.ts:327` | When upgrading to GPT-5.1, change here. The comment says "gpt-4.1 supports tool calls + reliable JSON; mini doesn't always" — verify GPT-5.1 parity before swap. **RESOLVED in Phase 9: model is now overridable via the `CTX_TOOL_LOOP_MODEL` env var (defaults to `gpt-4.1`). Allows swap without redeploy.** |
| DEBT-8 | resolved | Empty `supabase/functions/travel-chat/` directory | `supabase/functions/travel-chat/` | **RESOLVED:** directory removed from the current tree. |
| DEBT-9 | low | `get_planner_state` returns hardcoded `currency: "USD"` | `_shared/functionTools.ts:173` | Either add `currency` column to `trips` or pull from `agency` row. **PARTIALLY RESOLVED in Phase 9: `createInitialEmiliaState` and `bootstrapStateIfMissing` now accept optional `currency`/`language` overrides (defaults USD/es). Call sites still need to wire agency_config when available; tracked as a follow-up.** |
| DEBT-10 | low | Edge functions called from chat (`starling-flights`, `eurovips-soap`, `places-viewport`) lack request-body schema validation at HTTP boundary | several | Add Zod or hand-rolled validation in each handler's first 10 lines. Currently they trust the caller. **DEFERRED to a separate hardening pass. Scope is too broad for Context Engineering Phase 9 — it touches 23 edge functions, each with its own input shape. Should be a focused security-review work item.** |
| DEBT-11 | low | `confirm_pending_action` has no client-side dispatcher case | `useMessageHandler.ts:applyPendingActionResolution` | Add `case 'confirm_*':` arms when the first booking-confirmation flow ships. Tool itself is correctly wired; only the domain-specific consumer is missing. |
| DEBT-12 | resolved | `pendingActionDispatcher.ts` handles the currently emitted `for` values | `src/features/chat/state/pendingActionDispatcher.ts` | **RESOLVED for current flows:** dispatcher handles `quote_completion`, `collect_clarification`, `combined_completion`, `flight_completion`, `hotel_completion`, and `itinerary_completion`. Future flows still require adding a handler for the new `for` value; parser/router need no change. |
| DEBT-13 | medium | `conversationKnowledgeService.ts` summary helpers (`buildConversationSummary` / `loadConversationSummary` / `saveConversationSummary`) are dead code post-CE | `src/features/chat/services/conversationKnowledgeService.ts`, `src/features/chat/services/messageStorageService.ts`, `src/features/chat/hooks/useMessageHandler.ts:674, 835, 932-933` | Per CE spec §6, per-conversation memory lives in `agent_states.session_memory`. The summary load → parser-prompt path is no longer consumed; the post-turn save is fire-and-forget with no reader. **Action (Phase 7 of cleanup plan):** delete the 3 helpers from both `conversationKnowledgeService.ts` and the duplicated impl in `messageStorageService.ts:202-266`; remove the unused load + save calls in `useMessageHandler.ts`; update test mocks. |
| DEBT-14 | low | `useContextualMemory.ts` hook is exported but never imported by active code | `src/features/chat/hooks/useContextualMemory.ts`, `src/features/chat/hooks/index.ts:2` | Wrapper hook around the dead summary helpers (DEBT-13). Only referenced by historical docs (handoffs, PR notes). **Action (Phase 7 of cleanup plan):** delete the hook file and its barrel export. Safe deletion — zero active imports. |
| DEBT-15 | resolved/partial | Legacy `leadProfile` parser-prompt injection removed; `lead_ai_profiles` writer remains | `src/features/chat/hooks/useMessageHandler.ts:884–892, 1886–1889`; `_shared/functionTools.ts:get_lead_full_history` | **RESOLVED for Context Engineering:** the parser prompt no longer receives a loaded lead profile; lead history is retrieved on demand via `get_lead_full_history`. Keep the post-turn `mergeLeadAiProfile` + `saveLeadAiProfile` writer because `lead_ai_profiles` is still the durable cross-conversation lead profile store used by the retrieval tool. |

---

## 5. Recommendations for new tools (Phase 9+ scope)

The current 7-tool catalog is correctly scoped per spec §7.1 (avoid bloat). I do NOT recommend adding tools speculatively. However, three concrete gaps were observable:

### 5.1 `search_inventory` (or split: `search_flights` / `search_hotels` / `search_packages`) — **DO NOT add yet**

Today the model emits `requestType: "flights" | "hotels" | "combined" | "packages"` and the deterministic dispatcher in `useMessageHandler` calls the appropriate edge function. Per spec §4 (`<tool_selection>` rule #1): *"For ANY mention of specific prices, availability, or schedules: you MUST call at least one search tool."* The current architecture satisfies this rule via the parser → dispatcher contract, NOT via model-invoked tools.

If a future iteration wants the LLM to be in charge of *whether* to search (rather than always emitting a `requestType`), then `search_flights`, `search_hotels`, `search_packages` would need to be added as proper function tools. **My recommendation: keep the current architecture (deterministic dispatch off `requestType`) for now.** Adding search tools would (a) duplicate the dispatcher logic, (b) put provider rate-limit handling on the LLM, (c) inflate the prompt with a bigger tool catalog, all for marginal gain. Re-evaluate only after tool-loop telemetry shows a clear need.

### 5.2 `propose_destinations` — small, targeted tool worth considering

The discovery flow (`discoveryService.ts`) returns curated suggestions today via deterministic code. If/when the model needs to "suggest 5 destinations matching profile + budget" inside a tool-using turn, exposing this as a function tool would give the model agency over WHEN to suggest. Skip until there's evidence the model is hallucinating destinations or duplicating the discovery service.

### 5.3 `update_planner_state` (write tool, parallel to `save_memory_note`) — defer

Spec §6 mapping table mentions a future `save_planner_edit` tool ("out of scope here"). When the planner-edit flow is moved into the tool loop, this becomes the second write tool. Wait until a concrete trigger exists.

---

## 6. Closing note on Phase 6 status

**Status (post-v3 amendment, 2026-05-03):** 9 of 9 tools fully wired. 7 fully audited per §§2.1–2.7; 2 abbreviated per §2.8. Discovery flow consolidated end-to-end (legacy client-side regex curation deleted). See §2 sections + the `Status` header at the top of this file for the current state.

**Previous status (post-v2 amendment, 2026-05-02):** 7 of 7 tools fully wired and audited. DEBT-2 (`save_memory_note` wiring), DEBT-4 (`<persistence>` block), DEBT-5 (`<tool_selection>` block) all closed in Phase 9. See §2 sections + the `Status` header at the top of this file for the current state.

**Original Phase 6 finding (preserved for historical context):**

**Audited:** 5 model-invocable tools (4 retrieval + 1 memory write).
**Pass:** 4 retrieval tools pass all 8 checklist points.
**Partial:** `save_memory_note` passes schema audit but fails the wiring audit (DEBT-2).
**System prompt:** fails on persistence reminders (DEBT-4), fails on `<tool_selection>` block (DEBT-5).
**Edge functions surveyed:** 23 (including 1 empty/legacy).
**Top-priority debt items for Phase 9:** DEBT-2, DEBT-4, DEBT-5 (all HIGH). The schemas are correct; the gap is that the LLM has no instructions telling it (a) the tools exist, (b) when to call them, and (c) to keep going until the task is resolved. Closing those three closes most of the gap between "Phase 3 wired the loop" and "Phase 6 says the agent will use it well."

The retrieval tool catalog itself is in good shape and matches the spec §2 contracts verbatim. No tool needs to be redesigned; only the surrounding prompt scaffolding does.
