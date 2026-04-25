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
  // C1.c needs isValid:true so the execution switch is reachable (C1.a used [] which short-circuits)
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
  handleGeneralQuery: vi.fn().mockResolvedValue('general query response'),
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

// applySmartDefaults calls isDomesticDestination(destination) expecting a string,
// but test fixtures pass destination objects — mock the whole utils module to stay safe.
vi.mock('@/features/trip-planner/utils', () => ({
  applySmartDefaults: vi.fn().mockReturnValue({
    enrichedItinerary: { destinations: [{ city: 'Roma', country: 'Italia', nights: 7 }], days: 7 },
    fieldProvenance: { days: 'user' },
  }),
  normalizePlannerState: vi.fn((x: any) => x),
  applySeasonalDates: vi.fn((x: any) => x),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are declared)
// ---------------------------------------------------------------------------

import useMessageHandler from '../hooks/useMessageHandler';
import { parseMessageWithAI } from '@/services/aiMessageParser';
import {
  handleFlightSearch,
  handleHotelSearch,
  handleCombinedSearch,
  handlePackageSearch,
  handleServiceSearch,
  handleGeneralQuery,
  handleItineraryRequest,
} from '../services/searchHandlers';
import { addMessageViaSupabase } from '../services/messageService';
import { buildDiscoveryResponsePayload } from '../services/discoveryService';
import { resolveConversationTurn } from '../services/conversationOrchestrator';
import { buildProps, buildParsedRequest, DEFAULT_CONV_ID } from '@/test-utils/useMessageHandlerFactory';

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

// ---------------------------------------------------------------------------
// Shared turn shape re-applied after clearAllMocks
// ---------------------------------------------------------------------------

const STANDARD_TURN = {
  shouldAskMinimalQuestion: false,
  executionBranch: 'standard_search',
  responseMode: 'standard',
  messageType: 'standard_response',
  normalizedMissingFields: [],
  uiMeta: {},
  turnNumber: 1,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Restore resolved values after clearAllMocks wipes call history.
  // Implementations from the factory survive clearAllMocks but vi.fn() mocks
  // without a default need to be primed here to guarantee a clean baseline.
  vi.mocked(resolveConversationTurn).mockReturnValue(STANDARD_TURN as any);
  vi.mocked(addMessageViaSupabase).mockResolvedValue({
    id: 'saved-msg-1',
    role: 'assistant',
    conversation_id: DEFAULT_CONV_ID,
    content: { text: 'ok' },
    created_at: '2026-01-01T00:00:00Z',
    meta: null,
    client_id: null,
    status: null,
  } as any);
  vi.mocked(handleFlightSearch).mockResolvedValue({ response: 'flight results', data: {} } as any);
  vi.mocked(handleHotelSearch).mockResolvedValue({ response: 'hotel results', data: {} } as any);
  vi.mocked(handleCombinedSearch).mockResolvedValue({ response: 'combined results', data: {} } as any);
  vi.mocked(handlePackageSearch).mockResolvedValue({ response: 'package results', data: {} } as any);
  vi.mocked(handleServiceSearch).mockResolvedValue({ response: 'service results', data: {} } as any);
  vi.mocked(handleGeneralQuery).mockResolvedValue('general query response' as any);
  vi.mocked(handleItineraryRequest).mockResolvedValue({ response: 'itinerary results', data: {} } as any);
  vi.mocked(buildDiscoveryResponsePayload).mockResolvedValue({
    text: 'discovery results',
    discoveryContext: {},
    recommendedPlaces: [],
  } as any);
});

describe('useMessageHandler', () => {
  // -------------------------------------------------------------------------
  // Execution switch
  // -------------------------------------------------------------------------
  describe('handleSendMessage — execution switch', () => {

    it('calls handleFlightSearch for requestType flights', async () => {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'flights',
        originalMessage: 'quiero vuelos a Madrid',
        flights: { origin: 'BUE', destination: 'MAD', departureDate: '2026-06-01', returnDate: '2026-06-15', adults: 2 },
      }) as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero vuelos a Madrid');
      });

      expect(vi.mocked(handleFlightSearch)).toHaveBeenCalledWith(
        expect.objectContaining({ requestType: 'flights' })
      );
    });

    it('calls handleHotelSearch for requestType hotels', async () => {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'hotels',
        originalMessage: 'necesito un hotel en Barcelona',
        hotels: { city: 'BCN', checkinDate: '2026-06-01', checkoutDate: '2026-06-05', adults: 2 },
      }) as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('necesito un hotel en Barcelona');
      });

      expect(vi.mocked(handleHotelSearch)).toHaveBeenCalledWith(
        expect.objectContaining({ requestType: 'hotels' })
      );
    });

    it('calls handleCombinedSearch for requestType combined', async () => {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'combined',
        originalMessage: 'planifica mi viaje',
        flights: { origin: 'BUE', destination: 'CUN', departureDate: '2026-06-01', returnDate: '2026-06-15', adults: 2 },
        hotels: { city: 'CUN', checkinDate: '2026-06-01', checkoutDate: '2026-06-15', adults: 2 },
      }) as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('planifica mi viaje');
      });

      expect(vi.mocked(handleCombinedSearch)).toHaveBeenCalledWith(
        expect.objectContaining({ requestType: 'combined' })
      );
    });

    it('calls handleGeneralQuery for unrecognized requestType', async () => {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'general',
        originalMessage: 'consulta general',
      }) as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('consulta general');
      });

      expect(vi.mocked(handleGeneralQuery)).toHaveBeenCalledWith(
        expect.objectContaining({ requestType: 'general' })
      );
    });

    it('calls handlePackageSearch for requestType packages', async () => {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'packages',
        originalMessage: 'busco un paquete de viaje',
      }) as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('busco un paquete de viaje');
      });

      expect(vi.mocked(handlePackageSearch)).toHaveBeenCalledWith(
        expect.objectContaining({ requestType: 'packages' })
      );
    });

    it('calls handleServiceSearch for requestType services', async () => {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'services',
        originalMessage: 'necesito traslados',
      }) as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('necesito traslados');
      });

      expect(vi.mocked(handleServiceSearch)).toHaveBeenCalledWith(
        expect.objectContaining({ requestType: 'services' })
      );
    });

    it('routes itinerary with responseMode show_places to discovery path', async () => {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'itinerary',
        originalMessage: 'quiero ver lugares en Roma',
        itinerary: {
          destinations: [{ city: 'Roma', country: 'Italia', nights: 7 }],
          days: 7,
        } as any,
      }) as any);
      vi.mocked(resolveConversationTurn).mockReturnValue({
        ...STANDARD_TURN,
        responseMode: 'show_places',
        messageType: 'discovery_response',
      } as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero ver lugares en Roma');
      });

      expect(vi.mocked(buildDiscoveryResponsePayload)).toHaveBeenCalled();
      expect(vi.mocked(handleItineraryRequest)).not.toHaveBeenCalled();
    });

    it('calls handleItineraryRequest for itinerary when responseMode is not show_places', async () => {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'itinerary',
        originalMessage: 'genera mi itinerario para Roma',
        itinerary: {
          destinations: [{ city: 'Roma', country: 'Italia', nights: 7 }],
          days: 7,
        } as any,
      }) as any);
      // STANDARD_TURN.responseMode is 'standard' — not show_places, so draft path runs

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('genera mi itinerario para Roma');
      });

      expect(vi.mocked(handleItineraryRequest)).toHaveBeenCalledWith(
        expect.objectContaining({ requestType: 'itinerary' }),
        null,
      );
    });

    it('calls addMessageViaSupabase with role assistant after flight search', async () => {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'flights',
        originalMessage: 'quiero vuelos a Madrid',
        flights: { origin: 'BUE', destination: 'MAD', departureDate: '2026-06-01', returnDate: '2026-06-15', adults: 2 },
      }) as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero vuelos a Madrid');
      });

      const assistantSave = vi.mocked(addMessageViaSupabase).mock.calls.find(
        call => call[0].role === 'assistant'
      );
      expect(assistantSave).toBeDefined();
      expect(assistantSave![0].conversation_id).toBe(DEFAULT_CONV_ID);
    });

    it('calls addMessageViaSupabase with role assistant after hotel search', async () => {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'hotels',
        originalMessage: 'necesito un hotel en Barcelona',
        hotels: { city: 'BCN', checkinDate: '2026-06-01', checkoutDate: '2026-06-05', adults: 2 },
      }) as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('necesito un hotel en Barcelona');
      });

      const assistantSave = vi.mocked(addMessageViaSupabase).mock.calls.find(
        call => call[0].role === 'assistant'
      );
      expect(assistantSave).toBeDefined();
      expect(assistantSave![0].conversation_id).toBe(DEFAULT_CONV_ID);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling (execution)
  // -------------------------------------------------------------------------
  describe('handleSendMessage — error handling (execution)', () => {

    it('calls toast when handleFlightSearch throws', async () => {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'flights',
        originalMessage: 'quiero vuelos a Madrid',
        flights: { origin: 'BUE', destination: 'MAD', departureDate: '2026-06-01', returnDate: '2026-06-15', adults: 2 },
      }) as any);
      vi.mocked(handleFlightSearch).mockRejectedValue(new Error('network error'));

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('quiero vuelos a Madrid');
      });

      expect(p.toast).toHaveBeenCalled();
    });

    it('resets setIsLoading to false when handleHotelSearch throws', async () => {
      vi.mocked(parseMessageWithAI).mockResolvedValue(buildParsedRequest({
        requestType: 'hotels',
        originalMessage: 'necesito un hotel en Barcelona',
        hotels: { city: 'BCN', checkinDate: '2026-06-01', checkoutDate: '2026-06-05', adults: 2 },
      }) as any);
      vi.mocked(handleHotelSearch).mockRejectedValue(new Error('hotel search failed'));

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('necesito un hotel en Barcelona');
      });

      const loadingCalls = vi.mocked(p.setIsLoading).mock.calls.map(c => c[0]);
      expect(loadingCalls[loadingCalls.length - 1]).toBe(false);
    });
  });
});
