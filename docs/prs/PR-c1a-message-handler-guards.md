# PR #81 — test(c1a): guard/early-exit tests for useMessageHandler + factory

## Context
Bloque C1.a del plan post-auditoría (`docs/handoffs/c1-plan-paso-1.md`). Establece la infraestructura de tests para `useMessageHandler` (1957 líneas, 31 parámetros, 0 tests previos).

## Changes
- **New** `src/test-utils/useMessageHandlerFactory.ts` — `buildProps()`, `buildMessageRow()`, `buildParsedRequest()`. Factory compartida que C1.b y C1.c reutilizarán.
- **New** `src/features/chat/__tests__/useMessageHandler.test.ts` — 15 tests con `@vitest-environment jsdom` + `renderHook`.

## Tests added (15)
Guards/early-exits: empty message, whitespace, null conversationId, cheaper-flights shortcut (2), price-change shortcut. UI state: setIsLoading, setIsTyping, setMessage lifecycle. Error handling: toast on parse failure. missing_info_request case: response assembly, saveContextualMemory call. handlePlannerDateSelection: concrete dates, flexible month, null conversationId guard.

## Verification
- `npx tsc --noEmit` → 0 errors
- `npm test` → 326 passed / 11 skipped / 0 failed (+15 vs baseline 311)
- `npm run lint` → 920/897/23 — baseline sin cambio
- No production files modified

## Commits
- `416a8fc2` test(c1a): add useMessageHandlerFactory — 31-prop test fixture with vi.fn() defaults
- `b873c8fb` test(c1a): add 15 guard/early-exit tests for useMessageHandler

## Out of scope
- C1.b (COLLECT routing, iteration merge, preloadedContext) — separate PR, separate chat
- C1.c (execution switch: flights/hotels/combined/itinerary) — parallel to C1.b
