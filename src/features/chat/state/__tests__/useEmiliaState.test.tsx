// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';

// Mock persistence so the hook's effect-driven load resolves immediately
// to "no row" — preserving the prior test semantics that an unregistered
// id yields `{ state: null, isLoading: false }` after settling.
vi.mock('@/features/chat/state/persistence', () => ({
  loadEmiliaState: vi.fn(async () => null),
  saveEmiliaState: vi.fn(async () => undefined),
}));

import {
  useEmiliaState,
  useUpdateState,
  _registerEmiliaContext,
  _unregisterEmiliaContext,
  _resetEmiliaRegistry,
} from '@/features/chat/state/useEmiliaState';
import { RunContext } from '@/features/chat/state/runContext';
import {
  createInitialEmiliaState,
  type EmiliaState,
} from '@/features/chat/state/emiliaState';

function makeContext(conversationId: string, agencyId = 'ag-42'): RunContext<EmiliaState> {
  return new RunContext(createInitialEmiliaState({ conversationId, agencyId }));
}

beforeEach(() => {
  _resetEmiliaRegistry();
});

describe('useEmiliaState', () => {
  it('returns { state: null, isLoading: false } when conversationId is null', () => {
    const { result } = renderHook(() => useEmiliaState(null));
    expect(result.current).toEqual({ state: null, isLoading: false });
  });

  it('triggers async load on first mount; settles to { state: null, isLoading: false } when persistence has no row', async () => {
    const { result } = renderHook(() => useEmiliaState('does-not-exist'));
    // Initial render: load is in flight.
    expect(result.current.state).toBeNull();
    // After persistence resolves (mocked to null), isLoading flips to false.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.state).toBeNull();
  });

  it('returns the current state once a context is registered', () => {
    _registerEmiliaContext('conv-1', makeContext('conv-1'));
    const { result } = renderHook(() => useEmiliaState('conv-1'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.state).not.toBeNull();
    expect(result.current.state?.meta.conversation_id).toBe('conv-1');
  });

  it('re-renders when the registered context mutates', () => {
    const ctx = makeContext('conv-1');
    _registerEmiliaContext('conv-1', ctx);

    const { result } = renderHook(() => useEmiliaState('conv-1'));
    expect(result.current.state?.meta.turn_count).toBe(0);

    act(() => {
      ctx.mutateState((draft) => {
        draft.meta.turn_count = 7;
      });
    });

    expect(result.current.state?.meta.turn_count).toBe(7);
  });

  it('re-renders when a context is registered AFTER the hook first ran', () => {
    const { result } = renderHook(() => useEmiliaState('conv-late'));
    expect(result.current.state).toBeNull();

    act(() => {
      _registerEmiliaContext('conv-late', makeContext('conv-late'));
    });

    expect(result.current.state).not.toBeNull();
    expect(result.current.state?.meta.conversation_id).toBe('conv-late');
  });

  it('re-renders to null when a context is unregistered', () => {
    _registerEmiliaContext('conv-x', makeContext('conv-x'));
    const { result } = renderHook(() => useEmiliaState('conv-x'));
    expect(result.current.state).not.toBeNull();

    act(() => {
      _unregisterEmiliaContext('conv-x');
    });

    expect(result.current.state).toBeNull();
  });

  it('isolates state between conversation ids', () => {
    const ctxA = makeContext('conv-A');
    const ctxB = makeContext('conv-B');
    _registerEmiliaContext('conv-A', ctxA);
    _registerEmiliaContext('conv-B', ctxB);

    const { result: resA } = renderHook(() => useEmiliaState('conv-A'));
    const { result: resB } = renderHook(() => useEmiliaState('conv-B'));

    act(() => {
      ctxA.mutateState((d) => {
        d.meta.turn_count = 11;
      });
    });

    expect(resA.current.state?.meta.turn_count).toBe(11);
    expect(resB.current.state?.meta.turn_count).toBe(0);
  });

  it('switches state when conversationId changes via rerender', () => {
    _registerEmiliaContext('conv-A', makeContext('conv-A'));
    _registerEmiliaContext('conv-B', makeContext('conv-B'));

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useEmiliaState(id),
      { initialProps: { id: 'conv-A' } },
    );
    expect(result.current.state?.meta.conversation_id).toBe('conv-A');

    rerender({ id: 'conv-B' });
    expect(result.current.state?.meta.conversation_id).toBe('conv-B');
  });
});

describe('useUpdateState', () => {
  it('mutate is a no-op (resolves) when conversationId is null', async () => {
    const { result } = renderHook(() => useUpdateState(null));
    await expect(
      result.current.mutate((d) => {
        d.meta.turn_count = 1;
      }),
    ).resolves.toBeUndefined();
  });

  it('mutate is a no-op when no context is registered for the id', async () => {
    const { result } = renderHook(() => useUpdateState('ghost'));
    await expect(
      result.current.mutate((d) => {
        d.meta.turn_count = 1;
      }),
    ).resolves.toBeUndefined();
  });

  it('mutate updates the registered context and notifies readers', async () => {
    const ctx = makeContext('conv-1');
    _registerEmiliaContext('conv-1', ctx);

    const { result: readResult } = renderHook(() => useEmiliaState('conv-1'));
    const { result: writeResult } = renderHook(() => useUpdateState('conv-1'));

    await act(async () => {
      await writeResult.current.mutate((d) => {
        d.profile.preferences.budget_band = 'mid-high';
        d.meta.turn_count += 1;
      });
    });

    expect(readResult.current.state?.profile.preferences.budget_band).toBe('mid-high');
    expect(readResult.current.state?.meta.turn_count).toBe(1);
    // The underlying context reflects the same mutation.
    expect(ctx.getState().meta.turn_count).toBe(1);
  });

  it('returns a stable mutate identity for the same conversationId', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useUpdateState(id),
      { initialProps: { id: 'conv-1' as string | null } },
    );
    const firstMutate = result.current.mutate;
    rerender({ id: 'conv-1' });
    expect(result.current.mutate).toBe(firstMutate);
  });

  it('returns a new mutate identity when conversationId changes', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useUpdateState(id),
      { initialProps: { id: 'conv-1' as string | null } },
    );
    const firstMutate = result.current.mutate;
    rerender({ id: 'conv-2' });
    expect(result.current.mutate).not.toBe(firstMutate);
  });
});

describe('end-to-end: component reads via hook', () => {
  function TurnCount({ id }: { id: string }) {
    const { state } = useEmiliaState(id);
    return <span data-testid="turn">{state?.meta.turn_count ?? 'none'}</span>;
  }

  it('component re-renders when the underlying RunContext mutates', () => {
    const ctx = makeContext('conv-e2e');
    _registerEmiliaContext('conv-e2e', ctx);

    const { getByTestId } = render(<TurnCount id="conv-e2e" />);
    expect(getByTestId('turn').textContent).toBe('0');

    act(() => {
      ctx.mutateState((d) => {
        d.meta.turn_count = 3;
      });
    });

    expect(getByTestId('turn').textContent).toBe('3');
  });
});
