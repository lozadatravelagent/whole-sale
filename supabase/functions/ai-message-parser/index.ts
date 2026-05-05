import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rateLimit.ts";
import { buildSystemPrompt, PROMPT_VERSION } from "./prompt.ts";
import { normalizeFlightRequest } from "../_shared/flightSegments.ts";
import { requestOpenAiChatCompletion } from "../_shared/llm/openaiChat.ts";
import { estimateCostUsd } from "../_shared/llm/pricing.ts";
import { resolveModelPolicy } from "../_shared/llm/modelPolicy.ts";
import { logLlmRequest } from "../_shared/llm/usageLogger.ts";
import {
  normalizeDestinationListToCapitals,
  normalizeDestinationToCapitalIfCountry,
} from "../_shared/countryCapitalResolver.ts";
import { corsHeaders } from '../_shared/cors.ts';
import {
  type DiscoverPlacesArgs,
  extractDiscoveryCandidates,
  getRetrievalToolHandlers,
  getRetrievalToolSchemas,
  resolveKnownDiscoveryArgs,
  type ToolContext,
} from "../_shared/functionTools.ts";
import { runToolLoop } from "../_shared/toolRunner.ts";
import { buildResponseFormat } from "./responseSchema.ts";
import { recordAgentRunEvent } from "../_shared/agentRunEvents.ts";
import {
  createLifecycleHooks,
  shouldConsolidateNow,
} from "../_shared/lifecycleHooks.ts";
import {
  saveMemoryNoteToolSchema,
  validateMemoryNote,
  type MemoryNoteScope,
} from "../_shared/memoryTools.ts";
import {
  applySlotValuesToolSchema,
  confirmPendingActionToolSchema,
  executeApplySlotValues,
  executeConfirmPendingAction,
  executeProposePlannerAddition,
  proposePlannerAdditionToolSchema,
  type ApplySlotValuesArgs,
  type ConfirmPendingActionArgs,
  type ProposePlannerAdditionArgs,
} from "../_shared/pendingActionTools.ts";
import type {
  EmiliaState,
  PendingActionKind,
} from "../_shared/emiliaStateTypes.ts";
import { countRedundantCalls, emitTelemetry } from "../_shared/telemetry.ts";

function sseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function cleanLocation(value: string | undefined): string {
  return (value || '')
    .replace(/^(desde|de|hacia|a)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeTraceValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return { type: 'array', length: value.length };

  const record = value as Record<string, unknown>;
  const summary: Record<string, unknown> = {
    type: 'object',
    keys: Object.keys(record).slice(0, 20),
  };
  if (typeof record.ok === 'boolean') summary.ok = record.ok;
  if (typeof record.error === 'string') summary.error = record.error;
  if (Array.isArray(record.places)) summary.places_count = record.places.length;
  if (Array.isArray(record.destinations)) summary.destinations_count = record.destinations.length;
  return summary;
}

function scheduleBackgroundTask(work: Promise<unknown>): void {
  const guarded = work.catch((err) => {
    console.warn('[CTX-BACKGROUND] task failed:', err);
  });
  try {
    (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
      .EdgeRuntime?.waitUntil?.(guarded);
  } catch {
    // Local runtimes may not expose EdgeRuntime; the promise has already started.
  }
}

export function augmentMultiCitySegmentsFromMessage(message: string, parsed: any): any {
  if (!parsed?.flights) return parsed;

  const normalizedFlights = normalizeFlightRequest(parsed.flights);
  if (!normalizedFlights?.origin || !normalizedFlights?.destination || !normalizedFlights?.departureDate) {
    return parsed;
  }

  if (Array.isArray(normalizedFlights.segments) && normalizedFlights.segments.length > 1) {
    return {
      ...parsed,
      flights: normalizedFlights
    };
  }

  const returnDate = normalizedFlights.returnDate;
  if (!returnDate) {
    return {
      ...parsed,
      flights: normalizedFlights
    };
  }

  const explicitDifferentCityMatch = message.match(
    /\b(?:con\s+)?(?:vuelta|regreso|volver|volviendo)\b[\s\S]{0,120}?\bdesde\s+(.+?)\s+(?:hacia|a)\s+(.+?)(?=[,.;]|$)/i
  );
  const implicitReturnFromMatch = message.match(
    /\b(?:con\s+)?(?:vuelta|regreso|volver|volviendo)\b[\s\S]{0,120}?\bdesde\s+(.+?)(?=[,.;]|$)/i
  );

  let secondOrigin = '';
  let secondDestination = '';

  if (explicitDifferentCityMatch) {
    secondOrigin = cleanLocation(explicitDifferentCityMatch[1]);
    secondDestination = cleanLocation(explicitDifferentCityMatch[2]);
  } else if (implicitReturnFromMatch) {
    secondOrigin = cleanLocation(implicitReturnFromMatch[1]);
    secondDestination = cleanLocation(normalizedFlights.origin);
  }

  if (!secondOrigin || !secondDestination) {
    return {
      ...parsed,
      flights: normalizedFlights
    };
  }

  const nextFlights = normalizeFlightRequest({
    ...normalizedFlights,
    tripType: undefined,
    segments: [
      {
        origin: normalizedFlights.origin,
        destination: normalizedFlights.destination,
        departureDate: normalizedFlights.departureDate
      },
      {
        origin: secondOrigin,
        destination: secondDestination,
        departureDate: returnDate
      }
    ]
  });

  return {
    ...parsed,
    flights: nextFlights
  };
}

function extractOpenAiMessageContent(openaiData: any): string {
  const content = openaiData?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .join('')
      .trim();
  }

  return '';
}

export function normalizeLocationsToCountryCapitals(parsed: any): any {
  if (!parsed || typeof parsed !== 'object') return parsed;

  const nextParsed = { ...parsed };

  // Itinerary destinations are NOT normalized to capitals.
  // The planner has its own country/regional expansion that handles
  // "España" → multi-city routes. Normalizing here would collapse
  // "España" to "Madrid" before expansion can run.

  if (nextParsed.hotels) {
    nextParsed.hotels = {
      ...nextParsed.hotels,
      ...(nextParsed.hotels.city
        ? { city: normalizeDestinationToCapitalIfCountry(nextParsed.hotels.city) }
        : {}),
      ...(Array.isArray(nextParsed.hotels.segments)
        ? {
            segments: nextParsed.hotels.segments.map((segment: any) => ({
              ...segment,
              ...(segment?.city
                ? { city: normalizeDestinationToCapitalIfCountry(segment.city) }
                : {}),
            })),
          }
        : {}),
    };
  }

  if (nextParsed.flights) {
    nextParsed.flights = {
      ...nextParsed.flights,
      ...(nextParsed.flights.origin
        ? { origin: normalizeDestinationToCapitalIfCountry(nextParsed.flights.origin) }
        : {}),
      ...(nextParsed.flights.destination
        ? { destination: normalizeDestinationToCapitalIfCountry(nextParsed.flights.destination) }
        : {}),
      ...(Array.isArray(nextParsed.flights.segments)
        ? {
            segments: nextParsed.flights.segments.map((segment: any) => ({
              ...segment,
              ...(segment?.origin
                ? { origin: normalizeDestinationToCapitalIfCountry(segment.origin) }
                : {}),
              ...(segment?.destination
                ? { destination: normalizeDestinationToCapitalIfCountry(segment.destination) }
                : {}),
            })),
          }
        : {}),
    };
  }

  if (nextParsed.packages?.destination) {
    nextParsed.packages = {
      ...nextParsed.packages,
      destination: normalizeDestinationToCapitalIfCountry(nextParsed.packages.destination),
    };
  }

  if (nextParsed.services?.city) {
    nextParsed.services = {
      ...nextParsed.services,
      city: normalizeDestinationToCapitalIfCountry(nextParsed.services.city),
    };
  }

  return nextParsed;
}
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  // Initialize Supabase client for rate limiting
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Apply rate limiting
  return await withRateLimit(
    req,
    supabase,
    { action: 'message', resource: 'ai-parser' },
    async () => {
      const requestId = crypto.randomUUID();
      const runId = crypto.randomUUID();

      // Body parsed up-front so we can decide between SSE and JSON paths
      // BEFORE running the pipeline. Streaming MUST return its Response
      // with a still-empty stream so the proxy gets headers immediately —
      // events flow as work progresses. The previous code returned the
      // Response only after the pipeline finished (~150s for cold queries),
      // causing 504 Gateway Timeout under any non-trivial latency.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let requestBody: any;
      try {
        requestBody = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'invalid_request_body' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const wantsStream =
        requestBody.stream === true ||
        req.headers.get('Accept') === 'text/event-stream';

      let progressWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
      let streamReadable: ReadableStream<Uint8Array> | null = null;
      if (wantsStream) {
        const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
        streamReadable = readable;
        progressWriter = writable.getWriter();
      }

      // Pipeline returns a discriminated result instead of a Response. The
      // streaming wrapper writes the terminal `done`/`error` SSE event once
      // the result is available; the non-streaming wrapper turns it into
      // a plain JSON Response.
      type ProcessResult =
        | { kind: 'ok'; payload: unknown }
        | { kind: 'error'; payload: unknown; statusCode: number };

      const runPipeline = async (): Promise<ProcessResult> => {
        let contextMetaForTrace: Record<string, unknown> | null = null;
        const parserStartedAt = performance.now();
        try {
        const {
          message = requestBody.prompt, // Support both 'message' and 'prompt'
          language = 'es',
          currentDate = new Date().toISOString().split('T')[0], // Default to today's date (YYYY-MM-DD)
          previousContext,
          conversationHistory = [],
          plannerContext = null,
          historyWindow = 15,
          contextMeta = null,
          memoryStateBlock = null,
          toolChoice = null,
          emiliaState: clientEmiliaState = null,
        } = requestBody;
        contextMetaForTrace = contextMeta;

        // Diagnostic: log the tool_choice received from the client so we can
        // tell whether the FE policy is computing it. Cheap to keep in prod
        // (one log line per turn), high value for debugging the discovery
        // intent flow without server-side reconstruction.
        if (toolChoice) {
          console.log('[CTX-TOOL] received toolChoice:', JSON.stringify(toolChoice));
        } else {
          console.log('[CTX-TOOL] no toolChoice from client (defaults to "auto")');
        }

        if (!message) {
          throw new Error('Message or prompt is required');
        }
        console.log('🤖 AI Message Parser - Processing:', message);
        console.log('📝 Previous context received:', previousContext);
        console.log('📚 Conversation history received:', conversationHistory?.length || 0, 'messages');
        console.log('📅 Current date:', currentDate);
        // Format conversation history - use smart truncation to maximize context
        let conversationHistoryText = '';
        if (conversationHistory && conversationHistory.length > 0) {
          try {
            const normalizedHistoryWindow = Math.max(1, Math.min(20, Number(historyWindow) || 15));
            const recentHistory = conversationHistory.slice(-normalizedHistoryWindow);

            conversationHistoryText = recentHistory.map((msg, index) => {
              // Escape problematic characters
              let safeContent = (msg.content || '').replace(/`/g, "'").replace(/\$/g, "\\$");

              // Smart truncation: keep more for recent messages, less for older ones
              const messagesFromEnd = recentHistory.length - index;
              let maxLength;
              if (messagesFromEnd <= 5) {
                maxLength = 800; // Last 5 messages: keep almost full content
              } else if (messagesFromEnd <= 10) {
                maxLength = 500; // Messages 6-10: medium length
              } else {
                maxLength = 300; // Older messages: shorter summary
              }

              safeContent = safeContent.substring(0, maxLength);
              if (safeContent.length === maxLength) {
                safeContent += '...'; // Indicate truncation
              }

              return `${msg.role}: ${safeContent}`;
            }).join('\\n');
          } catch (e) {
            console.error('Error formatting conversation history:', e);
            conversationHistoryText = '';
          }
        }

        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiApiKey) throw new Error('OpenAI API key not configured');
        const systemPrompt = buildSystemPrompt({
          currentDate,
          conversationHistoryText,
          previousContext,
          plannerContext,
          memoryStateBlock: memoryStateBlock ?? undefined,
          language,
        });
        const userPrompt = message;
        const modelDecision = resolveModelPolicy({
          feature: 'ai-message-parser',
          operation: 'parse',
        });
        const openAiStartedAt = performance.now();
        const parserMessages = [
          {
            role: 'system' as const,
            content: systemPrompt
          },
          {
            role: 'user' as const,
            content: userPrompt
          }
        ];

        // -------------------------------------------------------------
        // Function-tools (tool-calling loop) is the only path. The legacy
        // single-shot branch and its `USE_FUNCTION_TOOLS` / `x-use-tool-loop`
        // feature flags were removed in Phase 4 of the Context Engineering
        // cleanup. Spec: docs/architecture/tool-catalog-spec.md §5.
        // The two internal `requestOpenAiChatCompletion` calls below are
        // network-resilience fallbacks (loop produced unparseable output, or
        // loop threw) — NOT a legacy A/B leg.
        // -------------------------------------------------------------

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let openaiData: any;
        let aiResponse = '';
        let toolLoopTrace: Array<{ tool: string; latencyMs: number; error?: string }> = [];
        let toolLoopIterations = 0;
        let placeDiscoveryResult: unknown = null;
        // Resolution of any pending_action consumed during the loop. Returned
        // to the client in `meta.pendingActionResolution` so the client can
        // mutate domain state (planner, quote, etc.) without re-parsing.
        interface PendingActionResolutionEnvelope {
          kind: PendingActionKind;
          for: string;
          ref?: { type: 'plan' | 'quote' | 'lead'; id: string };
          applied: Record<string, unknown>;
          complete: boolean;
        }
        let pendingActionResolution: PendingActionResolutionEnvelope | null = null;

        {
          // Build a ToolContext from the same scope used by retrieval tools.
          // RLS is enforced via service-role client filtered by agency_id.
          const ctx: ToolContext = {
            supabase,
            conversationId: contextMeta?.conversationId ?? '',
            agencyId: contextMeta?.agencyId ?? '',
            leadId: contextMeta?.leadId ?? undefined,
          };
          const messageId = typeof contextMeta?.messageId === 'string'
            ? contextMeta.messageId
            : null;
          const recordRunEvent = (
            eventType: string,
            event: {
              toolName?: string | null;
              status?: 'ok' | 'error' | 'timeout' | 'skipped';
              latencyMs?: number | null;
              payload?: Record<string, unknown>;
              error?: string | null;
            } = {},
          ) =>
            recordAgentRunEvent(supabase, {
              conversationId: ctx.conversationId,
              agencyId: ctx.agencyId,
              messageId,
              runId,
              eventType,
              ...event,
            });

          await recordRunEvent('parser_start', {
            payload: {
              requestId,
              promptVersion: PROMPT_VERSION,
              hasPlannerContext: plannerContext !== null,
              hasMemoryStateBlock: memoryStateBlock !== null,
              toolChoice: toolChoice ? 'provided' : 'auto',
            },
          });

          // -------------------------------------------------------------
          // Load EmiliaState ONCE at the top of the loop so the
          // pending_action handlers can read+mutate it across (potentially
          // parallel) tool calls within this turn. Final state is batch-
          // persisted after the loop along with any save_memory_note notes.
          //
          // Latency optimisation: if the client forwarded the state it just
          // saved (clientEmiliaState), use it directly and skip the SELECT
          // (~30–50 ms per turn). Fall back to SELECT when absent or when the
          // basic shape check fails, so old clients and tests keep working.
          // -------------------------------------------------------------
          let stateForTools: EmiliaState | null = null;
          let stateLoadFailed = false;
          const clientStateIsValid =
            clientEmiliaState !== null &&
            typeof clientEmiliaState === 'object' &&
            typeof (clientEmiliaState as Record<string, unknown>).mode === 'string' &&
            typeof (clientEmiliaState as Record<string, unknown>).meta === 'object';
          if (clientStateIsValid) {
            stateForTools = clientEmiliaState as unknown as EmiliaState;
            console.log('[CTX-TOOL] state preload: using client-supplied EmiliaState (SELECT skipped)');
          } else if (ctx.conversationId && ctx.agencyId) {
            try {
              const { data: row, error: loadErr } = await supabase
                .from('agent_states')
                .select('state')
                .eq('conversation_id', ctx.conversationId)
                .eq('agency_id', ctx.agencyId)
                .single();
              if (loadErr) {
                if (loadErr.code !== 'PGRST116') {
                  console.warn('[CTX-TOOL] state preload failed:', loadErr.message);
                  stateLoadFailed = true;
                }
              } else if (row?.state) {
                stateForTools = row.state as unknown as EmiliaState;
              }
            } catch (preloadErr) {
              console.warn('[CTX-TOOL] state preload threw:', preloadErr);
              stateLoadFailed = true;
            }
          }

          // save_memory_note handler — validates and returns the structured
          // note. Persistence to agent_states happens in batch AFTER the loop
          // completes, to avoid race conditions when the model parallel-calls
          // this tool multiple times within a single turn.
          const saveMemoryNoteHandler = async (
            args: { text: string; keywords: string[]; scope: string },
          ) => {
            const result = validateMemoryNote(args.text, args.keywords, args.scope);
            if (!result.ok) return { ok: false, reason: result.reason };
            return {
              ok: true,
              note: {
                text: args.text,
                keywords: args.keywords.map((k) => k.trim().toLowerCase()),
                scope: args.scope as MemoryNoteScope,
                last_update_date: new Date().toISOString(),
              },
            };
          };

          // apply_slot_values handler — pure mutation against stateForTools.
          // Accumulates `applied` across (possibly parallel) calls so the
          // final pendingActionResolution carries every value the model parsed.
          const applySlotValuesHandler = async (args: ApplySlotValuesArgs) => {
            if (!stateForTools) {
              return { ok: false, reason: 'no_pending_action' as const };
            }
            const { nextState, result } = executeApplySlotValues(stateForTools, args);
            if (result.ok) {
              stateForTools = nextState;
              const pa = nextState.pending_action!;
              pendingActionResolution = {
                kind: pa.kind,
                for: pa.for,
                ref: pa.ref,
                applied: { ...(pa.applied ?? {}) },
                complete: Boolean(pa.complete),
                ...(pa.payload ? { payload: { ...pa.payload } } : {}),
              };
            }
            return result;
          };

          // confirm_pending_action handler — same shape, different kind guard.
          // The pending_action's `payload` (set by the tool that asked the
          // question, e.g. propose_planner_addition stashing resolved_places)
          // is forwarded so the client dispatcher can mutate domain state
          // without re-resolving from a stale state.
          const confirmPendingActionHandler = async (args: ConfirmPendingActionArgs) => {
            if (!stateForTools) {
              return { ok: false, reason: 'no_pending_action' as const };
            }
            const { nextState, result } = executeConfirmPendingAction(stateForTools, args);
            if (result.ok) {
              stateForTools = nextState;
              const pa = nextState.pending_action!;
              pendingActionResolution = {
                kind: pa.kind,
                for: pa.for,
                ref: pa.ref,
                applied: { ...(pa.applied ?? {}) },
                complete: Boolean(pa.complete),
                ...(pa.payload ? { payload: { ...pa.payload } } : {}),
              };
            }
            return result;
          };

          // propose_planner_addition handler — sets a kind=awaiting_user_confirmation
          // pending_action with the resolved_places payload. Does NOT set
          // pendingActionResolution: the model still has to call confirm_pending_action
          // on the user's reply. Persistence flushes the pending_action so the
          // next turn renders it for the model.
          let pendingActionWritten = false;
          const proposePlannerAdditionHandler = async (args: ProposePlannerAdditionArgs) => {
            if (!stateForTools) {
              return { ok: false, error: 'no_candidates_to_resolve' as const };
            }
            const { nextState, result } = executeProposePlannerAddition(stateForTools, args);
            if (result.ok) {
              stateForTools = nextState;
              pendingActionWritten = true;
            }
            return result;
          };

          // discover_places wrapper — runs the underlying retrieval handler,
          // then OVERWRITES `stateForTools.discovery_candidates` with the
          // top-N candidates from the result so the next turn can resolve
          // referential phrases like "agregá el segundo del listado" → a
          // concrete placeId. Phase-3 (`propose_planner_addition`) reads
          // this slot. Latest call wins; never accumulated.
          let discoveryCandidatesWritten = 0;
          const baseDiscoverPlacesHandler = getRetrievalToolHandlers().discover_places;
          const discoverPlacesHandlerWithPersist = async (args: unknown) => {
            // Pre-resolve known args (lat/lng) from prior discovery_candidates.
            // Per OpenAI's "Don't make the model fill arguments you already
            // know" guidance — reduces hallucinated coordinates.
            const resolvedArgs = resolveKnownDiscoveryArgs(
              args as DiscoverPlacesArgs,
              stateForTools,
            );
            const result = await baseDiscoverPlacesHandler(resolvedArgs, ctx);
            if (stateForTools) {
              const candidates = extractDiscoveryCandidates(result);
              if (candidates && candidates.length > 0) {
                stateForTools.discovery_candidates = candidates;
                discoveryCandidatesWritten = candidates.length;
                emitTelemetry({
                  category: 'CTX-DISCOVERY-PERSIST',
                  conversation_id: ctx.conversationId,
                  agency_id: ctx.agencyId,
                  count: candidates.length,
                  categories: Array.from(new Set(candidates.map((c) => c.category))),
                });
              }
            }
            return result;
          };

          try {
            const toolLoopStartedAt = performance.now();
            await recordRunEvent('tool_loop_start', {
              payload: {
                model: Deno.env.get('CTX_TOOL_LOOP_MODEL') ?? 'gpt-4.1',
                iterationCap: 3,
                perToolTimeoutMs: 8000,
                totalLoopTimeoutMs: 25000,
              },
            });
            const loopResult = await runToolLoop({
              apiKey: openaiApiKey,
              // gpt-4.1 supports tool calls + reliable JSON; mini doesn't always.
              // Override the default via the `CTX_TOOL_LOOP_MODEL` env var to swap
              // the model without redeploying (e.g. to bump to gpt-5.1 once parity
              // is verified — see DEBT-7 in docs/architecture/tool-catalog.md).
              model: Deno.env.get('CTX_TOOL_LOOP_MODEL') ?? 'gpt-4.1',
              systemPrompt,
              userMessage: userPrompt,
              tools: [
                ...getRetrievalToolSchemas(),
                saveMemoryNoteToolSchema,
                applySlotValuesToolSchema,
                confirmPendingActionToolSchema,
                proposePlannerAdditionToolSchema,
              ],
              toolHandlers: {
                ...getRetrievalToolHandlers(),
                // Override discover_places with the persisting wrapper so the
                // candidates flow into stateForTools alongside memory writes
                // and pending_action mutations.
                discover_places: discoverPlacesHandlerWithPersist,
                save_memory_note: saveMemoryNoteHandler,
                apply_slot_values: applySlotValuesHandler as unknown as (
                  args: unknown,
                ) => Promise<unknown>,
                confirm_pending_action: confirmPendingActionHandler as unknown as (
                  args: unknown,
                ) => Promise<unknown>,
                propose_planner_addition: proposePlannerAdditionHandler as unknown as (
                  args: unknown,
                ) => Promise<unknown>,
              },
              ctx,
              iterationCap: 3,
              parallelToolCalls: true,
              perToolTimeoutMs: 8000,
              totalLoopTimeoutMs: 25000,
              // Structured Outputs: pin the assistant's TEXT output to the
              // ParsedTravelRequest JSON schema. tool_call arguments are
              // unaffected — they carry their own per-tool schema.
              responseFormat: buildResponseFormat(),
              // Per-turn tool_choice from the client (allowed_tools subset
              // or forced function). Defaults to "auto" when omitted.
              ...(toolChoice ? { toolChoice } : {}),
              onTraceEvent: (event) =>
                recordRunEvent(event.type, {
                  toolName: event.tool,
                  status: event.status,
                  latencyMs: event.latencyMs ?? null,
                  payload: {
                    iteration: event.iteration,
                    args: summarizeTraceValue(event.args),
                    result: summarizeTraceValue(event.result),
                  },
                  error: event.error ?? null,
                }),
              ...(progressWriter
                ? {
                    onProgress: ({ type, tool, iteration, ok }) => {
                      progressWriter!.write(
                        sseEvent(type === 'tool_start' ? 'tool_start' : 'tool_done', {
                          tool,
                          iteration,
                          ok,
                        }),
                      );
                    },
                  }
                : {}),
            });
            await recordRunEvent('tool_loop_done', {
              latencyMs: Math.round(performance.now() - toolLoopStartedAt),
              payload: {
                iterations: loopResult.iterationsUsed,
                hitIterationCap: loopResult.hitIterationCap,
                hitLoopTimeout: loopResult.hitLoopTimeout,
                toolsCalled: loopResult.toolCallsTrace.map((t) => t.tool),
                errorsCount: loopResult.toolCallsTrace.filter((t) => t.error).length,
              },
            });

            // Partition save_memory_note trace entries into accepted/rejected
            // for both persistence and the [CTX-MEMORY] telemetry event.
            const memoryTraceEntries = loopResult.toolCallsTrace
              .filter((t) => t.tool === 'save_memory_note');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const isOk = (r: any) => r && typeof r === 'object' && r.ok === true && r.note;
            const acceptedNotes = memoryTraceEntries
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((t) => isOk(t.result as any))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((t) => (t.result as any).note);
            const rejectedReasons: Record<string, number> = {};
            for (const t of memoryTraceEntries) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const r = t.result as any;
              if (!isOk(r)) {
                const reason = (r && typeof r === 'object' && typeof r.reason === 'string')
                  ? r.reason
                  : (t.error ?? 'unknown');
                rejectedReasons[reason] = (rejectedReasons[reason] ?? 0) + 1;
              }
            }
            const memoryAttempted = memoryTraceEntries.length;
            const memoryAccepted = acceptedNotes.length;
            const memoryRejected = memoryAttempted - memoryAccepted;

            if (memoryAttempted > 0) {
              await recordRunEvent('memory_notes_validated', {
                status: memoryRejected > 0 ? 'error' : 'ok',
                payload: {
                  attempted: memoryAttempted,
                  accepted: memoryAccepted,
                  rejected: memoryRejected,
                  rejectionReasons: rejectedReasons,
                },
                error: memoryRejected > 0 ? 'memory_notes_rejected' : null,
              });
            }

            // Batch-persist BOTH accepted save_memory_note notes AND any
            // pending_action mutations from apply_slot_values /
            // confirm_pending_action — single UPDATE round trip per turn.
            //
            // Option A scope: per-conversation. Never crosses to other
            // conversations. Skipped silently if state preload failed (we
            // don't want to clobber an unloaded row with a half-state).
            const hasMemoryWrites = acceptedNotes.length > 0;
            const hasPendingMutation = pendingActionResolution !== null;
            const hasDiscoveryWrite = discoveryCandidatesWritten > 0;
            const hasPendingActionWrite = pendingActionWritten;
            if (
              (hasMemoryWrites || hasPendingMutation || hasDiscoveryWrite || hasPendingActionWrite) &&
              ctx.conversationId &&
              ctx.agencyId &&
              !stateLoadFailed
            ) {
              try {
                // If we never loaded a row (fresh conversation not yet
                // bootstrapped by the client) we can't safely upsert here —
                // the client owns bootstrap. Just log and skip.
                if (!stateForTools) {
                  console.log('[CTX-TOOL] no agent_states row to persist into; client must bootstrap first');
                } else {
                  // Apply memory writes onto the same in-memory state object
                  // that the pending_action handlers already mutated, so we
                  // do one consistent UPDATE.
                  if (hasMemoryWrites) {
                    stateForTools.session_memory = stateForTools.session_memory ?? { notes: [] };
                    stateForTools.session_memory.notes = (stateForTools.session_memory.notes ?? [])
                      .concat(acceptedNotes);
                  }
                  const { error: saveErr } = await supabase
                    .from('agent_states')
                    .update({
                      state: stateForTools as unknown as Record<string, unknown>,
                      // Keep the DB column in sync with state.meta.schema_version.
                      // Client may have just migrated a v1 row in memory (see
                      // src/features/chat/state/persistence.ts).
                      schema_version: stateForTools.meta?.schema_version ?? 1,
                    })
                    .eq('conversation_id', ctx.conversationId)
                    .eq('agency_id', ctx.agencyId);
                  if (saveErr) {
                    console.warn('[CTX-TOOL] state batch save failed:', saveErr.message);
                  } else {
                    console.log('[CTX-TOOL] persisted state batch:', {
                      conversationId: ctx.conversationId,
                      memoryNotes: acceptedNotes.length,
                      pendingResolved: hasPendingMutation,
                      discoveryCandidates: discoveryCandidatesWritten,
                    });
                    if (hasPendingActionWrite) {
                      await recordRunEvent('pending_action_emitted', {
                        payload: {
                          pendingFor: stateForTools.pending_action?.for ?? null,
                          pendingKind: stateForTools.pending_action?.kind ?? null,
                        },
                      });
                    }
                    if (hasPendingMutation) {
                      await recordRunEvent('pending_action_resolved', {
                        payload: {
                          pendingFor: pendingActionResolution?.for ?? null,
                          pendingKind: pendingActionResolution?.kind ?? null,
                          complete: pendingActionResolution?.complete ?? false,
                        },
                      });
                    }
                  }
                }
              } catch (persistErr) {
                console.warn('[CTX-TOOL] state batch persistence threw:', persistErr);
              }
            }

            if (
              stateForTools &&
              ctx.conversationId &&
              ctx.agencyId &&
              !stateLoadFailed
            ) {
              const prospectiveTurnState: EmiliaState = {
                ...stateForTools,
                meta: {
                  ...stateForTools.meta,
                  turn_count: (stateForTools.meta?.turn_count ?? 0) + 1,
                },
              };
              const hasAnyMemory =
                (stateForTools.session_memory?.notes?.length ?? 0) > 0 ||
                (stateForTools.global_memory?.notes?.length ?? 0) > 0;
              if (hasAnyMemory && shouldConsolidateNow(prospectiveTurnState)) {
                const stateSnapshot = stateForTools;
                const conversationIdSnapshot = ctx.conversationId;
                const agencyIdSnapshot = ctx.agencyId;
                scheduleBackgroundTask((async () => {
                  try {
                    const hooks = createLifecycleHooks();
                    const consolidated = await hooks.onSessionEnd(stateSnapshot, {
                      chatCompletion: (input) =>
                        requestOpenAiChatCompletion({
                          apiKey: openaiApiKey,
                          model: input.model,
                          messages: input.messages,
                          temperature: input.temperature,
                          maxTokens: input.maxTokens,
                        }),
                    });
                    if (consolidated !== stateSnapshot) {
                      const { error: consolidateSaveErr } = await supabase
                        .from('agent_states')
                        .update({
                          state: consolidated as unknown as Record<string, unknown>,
                          schema_version: consolidated.meta?.schema_version ?? 1,
                        })
                        .eq('conversation_id', conversationIdSnapshot)
                        .eq('agency_id', agencyIdSnapshot);
                      if (consolidateSaveErr) {
                        console.warn('[CTX-MEMORY] consolidation save failed:', consolidateSaveErr.message);
                        await recordRunEvent('memory_consolidation', {
                          status: 'error',
                          error: consolidateSaveErr.message,
                        });
                      } else {
                        await recordRunEvent('memory_consolidation', {
                          payload: {
                            globalNotes: consolidated.global_memory.notes.length,
                            sessionNotes: consolidated.session_memory.notes.length,
                            lastConsolidatedAt: consolidated.meta.last_consolidated_at ?? null,
                          },
                        });
                      }
                    } else {
                      await recordRunEvent('memory_consolidation', {
                        status: 'skipped',
                        payload: { reason: 'no_changes' },
                      });
                    }
                  } catch (err) {
                    console.warn('[CTX-MEMORY] consolidation failed:', err);
                    await recordRunEvent('memory_consolidation', {
                      status: 'error',
                      error: err instanceof Error ? err.message : String(err),
                    });
                  }
                })());
              }
            }

            aiResponse = loopResult.finalMessage.content?.trim() ?? '';
            const lastPlaceDiscoveryCall = [...loopResult.toolCallsTrace]
              .reverse()
              .find((t) => t.tool === 'discover_places' && !t.error);
            if (lastPlaceDiscoveryCall?.result) {
              placeDiscoveryResult = lastPlaceDiscoveryCall.result;
            }
            toolLoopTrace = loopResult.toolCallsTrace.map((t) => ({
              tool: t.tool,
              latencyMs: t.latencyMs,
              error: t.error,
            }));
            toolLoopIterations = loopResult.iterationsUsed;

            // Synthesize an openai-style envelope so the downstream usage
            // logger and parsing path stay unchanged.
            openaiData = {
              model: 'gpt-4.1',
              choices: [{
                index: 0,
                finish_reason: loopResult.hitIterationCap || loopResult.hitLoopTimeout ? 'length' : 'stop',
                message: loopResult.finalMessage,
              }],
              usage: {
                prompt_tokens: loopResult.totalUsage.promptTokens,
                completion_tokens: loopResult.totalUsage.completionTokens,
                total_tokens: loopResult.totalUsage.totalTokens,
                prompt_tokens_details: { cached_tokens: loopResult.totalUsage.cachedTokens },
              },
            };

            // -- Phase 8 telemetry: structured per-turn events. --
            // [CTX-TOOL]: tool-loop summary (iterations, tools, errors, tokens, redundancy).
            const redundantCalls = countRedundantCalls(
              loopResult.toolCallsTrace.map((t) => ({ tool: t.tool, args: t.args })),
            );
            emitTelemetry({
              category: 'CTX-TOOL',
              conversation_id: ctx.conversationId,
              agency_id: ctx.agencyId,
              iterations: toolLoopIterations,
              tools_called: toolLoopTrace.map((t) => t.tool),
              errors_count: toolLoopTrace.filter((t) => t.error).length,
              hit_cap: loopResult.hitIterationCap,
              hit_timeout: loopResult.hitLoopTimeout,
              prompt_tokens: loopResult.totalUsage.promptTokens,
              completion_tokens: loopResult.totalUsage.completionTokens,
              cached_tokens: loopResult.totalUsage.cachedTokens,
              redundant_calls: redundantCalls,
            });

            // [CTX-MEMORY]: only emit when the model attempted at least one
            // save_memory_note this turn — keeps the event log signal-rich.
            if (memoryAttempted > 0) {
              emitTelemetry({
                category: 'CTX-MEMORY',
                conversation_id: ctx.conversationId,
                agency_id: ctx.agencyId,
                attempted: memoryAttempted,
                accepted: memoryAccepted,
                rejected: memoryRejected,
                rejection_reasons: rejectedReasons,
              });
            }

            // Network-resilience fallback: the tool loop ran but its final
            // message contained no parseable JSON. Re-issue a single-shot
            // chat completion so the user still gets a response. NOT a
            // legacy A/B leg — the tool loop is the only intended path.
            const looksLikeJson = aiResponse.trim().startsWith('{') ||
                                  aiResponse.trim().includes('{');
            if (!looksLikeJson) {
              console.warn('⚠️ [CTX-TOOL] tool-loop final message did not contain JSON, using single-shot resilience fallback');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              openaiData = await requestOpenAiChatCompletion<any>({
                apiKey: openaiApiKey,
                model: modelDecision.model,
                messages: parserMessages,
                temperature: 0.1,
                maxTokens: 1800,
                // Same Structured Outputs schema as the tool-loop path so the
                // resilience fallback also returns shape-valid JSON.
                responseFormat: buildResponseFormat(),
              });
              aiResponse = extractOpenAiMessageContent(openaiData);
            }
          } catch (toolLoopErr) {
            // Network-resilience fallback: the tool loop threw (timeout,
            // upstream OpenAI 5xx, transient infra). Re-issue a single-shot
            // chat completion so the user still gets a response. NOT a
            // legacy A/B leg — the tool loop is the only intended path.
            console.error('❌ [CTX-TOOL] runToolLoop failed, using single-shot resilience fallback:', toolLoopErr);
            await recordRunEvent('tool_loop_error', {
              status: 'error',
              error: toolLoopErr instanceof Error ? toolLoopErr.message : String(toolLoopErr),
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            openaiData = await requestOpenAiChatCompletion<any>({
              apiKey: openaiApiKey,
              model: modelDecision.model,
              messages: parserMessages,
              temperature: 0.1,
              maxTokens: 1800,
              // Same Structured Outputs schema as the tool-loop path so the
              // resilience fallback also returns shape-valid JSON.
              responseFormat: buildResponseFormat(),
            });
            aiResponse = extractOpenAiMessageContent(openaiData);
          }
        }
        const openAiLatencyMs = Math.round(performance.now() - openAiStartedAt);
        if (!aiResponse) {
          throw new Error(`No response from OpenAI (finishReason: ${openaiData?.choices?.[0]?.finish_reason ?? 'unknown'})`);
        }
        console.log('🤖 Raw AI response:', aiResponse);
        console.log('🤖 AI response type:', typeof aiResponse);
        console.log('🤖 AI response length:', aiResponse?.length);
        // Trim whitespace + strip BOM. With Structured Outputs (json_schema)
        // OpenAI guarantees a valid JSON object conforming to the schema, so
        // the legacy newline-repair and wrapped-JSON-extraction salvage paths
        // were dropped. We still try/catch to surface a clean error if a
        // resilience-fallback path returns non-JSON (e.g. catastrophic 5xx).
        const cleanedResponse = aiResponse.trim().replace(/^\uFEFF/, '');
        let parsed;
        try {
          parsed = JSON.parse(cleanedResponse);
        } catch (parseError) {
          console.error('❌ Failed to parse AI response as JSON:', parseError);
          console.error('❌ AI response was:', aiResponse);
          throw new Error('Invalid JSON response from AI');
        }
        // Fix common type issues from AI response
        if (typeof parsed.confidence === 'string') {
          parsed.confidence = parseFloat(parsed.confidence);
        }

        // Add default confidence if missing
        if (parsed.confidence === undefined || parsed.confidence === null) {
          console.log('⚠️ Missing confidence field, setting default value of 0.8');
          parsed.confidence = 0.8;
        }

        // Fix maxLayoverHours if it's a string
        if (parsed.flights?.maxLayoverHours && typeof parsed.flights.maxLayoverHours === 'string') {
          parsed.flights.maxLayoverHours = parseInt(parsed.flights.maxLayoverHours, 10);
        }

        if (parsed.itinerary?.days && typeof parsed.itinerary.days === 'string') {
          parsed.itinerary.days = parseInt(parsed.itinerary.days, 10);
        }

        if (parsed.itinerary?.budgetAmount && typeof parsed.itinerary.budgetAmount === 'string') {
          parsed.itinerary.budgetAmount = parseFloat(parsed.itinerary.budgetAmount);
        }

        if (parsed.flights) {
          parsed = augmentMultiCitySegmentsFromMessage(message, parsed);
          parsed.flights = normalizeFlightRequest(parsed.flights);
        }

        parsed = normalizeLocationsToCountryCapitals(parsed);

        // Validate the response structure
        if (!parsed.requestType || typeof parsed.confidence !== 'number') {
          console.error('❌ Invalid response structure from AI:', {
            requestType: parsed.requestType,
            confidence: parsed.confidence,
            confidenceType: typeof parsed.confidence,
            fullResponse: parsed
          });
          throw new Error(`Invalid response structure from AI - requestType: ${parsed.requestType}, confidence: ${parsed.confidence} (${typeof parsed.confidence})`);
        }
        console.log('✅ AI parsing successful:', parsed);
        const usage = {
          provider: modelDecision.provider,
          model: openaiData?.model ?? modelDecision.model,
          promptTokens: openaiData?.usage?.prompt_tokens ?? null,
          completionTokens: openaiData?.usage?.completion_tokens ?? null,
          totalTokens: openaiData?.usage?.total_tokens ?? null,
          cachedTokens: openaiData?.usage?.prompt_tokens_details?.cached_tokens ?? null,
          estimatedCostUsd: estimateCostUsd({
            model: openaiData?.model ?? modelDecision.model,
            promptTokens: openaiData?.usage?.prompt_tokens ?? null,
            completionTokens: openaiData?.usage?.completion_tokens ?? null,
            cachedTokens: openaiData?.usage?.prompt_tokens_details?.cached_tokens ?? null,
          }),
          finishReason: openaiData?.choices?.[0]?.finish_reason ?? null,
        };
        await logLlmRequest(supabase, {
          provider: usage.provider,
          model: usage.model,
          feature: 'ai-message-parser',
          operation: 'parse',
          requestId,
          success: true,
          latencyMs: openAiLatencyMs,
          finishReason: usage.finishReason,
          usage: {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            cachedTokens: usage.cachedTokens,
          },
          contextMeta: contextMetaForTrace,
          metadata: {
            promptVersion: PROMPT_VERSION,
          },
        });
        const finalPayload = {
          success: true,
          parsed,
          aiResponse: aiResponse,
          usage,
          requestId,
          timestamp: new Date().toISOString(),
          meta: {
            promptVersion: PROMPT_VERSION,
            toolLoop: {
              iterations: toolLoopIterations,
              trace: toolLoopTrace,
            },
            // When the model invoked apply_slot_values / confirm_pending_action,
            // surface the resolution to the client so it can mutate domain
            // state (planner, quote, etc.) without re-parsing.
            pendingActionResolution,
            placeDiscovery: placeDiscoveryResult,
          }
        };

        await recordAgentRunEvent(supabase, {
          conversationId: typeof contextMetaForTrace?.conversationId === 'string' ? contextMetaForTrace.conversationId : '',
          agencyId: typeof contextMetaForTrace?.agencyId === 'string' ? contextMetaForTrace.agencyId : '',
          messageId: typeof contextMetaForTrace?.messageId === 'string' ? contextMetaForTrace.messageId : null,
          runId,
          eventType: 'parser_done',
          latencyMs: Math.round(performance.now() - parserStartedAt),
          payload: {
            requestType: parsed.requestType,
            promptVersion: PROMPT_VERSION,
            toolLoopIterations,
            hasPendingActionResolution: pendingActionResolution !== null,
            hasPlaceDiscovery: placeDiscoveryResult !== null,
          },
        });

        // Diagnostic: confirm what's actually being shipped to the client.
        // Crucial for debugging the discovery flow when the UI doesn't show
        // places despite the tool firing successfully.
        const pdMeta = finalPayload.meta?.placeDiscovery as { ok?: boolean; places?: unknown[] } | null | undefined;
        console.log(
          `[CTX-TOOL-DEBUG] outgoing finalPayload.meta.placeDiscovery: ` +
          `present=${pdMeta != null} ok=${pdMeta?.ok ?? 'n/a'} ` +
          `places_count=${Array.isArray(pdMeta?.places) ? pdMeta!.places!.length : 'n/a'}`,
        );

        return { kind: 'ok', payload: finalPayload };
      } catch (error) {
        console.error('❌ AI Message Parser error:', error);
        console.error('❌ Error stack:', error.stack);
        const failureModelDecision = resolveModelPolicy({
          feature: 'ai-message-parser',
          operation: 'parse',
        });
        await logLlmRequest(supabase, {
          provider: failureModelDecision.provider,
          model: failureModelDecision.model,
          feature: 'ai-message-parser',
          operation: 'parse',
          requestId,
          success: false,
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            promptVersion: PROMPT_VERSION,
          },
        });
        await recordAgentRunEvent(supabase, {
          conversationId: typeof contextMetaForTrace?.conversationId === 'string' ? contextMetaForTrace.conversationId : '',
          agencyId: typeof contextMetaForTrace?.agencyId === 'string' ? contextMetaForTrace.agencyId : '',
          messageId: typeof contextMetaForTrace?.messageId === 'string' ? contextMetaForTrace.messageId : null,
          runId,
          eventType: 'parser_error',
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          payload: { promptVersion: PROMPT_VERSION },
        });
        const statusCode = error.message?.includes('OpenAI') ? 502 : 500;
        const errorPayload = {
          success: false,
          error: 'AI parsing failed. Please try again.',
          timestamp: new Date().toISOString(),
          meta: {
            promptVersion: PROMPT_VERSION
          }
        };

        return { kind: 'error', payload: errorPayload, statusCode };
      }
      };

      if (wantsStream) {
        const writer = progressWriter!;

        // Background processing — runs the pipeline, writes the terminal
        // SSE event, closes the writer. The Response is returned BEFORE
        // this work starts so the proxy gets headers immediately. Events
        // flow through the writer as work progresses (tool_start /
        // tool_done from runToolLoop's onProgress, then the final done /
        // error event from this wrapper).
        const work = (async () => {
          let result: ProcessResult;
          try {
            result = await runPipeline();
          } catch (err) {
            // Defense in depth — runPipeline's own try/catch already turns
            // pipeline errors into kind:'error' results. If something
            // escapes (programming error, top-level exception), synthesize
            // a generic error so the client always gets a terminal event.
            console.error('❌ unexpected error escaped runPipeline:', err);
            result = {
              kind: 'error',
              payload: {
                success: false,
                error: 'AI parsing failed. Please try again.',
                timestamp: new Date().toISOString(),
                meta: { promptVersion: PROMPT_VERSION },
              },
              statusCode: 500,
            };
          }
          try {
            await writer.write(
              sseEvent(result.kind === 'ok' ? 'done' : 'error', result.payload),
            );
          } catch {
            // writer might already be closed (timeout, client disconnect)
          }
          try {
            await writer.close();
          } catch {
            // already closed
          }
        })();

        // EdgeRuntime.waitUntil keeps the function alive past the Response
        // return on Supabase's edge runtime. Absent in local
        // `supabase functions serve` and tests — there the event loop holds
        // `work` until completion on its own. Wrapped in try/catch so the
        // missing global never breaks non-prod environments.
        try {
          (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
            .EdgeRuntime?.waitUntil?.(work);
        } catch {
          // EdgeRuntime not available — work continues via the event loop.
        }

        return new Response(streamReadable!, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            // Tell intermediaries (Cloudflare, Nginx) not to buffer the
            // stream — events must reach the client in real time.
            'X-Accel-Buffering': 'no',
          },
        });
      }

      // Non-streaming: process inline and return JSON.
      const result = await runPipeline();
      return new Response(JSON.stringify(result.payload), {
        status: result.kind === 'ok' ? 200 : result.statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  );
});
