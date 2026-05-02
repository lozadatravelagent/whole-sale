/**
 * lifecycleHooks — Phase 2.4 (Context Engineering).
 *
 * Pure implementation of the three hook points wired by `runEmiliaTurn(...)`
 * in the Phase 3 tool-loop runner.
 *
 *   onTurnStart  → renderState into systemPromptAddition
 *   onTurnEnd    → bookkeeping + re-injection flag
 *   onSessionEnd → consolidate session memory into global memory
 *
 * Spec: docs/architecture/context-engineering-spec.md §6
 *
 * The implementation is pure: no I/O, no globals. Persistence is the caller's
 * responsibility (the runner calls `saveEmiliaState(state)` AFTER each hook
 * returns). Hooks receive the current state and return a NEW state — they
 * never mutate the input.
 */

import type { EmiliaState } from './emiliaStateTypes.ts';
import { renderStateForSystemPrompt } from './renderState.ts';
import {
  consolidateMemory,
  type ConsolidateOpenAiClient,
} from './consolidateMemory.ts';

/**
 * Default trigger threshold for `onSessionEnd` consolidation when called as a
 * "every N turns" fallback rather than an explicit close. Documented in §6.3.
 */
export const DEFAULT_CONSOLIDATE_EVERY_N_TURNS = 20;

export interface OnTurnStartResult {
  /** Block to append to the system prompt, AFTER the base prompt. */
  systemPromptAddition: string;
}

export interface OnTurnEndInfo {
  /** Number of `save_memory_note` tool calls accepted this turn. */
  savedNotes: number;
  /**
   * Whether the session-trim that runs at end-of-turn will drop a turn that
   * contained one of the `savedNotes` calls. When true, the next turn must
   * re-inject session memory inline so the model does not lose them.
   */
  willDropSavedNotes?: boolean;
}

export interface LifecycleHooks {
  onTurnStart(state: EmiliaState): OnTurnStartResult;
  onTurnEnd(state: EmiliaState, response: OnTurnEndInfo): EmiliaState;
  onSessionEnd(state: EmiliaState, openaiClient: ConsolidateOpenAiClient): Promise<EmiliaState>;
}

/**
 * Stateless implementation of the lifecycle hook contract. Safe to share
 * across conversations (it carries no per-conversation state).
 */
export function createLifecycleHooks(): LifecycleHooks {
  return {
    /**
     * Render the state-injection block. Side-effect-free: the runner is
     * responsible for incrementing turn_count via `onTurnEnd`.
     */
    onTurnStart(state: EmiliaState): OnTurnStartResult {
      const systemPromptAddition = renderStateForSystemPrompt(state);
      return { systemPromptAddition };
    },

    /**
     * Bookkeeping after the model + tool calls finish for this turn.
     *
     * 1. Increment `meta.turn_count`.
     * 2. If notes were saved this turn AND the session would drop the turn
     *    holding them on its next trim, set `inject_session_memories_next_turn`
     *    so the next render keeps the model aware.
     * 3. If we just rendered with the flag set, the renderer already used it;
     *    we now clear it for the next turn UNLESS it has been re-set above.
     */
    onTurnEnd(state: EmiliaState, response: OnTurnEndInfo): EmiliaState {
      const next: EmiliaState = {
        ...state,
        meta: {
          ...state.meta,
          turn_count: (state.meta.turn_count ?? 0) + 1,
        },
      };

      // The renderer consumes the flag — clear it post-turn so it does not
      // re-fire forever. The runner is responsible for setting it again on
      // the very turn that needs it (see step 2 below).
      next.inject_session_memories_next_turn = false;

      if (response.savedNotes > 0 && response.willDropSavedNotes) {
        next.inject_session_memories_next_turn = true;
      }

      return next;
    },

    /**
     * Run consolidation. Safe to call at any time; if it fails, the original
     * state is returned unchanged (`consolidateMemory` swallows errors).
     */
    async onSessionEnd(
      state: EmiliaState,
      openaiClient: ConsolidateOpenAiClient,
    ): Promise<EmiliaState> {
      return await consolidateMemory(state, openaiClient);
    },
  };
}

/**
 * Convenience: should `onSessionEnd` fire as a fallback this turn?
 *
 * Returns true when `state.meta.turn_count` is a positive multiple of
 * `everyN` (default 20). The runner calls this AFTER `onTurnEnd` so the
 * comparison is against the post-increment count.
 */
export function shouldConsolidateNow(
  state: EmiliaState,
  everyN: number = DEFAULT_CONSOLIDATE_EVERY_N_TURNS,
): boolean {
  const n = state.meta?.turn_count ?? 0;
  return n > 0 && n % everyN === 0;
}
