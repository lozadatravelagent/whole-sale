/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

import {
  persistTurnIntentSnapshot,
  shouldPersistIntent,
} from '../turnIntentPersistence';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';

/**
 * Architectural guarantee under test:
 *
 *   Every turn that produces a parsed, *actionable* intent must persist that
 *   intent as the conversation's last-known-state, regardless of which
 *   execution branch (partial validation, mode_bridge, ask_minimal, search,
 *   error) handled the user-visible response.
 *
 *   This module is the single write point for that guarantee. The shape of
 *   "actionable" lives in `shouldPersistIntent`; the persistence flow lives in
 *   `persistTurnIntentSnapshot`. Both are pure or take their I/O as
 *   dependencies, so the rule is testable in isolation.
 */

function makeRequest(overrides: Partial<ParsedTravelRequest> = {}): ParsedTravelRequest {
  return {
    requestType: 'general',
    originalMessage: '',
    confidence: 0.9,
    ...overrides,
  } as ParsedTravelRequest;
}

describe('shouldPersistIntent', () => {
  it('returns false for a null or undefined parsed request', () => {
    expect(shouldPersistIntent(null)).toBe(false);
    expect(shouldPersistIntent(undefined)).toBe(false);
  });

  it('returns false for non-actionable conversation types', () => {
    expect(shouldPersistIntent(makeRequest({ requestType: 'general' }))).toBe(false);
    expect(shouldPersistIntent(makeRequest({ requestType: 'missing_info_request' as any }))).toBe(false);
  });

  it('returns true for a flights request with at least a destination', () => {
    expect(
      shouldPersistIntent(
        makeRequest({ requestType: 'flights', flights: { destination: 'MAD' } as any }),
      ),
    ).toBe(true);
  });

  it('returns false for a flights request with no slot data', () => {
    expect(
      shouldPersistIntent(makeRequest({ requestType: 'flights' })),
    ).toBe(false);
  });

  it('returns true for a hotels request with a city slot', () => {
    expect(
      shouldPersistIntent(
        makeRequest({ requestType: 'hotels', hotels: { city: 'Madrid' } as any }),
      ),
    ).toBe(true);
  });

  it('returns true for a combined request even when one product is incomplete (partial-flow case)', () => {
    // This is the core bug case: the validation gate ran hotels alone, but
    // the user's full intent was combined. Persisting this snapshot is what
    // lets turn N+1 resolve "esa fecha" / "los vuelos" against turn N.
    expect(
      shouldPersistIntent(
        makeRequest({
          requestType: 'combined',
          flights: { destination: 'MAD', origin: undefined } as any, // missing origin
          hotels: { city: 'Madrid', checkinDate: '2026-05-23', checkoutDate: '2026-05-30' } as any,
        }),
      ),
    ).toBe(true);
  });

  it('returns false for a combined request with both product slots empty', () => {
    expect(
      shouldPersistIntent(makeRequest({ requestType: 'combined' })),
    ).toBe(false);
  });

  it('returns true for an itinerary request with at least one destination', () => {
    expect(
      shouldPersistIntent(
        makeRequest({
          requestType: 'itinerary',
          itinerary: { destinations: ['Madrid'] } as any,
        }),
      ),
    ).toBe(true);
  });

  it('returns false for an itinerary request with no destinations', () => {
    expect(
      shouldPersistIntent(
        makeRequest({ requestType: 'itinerary', itinerary: { destinations: [] } as any }),
      ),
    ).toBe(false);
  });

  it('returns true for packages and services request types (less structured slots)', () => {
    expect(shouldPersistIntent(makeRequest({ requestType: 'packages' }))).toBe(true);
    expect(shouldPersistIntent(makeRequest({ requestType: 'services' }))).toBe(true);
  });
});

describe('persistTurnIntentSnapshot', () => {
  it('calls saveContextualMemory once with the parsed request when intent is actionable', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const parsed = makeRequest({
      requestType: 'combined',
      flights: { destination: 'MAD' } as any,
      hotels: { city: 'Madrid' } as any,
    });

    const result = await persistTurnIntentSnapshot('conv-1', parsed, save);

    expect(result.persisted).toBe(true);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith('conv-1', parsed);
  });

  it('skips persistence when the parsed request is null', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const result = await persistTurnIntentSnapshot('conv-1', null, save);

    expect(result.persisted).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('skips persistence when the conversation id is empty', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const parsed = makeRequest({
      requestType: 'flights',
      flights: { destination: 'MAD' } as any,
    });

    const result = await persistTurnIntentSnapshot('', parsed, save);

    expect(result.persisted).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('skips persistence when the parsed request is non-actionable', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const parsed = makeRequest({ requestType: 'general' });

    const result = await persistTurnIntentSnapshot('conv-1', parsed, save);

    expect(result.persisted).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('swallows persistence errors so a failed write never breaks the turn', async () => {
    const save = vi.fn().mockRejectedValue(new Error('db down'));
    const parsed = makeRequest({
      requestType: 'flights',
      flights: { destination: 'MAD' } as any,
    });

    const result = await persistTurnIntentSnapshot('conv-1', parsed, save);

    expect(result.persisted).toBe(false);
    expect(save).toHaveBeenCalledOnce();
  });
});
