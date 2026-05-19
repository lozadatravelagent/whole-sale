# Legacy Intent Gate Registry — Design Spec

**Date:** 2026-05-19
**Status:** Approved (pending spec review)
**Author:** Fran + Claude

## Problem

`useMessageHandler.ts` runs three legacy client-side regex intent gates
~700 lines *before* the Emilia pipeline (parser → router → orchestrator →
Context Engineering layer). Two of the three fire on regex shape alone,
without checking whether the resource they operate on actually exists,
short-circuiting Emilia:

| Gate | Line (pre-change) | Real precondition | Current behavior when precondition unmet |
|---|---|---|---|
| `isCheaperFlightRequest` | 740 | Analyzed PDF with flights | No guard. User message swallowed, **no response at all** |
| `isAddHotelRequest` | 821 | Flight context exists | ✅ Checks precondition → **falls through to Emilia** (the correct pattern, already present) |
| `isPriceChangeRequest` | 918 | Analyzed PDF | No guard. Dead-ends with `❌ No hay PDF analizado` |

### Reproduction (the reported bug)

User conversation, **no PDF ever uploaded**:

1. "quiero un vuelo a cancun" → Emilia returns flight results (works).
2. "vuelo a CUN del 2026-05-22 al 2026-05-29 saliendo desde Buenos Aires
   para 2 adulto" → `❌ No hay PDF analizado`.

An unambiguous flight search was hijacked into the PDF price-change flow.

### Root cause (two conspiring defects)

`normalizeText` preserves hyphens. The normalized message is:
`vuelo a cun del 2026-05-22 al 2026-05-29 saliendo desde buenos aires para 2 adulto`

1. **Defect 1 — broken matcher.** `intentDetection.ts` pattern
   `/-\s*\$?\s*(\d+)/` (relative price decrease, e.g. "-300") has no left
   boundary, so it matches the hyphen inside ISO dates: `2026-05-22` → `-05`.
   **Any message containing a `YYYY-MM-DD` date becomes a price-change
   candidate.**
2. **Defect 2 — weak exclusion.** `isSearchRequest` fails to rescue obvious
   searches: it requires a single-word origin between "desde" and
   "a/para/hasta" ("desde **buenos aires** para" is two words → no match) and
   an explicit search verb (`buscar|quiero|necesito|ver`) that this message
   lacks (starts "vuelo a cun").

Net: `hasValidPattern` (Defect 1) + `hasNumber` (the dates) +
`isSearchRequest === false` (Defect 2) → `isPriceChangeRequest` returns
`true` → PDF branch → no PDF → dead-end.

The no-PDF dead-end is one failure mode; the date-hyphen misclassification
is a second, independent latent failure mode (would misroute even with a
PDF present).

## Goals

- Architectural, not point fix: a uniform, ordered, testable structure for
  the pre-Emilia legacy gates, generalizing the precondition-guard pattern
  that `isAddHotelRequest` already implements.
- Fix the objectively broken regex matcher (defense-in-depth: correct
  matcher *and* precondition guard).
- Zero behavior change for flows whose precondition is satisfied.
- Router / orchestrator / Context Engineering layer untouched.

## Non-Goals

- Inverting control so Emilia parses first and legacy handlers run
  post-parse (larger blast radius, ADR-worthy, deferred).
- Refactoring the internal message/UI lifecycle inside each legacy handler
  (`run`) — out of scope; changing it risks drift in flows we are not fixing.
- Any change to `routeRequest`, `conversationOrchestrator`, or the CE layer.

## Decisions (frozen)

- **Scope:** formal registry/dispatcher — extract the if-chain into a
  declarative testable module with explicit order.
- **Precondition-fail behavior:** silent fall-through to Emilia, uniform
  across gates (same as `isAddHotelRequest` today). No intermediate message.
- **Regex defect:** fixed as part of this work, as a **separate commit**.

## Architecture

New module: `src/features/chat/services/legacyIntentGates.ts`. Single
responsibility: decide whether a message is handled by a pre-Emilia legacy
flow, and which.

```
useMessageHandler ─► runLegacyIntentGates(message, ctx) ─► 'handled' | 'fallthrough'
                              │
                              ├─ gate[0] cheaper_flights { matches, precondition, run }
                              ├─ gate[1] add_hotel       { matches, precondition, run }
                              └─ gate[2] price_change    { matches, precondition, run }
```

`useMessageHandler` integration point replaces the ~180-line if-chain
(current lines ~739–918) with:

```ts
if (await runLegacyIntentGates(currentMessage, gateCtx) === 'handled') return;
// …unchanged: Emilia pipeline (parseMessageWithAIStreaming → routeRequest → resolveConversationTurn)
```

### Gate contract

```ts
interface LegacyIntentGate {
  name: 'cheaper_flights' | 'add_hotel' | 'price_change';
  matches(message: string): boolean;                          // existing regex from intentDetection.ts
  precondition(ctx: GateContext): boolean | Promise<boolean>; // false ⇒ continue to next gate
  run(ctx: GateContext): Promise<void>;                       // existing handler body, I/O unchanged
}
```

### Runner semantics

Iterate gates in declared order (`cheaper_flights` → `add_hotel` →
`price_change`, preserving today's order):

1. For each gate, if `matches(message)` is false → next gate.
2. If `matches` is true, evaluate `precondition(ctx)`:
   - `false` → **continue to the next gate** (do not short-circuit; do not
     emit any message). This makes fall-through uniform and silent.
   - `true` → `await run(ctx)`; return `'handled'`.
3. No gate handled → return `'fallthrough'`.

Rationale for "continue to next gate" rather than "stop on first match":
today only `add_hotel` falls through when its precondition is unmet;
`cheaper_flights` and `price_change` instead `return` (swallowed message /
dead-end). "Continue to next gate" generalizes `add_hotel`'s correct
behavior to all three and yields the agreed uniform silent fall-through.
This is the one intended behavior change; flows with a satisfied
precondition are unaffected.

### Precondition sources (all cheap)

- `cheaper_flights`: `lastPdfAnalysis?.conversationId === conversationId`
  (React state from `usePdfAnalysis`, synchronous).
- `price_change`: same `lastPdfAnalysis` check (mirrors the existing
  `handlePriceChangeRequest` null-guard at `usePdfAnalysis.ts:322`).
- `add_hotel`:
  `!!(await loadContextState(conversationId))?.lastSearch?.flightsParams`
  — the async check already performed today at `useMessageHandler.ts:823–826`,
  moved verbatim.

### GateContext

Bundles only what the existing `run` bodies already use — pure plumbing, no
new logic:

`conversationId`, `lastPdfAnalysis`, `handlePriceChangeRequest`,
`handleCheaperFlightsSearch`, `loadContextState`, `saveAndDisplayMessage`,
`addOptimisticMessage`, `setIsLoading`, `setIsTyping`, `setTypingMessage`,
`setMessage`, `typingCopy`.

## Regex defect fix (separate commit, same plan)

In `src/features/chat/utils/intentDetection.ts`:

1. **Anchor relative operators.** `/-\s*\$?\s*(\d+)/` and
   `/\+\s*\$?\s*(\d+)/` → add a left guard so the operator is not preceded
   by a digit or hyphen (e.g. lookbehind `(?<![\d-])`). Result: stops
   matching `2026-05-22`; still matches standalone "-300" / "+500".
2. **Strengthen `isSearchRequest` exclusion.**
   - Accept multi-word origin: `desde [\w\s]+? (a|para|hasta)` (so
     "desde Buenos Aires para" is recognized as a search).
   - Treat an ISO date range (`\d{4}-\d{2}-\d{2}` … `\d{4}-\d{2}-\d{2}`) as
     a search signal that excludes price-change classification.

These two are the minimal correctness fixes; they do not loosen detection
of genuine price-change phrasing (distinct from the rejected "require
explicit 'del PDF'" symptom patch).

## Testing

TDD — each test red first. Two independently-tested commits.

- **`legacyIntentGates.test.ts`** (new): per gate, the `matches × precondition`
  matrix → `handled` / `fallthrough`; declared evaluation order; the real
  bug message *"vuelo a CUN del 2026-05-22 al 2026-05-29 saliendo desde
  Buenos Aires para 2 adulto"* with no PDF ⇒ `fallthrough`; with a matching
  PDF present ⇒ corresponding gate `handled`.
- **`intentDetection.test.ts`** (extend existing): the real message ⇒
  `isPriceChangeRequest === false`; regression "-300" / "+500" still
  `true`; ISO dates never match the relative-operator patterns;
  "buscar vuelo desde Buenos Aires a Madrid" excluded by `isSearchRequest`.
- **`useMessageHandler.test.ts`** (existing): must stay green unchanged —
  evidence that legacy flows with a satisfied precondition behave exactly
  as before.

Commit split:
1. Regex defect fix + `intentDetection.test.ts` additions.
2. `legacyIntentGates.ts` registry + runner + integration + its test;
   ~180-line if-chain removed from `useMessageHandler.ts`.

## Risk & rollout

- Blast radius: 1 new module, ~180 lines removed from `useMessageHandler.ts`,
  2 regex edits in `intentDetection.ts`.
- `add_hotel` moves into the registry with **no functional change** (already
  had the precondition pattern).
- `cheaper_flights` and `price_change` *gain* a precondition; the only
  behavior change is the intended one (no-precondition → fall through to
  Emilia instead of dead-end / swallowed message).
- Router / orchestrator / CE layer untouched.
- Rollback: `git revert` the two commits.

## Open questions

None. Decisions frozen above.
