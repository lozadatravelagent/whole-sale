/**
 * Async invocation wrapper for slow edge functions (eurovips-soap mainly).
 *
 * Why this exists
 * ---------------
 * EUROVIPS SOFTUR can take 30-60+ seconds for catalog-heavy queries (a city
 * like CUN with no `hotelName` filter forces a full-inventory scan). The
 * direct `supabase.functions.invoke(...)` path is HTTP-bound and dies at the
 * 30s edge wall-clock budget, surfacing as a 30s SOAP timeout error.
 *
 * The edge function `eurovips-soap` now supports an async mode: when the
 * caller supplies a `jobId`, it returns 202 immediately and processes the
 * SOAP request under `EdgeRuntime.waitUntil()` with a 90s SOAP timeout,
 * persisting the outcome to `search_jobs`.
 *
 * This module is the client-side counterpart: it generates a jobId, kicks
 * off the async invoke, and polls `search_jobs` until the row reports
 * `completed` / `failed`. The returned shape mirrors what a synchronous
 * `supabase.functions.invoke(...)` resolution would look like, so callers
 * can swap in this wrapper without changing how they consume the response.
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Polling cadence in milliseconds. Chosen to balance Realtime-free latency
 * (~2s after SOFTUR responds) against DB read pressure (~60 reads per 120s
 * window in the worst case).
 */
const POLL_INTERVAL_MS = 2_000;

/**
 * Hard ceiling on how long we wait for the background job. Aligned with the
 * edge function's 90s SOAP timeout plus a 30s headroom for upsert / update
 * roundtrips. If the job hasn't settled in 120s, we surface a timeout error.
 */
const DEFAULT_MAX_WAIT_MS = 120_000;

export interface InvokeEurovipsAsyncArgs {
  /** SOAP action: 'searchHotels', 'searchFlights', 'searchPackages', etc. */
  action: string;
  /** Action-specific params (cityCode, dates, pax...). Forwarded as-is. */
  data: unknown;
  /** Optional: link the job to a conversation for analytics / RLS reads. */
  conversationId?: string | null;
  /** Optional override of the 120s ceiling. */
  maxWaitMs?: number;
}

export interface AsyncInvokeResponse {
  data: {
    success: boolean;
    action: string;
    results?: unknown;
    error?: string;
    jobId: string;
    cached: boolean;
    provider: 'EUROVIPS';
    timestamp: string;
  } | null;
  error: { message: string } | null;
}

function newJobId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback (older runtimes): RFC4122 v4-ish from Math.random.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Sleep helper. Resolves after `ms` milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Invokes `eurovips-soap` in async mode and polls `search_jobs` until the
 * background task settles. Returns a response shape compatible with what
 * `supabase.functions.invoke` would have returned synchronously.
 *
 * Error semantics:
 *   - SOAP failure (timeout, parser error, transport): { error: { message } }.
 *   - Wall-clock exceeded before job settles: { error: { message: 'async_timeout' } }.
 *   - Successful completion: { data: { success: true, results, ... } }.
 *
 * The function never throws on backend errors; it always resolves with
 * `{ data, error }` so call sites can keep the same `if (response.error)`
 * branching they use today.
 */
export async function invokeEurovipsAsync(
  args: InvokeEurovipsAsyncArgs,
): Promise<AsyncInvokeResponse> {
  const { action, data, conversationId = null, maxWaitMs = DEFAULT_MAX_WAIT_MS } = args;
  const jobId = newJobId();

  console.log(`🚀 [ASYNC] Dispatching ${action} as job ${jobId}`);

  // Fire the invoke. The edge function will return 202 within ~100ms after
  // upserting the job row to status='processing'.
  const dispatchResponse = await supabase.functions.invoke('eurovips-soap', {
    body: { action, data, jobId, conversationId },
  });

  if (dispatchResponse.error) {
    console.error(`❌ [ASYNC] Dispatch failed for job ${jobId}:`, dispatchResponse.error);
    return { data: null, error: { message: dispatchResponse.error.message || 'dispatch_failed' } };
  }

  // The edge function returns 400 (invalid_input) without going async — in
  // that case dispatchResponse.data carries { success: false, error, detail }.
  const dispatchPayload = dispatchResponse.data as
    | { success: boolean; async?: boolean; status?: string; error?: string; detail?: string }
    | null;

  if (dispatchPayload && dispatchPayload.success === false) {
    const message = dispatchPayload.detail || dispatchPayload.error || 'unknown_error';
    return { data: null, error: { message } };
  }

  // If the edge function didn't honor async mode (legacy deployment), the
  // response carries the full sync payload. Pass it through unchanged.
  if (!dispatchPayload?.async) {
    console.log(`ℹ️ [ASYNC] Edge function answered synchronously for job ${jobId} — passing through`);
    return { data: dispatchResponse.data as AsyncInvokeResponse['data'], error: null };
  }

  // -------- Poll search_jobs via SECURITY DEFINER RPC until settled --------
  //
  // We use a SECURITY DEFINER function (`get_search_job_status`) instead of
  // a direct `from('search_jobs').select().single()` because the table's
  // RLS policy requires a leads → agencies → users JOIN to authorize a read.
  // Brand-new conversations have no lead yet, so the policy returns 0 rows
  // for the very case we care about. The RPC sidesteps that without
  // weakening security: the jobId is a client-generated v4 UUID (122-bit
  // secret) and only authenticated callers can invoke. See the migration
  // `20260514150000_search_jobs_status_rpc.sql` for the full rationale.
  const deadline = Date.now() + maxWaitMs;
  let lastStatus: string | null = null;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const { data: rpcRows, error: pollError } = await supabase.rpc(
      'get_search_job_status',
      { p_job_id: jobId },
    );

    if (pollError) {
      console.warn(`⚠️ [ASYNC] Poll error for job ${jobId} (will retry):`, pollError.message);
      continue;
    }

    const jobRow = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!jobRow) {
      // Row not yet written by the edge function (race against the upsert).
      // Treat as pending and retry on the next tick.
      continue;
    }

    if (jobRow.status !== lastStatus) {
      console.log(`📊 [ASYNC] Job ${jobId} status: ${jobRow.status}`);
      lastStatus = jobRow.status;
    }

    if (jobRow.status === 'completed') {
      return {
        data: {
          success: true,
          action,
          results: jobRow.results,
          jobId,
          cached: false,
          provider: 'EUROVIPS',
          timestamp: jobRow.completed_at || new Date().toISOString(),
        },
        error: null,
      };
    }

    if (jobRow.status === 'failed') {
      return {
        data: null,
        error: { message: jobRow.error || 'background_job_failed' },
      };
    }
  }

  console.error(`⏱️ [ASYNC] Job ${jobId} did not settle within ${maxWaitMs}ms`);
  return { data: null, error: { message: `async_timeout: job ${jobId} exceeded ${maxWaitMs}ms` } };
}
