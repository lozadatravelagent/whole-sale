/**
 * toolChoicePolicy.ts
 * =============================================================================
 * Per-turn `tool_choice` resolver — implements OpenAI's `allowed_tools` /
 * forced-function pattern from the Function Calling guide.
 *
 * Rationale: passing all 8 tools every turn with implicit `tool_choice: "auto"`
 * gives the model too many choices and can lead to wrong tool selection. The
 * trick is to keep the FULL `tools` array (preserves prompt cache) but
 * RESTRICT which the model may pick via `tool_choice` per-turn.
 *
 * Two patterns are encoded here:
 * 1. **Forced function** when `discoveryIntentGuard` returns high-confidence
 *    `pattern_match` — the model MUST call `discover_places`. Replaces the
 *    reactive safety-net (which fires AFTER the model fails) with a proactive
 *    constraint.
 * 2. **`allowed_tools` subset** based on heuristics (hasPendingAction,
 *    hasActivePlanner) — restricts the model's choice to the relevant subset
 *    while keeping the FULL `tools` array intact in the request.
 *
 * Pure function. No side effects. Safe to call every turn.
 * =============================================================================
 */

import type { ToolChoice } from '@/features/chat/types/knowledge';
import type { DiscoveryGuardResult } from './discoveryIntentGuard';

export interface ToolChoiceContext {
  /** True when the planner workspace has a populated active plan. */
  hasActivePlanner: boolean;
  /** True when EmiliaState has a `pending_action` (mid-ask). */
  hasPendingAction: boolean;
  /** Result of `isDiscoveryQuery(currentMessage)`. */
  discoveryGuard: DiscoveryGuardResult;
}

const ALL_TOOLS = [
  'discover_places',
  'get_planner_state',
  'get_lead_full_history',
  'get_recent_searches',
  'save_memory_note',
  'apply_slot_values',
  'confirm_pending_action',
  'propose_planner_addition',
] as const;

type ToolName = (typeof ALL_TOOLS)[number];

function asAllowedTools(names: readonly ToolName[]): ToolChoice {
  return {
    type: 'allowed_tools',
    mode: 'auto',
    tools: names.map((name) => ({ type: 'function', name })),
  };
}

/**
 * Resolves the `tool_choice` for the current turn based on context signals.
 *
 * Precedence (highest first):
 *   1. discoveryGuard.pattern_match → force `discover_places`
 *   2. hasPendingAction              → restrict to slot/confirmation + retrieval
 *   3. hasActivePlanner              → exclude slot-resolution tools
 *   4. default                       → exclude slot/confirmation + planner-mutation
 *
 * Note: `vibe_browse` (a softer discovery signal) intentionally does NOT
 * force the tool — it falls through to the default branch where
 * `discover_places` is still allowed but not forced. Only `pattern_match`
 * (interrogative/browse-verb + concrete category noun) is high-confidence
 * enough to lock the model in.
 */
export function resolveToolChoice(ctx: ToolChoiceContext): ToolChoice {
  // 1. High-confidence discovery → force the discover_places tool.
  if (
    ctx.discoveryGuard.isDiscovery &&
    ctx.discoveryGuard.reason === 'pattern_match'
  ) {
    return { type: 'function', name: 'discover_places' };
  }

  // 2. Pending action active → restrict to resolution + retrieval. The model
  //    should answer the open question, not start new flows.
  if (ctx.hasPendingAction) {
    return asAllowedTools([
      'apply_slot_values',
      'confirm_pending_action',
      'get_planner_state',
      'get_lead_full_history',
    ]);
  }

  // 3. Active planner → slot/confirmation tools have no pending_action to
  //    operate on, so exclude them. propose_planner_addition stays valid for
  //    "add to plan" flows.
  if (ctx.hasActivePlanner) {
    return asAllowedTools(
      ALL_TOOLS.filter(
        (t) => t !== 'apply_slot_values' && t !== 'confirm_pending_action',
      ),
    );
  }

  // 4. Default — no planner, no pending. Exclude slot-resolution AND planner
  //    mutation: there's nothing to mutate and nothing to resolve. Retrieval +
  //    memory only.
  return asAllowedTools(
    ALL_TOOLS.filter(
      (t) =>
        t !== 'apply_slot_values' &&
        t !== 'confirm_pending_action' &&
        t !== 'propose_planner_addition',
    ),
  );
}
