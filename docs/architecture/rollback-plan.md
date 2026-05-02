# Context Engineering — Rollback Plan

> **Audience**: SRE / on-call. The runbook for backing the Context-Engineering layer out, partially or fully, when telemetry or user reports show regression.
>
> **Default posture**: both feature flags ship OFF (`VITE_USE_CONTEXT_ENGINEERING=false`, `USE_FUNCTION_TOOLS=false`, no `x-use-tool-loop` header). Enabling is a deliberate staged rollout (dev → staging → 10% prod → 100%). This doc covers backing OUT after enable.

---

## 1. When to roll back

Trigger a rollback when ANY of the following holds, sustained for 30+ minutes (not a single bad turn):

- **Token usage spike**: average prompt tokens per turn rises **>40%** above the pre–Context-Engineering baseline. Target was a **30% reduction**; a 40% rise inverts the value prop.
- **Latency spike**: average end-to-end `ai-message-parser` latency rises **>25%** above baseline. Tool round-trips amortize over a window — sustained increase means the loop is thrashing.
- **Visible quality regression**: subjective review (N≥10 conversations sampled by a human) shows worse answers vs the legacy A leg of the A/B test.
- **Tool dead-end rate**: `>30%` of `[CTX-TOOL]` events show `iterations >= 2` with no successful tool result contributing to the final answer (i.e. the model thrashed). Today this is a manual computation against the `[CTX-TOOL]` trace; Phase 9.6 will surface it as a metric.
- **`save_memory_note` rejection rate**: `>50%` of attempted notes rejected (across `[CTX-MEMORY]` events). Means the model is repeatedly trying to save PII / instructions / speculation — either the prompt directives are not landing, or a model-version regression. Either way, the safety net is doing its job but the wasted token budget is unjustifiable.
- **`agent_states` table growth**: > 10 MB/day of new JSONB blob per active agency. A note is ≤500 chars; sustained growth past this rate means consolidation is not running, or `session_memory.notes` is not being drained. Investigate consolidate before disabling.
- **`[consolidateMemory]` error rate**: any sustained logging of `OpenAI request failed` or `failed to parse consolidate response`. Consolidation failing means `global_memory` never gets clean — only annoying, not user-breaking, but a signal.

If only one signal fires and the impact is contained, prefer to **diagnose first**, rollback second. The flags are designed for fast revert; you don't need to rush.

---

## 2. Rollback severity levels

Pick the lowest level that addresses the symptom. Each level is independent — Level 2 does not require Level 1, etc.

### Level 1 — Disable the function-tool loop (most common)

When to use: tool-calling is the suspect (high `errors_count`, `hit_cap`, dead-end rate, or per-turn latency spike). Memory state injection is fine.

Action (pick one):
- **Env**: in Supabase → Settings → Edge Function Secrets, set `USE_FUNCTION_TOOLS=false` (or unset it). Then `supabase functions deploy ai-message-parser` to pick up the change.
- **Header-based opt-in**: confirm no client is sending `x-use-tool-loop: true`. The check is in `supabase/functions/ai-message-parser/index.ts:310-311` — both signals must be false for the loop to be skipped.

Effect:
- `runToolLoop` is bypassed; the legacy single-shot `requestOpenAiChatCompletion` runs instead.
- `memoryStateBlock` is still injected if the client passes it (parser still calls `buildSystemPrompt({ ..., memoryStateBlock })`).
- `[CTX-TOOL]` and `[CTX-MEMORY]` log lines stop appearing.
- `meta.toolLoop` on persisted messages is no longer populated.

Time to recover: **<5 minutes** (env var + edge function redeploy).

Verify:
- `grep '[CTX-TOOL]' edge-function-logs | tail -5` — should stop emitting new lines within ~1 minute.
- New messages in the database should NOT carry a `meta.toolLoop` field.

### Level 2 — Disable client-side context engineering

When to use: the state-injection block itself is the suspect (e.g. malformed YAML breaking the parser; bad refs causing the model to chase nonexistent plans; profile values leaking from one tenant's UI render to another).

Action: in Railway → Project → Variables, set `VITE_USE_CONTEXT_ENGINEERING=false` (or unset). Trigger a frontend redeploy.

Effect:
- `useMessageHandler` skips `bootstrapStateIfMissing`, `applyModeChange`, `setActiveRef`, and `buildMemoryStateBlockFromState`.
- `memoryStateBlock` is `undefined` in the parser request body.
- The parser still sees `previousContext`, `conversationSummary`, `leadProfile`, `plannerContext` (legacy push-context — this is the pre–Context-Engineering behavior).
- If the tool loop is also enabled (Level 1 not taken), the loop runs but its `memory_instructions` block has no `<user_profile>` / `<memories>` to surface — behavior is similar to legacy.
- No new rows are written to `agent_states` (existing rows are not deleted).

Time to recover: **<10 minutes** (Railway env var + redeploy build).

Verify:
- New parser requests no longer include a `memoryStateBlock` field. Check via the parser logs or by tailing `aiMessageParser.ts:1847` request bodies.
- The `<persistence>` and `<tool_selection>` blocks are still present in the system prompt — they're constants in `prompt.ts`, not gated on `memoryStateBlock`.

### Level 3 — Both flags off (full rollback)

When to use: you want byte-identical pre–Context-Engineering behavior to compare baselines or to stop a cascading regression.

Action: combine Level 1 + Level 2.

Effect: byte-identical to pre–Context-Engineering behavior on the chat flow. No state load, no memory block, no tool loop, single-shot legacy call.

Verify:
- `[CTX-TOOL]` and `[CTX-MEMORY]` logs disappear entirely.
- No new `agent_states` rows.
- Existing `agent_states` rows are NOT touched (left in place for the next re-enable).
- Compare 50 sampled conversations against a known-good legacy snapshot; outputs should be functionally equivalent.

### Level 4 — Database rollback (rarely needed)

When to use: data corruption in `agent_states` (e.g. invalid JSONB written by a buggy migration, RLS bypass that mixed agencies). Or when reclaiming storage.

Action options, in increasing destructiveness:
- **Per-conversation reset**: `DELETE FROM agent_states WHERE conversation_id = '...'`. Idempotent; the next turn from that conversation will bootstrap fresh via `createInitialEmiliaState`.
- **Per-agency reset**: `DELETE FROM agent_states WHERE agency_id = '...'`. Resets all conversations for that tenant. RLS will allow this only with service-role.
- **Full truncate**: `TRUNCATE TABLE agent_states`. Drops all CE state across all agencies.
- **Drop the table**: `DROP TABLE agent_states CASCADE`. Removes the layer entirely. Safe because no FK constraints reference `agent_states` from `leads` or `conversations` — it is a pure audit/state side-table; business data lives elsewhere.

Effect of any of these: the next turn for the affected conversation(s) will (with `VITE_USE_CONTEXT_ENGINEERING=true`) bootstrap a fresh `EmiliaState` and proceed. With the flag OFF, no state is read or written.

Time to recover: **<2 minutes** (single SQL statement). The schema migration is non-destructive of legacy tables, so no business data is at risk.

Verify:
- `SELECT count(*) FROM agent_states;` reports the expected row count.
- No errors in subsequent parser calls (would log `[EMILIA_STATE] load failed for ... PGRST116` for the no-row case, which is the **normal** "fresh conversation" path and should NOT alert).

---

## 3. Quick checks pre-rollback

Run these BEFORE pulling the trigger to confirm the issue is what you think it is. None take more than 60 seconds.

| Check | Where | What you're looking for |
|---|---|---|
| `[CTX-TOOL]` frequency | Edge function logs (Supabase dashboard) | Should be one per parser call. If 5x baseline → tool loop is firing too often (model not converging). |
| `[CTX-MEMORY]` rejection_reasons distribution | Edge function logs, last hour | Heavy `pii_*` → model trying to save PII; heavy `speculation` → model overconfident; heavy `too_long` → prompt directives not landing. |
| `agent_states` row count + size | Supabase SQL: `SELECT count(*), pg_size_pretty(pg_total_relation_size('agent_states')) FROM agent_states;` | Sanity check vs expectations. |
| Failed tool_call rate | `grep 'errors_count' [CTX-TOOL] logs` | High persistent error count → provider issue, schema validation issue, or RLS failure. |
| `❌ [CTX-TOOL] runToolLoop failed` logs | Edge function logs | Means the loop threw and we fell back to legacy single-shot. If frequent → loop is unstable. |
| `[EMILIA_STATE] save failed` warns | Browser console / edge logs | Persistence write failures (RLS, schema mismatch, network). |
| User support tickets / Sentry | External | Direct user reports of "Emilia forgot ...", "Emilia keeps asking the same thing", "wrong currency". |

If none of these are alarming, the issue may be downstream (e.g. PDF generation, search providers) and rollback won't help.

---

## 4. Post-rollback

After a rollback (any level), do all of the following:

1. **File an incident report**. Capture: which level, trigger metric and threshold breached, time to detect, time to recover, sample failing conversations (with conversation_id).
2. **Re-enable in dev** with the suspected fix applied. Reproduce the failing case end-to-end.
3. **Re-run the A/B test** in staging. Use the same dataset that flagged the issue plus 50 control conversations. Don't re-enable in prod until both legs converge.
4. **Update DEBT items in `docs/architecture/tool-catalog.md`** if the incident surfaced a new gap (e.g. a missing validation rule, a tool description that misled the model, a missing `<tool_selection>` directive).
5. **Update this doc** if the trigger metric / threshold needs tuning. The numbers above are the spec defaults; real-world telemetry should refine them.
6. **Re-enable in prod gradually**: 10% → monitor for 24h → 50% → monitor for 48h → 100%. The flags are per-tenant via env, so a percent-based rollout requires either a flag service or staged environment promotion.

---

## 5. What rollback does NOT fix

Some symptoms look like CE issues but won't be cured by flipping the flags:

- **Provider outages** (Starling 5xx, EUROVIPS down): unrelated to the parser path. Check provider health.
- **Search rate limiting** (`places-viewport` 429s): handled by the cooldown propagation contract in `usePlacesOrchestrator`. Not CE-related.
- **PDF generation failures**: PDFMonkey / extraction issues, not CE.
- **RLS / multi-tenant leak**: this would manifest as one tenant seeing another's data, but `agent_states` is `agency_id`-scoped via RLS. If you suspect a leak, check the RLS policies on `agent_states` (see the migration that created the table) — turning off CE just stops new writes, it doesn't recall old ones.
- **Conversation history rendering bugs**: legacy `previousContext` / `conversationSummary` paths still run; bugs there are independent of CE.

---

## 6. Reference: feature-flag matrix

| `VITE_USE_CONTEXT_ENGINEERING` | `USE_FUNCTION_TOOLS` env or `x-use-tool-loop` header | Behavior |
|---|---|---|
| OFF | OFF | **Pre–Context-Engineering baseline** (Level 3 = full rollback). No state load, no memory block, single-shot completion. |
| OFF | ON | Tool loop runs, but with no `memoryStateBlock` — `<user_profile>` / `<memories>` blocks are absent. Loop has less context to ground tool selection. Not a recommended steady state. |
| ON | OFF | State is loaded and rendered into the prompt, but no tool loop. Single-shot completion sees the full memory block. Reasonable A/B leg for measuring state-injection value alone. |
| ON | ON | **Full Context Engineering** (target steady state once rollout completes). |

---

## 7. Contacts & escalation

(Fill in for your team.)

- Owner: Emilia agent platform.
- On-call: see PagerDuty rotation `wholesale-connect-ai-edge`.
- Escalation: backend lead → CTO.
- Spec questions: `docs/architecture/context-engineering-spec.md`, `docs/architecture/tool-catalog-spec.md`.
- Audit endpoint for inspecting a specific bad turn: `supabase/functions/agent-state-audit/` (JWT-bound; provide `message_id`).
