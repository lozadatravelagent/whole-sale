// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before all imports
// ---------------------------------------------------------------------------

vi.mock('@/services/aiMessageParser', () => ({
  parseMessageWithAI: vi.fn(), parseMessageWithAIStreaming: vi.fn(),
  combineWithPreviousRequest: vi.fn((_prev: any, _msg: string, next: any) => next),
  validateFlightRequiredFields: vi.fn().mockReturnValue({ isValid: true, missingFields: [], missingFieldsSpanish: [] }),
  validateHotelRequiredFields: vi.fn().mockReturnValue({ isValid: true, missingFields: [], missingFieldsSpanish: [] }),
  validateItineraryRequiredFields: vi.fn().mockReturnValue({ isValid: true, missingFields: [], missingFieldsSpanish: [] }),
  generateMissingInfoMessage: vi.fn().mockReturnValue(''),
  formatForStarling: vi.fn(),
  formatForEurovips: vi.fn(),
  generateSearchId: vi.fn(),
  normalizeFlightRequest: vi.fn((x: any) => x),
  getNormalizedFlightSegments: vi.fn().mockReturnValue([]),
  getHotelSegments: vi.fn().mockReturnValue([]),
  getPrimaryHotelRequest: vi.fn().mockReturnValue(null),
  hasFlexibleItineraryDateSelection: vi.fn().mockReturnValue(false),
  hasExactItineraryDateRange: vi.fn().mockReturnValue(false),
  hasUsableItineraryDates: vi.fn().mockReturnValue(false),
  resolveItineraryDateRange: vi.fn().mockReturnValue(null),
  normalizeDestinationListToCapitals: vi.fn((x: any) => x),
  normalizeParsedFlightRequest: vi.fn((x: any) => x),
  normalizeSupportedLanguage: vi.fn().mockReturnValue('es'),
  detectMessageLanguage: vi.fn().mockReturnValue('es'),
}));

vi.mock('../services/searchHandlers', () => ({
  handleFlightSearch: vi.fn().mockResolvedValue({ response: 'flight results', data: {} }),
  handleHotelSearch: vi.fn().mockResolvedValue({ response: 'hotel results', data: {} }),
  handleCombinedSearch: vi.fn().mockResolvedValue({ response: 'combined results', data: {} }),
  handlePackageSearch: vi.fn().mockResolvedValue({ response: 'package results', data: {} }),
  handleServiceSearch: vi.fn().mockResolvedValue({ response: 'service results', data: {} }),
  handleGeneralQuery: vi.fn().mockResolvedValue('general results'),
  handleItineraryRequest: vi.fn().mockResolvedValue({ response: 'itinerary results', data: {} }),
}));

vi.mock('../services/messageService', () => ({
  addMessageViaSupabase: vi.fn().mockResolvedValue({
    id: 'saved-msg-1',
    role: 'assistant',
    conversation_id: 'test-conv-123',
    content: { text: 'ok' },
    created_at: new Date().toISOString(),
    meta: null,
    client_id: null,
    status: null,
  }),
}));

vi.mock('@/i18n', () => ({
  default: { t: (key: string) => key, language: 'es' },
}));

vi.mock('../services/routeRequest', () => ({
  routeRequest: vi.fn().mockReturnValue({
    route: 'QUOTE',
    score: 0.9,
    missingFields: [],
    collectQuestion: null,
    reason: 'high_definition',
    dimensions: { destination: 1, dates: 1, passengers: 1, origin: 1, complexity: 1 },
    inferredFields: [],
  }),
  getInferredFieldDetails: vi.fn().mockReturnValue([]),
}));

vi.mock('../services/emiliaNarrative', () => ({
  buildEmiliaSearchNarrative: vi.fn().mockReturnValue({
    text: 'collect message',
    chips: [],
    meta: { inferredFields: [], voice: { mode: 'collect', tone: 'empathic' } },
  }),
}));

vi.mock('../services/proposedSearchBuilder', () => ({
  buildProposedSearch: vi.fn().mockReturnValue({
    principalChipLabel: 'Buscar vuelo + hotel premium a Riviera Maya',
    principalSubmitText: 'Buscar vuelo y hotel premium a Riviera Maya del 2026-05-14 al 2026-05-21 para 2 adultos en habitación doble, saliendo desde EZE',
    alternativeChips: [
      { id: 'alt-adults-only', label: 'Adults-only', submitText: '...adults-only' },
      { id: 'alt-only-hotel', label: 'Solo hotel', submitText: '...hotel' },
    ],
    segments: {
      lead: 'Para tu aniversario en Riviera Maya',
      proposal: 'propongo buscar vuelo y hotel premium para 2 adultos',
      dates: 'del 2026-05-14 al 2026-05-21',
      callToAction: '¿Buscamos esto?',
    },
  }),
}));

vi.mock('../services/conversationOrchestrator', () => ({
  resolveConversationTurn: vi.fn().mockReturnValue({
    shouldAskMinimalQuestion: false,
    shouldUseStandardItinerary: false,
    executionBranch: 'standard_search',
    responseMode: 'standard',
    messageType: 'standard_response',
    normalizedMissingFields: [],
    uiMeta: { route: 'QUOTE', reason: 'high_definition', firstPlanHandledAs: null },
  }),
  buildModeBridgeMessage: vi.fn().mockReturnValue('bridge message'),
  resolveTravelContextBridge: vi.fn(({ parsedRequest }: any) => ({
    kind: null,
    parsedRequest,
    reason: null,
  })),
  buildPlanToQuoteResponse: vi.fn().mockReturnValue({
    response: 'quote active plan',
    data: { messageType: 'quote_active_plan', quoteContext: {} },
  }),
  formatDiscoveryResponse: vi.fn().mockReturnValue(''),
}));

vi.mock('../services/itineraryPipeline', () => ({
  buildCanonicalResultFromStandard: vi.fn().mockReturnValue({}),
  buildCanonicalMeta: vi.fn().mockReturnValue({}),
  persistCanonicalResult: vi.fn().mockResolvedValue(undefined),
  buildTurnContextState: vi.fn().mockReturnValue({}),
  isGenericPlaceholder: vi.fn().mockReturnValue(false),
}));

vi.mock('../services/discoveryService', () => ({
  buildDiscoveryResponseFromToolResult: vi.fn().mockReturnValue({
    text: 'discovery results',
    discoveryContext: {},
    recommendedPlaces: [],
  }),
}));

vi.mock('../utils/iterationDetection', () => ({
  detectIterationIntent: vi.fn().mockReturnValue({
    isIteration: false,
    iterationType: 'new_search',
    baseRequestType: null,
    modifiedComponent: null,
    preserveFields: [],
    confidence: 0,
  }),
  mergeIterationContext: vi.fn((_state: any, req: any) => req),
  generateIterationExplanation: vi.fn().mockReturnValue(''),
}));

vi.mock('../services/conversationKnowledgeService', () => ({
  resolveLeadIdForConversation: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/leadAiProfileService', () => ({
  mergeLeadAiProfile: vi.fn(),
  saveLeadAiProfile: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are declared)
// ---------------------------------------------------------------------------

import useMessageHandler from '../hooks/useMessageHandler';
import { parseMessageWithAI, parseMessageWithAIStreaming } from '@/services/aiMessageParser';
import { addMessageViaSupabase } from '../services/messageService';
import { routeRequest } from '../services/routeRequest';
import { resolveConversationTurn } from '../services/conversationOrchestrator';
import { detectIterationIntent, mergeIterationContext } from '../utils/iterationDetection';
import { buildEmiliaSearchNarrative } from '../services/emiliaNarrative';
import { buildProposedSearch } from '../services/proposedSearchBuilder';
import { buildProps, buildMessageRow, buildParsedRequest, DEFAULT_CONV_ID } from '@/test-utils/useMessageHandlerFactory';

// ---------------------------------------------------------------------------
// Local render helper — spreads props in the hook's positional order
// ---------------------------------------------------------------------------

function renderHandler(p: ReturnType<typeof buildProps>) {
  return renderHook(() => useMessageHandler(
    p.selectedConversation,
    p.selectedConversationRef as React.MutableRefObject<string | null>,
    p.messages,
    p.loadContextualMemory,
    p.saveContextualMemory,
    p.clearContextualMemory,
    p.loadContextState,
    p.saveContextState,
    p.updateMessageStatus,
    p.updateConversationTitle,
    p.handleCheaperFlightsSearch,
    p.handlePriceChangeRequest,
    p.setIsLoading,
    p.setIsTyping,
    p.setMessage,
    p.toast,
    p.setTypingMessage,
    p.addOptimisticMessage,
    p.updateOptimisticMessage,
    p.removeOptimisticMessage,
    p.plannerContextRequest,
    p.plannerState,
    p.persistPlannerState,
    p.setDraftPlannerFromRequest,
    p.setPlannerDraftPhase,
    p.updatePlannerState,
    p.preloadedContext,
    p.workspaceMode,
    p.chatMode,
  ));
}

// Shared parsedRequest that hits the switch's missing_info_request case — avoids
// flight/hotel validation and lets us focus on the branch under test.
const MISSING_INFO_PARSED = buildParsedRequest({
  requestType: 'missing_info_request',
  message: 'Por favor indicá el destino',
  missingFields: ['destination'],
  originalMessage: 'quiero volar',
}) as any;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMessageHandler', () => {
  // -------------------------------------------------------------------------
  // Context loading
  // -------------------------------------------------------------------------
  describe('handleSendMessage — context loading', () => {
    it('calls loadContextualMemory when preloadedContext is undefined', async () => {
      const p = buildProps({ preloadedContext: undefined });
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      expect(p.loadContextualMemory).toHaveBeenCalledWith(DEFAULT_CONV_ID);
    });

    it('falls back to DB context when matching preloadedContext is empty', async () => {
      const p = buildProps({
        messages: [buildMessageRow()],
        preloadedContext: {
          conversationId: DEFAULT_CONV_ID,
          contextualMemory: null,
          contextState: null,
          leadId: null,
        },
      });
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      expect(p.loadContextualMemory).toHaveBeenCalledWith(DEFAULT_CONV_ID);
      expect(p.loadContextState).toHaveBeenCalledWith(DEFAULT_CONV_ID);
    });

    it('skips DB context loading when matching preloadedContext has state', async () => {
      const p = buildProps({
        messages: [buildMessageRow()],
        preloadedContext: {
          conversationId: DEFAULT_CONV_ID,
          contextualMemory: buildParsedRequest({ requestType: 'flights' }),
          contextState: {
            lastSearch: {
              requestType: 'flights',
              timestamp: '2026-01-01T00:00:00Z',
              flightsParams: {
                origin: 'EZE',
                destination: 'CUN',
                departureDate: '2026-07-01',
                adults: 2,
                children: 0,
                infants: 0,
              },
            },
            constraintsHistory: [],
            turnNumber: 1,
            schemaVersion: 1,
          },
          leadId: 'lead-1',
        },
      });
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      expect(p.loadContextualMemory).not.toHaveBeenCalled();
      expect(p.loadContextState).not.toHaveBeenCalled();
    });

    it('passes preloadedContext.contextualMemory as context arg to parseMessageWithAI', async () => {
      const storedMemory = buildParsedRequest({
        requestType: 'flights',
        originalMessage: 'vuelo previo a Roma',
      });
      const p = buildProps({
        messages: [buildMessageRow()],
        preloadedContext: {
          conversationId: DEFAULT_CONV_ID,
          contextualMemory: storedMemory,
          contextState: null,
          leadId: null,
        },
      });
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      // parseMessageWithAIStreaming signature: (message, knowledge, language, onProgress?)
      expect(vi.mocked(parseMessageWithAIStreaming)).toHaveBeenCalledWith(
        'quiero volar',
        expect.objectContaining({
          historyWindow: 15,
          contextMeta: expect.objectContaining({
            conversationId: DEFAULT_CONV_ID,
            leadId: null,
          }),
        }),
        expect.any(String),
        expect.any(Function),
      );
    });

    it('passes preloadedContext.contextState as flat previousContext to the parser', async () => {
      const contextState = {
        lastSearch: {
          requestType: 'combined' as const,
          timestamp: '2026-05-14T18:00:00Z',
          flightsParams: {
            origin: 'EZE',
            destination: 'CUN',
            departureDate: '2026-05-17',
            returnDate: '2026-05-20',
            adults: 2,
            children: 0,
            infants: 0,
          },
          hotelsParams: {
            city: 'Cancun',
            checkinDate: '2026-05-17',
            checkoutDate: '2026-05-20',
            adults: 2,
            children: 0,
            infants: 0,
          },
        },
        constraintsHistory: [],
        turnNumber: 1,
        schemaVersion: 1,
      };
      const p = buildProps({
        messages: [buildMessageRow()],
        preloadedContext: {
          conversationId: DEFAULT_CONV_ID,
          contextualMemory: null,
          contextState,
          leadId: null,
        },
      });
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero una semana');
      });

      expect(vi.mocked(parseMessageWithAIStreaming)).toHaveBeenCalledWith(
        'quiero una semana',
        expect.objectContaining({
          previousContext: expect.objectContaining({
            requestType: 'combined',
            flights: expect.objectContaining({
              origin: 'EZE',
              destination: 'CUN',
              returnDate: '2026-05-20',
            }),
            hotels: expect.objectContaining({
              city: 'Cancun',
              checkoutDate: '2026-05-20',
            }),
          }),
        }),
        expect.any(String),
        expect.any(Function),
      );
    });
  });

  // -------------------------------------------------------------------------
  // COLLECT routing
  // -------------------------------------------------------------------------
  describe('handleSendMessage — COLLECT routing', () => {
    it('returns COLLECT question and saves context when route is COLLECT and turns < 3', async () => {
      vi.mocked(routeRequest).mockReturnValueOnce({
        route: 'COLLECT',
        score: 0.4,
        missingFields: ['destination'],
        collectQuestion: '¿A dónde querés viajar?',
        reason: 'needs_clarification',
        dimensions: { destination: 0, dates: 1, passengers: 1, origin: 1, complexity: 1 },
        inferredFields: [],
      });
      vi.mocked(resolveConversationTurn).mockReturnValueOnce({
        shouldAskMinimalQuestion: true,
        shouldUseStandardItinerary: false,
        executionBranch: 'ask_minimal',
        responseMode: 'needs_input',
        messageType: 'collect_question',
        normalizedMissingFields: ['destination'],
        uiMeta: { route: 'COLLECT', reason: 'needs_clarification', firstPlanHandledAs: null },
      });

      const p = buildProps();
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      expect(p.saveContextualMemory).toHaveBeenCalled();

      const assistantCall = vi.mocked(addMessageViaSupabase).mock.calls.find(
        (c) => c[0].role === 'assistant'
      );
      expect(assistantCall).toBeDefined();
      expect((assistantCall![0].meta as any).messageType).toBe('collect_question');
    });

    // Phase 3 / sub-task C: verify the migrated COLLECT call site invokes
    // `buildEmiliaSearchNarrative({mode:'collect'})` directly (replacing the
    // legacy `buildConversationalMissingInfoMessage` wrapper, which has been
    // deleted from `conversationOrchestrator.ts`).
    it('invokes buildEmiliaSearchNarrative with mode:collect from the COLLECT router branch', async () => {
      vi.mocked(routeRequest).mockReturnValueOnce({
        route: 'COLLECT',
        score: 0.4,
        missingFields: ['destination'],
        collectQuestion: '¿A dónde querés viajar?',
        reason: 'needs_clarification',
        dimensions: { destination: 0, dates: 1, passengers: 1, origin: 1, complexity: 1 },
        inferredFields: [],
      });
      vi.mocked(resolveConversationTurn).mockReturnValueOnce({
        shouldAskMinimalQuestion: true,
        shouldUseStandardItinerary: false,
        executionBranch: 'ask_minimal',
        responseMode: 'needs_input',
        messageType: 'collect_question',
        normalizedMissingFields: ['destination'],
        uiMeta: { route: 'COLLECT', reason: 'needs_clarification', firstPlanHandledAs: null },
      });

      const p = buildProps();
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      const narrativeCalls = vi.mocked(buildEmiliaSearchNarrative).mock.calls;
      const collectCall = narrativeCalls.find((c) => (c[0] as any).mode === 'collect');
      expect(collectCall).toBeDefined();
      expect(((collectCall as any)[0]).missingFields).toEqual(['destination']);
      expect(((collectCall as any)[0]).fallbackMessage).toBe('¿A dónde querés viajar?');
    });

    it('falls through to search when shouldAskMinimalQuestion is false despite COLLECT route', async () => {
      // Build 3 prior collect messages so recentCollectCount reaches MAX_COLLECT_TURNS (3).
      // The orchestrator (mocked) receives that count and decides shouldAskMinimalQuestion: false.
      // This test validates the hook's fall-through given that orchestrator decision — it does NOT
      // test the orchestrator's own exhaustion logic.
      const collectMsg = buildMessageRow({
        role: 'assistant',
        conversation_id: DEFAULT_CONV_ID,
        meta: { messageType: 'collect_question' } as any,
      });
      vi.mocked(routeRequest).mockReturnValueOnce({
        route: 'COLLECT',
        score: 0.4,
        missingFields: ['destination'],
        collectQuestion: '¿A dónde querés viajar?',
        reason: 'needs_clarification',
        dimensions: { destination: 0, dates: 1, passengers: 1, origin: 1, complexity: 1 },
        inferredFields: [],
      });
      vi.mocked(resolveConversationTurn).mockReturnValueOnce({
        shouldAskMinimalQuestion: false,
        shouldUseStandardItinerary: false,
        executionBranch: 'standard_search',
        responseMode: 'standard',
        messageType: 'standard_response',
        normalizedMissingFields: [],
        uiMeta: { route: 'COLLECT', reason: 'needs_clarification', firstPlanHandledAs: null },
      });

      const p = buildProps({ messages: [collectMsg, collectMsg, collectMsg] });
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      // COLLECT early-return was NOT taken — no collect_question assistant message
      const collectQCall = vi.mocked(addMessageViaSupabase).mock.calls.find(
        (c) => c[0].role === 'assistant' && (c[0].meta as any)?.messageType === 'collect_question'
      );
      expect(collectQCall).toBeUndefined();

      // Flow ran to completion — an assistant message was saved (from switch case)
      const anyAssistantCall = vi.mocked(addMessageViaSupabase).mock.calls.find(
        (c) => c[0].role === 'assistant'
      );
      expect(anyAssistantCall).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Phase 5 / sub-task C — proposal_chip branch (exploratory_with_seeds)
  // -------------------------------------------------------------------------
  describe('handleSendMessage — proposal_chip branch', () => {
    const PROPOSAL_TURN = {
      shouldAskMinimalQuestion: false,
      shouldUseStandardItinerary: false,
      executionBranch: 'proposal_chip' as const,
      responseMode: 'proposal_first_search' as const,
      messageType: 'search_proposal' as const,
      normalizedMissingFields: [],
      uiMeta: { route: 'COLLECT', reason: 'exploratory_with_seeds', firstPlanHandledAs: null },
    };

    const EXPLORATORY_PARSED = buildParsedRequest({
      requestType: 'general',
      originalMessage: 'Quiero algo premium en Riviera Maya para aniversario, dos personas',
    });
    // Stamp searchSeeds onto the parsed request so the handler can pass it to
    // buildProposedSearch (the mock ignores its content but the call shape
    // matters).
    (EXPLORATORY_PARSED as any).searchSeeds = {
      destination: 'Riviera Maya',
      travelerType: 'couple',
      budgetHint: 'premium',
      occasionHint: 'anniversary',
      productsImplied: ['flight', 'hotel'],
      adults: 2,
    };

    it('proposal_chip branch invokes buildProposedSearch with parsedRequest + profile + language', async () => {
      vi.mocked(resolveConversationTurn).mockReturnValueOnce(PROPOSAL_TURN as any);
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(EXPLORATORY_PARSED as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('Quiero algo premium en Riviera Maya para aniversario, dos personas');
      });

      expect(vi.mocked(buildProposedSearch)).toHaveBeenCalledTimes(1);
      const [parsedArg, optionsArg] = vi.mocked(buildProposedSearch).mock.calls[0];
      expect(parsedArg).toMatchObject({
        searchSeeds: expect.objectContaining({ destination: 'Riviera Maya' }),
      });
      expect(optionsArg).toMatchObject({
        language: 'es',
      });
      // profile may be null (no ctxEngState) — the option key still exists.
      expect(optionsArg).toHaveProperty('profile');
      expect(optionsArg).toHaveProperty('now');
    });

    it('proposal_chip branch produces narrative.text and chips with kind=submit and persists them to meta.emiliaNarrative', async () => {
      vi.mocked(resolveConversationTurn).mockReturnValueOnce(PROPOSAL_TURN as any);
      // Override the narrative mock for this test to return chips with kind:submit.
      vi.mocked(buildEmiliaSearchNarrative).mockReturnValueOnce({
        text: 'Para tu aniversario en Riviera Maya propongo... ¿Buscamos esto?',
        chips: [
          {
            id: 'proposed-search-principal',
            label: 'Buscar vuelo + hotel premium a Riviera Maya',
            action: { kind: 'submit', text: 'Buscar vuelo y hotel premium a Riviera Maya del 2026-05-14 al 2026-05-21 para 2 adultos en habitación doble' },
          },
          {
            id: 'alt-adults-only',
            label: 'Adults-only',
            action: { kind: 'submit', text: '...adults-only' },
          },
        ],
        meta: { inferredFields: [], voice: { mode: 'search_proposal', tone: 'summary' } },
      } as any);
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(EXPLORATORY_PARSED as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('Quiero algo premium en Riviera Maya para aniversario, dos personas');
      });

      const assistantCall = vi.mocked(addMessageViaSupabase).mock.calls.find(
        (c) => c[0].role === 'assistant'
      );
      expect(assistantCall).toBeDefined();
      const meta = (assistantCall![0].meta as any);
      expect(meta.messageType).toBe('search_proposal');
      expect(meta.responseMode).toBe('proposal_first_search');
      expect(meta.emiliaNarrative).toBeDefined();
      expect(meta.emiliaNarrative.chips).toHaveLength(2);
      expect(meta.emiliaNarrative.chips[0].action.kind).toBe('submit');
      expect(meta.emiliaNarrative.chips[0].id).toBe('proposed-search-principal');
      expect(assistantCall![0].content).toEqual({ text: expect.stringContaining('Riviera Maya') });
    });

    it('proposal_chip with builder returning null falls back to collect narrative copy', async () => {
      vi.mocked(resolveConversationTurn).mockReturnValueOnce(PROPOSAL_TURN as any);
      vi.mocked(buildProposedSearch).mockReturnValueOnce(null);
      vi.mocked(buildEmiliaSearchNarrative).mockReturnValueOnce({
        text: 'fallback collect message',
        chips: [],
        meta: { inferredFields: [], voice: { mode: 'collect', tone: 'empathic' } },
      } as any);
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(EXPLORATORY_PARSED as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('Quiero algo premium en Riviera Maya');
      });

      // The narrative was invoked with mode:collect (fallback path), not search_proposal.
      const narrativeCalls = vi.mocked(buildEmiliaSearchNarrative).mock.calls;
      const collectCall = narrativeCalls.find((c) => (c[0] as any).mode === 'collect');
      expect(collectCall).toBeDefined();

      const assistantCall = vi.mocked(addMessageViaSupabase).mock.calls.find(
        (c) => c[0].role === 'assistant'
      );
      expect(assistantCall).toBeDefined();
      const meta = (assistantCall![0].meta as any);
      // Still emits messageType='search_proposal' (the orchestrator's classification)
      // even though the narrative degraded to collect copy. emiliaNarrative.chips
      // is omitted since the fallback path doesn't capture chips.
      expect(meta.messageType).toBe('search_proposal');
      expect(meta.emiliaNarrative).toBeUndefined();
      expect(assistantCall![0].content).toEqual({ text: 'fallback collect message' });
    });
  });

  // -------------------------------------------------------------------------
  // Iteration merge
  // -------------------------------------------------------------------------
  describe('handleSendMessage — iteration merge', () => {
    it('uses parser iterationIntent as the primary refinement signal before routing', async () => {
      const contextState = {
        lastSearch: {
          requestType: 'combined' as const,
          timestamp: '2026-05-14T18:00:00Z',
          flightsParams: {
            origin: 'EZE',
            destination: 'CUN',
            departureDate: '2026-05-17',
            returnDate: '2026-05-20',
            adults: 2,
            children: 0,
            infants: 0,
          },
          hotelsParams: {
            city: 'Cancun',
            checkinDate: '2026-05-17',
            checkoutDate: '2026-05-20',
            adults: 2,
            children: 0,
            infants: 0,
          },
        },
        constraintsHistory: [],
        turnNumber: 1,
        schemaVersion: 1,
      };

      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(
        buildParsedRequest({
          requestType: 'combined',
          originalMessage: 'quiero una semana',
          flights: {
            origin: 'EZE',
            destination: 'CUN',
            departureDate: '2026-05-17',
            returnDate: '2026-05-24',
            adults: 2,
            children: 0,
            infants: 0,
          },
          hotels: {
            city: 'Cancun',
            checkinDate: '2026-05-17',
            checkoutDate: '2026-05-24',
            adults: 2,
            children: 0,
            infants: 0,
          },
          iterationIntent: {
            isIteration: true,
            type: 'duration_change',
            modifiedFields: ['stayNights', 'flights.returnDate', 'hotels.checkoutDate'],
          },
        }) as any,
      );

      const p = buildProps({
        messages: [buildMessageRow()],
        preloadedContext: {
          conversationId: DEFAULT_CONV_ID,
          contextualMemory: null,
          contextState,
          leadId: null,
        },
      });
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero una semana');
      });

      expect(vi.mocked(mergeIterationContext)).toHaveBeenCalledWith(
        contextState,
        expect.objectContaining({
          requestType: 'combined',
          iterationIntent: expect.objectContaining({ type: 'duration_change' }),
        }),
        expect.objectContaining({
          isIteration: true,
          iterationType: 'stay_duration_modification',
          matchedPattern: 'llm:duration_change',
        }),
      );
      expect(vi.mocked(routeRequest)).toHaveBeenCalledWith(
        expect.objectContaining({
          requestType: 'combined',
          iterationIntent: expect.objectContaining({ type: 'duration_change' }),
          flights: expect.objectContaining({ returnDate: '2026-05-24' }),
          hotels: expect.objectContaining({ checkoutDate: '2026-05-24' }),
        }),
        null,
      );
      expect(vi.mocked(resolveConversationTurn)).toHaveBeenCalledWith(
        expect.objectContaining({
          parsedRequest: expect.objectContaining({ requestType: 'combined' }),
          iterationContext: expect.objectContaining({
            isIteration: true,
            matchedPattern: 'llm:duration_change',
          }),
        }),
      );
    });

    it('calls mergeIterationContext when detectIterationIntent returns isIteration true and persistentState exists', async () => {
      const iterCtx = {
        isIteration: true,
        iterationType: 'hotel_modification' as const,
        baseRequestType: 'hotels' as const,
        modifiedComponent: 'hotels' as const,
        preserveFields: [] as string[],
        confidence: 0.9,
      };
      vi.mocked(detectIterationIntent).mockReturnValueOnce(iterCtx);
      vi.mocked(mergeIterationContext).mockReturnValueOnce(MISSING_INFO_PARSED);

      const persistentState = { lastSearch: { requestType: 'hotels' as const }, turnNumber: 1 };
      const p = buildProps({
        loadContextState: vi.fn().mockResolvedValue(persistentState),
      });
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      expect(vi.mocked(mergeIterationContext)).toHaveBeenCalledWith(
        expect.objectContaining({ lastSearch: { requestType: 'hotels' } }),
        expect.any(Object),
        iterCtx,
      );
    });

    it('routes with the merged search payload before mode_bridge can evaluate the turn', async () => {
      const iterCtx = {
        isIteration: true,
        iterationType: 'stay_duration_modification' as const,
        baseRequestType: 'combined' as const,
        modifiedComponent: 'both' as const,
        preserveFields: [] as string[],
        confidence: 0.9,
        stayModification: { nights: 7 },
      };
      const contextState = {
        lastSearch: {
          requestType: 'combined' as const,
          timestamp: '2026-05-14T18:00:00Z',
          flightsParams: {
            origin: 'EZE',
            destination: 'CUN',
            departureDate: '2026-05-17',
            returnDate: '2026-05-20',
            adults: 2,
            children: 0,
            infants: 0,
          },
          hotelsParams: {
            city: 'Cancun',
            checkinDate: '2026-05-17',
            checkoutDate: '2026-05-20',
            adults: 2,
            children: 0,
            infants: 0,
          },
        },
        constraintsHistory: [],
        turnNumber: 1,
        schemaVersion: 1,
      };
      const mergedRequest = buildParsedRequest({
        requestType: 'combined',
        originalMessage: 'quiero una semana',
        flights: {
          origin: 'EZE',
          destination: 'CUN',
          departureDate: '2026-05-17',
          returnDate: '2026-05-24',
          adults: 2,
          children: 0,
          infants: 0,
        },
        hotels: {
          city: 'Cancun',
          checkinDate: '2026-05-17',
          checkoutDate: '2026-05-24',
          adults: 2,
          children: 0,
          infants: 0,
        },
      });

      vi.mocked(detectIterationIntent).mockReturnValueOnce(iterCtx);
      vi.mocked(mergeIterationContext).mockReturnValueOnce(mergedRequest);
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(
        buildParsedRequest({
          requestType: 'itinerary',
          originalMessage: 'quiero una semana',
          planIntent: true,
          itinerary: { destinations: [], days: 7 },
        }) as any,
      );

      const p = buildProps({
        messages: [buildMessageRow()],
        preloadedContext: {
          conversationId: DEFAULT_CONV_ID,
          contextualMemory: null,
          contextState,
          leadId: null,
        },
      });
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero una semana');
      });

      expect(vi.mocked(routeRequest)).toHaveBeenCalledWith(
        expect.objectContaining({
          requestType: 'combined',
          flights: expect.objectContaining({ returnDate: '2026-05-24' }),
          hotels: expect.objectContaining({ checkoutDate: '2026-05-24' }),
        }),
        null,
      );
      expect(vi.mocked(resolveConversationTurn)).toHaveBeenCalledWith(
        expect.objectContaining({
          parsedRequest: expect.objectContaining({ requestType: 'combined' }),
          iterationContext: iterCtx,
        }),
      );
    });

    it('does NOT call mergeIterationContext when detectIterationIntent returns isIteration false', async () => {
      const p = buildProps();
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      expect(vi.mocked(mergeIterationContext)).not.toHaveBeenCalled();
    });
  });
});
