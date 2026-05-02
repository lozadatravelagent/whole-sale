# Tool Catalog Spec — Emilia (OpenAI Context Engineering)

**Status:** Draft (Phase 0.2–0.3)
**Owner:** Emilia agent platform
**Audience:** engineers implementing Phase 3 (Function Tools) and Phase 6 (Tool Audit)
**Authoritative sources:**
- OpenAI *Function Calling Guide* (https://platform.openai.com/docs/guides/function-calling)
- OpenAI *GPT-5.1 Prompting Guide* (Cookbook)
- OpenAI Cookbook *Context Engineering for Personalization with Agents SDK*

This document is the contract for all function tools the Emilia agent invokes. Phase 3 must implement exactly the tools described here, with the schemas described here, and no others. Adding a tool requires updating this doc first.

---

## 1. Tool Design Principles (GPT-5.1 Guide)

Every tool registered in `_shared/functionTools.ts` MUST satisfy ALL of the following. These are non-negotiable invariants — the audit in Phase 6 will reject tools that fail any rule.

### 1.1 Description quality
- **Length**: description ≥ 30 characters, ideally 100–250.
- **Format**: must include both clauses, in this order:
  - `Use when: ...` — concrete user/agent triggers
  - `Don't use for: ...` — explicit exclusions to prevent overlap
- **Litmus test (GPT-5.1 guide)**: a human engineer reading only the description must be able to decide unambiguously whether to invoke the tool. If two engineers disagree on borderline cases, the description is not specific enough.
- **Tool guidance lives in the description, not in the system prompt** (GPT-5.1 guide §"Tool descriptions over system instructions"). Per-tool nuances (rate limits, response shape caveats, when results may be partial) belong in `description`.

### 1.2 Strict mode
- `strict: true` is **mandatory** on every function schema (GPT-5.1 guide).
- This requires:
  - `additionalProperties: false` on every object schema (root and nested).
  - Every property listed in `required`.
  - No `oneOf`/`anyOf` at the root params level (use `enum` instead).
  - No optional fields without an explicit `null` union; if a field is truly optional, model it as `{ type: ["string", "null"] }` and require it.

### 1.3 Parameter discipline
- Names are descriptive and unambiguous: `planner_id`, not `id`; `limit`, not `n`.
- Every parameter has a `description` ≥ 1 sentence explaining semantics, units, and default behavior when null.
- Enums are preferred over free-form strings for any closed vocabulary (`scope`, `category`).

### 1.4 Zero overlap
- No two tools may legitimately serve the same trigger. Overlap forces the model to guess and degrades selection quality.
- Validation: write the trigger sentence ("user references the plan and wants to quote it"). Exactly one tool's `Use when:` clause should match.

### 1.5 Token-efficient responses
- Responses are compact JSON. No prose wrappers, no echo of inputs, no metadata not needed for the next turn.
- Hard cap per response: **2,000 tokens**. If the natural response exceeds this, the tool MUST paginate or summarize and document the truncation in `description`.
- Field naming: short but readable (`days`, not `d`; `destinations`, not `dest`).
- Numeric IDs and ISO dates only; no debug timestamps, no provider raw payloads.

### 1.6 Parallel tool calls
- Per Function Calling Guide, parallel tool calls are enabled at the request level (default `parallel_tool_calls: true`).
- A tool is **parallel-safe** when it has no side effects on shared state and is idempotent. All four retrieval tools below are parallel-safe.
- `save_memory_note` is **not** parallel-safe with itself (ordering matters for de-dup). The runtime must serialize multiple `save_memory_note` calls within the same turn.

---

## 2. Retrieval Tools (just-in-time, task-specific data)

All four tools are registered in `supabase/functions/_shared/functionTools.ts` (new file, Phase 3.2). They are pure reads — no DB writes, no side effects on `EmiliaState`.

---

### 2.1 `get_planner_state`

**Description (verbatim, used in schema):**
> Fetch the full trip plan for a given planner_id (destinations, dates, hotels, transport, daily activities, budget, pace). Use when: the user references "the plan", "el itinerario", or "esto" and a plan ref is active; you need plan specifics to quote, edit, or compare; mode=agency and the user asks to price the current plan. Don't use for: general questions about destinations the user has not added to a plan; quick suggestions where the active_refs summary already suffices.

**Schema:**
```json
{
  "name": "get_planner_state",
  "description": "Fetch the full trip plan ...",
  "strict": true,
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "planner_id": {
        "type": "string",
        "description": "UUID of the trip planner. Resolve from state.active_refs where type='plan'."
      }
    },
    "required": ["planner_id"]
  }
}
```

**Invocation example:**
```json
{ "name": "get_planner_state", "arguments": { "planner_id": "abc123" } }
```

**Response example (compact JSON, ≤ 2k tokens):**
```json
{
  "planner_id": "abc123",
  "title": "Sudamérica 12 días",
  "currency": "USD",
  "budget": "mid",
  "pace": "moderate",
  "start_date": "2026-09-10",
  "end_date": "2026-09-22",
  "pax": { "adults": 2, "children": 0 },
  "destinations": [
    { "city": "Buenos Aires", "country": "AR", "days": 4, "arrive": "2026-09-10" },
    { "city": "Iguazu",       "country": "AR", "days": 2, "arrive": "2026-09-14" },
    { "city": "Rio de Janeiro","country": "BR","days": 4, "arrive": "2026-09-16" },
    { "city": "Salvador",      "country": "BR","days": 2, "arrive": "2026-09-20" }
  ],
  "hotels": [
    { "city": "Buenos Aires", "name": "Alvear Art", "nights": 4, "category": 4 }
  ],
  "transport": [
    { "from": "BUE", "to": "IGR", "mode": "flight", "date": "2026-09-14" }
  ],
  "updated_at": "2026-04-25T18:42:00Z"
}
```

**CRM use cases:**
- Passenger built a 12-day plan, switches to agency mode, asks "cotizá esto". Agent calls `get_planner_state` → then `searchFlights`/`searchHotels` per destination.
- Agency rep wants to add a 3rd destination: agent fetches state, edits in memory, persists via `save_planner_edit` (out of scope here).

---

### 2.2 `get_quote`

**Description:**
> Fetch a previously generated agency quote (quote_id) including totals, line items, currency, validity window, and lead linkage. Use when: the user references "la cotización", "ese precio", "la propuesta"; mode=agency and a quote ref is active; the user asks to modify, resend, or compare quotes. Don't use for: generating a new quote (use search tools first); accessing the underlying plan (use get_planner_state).

**Schema:**
```json
{
  "name": "get_quote",
  "description": "Fetch a previously generated agency quote ...",
  "strict": true,
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "quote_id": {
        "type": "string",
        "description": "UUID of the quote. Resolve from state.active_refs where type='quote'."
      }
    },
    "required": ["quote_id"]
  }
}
```

**Invocation example:**
```json
{ "name": "get_quote", "arguments": { "quote_id": "q_7f3a" } }
```

**Response example:**
```json
{
  "quote_id": "q_7f3a",
  "lead_id": "ld_991",
  "planner_id": "abc123",
  "currency": "USD",
  "total": 6420,
  "valid_until": "2026-05-15",
  "status": "sent",
  "items": [
    { "type": "flight", "desc": "EZE-GIG-EZE", "pax": 2, "subtotal": 1820 },
    { "type": "hotel",  "desc": "Alvear Art x4n", "pax": 2, "subtotal": 1600 },
    { "type": "hotel",  "desc": "Copacabana Palace x4n", "pax": 2, "subtotal": 2800 },
    { "type": "fee",    "desc": "Agency fee 5%",  "subtotal": 200 }
  ],
  "created_at": "2026-04-22T14:10:00Z"
}
```

**CRM use cases:**
- Lead replies "el precio me parece alto, ¿podés bajar el hotel de Rio?". Agent calls `get_quote` → identifies the line item → recalculates.
- Seller asks "mostrame qué cotizaciones le mandé a este lead": handled upstream by lead view; this tool is for the *active* quote in turn.

---

### 2.3 `get_recent_searches`

**Description:**
> Fetch the last N flight/hotel/package searches executed in the current conversation, with key parameters and top results summary. Use when: the user references "esa búsqueda", "los vuelos que vimos antes", "el hotel de la mañana"; you need context from earlier exploration that was trimmed from the conversation tail. Don't use for: re-running a search (call the search tool directly with fresh parameters); fetching results from a different conversation.

**Schema:**
```json
{
  "name": "get_recent_searches",
  "description": "Fetch the last N flight/hotel/package searches ...",
  "strict": true,
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "limit": {
        "type": ["integer", "null"],
        "description": "Max number of searches to return, ordered most-recent first. Null defaults to 5. Hard max 10."
      },
      "kind": {
        "type": ["string", "null"],
        "enum": ["flights", "hotels", "packages", null],
        "description": "Filter by search kind. Null returns all kinds."
      }
    },
    "required": ["limit", "kind"]
  }
}
```

**Invocation example:**
```json
{ "name": "get_recent_searches", "arguments": { "limit": 3, "kind": "hotels" } }
```

**Response example:**
```json
{
  "searches": [
    {
      "id": "s_42",
      "kind": "hotels",
      "at": "2026-04-25T18:30:00Z",
      "params": { "city": "Rio de Janeiro", "checkin": "2026-09-16", "nights": 4, "pax": 2 },
      "top": [
        { "name": "Copacabana Palace", "rate_usd": 700 },
        { "name": "Fairmont Rio",       "rate_usd": 540 }
      ]
    },
    {
      "id": "s_41",
      "kind": "hotels",
      "at": "2026-04-25T18:25:00Z",
      "params": { "city": "Buenos Aires", "checkin": "2026-09-10", "nights": 4, "pax": 2 },
      "top": [
        { "name": "Alvear Art",   "rate_usd": 400 },
        { "name": "Hub Porteño",  "rate_usd": 320 }
      ]
    }
  ]
}
```

**CRM use cases:**
- After 8 turns of exploration, user says "volvamos al hotel del Alvear". Agent calls `get_recent_searches({kind:"hotels", limit:5})` → identifies the rate → quotes.
- TrimmingSession dropped the original turn; this tool is the recovery path (the alternative — re-search — would lose prices and waste a provider call).

---

### 2.4 `get_lead_full_history`

**Description:**
> Fetch extended profile and historical activity for a lead (past trips, prior quotes, satisfaction notes, contact log). Use when: planning long-term strategy for a recurring client; analyzing patterns ("¿qué tipo de viajes le gustan?"); the compact profile in state is insufficient. Don't use for: routine lookups (the profile in state.profile already includes lead_id, currency, top preferences); quick personalization where active_refs lead summary suffices.

**Schema:**
```json
{
  "name": "get_lead_full_history",
  "description": "Fetch extended profile and historical activity for a lead ...",
  "strict": true,
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "lead_id": {
        "type": "string",
        "description": "Lead UUID. Resolve from state.profile.lead_id or active_refs."
      }
    },
    "required": ["lead_id"]
  }
}
```

**Invocation example:**
```json
{ "name": "get_lead_full_history", "arguments": { "lead_id": "ld_991" } }
```

**Response example:**
```json
{
  "lead_id": "ld_991",
  "name": "Carla Méndez",
  "since": "2023-02-11",
  "trips": [
    { "year": 2023, "destinations": ["Cancún"], "pax": 2, "spend_usd": 3200 },
    { "year": 2024, "destinations": ["París","Roma"], "pax": 2, "spend_usd": 5400 },
    { "year": 2025, "destinations": ["Tokyo"], "pax": 2, "spend_usd": 7800 }
  ],
  "quotes": { "sent": 8, "accepted": 3, "avg_ticket_usd": 5500 },
  "preferences": { "budget": "mid-high", "pace": "moderate", "interests": ["food","art"] },
  "notes": [
    { "at": "2025-11-02", "text": "Quiere repetir Asia en 2027" }
  ]
}
```

**CRM use cases:**
- Recurring lead returns; seller asks "¿qué le ofrezco?". Agent calls `get_lead_full_history` → suggests Asia options consistent with prior preferences.
- Avoids ballooning `state.profile` with full history on every turn (just-in-time retrieval, not pre-loaded — per the cookbook).

---

## 3. Memory Tool (Distill phase)

### 3.1 `save_memory_note`

This is the **only write tool** in the catalog. It is the sole interface for the agent to persist durable observations to `state.session_memory.notes` (which Consolidation later promotes to `state.global_memory.notes`).

**Description:**
> Persist a durable, factual observation about the lead, agency context, or task that should survive conversation turns. Use when: you learn something that will be useful in future turns or sessions (preference, constraint, decision rationale, agency policy detail). Don't use for: facts already in state.profile; speculation or hypotheses; instructions to yourself ("remember to ..."); PII (passport, payment, full DOB, SSN).

**Schema:**
```json
{
  "name": "save_memory_note",
  "description": "Persist a durable, factual observation ...",
  "strict": true,
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "text": {
        "type": "string",
        "description": "The observation, ≤500 chars, factual, third-person, no first-person speculation."
      },
      "keywords": {
        "type": "array",
        "items": { "type": "string" },
        "description": "1–6 lowercase keywords for retrieval and consolidation matching."
      },
      "scope": {
        "type": "string",
        "enum": ["planning", "pricing", "lead-context", "decisions"],
        "description": "Note category. planning=trip-shape preferences; pricing=budget/currency/fees; lead-context=client traits; decisions=choices made in-conversation."
      }
    },
    "required": ["text", "keywords", "scope"]
  }
}
```

**Server-side validation (rejection rules):**

The runtime in Phase 3 MUST enforce these regex/heuristic checks before appending to `session_memory.notes`. Failed checks return `{ ok: false, reason: "<rule>" }` to the model so it can correct its behavior next turn (no chain-of-thought).

| Rule | Check | Reason returned |
|------|-------|-----------------|
| Length | `text.length > 500` | `"too_long"` |
| PII — passport | `/(?:passport|pasaporte)\s*[:#]?\s*[A-Z0-9]{6,}/i` | `"pii_passport"` |
| PII — payment | `/\b(?:\d[ -]?){13,19}\b/` (Luhn-shape) or `/cvv|cvc/i` or `/iban[:\s]/i` | `"pii_payment"` |
| PII — full DOB | `/\b(19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/` plus name proximity | `"pii_dob"` |
| PII — SSN | `/\b\d{3}-\d{2}-\d{4}\b/` | `"pii_ssn"` |
| Instruction-shaped | `/^\s*(remember (that|to)|always |never |your rule is|from now on)\b/i` | `"instruction_shaped"` |
| Speculation | `/\b(I think|probably|maybe|might be|seems like|creo que|tal vez|quizás)\b/i` | `"speculation"` |

**Successful response (verbatim):**
```json
{ "ok": true }
```

No echo of the saved text, no note id, no metadata. Per the cookbook: avoid leaking chain-of-thought via memory tool responses.

---

## 3.5 Pending-Action Tools (turn-state resolution, v2)

These two tools resolve `state.pending_action` (see context-engineering-spec §1.6). They are **generic** — they don't know about quotes, planners, or any domain — they only mutate `state.pending_action.applied/complete`. The client-side dispatcher (`applyPendingActionResolution` in `useMessageHandler.ts`) keys off `pending_action.for` to apply the actual domain mutation (planner update, quote update, etc.).

Both tools are pure (no DB writes inside the handler); the parser batch-persists state once at the end of the tool loop.

### 3.5.1 `apply_slot_values`

Resolves a `pending_action` of `kind='awaiting_user_input'` by submitting parsed slot values from the user's reply.

**Description:**

> Resolve a pending_action of kind='awaiting_user_input' by submitting parsed slot values from the user's reply.
> Use when: <pending_action> is present in MEMORY STATE, kind="awaiting_user_input", and the latest user message plausibly answers any of the listed `fields`.
> Pass `values` as an object keyed by field names (snake_case is fine). Unrecognized keys are dropped server-side.
> Don't use for: greetings, off-topic messages, or replies that clearly start a new request — let the parser route normally instead.

**Schema:**

```json
{
  "name": "apply_slot_values",
  "strict": true,
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "values": {
        "type": "object",
        "additionalProperties": true,
        "description": "Parsed slot values keyed by the field names from pending_action.fields. Examples: {\"origin_city\":\"Buenos Aires\",\"start_date\":\"2026-12-01\",\"end_date\":\"2026-12-09\"}. Use string for cities/places, ISO YYYY-MM-DD for dates, integers for counts."
      }
    },
    "required": ["values"]
  }
}
```

**Server-side filtering** (`pendingActionTools.ts:intersectFields`):

The handler normalizes incoming keys (case-insensitive, snake/camel/space collapse) and intersects them with `pending_action.fields`. Unrecognized keys are dropped. If `fields` is undefined or empty, all keys are accepted.

**Response envelopes:**

| Outcome | Response |
|---|---|
| Success (partial fill) | `{ "ok": true, "applied": {…}, "remaining": ["start_date"], "complete": false }` |
| Success (full fill) | `{ "ok": true, "applied": {…}, "remaining": [], "complete": true }` |
| No pending_action | `{ "ok": false, "reason": "no_pending_action" }` |
| Wrong kind | `{ "ok": false, "reason": "wrong_kind" }` |
| Empty values | `{ "ok": false, "reason": "empty_values" }` |
| All keys outside fields | `{ "ok": false, "reason": "no_recognized_fields" }` |

**Client-side consumption:**

The edge function returns `meta.pendingActionResolution = { kind, for, ref, applied, complete }` to the client. `useMessageHandler` consumes it via `applyPendingActionResolution`, which dispatches by `for`:

| `for` value | Domain mutation |
|---|---|
| `quote_completion` | Updates `plannerState.origin / startDate / endDate / flexibleMonth / flexibleYear` via `updatePlannerState`. Tolerates field-name synonyms (origin/origin_city/from, start_date/startDate/from_date, etc.) and flexible-month names (ES + EN). |
| `<future kinds>` | Add a new `case` in the dispatcher; the parser/router need NO changes. |

After the dispatcher runs, the client calls `clearPendingAction(state) + saveEmiliaState`.

### 3.5.2 `confirm_pending_action`

Resolves a `pending_action` of `kind='awaiting_user_confirmation'` with the user's yes/no answer.

**Description:**

> Resolve a pending_action of kind='awaiting_user_confirmation' with the user's yes/no answer.
> Use when: <pending_action> kind="awaiting_user_confirmation" and the user replied affirmatively or negatively.
> Don't use for: ambiguous replies (let the parser handle them as new analysis).

**Schema:**

```json
{
  "name": "confirm_pending_action",
  "strict": true,
  "parameters": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "confirmed": { "type": "boolean", "description": "true if the user accepted, false if they declined." },
      "notes": { "type": ["string", "null"], "description": "Optional free-text caveat the user added (e.g. \"sí pero cambialo a 5 días\"). ≤200 chars." }
    },
    "required": ["confirmed", "notes"]
  }
}
```

**Response envelopes:**

| Outcome | Response |
|---|---|
| Success | `{ "ok": true, "confirmed": true|false, "notes": "..."|null }` |
| No pending_action | `{ "ok": false, "reason": "no_pending_action" }` |
| Wrong kind | `{ "ok": false, "reason": "wrong_kind" }` |

Currently no domain dispatcher consumes `for: 'confirm_*'` results in `applyPendingActionResolution` — the wiring is in place for future booking/payment confirmation flows.

---

## 4. Tool Selection Rules (system prompt directives)

These directives belong in the system prompt **as a single `<tool_selection>` block**, not scattered. They are the narrow exception to the GPT-5.1 guide rule "tool guidance lives in descriptions" — these are *cross-tool* arbitration rules that no individual tool description can express.

Insert verbatim into the system prompt (Phase 6 will tune wording):

```
<tool_selection>
- For ANY mention of specific prices, availability, or schedules: you MUST call at
  least one search tool (search_flights, search_hotels, search_packages). Never
  invent numbers.
- For conceptual questions about destinations (climate, culture, "qué tal X"):
  use internal knowledge. Do NOT call a tool just to confirm well-known facts.
- If the user references "the plan" / "el itinerario" / "esto" AND mode=agency:
  invoke get_planner_state BEFORE any search or quote tool.
- If the user references "the quote" / "la cotización" / "ese precio":
  invoke get_quote BEFORE proposing changes.
- If the user references prior search activity ("esa búsqueda", "los vuelos
  de antes"): invoke get_recent_searches FIRST. Re-search only if not found.
- If the lead is recurring (state.profile.lead_id set AND > 1 prior trip in
  active_refs/profile): consider get_lead_full_history once at task start,
  not repeatedly.
- save_memory_note is fire-and-forget: do NOT wait for its response to plan
  the next user-visible action.
- Parallelize independent retrieval calls in a single turn (e.g. get_planner_state
  + get_recent_searches when both are needed).
- Maximum 3 tool-calling iterations per user turn. If you have not produced an
  answer by iteration 3, summarize what you found and ask one focused question.
</tool_selection>
```

Threshold rationale (per GPT-5.1 guide §"Tool selection rules with thresholds"):
- The "MUST call ≥1 search tool" rule prevents hallucinated prices — the single highest-cost failure mode in a CRM.
- The "use internal knowledge for conceptual questions" rule prevents redundant tool calls and amortizes latency.
- The 3-iteration cap prevents runaway loops and bounds worst-case latency at ~3× tool round-trip.

---

## 5. Tool Calling Loop

The Phase 3 implementation in `supabase/functions/ai-message-parser/index.ts` replaces the current single-shot completion with the loop below.

**Configuration (canonical):**
```ts
const TOOL_LOOP_CONFIG = {
  iteration_cap: 3,
  tool_choice: "auto",
  parallel_tool_calls: true,
  strict: true,            // applied per-tool in schema (not a request-level field)
  per_tool_timeout_ms: 8000,
  total_loop_timeout_ms: 25000,
};
```

**Loop pseudocode (spec, not implementation):**
```
messages = renderSystemPrompt(state) + sessionTail + [userMessage]
for iteration in 1..3:
    resp = openai.chat.completions.create(
        model="gpt-5.1",
        messages=messages,
        tools=TOOLS,
        tool_choice="auto",
        parallel_tool_calls=true,
    )
    if resp.choices[0].finish_reason != "tool_calls":
        return resp.choices[0].message.content   # final answer
    messages.append(resp.choices[0].message)     # assistant w/ tool_calls

    # Run tool calls in parallel for retrieval tools, serial for save_memory_note
    parallel, serial = partition(resp.tool_calls)
    results = await Promise.all(parallel.map(execTool)) ++ runSerial(serial)
    for (call, result) in zip(resp.tool_calls, results):
        messages.append({ role: "tool", tool_call_id: call.id, content: result })

# Hit iteration cap — force a final answer
return await forceFinalAnswer(messages)
```

**Error handling:**

| Failure | Response to model | Loop behavior |
|---------|-------------------|---------------|
| Tool timeout (>8s) | `{ "error": "timeout", "tool": "<name>" }` | Continue loop; model may retry or fall back. |
| Tool 4xx (bad args) | `{ "error": "bad_arguments", "detail": "<msg>" }` | Continue; model corrects args. |
| Tool 5xx (provider down) | `{ "error": "unavailable", "tool": "<name>", "retry_after_s": <n> }` | Continue; model degrades gracefully (e.g. "no pude verificar precios ahora"). |
| Total loop timeout (25s) | Force final answer with note "respuesta parcial". | Exit. |
| Iteration cap hit | Force final answer with note "agoté las consultas, te resumo lo que tengo". | Exit. |

**Why these numbers:**
- 3 iterations: empirically (cookbook + Function Calling Guide examples) covers >95% of multi-tool turns. Higher caps tend to thrash.
- 8s per-tool: fits within Edge Function 25s wall, leaves headroom for 3 sequential rounds in worst case.
- `parallel_tool_calls: true`: Function Calling Guide explicitly recommends; halves latency on multi-call turns.

---

## 6. Mapping to Implementation

All paths absolute.

| Concern | File | Phase | Status |
|---------|------|-------|--------|
| Tool definitions (schemas + executors) | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\_shared\functionTools.ts` | 3.2 | **NEW** |
| Tool-calling loop | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\ai-message-parser\index.ts` | 3.1 | **MODIFY** (today single-shot, no `tools` array — confirmed via grep) |
| System prompt: `<tool_selection>` block, persistence reminders | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\supabase\functions\ai-message-parser\prompt.ts` | 3.1 + 6.3 | **MODIFY** |
| Client request shape (pass `state` snapshot, receive tool trace for telemetry) | `C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai\src\services\aiMessageParser.ts` | 3.1 | **MODIFY** |
| Memory rejection rules + append to `state.session_memory` | inside `_shared/functionTools.ts` (`save_memory_note` executor) | 3.2 | **NEW** |
| State injection (consumed by tools to resolve refs) | `src/features/chat/state/runContext.ts` (Phase 1) | 1 | dependency |

**Feature flag (Phase 9.1):** `USE_FUNCTION_TOOLS`. When `false`, `ai-message-parser` runs the legacy single-shot path. When `true`, the loop above is active. Both paths must remain working through the Phase 9 A/B test window.

**Telemetry hooks (Phase 8.2 inputs):** the loop must emit one structured log per turn:
```
[CTX-TOOL] turn=N iterations=I tools=[get_planner_state,get_quote]
           latency_ms=480 tokens_in=4200 tokens_out=380 errors=0
```

---

## 7. Anti-Patterns to Avoid

Explicit list, drawn from the GPT-5.1 Prompting Guide, the Function Calling Guide, and the Context Engineering for Personalization cookbook. Phase 6 audit will fail any tool that exhibits these.

1. **Bloated tool sets.** A tool that "covers a lot" is harder for the model to select correctly than two narrow tools. If a description's `Use when:` lists more than ~3 distinct triggers, split it.

2. **Vague descriptions.** Banned phrases: "general purpose", "useful for", "various", "etc.", "and more". The litmus test in §1.1 fails immediately on these.

3. **Few-shot bloat in the system prompt for tool usage.** GPT-5.1 guide: prefer crisp directives in `<tool_selection>` over multi-example demonstrations. One canonical example per tool, in the *tool description itself*, is enough.

4. **Conflicting rules.** "Always call X for Y" + "Never call X without Z" → the model freezes. Phase 6 audit must check the full `<tool_selection>` block for contradictions.

5. **Verbose responses.** Tools that return >2k tokens, echo their inputs, include provider raw payloads, or wrap JSON in prose. Each token in a tool response is paid in the next round-trip prompt cost AND budget against the conversation tail.

6. **Tools that wrap other tools without adding value.** `search_flights_v2_with_extras` that just calls `search_flights` with default flags adds confusion, not capability. Either replace the underlying tool or expose new flags as parameters.

7. **Memory writes that violate `save_memory_note` rules.** PII, instruction-shaped, speculation. The runtime rejection layer is the safety net, but the description is the primary deterrent.

8. **Side effects in retrieval tools.** `get_*` tools must be pure reads. Logging is fine; mutating state is not. This is what makes them parallel-safe.

9. **Fan-out > 4 parallel calls per iteration.** The Function Calling Guide allows parallelism, but provider rate limits and cognitive load on the model degrade quality past ~4 concurrent calls. Cap in the loop runtime.

10. **Coupling tool catalog to UI surfaces.** The catalog is per-agent, not per-screen. Don't add a tool because one feature needs it; add it because the agent's reasoning needs it.

---

## Appendix A — Tool catalog at a glance

| Tool | Kind | Parallel-safe | Returns | Triggers |
|------|------|---------------|---------|----------|
| `get_planner_state` | retrieval | yes | full plan JSON | plan ref + needs detail |
| `get_quote` | retrieval | yes | quote JSON | quote ref + needs detail |
| `get_recent_searches` | retrieval | yes | last N searches | user references prior search |
| `get_lead_full_history` | retrieval | yes | extended lead profile | recurring lead, strategy |
| `save_memory_note` | write | NO (serialize) | `{ok:true}` or `{ok:false,reason}` | distill durable fact |

Total: **5 tools**. The catalog is intentionally small (cookbook anti-pattern: bloated tool sets). Adding a 6th requires updating this doc and the Phase 6 audit checklist.

---

## Appendix B — References

- [Function Calling Guide](https://platform.openai.com/docs/guides/function-calling) — `strict`, `parallel_tool_calls`, schema rules.
- [GPT-5.1 Prompting Guide (OpenAI Cookbook)](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5-1_prompting_guide) — tool descriptions, persistence, tool selection rules with thresholds, anti-patterns.
- [Context Engineering for Personalization (OpenAI Cookbook)](https://developers.openai.com/cookbook/examples/agents_sdk/context_personalization) — `save_memory_note` schema, distill/consolidate/inject lifecycle, PII/instruction rejection rules.
