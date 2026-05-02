# Context Engineering Evals — Skeleton (Phase 8.7)

> **Status:** SKELETON. Phase 9 will replace the mock harness with a real
> dataset (~100 cases captured from production conversations) and wire it
> into CI. Today this directory is a contract proposal, not a runnable suite.

This folder defines the **shape** of the eval pipeline that scores Emilia
(the chat agent powered by `ai-message-parser` + the function-tool loop)
across a representative set of conversations.

It exists so that Phase 9 has a clear extension point: drop a real
`dataset.json` next to `dataset.example.json`, replace the TODOs in
`run-eval.ts` with real edge-function invocations, and you get a pass/fail
report per case.

---

## Files in this folder

| File | Status | Purpose |
|------|--------|---------|
| `README.md` | this doc | how to run + what's missing |
| `dataset.example.json` | committed | 3 illustrative cases — passenger→agency flip, plan edit, COLLECT |
| `run-eval.ts` | committed (skeleton) | loads dataset, replays turns, compares actual vs expected |

The example dataset uses the same JSON shape the real one will use, so the
runner can be developed against it and then swapped over.

---

## Case shape (contract)

```jsonc
{
  "id": "case-001",
  "description": "passenger arma plan, switch a agency, cotiza",
  "turns": [
    {
      "user": "buenos aires a rio 7 dias en septiembre",
      "expected_intent": "itinerary",      // matches parsed.requestType
      "expected_tools": ["get_planner_state"]  // tools the model SHOULD call
    },
    {
      "user": "cotiza esto",
      "expected_intent": "combined",
      "expected_tools": ["get_planner_state", "get_quote"]
    }
  ]
}
```

Fields:

- `id` (required, string) — stable identifier; used to keep history when a
  case is fixed and re-run.
- `description` (required, string) — one-line human summary; surfaces in
  the report.
- `turns` (required, array, ≥1) — ordered user messages.
- `turns[i].user` (required, string) — the user's message verbatim.
- `turns[i].expected_intent` (required, string) — the `parsed.requestType`
  the parser should emit (`itinerary`, `flights`, `hotels`, `combined`,
  `packages`, `services`, `general`).
- `turns[i].expected_tools` (required, array of strings) — the **set** of
  tools the model is expected to invoke (order-insensitive). May be empty.

Future fields (added when the runner is real):

- `turns[i].expected_state_diff` — assertions on the EmiliaState delta
  (e.g. `{ session_memory_added: ≥1 }`).
- `turns[i].forbid_tools` — explicit don't-call list.
- `turns[i].max_iterations` — fail if the loop exceeds this.

---

## How a Phase 9 implementer makes this real

1. **Get a dataset.** Spend a half-day hand-tagging 50–100 conversations
   pulled from production (filter to agencies that opted in to telemetry).
   Use `dataset.example.json` as the shape reference. Save as
   `evals/context-engineering/dataset.json` — gitignored if it contains
   any PII.
2. **Wire the parser invocation in `run-eval.ts`.**
   - Pick an environment (e.g. `EVAL_PARSER_URL=http://localhost:54321/functions/v1/ai-message-parser`).
   - For each turn, POST `{ message: turn.user, conversationHistory, ... }`
     and read `{ parsed, meta }`.
   - Compare `parsed.requestType` to `expected_intent` and
     `meta.toolLoop.trace[].tool` to `expected_tools`.
3. **Write a pass/fail report.** JSON to stdout + a summary table. Plug
   into CI as a non-blocking job first; promote to blocking once the
   pass-rate stabilizes above 90%.
4. **Optional — score with `tool_call_efficiency`** and the other
   Phase 8.2 metrics. Aggregate across all cases per release.

The runner here is intentionally not coupled to a specific test framework
(vitest/playwright) so the eval infra can live as a standalone Node script
that a daily CI cron runs against staging. If a vitest harness ends up
making more sense in Phase 9, port the comparison helpers wholesale.

---

## TODOs (intentional, leave in until Phase 9 lands)

- `run-eval.ts` is a skeleton — real edge-function invocation, retry
  policy, timeout handling, and report formatting all need to be filled in.
- No real dataset is committed. `dataset.example.json` exists only to
  validate the shape contract.
- No CI wiring. Phase 9 should add a `npm run eval:context` script and a
  GitHub Action that runs it nightly against the staging environment.
- No metrics aggregation across cases — currently the contract is
  pass/fail per turn. Phase 9 should add the §8.2 metrics
  (`tool_call_efficiency`, `redundant_retrievals`, etc.) summarized over
  the full run.
