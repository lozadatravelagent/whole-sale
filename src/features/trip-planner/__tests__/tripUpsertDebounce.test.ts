import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncedFlusher } from '../hooks/createDebouncedFlusher';

describe('createDebouncedFlusher', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('collapses rapid calls into a single invocation of the last scheduled fn', () => {
    const flusher = createDebouncedFlusher(3000);
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const fn3 = vi.fn();

    flusher.schedule(fn1);
    flusher.schedule(fn2);
    flusher.schedule(fn3);

    vi.advanceTimersByTime(3000);

    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
    expect(fn3).toHaveBeenCalledOnce();
  });

  it('flush() fires the pending function immediately', () => {
    const flusher = createDebouncedFlusher(3000);
    const fn = vi.fn();

    flusher.schedule(fn);
    flusher.flush();

    expect(fn).toHaveBeenCalledOnce();
  });

  it('flush() is safe to call when nothing is pending', () => {
    const flusher = createDebouncedFlusher(3000);
    expect(() => flusher.flush()).not.toThrow();
  });

  it('cancel() discards the pending function without firing', () => {
    const flusher = createDebouncedFlusher(3000);
    const fn = vi.fn();

    flusher.schedule(fn);
    flusher.cancel();
    vi.advanceTimersByTime(3000);

    expect(fn).not.toHaveBeenCalled();
  });

  it('resets the timer on each schedule call', () => {
    const flusher = createDebouncedFlusher(3000);
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    flusher.schedule(fn1);
    vi.advanceTimersByTime(2000);
    // 2s elapsed — fn1 should NOT have fired yet
    expect(fn1).not.toHaveBeenCalled();

    flusher.schedule(fn2);
    // Timer resets; 2s more is NOT enough (needs 3s from last schedule)
    vi.advanceTimersByTime(2000);
    expect(fn2).not.toHaveBeenCalled();

    // 1s more (3s from second schedule) — fn2 fires
    vi.advanceTimersByTime(1000);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('does not double-fire after flush + timer expiry', () => {
    const flusher = createDebouncedFlusher(3000);
    const fn = vi.fn();

    flusher.schedule(fn);
    flusher.flush();
    vi.advanceTimersByTime(3000);

    expect(fn).toHaveBeenCalledOnce();
  });

  it('flush after natural expiry is a no-op', () => {
    const flusher = createDebouncedFlusher(3000);
    const fn = vi.fn();

    flusher.schedule(fn);
    vi.advanceTimersByTime(3000);
    flusher.flush();

    expect(fn).toHaveBeenCalledOnce();
  });
});
