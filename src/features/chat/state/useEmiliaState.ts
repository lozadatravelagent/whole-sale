/**
 * useEmiliaState / useUpdateState — React hooks over a global per-conversation
 * `RunContext<EmiliaState>` registry.
 *
 * Spec: docs/architecture/context-engineering-spec.md §1 / §6
 *
 * Design notes:
 * - The task brief mentioned zustand, but zustand is NOT in package.json and
 *   we are not allowed to add new deps. We get the same React-store ergonomics
 *   from the built-in `useSyncExternalStore` (React 18) over a tiny module-level
 *   registry. Zero new dependencies, identical observable semantics.
 * - The registry is a `Map<conversationId, RunContext<EmiliaState>>`. Reads
 *   that miss the registry return `{ state: null, isLoading: false }` for now.
 *   Wiring to async DB load + persistence is the OTHER half of Phase 1.
 * - All hooks are `conversationId`-scoped. Switching conversations is just a
 *   re-render with a new id; no manual cleanup needed.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { RunContext } from '@/features/chat/state/runContext';
import type { EmiliaState } from '@/features/chat/state/emiliaState';
import { loadEmiliaState, saveEmiliaState } from '@/features/chat/state/persistence';

// ---------------------------------------------------------------------------
// Module-level registry + listener fan-out
// ---------------------------------------------------------------------------

type RegistryListener = () => void;

const contextRegistry: Map<string, RunContext<EmiliaState>> = new Map();
const registryListeners: Set<RegistryListener> = new Set();
/**
 * Per-conversation listener buckets. Lets us invalidate consumers of a single
 * conversation without waking up every other subscriber.
 */
const stateListeners: Map<string, Set<RegistryListener>> = new Map();

/**
 * In-flight loads per conversationId. Prevents duplicate fetches when multiple
 * consumers mount simultaneously for the same conversation.
 */
const inFlightLoads: Map<string, Promise<void>> = new Map();

function subscribeRegistry(listener: RegistryListener): () => void {
  registryListeners.add(listener);
  return () => {
    registryListeners.delete(listener);
  };
}

function subscribeState(conversationId: string, listener: RegistryListener): () => void {
  let bucket = stateListeners.get(conversationId);
  if (!bucket) {
    bucket = new Set();
    stateListeners.set(conversationId, bucket);
  }
  bucket.add(listener);
  return () => {
    const current = stateListeners.get(conversationId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      stateListeners.delete(conversationId);
    }
  };
}

function notifyRegistry(): void {
  for (const l of Array.from(registryListeners)) l();
}

function notifyState(conversationId: string): void {
  const bucket = stateListeners.get(conversationId);
  if (!bucket) return;
  for (const l of Array.from(bucket)) l();
}

/**
 * Internal: register a `RunContext` for a conversation. Bridges the
 * RunContext's own subscribe API into our React fan-out so every mutate
 * triggers a re-render of consumers of THIS conversation.
 *
 * Exported for tests and for the persistence layer (Phase 1.3) to install
 * a freshly-loaded state. Not part of the React surface.
 */
export function _registerEmiliaContext(
  conversationId: string,
  ctx: RunContext<EmiliaState>,
): void {
  contextRegistry.set(conversationId, ctx);
  // Bridge mutations into our notify channel. We never unsubscribe — the
  // RunContext lifecycle matches the registry entry; if the entry is removed
  // the context is GC-eligible along with its subscriber list.
  ctx.subscribe(() => notifyState(conversationId));
  notifyRegistry();
  notifyState(conversationId);
}

/**
 * Internal: drop a conversation from the registry. Exposed for tests and
 * future eviction logic. Does not currently fire on conversation close — the
 * persistence layer will own that.
 */
export function _unregisterEmiliaContext(conversationId: string): void {
  if (!contextRegistry.delete(conversationId)) return;
  notifyRegistry();
  notifyState(conversationId);
}

/**
 * Internal: full reset. ONLY for tests.
 */
export function _resetEmiliaRegistry(): void {
  contextRegistry.clear();
  stateListeners.clear();
  inFlightLoads.clear();
  // Do NOT clear registryListeners: React subscribers from useSyncExternalStore
  // remain valid across the reset; clearing them would break in-flight tests.
  notifyRegistry();
}

/**
 * Cheap UUID v4 sanity check. The `agent_states.conversation_id` column is
 * a UUID; calling Postgrest with a non-UUID (like the optimistic `temp-...`
 * IDs we use before the real conversation row lands) returns 400. We
 * short-circuit on those so we don't spam network errors during the brief
 * window between optimistic create and ID promotion.
 */
function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Async-load a state from persistence and register it. Idempotent:
 * concurrent calls for the same conversationId share the same in-flight
 * Promise. Returns void; consumers re-render via the registry notify.
 */
async function loadAndRegister(conversationId: string): Promise<void> {
  // Skip optimistic IDs — wait for the real UUID to land via id promotion.
  if (!isValidUuid(conversationId)) return;
  if (contextRegistry.has(conversationId)) return;
  const existing = inFlightLoads.get(conversationId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const state = await loadEmiliaState(conversationId);
      if (!state) return; // No row yet; caller bootstraps with createInitialEmiliaState.
      // Re-check after await: another path may have registered first.
      if (contextRegistry.has(conversationId)) return;
      _registerEmiliaContext(conversationId, new RunContext(state));
    } catch (e) {
      // Persistence errors are surfaced via console; the hook reports
      // isLoading=false and state=null, which the orchestrator should
      // treat as "bootstrap fresh".
      console.warn(`[EMILIA_STATE] load failed for ${conversationId}:`, e);
    } finally {
      inFlightLoads.delete(conversationId);
    }
  })();

  inFlightLoads.set(conversationId, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Public hooks
// ---------------------------------------------------------------------------

export interface UseEmiliaStateResult {
  state: EmiliaState | null;
  isLoading: boolean;
}

/**
 * Read the current EmiliaState for a conversation.
 *
 * Returns `{ state: null, isLoading: false }` when no context is registered
 * yet for the given id (or `conversationId === null`). The persistence layer
 * (Phase 1.3, sibling agent) will register a context as soon as it has loaded
 * — at which point this hook re-renders with the populated state.
 */
export function useEmiliaState(conversationId: string | null): UseEmiliaStateResult {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Trigger async load when a new conversationId arrives without a registered context.
  // Skip optimistic temp IDs — wait for the real UUID after id promotion.
  useEffect(() => {
    if (conversationId === null) return;
    if (!isValidUuid(conversationId)) return;
    if (contextRegistry.has(conversationId)) return;

    let cancelled = false;
    setIsLoading(true);
    loadAndRegister(conversationId).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [conversationId]);

  const subscribe = useCallback(
    (listener: () => void) => {
      if (conversationId === null) {
        // No conversation → nothing to subscribe to. Returning a no-op keeps
        // useSyncExternalStore happy and keeps the snapshot stable.
        return () => undefined;
      }
      const unsubReg = subscribeRegistry(listener);
      const unsubState = subscribeState(conversationId, listener);
      return () => {
        unsubReg();
        unsubState();
      };
    },
    [conversationId],
  );

  const getSnapshot = useCallback((): EmiliaState | null => {
    if (conversationId === null) return null;
    const ctx = contextRegistry.get(conversationId);
    return ctx ? ctx.getState() : null;
  }, [conversationId]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return { state, isLoading };
}

export interface UseUpdateStateResult {
  /**
   * Apply a mutation to the EmiliaState for this conversation.
   *
   * No-ops (and resolves) if no context is registered yet for the id.
   * Returns a Promise so the call site can `await` it; today the work is
   * synchronous, but once persistence lands the same call site will await
   * the saveState round-trip without any signature change.
   */
  mutate: (updater: (draft: EmiliaState) => void) => Promise<void>;
}

/**
 * Imperative writer for an EmiliaState. Pair with `useEmiliaState` for the
 * read side.
 */
export function useUpdateState(conversationId: string | null): UseUpdateStateResult {
  const mutate = useCallback(
    async (updater: (draft: EmiliaState) => void): Promise<void> => {
      if (conversationId === null) return;
      const ctx = contextRegistry.get(conversationId);
      if (!ctx) {
        // Nothing to mutate yet — context not loaded. The orchestrator owns
        // bootstrap (it has agencyId/leadId to seed `createInitialEmiliaState`
        // and call `_registerEmiliaContext`).
        return;
      }
      ctx.mutateState(updater);
      try {
        await saveEmiliaState(ctx.getState());
      } catch (e) {
        // Persistence failure does NOT roll back the in-memory mutation —
        // the next mutate or app reload will retry. We surface the error
        // for observability.
        console.warn(`[EMILIA_STATE] save failed for ${conversationId}:`, e);
      }
    },
    [conversationId],
  );

  return { mutate };
}
