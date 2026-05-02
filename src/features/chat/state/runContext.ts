/**
 * RunContext<T> — TypeScript equivalent of OpenAI Agents SDK's
 * `RunContextWrapper[T]`. Wraps a single state object and exposes a controlled
 * read/mutate API plus a subscriber list for telemetry, hooks, and React glue.
 *
 * Spec: docs/architecture/context-engineering-spec.md §5.2 / §6
 *
 * Design notes:
 * - Mutations go through `mutateState(updater)`. The updater receives a
 *   structured-cloned draft, so callers can mutate freely without aliasing the
 *   live state. After the updater returns, the draft becomes the new state.
 * - `getState()` returns the current snapshot reference; consumers must NOT
 *   mutate it. (We do not Object.freeze for perf reasons; this is a soft
 *   contract enforced by convention, mirroring the SDK.)
 * - Subscribers are notified synchronously after the mutation commits.
 *   Subscriber errors are isolated so one bad listener cannot break others.
 *
 * No external deps. Immer is not in package.json; we use `structuredClone`
 * for the draft (same approach as `emiliaState.ts:cloneEmiliaState`).
 */

export type StateUpdater<T> = (draft: T) => void;
export type StateSubscriber<T> = (state: T) => void;
export type Unsubscribe = () => void;

/**
 * Deep clone helper local to runContext. Kept private so the file has no
 * dependency on `emiliaState.ts` (RunContext is generic over T).
 */
function cloneDeep<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export class RunContext<T> {
  private _state: T;
  private readonly _subscribers: Set<StateSubscriber<T>> = new Set();

  constructor(state: T) {
    // Defensive clone on construction so the caller's reference cannot leak
    // mutations into our internal state.
    this._state = cloneDeep(state);
  }

  /**
   * Read-only snapshot of the current state. By convention, callers MUST NOT
   * mutate the returned value — go through `mutateState` instead.
   */
  getState(): T {
    return this._state;
  }

  /**
   * Apply a controlled mutation. The updater receives a deep-cloned draft so
   * it can mutate freely. After the updater returns, the draft is committed
   * as the new state and all subscribers are notified.
   *
   * Throws are propagated to the caller and the state is left untouched.
   */
  mutateState(updater: StateUpdater<T>): void {
    const draft = cloneDeep(this._state);
    updater(draft);
    this._state = draft;
    this._notify();
  }

  /**
   * Register a subscriber. Returns an unsubscribe function. Subscribers are
   * called synchronously after each successful mutation, in registration order.
   */
  subscribe(cb: StateSubscriber<T>): Unsubscribe {
    this._subscribers.add(cb);
    return () => {
      this._subscribers.delete(cb);
    };
  }

  /**
   * Number of active subscribers. Exposed for tests / telemetry.
   */
  get subscriberCount(): number {
    return this._subscribers.size;
  }

  private _notify(): void {
    // Snapshot the subscriber set so an unsubscribe-during-notify does not
    // skip listeners or revisit them. Errors are isolated per subscriber.
    const snapshot = Array.from(this._subscribers);
    for (const sub of snapshot) {
      try {
        sub(this._state);
      } catch (err) {
        // Soft-fail: a buggy subscriber should not prevent other subscribers
        // from running or corrupt the state. We report and move on.
        console.error('[RunContext] subscriber threw:', err);
      }
    }
  }
}
