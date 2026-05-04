/**
 * Tests for telemetry helpers (Phase 8.4).
 *
 * Covers:
 *   - countRedundantCalls correctly counts repeats of (tool, args)
 *   - emitTelemetry writes a single structured line per event
 *   - event payload shape is preserved (no field drops, no field renames)
 *
 * Spec: docs/architecture/context-engineering-spec.md (Phase 8 telemetry)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  countRedundantCalls,
  emitTelemetry,
  type CtxMemoryEvent,
  type CtxStateEvent,
  type CtxToolEvent,
} from '../telemetry.ts';

// ---------------------------------------------------------------------------
// countRedundantCalls
// ---------------------------------------------------------------------------

describe('countRedundantCalls', () => {
  it('returns 0 for an empty trace', () => {
    expect(countRedundantCalls([])).toBe(0);
  });

  it('returns 0 when every (tool, args) pair is unique', () => {
    const trace = [
      { tool: 'get_planner_state', args: { planner_id: 'p1' } },
      { tool: 'get_planner_state', args: { planner_id: 'p2' } },
      { tool: 'get_quote', args: { quote_id: 'q1' } },
    ];
    expect(countRedundantCalls(trace)).toBe(0);
  });

  it('counts repeats of the same (tool, args) pair', () => {
    const trace = [
      { tool: 'get_planner_state', args: { planner_id: 'p1' } },
      { tool: 'get_planner_state', args: { planner_id: 'p1' } }, // dup #1
      { tool: 'get_planner_state', args: { planner_id: 'p1' } }, // dup #2
    ];
    expect(countRedundantCalls(trace)).toBe(2);
  });

  it('treats different tools with same args as distinct', () => {
    const trace = [
      { tool: 'get_planner_state', args: { id: 'a' } },
      { tool: 'get_quote', args: { id: 'a' } },
    ];
    expect(countRedundantCalls(trace)).toBe(0);
  });

  it('treats different args of same tool as distinct', () => {
    const trace = [
      { tool: 'get_recent_searches', args: { limit: 3, kind: 'hotels' } },
      { tool: 'get_recent_searches', args: { limit: 5, kind: 'hotels' } },
      { tool: 'get_recent_searches', args: { limit: 3, kind: 'hotels' } }, // dup of first
    ];
    expect(countRedundantCalls(trace)).toBe(1);
  });

  it('handles null/undefined args without throwing', () => {
    const trace = [
      { tool: 'noop', args: null },
      { tool: 'noop', args: undefined },
      { tool: 'noop', args: null }, // dup of first
    ];
    // null and undefined both serialize to null → second is dup of first,
    // and the third is dup again. Total 2 dups.
    expect(countRedundantCalls(trace)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// emitTelemetry — shape preservation
// ---------------------------------------------------------------------------

describe('emitTelemetry', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('writes a CTX-STATE event with the category prefix', () => {
    const event: CtxStateEvent = {
      category: 'CTX-STATE',
      conversation_id: 'conv-1',
      agency_id: 'ag-1',
      turn_count: 3,
      profile_tokens: 120,
      global_notes_count: 4,
      session_notes_count: 1,
      active_refs_count: 2,
      mode: 'agency',
    };

    emitTelemetry(event);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [prefix, jsonStr] = logSpy.mock.calls[0] as [string, string];
    expect(prefix).toBe('[CTX-STATE]');
    const parsed = JSON.parse(jsonStr);
    expect(parsed).toEqual(event);
  });

  it('writes a CTX-TOOL event preserving every field', () => {
    const event: CtxToolEvent = {
      category: 'CTX-TOOL',
      conversation_id: 'conv-1',
      agency_id: 'ag-1',
      iterations: 2,
      tools_called: ['get_planner_state', 'get_quote'],
      errors_count: 0,
      hit_cap: false,
      hit_timeout: false,
      prompt_tokens: 1200,
      completion_tokens: 380,
      cached_tokens: 800,
      redundant_calls: 0,
    };

    emitTelemetry(event);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [prefix, jsonStr] = logSpy.mock.calls[0] as [string, string];
    expect(prefix).toBe('[CTX-TOOL]');
    expect(JSON.parse(jsonStr)).toEqual(event);
  });

  it('writes a CTX-MEMORY event preserving rejection_reasons map', () => {
    const event: CtxMemoryEvent = {
      category: 'CTX-MEMORY',
      conversation_id: 'conv-1',
      agency_id: 'ag-1',
      attempted: 3,
      accepted: 1,
      rejected: 2,
      rejection_reasons: { speculation: 1, too_long: 1 },
    };

    emitTelemetry(event);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [prefix, jsonStr] = logSpy.mock.calls[0] as [string, string];
    expect(prefix).toBe('[CTX-MEMORY]');
    const parsed = JSON.parse(jsonStr);
    expect(parsed).toEqual(event);
    expect(parsed.rejection_reasons.speculation).toBe(1);
    expect(parsed.rejection_reasons.too_long).toBe(1);
  });

  it('does not mutate the event passed in', () => {
    const event: CtxToolEvent = {
      category: 'CTX-TOOL',
      conversation_id: 'conv-1',
      agency_id: 'ag-1',
      iterations: 1,
      tools_called: ['get_quote'],
      errors_count: 0,
      hit_cap: false,
      hit_timeout: false,
      prompt_tokens: 0,
      completion_tokens: 0,
      cached_tokens: 0,
      redundant_calls: 0,
    };
    const snapshot = JSON.stringify(event);

    emitTelemetry(event);

    expect(JSON.stringify(event)).toBe(snapshot);
  });
});

// ---------------------------------------------------------------------------
// emitTelemetry — CTX-TOKEN-BUDGET threshold warning
// ---------------------------------------------------------------------------

describe('emitTelemetry — CTX-TOKEN-BUDGET threshold', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('does NOT emit CTX-TOKEN-BUDGET when prompt_tokens is below threshold', () => {
    const event: CtxToolEvent = {
      category: 'CTX-TOOL',
      conversation_id: 'conv-1',
      agency_id: 'ag-1',
      iterations: 2,
      tools_called: ['get_planner_state'],
      errors_count: 0,
      hit_cap: false,
      hit_timeout: false,
      prompt_tokens: 4500, // typical steady-state, well below 8000
      completion_tokens: 380,
      cached_tokens: 3000,
      redundant_calls: 0,
    };

    emitTelemetry(event);

    // CTX-TOOL itself still fires
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toBe('[CTX-TOOL]');
    // No warning
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does NOT emit CTX-TOKEN-BUDGET at exactly the threshold (boundary)', () => {
    const event: CtxToolEvent = {
      category: 'CTX-TOOL',
      conversation_id: 'conv-1',
      agency_id: 'ag-1',
      iterations: 1,
      tools_called: [],
      errors_count: 0,
      hit_cap: false,
      hit_timeout: false,
      prompt_tokens: 8000, // exactly threshold — strictly greater required
      completion_tokens: 100,
      cached_tokens: 0,
      redundant_calls: 0,
    };

    emitTelemetry(event);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('emits CTX-TOKEN-BUDGET warning when prompt_tokens exceeds threshold', () => {
    const event: CtxToolEvent = {
      category: 'CTX-TOOL',
      conversation_id: 'conv-bloat',
      agency_id: 'ag-7',
      iterations: 4,
      tools_called: ['get_planner_state', 'discover_places', 'get_quote'],
      errors_count: 0,
      hit_cap: false,
      hit_timeout: false,
      prompt_tokens: 12500, // bloat — above 8000
      completion_tokens: 600,
      cached_tokens: 4000,
      redundant_calls: 0,
    };

    emitTelemetry(event);

    // CTX-TOOL still emits, unchanged shape
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toBe('[CTX-TOOL]');
    expect(JSON.parse(logSpy.mock.calls[0][1] as string)).toEqual(event);

    // Warning fires exactly once
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warnArg = warnSpy.mock.calls[0][0] as string;
    expect(warnArg).toMatch(/^\[CTX-TOKEN-BUDGET\] /);

    // Parse the JSON body that follows the prefix
    const jsonBody = warnArg.slice('[CTX-TOKEN-BUDGET] '.length);
    const parsed = JSON.parse(jsonBody);
    expect(parsed).toEqual({
      conversation_id: 'conv-bloat',
      agency_id: 'ag-7',
      prompt_tokens: 12500,
      threshold: 8000,
      iterations: 4,
      tools_called: ['get_planner_state', 'discover_places', 'get_quote'],
      cached_tokens: 4000,
    });
  });

  it('does NOT emit CTX-TOKEN-BUDGET for non-CTX-TOOL events even with high token-like fields', () => {
    // CTX-STATE has profile_tokens (similar field name), but the threshold
    // check must be CTX-TOOL only.
    const event: CtxStateEvent = {
      category: 'CTX-STATE',
      conversation_id: 'conv-1',
      agency_id: 'ag-1',
      turn_count: 3,
      profile_tokens: 99999, // huge but irrelevant — different field, different event
      global_notes_count: 4,
      session_notes_count: 1,
      active_refs_count: 2,
      mode: 'agency',
    };

    emitTelemetry(event);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
