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
  extractDiscoveryCandidates,
  getRetrievalToolHandlers,
  getRetrievalToolSchemas,
  type ToolContext,
} from "../_shared/functionTools.ts";
import { runToolLoop } from "../_shared/toolRunner.ts";
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

function cleanLocation(value: string | undefined): string {
  return (value || '')
    .replace(/^(desde|de|hacia|a)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function augmentMultiCitySegmentsFromMessage(message: string, parsed: any): any {
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

function normalizeLocationsToCountryCapitals(parsed: any): any {
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
      try {
        const requestBody = await req.json();
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
        } = requestBody;

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

          // -------------------------------------------------------------
          // Load EmiliaState ONCE at the top of the loop so the
          // pending_action handlers can read+mutate it across (potentially
          // parallel) tool calls within this turn. Final state is batch-
          // persisted after the loop along with any save_memory_note notes.
          // -------------------------------------------------------------
          let stateForTools: EmiliaState | null = null;
          let stateLoadFailed = false;
          if (ctx.conversationId && ctx.agencyId) {
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
            const result = await baseDiscoverPlacesHandler(args, ctx);
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
                  }
                }
              } catch (persistErr) {
                console.warn('[CTX-TOOL] state batch persistence threw:', persistErr);
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
              });
              aiResponse = extractOpenAiMessageContent(openaiData);
            }
          } catch (toolLoopErr) {
            // Network-resilience fallback: the tool loop threw (timeout,
            // upstream OpenAI 5xx, transient infra). Re-issue a single-shot
            // chat completion so the user still gets a response. NOT a
            // legacy A/B leg — the tool loop is the only intended path.
            console.error('❌ [CTX-TOOL] runToolLoop failed, using single-shot resilience fallback:', toolLoopErr);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            openaiData = await requestOpenAiChatCompletion<any>({
              apiKey: openaiApiKey,
              model: modelDecision.model,
              messages: parserMessages,
              temperature: 0.1,
              maxTokens: 1800,
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
        // Clean the AI response to handle emojis and special characters properly
        let cleanedResponse = aiResponse.trim();
        // Remove any potential BOM or invisible characters
        cleanedResponse = cleanedResponse.replace(/^\uFEFF/, '');
        // Try to fix JSON by replacing literal newlines in string values with \\n
        // This is a more targeted approach to fix the specific issue
        try {
          // First, try to parse as-is
          JSON.parse(cleanedResponse);
        } catch (error) {
          // If parsing fails, try to fix common issues
          console.log('🔧 Attempting to fix JSON formatting issues...');
          // Fix literal newlines in string values by replacing them with \\n
          cleanedResponse = cleanedResponse.replace(/"([^"]*)\n([^"]*)"/g, (match, before, after) => {
            return `"${before}\\n${after}"`;
          });
          // Fix multiple consecutive newlines
          cleanedResponse = cleanedResponse.replace(/"([^"]*)\n\n([^"]*)"/g, (match, before, after) => {
            return `"${before}\\n\\n${after}"`;
          });
        }
        // Parse the JSON response
        let parsed;
        try {
          parsed = JSON.parse(cleanedResponse);
        } catch (parseError) {
          console.error('❌ Failed to parse AI response as JSON:', parseError);
          console.error('❌ AI response was:', aiResponse);
          console.error('❌ Cleaned response was:', cleanedResponse);
          // Try to extract JSON from the response if it's wrapped in other text
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
              console.log('✅ Successfully extracted JSON from wrapped response');
            } catch (secondParseError) {
              console.error('❌ Failed to parse extracted JSON:', secondParseError);
              throw new Error('Invalid JSON response from AI');
            }
          } else {
            throw new Error('Invalid JSON response from AI');
          }
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
          contextMeta,
          metadata: {
            promptVersion: PROMPT_VERSION,
          },
        });
        return new Response(JSON.stringify({
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
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
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
        const statusCode = error.message?.includes('OpenAI') ? 502 : 500;
        return new Response(JSON.stringify({
          success: false,
          error: 'AI parsing failed. Please try again.',
          timestamp: new Date().toISOString(),
          meta: {
            promptVersion: PROMPT_VERSION
          }
        }), {
          status: statusCode,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
  );
});

