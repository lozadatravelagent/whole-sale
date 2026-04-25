// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before all imports
// ---------------------------------------------------------------------------

vi.mock('@/services/aiMessageParser', () => ({
  parseMessageWithAI: vi.fn(),
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
    reason: 'test-route',
    dimensions: { destination: 1, dates: 1, passengers: 1, origin: 1, complexity: 1 },
    inferredFields: [],
  }),
  buildSearchSummary: vi.fn().mockReturnValue(''),
  getInferredFieldDetails: vi.fn().mockReturnValue([]),
}));

vi.mock('../services/conversationOrchestrator', () => ({
  resolveConversationTurn: vi.fn().mockReturnValue({
    shouldAskMinimalQuestion: false,
    shouldUseStandardItinerary: false,
    executionBranch: 'standard_search',
    responseMode: 'standard',
    messageType: 'standard_response',
    normalizedMissingFields: [],
    uiMeta: { route: 'QUOTE', reason: '', firstPlanHandledAs: null },
  }),
  buildConversationalMissingInfoMessage: vi.fn().mockReturnValue('collect message'),
  buildModeBridgeMessage: vi.fn().mockReturnValue('bridge message'),
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
  buildDiscoveryResponsePayload: vi.fn().mockResolvedValue({
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

// ---------------------------------------------------------------------------
// Imports (after mocks are declared)
// ---------------------------------------------------------------------------

import useMessageHandler from '../hooks/useMessageHandler';
import { parseMessageWithAI } from '@/services/aiMessageParser';
import { addMessageViaSupabase } from '../services/messageService';
import { routeRequest } from '../services/routeRequest';
import { resolveConversationTurn } from '../services/conversationOrchestrator';
import { detectIterationIntent, mergeIterationContext } from '../utils/iterationDetection';
import { buildProps, buildMessageRow, buildParsedRequest, DEFAULT_CONV_ID } from '@/test-utils/useMessageHandlerFactory';

// ---------------------------------------------------------------------------
// Local render helper — spreads props in the hook's positional order
// ---------------------------------------------------------------------------

function renderHandler(p: ReturnType<typeof buildProps>) {
  return renderHook(() => useMessageHandler(
    p.selectedConversation,
    p.selectedConversationRef as React.MutableRefObject<string | null>,
    p.messages,
    p.previousParsedRequest,
    p.setPreviousParsedRequest,
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
      vi.mocked(parseMessageWithAI).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      expect(p.loadContextualMemory).toHaveBeenCalledWith(DEFAULT_CONV_ID);
    });

    it('skips loadContextualMemory when preloadedContext matches conversation and messages exist', async () => {
      // canUsePreloaded requires messages.length > 0 in addition to a matching preloadedContext
      const p = buildProps({
        messages: [buildMessageRow()],
        preloadedContext: {
          conversationId: DEFAULT_CONV_ID,
          contextualMemory: null,
          contextState: null,
        },
      });
      vi.mocked(parseMessageWithAI).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      expect(p.loadContextualMemory).not.toHaveBeenCalled();
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
        },
      });
      vi.mocked(parseMessageWithAI).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      expect(vi.mocked(parseMessageWithAI)).toHaveBeenCalledWith(
        'quiero volar',
        storedMemory,
        expect.any(Array),
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
        reason: 'missing destination',
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
        uiMeta: { route: 'COLLECT', reason: 'missing destination', firstPlanHandledAs: null },
      });

      const p = buildProps();
      vi.mocked(parseMessageWithAI).mockResolvedValue(MISSING_INFO_PARSED);
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
        reason: 'missing destination',
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
        uiMeta: { route: 'COLLECT', reason: 'exhausted', firstPlanHandledAs: null },
      });

      const p = buildProps({ messages: [collectMsg, collectMsg, collectMsg] });
      vi.mocked(parseMessageWithAI).mockResolvedValue(MISSING_INFO_PARSED);
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
  // Iteration merge
  // -------------------------------------------------------------------------
  describe('handleSendMessage — iteration merge', () => {
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
      vi.mocked(parseMessageWithAI).mockResolvedValue(MISSING_INFO_PARSED);
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

    it('does NOT call mergeIterationContext when detectIterationIntent returns isIteration false', async () => {
      const p = buildProps();
      vi.mocked(parseMessageWithAI).mockResolvedValue(MISSING_INFO_PARSED);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      expect(vi.mocked(mergeIterationContext)).not.toHaveBeenCalled();
    });
  });
});
