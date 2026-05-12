import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type React from 'react';
import { parseMessageWithAIStreaming, validateFlightRequiredFields, validateHotelRequiredFields, validateItineraryRequiredFields, generateMissingInfoMessage, detectMessageLanguage, normalizeSupportedLanguage } from '@/services/aiMessageParser';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import { normalizeFlightRequest } from '@/services/flightSegments';
import { handleFlightSearch, handleHotelSearch, handleCombinedSearch, handlePackageSearch, handleServiceSearch, handleGeneralQuery, handleItineraryRequest } from '../services/searchHandlers';
import { addMessageViaSupabase } from '../services/messageService';
import { generateChatTitle } from '../utils/messageHelpers';
import { isAddHotelRequest, isCheaperFlightRequest, isPriceChangeRequest } from '../utils/intentDetection';
import { routeRequest, getInferredFieldDetails } from '../services/routeRequest';
import { normalizeSearchIntent } from '../services/searchIntentNormalizer';
import { detectIterationIntent, mergeIterationContext, generateIterationExplanation } from '../utils/iterationDetection';
import { buildModeBridgeMessage, buildPlanToQuoteResponse, resolveConversationTurn, resolveTravelContextBridge } from '../services/conversationOrchestrator';
import { buildEmiliaSearchNarrative, type NarrativeChip } from '../services/emiliaNarrative';
import { buildProposedSearch } from '../services/proposedSearchBuilder';
import { detectHotelPreferencesFromMessage, resolveTurnIntent } from '../services/turnIntentResolver';
import { resolveEffectiveMode } from '../utils/resolveEffectiveMode';
import { buildDiscoveryResponseFromToolResult } from '../services/discoveryService';
import { isDiscoveryQuery, extractCategoriesFromMessage, extractDestinationFromMessage } from '@/features/chat/services/discoveryIntentGuard';
import { resolveToolChoice } from '@/features/chat/services/toolChoicePolicy';
import type { MessageRow } from '../types/chat';
import type { ChatSuggestedAction } from '../types/chat';
import type { ContextState } from '../types/contextState';
import type { PlannerEditContext, PreloadedConversationKnowledge } from '../types/knowledge';
import { supabase } from '@/integrations/supabase/client';
import type { PlannerFieldProvenance, TripPlannerState } from '@/features/trip-planner/types';
import { applySmartDefaults, expandDestinationsIfRegional, normalizePlannerState } from '@/features/trip-planner/utils';
import { mergePlannerFieldUpdate, normalizeLocationLabel, buildPlannerHotelSearchSignature, buildPlannerTransportSearchSignature } from '@/features/trip-planner/helpers';
import { buildCanonicalResultFromStandard, buildCanonicalMeta, persistCanonicalResult, buildTurnContextState, type CanonicalItineraryResult } from '../services/itineraryPipeline';
import { buildEditorialData } from '@/features/trip-planner/editorial';
import { createDebugTimer, logTimingStep, nowMs } from '@/utils/debugTiming';
import { transformStarlingResults } from '../services/flightTransformer';
import { resolveLeadIdForConversation } from '../services/conversationKnowledgeService';
import { mergeLeadAiProfile, saveLeadAiProfile } from '../services/leadAiProfileService';
import type { EmiliaState, PendingAction } from '@/features/chat/state/emiliaState';
import {
  bumpTurnCount,
  consumePendingActionResolution,
  emitPendingAction,
  prepareTurnContext,
} from '@/features/chat/state/messageTurnContext';
import { toCanonicalFields } from '@/features/chat/state/pendingActionDispatcher';
import { getTypingStatusCopy, getSuggestedActionCopy, formatTravelerPhrase, formatDateRangePhrase, type UserLanguage as I18nUserLanguage } from '@/features/chat/i18n/chatResultCopy';
import { resolveDisplayCity } from '@/services/cityCodeService';
import i18n from '@/i18n';

function formatPlannerDateSelectionMessage(selection: {
  startDate?: string;
  endDate?: string;
  isFlexibleDates: boolean;
  flexibleMonth?: string;
  flexibleYear?: number;
  days?: number;
}) {
  if (selection.isFlexibleDates) {
    const flexibleLabel = selection.flexibleMonth
      ? new Date(`${selection.flexibleYear || new Date().getFullYear()}-${selection.flexibleMonth}-01T00:00:00`)
        .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      : 'mes flexible';

    return `Mes flexible seleccionado: ${flexibleLabel}${selection.days ? ` (${selection.days} días)` : ''}`;
  }

  return `Fechas seleccionadas: ${selection.startDate || 'sin salida'}${selection.endDate ? ` al ${selection.endDate}` : ''}`;
}

function calculateTripDays(startDate?: string, endDate?: string): number | undefined {
  if (!startDate || !endDate) return undefined;
  const diff = new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime();
  if (Number.isNaN(diff)) return undefined;
  return Math.max(1, Math.round(diff / 86400000) + 1);
}

function buildPlannerEditContext(plannerState?: TripPlannerState | null): PlannerEditContext | null {
  if (!plannerState) return null;

  return {
    hasActivePlan: true,
    title: plannerState.title,
    summary: plannerState.summary,
    destinations: plannerState.destinations,
    days: plannerState.days,
    startDate: plannerState.startDate,
    endDate: plannerState.endDate,
    isFlexibleDates: plannerState.isFlexibleDates,
    flexibleMonth: plannerState.flexibleMonth,
    flexibleYear: plannerState.flexibleYear,
    budgetLevel: plannerState.budgetLevel,
    budgetAmount: plannerState.budgetAmount,
    pace: plannerState.pace,
    travelers: plannerState.travelers,
    interests: plannerState.interests?.slice(0, 12),
    constraints: plannerState.constraints?.slice(0, 12),
    segments: plannerState.segments?.map((segment) => ({
      id: segment.id,
      city: segment.city,
      country: segment.country,
      order: segment.order,
      nights: segment.nights,
      dayCount: segment.days?.length || segment.nights,
      startDate: segment.startDate,
      endDate: segment.endDate,
      hotelStatus: segment.hotelPlan?.matchStatus || segment.hotelPlan?.searchStatus,
      transportIn: segment.transportIn?.summary || segment.transportIn?.type,
      transportOut: segment.transportOut?.summary || segment.transportOut?.type,
      days: segment.days?.map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        title: day.title,
      })),
    })),
  };
}

function isExplicitPlannerRestart(message: string): boolean {
  const normalized = normalizeLocationLabel(message);
  return /\b(empeza|empezar|empieza|empezá|desde cero|de cero|descarta|descartar|descartá|borra todo|borrar todo|nuevo plan|otro plan|arma otro|armar otro|armá otro)\b/.test(normalized);
}

function buildPlannerItinerarySnapshot(plannerState: TripPlannerState, rawInstruction: string): NonNullable<ParsedTravelRequest['itinerary']> {
  return {
    destinations: plannerState.destinations || [],
    days: plannerState.days,
    startDate: plannerState.startDate,
    endDate: plannerState.endDate,
    isFlexibleDates: plannerState.isFlexibleDates,
    flexibleMonth: plannerState.flexibleMonth,
    flexibleYear: plannerState.flexibleYear,
    budgetLevel: plannerState.budgetLevel,
    budgetAmount: plannerState.budgetAmount,
    interests: plannerState.interests,
    pace: plannerState.pace,
    travelers: plannerState.travelers,
    constraints: plannerState.constraints,
    currentPlanSummary: plannerState.summary,
    editIntent: {
      action: 'custom_instruction',
      scope: 'plan',
      rawInstruction,
      confidence: 0.55,
    },
  };
}

function normalizeActionText(value?: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const city = typeof record.city === 'string' ? record.city : '';
    const country = typeof record.country === 'string' ? record.country : '';
    return [city, country].filter(Boolean).join(', ').trim();
  }
  return '';
}

function isUsableActionText(value?: unknown): boolean {
  const text = normalizeActionText(value);
  if (!text) return false;
  return !/\[|\]|\bextract\b|\bdate\b|\bcontext\b|\bask\b/i.test(text);
}

function slugAction(value: string): string {
  return normalizeLocationLabel(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'accion';
}

function buildTravelerPhrase(
  travelers?: { adults?: number; children?: number; infants?: number } | null,
  language: I18nUserLanguage = 'es',
): string {
  return formatTravelerPhrase(travelers, language);
}

function getFirstPlannerCity(plannerState?: TripPlannerState | null): string {
  const segmentCity = [...(plannerState?.segments || [])]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((segment) => normalizeActionText(segment.city))
    .find(Boolean);

  if (segmentCity) return segmentCity;
  const dest = normalizeActionText(plannerState?.destinations?.[0]);
  return resolveToConcreteCity(dest);
}

function getFirstExpandedItineraryCity(parsedRequest?: ParsedTravelRequest | null): string {
  const destinations = parsedRequest?.itinerary?.destinations?.map(normalizeActionText).filter(Boolean) || [];
  if (destinations.length === 0) return '';

  const days = parsedRequest?.itinerary?.days || 10;
  const targetMonth = parsedRequest?.itinerary?.flexibleMonth
    ? new Date(`${parsedRequest.itinerary.flexibleMonth} 1, 2000`).getMonth() + 1
    : parsedRequest?.itinerary?.startDate
      ? new Date(parsedRequest.itinerary.startDate).getMonth() + 1
      : undefined;
  const expanded = expandDestinationsIfRegional(destinations, days, targetMonth).expandedDestinations;
  return normalizeActionText(expanded[0]);
}

function resolveToConcreteCity(raw: string): string {
  if (!raw) return raw;
  const { expandedDestinations } = expandDestinationsIfRegional([raw], 10);
  return normalizeActionText(expandedDestinations[0]) || raw;
}

// Suggested action chips display destinations as city names. The parser may
// surface a 3-letter IATA code (e.g. flights.destination = 'CDG'); we translate
// it back to the human label ('París') so the chip reads naturally and the
// resulting prompt feeds the parser a city name. The parser then re-applies
// IATA via formatForStarling for flights, and EUROVIPS keeps city names for
// hotels/packages — see formatForEurovips in aiMessageParser.ts.
function getPrimaryActionDestination(parsedRequest?: ParsedTravelRequest | null, plannerState?: TripPlannerState | null): string {
  const plannerCity = getFirstPlannerCity(plannerState);
  if (plannerCity) return resolveDisplayCity(plannerCity);

  const expandedItineraryCity = getFirstExpandedItineraryCity(parsedRequest);
  if (expandedItineraryCity) return resolveDisplayCity(expandedItineraryCity);

  const itineraryDestination = parsedRequest?.itinerary?.destinations?.map(normalizeActionText).find(Boolean);
  const raw = normalizeActionText(parsedRequest?.flights?.destination)
    || normalizeActionText(parsedRequest?.hotels?.city)
    || normalizeActionText(parsedRequest?.packages?.destination)
    || normalizeActionText(itineraryDestination);
  return resolveDisplayCity(resolveToConcreteCity(raw));
}

/**
 * Phase 2 / sub-task D — Voice Layer wrapper.
 *
 * Delegates to `buildEmiliaSearchNarrative({mode:'progress'})` so the
 * itinerary "draft generating" placeholder shares Emilia's unified voice and
 * gains en/pt support (was hardcoded ES). The local helpers
 * `getPrimaryActionDestination` + IATA→city resolution stay here because they
 * pull from React-side stores; we hand the resolved string to the narrative.
 */
function buildItineraryProgressMessage(parsedRequest: ParsedTravelRequest, plannerState?: TripPlannerState | null): string {
  const destination = getPrimaryActionDestination(parsedRequest, plannerState);
  const days = parsedRequest.itinerary?.days || plannerState?.days;
  return buildEmiliaSearchNarrative({
    mode: 'progress',
    language: parsedRequest.responseLanguage ?? 'es',
    progress: { destination, days },
  }).text;
}

function getStructuredPlannerData(structuredData?: unknown): TripPlannerState | null {
  const structured = structuredData as { plannerData?: TripPlannerState | null } | null | undefined;
  return structured?.plannerData || null;
}

function buildSearchPrompt(
  kind: 'flight' | 'hotel',
  destination: string,
  parsedRequest?: ParsedTravelRequest | null,
  plannerState?: TripPlannerState | null,
  language: I18nUserLanguage = 'es',
): string {
  const rawOrigin = isUsableActionText(parsedRequest?.flights?.origin) ? normalizeActionText(parsedRequest?.flights?.origin) : normalizeActionText(plannerState?.origin);
  const origin = resolveDisplayCity(rawOrigin);
  const startDate = isUsableActionText(parsedRequest?.flights?.departureDate)
    ? parsedRequest?.flights?.departureDate
    : isUsableActionText(parsedRequest?.hotels?.checkinDate)
      ? parsedRequest?.hotels?.checkinDate
      : plannerState?.startDate;
  let endDate = isUsableActionText(parsedRequest?.flights?.returnDate)
    ? parsedRequest?.flights?.returnDate
    : isUsableActionText(parsedRequest?.hotels?.checkoutDate)
      ? parsedRequest?.hotels?.checkoutDate
      : plannerState?.endDate;
  // Hotel chip: when only checkin is known, default to a 3-night stay.
  // Why: EUROVIPS/SOFTUR times out on open-ended date ranges. A "desde el X"
  // prompt round-trips through the parser, which inflates the stay and times
  // out the SOAP. The +3 default keeps the chip executable in one shot.
  if (kind === 'hotel' && startDate && !endDate) {
    const base = new Date(`${startDate}T00:00:00Z`);
    if (!Number.isNaN(base.getTime())) {
      base.setUTCDate(base.getUTCDate() + 3);
      endDate = base.toISOString().slice(0, 10);
    }
  }
  const travelers = parsedRequest?.flights || parsedRequest?.hotels || plannerState?.travelers;
  const travelerPhrase = buildTravelerPhrase(travelers, language);
  const datePhrase = formatDateRangePhrase(startDate, endDate, language);
  const copy = getSuggestedActionCopy(language);

  if (kind === 'flight') {
    return copy.searchFlightsPrompt(destination, origin || '', datePhrase, travelerPhrase);
  }

  return copy.searchHotelPrompt(destination, datePhrase, travelerPhrase);
}

function buildSuggestedActions(options: {
  parsedRequest?: ParsedTravelRequest | null;
  plannerState?: TripPlannerState | null;
  structuredData?: unknown;
  assistantResponseNumber: number;
  language?: I18nUserLanguage;
}): ChatSuggestedAction[] {
  const { parsedRequest, plannerState, structuredData, assistantResponseNumber, language = 'es' } = options;
  const copy = getSuggestedActionCopy(language);
  const actions: ChatSuggestedAction[] = [];
  const seen = new Set<string>();
  const add = (action: Omit<ChatSuggestedAction, 'id'>) => {
    if (!action.label || !action.prompt || seen.has(action.prompt)) return;
    seen.add(action.prompt);
    actions.push({ ...action, id: `action-${action.type}-${slugAction(action.label)}` });
  };

  const destination = getPrimaryActionDestination(parsedRequest, plannerState);
  const structured = structuredData as { combinedData?: { flights?: unknown[]; hotels?: unknown[] } } | null | undefined;
  const plannerForActions = getStructuredPlannerData(structuredData) || plannerState || null;
  const effectiveDestination = getPrimaryActionDestination(parsedRequest, plannerForActions) || destination;

  if (effectiveDestination) {
    const labelDestination = effectiveDestination;
    const hasFlights = (structured?.combinedData?.flights?.length ?? 0) > 0;
    const hasHotels = (structured?.combinedData?.hotels?.length ?? 0) > 0;

    if (!hasFlights) {
      add({
        label: copy.searchFlights(labelDestination),
        prompt: buildSearchPrompt('flight', labelDestination, parsedRequest, plannerForActions, language),
        type: 'flight',
        priority: 1,
      });
    }

    if (!hasHotels) {
      add({
        label: copy.searchHotel(labelDestination),
        prompt: buildSearchPrompt('hotel', labelDestination, parsedRequest, plannerForActions, language),
        type: 'hotel',
        priority: 2,
      });
    }

    add({
      label: copy.buildItinerary(labelDestination),
      prompt: copy.buildItineraryPrompt(labelDestination),
      type: 'itinerary',
      priority: 3,
    });
  }

  if (plannerForActions && assistantResponseNumber >= 3) {
    add({
      label: copy.quotePlan,
      prompt: copy.quotePlanPrompt,
      type: 'quote',
      priority: 0,
    });
  }

  return actions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
}

const ASSISTANT_STREAM_CHARS_PER_CHUNK = 96;
const ASSISTANT_STREAM_DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 8;

function splitAssistantStreamDeltas(text: string): string[] {
  const deltas: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    let next = Math.min(cursor + ASSISTANT_STREAM_CHARS_PER_CHUNK, text.length);
    const boundary = text.lastIndexOf(' ', next);
    if (boundary > cursor + 12) {
      next = boundary + 1;
    }
    deltas.push(text.slice(cursor, next));
    cursor = next;
  }

  return deltas;
}

function waitForAssistantStreamFrame() {
  if (ASSISTANT_STREAM_DELAY_MS <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => setTimeout(resolve, ASSISTANT_STREAM_DELAY_MS));
}

type AssistantResponseStreamDraft = {
  id: string;
  done: Promise<void>;
  cancel: () => void;
};

type ChatLatencyEvent = {
  stage: string;
  latencyMs: number;
  payload?: Record<string, unknown>;
  status?: 'ok' | 'error';
  error?: unknown;
};

function recordChatLatencyEvent(args: ChatLatencyEvent & {
  conversationId: string;
  agencyId: string | null | undefined;
  runId: string;
}) {
  if (!args.agencyId || args.conversationId.startsWith('temp-')) return;
  const payload = JSON.parse(JSON.stringify(args.payload ?? {}));
  void supabase
    .from('agent_run_events')
    .insert({
      conversation_id: args.conversationId,
      agency_id: args.agencyId,
      run_id: args.runId,
      event_type: 'chat_stage',
      tool_name: args.stage,
      status: args.status ?? 'ok',
      latency_ms: Math.max(0, Math.round(args.latencyMs)),
      payload,
      error: args.error instanceof Error ? args.error.message : args.error ? String(args.error) : null,
    })
    .then(({ error }) => {
      if (error) console.warn('[LATENCY] Failed to record chat stage:', error.message);
    });
}

const useMessageHandler = (
  selectedConversation: string | null,
  selectedConversationRef: React.MutableRefObject<string | null>,
  messages: MessageRow[], // ✅ Pass messages directly instead of calling useMessages again
  loadContextualMemory: (conversationId: string) => Promise<ParsedTravelRequest | null>,
  saveContextualMemory: (conversationId: string, request: ParsedTravelRequest) => Promise<void>,
  clearContextualMemory: (conversationId: string) => Promise<void>,
  loadContextState: (conversationId: string) => Promise<any>,
  saveContextState: (conversationId: string, state: any) => Promise<void>,
  updateMessageStatus: (messageId: string, status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed') => Promise<any>,
  updateConversationTitle: (conversationId: string, title: string) => Promise<void>,
  handleCheaperFlightsSearch: (message: string) => Promise<string | null>,
  handlePriceChangeRequest: (message: string) => Promise<{ response: string; modifiedPdfUrl?: string } | null>,
  setIsLoading: (loading: boolean) => void,
  setIsTyping: (typing: boolean, conversationId?: string | null) => void,
  setMessage: (message: string) => void,
  toast: any,
  setTypingMessage: (message: string, conversationId?: string | null) => void,
  addOptimisticMessage: (message: any) => void,
  updateOptimisticMessage: (messageId: string, updates: Partial<any>) => void,
  removeOptimisticMessage: (messageId: string) => void,
  plannerContextRequest: ParsedTravelRequest | null,
  plannerState: any,
  persistPlannerState?: (state: any, source: TripPlannerState['generationMeta']['source']) => Promise<void>,
  setDraftPlannerFromRequest?: (request: ParsedTravelRequest, fieldProvenance?: PlannerFieldProvenance) => void,
  setPlannerDraftPhase?: (phase: 'draft_parsing' | 'draft_generating') => void,
  updatePlannerState?: (updater: (current: TripPlannerState) => TripPlannerState, source?: 'ui_edit' | 'system') => Promise<void>,
  preloadedContext?: PreloadedConversationKnowledge | null,
  workspaceMode?: 'standard' | 'planner',
  // PR 3 (C5): strict agency/passenger mode. When undefined, the orchestrator
  // runs its legacy path (used by consumer / any pre-PR-3 call site).
  chatMode?: 'agency' | 'passenger',
) => {
  const { t } = useTranslation('chat');
  // ✅ Messages are now passed as parameter - no need for second useMessages call

  // Save message to DB and immediately add assistant messages to local state (no Realtime dependency)
  // Auto-generates client_id for assistant messages when missing — closes the
  // 5-layer dedup gap in useChat.ts (otherwise the Realtime echo would fall
  // through to the heuristic step and log "ADDING NEW MESSAGE TO STATE - This
  // may cause duplication"). User messages already generate client_id at the
  // call-site (see line ~846 in handleSendMessage).
  const saveAndDisplayMessage = useCallback(async (messageData: Parameters<typeof addMessageViaSupabase>[0]) => {
    const needsClientId =
      messageData.role === 'assistant' && !messageData.meta?.client_id;
    const enriched = needsClientId
      ? {
          ...messageData,
          meta: { ...(messageData.meta ?? {}), client_id: crypto.randomUUID() },
        }
      : messageData;
    const saved = await addMessageViaSupabase(enriched);
    if (saved && enriched.role === 'assistant') {
      addOptimisticMessage(saved);
    }
    return saved;
  }, [addOptimisticMessage]);

  const startAssistantResponseStream = useCallback((conversationId: string, finalText: string) => {
    if (!finalText.trim()) return null;

    const draftId = `assistant-stream-${conversationId}-${Date.now()}`;
    let cancelled = false;
    let visibleText = '';

    addOptimisticMessage({
      id: draftId,
      conversation_id: conversationId,
      role: 'assistant',
      content: { text: '' },
      meta: {
        status: 'streaming',
        messageType: 'assistant_streaming',
        stream: { state: 'streaming' },
      },
      created_at: new Date().toISOString(),
      client_id: draftId,
    });

    const done = (async () => {
      for (const delta of splitAssistantStreamDeltas(finalText)) {
        if (cancelled) return;
        visibleText += delta;
        updateOptimisticMessage(draftId, {
          content: { text: visibleText },
          meta: {
            status: 'streaming',
            messageType: 'assistant_streaming',
            stream: { state: 'streaming' },
          },
        } as Partial<MessageRow>);
        await waitForAssistantStreamFrame();
      }
    })();

    return {
      id: draftId,
      done,
      cancel: () => {
        cancelled = true;
      },
    };
  }, [addOptimisticMessage, updateOptimisticMessage]);

  // Track active domain for this conversation to avoid cross responses
  let activeDomain: 'flights' | 'hotels' | null = null;

  // Helper: extract last flight context (destination/dates/adults/children/infants) from recent assistant message
  const getContextFromLastFlights = useCallback(() => {
    try {
      const lastWithFlights = [...(messages || [])]
        .filter(m => m.role === 'assistant' && m.meta && (m.meta as any).combinedData && Array.isArray((m.meta as any).combinedData.flights) && (m.meta as any).combinedData.flights.length > 0)
        .pop();
      if (!lastWithFlights) return null;
      const meta = lastWithFlights.meta as any;
      const flights = meta.combinedData.flights as Array<any>;
      const first = flights[0];
      if (!first) return null;
      const destination = first.legs?.[0]?.arrival?.city_code || '';
      const origin = first.legs?.[0]?.departure?.city_code || '';
      const departureDate = first.departure_date || '';
      const returnDate = first.return_date || undefined;
      const adults = first.adults || 1;
      const children = first.childrens || 0;
      const infants = first.infants || 0;
      return { origin, destination, departureDate, returnDate, adults, children, infants };
    } catch (e) {
      console.warn('⚠️ [CONTEXT] Could not extract last flight context:', e);
      return null;
    }
  }, [messages]);

  const handleSendMessage = useCallback(async (
    currentMessage: string,
    // PR 3 (C4/C7.1): optional send options.
    // - `forceCurrentMode`: orchestrator bridge guardrail G2 (C4). Populated by
    //   C5's "Seguir en este modo" chip handler.
    // - `mode`: explicit mode override that wins over the closure-captured
    //   `chatMode` (C7.1.a). Needed because `setChatMode` is async and a chip
    //   handler that calls `setChatMode(new) + handleSendMessageRaw(text)` runs
    //   the send with a stale closure; the orchestrator would then receive the
    //   pre-click mode. Callers that just flipped the mode must pass it here.
    options?: { forceCurrentMode?: boolean; mode?: 'agency' | 'passenger' },
  ) => {
    console.log('🚀 [MESSAGE FLOW] Starting handleSendMessage process');
    console.log('📝 Message content:', currentMessage);

    // ✅ Use ref to get the CURRENT conversation ID (not the closure value)
    // This ensures we always have the latest value, even if called immediately after setSelectedConversation
    const currentConversationId = selectedConversationRef.current;
    console.log('💬 Selected conversation (from ref):', currentConversationId);
    const flowTimer = createDebugTimer('MESSAGE FLOW', {
      conversationId: currentConversationId,
      messageLength: currentMessage.length,
    });
    const assistantResponseCountBeforeTurn = (messages || []).filter((m) => {
      if (m.conversation_id !== currentConversationId || m.role !== 'assistant') return false;
      const meta = m.meta as Record<string, unknown> | null;
      const messageType = meta?.messageType;
      return !['contextual_memory', 'context_state', 'trip_planner_state', 'conversation_summary'].includes(String(messageType || ''));
    }).length;
    const shouldPushToDelivery = assistantResponseCountBeforeTurn >= 2;
    const shouldHardClose = assistantResponseCountBeforeTurn >= 3;
    const uiLanguage = normalizeSupportedLanguage(i18n.language);
    const userLanguage = detectMessageLanguage(currentMessage, uiLanguage);
    const typingCopy = getTypingStatusCopy(userLanguage);

    if (!currentMessage.trim() || !currentConversationId) {
      flowTimer.end('stopped - invalid input', {
        hasConversationId: Boolean(currentConversationId),
        hasMessage: Boolean(currentMessage.trim()),
      });
      console.warn('❌ [MESSAGE FLOW] Validation failed - aborting send');
      return;
    }

    // Check if this is a cheaper flights search request for a previously uploaded PDF
    if (isCheaperFlightRequest(currentMessage)) {
      console.log('✈️ [CHEAPER FLIGHTS] Detected cheaper flights search request for previous PDF');

      // Clear the input immediately
      setMessage('');

      // Run the cheaper flights search in the background
      (async () => {
        setIsLoading(true);
        try {
          // Generate unique client_id for idempotency
          const clientId = crypto.randomUUID();
          console.log('🔑 [CHEAPER FLIGHTS] Generated client_id:', clientId);

          // ⚡ Optimistic UI update - add user message to UI immediately
          const optimisticUserMessage = {
            id: `temp-${clientId}`,
            conversation_id: currentConversationId,
            role: 'user' as const,
            content: { text: currentMessage.trim() },
            meta: { status: 'sending', client_id: clientId, messageType: 'cheaper_flights_request' },
            created_at: new Date().toISOString()
          };

          // Add to local messages immediately (Realtime will replace with real message from DB)
          addOptimisticMessage(optimisticUserMessage as any);

          // Add user message to database (in background)
          await saveAndDisplayMessage({
            conversation_id: currentConversationId,
            role: 'user' as const,
            content: { text: currentMessage.trim() },
            meta: { status: 'sent', messageType: 'cheaper_flights_request', client_id: clientId }
          });

          const responseMessage = await handleCheaperFlightsSearch(currentMessage);

          if (responseMessage) {
            // Send response message
            await saveAndDisplayMessage({
              conversation_id: currentConversationId,
              role: 'assistant' as const,
              content: {
                text: responseMessage,
                metadata: {
                  type: 'cheaper_flights_search',
                  originalRequest: currentMessage
                }
              },
              meta: {
                status: 'sent',
                messageType: 'cheaper_flights_response'
              }
            });
          }

          setIsLoading(false);

        } catch (error) {
          console.error('❌ Error searching for cheaper flights:', error);

          await saveAndDisplayMessage({
            conversation_id: currentConversationId,
            role: 'assistant' as const,
            content: {
              text: `❌ **Error en la búsqueda de vuelos**\n\nNo pude buscar vuelos alternativos en este momento. Esto puede deberse a:\n\n• Problemas temporales con el servicio de búsqueda\n• El PDF no contiene información de vuelos válida\n• Error de conectividad\n\n¿Podrías intentarlo nuevamente o proporcionarme manualmente los detalles del vuelo?`
            },
            meta: {
              status: 'sent',
              messageType: 'error_response'
            }
          });

          setIsLoading(false);
        }
      })();

      return; // Exit early, don't process as regular message
    }

    // If user asks to add a hotel for same dates after flight results, coerce to combined using last flight context
    if (isAddHotelRequest(currentMessage)) {
      // Load persistent context state first, then fallback to other sources
      const persistentState = await loadContextState(currentConversationId) as ContextState | null;
      
      const flightCtx = persistentState?.lastSearch?.flightsParams || null;
      if (flightCtx) {
        // No parsed payload yet -- this branch runs BEFORE the LLM parser, so
        // pass null and let the function fall back to the legacy message regex.
        const hotelPreferences = detectHotelPreferencesFromMessage(null, currentMessage);
        console.log('🏨 [INTENT] Add hotel detected, reusing flight context for combined search');
        console.log('🏨 [INTENT] Flight context:', flightCtx);
        console.log('🏨 [INTENT] Persistent state:', persistentState);
        setMessage('');
        setIsLoading(true);
        try {
          // Generate unique client_id for idempotency
          const clientId = crypto.randomUUID();
          console.log('🔑 [ADD HOTEL] Generated client_id:', clientId);

          // ⚡ Optimistic UI update - add user message to UI immediately
          const optimisticUserMessage = {
            id: `temp-${clientId}`,
            conversation_id: currentConversationId,
            role: 'user' as const,
            content: { text: currentMessage.trim() },
            meta: { status: 'sending', client_id: clientId, messageType: 'add_hotel_intent' },
            created_at: new Date().toISOString()
          };

          // Add to local messages immediately (Realtime will replace with real message from DB)
          addOptimisticMessage(optimisticUserMessage as any);

          // Save user's intent message into conversation (in background)
          await saveAndDisplayMessage({
            conversation_id: currentConversationId,
            role: 'user' as const,
            content: { text: currentMessage.trim() },
            meta: { status: 'sent', messageType: 'add_hotel_intent', client_id: clientId }
          });

          // Build a hotels-only request using flight context (city/dates/pax inferred)
          const hotelsParsed: ParsedTravelRequest = {
            requestType: 'hotels',
            hotels: {
              city: flightCtx.destination,
              checkinDate: flightCtx.departureDate,
              checkoutDate: flightCtx.returnDate || new Date(new Date(flightCtx.departureDate).getTime() + 3 * 86400000).toISOString().split('T')[0],
              adults: flightCtx.adults,
              children: flightCtx.children,
              infants: flightCtx.infants,
              ...(hotelPreferences.roomType ? { roomType: hotelPreferences.roomType } : {}),
              ...(hotelPreferences.mealPlan ? { mealPlan: hotelPreferences.mealPlan } : {}),
              ...(hotelPreferences.hotelChains.length > 0 ? { hotelChains: hotelPreferences.hotelChains } : {})
            },
            confidence: 0.9,
            originalMessage: currentMessage
          } as any;

          console.log('🏨 [INTENT] Hotel request built:', {
            city: hotelsParsed.hotels?.city,
            checkinDate: hotelsParsed.hotels?.checkinDate,
            checkoutDate: hotelsParsed.hotels?.checkoutDate,
            adults: hotelsParsed.hotels?.adults,
            flightCtx: flightCtx
          });

          // Persist context for follow-ups
          await saveContextualMemory(currentConversationId, hotelsParsed);

          // Run HOTELS search only
          const hotelResult = await handleHotelSearch(hotelsParsed);

          await saveAndDisplayMessage({
            conversation_id: currentConversationId,
            role: 'assistant' as const,
            content: { text: hotelResult.response },
            meta: hotelResult.data ? { ...hotelResult.data, responseLanguage: userLanguage } : { responseLanguage: userLanguage }
          });

          setMessage('');
          setIsLoading(false);
          return;
        } catch (err) {
          console.error('❌ [INTENT] Add hotel flow failed:', err);
          setIsLoading(false);
          // fall through to normal flow
        }
      } else {
        console.warn('⚠️ [INTENT] Add hotel detected but no flight context found');
        console.warn('⚠️ [INTENT] Available sources:', {
          persistentState,
        });
        // Continue to normal AI parsing flow
      }
    }

    // Check if this is a price change request for a previously uploaded PDF
    if (isPriceChangeRequest(currentMessage)) {
      console.log('💰 [PRICE CHANGE] Detected price change request for previous PDF');

      // Clear the input immediately
      setMessage('');

      // Run the price change process in the background
      (async () => {
        setIsLoading(true);
        try {
          // Generate unique client_id for idempotency
          const clientId = crypto.randomUUID();
          console.log('🔑 [PRICE CHANGE] Generated client_id:', clientId);

          // ⚡ Optimistic UI update - add user message to UI immediately
          const optimisticUserMessage = {
            id: `temp-${clientId}`,
            conversation_id: currentConversationId,
            role: 'user' as const,
            content: { text: currentMessage.trim() },
            meta: { status: 'sending', client_id: clientId, messageType: 'price_change_request' },
            created_at: new Date().toISOString()
          };

          // Add to local messages immediately (Realtime will replace with real message from DB)
          addOptimisticMessage(optimisticUserMessage as any);

          // Show typing indicator while processing price change
          setIsTyping(true, currentConversationId);
          setTypingMessage(typingCopy.changingPrice, currentConversationId);

          // Add user message to database (in background)
          await saveAndDisplayMessage({
            conversation_id: currentConversationId,
            role: 'user' as const,
            content: { text: currentMessage.trim() },
            meta: { status: 'sent', messageType: 'price_change_request', client_id: clientId }
          });

          // Update typing message while generating PDF
          setTypingMessage(typingCopy.generatingPdf, currentConversationId);

          const result = await handlePriceChangeRequest(currentMessage);

          // CRITICAL: If no PDF exists, handlePriceChangeRequest returns null
          if (!result) {
            console.log('❌ [PRICE CHANGE] No PDF analysis found for this conversation');

            // Inform user they need to upload a PDF first
            await saveAndDisplayMessage({
              conversation_id: currentConversationId,
              role: 'assistant' as const,
              content: {
                text: '❌ **No hay PDF analizado**\n\nPara modificar precios, primero necesito que subas o arrastres un PDF con la cotización que deseas modificar.\n\n📄 Una vez que analice el PDF, podré ayudarte a cambiar los precios según lo que necesites.'
              },
              meta: {
                status: 'sent',
                messageType: 'error_no_pdf'
              }
            });

            // Clear typing indicator AND message
            setTypingMessage('', currentConversationId);
            setIsTyping(false, currentConversationId);
            setIsLoading(false);
            return; // Exit early - PDF validation failed
          }

          // PDF exists and price change was processed
          if (result) {
            // Add assistant response
            await saveAndDisplayMessage({
              conversation_id: currentConversationId,
              role: 'assistant' as const,
              content: {
                text: result.response,
                pdfUrl: result.modifiedPdfUrl,
                metadata: {
                  type: 'price_change_response',
                  hasModifiedPdf: !!result.modifiedPdfUrl
                }
              },
              meta: {
                status: 'sent',
                messageType: result.modifiedPdfUrl ? 'pdf_generated' : 'price_change_response'
              }
            });

            if (result.modifiedPdfUrl) {
              toast({
                title: t('toasts.pdfModified.title'),
                description: t('toasts.pdfModified.description'),
              });
            }
          }
        } catch (error) {
          console.error('❌ Error processing price change request:', error);

          // Send error message to user
          await saveAndDisplayMessage({
            conversation_id: currentConversationId,
            role: 'assistant' as const,
            content: {
              text: '❌ **Error al procesar cambio de precio**\n\nNo pude procesar tu solicitud de cambio de precio. Por favor, verifica que:\n\n• El PDF esté correctamente analizado\n• El precio que indicaste sea un número válido\n• Intenta nuevamente en unos momentos'
            },
            meta: {
              status: 'sent',
              messageType: 'error_response'
            }
          });

          toast({
            title: t('toasts.priceChangeFailed.title'),
            description: t('toasts.priceChangeFailed.description'),
            variant: "destructive",
          });
        } finally {
          // Clear typing indicator AND message
          setTypingMessage('', currentConversationId);
          setIsTyping(false, currentConversationId);
          setIsLoading(false);
        }
      })();

      return; // Exit early, don't continue with normal flow
    }

    setMessage('');
    setIsLoading(true);

    // ✅ CAPTURE conversation ID at the start - this ensures typing state is updated for THIS conversation
    // even if user switches to another conversation while this search is running
    const conversationIdForThisSearch = currentConversationId;

    setIsTyping(true, conversationIdForThisSearch);
    setTypingMessage(typingCopy.checkingRequest, conversationIdForThisSearch);

    console.log('✅ [MESSAGE FLOW] Step 1: Message validation passed');
    console.log('📨 Processing message:', currentMessage);
    console.log('🔑 [CONVERSATION] Captured conversation ID for this search:', conversationIdForThisSearch);

    // ✅ WAIT FOR REAL CONVERSATION ID: If conversation is temporary, wait for it to be created
    let finalConversationId = currentConversationId;
    if (currentConversationId.startsWith('temp-')) {
      console.log('⏳ [CONVERSATION] Waiting for temporary conversation to be created:', currentConversationId);

      // Poll until conversation ID is real (max 5 seconds)
      const maxWaitTime = 5000; // 5 seconds max
      const pollInterval = 50; // Check every 50ms
      const startTime = Date.now();

      // Poll the ref until it's not a temp ID
      while (
        selectedConversationRef.current?.startsWith('temp-') &&
        Date.now() - startTime < maxWaitTime
      ) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      if (selectedConversationRef.current?.startsWith('temp-')) {
        console.error('❌ [CONVERSATION] Timeout waiting for conversation creation');
        throw new Error('Timeout esperando la creación de la conversación');
      }

      // Update local variable with real ID
      finalConversationId = selectedConversationRef.current!;
      console.log('✅ [CONVERSATION] Got real conversation ID:', finalConversationId);
    }

    let assistantStreamDraft: AssistantResponseStreamDraft | null = null;
    const chatRunId = crypto.randomUUID();
    const turnStartedAt = nowMs();
    const queuedLatencyEvents: ChatLatencyEvent[] = [];
    let traceAgencyId: string | null = null;
    let firstVisibleResponseRecorded = false;
    const emitLatency = (event: ChatLatencyEvent) => {
      if (!traceAgencyId) {
        queuedLatencyEvents.push(event);
        return;
      }
      recordChatLatencyEvent({
        ...event,
        conversationId: finalConversationId,
        agencyId: traceAgencyId,
        runId: chatRunId,
      });
    };
    const flushQueuedLatency = () => {
      if (!traceAgencyId) return;
      queuedLatencyEvents.splice(0).forEach((event) => emitLatency(event));
    };
    const persistContextualMemoryInBackground = (request: ParsedTravelRequest, stage: string) => {
      const persistStart = nowMs();
      void saveContextualMemory(finalConversationId, request)
        .then(() => {
          emitLatency({
            stage,
            latencyMs: nowMs() - persistStart,
            payload: { requestType: request.requestType },
          });
        })
        .catch((e) => {
          emitLatency({
            stage,
            latencyMs: nowMs() - persistStart,
            status: 'error',
            error: e,
            payload: { requestType: request.requestType },
          });
          console.warn('⚠️ [MEMORY] Failed to save contextual memory:', e);
        });
    };
    const persistContextualMemoryBeforeAsk = async (request: ParsedTravelRequest, stage: string) => {
      const persistStart = nowMs();
      try {
        await saveContextualMemory(finalConversationId, request);
        emitLatency({
          stage,
          latencyMs: nowMs() - persistStart,
          payload: { requestType: request.requestType, critical: true },
        });
      } catch (e) {
        emitLatency({
          stage,
          latencyMs: nowMs() - persistStart,
          status: 'error',
          error: e,
          payload: { requestType: request.requestType, critical: true },
        });
        console.warn('⚠️ [MEMORY] Failed to save contextual memory before asking:', e);
      }
    };
    const clearContextualMemoryInBackground = (stage: string) => {
      const clearStart = nowMs();
      void clearContextualMemory(finalConversationId)
        .then(() => {
          emitLatency({ stage, latencyMs: nowMs() - clearStart });
        })
        .catch((e) => {
          emitLatency({ stage, latencyMs: nowMs() - clearStart, status: 'error', error: e });
        console.warn('⚠️ [MEMORY] Failed to clear contextual memory:', e);
      });
    };
    const emitFirstVisibleResponse = (requestType: string, chars: number, phase: 'progress' | 'final') => {
      if (firstVisibleResponseRecorded) return;
      firstVisibleResponseRecorded = true;
      emitLatency({
        stage: 'first_visible_response',
        latencyMs: nowMs() - turnStartedAt,
        payload: { requestType, chars, phase },
      });
    };
    const removeAssistantStreamDraft = () => {
      if (!assistantStreamDraft) return;
      assistantStreamDraft.cancel();
      removeOptimisticMessage(assistantStreamDraft.id);
      assistantStreamDraft = null;
    };
    const showProgressAssistantResponse = (text: string, requestType: string) => {
      if (assistantStreamDraft || !text.trim()) return;
      assistantStreamDraft = startAssistantResponseStream(finalConversationId, text);
      if (!assistantStreamDraft) return;
      emitFirstVisibleResponse(requestType, text.length, 'progress');
      setIsTyping(false, conversationIdForThisSearch);
    };

    try {
      // 1. Generate unique client_id for idempotency (prevents duplicates)
      // Using crypto.randomUUID() - native browser/Node API, no external deps needed
      const clientId = crypto.randomUUID();
      console.log('🔑 [IDEMPOTENCY] Generated client_id:', clientId);

      // 2. Optimistic UI update - add user message to UI immediately (without waiting for DB)
      console.log('⚡ [OPTIMISTIC UI] Adding user message to UI instantly');
      const optimisticUserMessage = {
        id: `temp-${clientId}`, // Use client_id in temp ID for easier reconciliation
        conversation_id: finalConversationId,
        role: 'user' as const,
        content: { text: currentMessage },
        meta: { status: 'sending', client_id: clientId }, // Include client_id for de-dupe
        created_at: new Date().toISOString()
      };

      // Add to local messages immediately (Realtime will replace with real message from DB)
      addOptimisticMessage(optimisticUserMessage as any);

      console.log('📤 [MESSAGE FLOW] Step 2: Saving user message + loading context in parallel');

      // 2. Update conversation title if first message (fire-and-forget)
      const isPdfUpload = currentMessage.toLowerCase().includes('he subido el pdf') ||
        currentMessage.toLowerCase().includes('pdf para análisis');

      if (messages.length === 0 && !isPdfUpload) {
        const title = generateChatTitle(currentMessage);
        updateConversationTitle(finalConversationId, title).catch((titleError) => {
          console.error('❌ [MESSAGE FLOW] Error updating conversation title:', titleError);
        });
      }

      // Check if we can use preloaded context (same conversation, not first message)
      const canUsePreloaded = preloadedContext &&
        preloadedContext.conversationId === finalConversationId &&
        messages.length > 0;

      // Run DB save + context loading in parallel
      const saveAndContextStart = nowMs();
      const [
        userMessage,
        loadedContextFromDB,
        loadedPersistentState,
        loadedLeadId,
      ] = await Promise.all([
        addMessageViaSupabase({
          conversation_id: finalConversationId,
          role: 'user' as const,
          content: { text: currentMessage },
          meta: { status: 'sent', client_id: clientId }
        }),
        canUsePreloaded
          ? Promise.resolve(preloadedContext!.contextualMemory)
          : loadContextualMemory(finalConversationId),
        canUsePreloaded
          ? Promise.resolve(preloadedContext!.contextState)
          : loadContextState(finalConversationId) as Promise<ContextState | null>,
        canUsePreloaded
          ? Promise.resolve(preloadedContext!.leadId)
          : resolveLeadIdForConversation(finalConversationId),
      ]);

      let contextFromDB = loadedContextFromDB;
      let persistentState = loadedPersistentState;
      let leadId = loadedLeadId;

      if (canUsePreloaded && (!contextFromDB || !persistentState || !leadId)) {
        const [freshContextFromDB, freshPersistentState, freshLeadId] = await Promise.all([
          contextFromDB ? Promise.resolve(contextFromDB) : loadContextualMemory(finalConversationId),
          persistentState ? Promise.resolve(persistentState) : loadContextState(finalConversationId) as Promise<ContextState | null>,
          leadId ? Promise.resolve(leadId) : resolveLeadIdForConversation(finalConversationId),
        ]);

        contextFromDB = freshContextFromDB;
        persistentState = freshPersistentState;
        leadId = freshLeadId;
      }

      logTimingStep('MESSAGE FLOW', 'save user message + load context', saveAndContextStart, {
        canUsePreloaded,
        hasContextFromDb: Boolean(contextFromDB),
        hasPersistentState: Boolean(persistentState),
        hasLeadId: Boolean(leadId),
      });
      emitLatency({
        stage: 'db_context',
        latencyMs: nowMs() - saveAndContextStart,
        payload: {
          canUsePreloaded,
          hasContextFromDb: Boolean(contextFromDB),
          hasPersistentState: Boolean(persistentState),
          hasLeadId: Boolean(leadId),
        },
      });

      console.log('✅ [MESSAGE FLOW] Step 3: User message saved + context loaded in parallel');
      console.log('🔍 [DEBUG] Context loaded from DB:', contextFromDB);
      console.log('🔍 [DEBUG] Persistent context state:', persistentState);

      // 🔄 ITERATION DETECTION: Check if this message is an iteration on previous search
      const iterationContext = detectIterationIntent(currentMessage, persistentState);
      console.log('🔄 [ITERATION] Detection result:', {
        isIteration: iterationContext.isIteration,
        type: iterationContext.iterationType,
        baseRequestType: iterationContext.baseRequestType,
        modifiedComponent: iterationContext.modifiedComponent,
        confidence: iterationContext.confidence,
        matchedPattern: iterationContext.matchedPattern
      });

      // 🧹 Clean context for new conversations (first message)
      let contextToUse = null;
      const isFirstMessage = messages.length === 0;
      const hasNoStoredContext = !contextFromDB && !persistentState;

      if (isFirstMessage) {
        console.log('🧹 [NEW CONVERSATION] First message detected - starting fresh');
        contextToUse = null;
      } else if (hasNoStoredContext) {
        console.log('🧹 [NEW CONVERSATION] No stored context - falling back to planner context if available');
        contextToUse = plannerContextRequest || null;
      } else {
        contextToUse = contextFromDB || plannerContextRequest || persistentState;
      }
      console.log('📝 [CONTEXT] Final context to use:', contextToUse);

      // 4. Use AI Parser to classify request
      console.log('🤖 [MESSAGE FLOW] Step 8: Starting AI parsing process');
      console.log('📤 [MESSAGE FLOW] About to call AI message parser (Supabase Edge Function)');
      console.log('🧠 Message to parse:', currentMessage);

      setTypingMessage(typingCopy.analyzingMessage, conversationIdForThisSearch);

      // ✅ Helper to get client_id from message (checks direct column first, then meta)
      const getClientId = (msg: any): string | null | undefined => {
        if (msg.client_id) return msg.client_id;
        const meta = msg.meta as any;
        return meta?.client_id;
      };

      // Prepare full conversation history for better context understanding
      // ✅ FIX: Filter out optimistic messages (temp-*) to prevent sending duplicates to AI
      // Also filter duplicates by client_id to ensure unique messages only
      const seenClientIds = new Set<string>();
      const conversationHistory = (messages || [])
        .filter(msg => {
          const meta = msg.meta as any;
          if (msg.role === 'system' && meta && (
            meta.messageType === 'contextual_memory' ||
            meta.messageType === 'context_state' ||
            meta.messageType === 'trip_planner_state' ||
            meta.messageType === 'conversation_summary'
          )) {
            return false;
          }

          // Skip optimistic messages (they will be replaced by real ones)
          if (msg.id.toString().startsWith('temp-')) {
            const clientId = getClientId(msg);
            if (clientId && seenClientIds.has(clientId)) {
              return false; // Skip duplicate optimistic message
            }
            if (clientId) {
              seenClientIds.add(clientId);
            }
            // Check if there's a real message with same client_id already
            const hasRealMessage = messages?.some(realMsg =>
              !realMsg.id.toString().startsWith('temp-') &&
              getClientId(realMsg) === clientId
            );
            if (hasRealMessage) {
              console.log('🔒 [HISTORY] Skipping optimistic message, real message exists:', clientId);
              return false; // Skip optimistic if real message exists
            }
            // Keep optimistic only if no real message found
            return true;
          }

          // For real messages, check for duplicates by client_id
          const clientId = getClientId(msg);
          if (clientId) {
            if (seenClientIds.has(clientId)) {
              console.log('🔒 [HISTORY] Skipping duplicate message by client_id:', clientId);
              return false;
            }
            seenClientIds.add(clientId);
          }

          return true;
        })
        .slice(-6)
        .map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string'
            ? msg.content
            : typeof msg.content === 'object' && msg.content !== null
              ? (msg.content as { text?: string }).text || ''
              : '',
          timestamp: msg.created_at
        }));

      console.log('📚 [CONTEXT] Sending full conversation history to AI parser:', {
        messageCount: conversationHistory.length,
        originalMessageCount: messages?.length || 0,
        filtered: (messages?.length || 0) - conversationHistory.length,
        previousContext: contextToUse ? 'Yes' : 'No'
      });

      // === Context Engineering bootstrap ===
      // Bootstrap (or load) the EmiliaState for this conversation, sync mode,
      // register the active planner ref, and render a memoryStateBlock for the
      // parser. On bootstrap failure (e.g., agency_id resolution error) the
      // returned ctxEngState is null — the `if (ctxEngState)` guards below are
      // defensive against that case.
      const turnPrepStart = nowMs();
      const turnPrep = await prepareTurnContext({
        conversationId: finalConversationId,
        leadId: leadId ?? null,
        chatMode,
        plannerState: plannerState as TripPlannerState | null,
      });
      let ctxEngState: EmiliaState | null = turnPrep.ctxEngState;
      const memoryStateBlock: string | undefined = turnPrep.memoryStateBlock;
      traceAgencyId = ctxEngState?.profile.agency_id ?? null;
      flushQueuedLatency();
      emitLatency({
        stage: 'context_state',
        latencyMs: nowMs() - turnPrepStart,
        payload: {
          hasCtxEngState: Boolean(ctxEngState),
          hasMemoryStateBlock: Boolean(memoryStateBlock),
          chatMode: chatMode ?? 'passenger',
        },
      });

      // === EMILIA 5.0: PARSE + ROUTE ===
      // Always parse first, then route based on content (not workspace_mode)
      const parseStart = nowMs();
      const plannerEditContext = buildPlannerEditContext(plannerState as TripPlannerState | null);
      // Pre-parse: compute the discovery guard + tool_choice policy. The
      // guard is a pure function over `currentMessage`; we hoist it here so
      // the resulting tool_choice can be forwarded to the edge function.
      // The same `discoveryGuard` is reused after the parser response for
      // the safety-net branch (lines below the parser call).
      const preParseDiscoveryGuard = isDiscoveryQuery(currentMessage);
      const hasActivePlannerForToolChoice = Boolean(plannerEditContext?.hasActivePlan && plannerState);
      const toolChoiceForTurn = resolveToolChoice({
        hasActivePlanner: hasActivePlannerForToolChoice,
        hasPendingAction: Boolean(ctxEngState?.pending_action),
        discoveryGuard: preParseDiscoveryGuard,
      });

      let parsedRequest = await parseMessageWithAIStreaming(
        currentMessage,
        {
          plannerContext: plannerEditContext,
          previousContext: contextToUse,
          contextMeta: {
            conversationId: finalConversationId,
            leadId: leadId ?? null,
          },
          historyWindow: 15,
          memoryStateBlock,
          // Pass the freshly-saved state so the edge function can skip its own
          // SELECT on agent_states (~30–50 ms saved per turn).
          ...(ctxEngState ? { emiliaState: ctxEngState } : {}),
          // Per-turn tool_choice: restricts the model to relevant tools or
          // forces discover_places when the guard is high-confidence.
          toolChoice: toolChoiceForTurn,
        },
        userLanguage,
        (event) => {
          if (event.type === 'status') {
            setTypingMessage(event.message || typingCopy.processing, conversationIdForThisSearch);
            return;
          }
          if (event.type !== 'tool_start') return;
          setTypingMessage(typingCopy.toolLabels[event.tool as keyof typeof typingCopy.toolLabels] ?? typingCopy.processing, conversationIdForThisSearch);
        },
      );
      parsedRequest.responseLanguage = userLanguage;

      // Deterministic normalization layer (Phase 1 + Phase 2 + Phase 4):
      // Fills structural defaults the parser leaves for the client to derive:
      //   Phase 1 — travelerType → adults, pax → roomType.
      //   Phase 2 — partialStay (vuelo + hotel parcial) and relativeDateHint
      //             (tomorrow / this_weekend / next_week / next_month).
      //   Phase 4 — applyDateFallback: structural today+3 / checkin+7 fallback
      //             for any dates still empty after upstream steps.
      // The `new Date()` clock keeps the normalizer coherent with the same
      // source feeding `currentDate` inside `aiMessageParser.parseMessageWithAI`.
      // Pure function — see `searchIntentNormalizer.ts`. Runs AFTER
      // `resolveTurnIntent` (below) so context-specific enrichments (e.g.
      // hotel follow-up reusing the previous flight search's dates) win over
      // the structural fallback. Phases 1+2 don't depend on the turn-intent
      // pass; only the new Phase 4 fallback does.
      // Explicit user values always win.

      // Phase 5: increment turn count after a successful parse. Failures here
      // do not break the flow.
      if (ctxEngState) {
        ctxEngState = await bumpTurnCount(ctxEngState);
      }
      logTimingStep('MESSAGE FLOW', 'parseMessageWithAI', parseStart, {
        requestType: parsedRequest.requestType,
      });
      emitLatency({
        stage: 'parser_ce',
        latencyMs: nowMs() - parseStart,
        payload: {
          requestType: parsedRequest.requestType,
          hasToolResult: Boolean(parsedRequest.placeDiscoveryResult),
        },
      });

      // === Phase 5: pending_action READ — apply any slot values the tool
      // loop resolved this turn. This is the GENERAL mechanism: any handler
      // that previously asked for input via setPendingAction sees its prompt
      // answered here, regardless of which domain it belongs to.
      if (
        ctxEngState &&
        parsedRequest.pendingActionResolution?.kind === 'awaiting_user_input'
      ) {
        ctxEngState = await consumePendingActionResolution({
          ctxEngState,
          resolution: parsedRequest.pendingActionResolution,
          plannerState: plannerState as TripPlannerState | null,
          updatePlannerState,
        });
      }

      const effectiveMode = resolveEffectiveMode(options?.mode, chatMode);
      const hasActivePlanner = Boolean(plannerEditContext?.hasActivePlan && plannerState);
      // Reuse the guard computed pre-parse (same input, pure function).
      const discoveryGuard = preParseDiscoveryGuard;
      const shouldTreatAsPlannerEdit = hasActivePlanner
        && !isExplicitPlannerRestart(currentMessage)
        && !discoveryGuard.isDiscovery
        && (workspaceMode === 'planner' || effectiveMode === 'passenger');

      if (shouldTreatAsPlannerEdit && plannerState) {
        if (parsedRequest.requestType === 'general') {
          console.log('🗺️ [PLANNER EDIT] Coercing general response into custom planner instruction');
          parsedRequest = {
            requestType: 'itinerary',
            itinerary: buildPlannerItinerarySnapshot(plannerState as TripPlannerState, currentMessage),
            confidence: Math.max(parsedRequest.confidence || 0, 0.55),
            originalMessage: parsedRequest.originalMessage || currentMessage,
          };
        } else if (parsedRequest.requestType === 'itinerary') {
          parsedRequest = {
            ...parsedRequest,
            itinerary: {
              ...buildPlannerItinerarySnapshot(plannerState as TripPlannerState, currentMessage),
              ...parsedRequest.itinerary,
              destinations: parsedRequest.itinerary?.destinations?.length
                ? parsedRequest.itinerary.destinations
                : (plannerState as TripPlannerState).destinations,
              editIntent: parsedRequest.itinerary?.editIntent || {
                action: 'custom_instruction',
                scope: 'plan',
                rawInstruction: currentMessage,
                confidence: 0.6,
              },
            },
          };
        }
      } else if (hasActivePlanner && isExplicitPlannerRestart(currentMessage) && parsedRequest.requestType === 'itinerary') {
        parsedRequest = {
          ...parsedRequest,
          itinerary: {
            ...parsedRequest.itinerary!,
            editIntent: {
              ...parsedRequest.itinerary?.editIntent,
              action: 'restart_plan',
              scope: 'plan',
              rawInstruction: currentMessage,
              confidence: Math.max(parsedRequest.itinerary?.editIntent?.confidence || 0, 0.8),
            },
          },
        };
      }

      // Safety net: if guard fires but the LLM didn't call discover_places, force
      // the discovery branch with empty places. This prevents silent fallback to
      // handleItineraryRequest (which would fabricate a 7-day plan). The UI shows
      // a graceful "no places found, refine your query" state.
      if (discoveryGuard.isDiscovery && !parsedRequest.placeDiscoveryResult?.ok) {
        console.warn('[DISCOVERY-GUARD] Detected discovery intent but parser did not call discover_places — forcing show_places branch.', {
          message: currentMessage,
          reason: discoveryGuard.reason,
          parsedType: parsedRequest.requestType,
        });

        const dest = extractDestinationFromMessage(currentMessage, plannerState as { destinations?: Array<{ city?: string; country?: string }> } | null);
        const cats = extractCategoriesFromMessage(currentMessage);

        parsedRequest = {
          ...parsedRequest,
          requestType: 'itinerary',
          placeDiscoveryResult: {
            ok: true,
            intent: 'broad',
            destination: dest,
            categories: cats,
            places: [], // empty — UI will surface "no places, refine query"
          } as ParsedTravelRequest['placeDiscoveryResult'],
          // strip any editIntent the model emitted under planner pressure
          itinerary: parsedRequest.itinerary
            ? { ...parsedRequest.itinerary, editIntent: undefined }
            : undefined,
        };
      }

      const preRouteTravelBridge = resolveTravelContextBridge({
        message: currentMessage,
        parsedRequest,
        plannerState: plannerState as TripPlannerState | null,
        persistentState,
      });
      if (preRouteTravelBridge.kind === 'quote_to_plan') {
        console.log('🔁 [TRAVEL BRIDGE] Reusing quote/search context to build itinerary');
        parsedRequest = preRouteTravelBridge.parsedRequest;
      }

      const turnIntentResolution = resolveTurnIntent({
        message: currentMessage,
        parsedRequest,
        persistentState,
      });
      if (turnIntentResolution.resolvedRequest !== parsedRequest) {
        parsedRequest = turnIntentResolution.resolvedRequest;
        console.log('🧠 [INTENT] Resolved turn intent before routing', {
          resolvedIntent: turnIntentResolution.resolvedIntent,
          contextUsed: turnIntentResolution.contextUsed,
          invalidatedServerRoute: turnIntentResolution.invalidatedServerRoute,
          reason: turnIntentResolution.reason,
          requestType: parsedRequest.requestType,
        });
      }

      // Phase 4: search-intent normalizer (Phases 1+2+4). Runs AFTER
      // `resolveTurnIntent` so that turn-intent enrichments (e.g. hotel
      // follow-ups inheriting dates from the previous flight search) win over
      // the structural date fallback. The normalizer's date fallback only
      // fires if a date is still empty at this point. Pure function; explicit
      // user values always win. See `searchIntentNormalizer.ts`.
      parsedRequest = normalizeSearchIntent(parsedRequest, new Date());

      if (leadId) {
        // DEBT-15: write-only path. The reader (lead profile load + prompt
        // injection) was deleted; the model now retrieves lead history via
        // the `get_lead_full_history` retrieval tool when needed.
        const nextLeadProfile = mergeLeadAiProfile(null, parsedRequest, {
          leadId,
          sourceConversationId: finalConversationId,
        });
        saveLeadAiProfile(nextLeadProfile).catch((e) => console.warn('⚠️ [LEAD_AI_PROFILE] Failed to save lead profile:', e));
      }

      const routingStart = nowMs();
      const routeResult = routeRequest(parsedRequest, plannerState);
      emitLatency({
        stage: 'routing',
        latencyMs: nowMs() - routingStart,
        payload: {
          route: routeResult.route,
          requestType: parsedRequest.requestType,
        },
      });
      const travelContextBridge = resolveTravelContextBridge({
        message: currentMessage,
        parsedRequest,
        plannerState: plannerState as TripPlannerState | null,
        persistentState,
        routeResult,
      });
      const isQuoteActivePlanTurn = travelContextBridge.kind === 'plan_to_quote';
      if (isQuoteActivePlanTurn && travelContextBridge.parsedRequest.requestType !== parsedRequest.requestType) {
        console.log('🔁 [TRAVEL BRIDGE] Converting active planner into quote/search request');
        parsedRequest = travelContextBridge.parsedRequest;
      }
      console.log('🧭 [ROUTER] Emilia route decision:', {
        route: routeResult.route,
        score: routeResult.score.toFixed(2),
        dimensions: routeResult.dimensions,
        missingFields: routeResult.missingFields,
        reason: routeResult.reason,
      });

      const MAX_COLLECT_TURNS = 3;
      const recentCollectCount = (messages || [])
        .filter(m =>
          m.conversation_id === finalConversationId &&
          m.role === 'assistant' &&
          (m.meta as Record<string, unknown>)?.messageType === 'collect_question'
        )
        .slice(-MAX_COLLECT_TURNS)
        .length;
      const recentCollectCountForTurn = shouldPushToDelivery
        ? MAX_COLLECT_TURNS
        : recentCollectCount;

      // PR 3 (C4): read the last assistant message's messageType so the
      // orchestrator can apply guardrail G1 (anti-loop for mode_bridge).
      // Passed regardless of whether `mode` is defined — the legacy path
      // ignores it safely. Value becomes meaningful once C5 wires `mode`
      // from ChatFeature.
      const previousAssistant = [...(messages || [])]
        .filter((m) => m.conversation_id === finalConversationId && m.role === 'assistant')
        .pop();
      const previousMessageType =
        ((previousAssistant?.meta as Record<string, unknown> | undefined)?.messageType as
          | string
          | undefined) || undefined;

      // C7.1.a: options.mode wins over the closure-captured chatMode. Bridge
      // chip handlers that just called setChatMode pass it explicitly.
      // C8 (Phase 5): orchestrator now requires `mode`. Consumer / B2C call
      // sites still pass `chatMode === undefined` (ChatFeature gates the
      // prop on `accountType === 'agent'`); for those we default to
      // 'passenger' here. The legacy mode-undefined fallthrough in the
      // orchestrator was deleted, and 'passenger' produces the same
      // standard_itinerary-leaning behavior consumers had on the legacy
      // path. See orchestrator JSDoc on `mode`.
      const conversationTurn = resolveConversationTurn({
        parsedRequest,
        routeResult,
        plannerState,
        hasPersistentContext: Boolean(contextToUse),
        // Phase 6: previousParsedRequest React state was deleted. Persistent
        // context (lastSearch in DB) is the only memory source now, surfaced
        // via `hasPersistentContext` above.
        hasPreviousParsedRequest: false,
        recentCollectCount: recentCollectCountForTurn,
        maxCollectTurns: MAX_COLLECT_TURNS,
        previousMessageType,
        forceCurrentMode: options?.forceCurrentMode,
        mode: effectiveMode ?? 'passenger',
        // Suppress mode_bridge while the assistant is mid-ask. ctxEngState
        // reflects the LATEST (post-resolution) pending_action; we already
        // cleared it above when the model resolved it via apply_slot_values.
        hasPendingAction: Boolean(ctxEngState?.pending_action),
      });

      console.log('🧠 [CONVERSATION] Turn resolution:', conversationTurn);

      // === EMILIA COLLECT: router-detected gaps that benefit from a clean single question ===
      // Intercepts when:
      //   1. Passenger ambiguity ("familia" without count) — validation doesn't catch this
      //   2. Quote intent but incomplete, AND no previous context to fill gaps
      // Max 3 consecutive COLLECT turns — after that, fall through to PLAN or existing validation
      const collectExhausted = recentCollectCountForTurn >= MAX_COLLECT_TURNS;

      if (collectExhausted && routeResult.route === 'COLLECT') {
        console.log(`🔄 [COLLECT] ${MAX_COLLECT_TURNS} turns exhausted — falling through to standard flow`);
      }

      if (conversationTurn.shouldAskMinimalQuestion && routeResult.collectQuestion && !shouldPushToDelivery) {
        console.log('🔄 [COLLECT] Router intercepting with focused question:', routeResult.reason, `(turn ${recentCollectCount + 1}/${MAX_COLLECT_TURNS})`);
        await persistContextualMemoryBeforeAsk(parsedRequest, 'context_memory_save_collect');

        const collectMessage = buildEmiliaSearchNarrative({
          mode: 'collect',
          normalized: parsedRequest,
          missingFields: routeResult.missingFields,
          fallbackMessage: routeResult.collectQuestion,
          language: userLanguage,
        }).text;

        // Phase 2: additive pending_action emit. Router COLLECT fields are
        // already canonical (destination/dates/passengers/origin) — no rename.
        if (ctxEngState) {
          const plannerId = (plannerState as TripPlannerState | null)?.id;
          ctxEngState = await emitPendingAction({
            ctxEngState,
            action: {
              kind: 'awaiting_user_input',
              for: 'collect_clarification',
              fields: routeResult.missingFields,
              prompt: (routeResult.collectQuestion || collectMessage).slice(0, 240),
              ref: plannerId ? { type: 'plan', id: plannerId } : undefined,
              issuedAt: new Date().toISOString(),
            },
          });
        }

        await saveAndDisplayMessage({
          conversation_id: finalConversationId,
          role: 'assistant' as const,
          content: { text: collectMessage },
          meta: {
            status: 'sent',
            messageType: conversationTurn.messageType,
            responseMode: conversationTurn.responseMode,
            routeScore: routeResult.score,
            collectTurn: recentCollectCount + 1,
            missingFields: conversationTurn.normalizedMissingFields,
            normalizedMissingFields: conversationTurn.normalizedMissingFields,
            originalRequest: parsedRequest,
            requestText: parsedRequest.originalMessage || currentMessage,
            conversationTurn,
            suggestedActions: buildSuggestedActions({
              parsedRequest,
              plannerState: plannerState as TripPlannerState | null,
              assistantResponseNumber: assistantResponseCountBeforeTurn + 1,
              language: userLanguage,
            }),
          }
        });

        setIsTyping(false, conversationIdForThisSearch);
        setIsLoading(false);
        flowTimer.end('collect - router template question', {
          route: routeResult.route,
          collectTurn: recentCollectCount + 1,
          missingFields: routeResult.missingFields,
        });
        return;
      }

      // === MODE_BRIDGE BRANCH (PR 3 / C4) ===
      // Emitted by the orchestrator when content doesn't match the active
      // mode. Persisted as its own assistant message with messageType=
      // 'mode_bridge'; ChatInterface reads meta.suggestedMode and renders the
      // 2 chips (switch / stay). Unreachable at runtime until C5 passes
      // `mode` from ChatFeature.
      if (conversationTurn.executionBranch === 'mode_bridge') {
        const suggestedMode = conversationTurn.uiMeta.suggestedMode;
        console.log('🌉 [MODE BRIDGE] Emitting mode_bridge turn, suggesting:', suggestedMode);
        const bridgeText = suggestedMode
          ? buildModeBridgeMessage({
              suggestedMode,
              language: userLanguage,
            })
          : '';

        await saveAndDisplayMessage({
          conversation_id: finalConversationId,
          role: 'assistant' as const,
          content: { text: bridgeText },
          meta: {
            status: 'sent',
            messageType: 'mode_bridge',
            responseMode: conversationTurn.responseMode,
            suggestedMode,
            originalRequest: parsedRequest,
            requestText: parsedRequest.originalMessage || currentMessage,
            conversationTurn,
          },
        });

        setIsTyping(false, conversationIdForThisSearch);
        setIsLoading(false);
        flowTimer.end('mode_bridge emitted', {
          suggestedMode,
          route: routeResult.route,
        });
        return;
      }

      // === PROPOSAL_CHIP BRANCH (Phase 5 / sub-task C) ===
      // Exploratory-but-actionable agency turn — render a one-click search
      // proposal (principal chip + 2-3 alternatives) instead of asking another
      // clarification question. Defensive: NO setPendingAction — exploratory
      // proposals must NOT lock state. The user can ignore the chip and type a
      // totally different message; that next turn re-parses normally.
      if (conversationTurn.executionBranch === 'proposal_chip') {
        console.log('🎯 [PROPOSAL CHIP] Building exploratory search proposal');
        const proposed = buildProposedSearch(parsedRequest, {
          profile: ctxEngState?.profile ?? null,
          now: new Date(),
          language: userLanguage,
        });

        let proposalText: string;
        let proposalChips: NarrativeChip[] | undefined;
        if (!proposed) {
          // Defensive: if builder returns null (insufficient seeds), degrade
          // to the focused-collect copy. The router gate should have prevented
          // this case but we handle it gracefully.
          console.log('⚠️ [PROPOSAL CHIP] buildProposedSearch returned null; falling back to collect');
          proposalText = buildEmiliaSearchNarrative({
            mode: 'collect',
            normalized: parsedRequest,
            missingFields: routeResult.missingFields,
            fallbackMessage: routeResult.collectQuestion ?? '',
            language: userLanguage,
          }).text;
        } else {
          const narrative = buildEmiliaSearchNarrative({
            mode: 'search_proposal',
            proposedSearch: proposed,
            language: userLanguage,
          });
          proposalText = narrative.text;
          proposalChips = narrative.chips;
        }

        await saveAndDisplayMessage({
          conversation_id: finalConversationId,
          role: 'assistant' as const,
          content: { text: proposalText },
          meta: {
            status: 'sent',
            messageType: conversationTurn.messageType,
            responseMode: conversationTurn.responseMode,
            originalRequest: parsedRequest,
            requestText: parsedRequest.originalMessage || currentMessage,
            conversationTurn,
            ...(proposalChips && proposalChips.length > 0
              ? { emiliaNarrative: { chips: proposalChips } }
              : {}),
          },
        });

        setIsTyping(false, conversationIdForThisSearch);
        setIsLoading(false);
        flowTimer.end('proposal_chip emitted', {
          route: routeResult.route,
          chipCount: proposalChips?.length ?? 0,
        });
        return;
      }

      // Merge persistent state into parsed request where fields are missing (user intent wins over stored)
      const mergeFlights = (a: any, b: any) => ({
        ...(b || {}),
        ...(a || {})
      });
      const mergeHotels = (a: any, b: any) => ({
        ...(b || {}),
        ...(a || {})
      });
      if (persistentState) {
        if (parsedRequest.flights || persistentState.flights) {
          parsedRequest.flights = mergeFlights(parsedRequest.flights, persistentState.flights);
        }
        if (parsedRequest.hotels || persistentState.hotels) {
          parsedRequest.hotels = mergeHotels(parsedRequest.hotels, persistentState.hotels);
        }
      }

      console.log('✅ [MESSAGE FLOW] Step 9: AI parsing completed successfully');
      console.log('🎯 AI parsing result:', parsedRequest);

      // 🔄 ITERATION MERGE: If this is an iteration, merge with previous context
      // (previousParsedRequest React state was removed in Phase 6 — only persistentState now)
      if (iterationContext.isIteration && persistentState) {
        console.log('🔄 [ITERATION] Applying iteration merge');
        console.log('🔄 [ITERATION] Before merge - requestType:', parsedRequest.requestType);
        parsedRequest = mergeIterationContext(persistentState, parsedRequest, iterationContext);
        console.log('🔄 [ITERATION] After merge - requestType:', parsedRequest.requestType);
        console.log('🔄 [ITERATION] Merged request:', {
          requestType: parsedRequest.requestType,
          hasFlights: !!parsedRequest.flights,
          hasHotels: !!parsedRequest.hotels,
          flightsOrigin: parsedRequest.flights?.origin,
          flightsDest: parsedRequest.flights?.destination,
          stops: parsedRequest.flights?.stops,
          hotelChains: parsedRequest.hotels?.hotelChains
        });
      }

      // 🔄 LEGACY FALLBACK: "con escalas" heuristic (only if iteration system didn't handle it)
      // This is kept as a fallback for cases where the new iteration system might miss the pattern
      if (!iterationContext.isIteration && /\bcon\s+escalas\b/i.test(currentMessage)) {
        const baseFlights = parsedRequest?.flights || (contextToUse as any)?.flights;
        if (baseFlights?.origin && baseFlights?.destination && baseFlights?.departureDate && (baseFlights?.adults ?? 0) >= 1) {
          console.log('🔀 [LEGACY FALLBACK] "con escalas" detected - forcing stops:with_stops');
          parsedRequest = {
            requestType: 'flights',
            flights: {
              ...baseFlights,
              stops: 'with_stops' as any
            },
            confidence: parsedRequest?.confidence ?? 0.9,
            originalMessage: currentMessage
          } as any;
        }
      }
      parsedRequest.responseLanguage = userLanguage;

      // 6. Validate required fields (handle combined specially)
      console.log('🔍 [MESSAGE FLOW] Step 11: Validating required fields');
      console.log('📊 Request type detected:', parsedRequest.requestType);

      // If it's a missing_info_request but no fields are actually missing, convert to the appropriate type
      if (parsedRequest.requestType === 'missing_info_request' &&
        (!parsedRequest.missingFields || parsedRequest.missingFields.length === 0)) {
        console.log('🔀 [VALIDATION] No missing fields detected - converting missing_info_request to appropriate type');

        if (parsedRequest.flights) {
          parsedRequest.requestType = 'flights';
          console.log('✈️ [VALIDATION] Converted to flights request');
        } else if (parsedRequest.hotels) {
          parsedRequest.requestType = 'hotels';
          console.log('🏨 [VALIDATION] Converted to hotels request');
        } else if (parsedRequest.flights && parsedRequest.hotels) {
          parsedRequest.requestType = 'combined';
          console.log('🏨✈️ [VALIDATION] Converted to combined request');
        }
      }

      // If message implies combined (mentions hotel y vuelo), coerce to combined and mirror basic fields
      // BUT be more careful - only if user explicitly wants both services
      const lowerMsg = currentMessage.toLowerCase();
      const explicitlyWantsHotel = /\b(hotel|alojamiento|hospedaje|donde quedarme|donde alojarme)\b/.test(lowerMsg);
      const explicitlyWantsFlight = /\b(vuelo|vuelos|avion|aereo)\b/.test(lowerMsg);
      const explicitlyRejectsHotel = /\b(no quiero hotel|sin hotel|solo vuelo|solo el vuelo|no necesito hotel)\b/.test(lowerMsg);
      const explicitlyReferencesPreviousContext = /\b(mism[ao]s?\s+busqueda|misma\s+consulta|mismo\s+vuelo|mismas?\s+fechas?|esas?\s+fechas?|lo\s+mismo\s+pero|igual\s+que\s+antes|como\s+antes|busqueda\s+anterior|busqueda\s+previa)\b/.test(lowerMsg);
      const normalizeIntentText = (value?: string) =>
        (value || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
      const normalizedMessageForIntent = normalizeIntentText(currentMessage);
      const messageMentions = (value?: string) => {
        const normalizedValue = normalizeIntentText(value);
        return normalizedValue.length > 0 && normalizedMessageForIntent.includes(normalizedValue);
      };

      // If combined intent has mismatched destinations, prefer the destination explicitly present in the message.
      // This avoids stale destination leakage from previous context (e.g., old Cancún overriding new Punta Cana).
      if (explicitlyWantsHotel && explicitlyWantsFlight && !explicitlyReferencesPreviousContext) {
        const flightDestination = parsedRequest.flights?.destination;
        const hotelCity = parsedRequest.hotels?.city;
        const normalizedFlightDestination = normalizeIntentText(flightDestination);
        const normalizedHotelCity = normalizeIntentText(hotelCity);

        if (
          normalizedFlightDestination &&
          normalizedHotelCity &&
          normalizedFlightDestination !== normalizedHotelCity
        ) {
          const mentionsFlightDestination = messageMentions(flightDestination);
          const mentionsHotelCity = messageMentions(hotelCity);

          if (mentionsHotelCity && !mentionsFlightDestination && parsedRequest.flights) {
            console.log(`🛡️ [INTENT] Aligning flight destination to explicit hotel city mention: ${flightDestination} -> ${hotelCity}`);
            parsedRequest.flights.destination = hotelCity as any;
          } else if (mentionsFlightDestination && !mentionsHotelCity && parsedRequest.hotels) {
            console.log(`🛡️ [INTENT] Aligning hotel city to explicit flight destination mention: ${hotelCity} -> ${flightDestination}`);
            parsedRequest.hotels.city = flightDestination as any;
          }
        }
      }

      // Strong guard: if user clearly asks ONLY hotel (no flight mention, no context-ref),
      // never carry flights from previous context in this turn.
      if (explicitlyWantsHotel && !explicitlyWantsFlight && !explicitlyReferencesPreviousContext) {
        const flightsSnapshot = parsedRequest.flights;
        if (parsedRequest.requestType !== 'hotels') {
          console.log('🏨 [INTENT] Forcing hotels-only request based on explicit hotel intent');
          parsedRequest.requestType = 'hotels';
        }

        // If AI returned only flights but user explicitly asked hotel, map minimal hotel base.
        if (!parsedRequest.hotels && flightsSnapshot?.destination) {
          parsedRequest.hotels = {
            city: flightsSnapshot.destination as any,
            checkinDate: flightsSnapshot.departureDate as any,
            checkoutDate: flightsSnapshot.returnDate as any,
            adults: (flightsSnapshot.adults as any) || 1,
            children: (flightsSnapshot.children as any) ?? 0,
            infants: (flightsSnapshot.infants as any) ?? 0
          } as any;
        }

        parsedRequest.flights = undefined;
      }

      // Only coerce to combined if user explicitly mentions both services AND doesn't reject hotel
      if (explicitlyWantsHotel && explicitlyWantsFlight && !explicitlyRejectsHotel && parsedRequest.requestType !== 'combined') {
        console.log('🔀 [INTENT] Coercing requestType to combined based on explicit hotel+flight mention');
        parsedRequest.requestType = 'combined';
        // Mirror city/dates from flights to hotels if missing
        const f = parsedRequest.flights;
        const existingHotels = parsedRequest.hotels || ({} as any);
        parsedRequest.hotels = {
          ...existingHotels, // ✅ PRESERVE existing hotel fields (roomType, mealPlan, etc.)
          city: existingHotels.city || (f?.destination as any),
          checkinDate: existingHotels.checkinDate || (f?.departureDate as any),
          checkoutDate: existingHotels.checkoutDate || (f?.returnDate as any),
          adults: existingHotels.adults || (f?.adults as any),
          children: existingHotels.children ?? (f?.children as any) ?? 0,
          infants: existingHotels.infants ?? (f?.infants as any) ?? 0
        } as any;
      }

      // If user explicitly rejects hotel, force flights-only
      if (explicitlyRejectsHotel && parsedRequest.requestType === 'combined') {
        console.log('🚫 [INTENT] User explicitly rejects hotel - forcing flights-only');
        parsedRequest.requestType = 'flights';
        parsedRequest.hotels = undefined;
      }

      // Combined flow: validate both and send ONE aggregated prompt
      if (parsedRequest.requestType === 'combined') {
        console.log('🌟 [VALIDATION] Combined request - validating flights and hotels');

        // Only validate flights if flight data was actually provided
        // This handles cases like "hotel + transfers + insurance" where AI returns combined but no flights
        const hasFlightData = parsedRequest.flights && (
          parsedRequest.flights.origin ||
          parsedRequest.flights.destination ||
          parsedRequest.flights.departureDate
        );

        const flightVal = hasFlightData
          ? validateFlightRequiredFields(parsedRequest.flights, userLanguage)
          : { isValid: true, missingFields: [], missingFieldsSpanish: [] }; // Skip flight validation if no flight data
        const hotelVal = validateHotelRequiredFields(parsedRequest.hotels, userLanguage);

        console.log(`📊 [VALIDATION] hasFlightData: ${hasFlightData}, flightVal.isValid: ${flightVal.isValid}, hotelVal.isValid: ${hotelVal.isValid}`);

        const flightOk = flightVal.isValid;
        const hotelOk = hotelVal.isValid;
        console.log('🧾 [VALIDATION] Combined results:', { flight: flightVal, hotel: hotelVal });

        // Per-product partial advance (spec §9.4): if one product has all its
        // required fields and the other doesn't, run the valid one and ask
        // only for the missing product's slots — do NOT block both.
        if (!flightOk && hotelOk) {
          console.log('🟡 [VALIDATION] Partial: hotel valid, flight missing — running hotel search alone');
          setTypingMessage(typingCopy.searchingHotels, conversationIdForThisSearch);

          const hotelResult = await handleHotelSearch({
            ...parsedRequest,
            requestType: 'hotels',
          } as any);

          const flightAskMessage = buildEmiliaSearchNarrative({
            mode: 'collect',
            normalized: parsedRequest,
            missingFields: flightVal.missingFields,
            fallbackMessage: generateMissingInfoMessage(
              flightVal.missingFieldsSpanish,
              'flights',
              undefined,
              userLanguage,
            ),
            language: userLanguage,
          }).text;

          if (ctxEngState) {
            ctxEngState = await emitPendingAction({
              ctxEngState,
              action: {
                kind: 'awaiting_user_input',
                for: 'flight_completion',
                fields: toCanonicalFields(flightVal.missingFields),
                prompt: flightAskMessage.slice(0, 240),
                issuedAt: new Date().toISOString(),
              },
            });
          }

          const combinedResponseText = `${hotelResult.response}\n\n${flightAskMessage}`;
          await saveAndDisplayMessage({
            conversation_id: finalConversationId,
            role: 'assistant' as const,
            content: { text: combinedResponseText },
            meta: {
              status: 'sent',
              messageType: 'search_results',
              combinedData: (hotelResult.data as { combinedData?: unknown })?.combinedData,
              missingFlightFields: flightVal.missingFields,
              originalRequest: parsedRequest,
            },
          });

          console.log('✅ [VALIDATION] Partial flow: hotel rendered, pending_action=flight_completion');
          flowTimer.end('stopped - combined partial hotel-only', {
            requestType: parsedRequest.requestType,
            missingFlightFields: flightVal.missingFields,
          });
          return;
        }

        if (flightOk && !hotelOk) {
          console.log('🟡 [VALIDATION] Partial: flight valid, hotel missing — running flight search alone');
          setTypingMessage(typingCopy.searchingFlights, conversationIdForThisSearch);

          const flightResult = await handleFlightSearch({
            ...parsedRequest,
            requestType: 'flights',
          } as any);

          const hotelAskMessage = buildEmiliaSearchNarrative({
            mode: 'collect',
            normalized: parsedRequest,
            missingFields: hotelVal.missingFields,
            fallbackMessage: generateMissingInfoMessage(
              hotelVal.missingFieldsSpanish,
              'hotels',
              undefined,
              userLanguage,
            ),
            language: userLanguage,
          }).text;

          if (ctxEngState) {
            ctxEngState = await emitPendingAction({
              ctxEngState,
              action: {
                kind: 'awaiting_user_input',
                for: 'hotel_completion',
                fields: toCanonicalFields(hotelVal.missingFields),
                prompt: hotelAskMessage.slice(0, 240),
                issuedAt: new Date().toISOString(),
              },
            });
          }

          const combinedResponseText = `${flightResult.response}\n\n${hotelAskMessage}`;
          await saveAndDisplayMessage({
            conversation_id: finalConversationId,
            role: 'assistant' as const,
            content: { text: combinedResponseText },
            meta: {
              status: 'sent',
              messageType: 'search_results',
              combinedData: (flightResult.data as { combinedData?: unknown })?.combinedData,
              missingHotelFields: hotelVal.missingFields,
              originalRequest: parsedRequest,
            },
          });

          console.log('✅ [VALIDATION] Partial flow: flight rendered, pending_action=hotel_completion');
          flowTimer.end('stopped - combined partial flight-only', {
            requestType: parsedRequest.requestType,
            missingHotelFields: hotelVal.missingFields,
          });
          return;
        }

        if (!flightOk && !hotelOk) {
          // Neither side has enough info — fall back to the aggregated ask.
          await persistContextualMemoryBeforeAsk(parsedRequest, 'context_memory_save_combined_missing');

          const missingInfoMessage = buildEmiliaSearchNarrative({
            mode: 'collect',
            normalized: parsedRequest,
            missingFields: [
              ...flightVal.missingFields,
              ...hotelVal.missingFields,
            ],
            fallbackMessage: generateMissingInfoMessage(
              [
                ...flightVal.missingFieldsSpanish,
                ...hotelVal.missingFieldsSpanish,
              ],
              'combined',
              undefined,
              userLanguage
            ),
            language: userLanguage,
          }).text;

          if (ctxEngState) {
            const dedupedLegacy = [
              ...new Set([...flightVal.missingFields, ...hotelVal.missingFields]),
            ];
            ctxEngState = await emitPendingAction({
              ctxEngState,
              action: {
                kind: 'awaiting_user_input',
                for: 'combined_completion',
                fields: toCanonicalFields(dedupedLegacy),
                prompt: missingInfoMessage.slice(0, 240),
                issuedAt: new Date().toISOString(),
              },
            });
          }

          await saveAndDisplayMessage({
            conversation_id: finalConversationId,
            role: 'assistant' as const,
            content: { text: missingInfoMessage },
            meta: {
              status: 'sent',
              messageType: 'missing_info_request',
              missingFlightFields: flightVal.missingFields,
              missingHotelFields: hotelVal.missingFields,
              originalRequest: parsedRequest
            }
          });

          console.log('✅ [VALIDATION] Aggregated missing info message sent');
          flowTimer.end('stopped - combined validation missing info', {
            requestType: parsedRequest.requestType,
            missingFlightFields: flightVal.missingFields,
            missingHotelFields: hotelVal.missingFields,
          });
          return;
        }

        console.log('✅ [VALIDATION] Combined: all required fields present');
        clearContextualMemoryInBackground('context_memory_clear_combined_valid');
      } else if (parsedRequest.requestType === 'flights') {
        // Validate flight fields
        console.log('✈️ [VALIDATION] Validating flight required fields');
        const validation = validateFlightRequiredFields(parsedRequest.flights, userLanguage);

        console.log('📋 [VALIDATION] Validation result:', {
          isValid: validation.isValid,
          missingFields: validation.missingFields,
          missingFieldsSpanish: validation.missingFieldsSpanish,
          errorMessage: validation.errorMessage // ✨ Log custom error message if present
        });

        if (!validation.isValid) {
          console.log('⚠️ [VALIDATION] Missing required fields, requesting more info');

          // Store the current parsed request for future combination
          await persistContextualMemoryBeforeAsk(parsedRequest, 'context_memory_save_flight_missing');

          // ✨ CRITICAL: Also save to context state for iteration detection (e.g., "agrega X adultos")
          // This ensures the iteration system can access the failed search context
          const contextStateForFailedSearch: ContextState = {
            lastSearch: {
              requestType: parsedRequest.requestType as 'flights' | 'hotels' | 'combined',
              flightsParams: parsedRequest.flights ? (() => {
                const normalizedFlight = normalizeFlightRequest(parsedRequest.flights);
                return {
                  origin: normalizedFlight?.origin || '',
                  destination: normalizedFlight?.destination || '',
                  departureDate: normalizedFlight?.departureDate || '',
                  returnDate: normalizedFlight?.returnDate,
                  tripType: normalizedFlight?.tripType,
                  segments: normalizedFlight?.segments,
                  adults: normalizedFlight?.adults || 0,
                  children: normalizedFlight?.children || 0,
                  infants: normalizedFlight?.infants || 0,
                  stops: normalizedFlight?.stops,
                  luggage: normalizedFlight?.luggage,
                  preferredAirline: normalizedFlight?.preferredAirline,
                  maxLayoverHours: normalizedFlight?.maxLayoverHours
                };
              })() : undefined
            },
            turnNumber: (persistentState?.turnNumber || 0) + 1
          };
          saveContextState(finalConversationId, contextStateForFailedSearch).catch((e) => console.warn('⚠️ [CONTEXT] Failed to save context state:', e));
          console.log('💾 [CONTEXT] Saving context state for failed validation (fire-and-forget)');

          // ✨ Use custom errorMessage if available (e.g., "only minors" case), otherwise generate standard message
          const missingInfoMessage = validation.errorMessage || buildEmiliaSearchNarrative({
            mode: 'collect',
            normalized: parsedRequest,
            missingFields: validation.missingFields,
            fallbackMessage: generateMissingInfoMessage(
              validation.missingFieldsSpanish,
              parsedRequest.requestType,
              undefined,
              userLanguage
            ),
            language: userLanguage,
          }).text;

          console.log('💬 [VALIDATION] Generated missing info message');

          // Phase 2: additive pending_action emit (flight slot-fill).
          // Skip when validation.errorMessage is set — that branch is the
          // "only_minors" terminal error, not a slot-fill ask (the user must
          // restructure the entire request, not just supply more values).
          if (ctxEngState && !validation.errorMessage) {
            ctxEngState = await emitPendingAction({
              ctxEngState,
              action: {
                kind: 'awaiting_user_input',
                for: 'flight_completion',
                fields: toCanonicalFields(validation.missingFields),
                prompt: missingInfoMessage.slice(0, 240),
                issuedAt: new Date().toISOString(),
              },
            });
          }

          // Add assistant message with missing info request
          await saveAndDisplayMessage({
            conversation_id: finalConversationId,
            role: 'assistant' as const,
            content: { text: missingInfoMessage },
            meta: {
              status: 'sent',
              messageType: validation.errorMessage ? 'only_minors_error' : 'missing_info_request',
              missingFields: validation.missingFields,
              originalRequest: parsedRequest
            }
          });

          console.log('✅ [VALIDATION] Missing info message sent, stopping process');
          setIsTyping(false, conversationIdForThisSearch);
          setIsLoading(false);
          flowTimer.end('stopped - flight validation missing info', {
            requestType: parsedRequest.requestType,
            missingFields: validation.missingFields,
          });
          return; // Stop processing here, wait for user response
        }

        console.log('✅ [VALIDATION] All required fields present, proceeding with search');
        // Do NOT clear contextual memory yet. We will clear it after search only if we find results.
      } else if (parsedRequest.requestType === 'hotels') {
        console.log('🏨 [VALIDATION] Validating hotel required fields');
        const validation = validateHotelRequiredFields(parsedRequest.hotels, userLanguage);

        console.log('📋 [VALIDATION] Hotel validation result:', {
          isValid: validation.isValid,
          missingFields: validation.missingFields,
          missingFieldsSpanish: validation.missingFieldsSpanish
        });

        // Phase 4: the search-intent normalizer's `applyDateFallback` step now
        // synthesizes today+3 / checkin+7 dates when the parser returns empty
        // dates. That makes validation pass even when a more SPECIFIC
        // flight-context source could fill the dates better. So we also force
        // the enrichment branch when the city is missing OR all dates were
        // inferred — both signal "the user did not give us hotel specifics yet,
        // and a previous flight search has them."
        const hotelCityMissing = !parsedRequest.hotels?.city || parsedRequest.hotels.city.length === 0;
        const checkinIsInferred = (parsedRequest.hotels as any)?.checkinDateInferred === true;
        const checkoutIsInferred = (parsedRequest.hotels as any)?.checkoutDateInferred === true;
        const datesAreOnlyInferred = checkinIsInferred && checkoutIsInferred;
        const shouldRunEnrichment = !validation.isValid || hotelCityMissing || datesAreOnlyInferred;

        if (shouldRunEnrichment) {
          // ✨ CRITICAL: Check if this is a "only minors" error (has custom errorMessage)
          // If so, don't try to auto-enrich - the issue is specifically about adults
          if (validation.errorMessage) {
            console.log('⚠️ [VALIDATION] "Only minors" error detected - skipping auto-enrich');

            // Store context for iteration detection (enables "agrega X adultos")
            await persistContextualMemoryBeforeAsk(parsedRequest, 'context_memory_save_hotel_minors');

            const contextStateForFailedSearch: ContextState = {
              lastSearch: {
                requestType: parsedRequest.requestType as 'flights' | 'hotels' | 'combined',
                hotelsParams: parsedRequest.hotels ? {
                  city: parsedRequest.hotels.city,
                  checkinDate: parsedRequest.hotels.checkinDate,
                  checkoutDate: parsedRequest.hotels.checkoutDate,
                  adults: parsedRequest.hotels.adults || 0,
                  children: parsedRequest.hotels.children || 0,
                  infants: (parsedRequest.hotels as any).infants || 0,
                  roomType: parsedRequest.hotels.roomType,
                  mealPlan: parsedRequest.hotels.mealPlan,
                  hotelChains: parsedRequest.hotels.hotelChains
                } : undefined
              },
              turnNumber: (persistentState?.turnNumber || 0) + 1
            };
            saveContextState(finalConversationId, contextStateForFailedSearch).catch((e) => console.warn('⚠️ [CONTEXT] Failed to save context state:', e));
            console.log('💾 [CONTEXT] Saving context state for failed hotel validation (fire-and-forget)');

            await saveAndDisplayMessage({
              conversation_id: finalConversationId,
              role: 'assistant' as const,
              content: { text: validation.errorMessage },
              meta: {
                status: 'sent',
                messageType: 'only_minors_error',
                missingFields: validation.missingFields,
                originalRequest: parsedRequest
              }
            });

            setIsTyping(false, conversationIdForThisSearch);
            setIsLoading(false);
            flowTimer.end('stopped - hotel validation minors only', {
              requestType: parsedRequest.requestType,
              missingFields: validation.missingFields,
            });
            return;
          }

          // Attempt to auto-enrich hotel params from last flight context
          const flightCtx = getContextFromLastFlights();

          if (flightCtx) {
            console.log('🧩 [ENRICH] Filling missing hotel fields from flight context');
            // Phase 4: treat normalizer-inferred dates (today+3 fallback) and
            // the legacy `adultsExplicit=false` adults=1 as "fill targets".
            // Flight context is a MORE SPECIFIC source than the structural
            // fallback, so it must win when present.
            const checkinPreferCtx = checkinIsInferred || !parsedRequest.hotels?.checkinDate;
            const checkoutPreferCtx = checkoutIsInferred || !parsedRequest.hotels?.checkoutDate;
            const adultsExplicit = parsedRequest.hotels?.adultsExplicit === true;
            parsedRequest.hotels = {
              // ✅ PRESERVE all existing hotel fields first (hotelChain, hotelName, roomType, mealPlan, etc.)
              ...parsedRequest.hotels,
              // Then fill in missing required fields from flight context
              city: parsedRequest.hotels?.city || flightCtx.destination,
              checkinDate: checkinPreferCtx ? flightCtx.departureDate : parsedRequest.hotels.checkinDate,
              checkoutDate: checkoutPreferCtx
                ? (flightCtx.returnDate || new Date(new Date(flightCtx.departureDate).getTime() + 3 * 86400000).toISOString().split('T')[0])
                : parsedRequest.hotels.checkoutDate,
              checkinDateInferred: checkinPreferCtx ? false : (parsedRequest.hotels as any)?.checkinDateInferred,
              checkoutDateInferred: checkoutPreferCtx ? false : (parsedRequest.hotels as any)?.checkoutDateInferred,
              adults: !adultsExplicit && flightCtx.adults ? flightCtx.adults : (parsedRequest.hotels?.adults || flightCtx.adults),
              adultsExplicit: !adultsExplicit && flightCtx.adults ? true : adultsExplicit,
              children: parsedRequest.hotels?.children ?? flightCtx.children ?? 0,
              infants: parsedRequest.hotels?.infants ?? flightCtx.infants ?? 0
            } as any;
            console.log('🏨 [ENRICH] Preserved hotel preferences:', {
              hotelChains: parsedRequest.hotels?.hotelChains,
              hotelName: parsedRequest.hotels?.hotelName,
              roomType: parsedRequest.hotels?.roomType,
              mealPlan: parsedRequest.hotels?.mealPlan
            });

            const reval = validateHotelRequiredFields(parsedRequest.hotels, userLanguage);
            console.log('📋 [REVALIDATION] After enrichment:', reval);
            if (!reval.isValid) {
              console.log('⚠️ [VALIDATION] Still missing hotel required fields, requesting more info');
            } else {
              console.log('✅ [VALIDATION] Hotel fields completed via enrichment, continuing');
            }

            if (reval.isValid) {
              // proceed without asking
            } else {
              // Store the current parsed request for future combination
              await persistContextualMemoryBeforeAsk(parsedRequest, 'context_memory_save_hotel_revalidation');

              // ✨ Use custom errorMessage if available
              const missingInfoMessage = reval.errorMessage || buildEmiliaSearchNarrative({
                mode: 'collect',
                normalized: parsedRequest,
                missingFields: reval.missingFields,
                fallbackMessage: generateMissingInfoMessage(
                  reval.missingFieldsSpanish,
                  parsedRequest.requestType,
                  undefined,
                  userLanguage
                ),
                language: userLanguage,
              }).text;

              // Phase 2: additive pending_action emit (hotel slot-fill after enrich).
              if (ctxEngState && !reval.errorMessage) {
                ctxEngState = await emitPendingAction({
                  ctxEngState,
                  action: {
                    kind: 'awaiting_user_input',
                    for: 'hotel_completion',
                    fields: toCanonicalFields(reval.missingFields),
                    prompt: missingInfoMessage.slice(0, 240),
                    issuedAt: new Date().toISOString(),
                  },
                });
              }

              await saveAndDisplayMessage({
                conversation_id: finalConversationId,
                role: 'assistant' as const,
                content: { text: missingInfoMessage },
                meta: {
                  status: 'sent',
                  messageType: reval.errorMessage ? 'only_minors_error' : 'missing_info_request',
                  missingFields: reval.missingFields,
                  originalRequest: parsedRequest
                }
              });

              setIsTyping(false, conversationIdForThisSearch);
              setIsLoading(false);
              flowTimer.end('stopped - hotel revalidation missing info', {
                requestType: parsedRequest.requestType,
                missingFields: reval.missingFields,
              });
              return; // wait for user response
            }
          } else if (!validation.isValid) {
            console.log('⚠️ [VALIDATION] Missing hotel required fields and no flight context available');
            // Store the current parsed request for future combination
            await persistContextualMemoryBeforeAsk(parsedRequest, 'context_memory_save_hotel_missing');

            // ✨ Use custom errorMessage if available
            const missingInfoMessage = validation.errorMessage || buildEmiliaSearchNarrative({
              mode: 'collect',
              normalized: parsedRequest,
              missingFields: validation.missingFields,
              fallbackMessage: generateMissingInfoMessage(
                validation.missingFieldsSpanish,
                parsedRequest.requestType,
                undefined,
                userLanguage
              ),
              language: userLanguage,
            }).text;

            // Phase 2: additive pending_action emit (hotel slot-fill, no flight ctx).
            if (ctxEngState && !validation.errorMessage) {
              ctxEngState = await emitPendingAction({
                ctxEngState,
                action: {
                  kind: 'awaiting_user_input',
                  for: 'hotel_completion',
                  fields: toCanonicalFields(validation.missingFields),
                  prompt: missingInfoMessage.slice(0, 240),
                  issuedAt: new Date().toISOString(),
                },
              });
            }

            await saveAndDisplayMessage({
              conversation_id: finalConversationId,
              role: 'assistant' as const,
              content: { text: missingInfoMessage },
              meta: {
                status: 'sent',
                messageType: validation.errorMessage ? 'only_minors_error' : 'missing_info_request',
                missingFields: validation.missingFields,
                originalRequest: parsedRequest
              }
            });

            setIsTyping(false, conversationIdForThisSearch);
            setIsLoading(false);
            flowTimer.end('stopped - hotel validation missing info', {
              requestType: parsedRequest.requestType,
              missingFields: validation.missingFields,
            });
            return;
          }
        }

        console.log('✅ [VALIDATION] All hotel required fields present, proceeding with search');
        // Clear previous request since we have all required fields
        clearContextualMemoryInBackground('context_memory_clear_hotel_valid');
      } else if (
        parsedRequest.requestType === 'itinerary' &&
        !isQuoteActivePlanTurn &&
        conversationTurn.responseMode !== 'show_places'
      ) {
        // Skip the destination check on `show_places` discovery turns: those
        // carry their destination on `placeDiscoveryResult.destination`, not
        // on `itinerary.destinations`, and short-circuiting here would mask
        // a successful tool call ("Qué comer en Roma" → 10 places returned)
        // behind a generic "decime qué destino" prompt.
        console.log('🗺️ [VALIDATION] Validating itinerary required fields');

        // Hard requirement: at least 1 destination
        if (!parsedRequest.itinerary?.destinations?.length) {
          console.log('⚠️ [VALIDATION] No destinations provided, requesting more info');
          await persistContextualMemoryBeforeAsk(parsedRequest, 'context_memory_save_itinerary_missing');

          const missingInfoMessage = buildEmiliaSearchNarrative({
            mode: 'collect',
            normalized: parsedRequest,
            missingFields: ['destinations'],
            fallbackMessage: generateMissingInfoMessage(
              ['destino(s)'],
              'itinerary',
              {
                itinerary: parsedRequest.itinerary,
                originalMessage: parsedRequest.originalMessage,
              },
              userLanguage
            ),
            language: userLanguage,
          }).text;

          // Phase 2: additive pending_action emit (itinerary missing destinations).
          if (ctxEngState) {
            const plannerId = (plannerState as TripPlannerState | null)?.id;
            ctxEngState = await emitPendingAction({
              ctxEngState,
              action: {
                kind: 'awaiting_user_input',
                for: 'itinerary_completion',
                fields: ['destinations'],
                prompt: missingInfoMessage.slice(0, 240),
                ref: plannerId ? { type: 'plan', id: plannerId } : undefined,
                issuedAt: new Date().toISOString(),
              },
            });
          }

          await saveAndDisplayMessage({
            conversation_id: finalConversationId,
            role: 'assistant' as const,
            content: { text: missingInfoMessage },
            meta: {
              status: 'sent',
              messageType: 'missing_info_request',
              missingFields: ['destinations'],
              originalRequest: parsedRequest,
            }
          });

          setIsTyping(false, conversationIdForThisSearch);
          setIsLoading(false);
          flowTimer.end('stopped - itinerary missing destinations', {
            requestType: parsedRequest.requestType,
          });
          return;
        }

        // Apply deterministic planner edits before deciding whether to regenerate.
        if (plannerState && parsedRequest.itinerary && parsedRequest.itinerary.editIntent?.action !== 'restart_plan') {
          console.log('🔄 [PLANNER EDIT] Applying edit patch over existing planner');
          const { merged, fieldProvenance: updatedProvenance, requiresRegeneration } =
            mergePlannerFieldUpdate(plannerState as TripPlannerState, parsedRequest.itinerary);

          if (!requiresRegeneration && updatePlannerState) {
            await updatePlannerState((current) => ({
              ...current,
              ...merged,
              fieldProvenance: updatedProvenance,
            }));

            const confirmMsg = parsedRequest.itinerary.editIntent?.rawInstruction
              ? 'Listo, actualicé esa preferencia en el planificador y mantuve el resto del viaje.'
              : 'Listo, actualicé tu planificador y mantuve el resto del viaje.';

            await saveAndDisplayMessage({
              conversation_id: finalConversationId,
              role: 'assistant' as const,
              content: { text: confirmMsg },
              meta: {
                status: 'sent',
                messageType: 'planner_field_update',
                originalRequest: parsedRequest,
              },
            });

            setIsTyping(false, conversationIdForThisSearch);
            setIsLoading(false);
            flowTimer.end('completed - planner direct edit', {});
            return;
          }

          parsedRequest = {
            ...parsedRequest,
            itinerary: {
              ...parsedRequest.itinerary,
              destinations: merged.destinations,
              days: merged.days,
              startDate: merged.startDate,
              endDate: merged.endDate,
              isFlexibleDates: merged.isFlexibleDates,
              flexibleMonth: merged.flexibleMonth,
              flexibleYear: merged.flexibleYear,
              budgetLevel: merged.budgetLevel,
              budgetAmount: merged.budgetAmount,
              interests: merged.interests,
              pace: merged.pace,
              travelers: merged.travelers,
              constraints: merged.constraints,
            },
          };
          setDraftPlannerFromRequest?.(parsedRequest, updatedProvenance);
        }

        // Apply smart defaults for missing optional fields
        if (!plannerState) {
          const { enrichedItinerary, fieldProvenance } = applySmartDefaults(parsedRequest.itinerary);
          parsedRequest = {
            ...parsedRequest,
            itinerary: enrichedItinerary,
          };
          setDraftPlannerFromRequest?.(parsedRequest, fieldProvenance);
        }

        console.log('✅ [VALIDATION] Itinerary proceeding with generation (smart defaults applied)');
        clearContextualMemoryInBackground('context_memory_clear_itinerary_valid');
      }

      // 6. Execute searches based on type
      console.log('🔍 [MESSAGE FLOW] Step 12: Starting search process');
      const searchStart = nowMs();

      let assistantResponse = '';
      let structuredData = null;

      // Lock domain for this turn to avoid cross responses
      const domainForTurn = parsedRequest.requestType === 'hotels' ? 'hotels'
        : parsedRequest.requestType === 'flights' ? 'flights'
          : parsedRequest.requestType === 'combined' ? 'flights' : null;
      activeDomain = domainForTurn || activeDomain;

      switch (parsedRequest.requestType) {
        case 'missing_info_request': {
          console.log('❓ [MESSAGE FLOW] Step 12a: Missing info request - asking for more details');
          assistantResponse = parsedRequest.message || 'Necesito más información para ayudarte. Por favor, proporciona los datos faltantes.';
          structuredData = {
            messageType: 'missing_info_request',
            missingFields: parsedRequest.missingFields || [],
            originalRequest: parsedRequest // ← Guardamos el request completo para contexto
          };
          console.log('✅ [MESSAGE FLOW] Missing info request completed');
          break;
        }
        case 'flights': {
          console.log('✈️ [MESSAGE FLOW] Step 12b: Processing flight search');
          setTypingMessage(typingCopy.searchingFlights, conversationIdForThisSearch);
          const flightResult = await handleFlightSearch(parsedRequest);
          assistantResponse = flightResult.response;
          structuredData = flightResult.data;
          console.log('✅ [MESSAGE FLOW] Flight search completed');
          break;
        }
        case 'hotels': {
          console.log('🏨 [MESSAGE FLOW] Step 12c: Processing hotel search');
          setTypingMessage(typingCopy.searchingHotels, conversationIdForThisSearch);
          const hotelResult = await handleHotelSearch(parsedRequest);
          assistantResponse = hotelResult.response;
          structuredData = hotelResult.data;
          console.log('✅ [MESSAGE FLOW] Hotel search completed');
          break;
        }
        case 'packages': {
          console.log('🎒 [MESSAGE FLOW] Step 12d: Processing package search');
          const packageResult = await handlePackageSearch(parsedRequest);
          assistantResponse = packageResult.response;
          structuredData = packageResult.data;
          console.log('✅ [MESSAGE FLOW] Package search completed');
          break;
        }
        case 'services': {
          console.log('🚌 [MESSAGE FLOW] Step 12e: Processing service search');
          const serviceResult = await handleServiceSearch(parsedRequest);
          assistantResponse = serviceResult.response;
          console.log('✅ [MESSAGE FLOW] Service search completed');
          break;
        }
        case 'combined': {
          // Respect domain lock: if user intent was hotel-only turn, prioritize hotels; else run combined
          if (activeDomain === 'hotels') {
            console.log('🏨 [MESSAGE FLOW] Step 12f: Domain locked to hotels, skipping flights');
            setTypingMessage(typingCopy.searchingHotels, conversationIdForThisSearch);
            const hotelResult = await handleHotelSearch({
              ...parsedRequest,
              requestType: 'hotels'
            } as any);
            assistantResponse = hotelResult.response;
            structuredData = hotelResult.data;
          } else {
            console.log('🌟 [MESSAGE FLOW] Step 12f: Processing combined search');
            setTypingMessage(typingCopy.searchingTravelOptions, conversationIdForThisSearch);
            const combinedResult = await handleCombinedSearch(parsedRequest);
            assistantResponse = combinedResult.response;
            structuredData = combinedResult.data;
            console.log('✅ [MESSAGE FLOW] Combined search completed');
          }
          break;
        }
        case 'itinerary': {
          console.log('🗺️ [MESSAGE FLOW] Step 12g: Processing itinerary request');
          if (isQuoteActivePlanTurn && plannerState) {
            console.log('💬 [QUOTE ACTIVE PLAN] Responding from active planner context');
            const quoteResult = buildPlanToQuoteResponse(plannerState as TripPlannerState, userLanguage);
            assistantResponse = quoteResult.response;
            structuredData = quoteResult.data as any;

            // === Phase 5: persist pending_action so the next turn knows what
            // we asked for. Generic mechanism — quote_completion is just one
            // value of `for`. The model on the next turn will see this in
            // <pending_action> and call apply_slot_values to resolve it.
            // Silent no-op when CE is off or state was never bootstrapped.
            if (ctxEngState) {
              // Canonical slot names — see conversationOrchestrator.getPlanQuoteMissingSlots.
              // The model sees these in <pending_action.fields> and resolves them
              // via apply_slot_values; the dispatcher reads the same canonical keys.
              // The user-facing text in `assistantResponse` still uses Spanish display
              // strings from `missingQuoteFields`, surfaced via `prompt` below.
              const missingSlots = (quoteResult.data as { quoteContext?: { missingQuoteSlots?: string[] } })
                ?.quoteContext?.missingQuoteSlots;
              if (Array.isArray(missingSlots) && missingSlots.length > 0) {
                const plannerId = (plannerState as TripPlannerState).id;
                const action: PendingAction = {
                  kind: 'awaiting_user_input',
                  for: 'quote_completion',
                  fields: missingSlots,
                  ref: plannerId ? { type: 'plan', id: plannerId } : undefined,
                  prompt: assistantResponse.slice(0, 240),
                  issuedAt: new Date().toISOString(),
                };
                ctxEngState = await emitPendingAction({ ctxEngState, action });
                console.log('🎯 [PENDING-ACTION] Persisted quote_completion request:', missingSlots);
              }
            }
          } else if (conversationTurn.responseMode === 'show_places') {
            setTypingMessage(typingCopy.searchingPlaces, conversationIdForThisSearch);
            const discoveryMessage = parsedRequest.originalMessage || currentMessage;
            // Discovery is now sourced exclusively from the LLM `discover_places`
            // tool result (`placeDiscoveryResult`). The orchestrator only emits
            // `show_places` when the tool returned ok=true, so this build should
            // succeed; the null branch is a defensive fallback for malformed
            // tool payloads (no city, no places, or no usable coordinates).
            const discoveryResult = buildDiscoveryResponseFromToolResult({
              message: discoveryMessage,
              placeDiscoveryResult: parsedRequest.placeDiscoveryResult,
              language: userLanguage,
            });
            if (discoveryResult) {
              assistantResponse = discoveryResult.text;
              structuredData = {
                messageType: 'discovery_results',
                discoveryContext: discoveryResult.discoveryContext,
                recommendedPlaces: discoveryResult.recommendedPlaces,
              };
            } else {
              console.warn('🗺️ [DISCOVERY] show_places without usable tool result — falling back to empty discovery payload');
              assistantResponse = 'No pude armar la lista de lugares ahora mismo. Decime qué ciudad querés explorar y vuelvo a intentarlo.';
              structuredData = {
                messageType: 'discovery_results',
                discoveryContext: null,
                recommendedPlaces: [],
              };
            }
          } else {
            setPlannerDraftPhase?.('draft_generating');
            showProgressAssistantResponse(
              buildItineraryProgressMessage(parsedRequest, plannerState as TripPlannerState | null),
              parsedRequest.requestType,
            );
            const itineraryResult = await handleItineraryRequest(parsedRequest, plannerState || null, {
              conversationId: finalConversationId,
              leadId: leadId ?? null,
              // DEBT-15: prompt-injection load was removed. travel-itinerary
              // can no longer rely on this; lead history must come through the
              // model's retrieval tools when needed.
              leadProfile: null,
            });
            // Wrap in canonical pipeline
            const canonicalStdResult = buildCanonicalResultFromStandard({
              response: itineraryResult.response,
              structuredData: itineraryResult.data,
              conversationTurn,
              routeResult,
              requestText: parsedRequest.originalMessage || currentMessage,
              editorial: itineraryResult.data?.editorial ?? null,
            });
            assistantResponse = canonicalStdResult.response;
            structuredData = canonicalStdResult;
          }
          console.log('✅ [MESSAGE FLOW] Itinerary generation completed');
          break;
        }
        default:
          console.log('💬 [MESSAGE FLOW] Step 12h: Processing general query');
          assistantResponse = await handleGeneralQuery(parsedRequest);
          console.log('✅ [MESSAGE FLOW] General query completed');
      }

      logTimingStep('MESSAGE FLOW', `search handler (${parsedRequest.requestType})`, searchStart, {
        hasStructuredData: Boolean(structuredData),
      });
      emitLatency({
        stage: parsedRequest.requestType === 'combined'
          ? 'providers_combined'
          : parsedRequest.requestType === 'flights'
            ? 'provider_flights'
            : parsedRequest.requestType === 'hotels'
              ? 'provider_hotels'
              : parsedRequest.requestType === 'itinerary'
                ? 'itinerary'
                : 'response_builder',
        latencyMs: nowMs() - searchStart,
        payload: {
          requestType: parsedRequest.requestType,
          hasStructuredData: Boolean(structuredData),
        },
      });

      // === EMILIA: Prepend inferred-field summary when defaults were applied ===
      // Phase 3 / sub-task C: capture the FULL NarrativeOutput (not just `.text`)
      // so we can persist `narrative.chips` to the assistant message meta. The
      // chip cluster in `ChatInterface.tsx` prefers these chips over the legacy
      // `meta.emiliaRoute.inferredFields` derivation.
      let narrativeChips: NarrativeChip[] | undefined;
      if (routeResult.inferredFields.length > 0 && assistantResponse && conversationTurn.responseMode !== 'show_places') {
        const inferredDetails = getInferredFieldDetails(parsedRequest);
        if (inferredDetails.length > 0) {
          const narrative = buildEmiliaSearchNarrative({
            mode: 'search_summary',
            normalized: parsedRequest,
            defaultsApplied: inferredDetails,
            language: parsedRequest.responseLanguage ?? userLanguage,
          });
          // Keep `buildSearchSummary` call alive for back-compat parity (and
          // because the wrapper still has a single legacy call site here).
          // The `narrative.text` is byte-equivalent to `buildSearchSummary`,
          // so we use it directly to avoid a double-build.
          if (narrative.text) {
            assistantResponse = `${narrative.text}\n\n${assistantResponse}`;
            console.log('📋 [ROUTER] Prepended inferred-field summary:', narrative.text);
          }
          if (narrative.chips && narrative.chips.length > 0) {
            narrativeChips = narrative.chips;
          }
        }
      }

      console.log('📝 [MESSAGE FLOW] Step 12: Generated assistant response');
      console.log('💬 Response preview:', assistantResponse.substring(0, 100) + '...');
      console.log('📊 Structured data:', structuredData);

      removeAssistantStreamDraft();
      assistantStreamDraft = startAssistantResponseStream(finalConversationId, assistantResponse);
      if (assistantStreamDraft) {
        emitFirstVisibleResponse(parsedRequest.requestType, assistantResponse.length, 'final');
        setIsTyping(false, conversationIdForThisSearch);
      } else {
        setTypingMessage(typingCopy.preparingResponse, conversationIdForThisSearch);
      }

      // Clear or preserve contextual memory depending on search results.
      // This must not block the final assistant message from reaching the user.
      void (async () => {
        try {
          const flightsCount = (structuredData as any)?.combinedData?.flights?.length ?? 0;
          const hotelsCount = (structuredData as any)?.combinedData?.hotels?.length ?? 0;
          const hasPlannerData = Boolean((structuredData as any)?.plannerData);
          const hasDiscoveryContext = Boolean((structuredData as any)?.discoveryContext);
          const hasQuoteContext = Boolean((structuredData as any)?.quoteContext);
          const hasResults = flightsCount > 0 || hotelsCount > 0 || hasPlannerData || hasDiscoveryContext || hasQuoteContext;

          if (hasResults) {
            // We have usable results, clear old contextual memory
            await clearContextualMemory(finalConversationId);

            if (hasPlannerData && (structuredData as any)?.source) {
              // Canonical itinerary result — use unified persistence pipeline
              await persistCanonicalResult(structuredData as CanonicalItineraryResult, { persistPlannerState });
            } else if (hasPlannerData && persistPlannerState && conversationTurn.responseMode !== 'show_places') {
              // Non-canonical (other request types) — legacy persistence
              await persistPlannerState((structuredData as any).plannerData, 'chat');
            }

            // Extract actual dates from the first flight found (if any)
            const firstFlight = (structuredData as any)?.combinedData?.flights?.[0];
            const actualDepartureDate = firstFlight?.departure_date || parsedRequest.flights?.departureDate;
            const actualReturnDate = firstFlight?.return_date || parsedRequest.flights?.returnDate;

            if (parsedRequest.requestType !== 'itinerary') {
              // Build ContextState via shared builder
              const normalizedFlight = parsedRequest.flights ? normalizeFlightRequest(parsedRequest.flights) : null;
              const newConstraints: Array<{ component: string; constraint: string; value: unknown }> = [];
              if (iterationContext.isIteration && parsedRequest.hotels?.hotelChains) {
                newConstraints.push({ component: 'hotels', constraint: 'hotelChains', value: parsedRequest.hotels.hotelChains });
              }
              if (iterationContext.isIteration && parsedRequest.hotels?.hotelName) {
                newConstraints.push({ component: 'hotels', constraint: 'hotelName', value: parsedRequest.hotels.hotelName });
              }

              const newContextState = buildTurnContextState({
                requestType: parsedRequest.requestType as 'flights' | 'hotels' | 'combined',
                flightsParams: normalizedFlight ? {
                  origin: normalizedFlight.origin || '',
                  destination: normalizedFlight.destination || '',
                  departureDate: actualDepartureDate || normalizedFlight.departureDate || '',
                  returnDate: actualReturnDate || normalizedFlight.returnDate,
                  tripType: normalizedFlight.tripType,
                  segments: normalizedFlight.segments,
                  adults: normalizedFlight.adults || 1,
                  children: normalizedFlight.children || 0,
                  infants: normalizedFlight.infants || 0,
                  stops: normalizedFlight.stops,
                  preferredAirline: normalizedFlight.preferredAirline,
                  luggage: normalizedFlight.luggage,
                  maxLayoverHours: normalizedFlight.maxLayoverHours,
                } : null,
                hotelsParams: parsedRequest.hotels ? {
                  city: parsedRequest.hotels.city,
                  checkinDate: parsedRequest.hotels.checkinDate,
                  checkoutDate: parsedRequest.hotels.checkoutDate,
                  adults: parsedRequest.hotels.adults || 1,
                  children: parsedRequest.hotels.children || 0,
                  infants: parsedRequest.hotels.infants || 0,
                  roomType: parsedRequest.hotels.roomType,
                  mealPlan: parsedRequest.hotels.mealPlan,
                  hotelChains: parsedRequest.hotels.hotelChains,
                  hotelName: parsedRequest.hotels.hotelName,
                } : null,
                flightsCount,
                hotelsCount,
                previousState: persistentState,
                newConstraints,
              });

              saveContextState(finalConversationId, newContextState).catch((e) => console.warn('⚠️ [CONTEXT] Failed to save context state:', e));
            }
          } else {
            // No results - preserve context for retry (e.g., "con escalas")
            console.log('⚠️ [STATE] No results, preserving context for potential retry');
            saveContextualMemory(finalConversationId, parsedRequest).catch((e) => console.warn('⚠️ [MEMORY] Failed to save contextual memory:', e));
          }
        } catch (memErr) {
          console.warn('⚠️ [MEMORY] Could not update contextual memory after search:', memErr);
        }
      })();

      // 5. Save response with structured data
      console.log('📤 [MESSAGE FLOW] Step 13: About to save assistant message (Supabase INSERT)');
      const suggestedActions = buildSuggestedActions({
        parsedRequest,
        plannerState: plannerState as TripPlannerState | null,
        structuredData,
        assistantResponseNumber: assistantResponseCountBeforeTurn + 1,
        language: userLanguage,
      });

      // Generate client_id for the assistant message so the 5-layer dedup in
      // useChat.ts can match the Realtime echo against the optimistic insert
      // by client_id (instead of falling through to the heuristic at STEP 4
      // which logs "ADDING NEW MESSAGE TO STATE - This may cause duplication").
      const assistantClientId = crypto.randomUUID();
      console.log('🔑 [IDEMPOTENCY] Generated assistant client_id:', assistantClientId);

      // Save assistant message to database
      const saveAssistantStart = nowMs();
      const savedAssistantMessagePromise = addMessageViaSupabase({
        conversation_id: finalConversationId,
        role: 'assistant' as const,
        content: { text: assistantResponse },
        meta: (structuredData as any)?.source
          ? {
              ...buildCanonicalMeta(structuredData as CanonicalItineraryResult),
              ...(suggestedActions.length > 0 ? { suggestedActions } : {}),
              ...(shouldHardClose ? { conversationClosure: { phase: 'hard_close', assistantResponseNumber: assistantResponseCountBeforeTurn + 1 } } : {}),
              responseLanguage: userLanguage,
              client_id: assistantClientId,
            }
          : {
              messageType: conversationTurn.messageType,
              responseMode: conversationTurn.responseMode,
              ...(conversationTurn.normalizedMissingFields.length > 0 ? { normalizedMissingFields: conversationTurn.normalizedMissingFields } : {}),
              requestText: parsedRequest.originalMessage || currentMessage,
              ...(structuredData ? { source: 'AI_PARSER + EUROVIPS', ...structuredData } : {}),
              ...(suggestedActions.length > 0 ? { suggestedActions } : {}),
              ...(shouldHardClose ? { conversationClosure: { phase: 'hard_close', assistantResponseNumber: assistantResponseCountBeforeTurn + 1 } } : {}),
              emiliaRoute: {
                route: routeResult.route,
                score: routeResult.score,
                reason: routeResult.reason,
                inferredFields: routeResult.inferredFields,
              },
              ...(narrativeChips ? { emiliaNarrative: { chips: narrativeChips } } : {}),
              conversationTurn,
              responseLanguage: userLanguage,
              client_id: assistantClientId,
            },
      }).then((saved) => {
        logTimingStep('MESSAGE FLOW', 'save assistant message', saveAssistantStart, {
          hasStructuredData: Boolean(structuredData),
        });
        emitLatency({
          stage: 'assistant_save',
          latencyMs: nowMs() - saveAssistantStart,
          payload: { saved: Boolean(saved), hasStructuredData: Boolean(structuredData) },
        });
        return saved;
      });

      if (assistantStreamDraft) {
        await assistantStreamDraft.done;
      }
      const savedAssistantMessage = await savedAssistantMessagePromise;
      if (savedAssistantMessage) {
        addOptimisticMessage(savedAssistantMessage);
      }

      console.log('✅ [MESSAGE FLOW] Step 14: Assistant message saved successfully');

      if (assistantStreamDraft) {
        removeOptimisticMessage(assistantStreamDraft.id);
        assistantStreamDraft = null;
      }

      // ✅ Hide typing indicator for THIS conversation (not the current one, in case user switched)
      setIsTyping(false, conversationIdForThisSearch);
      setIsLoading(false);
      console.log('✅ [TYPING] Hiding typing indicator for conversation:', conversationIdForThisSearch);

      // 6. Lead generation disabled - Only manual creation via button
      console.log('📋 [MESSAGE FLOW] Step 15: Automatic lead generation disabled - only manual creation available');

      console.log('🎉 [MESSAGE FLOW] Message processing completed successfully');
      emitLatency({
        stage: 'turn_total',
        latencyMs: nowMs() - turnStartedAt,
        payload: {
          requestType: parsedRequest.requestType,
          hasStructuredData: Boolean(structuredData),
        },
      });
      flowTimer.end('total', {
        requestType: parsedRequest.requestType,
        hasStructuredData: Boolean(structuredData),
      });

    } catch (error) {
      emitLatency({
        stage: 'turn_total',
        latencyMs: nowMs() - turnStartedAt,
        status: 'error',
        error,
      });
      flowTimer.fail('failed', error, {
        conversationId: currentConversationId,
      });
      console.error('❌ [MESSAGE FLOW] Error in handleSendMessage process:', error);

      if (assistantStreamDraft) {
        removeAssistantStreamDraft();
      }

      // ✅ Hide indicators for THIS conversation (not the current one)
      setIsLoading(false);
      setIsTyping(false, conversationIdForThisSearch);
      console.log('❌ [TYPING] Hiding typing indicator due to error for conversation:', conversationIdForThisSearch);

      toast({
        title: t('toasts.messageFailed.title'),
        description: t('toasts.messageFailed.description'),
        variant: "destructive",
      });
    }
  }, [
    selectedConversation,
    loadContextualMemory,
    saveContextualMemory,
    clearContextualMemory,
    updateMessageStatus,
    updateConversationTitle,
    handleCheaperFlightsSearch,
    handlePriceChangeRequest,
    setIsLoading,
    setIsTyping,
    setMessage,
    toast,
    messages,
    getContextFromLastFlights,
    persistPlannerState,
    plannerState,
    setDraftPlannerFromRequest,
    setPlannerDraftPhase,
    updatePlannerState,
    setTypingMessage,
    addOptimisticMessage,
    updateOptimisticMessage,
    removeOptimisticMessage,
    saveAndDisplayMessage,
    startAssistantResponseStream,
    chatMode,
  ]);

  const handlePlannerDateSelection = useCallback(async (
    baseRequest: ParsedTravelRequest,
    selection: {
      startDate?: string;
      endDate?: string;
      isFlexibleDates: boolean;
      flexibleMonth?: string;
      flexibleYear?: number;
      days?: number;
    }
  ) => {
    const currentConversationId = selectedConversationRef.current;
    if (!currentConversationId) {
      toast({
        title: t('toasts.noActivePlanner.title'),
        description: t('toasts.noActivePlanner.description'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setIsTyping(true, currentConversationId);
    const typingCopy = getTypingStatusCopy(normalizeSupportedLanguage(i18n.language));
    setTypingMessage(typingCopy.generatingItinerary, currentConversationId);

    try {
      const computedDays = selection.isFlexibleDates
        ? (selection.days || baseRequest.itinerary?.days)
        : (selection.days || calculateTripDays(selection.startDate, selection.endDate) || baseRequest.itinerary?.days);

      const mergedRequest: ParsedTravelRequest = {
        ...baseRequest,
        requestType: 'itinerary',
        itinerary: {
          ...baseRequest.itinerary,
          days: computedDays,
          startDate: selection.isFlexibleDates ? undefined : selection.startDate,
          endDate: selection.isFlexibleDates ? undefined : selection.endDate,
          isFlexibleDates: selection.isFlexibleDates,
          flexibleMonth: selection.isFlexibleDates ? selection.flexibleMonth : undefined,
          flexibleYear: selection.isFlexibleDates ? selection.flexibleYear : undefined,
          dateSelectionSource: selection.isFlexibleDates ? 'chat_modal_flexible' : 'chat_modal_exact',
        },
        originalMessage: baseRequest.originalMessage,
      };

      setDraftPlannerFromRequest?.(mergedRequest);
      const validation = validateItineraryRequiredFields(mergedRequest.itinerary);
      if (!validation.isValid) {
        const missingInfoMessage = buildEmiliaSearchNarrative({
          mode: 'collect',
          normalized: mergedRequest,
          missingFields: validation.missingFields,
          fallbackMessage: generateMissingInfoMessage(
            validation.missingFieldsSpanish,
            'itinerary',
            {
              itinerary: mergedRequest.itinerary,
              originalMessage: mergedRequest.originalMessage,
            },
            userLanguage
          ),
          language: userLanguage,
        }).text;

        // Phase 2: additive pending_action emit (planner date-selector revalidation).
        // This callback runs outside the main handleSendMessage turn loop, so we
        // bootstrap a fresh CE state via prepareTurnContext.
        try {
          const turnPrep = await prepareTurnContext({
            conversationId: currentConversationId,
            leadId: await resolveLeadIdForConversation(currentConversationId),
            chatMode,
            plannerState: plannerState as TripPlannerState | null,
          });
          if (turnPrep.ctxEngState) {
            const plannerId = (plannerState as TripPlannerState | null)?.id;
            await emitPendingAction({
              ctxEngState: turnPrep.ctxEngState,
              action: {
                kind: 'awaiting_user_input',
                for: 'itinerary_completion',
                fields: toCanonicalFields(validation.missingFields),
                prompt: missingInfoMessage.slice(0, 240),
                ref: plannerId ? { type: 'plan', id: plannerId } : undefined,
                issuedAt: new Date().toISOString(),
              },
            });
          }
        } catch (e) {
          console.warn('[CTX-ENG] handlePlannerDateSelection emitPendingAction failed:', e);
        }

        await saveAndDisplayMessage({
          conversation_id: currentConversationId,
          role: 'assistant',
          content: { text: missingInfoMessage },
          meta: {
            status: 'sent',
            messageType: 'missing_info_request',
            missingFields: validation.missingFields,
            originalRequest: mergedRequest,
            plannerPromptAction: 'open_date_selector',
            plannerDateSelector: {
              enabled: true,
              mode: 'required',
              suggestedDurationDays: mergedRequest.itinerary?.days,
              suggestedMonthText: mergedRequest.originalMessage,
            }
          }
        });

        await saveContextualMemory(currentConversationId, mergedRequest);
        setIsTyping(false, currentConversationId);
        setIsLoading(false);
        return;
      }

      setPlannerDraftPhase?.('draft_generating');
      await saveAndDisplayMessage({
        conversation_id: currentConversationId,
        role: 'user',
        content: { text: formatPlannerDateSelectionMessage(selection) },
        meta: {
          status: 'sent',
          messageType: 'planner_date_selection',
          originalRequest: mergedRequest,
        }
      });

      const itineraryResult = await handleItineraryRequest(mergedRequest, plannerState || null, {
        conversationId: currentConversationId,
        leadId: await resolveLeadIdForConversation(currentConversationId),
        leadProfile: null,
      });
      const assistantResponse = itineraryResult.response;
      const structuredData = itineraryResult.data;
      const hasPlannerData = Boolean((structuredData as any)?.plannerData);

      if (hasPlannerData) {
        await clearContextualMemory(currentConversationId);
        if (persistPlannerState) {
          await persistPlannerState((structuredData as any).plannerData, 'chat');
        }
      } else {
        await saveContextualMemory(currentConversationId, mergedRequest);
      }

      await saveAndDisplayMessage({
        conversation_id: currentConversationId,
        role: 'assistant',
        content: { text: assistantResponse },
        meta: structuredData
          ? {
              source: 'PLANNER_DATE_MODAL',
              ...structuredData,
              originalRequest: mergedRequest,
            }
          : {
              source: 'PLANNER_DATE_MODAL',
              originalRequest: mergedRequest,
            }
      });

      setIsTyping(false, currentConversationId);
      setIsLoading(false);
    } catch (error) {
      console.error('❌ [PLANNER DATE MODAL] Error continuing planner flow:', error);
      setIsLoading(false);
      setIsTyping(false, currentConversationId);
      toast({
        title: t('toasts.plannerDateFailed.title'),
        description: t('toasts.plannerDateFailed.description'),
        variant: "destructive",
      });
    }
  }, [
    clearContextualMemory,
    persistPlannerState,
    plannerState,
    saveContextualMemory,
    setDraftPlannerFromRequest,
    setPlannerDraftPhase,
    selectedConversationRef,
    setIsLoading,
    setIsTyping,
    setTypingMessage,
    toast,
    validateItineraryRequiredFields,
    saveAndDisplayMessage,
    chatMode,
  ]);

  return {
    handleSendMessage,
    handlePlannerDateSelection,
  };
};

export default useMessageHandler;
