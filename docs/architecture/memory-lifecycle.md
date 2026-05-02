# Memory Lifecycle

> **Audience**: a developer about to change *how* Emilia decides what to remember, when to consolidate, or how the rendered memory block looks. If you only need a high-level mental model, start with `context-engineering-overview.md`.
>
> **Authoritative sources**: OpenAI Cookbook *Context Engineering for Personalization with Agents SDK* (`[CB-CTX]`), *Short-Term Memory Management with Sessions* (`[CB-SESS]`). The implementation in this repo is a faithful TS port of the Distill → Consolidate → Inject pattern from `[CB-CTX]`.

---

## 1. The three phases

### 1.1 Distill (during a turn)

The model chooses, on its own, whether to call `save_memory_note(text, keywords, scope)`. The validation layer enforces strict shape and content rules **before** the note is appended to `state.session_memory.notes`.

- **Schema (strict)**: `text` (string, ≤500 chars), `keywords` (array, 1–6 lower-cased non-empty strings), `scope` (enum: `planning` | `pricing` | `lead-context` | `decisions`). All required, `additionalProperties: false`. Defined in `supabase/functions/_shared/memoryTools.ts:saveMemoryNoteToolSchema`.

- **Validation rules** (`validateMemoryNote` in `memoryTools.ts`). Rejection returns `{ ok: false, reason: "<rule>" }` to the model so it can self-correct on the next iteration. The runtime never throws back to the user:

  | Rule | Check | Reason returned |
  |---|---|---|
  | Length | `text.length > 500` | `too_long` |
  | PII — passport | `\b[A-Z]{1,2}\d{6,9}\b` | `pii_passport` |
  | PII — SSN (checked before payment) | `\b\d{3}-?\d{2}-?\d{4}\b` | `pii_ssn` |
  | PII — DOB (ISO-ish) | `\b\d{4}[-/]\d{2}[-/]\d{2}\b` | `pii_dob` |
  | PII — payment / PAN run | `\b\d{13,19}\b` | `pii_payment` |
  | Instruction-shaped | `\b(remember that\|always do\|your rule is\|never do)\b` | `instruction_shaped` |
  | Speculation | `\b(i think\|probably\|maybe\|i guess)\b` | `speculation` |
  | Bad scope | not in enum | `invalid_scope` |
  | Bad keywords | not an array, count out of [1,6], any non-string / empty | `invalid_keywords` |
  | Bad text | not a string / empty | `invalid_text` / `empty_text` |

  **Order matters** in `PII_PATTERNS`: SSN is checked before the generic 13–19-digit payment regex, otherwise an SSN reports as `pii_payment`.

- **Append semantics**: `executeSaveMemoryNote(state, args)` is **immutable** — it returns a new `EmiliaState` with `state.session_memory.notes` shallow-cloned and the new note appended. Keywords are normalized (`.trim().toLowerCase()`) on the way in. `last_update_date` is stamped at write time.

- **Anti-patterns rejected, with concrete examples**:

  | User said / model proposed | Validation reason | Why this rule exists |
  |---|---|---|
  | `text: "Pasaporte AAB123456 vence en marzo"` | `pii_passport` | Passport numbers are PII; if logged, leak through telemetry / audit endpoint. |
  | `text: "Tarjeta 4111111111111111, vence 12/27"` | `pii_payment` | PAN numbers must never be persisted. |
  | `text: "Remember that the user prefers aisle seats"` | `instruction_shaped` | Instructions to the model are prompt injection vectors; use the profile / discovery layer instead. |
  | `text: "I think the client likes Italy"` | `speculation` | Memory is for facts the user stated, not the model's guesses. Conflicts the precedence rules. |
  | `text: "..."` (501 chars) | `too_long` | Bounded shape; a 1KB note balloons the inject budget. |
  | `keywords: []` | `invalid_keywords` | Keywords drive dedup at consolidate time; zero keywords means the note is unmatchable. |

- **Fire-and-forget contract**: the tool selection block in `prompt.ts` instructs the model to NOT wait on `save_memory_note` to plan the next user-visible action. The successful response is `{ ok: true, note: {...} }`; the note is *batch-persisted* after the loop completes, not synchronously per call.

### 1.2 Consolidate (at session end or every N turns)

`consolidateMemory(state, openaiClient)` in `supabase/functions/_shared/consolidateMemory.ts`. Called from `LifecycleHooks.onSessionEnd`. Triggers:

- Explicit conversation close (caller invokes `onSessionEnd`).
- Idle timeout (configurable; out-of-scope today).
- **Fallback**: every N turns. Default `DEFAULT_CONSOLIDATE_EVERY_N_TURNS = 20` from `lifecycleHooks.ts`. Helper `shouldConsolidateNow(state, everyN=20)` returns `true` when `state.meta.turn_count > 0 && turn_count % everyN === 0`.

Mechanics:

1. If both `session_memory.notes` and `global_memory.notes` are empty, no-op (return original state).
2. Build the consolidate prompt — verbatim from the cookbook recipe — embedding the full JSON of both note arrays.
3. Call OpenAI: `model: 'gpt-4.1'`, `temperature: 0.1`, `max_tokens: 2000`.
4. Parse the JSON response (tolerates code-fenced wrappers via regex extraction).
5. Validate every output note conforms to `MemoryNote` shape and known scopes.
6. **Atomic state update**: `global_memory.notes` ← consolidated set; `session_memory.notes` ← `[]`; `meta.last_consolidated_at` ← now.

Rules baked into the prompt (mirrors `[CB-CTX]` exactly):

- Keep DURABLE info; drop ephemeral / trip-specific notes.
- Remove exact and near-duplicates with canonical phrasing.
- Conflict resolution: most recent `last_update_date` wins.
- Tie → SESSION_NOTES preferred over GLOBAL_NOTES (newer cohort beats older).
- NO invention beyond source notes.
- Preserve scope tagging.

**Resilience contract**: `consolidateMemory` swallows ALL errors (network, parse, validation, rate-limit) and returns the **original state unchanged**, logged via `console.error('[consolidateMemory] ...')`. Consolidation is a maintenance pass; failing it must NEVER break the user-facing conversation.

### 1.3 Inject (at the start of every turn)

`renderStateForSystemPrompt(state)` — duplicated on both sides:

- Edge: `supabase/functions/_shared/renderState.ts`
- Client: `src/features/chat/state/renderClientState.ts` (called via `buildMemoryStateBlockFromState`)

Output structure (matches `context-engineering-spec.md` Appendix A):

```text
<user_profile>
lead_id: …            # only if present
agency_id: …
currency: …
default_origin_city: …
default_origin_country: …
language: …
preferences:          # YAML map; "{}" if empty
  budget_band: …
  trip_style: [beach, gastronomy]
  party_composition: {"adults":2,"children":1}
</user_profile>

<current_mode>agency|passenger</current_mode>

<active_refs>          # only emitted when refs exist
  - plan:plan_abc — "Sudamérica 12 días" (updated 2min ago)
  - lead:ld_991  — "Cliente recurrente" (updated 5min ago)
</active_refs>

<memories>
GLOBAL_NOTES (most recent first):
- [planning] 2026-04-12 Prefiere vuelos directos sobre escalas largas (>4h).
- [pricing]  2026-03-30 Acepta hasta +15% por hotel céntrico vs alejado.

## Session memory (this conversation):    # only if inject_session_memories_next_turn
- [decisions] 2026-05-02 Confirmó cambio de Bariloche por Mendoza.
</memories>

<memory_instructions>
PRECEDENCE (highest to lowest):
1. User's latest message
2. Active refs (current turn)
3. Profile fields (trusted)
4. Session memory (current convo)
5. Global memory (advisory default)

When current_mode=agency and a plan ref is active, the user likely wants to quote it.
When current_mode=passenger and a lead is in profile, consider lead preferences when suggesting.
Save durable observations via save_memory_note tool — never PII, never speculation, never instructions.
</memory_instructions>
```

**Token cap**: soft cap at 4000 chars (~1000 tokens). When exceeded, the renderer degrades progressively — drop session memory first, then halve global top-k from `MAX_GLOBAL_NOTES = 6` down to 1, then to 0 if still over budget. Profile + `<memory_instructions>` are never dropped.

`inject_session_memories_next_turn` is set by `onTurnEnd` when the session-trim layer is about to drop a turn that contained newly-saved notes the model has not yet acknowledged. The renderer consumes the flag; `onTurnEnd` clears it after the turn unless re-set by the same logic.

---

## 2. Precedence rules (formal)

Rendered verbatim into `<memory_instructions>` every turn. From `context-engineering-spec.md` §3:

1. **User's latest message wins.** The most recent user turn overrides any prior belief or default. `"ahora vamos en pareja, sin chicos"` updates behavior immediately and the next consolidate must overwrite `preferences.party_composition`.
2. **Active refs (current turn).** Anything in `state.active_refs` is what the user is working on right now. With `mode=agency` and an active `plan` ref, the model treats that plan as the subject unless the user references something else.
3. **Profile fields (trusted).** From internal systems (CRM lead, agency config, IP detection). Trusted by default. Overridden only by precedence-1 — and the override must be persisted via consolidate, not silently dropped.
4. **Session memory (current convo).** Distilled facts in `session_memory.notes` not yet consolidated. Beats `global_memory` because more recent within the active context.
5. **Global memory (advisory default).** `global_memory.notes` is the lowest-trust signal injected. Useful defaults for personalization, never authoritative against anything above.

Tie-breaks:
- Within a tier, most recent `last_update_date` wins.
- Timestamps tie → session beats global.
- Still tied → surface the conflict to the user; do not guess.

---

## 3. Reciprocity (passenger ↔ agency)

The Phase 5 contract: a chat mode change does NOT clear or partition any memory layer.

- `applyModeChange(state, newMode)` in `src/features/chat/state/contextEngineeringIntegration.ts` mutates **only** `state.mode`. The function returns the same reference if `newMode === state.mode`.
- All other slices — `profile`, `global_memory`, `session_memory`, `active_refs`, `trip_history`, `meta` — are preserved verbatim.
- Tests in `src/features/chat/state/__tests__/reciprocity.test.ts` exercise passenger→agency, agency→passenger, and round-trip toggles. Do not weaken those assertions.

The `<memory_instructions>` block tells the model how to *use* the mode signal:
- `current_mode=agency` + active `plan` ref → likely wants a quote (consider `get_planner_state` first).
- `current_mode=passenger` + `lead_id` in profile → consider the lead's preferences when suggesting.

---

## 4. Persistence path (Option A scope)

A note's full journey, all per-conversation:

1. **Model invokes**: `save_memory_note({ text, keywords, scope })` as one of possibly several parallel tool calls in iteration N of the loop.
2. **Tool runner** (`_shared/toolRunner.ts:execOne`) parses arguments and calls the registered handler.
3. **Handler** (defined inline in `ai-message-parser/index.ts:saveMemoryNoteHandler`) calls `validateMemoryNote(args.text, args.keywords, args.scope)`. On rejection: returns `{ ok: false, reason }` to the model. On accept: returns `{ ok: true, note: { text, keywords (normalized), scope, last_update_date (now ISO) } }`.
4. **Trace accumulation**: the loop runtime appends each call's `{ tool, args, result, latencyMs, error? }` into `loopResult.toolCallsTrace`. No persistence yet.
5. **Batch persist** (after the loop completes, in `ai-message-parser/index.ts:397-433`):
   - Filter trace entries with `tool === 'save_memory_note'` and `result.ok === true`.
   - Single-row `SELECT state FROM agent_states WHERE conversation_id=? AND agency_id=?`.
   - Append accepted notes into `state.session_memory.notes` (concat).
   - `UPDATE agent_states SET state = ? WHERE conversation_id=? AND agency_id=?`.
   - On any failure: `console.warn('[CTX-TOOL] save_memory_note save failed: ...')`. The conversation continues; the notes simply weren't persisted. The next consolidate will not see them. Acceptable degradation.
6. **Telemetry**: `emitTelemetry({ category: 'CTX-MEMORY', conversation_id, agency_id, attempted, accepted, rejected, rejection_reasons })` — emitted only when `attempted > 0`, to keep the event stream signal-rich.

Why batch-persist instead of one-write-per-handler-invocation:
- The model can fire multiple `save_memory_note` calls in parallel within one iteration. Per-call writes would race on the JSONB and could lose notes. The batch is one read + one write per turn.
- DEBT item from `tool-catalog.md`: `save_memory_note` is documented as not parallel-safe with itself; the batch persist is one half of the mitigation. The other half (serializing the calls inside `execBatch`) is open work.

**Why this is Option A**: at no point does the persistence path read from a different `conversation_id`, from `lead_ai_profiles`, or from any other table. The note is a fact about *this* conversation and stays inside `agent_states[conversation_id]`.

---

## 5. Anti-patterns (with examples)

What NOT to save, beyond the regex rules:

| Anti-pattern | Example | Why |
|---|---|---|
| Echoing user words back as a "memory" | text: `"User said: 'me gusta Roma'"` | Adds no information beyond the conversation tail. The tail already carries it. |
| Trip-specific ephemeral details | text: `"Vuelo AR1234 sale 18:30 el 12/sept"` | This is the active plan's data; `get_planner_state` retrieves it on demand. Memorizing fills `global_memory` with stale data. |
| Self-talk / self-instructions | text: `"I should ask about budget next"` | Will be rejected as `instruction_shaped`. Use the `<persistence>` block instead. |
| Sentiment guesses without explicit confirmation | text: `"Probablemente prefiere hoteles 5*"` | Rejected as `speculation`. Wait for the user to confirm. |
| Restating profile fields | text: `"Lead's currency is ARS"` | Already in `state.profile.currency`. Duplicates dilute consolidation. |
| Multi-fact run-ons | text: `"Likes beach, dislikes museums, has 2 kids ages 4 and 7, vegetarian, budget mid-high, ..."` | Hard to dedup at consolidate time; one fact per note keeps tie-resolution cheap. |
| Notes that depend on a specific date being "now" | text: `"Tiene vacaciones la semana que viene"` | "La semana que viene" is meaningless on a future read. Anchor to absolute dates or skip. |

These are not enforced in code — the model has to learn them from `<tool_selection>` and the description on `save_memory_note`. The `<memory_instructions>` block reminds it every turn.

---

## 6. Failure modes & how they degrade

The whole layer is designed to **fail open**. Any breakage in the memory pipeline degrades to the legacy push-context behavior, never to a broken conversation.

| Failure | What logs | What happens to the conversation |
|---|---|---|
| `loadEmiliaState` throws (e.g. RLS rejection) | `[EMILIA_STATE] load failed for {conversationId}: ...` (warn) | Hook returns `state: null`. `bootstrapStateIfMissing` would re-throw to the caller; `useMessageHandler` catches and silently falls back — `memoryStateBlock` is `undefined`, parser sees no MEMORY STATE section. |
| `saveEmiliaState` throws | `[EMILIA_STATE] save failed for {conversationId}: ...` (warn) | In-memory mutation is NOT rolled back. Next mutate or app reload retries. The current turn proceeds. |
| Schema-version mismatch (stored > client) | `[EMILIA_STATE] Schema version mismatch for {conversationId}: stored=X, client=Y` (throw) | `loadEmiliaState` throws rather than load an unknown shape. Caller falls back to legacy. Deploy newer client to recover. |
| `validateMemoryNote` rejection | (model-visible only — sent back as `{ ok: false, reason }`) | Model adapts in the next iteration. No persistence write. `[CTX-MEMORY]` event reports the rejection reason. |
| `runToolLoop` throws (e.g. OpenAI 5xx after retry) | `❌ [CTX-TOOL] runToolLoop failed, falling back to single-shot: ...` (error) | Catch block re-runs the legacy `requestOpenAiChatCompletion` single-shot. User gets an answer. |
| Tool loop hits iteration cap (3) or total timeout (25s) | `[CTX-TOOL] hit_cap=true` or `hit_timeout=true` in telemetry | A "force final answer" call runs without tools and a system note ("Cap de iteraciones alcanzado…" / "Tiempo agotado…"). User gets a partial answer; the tool catalog spec describes this as the bounded worst case. |
| Per-tool 8s timeout | trace entry `error: 'timeout'`, result `{ error: 'timeout', tool }` | Loop continues. Model can retry or fall back. |
| Bad tool arguments (model emitted invalid JSON) | trace `error: 'bad_arguments'`, result `{ error: 'bad_arguments', detail }` | Loop continues. Model corrects on next iteration. |
| Batch-persist `save_memory_note` SELECT fails | `[CTX-TOOL] save_memory_note load failed: ...` (warn) | Notes are NOT persisted. Conversation continues normally. Next consolidate cannot see them. |
| Batch-persist `save_memory_note` UPDATE fails | `[CTX-TOOL] save_memory_note save failed: ...` (warn) | Same as above. |
| `consolidateMemory` OpenAI call fails | `[consolidateMemory] OpenAI request failed: ...` (error) | Returns original state unchanged. `session_memory` stays where it was — will be re-attempted next consolidate trigger. |
| `consolidateMemory` JSON parse fails | `[consolidateMemory] failed to parse consolidate response: <first 200 chars>` (error) | Same: original state unchanged. |
| Renderer overflow | (no log; degradation is silent and intended) | Drops session memory → halves global top-k → falls to 0 memories. Profile + `<memory_instructions>` always survive. |

The corollary for ops: a sustained spike in `[CTX-TOOL]` errors_count, `[CTX-MEMORY]` rejection_reasons, or `[consolidateMemory]` errors does not trigger user-visible breakage — it triggers a quality regression that has to be caught via telemetry. This is what the rollback plan in `rollback-plan.md` is designed for.
