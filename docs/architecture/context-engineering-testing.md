# Context Engineering — Testing Guide & Behavior Spec

> Generated 2026-05-02 at the close of the Context Engineering implementation
> (Phases 0–9). Captures: what we built, the test suite that ships with it,
> the manual end-to-end flows you should run, and the known issues to watch.
>
> Companion docs (read in this order if new):
> 1. [`context-engineering-overview.md`](./context-engineering-overview.md) — what & why
> 2. [`context-engineering-spec.md`](./context-engineering-spec.md) — type & policy spec
> 3. [`tool-catalog-spec.md`](./tool-catalog-spec.md) — function tools contract
> 4. [`tool-catalog.md`](./tool-catalog.md) — audit + DEBT
> 5. [`memory-lifecycle.md`](./memory-lifecycle.md) — distill → consolidate → inject
> 6. [`rollback-plan.md`](./rollback-plan.md) — operational rollback
> 7. **This doc** — testing & manual verification

---

## 1. What we built (recap)

A **per-conversation context engineering layer** following OpenAI Agents SDK / Cookbook patterns and GPT-5.1 Prompting Guide. It sits *alongside* the legacy parser path, gated behind two feature flags so it can be enabled/disabled per surface without redeploys.

**Three pillars:**

| Pillar | What it does | Where it lives |
|---|---|---|
| **State** (Phase 1) | `EmiliaState` JSONB per `conversation_id`, with profile + memories + active refs + mode | `agent_states` table; `src/features/chat/state/*` |
| **Tools** (Phase 3) | OpenAI function calling loop with 4 retrieval tools + 1 memory tool | `supabase/functions/_shared/{functionTools,toolRunner,memoryTools}.ts` + `ai-message-parser/index.ts` |
| **Lifecycle** (Phase 2) | Distill (model → save_memory_note tool) → Consolidate (LLM dedup) → Inject (renderStateForSystemPrompt) | `_shared/{memoryTools,consolidateMemory,renderState,lifecycleHooks}.ts` |

**Plus:** TrimmingSession (Phase 4), reciprocity helpers (Phase 5), tool catalog audit (Phase 6), telemetry + audit endpoint (Phase 8), docs + DEBT fixes (Phase 9).

**Key architectural decision: Option A — full conversation isolation.** Each conversation is a fresh slate. `global_memory` is per-conversation despite the name (the "global" reflects lifecycle position, not scope). No cross-conversation memory propagation. `lead_id` in profile is CRM linkage only, does not load lead-level data.

---

## 2. Architecture flow (one turn, end-to-end)

```
┌─────────────────────────────────────────────────────────────────────┐
│                              CLIENT                                  │
└─────────────────────────────────────────────────────────────────────┘
User sends message
        ↓
useMessageHandler.handleSendMessage
        ↓
[FLAG: VITE_USE_CONTEXT_ENGINEERING=true]
        │
        ├─ bootstrapStateIfMissing({conversationId, agencyId, leadId, mode})
        │     ├─ loadEmiliaState(conversationId) ─► supabase.from('agent_states').select()
        │     └─ if null → createInitialEmiliaState() + saveEmiliaState()
        │
        ├─ if state.mode !== currentChatMode → applyModeChange + persist
        ├─ if plannerState present → setActiveRef({type:'plan', id, summary, lastUpdated})
        │
        ├─ memoryStateBlock = buildMemoryStateBlockFromState(state)
        │     → renders <user_profile> YAML + <current_mode> + <active_refs>
        │       + <memories> + <memory_instructions> (~200-800 tokens)
        │
        └─ parseMessageWithAI({..., memoryStateBlock, contextMeta: {conversationId, agencyId, leadId}})
                ↓ HTTPS POST
┌─────────────────────────────────────────────────────────────────────┐
│                  EDGE FUNCTION ai-message-parser                     │
└─────────────────────────────────────────────────────────────────────┘
[FLAG: USE_FUNCTION_TOOLS=true OR header x-use-tool-loop=true]
        │
        ├─ buildSystemPrompt({..., memoryStateBlock})
        │     → injects memory block + persistence reminders + tool selection rules
        │
        └─ runToolLoop({
              tools: [...getRetrievalToolSchemas(), saveMemoryNoteToolSchema],
              toolHandlers: {
                ...getRetrievalToolHandlers(),  // get_planner_state, get_quote,
                                                 //   get_recent_searches, get_lead_full_history
                save_memory_note: saveMemoryNoteHandler  // validates + returns note
              },
              iterationCap: 3,
              parallelToolCalls: true
            })
                ↓
            Loop iteration:
              1. OpenAI call with tools array
              2. If tool_calls → execute handlers in parallel (with timeout)
              3. Append results to messages
              4. Repeat until no tool_calls or cap reached
                ↓
            After loop:
              ├─ Batch-persist accepted save_memory_note → agent_states.session_memory.notes
              ├─ emitTelemetry [CTX-TOOL] + [CTX-MEMORY] (structured logs)
              └─ Synthesize OpenAI envelope → existing JSON parsing path
                ↓
        Response (with meta.toolLoop trace) → Client
```

**Reciprocity invariant**: when `chatMode` toggles between passenger ↔ agency, the client mutates `state.mode` only. `state.profile`, `state.global_memory`, `state.session_memory`, and `state.active_refs` are untouched. The next turn's `memoryStateBlock` reflects the new mode but preserves all refs and memory.

---

## 3. Test suite shipped (automated)

All tests live in the repo and run with `npm test -- --run`. Total: **487 tests / 11 skipped / 0 failures** at end of session.

### 3.1 Unit & integration tests by phase

| Phase | Test file | # tests | What it validates |
|---|---|---|---|
| 1 | `src/features/chat/state/__tests__/runContext.test.ts` | 14 | Defensive cloning, immutable swap, subscribe semantics, throw safety |
| 1 | `src/features/chat/state/__tests__/useEmiliaState.test.tsx` | 13 | Hook surface: null id, late registration, mutate fan-out, conversation switch |
| 1 | `src/features/chat/state/__tests__/persistence.test.ts` | ~10 | PGRST116 → null, schema version refuse-load, UPSERT shape |
| 2 | `supabase/functions/_shared/__tests__/memoryTools.test.ts` | 24 | Schema strictness, every PII regex, instruction-shaped, speculation, scope, immutability |
| 2 | `supabase/functions/_shared/__tests__/renderState.test.ts` | 9 | Empty state, profile YAML, global notes ordering, refs block, session inject flag, token cap |
| 3 | `supabase/functions/_shared/__tests__/functionTools.test.ts` | 14 | Schema strictness all 4 tools, happy path + bad_arguments + not_found per tool |
| 3 | `supabase/functions/_shared/__tests__/toolRunner.test.ts` | 9 | No-tools path, single tool, failing tool, unknown tool, iteration cap, parallel fan-out |
| 4 | `src/features/chat/sessions/__tests__/trimmingSession.test.ts` | 9 | Less/equal/over maxTurns, tool item preservation mid-turn, stats, dynamic maxTurns |
| 5 | `src/features/chat/state/__tests__/reciprocity.test.ts` | 4 | Cases A/B/C/D from spec (passenger↔agency persistence) |
| 5 | `src/features/chat/state/__tests__/contextEngineeringIntegration.test.ts` | 12 | bootstrap fresh/existing/error, applyModeChange immutability, ref operations |
| 8 | `supabase/functions/_shared/__tests__/telemetry.test.ts` | 11 | Empty/unique/repeat traces, all 3 event categories shape, no-mutation guarantee |
| 8 | `supabase/functions/agent-state-audit/__tests__/audit.test.ts` | 14 | Happy path, 404, 403 (RLS denial + DB error), 400, malformed meta, null state |
| Demo | `supabase/functions/_shared/__tests__/demo-passenger-to-agency.test.ts` | 1 | Prints what the model SEES at each turn (Option A flow) |

### 3.2 How to run

```bash
# Full suite
npm test -- --run

# Single file
npm test -- --run src/features/chat/state/__tests__/reciprocity.test.ts

# Demo (with console output visible)
npx vitest run supabase/functions/_shared/__tests__/demo-passenger-to-agency.test.ts --reporter=verbose
```

### 3.3 Reciprocity test cases (A/B/C/D — automated)

These are the integration tests that verify the **core requirement** (passenger ↔ agency cross-mode):

| Case | Setup | Action | Asserts |
|---|---|---|---|
| **A** (passenger → agency) | bootstrap mode=passenger + addRef plan | applyModeChange('agency') | active_refs intact, global_memory intact, profile intact, only state.mode changed |
| **B** (agency → passenger) | bootstrap mode=agency + plan ref | applyModeChange('passenger') | Same as A in reverse |
| **C** (round trip) | bootstrap → setRef → mode→mode→mode | repeated changes | active_refs persists, state coherent |
| **D** (explicit reset) | bootstrap with plan ref | clearActiveRef('plan') | active_refs empty, mode + memories intact |

All four pass. Confirms the Option A invariant holds in code.

---

## 4. End-to-end manual test cases

The automated tests cover the units. These four test the **deployed system** end-to-end against real Supabase + OpenAI.

### Setup obligatorio (do once)

1. **Server flag**: `USE_FUNCTION_TOOLS=true` in Supabase secrets ✅ (done)
2. **Client flag**: in `.env`:
   ```
   VITE_USE_CONTEXT_ENGINEERING=true
   ```
3. **Restart dev server fully** (`Ctrl+C` → `npm run dev`). Vite does NOT hot-reload env vars.
4. **Hard reload browser** (`Ctrl+Shift+R`) so the new env var ships.
5. **Verify flag is active**: open browser DevTools → Console. You should see `[CTX-` logs (or `bootstrapStateIfMissing` traces) when you open a conversation. If they don't appear, the flag isn't on.
6. **Verify on the wire**: DevTools → Network → send a message → look at body of POST to `ai-message-parser`. Body should include `memoryStateBlock` field with content starting with `<user_profile>`.

### Where to look at results

| Signal | Where |
|---|---|
| Tool loop ran | Supabase dashboard → Functions → `ai-message-parser` → Logs → search `[CTX-TOOL]` |
| Memory write attempted | Same logs → search `[CTX-MEMORY]` |
| State persisted | Supabase Studio → Tables → `agent_states` → row by `conversation_id` → inspect JSONB `state` column |
| What model "saw" | Audit endpoint (see §6) |

---

### Test 1 — Smoke (no client flag required)

**Goal**: Deploy works; tool loop doesn't break legacy behavior when nothing to invoke.

**Steps**:
1. Open chat (any mode)
2. Send: `Quiero un vuelo a Bariloche para 2 adultos en julio`

**Expected**:
- Normal flight JSON response
- Edge function logs:
  ```json
  [CTX-TOOL] {"category":"CTX-TOOL","iterations":1,"tools_called":[],"errors_count":0,"hit_cap":false,"hit_timeout":false,"prompt_tokens":...,"completion_tokens":...,"redundant_calls":0}
  ```
- `iterations: 1`, `tools_called: []` → model went direct, didn't invoke any tool

**Pass criteria**: response correct + log shows `[CTX-TOOL]` entry.

**Fail signals**:
- Log shows `runToolLoop failed, falling back to single-shot` → deploy issue or OpenAI key issue. Conversation does NOT break (fallback to legacy works).

---

### Test 2 — Tool invocation (requires flags + plan in state)

**Goal**: Model invokes `get_planner_state` when message references a plan.

**Setup**:
1. Client flag on, dev server restarted
2. New conversation in **passenger** (planner) mode
3. Build a plan: `Quiero ir a Roma 5 días en septiembre`
4. Wait for planner to generate
5. Verify in Supabase Studio → `agent_states`: row exists with your `conversation_id`, `state.active_refs` contains `[{type:"plan", id:..., summary1Line:...}]`

**Steps**:
- Send: `Cotizame este plan`

**Expected**:
- Model invokes `get_planner_state(planner_id)` before responding
- Logs:
  ```json
  [CTX-TOOL] {"iterations":2,"tools_called":["get_planner_state"],"errors_count":0,...}
  ```
- `iterations: 2` = first iteration model decides to use tool, second iteration has tool result and produces final JSON
- Response payload `meta.toolLoop.trace` shows tool latency

**Pass criteria**: `tools_called` array contains `get_planner_state`, response is a sensible quote/proposal.

**Fail signals**:
- `tools_called: []` → model didn't invoke. Causes:
  - `memoryStateBlock` not sent (check Network tab)
  - `<active_refs>` empty in rendered block (check audit endpoint)
  - System prompt doesn't include `<tool_selection>` rules (check deployed `prompt.ts` v4)

---

### Test 3 — save_memory_note (requires flags)

**Goal**: Model saves a memory note when user states a durable preference.

**Setup**: Same conversation as Test 2 (or any with state).

**Steps**:
- Send: `Anotá que prefiero hoteles boutique con desayuno incluido, nunca cadenas grandes`

**Expected**:
- Model invokes `save_memory_note({text: "...", keywords: [...], scope: "lead-context" or "planning"})`
- Logs:
  ```json
  [CTX-TOOL]   {"iterations":2,"tools_called":["save_memory_note"],...}
  [CTX-MEMORY] {"category":"CTX-MEMORY","attempted":1,"accepted":1,"rejected":0,"rejection_reasons":{}}
  [CTX-TOOL]   persisted save_memory_note batch: {"count":1,"conversationId":"..."}
  ```
- Supabase Studio → `agent_states` → your row → `state.session_memory.notes` has the new note
- Next message in this conversation: `memoryStateBlock` rendering includes the note (verify via audit endpoint)

**Pass criteria**: `attempted >= 1`, `accepted >= 1`, note visible in DB.

**Fail signals**:
- `attempted: 0` → model didn't try. Tool selection rule needs to be more specific in the prompt.
- `accepted: 0, rejected: 1, rejection_reasons: {"speculation": 1}` → model wrote text with "creo que" / "maybe". Correct rejection — model will adapt.
- `accepted: 1` but no DB persist → check `contextMeta.conversationId` and `contextMeta.agencyId` are in request body. Without them, persistence silently skips.

---

### Test 4 — Reciprocity (the original use case)

**Goal**: Passenger plans → switch to agency → model quotes using the plan without user repeating.

**This is THE test that motivated the whole plan.**

**Setup**: Client flag on + brand new conversation.

**Steps (3 sequential messages + 1 manual UI action)**:

| Step | Action | Where to verify |
|---|---|---|
| 1 | Send `Armame un viaje a Italia para 2 adultos en septiembre, 8 días` (passenger mode) | Planner generates itinerary; `agent_states` row created with `mode: "passenger"`, `active_refs[0].type = "plan"` |
| 2 | **Click the toggle to change mode → Agency** (this is a UI action, NOT a chat message) | Studio: `state.mode = "agency"`, `state.active_refs` STILL has the plan ref. **This is the reciprocity invariant in action.** |
| 3 | Audit endpoint or Studio: confirm `<current_mode>agency</current_mode>` and `<active_refs>` block present in `rendered_memory_block` | See §6 for audit endpoint |
| 4 | Send `Cotizame este viaje` | Logs: `[CTX-TOOL] tools_called:["get_planner_state"]`. Response is a proposal/quote with plan data, NOT "necesito más info" |

**Pass criteria**: in step 4, model invokes `get_planner_state` and produces a quote. No "needs_mode_switch" message.

**Fail signals & diagnosis**:

| Symptom | Diagnosis |
|---|---|
| Step 1 fails: `[EMILIA_STATE] load failed for temp-...` 400 in browser console | `useEmiliaState` is hitting Supabase with optimistic temp ID. Was a bug — fixed in this session by adding UUID validation. If you still see it, pull latest. |
| Step 1 ok but no `agent_states` row appears | Client flag not active. Restart dev server. Hard reload. |
| Step 2 ok but `state.active_refs` is `[]` after toggle | Mode change handler is clearing refs (regression). Check `applyModeChange` in `contextEngineeringIntegration.ts` — should ONLY mutate `state.mode`. |
| Step 4: response is `Este pedido funciona mejor armando un itinerario. ¿Cambiamos de modo?` | The orchestrator emitted `mode_bridge` (route `PLAN`, branch `mode_bridge`). Causes: (a) you didn't click the toggle in step 2 — system thinks you're still in passenger; (b) the bridge logic in `conversationOrchestrator.ts` fires before the tool loop has a chance. See §5 for the known limitation. |
| Step 4: tool_called is empty | `memoryStateBlock` arrives empty or doesn't include `<active_refs>`. Use audit endpoint to inspect. |

---

## 5. Known limitation: `mode_bridge` vs the tool loop

**Observed in this session's manual Test 4 attempt** (logs: `executionBranch: 'mode_bridge', responseMode: 'needs_mode_switch'`).

**The conflict**:
- The legacy `conversationOrchestrator.ts` (Emilia 5.0) classifies `Cotizame este viaje` as `route: 'PLAN', reason: 'edit_existing_plan'` and emits `mode_bridge` if the user is in the "wrong" mode for the action.
- This happens **client-side**, **before** the parser/tool loop is even called.
- So the tool loop never gets a chance to invoke `get_planner_state` — the user gets the "¿Cambiamos de modo?" message first.

**Why this is correct (sort of)**:
- If the user is in passenger mode and says "cotizame", the bridge prompts them to switch to agency. Reasonable UX.
- If the user is **already** in agency mode, the bridge should NOT fire. Verify: when `chatMode === 'agency'` AND there's a plan ref, the orchestrator should emit `standard_search` or `standard_itinerary`, not `mode_bridge`.

**Open question for product**:
- Should agency mode + plan ref + "cotizame" route directly to the tool loop (skip bridge)?
- Currently: probably depends on what `chatMode` returns when toggle is on agency. Need to trace.

**To investigate**: search for `mode_bridge` in `src/features/chat/services/conversationOrchestrator.ts`, find the branch decision logic, see if `mode === 'agency'` is treated specially.

---

## 6. Audit endpoint — debugging what the model saw

**Endpoint**: `GET https://ujigyazketblwlzcomve.supabase.co/functions/v1/agent-state-audit`

**Auth**: requires `Authorization: Bearer <user JWT>`. Get JWT from browser localStorage key `sb-ujigyazketblwlzcomve-auth-token` → `access_token` field.

**Query**:
```bash
curl "https://ujigyazketblwlzcomve.supabase.co/functions/v1/agent-state-audit?message_id=<UUID>" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json"
```

Or with conversation_id + turn:
```
?conversation_id=<UUID>&turn=N
```

**Response**:
```json
{
  "conversation_id": "...",
  "agency_id": "...",
  "state_snapshot": { /* EmiliaState at that point */ },
  "messages_around_turn": [/* 3 before + 1 after */],
  "tool_calls_for_turn": [/* from meta.toolLoop */],
  "tokens_for_turn": { "prompt_tokens": ..., "completion_tokens": ..., "total": ... },
  "rendered_memory_block": "<user_profile>...</memory_instructions>"
}
```

**Status codes**: 401 (no auth), 400 (bad query), 403 (RLS denial / cross-agency), 404 (not found), 405 (wrong method).

**Use cases**:
- "Why did the model not invoke `get_planner_state`?" → check `rendered_memory_block` for `<active_refs>` content
- "Was the memory note actually persisted?" → check `state_snapshot.session_memory.notes`
- "What did the prompt cost in tokens?" → check `tokens_for_turn`
- "Did `chatMode` toggle break refs?" → compare `state_snapshot.mode` vs `state_snapshot.active_refs`

---

## 7. Bug fixes shipped in this session (post-Phase 9)

| Bug | Symptom | Fix |
|---|---|---|
| temp ID load | `agent_states?conversation_id=eq.temp-... 400` in console; `[EMILIA_STATE] load failed for temp-...` | `useEmiliaState.ts:isValidUuid()` — skip load until ID promotion completes |

If you find more bugs while running the manual tests, file them with: log snippet + reproduction steps + state snapshot from audit endpoint.

---

## 8. Quick verification checklist

Before saying "Context Engineering works", confirm all of these:

- [ ] `npm test -- --run` → 487 pass, 0 fail
- [ ] `npm run build` → success
- [ ] `supabase functions list` → shows `ai-message-parser` v119+ and `agent-state-audit` v1+
- [ ] Supabase secrets includes `USE_FUNCTION_TOOLS=true`
- [ ] `.env` includes `VITE_USE_CONTEXT_ENGINEERING=true`
- [ ] Dev server restarted after env var change
- [ ] Browser hard-reloaded
- [ ] DevTools console shows `[CTX-` logs when opening a conversation
- [ ] Network tab shows `memoryStateBlock` in POST body to `ai-message-parser`
- [ ] Test 1 passes: `[CTX-TOOL] iterations:1 tools_called:[]` for a simple message
- [ ] Test 2 passes: model invokes `get_planner_state` when referencing a plan
- [ ] Test 3 passes: `[CTX-MEMORY] attempted:1 accepted:1` for a clear preference statement
- [ ] Test 4 passes: passenger plans → toggle to agency → model quotes via `get_planner_state` (REQUIRES the toggle click)

If any of these fails, see the relevant test section above for diagnosis.

---

## 9. What we did NOT do (Phase 9 deferred items)

These are explicitly out of scope for this session and remain as future work:

- **A/B test in production** with real dataset (~100 conversations). The skeleton is in `evals/context-engineering/` but needs real data and the `replayTurn` placeholder needs a real fetch.
- **Gradual rollout** dev → 10% → 100%. Manual decision based on metrics.
- **DEBT-9 deep wiring**: read `currency`/`language` from `agency_config` table at the call sites of `bootstrapStateIfMissing`. The factory accepts the args; nothing passes them yet.
- **DEBT-10**: request body validation on the 23 edge functions (separate hardening pass).
- **mode_bridge vs tool loop** decision: should agency mode + plan ref skip bridge entirely? (See §5.)
- **`get_quote` real implementation**: depends on `quotes` table being provisioned. Currently a stub.
- **SummarizingSession**: only needed if amnesia rate exceeds threshold in production. Not implemented yet.

---

## References

- Plan file: `~/.claude/plans/analiza-como-es-el-parallel-patterson.md`
- OpenAI Cookbook: [Context Engineering for Personalization (Agents SDK)](https://developers.openai.com/cookbook/examples/agents_sdk/context_personalization)
- OpenAI Cookbook: [Short-Term Memory Management with Sessions](https://developers.openai.com/cookbook/examples/agents_sdk/session_memory)
- OpenAI: [GPT-5.1 Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5-1_prompting_guide)
- OpenAI: [Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
