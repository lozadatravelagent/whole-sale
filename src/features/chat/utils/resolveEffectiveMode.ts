import type { ChatMode } from './deriveDefaultMode';

/**
 * C7.1.a: resolves the effective chat mode for a single `handleSendMessage`
 * invocation. The explicit `override` (from bridge chip handlers that just
 * called `setChatMode`) wins over the closure-captured `fallback` because
 * React's async setState can leave the closure with the pre-click mode.
 *
 * Kept as a dedicated pure helper (vs inline `??`) so the intent is
 * documented and regression-tested — the orchestrator strict-mode tests
 * don't cover the wiring itself.
 */
export function resolveEffectiveMode(
  override: ChatMode | undefined,
  fallback: ChatMode | undefined,
): ChatMode | undefined {
  return override ?? fallback;
}
