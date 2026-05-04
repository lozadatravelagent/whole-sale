/**
 * toolChoicePolicy.test.ts
 * =============================================================================
 * Verifies that `resolveToolChoice` returns the correct OpenAI `tool_choice`
 * directive for each combination of context signals.
 *
 * Precedence (per the policy):
 *   1. discoveryGuard.pattern_match → force discover_places
 *   2. hasPendingAction              → restrict to slot/confirmation + retrieval
 *   3. hasActivePlanner              → exclude slot-resolution tools
 *   4. default                       → exclude slot/confirmation + planner-mutation
 * =============================================================================
 */

import { describe, expect, it } from 'vitest';

import { resolveToolChoice, type ToolChoiceContext } from '../toolChoicePolicy';
import type { DiscoveryGuardResult } from '../discoveryIntentGuard';

const NO_DISCOVERY: DiscoveryGuardResult = { isDiscovery: false, reason: 'no_match' };
const PATTERN_MATCH: DiscoveryGuardResult = { isDiscovery: true, reason: 'pattern_match' };
const VIBE_BROWSE: DiscoveryGuardResult = { isDiscovery: true, reason: 'vibe_browse' };

function makeCtx(over: Partial<ToolChoiceContext> = {}): ToolChoiceContext {
  return {
    hasActivePlanner: false,
    hasPendingAction: false,
    discoveryGuard: NO_DISCOVERY,
    ...over,
  };
}

describe('resolveToolChoice', () => {
  describe('priority 1 — high-confidence discovery', () => {
    it('forces discover_places on pattern_match (regardless of other signals)', () => {
      const result = resolveToolChoice(makeCtx({ discoveryGuard: PATTERN_MATCH }));
      expect(result).toEqual({ type: 'function', name: 'discover_places' });
    });

    it('forces discover_places even with active planner (precedence)', () => {
      const result = resolveToolChoice(makeCtx({
        hasActivePlanner: true,
        discoveryGuard: PATTERN_MATCH,
      }));
      expect(result).toEqual({ type: 'function', name: 'discover_places' });
    });

    it('does NOT force on vibe_browse — falls through to next branch', () => {
      const result = resolveToolChoice(makeCtx({ discoveryGuard: VIBE_BROWSE }));
      expect(typeof result).toBe('object');
      if (typeof result === 'object' && 'type' in result) {
        expect(result.type).toBe('allowed_tools');
      }
    });
  });

  describe('priority 2 — pending action', () => {
    it('restricts to slot/confirmation + retrieval when pending action active', () => {
      const result = resolveToolChoice(makeCtx({ hasPendingAction: true }));
      expect(result).toMatchObject({
        type: 'allowed_tools',
        mode: 'auto',
      });
      if (typeof result === 'object' && result.type === 'allowed_tools') {
        const names = result.tools.map(t => t.name).sort();
        expect(names).toEqual([
          'apply_slot_values',
          'confirm_pending_action',
          'get_lead_full_history',
          'get_planner_state',
        ]);
      }
    });
  });

  describe('priority 3 — active planner', () => {
    it('excludes slot/confirmation tools when planner active without pending', () => {
      const result = resolveToolChoice(makeCtx({ hasActivePlanner: true }));
      expect(result).toMatchObject({ type: 'allowed_tools', mode: 'auto' });
      if (typeof result === 'object' && result.type === 'allowed_tools') {
        const names = result.tools.map(t => t.name);
        expect(names).not.toContain('apply_slot_values');
        expect(names).not.toContain('confirm_pending_action');
        expect(names).toContain('discover_places');
        expect(names).toContain('propose_planner_addition');
      }
    });
  });

  describe('priority 4 — default (no planner, no pending)', () => {
    it('excludes slot, confirmation, AND planner-mutation tools', () => {
      const result = resolveToolChoice(makeCtx());
      expect(result).toMatchObject({ type: 'allowed_tools', mode: 'auto' });
      if (typeof result === 'object' && result.type === 'allowed_tools') {
        const names = result.tools.map(t => t.name).sort();
        expect(names).toEqual([
          'discover_places',
          'get_lead_full_history',
          'get_planner_state',
          'get_recent_searches',
          'save_memory_note',
        ]);
      }
    });
  });

  describe('return shape integrity', () => {
    it('every allowed_tools entry has type=function and a name', () => {
      const ctxs: ToolChoiceContext[] = [
        makeCtx(),
        makeCtx({ hasActivePlanner: true }),
        makeCtx({ hasPendingAction: true }),
      ];
      for (const ctx of ctxs) {
        const result = resolveToolChoice(ctx);
        if (typeof result === 'object' && result.type === 'allowed_tools') {
          for (const tool of result.tools) {
            expect(tool.type).toBe('function');
            expect(typeof tool.name).toBe('string');
            expect(tool.name.length).toBeGreaterThan(0);
          }
        }
      }
    });
  });
});
