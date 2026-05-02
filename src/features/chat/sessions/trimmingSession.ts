/**
 * TrimmingSession — TS equivalent of the OpenAI Cookbook's
 * `TrimmingSession` (Short-Term Memory Management with Sessions).
 *
 * Keeps the last N USER turns verbatim, plus all assistant + tool messages
 * that follow each kept user turn. Older turns are dropped on read.
 *
 * Spec: docs/architecture/context-engineering-spec.md §7.1
 *
 * Notes:
 * - Storage is in-memory; the persisted conversation tail lives in `messages`
 *   in Postgres. This class is a windowing utility on top of that.
 * - `MessageRow` (the project's row shape) is the reference message shape —
 *   the trim algorithm only looks at `role` so it is row-shape-agnostic.
 *   Any object with a `role: 'user' | 'assistant' | 'system' | 'tool'` works.
 */

export interface ChatSessionItem {
  /**
   * Minimum role surface needed to count user turns and partition the tail.
   * Tool messages, system messages, and any future role types are kept
   * verbatim alongside their preceding user turn.
   */
  role: 'user' | 'assistant' | 'system' | 'tool' | string;
}

export interface TrimmingSessionStats {
  /** Total items currently held in the session buffer. */
  totalItems: number;
  /** How many items have been dropped by trims since construction (cumulative). */
  droppedItems: number;
  /** ms-since-epoch of the last trim that actually dropped items, if any. */
  lastTrimAt?: number;
}

const DEFAULT_MAX_TURNS = 6;

/**
 * Bounded conversation tail keyed by user-turn count.
 *
 * Read API:
 *   - `getItems()`        — returns last `maxTurns` user turns + their followups
 *   - `getItems(limit)`   — same window then capped to the most-recent `limit` items
 *
 * Write API:
 *   - `addItems(items)`   — append items in order received
 *   - `clear()`           — drop everything
 *   - `setMaxTurns(n)`    — adjust the user-turn budget (n ≥ 1)
 *
 * The class does NOT mutate items; the buffer holds references.
 */
export class TrimmingSession<T extends ChatSessionItem = ChatSessionItem> {
  private buffer: T[] = [];
  private maxTurns: number;
  private droppedItems = 0;
  private lastTrimAt?: number;

  constructor(maxTurns: number = DEFAULT_MAX_TURNS) {
    this.maxTurns = Math.max(1, Math.floor(maxTurns));
  }

  addItems(items: T[]): void {
    if (!items || items.length === 0) return;
    for (const item of items) {
      this.buffer.push(item);
    }
  }

  /**
   * Return the trimmed window. Walks the buffer backward, counts user turns,
   * stops once `maxTurns` user turns have been collected; everything from
   * that boundary forward is the kept window. If the buffer holds fewer
   * user turns than `maxTurns`, the entire buffer is returned.
   *
   * Optional `limit` truncates the returned slice to its most-recent N items
   * (after trimming). Used to keep the prompt tail under a token budget at
   * call-site granularity.
   *
   * NOTE: this is read-only — the underlying buffer is not modified. Stats
   * are NOT updated by `getItems`; call `clear()` or `addItems` to evolve
   * state. Drop counters are updated implicitly when subsequent `getItems`
   * queries observe a drop boundary moving forward (we capture it here so
   * `getStats` reflects what a reader would see).
   */
  getItems(limit?: number): T[] {
    const window = this.computeWindow();

    // Capture drop telemetry: how many items the current window leaves out.
    const dropped = this.buffer.length - window.length;
    if (dropped > this.droppedItems) {
      this.droppedItems = dropped;
      this.lastTrimAt = Date.now();
    }

    if (typeof limit === 'number' && limit >= 0 && limit < window.length) {
      return window.slice(window.length - limit);
    }
    return window;
  }

  clear(): void {
    if (this.buffer.length > 0) {
      this.droppedItems += this.buffer.length;
      this.lastTrimAt = Date.now();
    }
    this.buffer = [];
  }

  setMaxTurns(n: number): void {
    this.maxTurns = Math.max(1, Math.floor(n));
  }

  getStats(): TrimmingSessionStats {
    return {
      totalItems: this.buffer.length,
      droppedItems: this.droppedItems,
      lastTrimAt: this.lastTrimAt,
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Walk the buffer backward, counting user messages. As soon as we have
   * counted `maxTurns` user messages, the index of the OLDEST kept user
   * message becomes the window start. Anything before that is dropped.
   *
   * If the buffer begins with non-user items (assistant/system/tool) before
   * the first kept user turn, those are dropped too — the window starts at
   * the boundary user turn.
   */
  private computeWindow(): T[] {
    if (this.buffer.length === 0) return [];

    let userCount = 0;
    let startIndex = 0;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].role === 'user') {
        userCount++;
        if (userCount === this.maxTurns) {
          startIndex = i;
          break;
        }
      }
    }

    // If we never saw `maxTurns` user messages, keep everything we have.
    if (userCount < this.maxTurns) {
      return this.buffer.slice();
    }

    return this.buffer.slice(startIndex);
  }
}
