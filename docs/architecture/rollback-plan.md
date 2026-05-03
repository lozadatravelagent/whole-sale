# Context Engineering — Rollback Plan

> **Audience**: SRE / on-call. The runbook for backing the Context-Engineering layer out, partially or fully, when telemetry or user reports show regression.
>
> **Default posture**: after the cleanup migration, CE is the only path. Rollback is via `git revert` + redeploy. The flag-based rollback strategy (toggling `VITE_USE_CONTEXT_ENGINEERING` / `USE_FUNCTION_TOOLS`) no longer exists — those flags and the legacy single-shot path were removed. Migration history is in `docs/architecture/context-engineering-overview.md` §7.

---

## 1. When to roll back

Trigger a rollback when ANY of the following holds, sustained for 30+ minutes (not a single bad turn):

- **Token usage spike**: average prompt tokens per turn rises **>40%** above the pre–Context-Engineering baseline. Target was a **30% reduction**; a 40% rise inverts the value prop.
- **Latency spike**: average end-to-end `ai-message-parser` latency rises **>25%** above baseline. Tool round-trips amortize over a window — sustained increase means the loop is thrashing.
- **Visible quality regression**: subjective review (N≥10 conversations sampled by a human) shows worse answers vs the pre-migration baseline.
- **Tool dead-end rate**: `>30%` of `[CTX-TOOL]` events show `iterations >= 2` with no successful tool result contributing to the final answer (i.e. the model thrashed). Today this is a manual computation against the `[CTX-TOOL]` trace; Phase 9.6 will surface it as a metric.
- **`save_memory_note` rejection rate**: `>50%` of attempted notes rejected (across `[CTX-MEMORY]` events). Means the model is repeatedly trying to save PII / instructions / speculation — either the prompt directives are not landing, or a model-version regression. Either way, the safety net is doing its job but the wasted token budget is unjustifiable.
- **`agent_states` table growth**: > 10 MB/day of new JSONB blob per active agency. A note is ≤500 chars; sustained growth past this rate means consolidation is not running, or `session_memory.notes` is not being drained. Investigate consolidate before reverting.
- **`[consolidateMemory]` error rate**: any sustained logging of `OpenAI request failed` or `failed to parse consolidate response`. Consolidation failing means `global_memory` never gets clean — only annoying, not user-breaking, but a signal.

If only one signal fires and the impact is contained, prefer to **diagnose first**, revert second. `git revert` is fast but it produces a rebuild + redeploy cycle; you don't need to rush.

---

## 2. Rollback severity levels

The cleanup landed as 6 sequential commits on `main`. Each level reverts a contiguous suffix of that range. Pick the lowest level that addresses the symptom.

The 6 commits, oldest → newest:

| # | Hash | Title |
|---|------|-------|
| 1 | `63ac42f0` | docs(context-engineering): align tool-catalog audit with v5 prompt + add cleanup DEBT items |
| 2 | `a0b4a8b8` | feat(context-engineering): add slot-fill handlers for 5 pending_action flows |
| 3 | `f9c3d247` | refactor(ai-message-parser): drop legacy single-shot path, force tool loop unconditional |
| 4 | `a0172dce` | refactor(orchestrator): make mode required, delete legacy fallback routing |
| 5 | `586fd973` | refactor(context-engineering): make CE the only client path, drop legacy slot-fill state |
| 6 | `10e626ed` | refactor(context-engineering): delete legacy memory shims and dead code |

### Level 1 — Revert Phase 4 only (NOT SAFE alone)

When you'd want it: the tool-loop path is the suspect (high `errors_count`, `hit_cap`, dead-end rate, or per-turn latency spike) and you want the legacy single-shot fallback back.

Action: `git revert f9c3d247` + `supabase functions deploy ai-message-parser`.

**Warning**: Phase 6 client (commit `586fd973`) is still live and expects the `pending_action` tools (`apply_slot_values`, `confirm_pending_action`) to function. Reverting only Phase 4 will break the slot-fill flow. **Use Level 2 instead** — Level 1 alone is not safe.

### Level 2 — Revert Phase 6 + Phase 4 (closest to "flag flip OFF")

When to use: same triggers as Level 1, but you accept the loss of the CE client path to get back to a coherent legacy baseline. Closest to what the old `VITE_USE_CONTEXT_ENGINEERING=false` + `USE_FUNCTION_TOOLS=false` flag combination produced.

Action:

```bash
git revert 586fd973 f9c3d247
git push
# Redeploy frontend (Railway) AND edge function:
supabase functions deploy ai-message-parser
```

Effect:
- Client: `useMessageHandler` no longer drives `bootstrapStateIfMissing` / `setActiveRef` / `memoryStateBlock`.
- Edge: `runToolLoop` is bypassed; the legacy single-shot `requestOpenAiChatCompletion` runs instead.
- `[CTX-TOOL]` and `[CTX-MEMORY]` log lines stop appearing.
- `meta.toolLoop` on persisted messages is no longer populated.
- Existing `agent_states` rows are untouched; they're just no longer read or written.

Time to recover: **~10 minutes** (frontend rebuild + Railway redeploy + edge function deploy).

Verify:
- `grep '[CTX-TOOL]' edge-function-logs | tail -5` — should stop emitting new lines within ~1 minute of the edge deploy.
- New parser requests no longer include a `memoryStateBlock` field. Check via the parser logs or by tailing `aiMessageParser.ts` request bodies.
- New messages in the database should NOT carry a `meta.toolLoop` field.

### Level 3 — Full revert (all 6 commits)

When to use: the migration as a whole is judged unfit — the docs/audit cleanup also needs to come back, or you want to restore the orchestrator's optional `mode` parameter.

Action:

```bash
git revert 10e626ed 586fd973 a0172dce f9c3d247 a0b4a8b8 63ac42f0
git push
# Redeploy everything:
supabase functions deploy ai-message-parser
# + Railway frontend redeploy
```

Effect: byte-equivalent to the pre-cleanup state. All flags, all legacy fallback shims, all stale docs come back.

Time to recover: **~15 minutes** (revert PR review + merge + frontend rebuild + edge deploy).

Verify:
- `[CTX-TOOL]` and `[CTX-MEMORY]` logs disappear entirely (since both flags default OFF in the restored code).
- Existing `agent_states` rows are NOT touched (left in place for the next re-enable).

### Level 4 — Wipe `agent_states` table (rarely needed)

When to use: data corruption in `agent_states` (e.g. invalid JSONB written by a buggy migration, RLS bypass that mixed agencies). Or when reclaiming storage.

**Note**: with the Phase 6 client live, `bootstrapStateIfMissing` will recreate empty rows on the next turn for each conversation — this is fine, the layer is designed to tolerate fresh state. No need to combine with Level 2 unless the corruption is suspected to come from CE itself.

Action options, in increasing destructiveness:
- **Per-conversation reset**: `DELETE FROM agent_states WHERE conversation_id = '...'`. Idempotent; the next turn from that conversation will bootstrap fresh via `createInitialEmiliaState`.
- **Per-agency reset**: `DELETE FROM agent_states WHERE agency_id = '...'`. Resets all conversations for that tenant. RLS will allow this only with service-role.
- **Full truncate**: `TRUNCATE TABLE agent_states`. Drops all CE state across all agencies.
- **Drop the table**: `DROP TABLE agent_states CASCADE`. Removes the layer entirely. Safe because no FK constraints reference `agent_states` from `leads` or `conversations` — it is a pure audit/state side-table; business data lives elsewhere.

Effect of any of these: the next turn for the affected conversation(s) will bootstrap a fresh `EmiliaState` and proceed.

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
| `[CTX-TOOL] runToolLoop` failures | Edge function logs | Internal network-resilience fallbacks fire when the loop throws or returns unparseable JSON. Frequent firing → loop is unstable, escalate to Level 2 revert. |
| `[EMILIA_STATE] save failed` warns | Browser console / edge logs | Persistence write failures (RLS, schema mismatch, network). |
| User support tickets / Sentry | External | Direct user reports of "Emilia forgot ...", "Emilia keeps asking the same thing", "wrong currency". |

If none of these are alarming, the issue may be downstream (e.g. PDF generation, search providers) and a revert won't help.

---

## 4. Post-rollback

After a revert (any level), do all of the following:

1. **File an incident report**. Capture: which level, trigger metric and threshold breached, time to detect, time to recover, sample failing conversations (with conversation_id), the revert commit SHA(s).
2. **Re-apply the change in dev** with the suspected fix on top. Reproduce the failing case end-to-end.
3. **Re-run regression tests** in staging. Use the same dataset that flagged the issue plus 50 control conversations. Don't re-merge to `main` until both legs converge.
4. **Update DEBT items in `docs/architecture/tool-catalog.md`** if the incident surfaced a new gap (e.g. a missing validation rule, a tool description that misled the model, a missing `<tool_selection>` directive).
5. **Update this doc** if the trigger metric / threshold needs tuning. The numbers above are the spec defaults; real-world telemetry should refine them.
6. **Re-merge gradually**: land the fix as a fresh commit (do NOT `git revert <revert>`), monitor for 24h before any further changes to the parser.

---

## 5. What rollback does NOT fix

Some symptoms look like CE issues but won't be cured by reverting:

- **Provider outages** (Starling 5xx, EUROVIPS down): unrelated to the parser path. Check provider health.
- **Search rate limiting** (`places-viewport` 429s): handled by the cooldown propagation contract in `usePlacesOrchestrator`. Not CE-related.
- **PDF generation failures**: PDFMonkey / extraction issues, not CE.
- **RLS / multi-tenant leak**: this would manifest as one tenant seeing another's data, but `agent_states` is `agency_id`-scoped via RLS. If you suspect a leak, check the RLS policies on `agent_states` (see the migration that created the table) — reverting the cleanup just stops new writes from the new code path, it doesn't recall old ones.
- **Conversation history rendering bugs**: bugs in message rendering / metadata extraction are independent of CE.

---

## 6. Contacts & escalation

(Fill in for your team.)

- Owner: Emilia agent platform.
- On-call: see PagerDuty rotation `wholesale-connect-ai-edge`.
- Escalation: backend lead → CTO.
- Spec questions: `docs/architecture/context-engineering-spec.md`, `docs/architecture/tool-catalog-spec.md`.
- Audit endpoint for inspecting a specific bad turn: `supabase/functions/agent-state-audit/` (JWT-bound; provide `message_id`).
