export function createDebouncedFlusher(delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: (() => void) | null = null;

  function schedule(fn: () => void) {
    if (timer) clearTimeout(timer);
    pending = fn;
    timer = setTimeout(() => {
      timer = null;
      const f = pending;
      pending = null;
      f?.();
    }, delayMs);
  }

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const f = pending;
    pending = null;
    f?.();
  }

  function cancel() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  }

  return { schedule, flush, cancel };
}
