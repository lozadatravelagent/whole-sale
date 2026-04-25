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
  combineWithPreviousRequest: vi.fn((prev: any, _msg: string, next: any) => next),
  validateFlightRequiredFields: vi.fn().mockReturnValue([]),
  validateHotelRequiredFields: vi.fn().mockReturnValue([]),
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
  handleGeneralQuery: vi.fn().mockResolvedValue({ response: 'general results', data: {} }),
  handleItineraryRequest: vi.fn().mockResolvedValue({ response: 'itinerary results', data: {} }),
}));

vi.mock('../services/messageService', () => ({
  addMessageViaSupabase: vi.fn().mockResolvedValue({ id: 'saved-msg-1', role: 'assistant', conversation_id: 'test-conv-123', content: { text: 'ok' }, created_at: new Date().toISOString(), meta: null, client_id: null, status: null }),
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
    dimensions: {},
    inferredFields: {},
  }),
  buildSearchSummary: vi.fn().mockReturnValue(''),
  getInferredFieldDetails: vi.fn().mockReturnValue([]),
}));

vi.mock('../services/conversationOrchestrator', () => ({
  resolveConversationTurn: vi.fn().mockReturnValue({
    shouldAskMinimalQuestion: false,
    executionBranch: 'standard_search',
    responseMode: 'standard',
    messageType: 'standard_response',
    normalizedMissingFields: [],
    uiMeta: {},
    turnNumber: 1,
  }),
  buildConversationalMissingInfoMessage: vi.fn().mockReturnValue('missing info message'),
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

// ---------------------------------------------------------------------------
// Imports (after mocks are declared)
// ---------------------------------------------------------------------------

import useMessageHandler from '../hooks/useMessageHandler';
import { parseMessageWithAI } from '@/services/aiMessageParser';
import { addMessageViaSupabase } from '../services/messageService';
import { handleItineraryRequest } from '../services/searchHandlers';
import { buildProps, buildParsedRequest, DEFAULT_CONV_ID } from '@/test-utils/useMessageHandlerFactory';

// ---------------------------------------------------------------------------
// Local render helper — spreads the props object in the hook's positional order
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default resolved values after clearAllMocks (clearAllMocks resets call history but keeps implementations)
});

describe('useMessageHandler', () => {
  // -------------------------------------------------------------------------
  // Guards / early exits
  // -------------------------------------------------------------------------
  describe('handleSendMessage — guards', () => {
    it('returns early when message is empty string — no setIsLoading or parse', async () => {
      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('');
      });

      expect(p.setIsLoading).not.toHaveBeenCalled();
      expect(vi.mocked(parseMessageWithAI)).not.toHaveBeenCalled();
    });

    it('returns early when message is whitespace only — no setIsLoading', async () => {
      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('   ');
      });

      expect(p.setIsLoading).not.toHaveBeenCalled();
      expect(vi.mocked(parseMessageWithAI)).not.toHaveBeenCalled();
    });

    it('returns early when selectedConversationRef.current is null — no setIsLoading', async () => {
      const p = buildProps({
        selectedConversation: null,
        selectedConversationRef: { current: null },
      });
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero viajar a Madrid');
      });

      expect(p.setIsLoading).not.toHaveBeenCalled();
      expect(vi.mocked(parseMessageWithAI)).not.toHaveBeenCalled();
    });

    it('cheaper flights guard — clears input and skips parseMessageWithAI', async () => {
      const p = buildProps();
      const { result } = renderHandler(p);

      // 'vuelos mas baratos' matches isCheaperFlightRequest keyword list (normalized)
      await act(async () => {
        await result.current.handleSendMessage('vuelos mas baratos');
      });

      expect(p.setMessage).toHaveBeenCalledWith('');
      expect(vi.mocked(parseMessageWithAI)).not.toHaveBeenCalled();
    });

    it('cheaper flights guard — calls handleCheaperFlightsSearch with the original message', async () => {
      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('vuelos mas baratos');
        // Flush the async IIFE that runs the actual cheaper-flights call
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      });

      expect(p.handleCheaperFlightsSearch).toHaveBeenCalledWith('vuelos mas baratos');
    });

    it('price change guard — clears input and skips parseMessageWithAI', async () => {
      const p = buildProps();
      const { result } = renderHandler(p);

      // 'cambiar precio a 1000' matches isPriceChangeRequest patterns + has a number
      await act(async () => {
        await result.current.handleSendMessage('cambiar precio a 1000');
      });

      expect(p.setMessage).toHaveBeenCalledWith('');
      expect(vi.mocked(parseMessageWithAI)).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // UI state management — nominal path
  // -------------------------------------------------------------------------
  describe('handleSendMessage — UI state (nominal missing_info_request path)', () => {
    function setupNominalMocks(p: ReturnType<typeof buildProps>) {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'missing_info_request',
        message: 'Por favor indicá el destino',
        missingFields: ['destination'],
        originalMessage: 'quiero volar',
      }) as any);
      vi.mocked(addMessageViaSupabase).mockResolvedValue({
        id: 'saved-msg',
        role: 'assistant',
        conversation_id: p.selectedConversation!,
        content: { text: 'ok' },
        created_at: new Date().toISOString(),
        meta: null,
        client_id: null,
        status: null,
      } as any);
    }

    it('calls setIsLoading(true) then setIsLoading(false) for a nominal message', async () => {
      const p = buildProps();
      setupNominalMocks(p);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      const calls = vi.mocked(p.setIsLoading).mock.calls.map(c => c[0]);
      expect(calls[0]).toBe(true);
      expect(calls[calls.length - 1]).toBe(false);
    });

    it('calls setIsTyping(true) then setIsTyping(false) for a nominal message', async () => {
      const p = buildProps();
      setupNominalMocks(p);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      const calls = vi.mocked(p.setIsTyping).mock.calls.map(c => c[0]);
      expect(calls[0]).toBe(true);
      expect(calls[calls.length - 1]).toBe(false);
    });

    it('calls setMessage("") to clear input for a nominal message', async () => {
      const p = buildProps();
      setupNominalMocks(p);
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      expect(p.setMessage).toHaveBeenCalledWith('');
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe('handleSendMessage — error handling', () => {
    it('calls toast and resets loading when parseMessageWithAI throws', async () => {
      const p = buildProps();
      vi.mocked(parseMessageWithAI).mockRejectedValue(new Error('parse failed'));
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      expect(p.toast).toHaveBeenCalled();
      // setIsLoading should be false after error cleanup
      const loadingCalls = vi.mocked(p.setIsLoading).mock.calls.map(c => c[0]);
      expect(loadingCalls[loadingCalls.length - 1]).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // missing_info_request execution case
  // -------------------------------------------------------------------------
  describe('handleSendMessage — missing_info_request case', () => {
    const MISSING_MSG = 'Necesito el destino del viaje';

    beforeEach(() => {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'missing_info_request',
        message: MISSING_MSG,
        missingFields: ['destination'],
        originalMessage: 'quiero volar',
      }) as any);
      vi.mocked(addMessageViaSupabase).mockResolvedValue({
        id: 'saved-msg',
        role: 'assistant',
        conversation_id: DEFAULT_CONV_ID,
        content: { text: MISSING_MSG },
        created_at: new Date().toISOString(),
        meta: null,
        client_id: null,
        status: null,
      } as any);
    });

    it('saves assistant message with text from parsedRequest.message', async () => {
      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      const assistantSave = vi.mocked(addMessageViaSupabase).mock.calls.find(
        call => call[0].role === 'assistant'
      );
      expect(assistantSave).toBeDefined();
      expect((assistantSave![0].content as { text: string }).text).toBe(MISSING_MSG);
    });

    it('calls saveContextualMemory prop to persist the parsed request', async () => {
      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero volar');
      });

      expect(p.saveContextualMemory).toHaveBeenCalled();
      const [calledConvId] = (p.saveContextualMemory as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(calledConvId).toBe(DEFAULT_CONV_ID);
    });
  });

  // -------------------------------------------------------------------------
  // handlePlannerDateSelection
  // -------------------------------------------------------------------------
  describe('handlePlannerDateSelection', () => {
    const baseRequest = buildParsedRequest({
      requestType: 'itinerary',
      originalMessage: 'viaje a Roma',
      itinerary: {
        destinations: [{ city: 'Roma', country: 'Italia', nights: 7 }],
        days: 7,
      } as any,
    });

    beforeEach(() => {
      vi.mocked(addMessageViaSupabase).mockResolvedValue({
        id: 'saved-msg',
        role: 'user',
        conversation_id: DEFAULT_CONV_ID,
        content: { text: '' },
        created_at: new Date().toISOString(),
        meta: null,
        client_id: null,
        status: null,
      } as any);
      vi.mocked(handleItineraryRequest).mockResolvedValue({ response: 'itinerary ok', data: {} } as any);
    });

    it('saves user message with concrete date range text', async () => {
      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handlePlannerDateSelection(baseRequest, {
          startDate: '2026-06-01',
          endDate: '2026-06-08',
          isFlexibleDates: false,
        });
      });

      const userSave = vi.mocked(addMessageViaSupabase).mock.calls.find(
        call => call[0].role === 'user' && typeof (call[0].content as any)?.text === 'string'
      );
      expect(userSave).toBeDefined();
      const text = (userSave![0].content as { text: string }).text;
      expect(text).toContain('2026-06-01');
      expect(text).toContain('2026-06-08');
    });

    it('saves user message with flexible month label when isFlexibleDates is true', async () => {
      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handlePlannerDateSelection(baseRequest, {
          isFlexibleDates: true,
          flexibleMonth: '08',
          flexibleYear: 2026,
          days: 10,
        });
      });

      const userSave = vi.mocked(addMessageViaSupabase).mock.calls.find(
        call => call[0].role === 'user' && typeof (call[0].content as any)?.text === 'string'
      );
      expect(userSave).toBeDefined();
      const text = (userSave![0].content as { text: string }).text;
      // The formatted text includes "Mes flexible seleccionado:" prefix
      expect(text).toContain('Mes flexible');
      expect(text).toContain('10 días');
    });

    it('returns early without saving when conversationRef is null', async () => {
      const p = buildProps({
        selectedConversationRef: { current: null },
      });
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handlePlannerDateSelection(baseRequest, {
          startDate: '2026-06-01',
          endDate: '2026-06-08',
          isFlexibleDates: false,
        });
      });

      expect(vi.mocked(addMessageViaSupabase)).not.toHaveBeenCalled();
      expect(p.toast).toHaveBeenCalled();
    });
  });
});
