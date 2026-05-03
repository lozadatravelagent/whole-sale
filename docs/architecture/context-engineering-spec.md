# Context Engineering Spec — STATE Layer (Phase 0)

> **Scope of this document**: Phase 0 sub-tasks 0.1, 0.4, 0.5, 0.6, 0.7 of the Context Engineering plan
> (`~/.claude/plans/analiza-como-es-el-parallel-patterson.md`).
> Covers the **state shape**, **token budgets**, **precedence rules**, **persistence reminders**,
> the **TypeScript implementation decision**, **lifecycle hook design**, and the **session strategy**.
>
> Out of scope (deferred to later docs): function tool catalog (0.2/0.3 → Phase 3), distill/consolidate
> implementation (Phase 2), session implementation (Phase 4), telemetry (Phase 8).
>
> **How to read this today**: this is the state-layer contract and design spec, not the live runtime status page. For the current `/emilia/chat` flow read `docs/architecture/context-engineering-overview.md`; for current tool inventory and debt read `docs/architecture/tool-catalog.md`.
>
> **Authoritative sources** (cited inline as `[CB-CTX]`, `[CB-SESS]`, `[GPT5.1]`, `[FC]`):
> - `[CB-CTX]` — OpenAI Cookbook: *Context Engineering for Personalization with Agents SDK*
>   (`developers.openai.com/cookbook/examples/agents_sdk/context_personalization`)
> - `[CB-SESS]` — OpenAI Cookbook: *Short-Term Memory Management with Sessions*
>   (`developers.openai.com/cookbook/examples/agents_sdk/session_memory`)
> - `[GPT5.1]` — OpenAI: *GPT-5.1 Prompting Guide*
>   (`developers.openai.com/cookbook/examples/gpt-5/gpt-5-1_prompting_guide`)
> - `[FC]` — OpenAI: *Function Calling Guide*
>   (`platform.openai.com/docs/guides/function-calling`)

---

## 1. EmiliaState — Type Definition

`EmiliaState` is the WholeSale-Connect-AI analogue of the cookbook's `TravelState` `[CB-CTX]`.
It is the **single structured object** that travels alongside every Emilia run:

- Persisted per `conversation_id` in Postgres (`agent_states` table — Phase 1.3).
- Mounted into a `RunContextWrapper<EmiliaState>` equivalent at the start of each turn (Phase 1.2).
- Mutated only through controlled mutators (`mutateState(updater)`), never freely assigned.
- Serialized into the system prompt at `onTurnStart` via the inject phase (Phase 2.3).

> **Scope decision (Option A — full conversation isolation):**
> Each conversation is a fresh slate. `agent_states` is per-conversation; nothing cross-loads from other conversations of the same lead.
> - `global_memory` is **per-conversation, not per-lead**, despite the cookbook nomenclature. The "global vs session" distinction here is a **lifecycle** distinction (consolidated vs ephemeral within this conversation), not a scope distinction.
> - No bootstrap from `LeadAiProfile` or `ConversationSummary` of prior conversations. A new conversation starts with `global_memory: { notes: [] }` and `session_memory: { notes: [] }`.
> - `profile.lead_id` is a CRM linkage (this conversation belongs to lead X) but does NOT trigger any preference loading.
> - If the same lead opens a new conversation, the agent does not "remember" them — by design.
>
> If product needs evolve toward cross-conversation memory (Option B), introduce a separate `lead_memory` table and a load-time merge step. Do not retrofit `global_memory` to span conversations — keep the layers honest.

### 1.1 Top-level interface

```ts
/**
 * EmiliaState — single source of truth for a single Emilia conversation.
 * Mirrors the TravelState pattern from the OpenAI Context Engineering cookbook,
 * adapted to the WholeSale Connect AI travel CRM domain.
 *
 * Persistence: stored as JSONB per conversation_id (RLS by agency_id).
 * Mutation: only through state.ts mutators; never reassign in place.
 */
export interface EmiliaState {
  /**
   * Trusted, structured, slowly-changing fields.
   * Sourced from internal systems (CRM lead, agency config, profile).
   * Highest "trust" precedence after user's latest message + active refs.
   */
  profile: EmiliaProfile;

  /**
   * Per-conversation durable knowledge produced by the consolidate phase.
   * Top-k (k=6) injected each turn.
   * Written ONLY by the consolidate phase from session_memory; never directly by tools.
   *
   * SCOPE: per-conversation (Option A). The "global" name reflects the
   * LIFECYCLE position (post-consolidate, durable for this conversation),
   * not cross-conversation persistence. Starts empty; never loaded from
   * any external lead-level store.
   */
  global_memory: { notes: MemoryNote[] };

  /**
   * Current-conversation, ephemeral knowledge captured this run.
   * Written by the `save_memory_note` tool (distill phase).
   * Drained into global_memory by the consolidate phase at session end.
   */
  session_memory: { notes: MemoryNote[] };

  /**
   * References the agent is currently working with this turn:
   * the active plan, an open quote, the lead being discussed, etc.
   * Highest precedence after user's latest message — overrides profile defaults.
   */
  active_refs: ContextRef[];

  /**
   * Current chat surface mode. Persists across mode changes within a conversation.
   * Triggers different reasoning hints in MEMORY_INSTRUCTIONS but does NOT
   * clear or partition any other field.
   */
  mode: 'passenger' | 'agency';

  /**
   * Lightweight, summary-only view of past trips for the lead.
   * NOT the full plan history — that's fetched on-demand via get_planner_state tool.
   * Cap: last 5 trips, ≤3 lines each.
   */
  trip_history: { trips: TripSummary[] };

  /**
   * Set to `true` by the session layer when a TrimmingSession drops a turn
   * that contained newly-written session_memory notes the model has not yet
   * acknowledged. The next onTurnStart will inject session_memory inline so
   * the model does not lose the just-distilled facts.
   * Cleared back to false after that injection.
   */
  inject_session_memories_next_turn: boolean;

  /**
   * Generic single-slot turn-state. When non-null the assistant is awaiting
   * a user reply (slot fill, confirmation, etc.). The next turn renders
   * `<pending_action>` into the system prompt and the model is steered to
   * resolve it via `apply_slot_values` (kind=awaiting_user_input) or
   * `confirm_pending_action` (kind=awaiting_user_confirmation).
   *
   * Mutated ONLY through `setPendingAction` / `clearPendingAction` /
   * `markPendingActionApplied`. See §1.6.
   */
  pending_action: PendingAction | null;

  /** Bookkeeping. Never injected into the prompt. */
  meta: {
    conversation_id: string;
    agency_id: string;
    schema_version: number;          // bump on breaking shape changes
    last_consolidated_at?: string;   // ISO; populated by consolidate phase
    turn_count: number;              // monotonic, incremented at onTurnStart
  };
}
```

> **Schema version**: bumped to **v2** when `pending_action` was introduced.
> The persistence loader (`src/features/chat/state/persistence.ts`) auto-migrates
> v1 rows in memory by defaulting `pending_action: null`; existing JSONB rows do
> not need a backfill SQL.

### 1.2 Profile

Mirrors the cookbook's `profile` block — trusted, structured, slowly-changing.
Field set is **canonical for the travel CRM domain**, not a free-form bag.

```ts
export interface EmiliaProfile {
  lead_id?: string;                    // null if lead not yet created
  agency_id: string;                   // always present (multi-tenant)
  currency: 'ARS' | 'USD' | 'EUR' | 'BRL' | string;
  default_origin_city?: string;        // IP-derived or explicit
  default_origin_country?: string;
  language: 'es' | 'en' | 'pt';        // UI + Emilia output language
  preferences: EmiliaPreferences;
}

/**
 * Belief-style preferences. Each field is a single trusted value
 * representing the agent's CURRENT belief, NOT an append-only log.
 * Conflicts are resolved by overwrite, not accumulation [CB-CTX].
 */
export interface EmiliaPreferences {
  budget_band?: 'low' | 'mid' | 'mid-high' | 'high' | 'luxury';
  pace?: 'relaxed' | 'balanced' | 'packed';
  trip_style?: Array<'beach' | 'culture' | 'gastronomy' | 'adventure' | 'family' | 'romantic'>;
  hotel_tier?: '3' | '4' | '5' | 'boutique';
  flight_class?: 'economy' | 'premium-economy' | 'business';
  dietary?: string[];                  // free-form, ≤5 items
  party_composition?: {
    adults: number;
    children?: number;
    children_ages?: number[];
  };
}
```

### 1.3 MemoryNote

Strict shape for both `global_memory.notes` and `session_memory.notes`.
The cookbook constraints `[CB-CTX]` apply: **durable, actionable, explicit; no PII, no speculation,
no instructions**.

```ts
export interface MemoryNote {
  /** ≤500 chars. Validated at write-time by save_memory_note tool. */
  text: string;

  /** ISO 8601. Used for conflict resolution: most-recent wins [CB-CTX]. */
  last_update_date: string;

  /** Lower-case keywords for retrieval/dedup; 1–6 items. */
  keywords: string[];

  /** Domain bucket. Drives top-k selection per scope at inject time. */
  scope: 'planning' | 'pricing' | 'lead-context' | 'decisions';
}
```

### 1.4 ContextRef

Active references the agent is "holding" this turn. Cleared selectively by user intent
("olvidate del plan") via a dedicated handler.

```ts
export interface ContextRef {
  type: 'plan' | 'quote' | 'lead';
  id: string;
  /** ≤120 chars. Pre-rendered one-liner injected verbatim into <active_refs>. */
  summary1Line: string;
  /** ISO 8601. Used to render the "(updated Xmin ago)" hint. */
  lastUpdated: string;
}
```

### 1.5 TripSummary

```ts
export interface TripSummary {
  trip_id: string;
  /** ≤200 chars. e.g. "Buenos Aires → Bariloche, 7 días, mid-budget, fam c/2 niños, 03/2025" */
  one_liner: string;
  ended_at: string;                    // ISO; trip end date or quote close date
}
```

### 1.6 PendingAction (v2)

Generic single-slot turn-state for "the assistant just asked the user for X, the
next message most likely answers it". Replaces the earlier ad-hoc pattern of
re-parsing each user message from scratch when context was already implicit.

```ts
export type PendingActionKind = 'awaiting_user_input' | 'awaiting_user_confirmation';

export interface PendingAction {
  /** Distinguishes the two tool resolution paths. */
  kind: PendingActionKind;

  /**
   * Stable identifier for the flow that produced the prompt.
   * Examples: 'quote_completion', 'collect_passenger', 'confirm_booking'.
   * The client-side dispatcher in `useMessageHandler` keys off this value
   * to decide what domain mutation to apply.
   */
  for: string;

  /**
   * For kind='awaiting_user_input': list of slot names being asked.
   * Capped to 6 by `setPendingAction` to keep the rendered block within
   * the token budget. The model uses these to validate values before
   * calling apply_slot_values; unrecognized keys are dropped server-side.
   */
  fields?: string[];

  /** Optional ref the prompt is about (the active plan / quote / lead). */
  ref?: { type: 'plan' | 'quote' | 'lead'; id: string };

  /** ≤240 chars. The natural-language prompt the user saw. Helps the model match user replies to slots. */
  prompt: string;

  /** ISO 8601. When the prompt was issued. */
  issuedAt: string;

  /** Slot values applied by `apply_slot_values`, merged across calls. */
  applied?: Record<string, unknown>;

  /** Whether `applied` covers every required `field`. Set by the tool handler. */
  complete?: boolean;
}
```

**Lifecycle (one round trip)**:

```
Turn N (assistant asks):
  handler decides to ask for missing info
    → setPendingAction(state, { kind, for, fields, ref, prompt, issuedAt })
    → saveEmiliaState(state)
    → assistant message goes out

Turn N+1 (user replies):
  edge function loads state
    → renders <pending_action> in system prompt
    → model sees pending + tool_selection rules
    → invokes apply_slot_values({values}) or confirm_pending_action({confirmed, notes})
    → executeApplySlotValues mutates pending_action.applied + complete
    → batch-persists state (one UPDATE)
    → returns meta.pendingActionResolution to client
  client (useMessageHandler):
    → applyPendingActionResolution dispatches by `for`
    → mutates domain state (planner, quote, …)
    → clearPendingAction(state) + saveEmiliaState
```

**Mutator contract** (only API for writes):

| Function | When to call | Side effects |
|---|---|---|
| `setPendingAction(state, action)` | A handler decided to ask the user something. | Replaces any existing `pending_action`. Trims `prompt` to 240 chars and `fields` to 6. |
| `markPendingActionApplied(state, applied, complete)` | A tool handler wants to record progress without overwriting prompt/fields/ref. | Merges `applied` into existing; sets `complete`. No-op if `pending_action` is null. |
| `clearPendingAction(state)` | Resolution consumed by client OR user explicitly drops topic. | Sets to `null`. Returns same reference if already null. |

**Anti-patterns** (forbidden):

- Direct assignment `state.pending_action = {...}` — bypasses the trimming + cloning guarantees.
- Stacking multiple pending actions — single-slot semantics, `setPendingAction` always replaces.
- Persisting domain values inside `pending_action.applied` *and* not reading them out via `applyPendingActionResolution` — leaves the planner stale.

**Render output** (Appendix A illustrates):

```
<pending_action>
  kind: awaiting_user_input
  for: quote_completion
  fields: [origin, start_date, end_date]
  ref: plan:6f3a…b4
  prompt: "Tengo el plan activo para cotizar... necesito ciudad de salida y fechas exactas"
  issued: 1min ago
</pending_action>
```

**Tool selection policy** (lives in `prompt.ts` v5 `<tool_selection>` block, copied here for reference):

> If MEMORY STATE includes a `<pending_action>` block, the user's reply most likely answers it.
> Resolve before doing anything else.
> - kind=`awaiting_user_input`: parse user message into the listed `fields`, call `apply_slot_values`.
> - kind=`awaiting_user_confirmation`: call `confirm_pending_action`.
> - If user clearly changed topic, do NOT call these — proceed normally.

**Mode-bridge guard**: while `pending_action` is non-null AND a planner is active, the
`conversationOrchestrator` suppresses `mode_bridge` (G3 guardrail), and `previousMessageType ===
'quote_active_plan'` does the same (G4). Tests in
`src/features/trip-planner/__tests__/conversationOrchestrator.test.ts`.

---

## 2. Token Budget Targets

The budget below is the **steady-state target per turn** before any tool round-trip.
Tool invocations add cost only when the model decides to call them, per `[CB-CTX]` and `[FC]`.

| Section                                                         | Target tokens | Hard cap |
|-----------------------------------------------------------------|--------------:|---------:|
| System prompt base + persistence reminders (§4)                 |       ≤ 1 500 |    1 800 |
| State injection — `<user_profile>` YAML + `<memories>` markdown |       ≤   800 |    1 100 |
| Active refs — `<active_refs>` block                             |       ≤   200 |      300 |
| Conversation tail — `TrimmingSession` (last 6 user turns)       |       ≤ 2 000 |    2 800 |
| **Total normal turn (no tool calls)**                           |   **~ 4 500** |    6 000 |

Notes:

- **Profile YAML target**: ~250 tokens. Bounded structure → predictable.
- **Memory markdown target**: ~550 tokens combined for `global_memory` (top-k=6) and
  `session_memory` (top-k=8) when re-injection flag is set; otherwise ~350 with global only.
- **TrimmingSession target**: 6 user turns + their assistant + tool messages. Tool outputs
  inside the tail are subject to `tool_trim_limit=600` once Phase 4 lands.
- **Tool call overhead** (when triggered): typical extra round-trip is +1 200 to +2 500 tokens
  (tool definitions in request + tool result in next request). Documented in Phase 3 spec.
- **Hard caps** are circuit-breakers, not budgets. Crossing a hard cap triggers either
  consolidate-now (memory) or summarize-now (session). Logged as `[CTX-OVER] section=…`.

---

## 3. Precedence Rules

Verbatim from `[CB-CTX]`, with the per-field interpretation we apply.

> **1. User's latest message wins.**
> The most recent user turn always overrides any prior belief or default.
> If the user says "ahora vamos en pareja, sin chicos", the model must update behavior
> immediately and the next consolidate run must overwrite `preferences.party_composition`.

> **2. Pending action (if present).**
> When `state.pending_action` is non-null and `kind='awaiting_user_input'`, the user's reply
> most likely answers the listed `fields`. The model is steered to call `apply_slot_values`
> rather than re-parse from scratch. The only override is precedence-1: if the user clearly
> changed topic (greeting, off-topic, brand-new request), pending_action is ignored and the
> next handler clears it. Detail in §1.6.

> **3. Active refs (current turn).**
> Anything in `state.active_refs` reflects what the user is actively working on RIGHT NOW.
> If `mode=agency` and a `plan` ref is active, the model treats that plan as the subject
> of the next utterance unless the user explicitly references something else.

> **4. Profile fields (trusted).**
> `profile.*` comes from internal systems (CRM, agency config, IP detection). Trusted by
> default. Overridden only by precedence-1 (explicit user statement) — and that override
> must be persisted via consolidate, not silently dropped.

> **5. Session memory (current convo).**
> `session_memory.notes` are facts distilled THIS conversation but not yet consolidated.
> They beat `global_memory` because they are more recent within the active context.

> **6. Global memory (advisory default).**
> `global_memory.notes` are the lowest-trust signal injected. They are advisory: useful
> defaults for personalization, never authoritative against anything above.

**Tie-breaks** (per `[CB-CTX]`):

- Within a single tier, the note with the most recent `last_update_date` wins.
- If timestamps tie, **session memory beats global memory**.
- If still tied, the prompt MUST surface the conflict to the user rather than guess.

These rules are surfaced to the model verbatim in the `MEMORY_INSTRUCTIONS` system block
(implementation in Phase 2.5).

---

## 4. Persistence Reminders for the System Prompt

Block to be injected at the **end** of the base system prompt, immediately before the
`<user_profile>` section. Wording follows `[GPT5.1]` "persistence reminders" guidance for
multi-turn agents and is intentionally short and directive.

```text
<persistence>
- Treat yourself as autonomous: persist until the task is fully resolved end-to-end.
- Do not yield prematurely after analysis or a partial fix; carry changes through to a
  result the user can act on (a quote, a plan update, a confirmation).
- For ambiguous directives, assume sensible defaults (use profile + active_refs + global
  memory) and proceed. State the assumption in one short line.
- Only pause to ask the user when CRITICAL information is missing and cannot be defaulted:
    * travel dates (and you cannot infer "next month / school holidays / etc.")
    * destination city or region
    * party headcount (adults + children)
- Never ask the user to re-state information already present in profile, active_refs,
  session_memory, or global_memory. Use it.
</persistence>
```

The block is constant across modes and runs. It is part of the "system prompt base" budget
in §2 (≤1 500 tokens), not the state injection budget.

---

## 5. TypeScript Implementation Decision

### 5.1 Why custom TS instead of adopting the Python Agents SDK

The OpenAI Agents SDK is **Python-first** (`openai-agents-python`). Our production stack is:

- **Frontend**: React 18 + TypeScript (Vite, shadcn/ui, Tailwind).
- **Backend**: Supabase Edge Functions (Deno + TypeScript) + Fastify gateway (Node 20, TS).
- **No Python runtime** in the deployment chain (Cloudflare Worker proxy, Railway containers,
  Supabase Edge runtime — all JS/TS).

Migrating to Python would require:

1. New Python service (Railway or Supabase remote function).
2. Duplicate domain types (we already maintain `src/types/index.ts` + Supabase generated types).
3. Cross-language RPC for everything Emilia touches (CRM, planner state, places, hotels).
4. New ops surface (Python deps, lockfiles, container images, observability).

**Decision**: implement the SDK semantics in TypeScript, faithful to the cookbook patterns.
We do not need the Python runtime — we need the **patterns**: structured state, lifecycle
hooks, sessions, function tools, precedence rules. All of those are language-agnostic.

### 5.2 Mapping — Python Agents SDK → our TS equivalents

| Python Agents SDK construct           | TS equivalent (this spec)                                         |
|---------------------------------------|-------------------------------------------------------------------|
| `RunContextWrapper[TravelState]`      | `RunContext<EmiliaState>` (Phase 1.2 — `runContext.ts`)           |
| `AgentHooks` + `on_start`             | `EmiliaLifecycleHooks` (§6 below — Phase 2.4)                     |
| `Session` (TrimmingSession)           | `TrimmingSession` class (§7 — Phase 4.1)                          |
| `Session` (SummarizingSession)        | `SummarizingSession` class (§7 — Phase 4.4, conditional)          |
| `function_tool` decorator             | `defineTool({ name, description, strict, parameters, handler })`  |
|                                       | wired into OpenAI Chat Completions `tools` array (Phase 3)        |
| `Runner.run(...)`                     | `runEmiliaTurn({ context, message, session, hooks })`             |
| `MemoryHooks(AgentHooks)` example     | `MemoryHooks` impl of `EmiliaLifecycleHooks` (Phase 2.4)          |

### 5.3 What we explicitly DO keep from the SDK contract

- **Strict schemas** on every tool — `strict: true` is mandatory `[GPT5.1]` `[FC]`.
- **Single `RunContext<T>` pattern**: tools and hooks receive the wrapper, not raw state,
  so we can intercept reads/writes for telemetry and concurrency control.
- **Lifecycle ordering** — `onTurnStart → tool calls (loop) → onTurnEnd → (eventual onSessionEnd)`.
- **Session as an interface**, not a class — `getItems()`, `addItems()`, `clear()` so we can
  swap Trimming ↔ Summarizing without touching call sites `[CB-SESS]`.

### 5.4 What we DROP vs the Python SDK

- Python-specific niceties (decorators, dataclasses) → plain TS interfaces + factories.
- The SDK's built-in tracing UI → we already have structured logs (`[CTX-*]` markers, Phase 8).
- Handoff/sub-agent runtime → deferred to Phase 7 and implemented as edge functions.

---

## 6. Lifecycle Hooks — Pseudocode Design

Three hook points, fired by `runEmiliaTurn(...)` in the order shown.
**No implementation here** — only the contract and the responsibilities.

```ts
export interface EmiliaLifecycleHooks {
  onTurnStart(ctx: RunContext<EmiliaState>, userMessage: ChatMessage): Promise<{
    /** Built system prompt to send to OpenAI for this turn. */
    systemPrompt: string;
    /** Conversation tail from session.getItems() — already trimmed. */
    history: ChatMessage[];
  }>;

  onTurnEnd(
    ctx: RunContext<EmiliaState>,
    response: ChatCompletionResponse,
  ): Promise<void>;

  onSessionEnd(ctx: RunContext<EmiliaState>): Promise<void>;
}
```

### 6.1 `onTurnStart` — render state into the system prompt

Responsibilities:

1. Increment `state.meta.turn_count`.
2. Render the **state injection block** (Phase 2.3 — `renderStateForSystemPrompt`):
    - `<user_profile>…</user_profile>` ← YAML frontmatter from `profile`.
    - `<active_refs>…</active_refs>` ← one line per `ContextRef`.
    - `<current_mode>…</current_mode>` ← `state.mode`.
    - `<memories>…</memories>` ← top-6 `global_memory.notes` (most recent by
       `last_update_date`); plus top-8 `session_memory.notes` IF
       `state.inject_session_memories_next_turn === true`.
    - `<trip_history>…</trip_history>` ← lines from `trip_history.trips`.
3. If we just injected `session_memory` because of the re-inject flag, clear the flag:
   `state.inject_session_memories_next_turn = false`.
4. Concatenate: `BASE_PROMPT + PERSISTENCE_BLOCK (§4) + STATE_BLOCK + MEMORY_INSTRUCTIONS`.
5. Pull the conversation tail from `session.getItems()` (already trimmed by §7 strategy).
6. Return `{ systemPrompt, history }` for the runner to send to OpenAI.

```ts
async onTurnStart(ctx, userMessage) {
  ctx.mutate(s => { s.meta.turn_count += 1; });

  const stateBlock = renderStateForSystemPrompt(ctx.state);   // §1 + Phase 2.3

  if (ctx.state.inject_session_memories_next_turn) {
    ctx.mutate(s => { s.inject_session_memories_next_turn = false; });
  }

  const systemPrompt = [
    BASE_PROMPT,
    PERSISTENCE_BLOCK,            // §4
    stateBlock,
    MEMORY_INSTRUCTIONS_BLOCK,    // §3 precedence rules, verbatim
  ].join('\n\n');

  const history = await session.getItems();    // §7

  return { systemPrompt, history };
}
```

### 6.2 `onTurnEnd` — flag re-injection if needed

Responsibilities:

1. Append the assistant + tool items from `response` into the session
   (`session.addItems([...])`).
2. Inspect what the session would drop on the *next* trim. If any dropped item
   contains a `save_memory_note` tool call whose note is still in
   `state.session_memory.notes` and not yet consolidated, set
   `state.inject_session_memories_next_turn = true`.
3. Persist `state` back to Postgres (Phase 1.3 — `saveState(state)`).

```ts
async onTurnEnd(ctx, response) {
  await session.addItems(itemsFromResponse(response));

  const willDrop = session.peekDropOnNextTrim();
  const droppedNoteIds = collectMemoryNoteIdsFrom(willDrop);
  const stillUnconsolidated = ctx.state.session_memory.notes.some(
    n => droppedNoteIds.includes(noteId(n)),
  );
  if (stillUnconsolidated) {
    ctx.mutate(s => { s.inject_session_memories_next_turn = true; });
  }

  await saveState(ctx.state);
}
```

### 6.3 `onSessionEnd` — trigger consolidate

Responsibilities:

1. Call `consolidateMemory(state)` (Phase 2.2): LLM dedup + conflict-resolution by
   `last_update_date` over `session_memory ⊕ global_memory`.
2. Mutate `state.global_memory.notes` to the consolidated set; clear `state.session_memory.notes`.
3. Stamp `state.meta.last_consolidated_at = now()`.
4. Persist `state` (Phase 1.3).

`onSessionEnd` triggers: explicit conversation close, idle timeout (configurable),
OR every N turns as a fallback (default N=20).

---

## 7. Session Strategy

Per `[CB-SESS]`, the cookbook recommends starting with `TrimmingSession` for
"tool-heavy ops with short workflows" — **our exact profile** (planner, hotels, flights,
discovery all involve tool use). We adopt the same default.

### 7.1 Default — TrimmingSession

- **`max_turns = 6`** (last 6 *user* turns kept verbatim, with all interleaved assistant
  and tool messages between them).
- API matches `[CB-SESS]`: `getItems(limit?)`, `addItems(items)`, `clear()`.
- Walk-backward algorithm: from the tail, count user messages, stop when the count
  reaches `max_turns`. Keep everything from that boundary forward.
- Coordinates with the memory layer via `inject_session_memories_next_turn` (§6.2).

### 7.2 Evolution criterion — when to switch to SummarizingSession

Switch to `SummarizingSession` **only if** Phase 8 telemetry shows:

- `amnesia_rate > 5%` over a rolling window of 200 conversations,
  where `amnesia_rate` is defined as: turns in which the model asks the user for
  information that is verifiably present in trimmed-out history (detected by
  matching the model's question against the dropped tail).

Below 5%, the cookbook's bias toward simplicity holds — Trimming is cheaper, faster,
and more deterministic. We do not pre-build SummarizingSession.

### 7.3 SummarizingSession sketch (only if criterion fires)

- When the conversation exceeds `context_limit` (configurable, default ~3 200 tokens of tail),
  older turns are replaced by a synthetic `(user "summarize so far", assistant "{summary}")`
  pair produced by an `LLMSummarizer` (gpt-4.1, low temp), per `[CB-SESS]`.
- Tool outputs in the kept tail are individually trimmed to `tool_trim_limit = 600` tokens.
- The synthetic summary is NOT a memory write — it lives only in the session, never
  promoted to `global_memory`. Memory promotion remains the consolidate phase's job.

### 7.4 Hand-off responsibilities (state ↔ session)

| Concern                                | Owner               |
|----------------------------------------|---------------------|
| Conversation tail (raw turns)          | Session             |
| Distilled facts for this conversation  | `state.session_memory` |
| Cross-conversation durable knowledge   | `state.global_memory`  |
| Re-injection of dropped session notes  | Session signals → state flag → `onTurnStart` |

---

## Appendix A — Worked Example: rendered injection

For a turn with profile populated, two active refs, one global note, and the
re-inject flag false, the state injection block looks like this (illustrative):

```text
<user_profile>
lead_id: lead_8a1f
agency_id: ag_42
currency: ARS
default_origin_city: Buenos Aires
language: es
preferences:
  budget_band: mid-high
  pace: balanced
  trip_style: [beach, gastronomy]
  hotel_tier: "4"
  party_composition: { adults: 2, children: 2, children_ages: [6, 9] }
</user_profile>

<current_mode>agency</current_mode>

<active_refs>
- plan:plan_abc123 — "4 destinos, 12 días, mid-budget" (updated 2min ago)
- lead:lead_8a1f  — "Cliente recurrente, prefiere mid-range" (updated 5min ago)
</active_refs>

<pending_action>
  kind: awaiting_user_input
  for: quote_completion
  fields: [origin, start_date, end_date]
  ref: plan:plan_abc123
  prompt: "Tengo el plan activo para cotizar… necesito ciudad de salida y fechas exactas."
  issued: 1min ago
</pending_action>

<memories>
GLOBAL_NOTES (most recent first):
- [planning] 2026-04-12 Prefiere vuelos directos sobre escalas largas (>4h).
- [pricing]  2026-03-30 Acepta hasta +15% por hotel céntrico vs alejado.
- [decisions] 2026-03-15 No quiere paquetes con seguro incluido por default.
</memories>

<trip_history>
- trip_771 — "Bariloche, 7 días, fam c/2 niños, 03/2025" (ended 2025-03-22)
</trip_history>
```

Approximate cost: ~580 tokens (with the optional `<pending_action>` block) — still inside the 800-token state-injection budget (§2). When `pending_action` is null, the block is omitted entirely.

---

## Appendix B — Implementation Checklist (for the Phase 1 implementer)

A developer picking this up should be able to start Phase 1 from this doc alone:

- [ ] Create `src/features/chat/state/types.ts` with the interfaces from §1.
- [ ] Create `src/features/chat/state/factories.ts` — `createInitialState(agencyId, mode)`.
- [ ] Create `src/features/chat/state/runContext.ts` — `RunContext<EmiliaState>` with
      `state` (read), `mutate(updater)`, and a subscriber list for telemetry.
- [ ] Add SQL migration: `agent_states (conversation_id PK, state JSONB, updated_at)`
      with RLS scoped by `agency_id` (extracted from JSON).
- [ ] Implement `loadState(conversationId)` and `saveState(state)` with optimistic local cache.
- [ ] Add `useEmiliaState(conversationId)` and `useUpdateState(conversationId)` hooks.
- [ ] Stub `EmiliaLifecycleHooks` with the three method signatures from §6 — implementations
      land in Phase 2.4.
- [ ] Stub `Session` interface (`getItems`, `addItems`, `clear`, `peekDropOnNextTrim`) — concrete
      `TrimmingSession` class lands in Phase 4.1.
- [ ] Unit tests: state mutations are immutable-style; precedence rules from §3 are testable
      against a small fixture set.

Anything outside this checklist (memory tools, consolidate, function-tool catalog, telemetry)
is a later phase and intentionally out of scope here.
