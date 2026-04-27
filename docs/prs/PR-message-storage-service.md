# Bloque B1 — Extract messageStorageService from useContextualMemory

## Context
Closes the last real Supabase leak from the layer audit (`docs/handoffs/auditoria-capas-2026-04-24.md`, Check 5). Establishes the storage-service pattern that C2 will replicate when decomposing `useMessageHandler`.

## Changes
- **New file** `src/features/chat/services/messageStorageService.ts` — 5 exported async functions for `messages` table operations (load/save/clear contextual memory + load/save context state).
- **Refactored** `src/features/chat/hooks/useContextualMemory.ts` — removed direct Supabase imports and 6 inline queries; now delegates to the service. API public idéntica, `ChatFeature.tsx` sin cambios.

## Decisions
- `saveContextState` keeps delete+insert as a single atomic operation inside the service (preserves current "replace context" semantics).
- 4 `as any` casts moved verbatim from hook to service (lines 29, 115, 116). None introduced by this refactor. Pending: type `messages.meta` properly — separate block, will be documented in `TECH_DEBT.md`.
- Debug `console.log` statements moved as-is. Cleanup deferred to a separate commit if desired.

## Verification
- `npx tsc --noEmit` → 0 errors
- `npm run lint` → 920 problems (897 errors / 23 warnings) — identical to pre-refactor baseline
- `npx eslint <touched files>` → 4 errors in service (inherited `as any`), 0 in hook
- `npm test` → 311 passed / 11 skipped / 0 failed
- `grep -ni "supabase" src/features/chat/hooks/useContextualMemory.ts` → empty
- `grep -rn "messageStorageService" src/` → single import from `useContextualMemory.ts`

## Out of scope
- Tests for the new service (no existing coverage of this hook; would be a separate testing block).
- `as any` cleanup (requires typing `messages.meta` shape — separate work).
- `useMessageHandler` decomposition (Block C2).

## Closes
Bloque B1 del plan post-auditoría (ver handoff de apertura).
