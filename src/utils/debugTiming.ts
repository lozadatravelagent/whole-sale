type TimingDetails = Record<string, unknown> | undefined;

function getNowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function writeTimingLog(
  method: 'log' | 'error',
  scope: string,
  label: string,
  elapsedMs: number,
  details?: TimingDetails,
) {
  const message = `⏱️ [TIMING] ${scope} · ${label}: ${elapsedMs.toFixed(0)}ms`;
  if (details && Object.keys(details).length > 0) {
    console[method](message, details);
    return;
  }

  console[method](message);
}

export function nowMs() {
  return getNowMs();
}

export function logTimingStep(
  scope: string,
  label: string,
  startedAtMs: number,
  details?: TimingDetails,
) {
  const elapsedMs = getNowMs() - startedAtMs;
  writeTimingLog('log', scope, label, elapsedMs, details);
  return elapsedMs;
}

export function createDebugTimer(scope: string, initialDetails?: TimingDetails) {
  const startedAtMs = getNowMs();

  if (initialDetails && Object.keys(initialDetails).length > 0) {
    console.log(`⏱️ [TIMING] ${scope} · started`, initialDetails);
  } else {
    console.log(`⏱️ [TIMING] ${scope} · started`);
  }

  return {
    checkpoint(label: string, details?: TimingDetails) {
      return logTimingStep(scope, label, startedAtMs, details);
    },
    end(label = 'completed', details?: TimingDetails) {
      return logTimingStep(scope, label, startedAtMs, details);
    },
    fail(label = 'failed', error?: unknown, details?: TimingDetails) {
      const elapsedMs = getNowMs() - startedAtMs;
      if (details && Object.keys(details).length > 0) {
        console.error(`⏱️ [TIMING] ${scope} · ${label}: ${elapsedMs.toFixed(0)}ms`, {
          ...details,
          error,
        });
      } else {
        console.error(`⏱️ [TIMING] ${scope} · ${label}: ${elapsedMs.toFixed(0)}ms`, error);
      }
      return elapsedMs;
    },
  };
}
