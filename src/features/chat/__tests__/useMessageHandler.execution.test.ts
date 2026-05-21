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
  normalizeSupportedLanguage: vi.fn().mockReturnValue('es'),
  detectMessageLanguage: vi.fn().mockReturnValue('es'),
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
    reason: 'high_definition',
    dimensions: {},
    inferredFields: {},
  }),
  getInferredFieldDetails: vi.fn().mockReturnValue([]),
}));

// Phase 3 / sub-task C: leave `buildEmiliaSearchNarrative` UNMOCKED here. The
// `does not regenerate itinerary when quoting the active planner` test asserts
// against the real `plan_to_quote` narrative copy ("Tengo el plan activo para
// cotizar"), and `buildPlanToQuoteResponse` (kept as a wrapper in
// conversationOrchestrator) delegates to the narrative module. Mocking it here
// would short-circuit that text. The `useMessageHandler.test.ts` and
// `useMessageHandler.routing.test.ts` files (which only need a stub) mock it
// scoped to themselves.

vi.mock('../services/conversationOrchestrator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/conversationOrchestrator')>();
  return {
    ...actual,
    resolveConversationTurn: vi.fn().mockReturnValue({
      shouldAskMinimalQuestion: false,
      executionBranch: 'standard_search',
      responseMode: 'standard',
      messageType: 'standard_response',
      normalizedMissingFields: [],
      uiMeta: {},
      turnNumber: 1,
    }),
    buildModeBridgeMessage: vi.fn().mockReturnValue('bridge message'),
    formatDiscoveryResponse: vi.fn().mockReturnValue(''),
  };
});

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

// applySmartDefaults calls isDomesticDestination(destination) expecting a string,
// but test fixtures pass destination objects — mock the whole utils module to stay safe.
vi.mock('@/features/trip-planner/utils', () => ({
  applySmartDefaults: vi.fn().mockReturnValue({
    enrichedItinerary: { destinations: [{ city: 'Roma', country: 'Italia', nights: 7 }], days: 7 },
    fieldProvenance: { days: 'user' },
  }),
  expandDestinationsIfRegional: vi.fn((destinations: string[]) => ({
    expandedDestinations: destinations[0] === 'Europa' ? ['Madrid', 'París', 'Londres'] : destinations,
    regionalMeta: null,
    seasonalityAlert: null,
    suggestedDays: 20,
    suggestedPace: null,
    cityWeights: null,
  })),
  normalizePlannerState: vi.fn((x: any) => x),
  applySeasonalDates: vi.fn((x: any) => x),
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
import { hasFlexibleItineraryDateSelection, hasUsableItineraryDates, parseMessageWithAI, parseMessageWithAIStreaming, validateFlightRequiredFields, validateHotelRequiredFields } from '@/services/aiMessageParser';
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
import { buildDiscoveryResponseFromToolResult } from '../services/discoveryService';
import { resolveConversationTurn } from '../services/conversationOrchestrator';
import { routeRequest } from '../services/routeRequest';
import { buildCanonicalResultFromStandard } from '../services/itineraryPipeline';
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
    p.lastPdfAnalysis,
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
  vi.mocked(hasUsableItineraryDates).mockReturnValue(false);
  vi.mocked(hasFlexibleItineraryDateSelection).mockReturnValue(false);
  vi.mocked(buildDiscoveryResponseFromToolResult).mockReturnValue({
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
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
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

    it('sends compact planner context to the parser when a planner exists', async () => {
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
        requestType: 'flights',
        originalMessage: 'buscame vuelos',
        flights: { origin: 'BUE', destination: 'MAD', departureDate: '2026-06-01', returnDate: '2026-06-15', adults: 2 },
      }) as any);

      const p = buildProps({
        plannerState: {
          title: 'Europa',
          destinations: ['Madrid', 'París'],
          days: 8,
          isFlexibleDates: true,
          flexibleMonth: '06',
          flexibleYear: 2026,
          travelers: { adults: 2, children: 0, infants: 0 },
          segments: [
            { id: 'seg-1', city: 'Madrid', order: 0, nights: 4, days: [{ id: 'd1', dayNumber: 1, title: 'Madrid' }], hotelPlan: { searchStatus: 'idle' } },
            { id: 'seg-2', city: 'París', order: 1, nights: 4, days: [{ id: 'd5', dayNumber: 5, title: 'París' }], hotelPlan: { searchStatus: 'idle' } },
          ],
        } as any,
      });
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('buscame vuelos');
      });

      const parserKnowledge = vi.mocked(parseMessageWithAIStreaming).mock.calls[0][1];
      expect(parserKnowledge).toEqual(expect.objectContaining({
        plannerContext: expect.objectContaining({
          hasActivePlan: true,
          destinations: ['Madrid', 'París'],
          segments: expect.arrayContaining([
            expect.objectContaining({ id: 'seg-1', city: 'Madrid', dayCount: 1 }),
          ]),
        }),
      }));
    });

    it('treats general planner follow-ups as custom itinerary edits', async () => {
      vi.mocked(hasUsableItineraryDates).mockReturnValue(true);
      vi.mocked(hasFlexibleItineraryDateSelection).mockReturnValue(true);
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
        requestType: 'general',
        originalMessage: 'sacale lo mas turistico',
      }) as any);

      const plannerState = {
        title: 'Japón',
        summary: 'Plan actual',
        destinations: ['Tokio', 'Kioto'],
        days: 8,
        isFlexibleDates: true,
        flexibleMonth: '10',
        flexibleYear: 2026,
        budgetLevel: 'mid',
        pace: 'balanced',
        travelers: { adults: 2, children: 0, infants: 0 },
        interests: ['culture'],
        constraints: [],
        segments: [],
      };
      const p = buildProps({
        plannerState: plannerState as any,
        workspaceMode: 'planner',
      });
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('sacale lo mas turistico');
      });

      expect(vi.mocked(handleItineraryRequest)).toHaveBeenCalledWith(
        expect.objectContaining({
          requestType: 'itinerary',
          itinerary: expect.objectContaining({
            destinations: ['Tokio', 'Kioto'],
            editIntent: expect.objectContaining({
              action: 'custom_instruction',
              rawInstruction: 'sacale lo mas turistico',
            }),
          }),
        }),
        plannerState,
        expect.any(Object),
      );
    });

    it('applies simple planner edits directly without regenerating', async () => {
      vi.mocked(hasUsableItineraryDates).mockReturnValue(true);
      vi.mocked(hasFlexibleItineraryDateSelection).mockReturnValue(true);
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
        requestType: 'itinerary',
        originalMessage: 'que sea mas barato',
        itinerary: {
          destinations: ['Roma'],
          days: 5,
          isFlexibleDates: true,
          flexibleMonth: '09',
          flexibleYear: 2026,
          editIntent: {
            action: 'change_budget',
            scope: 'budget',
            rawInstruction: 'que sea mas barato',
          },
        },
      }) as any);

      const updatePlannerState = vi.fn().mockResolvedValue(undefined);
      const p = buildProps({
        plannerState: {
          destinations: ['Roma'],
          days: 5,
          isFlexibleDates: true,
          flexibleMonth: '09',
          flexibleYear: 2026,
          travelers: { adults: 2, children: 0, infants: 0 },
          segments: [],
          generationMeta: { source: 'chat', updatedAt: '2026-01-01T00:00:00Z', version: 1 },
        } as any,
        updatePlannerState,
        workspaceMode: 'planner',
      });
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('que sea mas barato');
      });

      expect(updatePlannerState).toHaveBeenCalled();
      expect(vi.mocked(handleItineraryRequest)).not.toHaveBeenCalled();
    });

    it('calls handleHotelSearch for requestType hotels', async () => {
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
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

    it('reuses last flight context for English add-hotel follow-ups', async () => {
      const p = buildProps({
        loadContextState: vi.fn().mockResolvedValue({
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
        }) as any,
      });
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('I also want a Hotel all inclusive, Iberostar y Riu');
      });

      expect(vi.mocked(parseMessageWithAIStreaming)).not.toHaveBeenCalled();
      expect(vi.mocked(handleHotelSearch)).toHaveBeenCalledWith(
        expect.objectContaining({
          requestType: 'hotels',
          hotels: expect.objectContaining({
            city: 'CUN',
            checkinDate: '2026-07-01',
            adults: 2,
            mealPlan: 'all_inclusive',
            hotelChains: expect.arrayContaining(['Iberostar', 'RIU']),
          }),
        }),
      );
    });

    it('enriches incomplete hotel follow-ups from flight context before routing', async () => {
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
        requestType: 'hotels',
        originalMessage: 'Hotel all inclusive with Iberostar and Riu',
        hotels: {
          adults: 1,
          adultsExplicit: false,
          children: 0,
          infants: 0,
          mealPlan: 'all_inclusive',
          hotelChains: ['Iberostar', 'RIU'],
        },
        orchestration: {
          routeResult: {
            route: 'PLAN',
            score: 0.38,
            missingFields: ['destination', 'dates'],
            reason: 'stale_server_route',
            dimensions: { destination: 0, dates: 0, passengers: 0.5, origin: 1, complexity: 0.3 },
            inferredFields: [],
          },
        },
      } as any));

      const p = buildProps({
        messages: [buildMessageRow()],
        preloadedContext: {
          conversationId: DEFAULT_CONV_ID,
          contextualMemory: null,
          contextState: null,
          leadId: null,
        },
        loadContextState: vi.fn().mockResolvedValue({
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
        }) as any,
      });
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('Hotel all inclusive with Iberostar and Riu');
      });

      expect(vi.mocked(routeRequest)).toHaveBeenCalledWith(
        expect.objectContaining({
          requestType: 'hotels',
          orchestration: undefined,
          hotels: expect.objectContaining({
            city: 'CUN',
            checkinDate: '2026-07-01',
            adults: 2,
            adultsExplicit: true,
            mealPlan: 'all_inclusive',
            hotelChains: ['Iberostar', 'RIU'],
          }),
        }),
        null,
      );
      expect(vi.mocked(resolveConversationTurn)).toHaveBeenCalledWith(
        expect.objectContaining({
          routeResult: expect.objectContaining({ route: 'QUOTE' }),
        }),
      );
      expect(vi.mocked(handleHotelSearch)).toHaveBeenCalledWith(
        expect.objectContaining({
          hotels: expect.objectContaining({ city: 'CUN', adults: 2 }),
        }),
      );
    });

    it('calls handleCombinedSearch for requestType combined', async () => {
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
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
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
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
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
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
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
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
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
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

      expect(vi.mocked(buildDiscoveryResponseFromToolResult)).toHaveBeenCalled();
      expect(vi.mocked(handleItineraryRequest)).not.toHaveBeenCalled();
    });

    it('calls handleItineraryRequest for itinerary when responseMode is not show_places', async () => {
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
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
        expect.objectContaining({
          conversationId: DEFAULT_CONV_ID,
          leadId: null,
          leadProfile: null,
        }),
      );
    });

    it('does not regenerate itinerary when quoting the active planner', async () => {
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
        requestType: 'itinerary',
        originalMessage: 'Cotizame este plan',
        itinerary: {
          destinations: ['Roma', 'Florencia'],
          days: 8,
          isFlexibleDates: true,
          flexibleMonth: '09',
          flexibleYear: 2026,
        } as any,
      }) as any);
      vi.mocked(routeRequest).mockReturnValue({
        route: 'QUOTE',
        score: 0.6,
        missingFields: [],
        collectQuestion: null,
        reason: 'quote_active_plan',
        dimensions: {},
        inferredFields: [],
      } as any);
      vi.mocked(resolveConversationTurn).mockReturnValue({
        ...STANDARD_TURN,
        responseMode: 'quote_or_search',
        messageType: 'search_results',
      } as any);

      const p = buildProps({
        chatMode: 'agency',
        setDraftPlannerFromRequest: vi.fn(),
        plannerState: {
          id: 'plan-1',
          title: 'Roma y Florencia',
          summary: 'Arte, historia y sabores',
          destinations: ['Roma', 'Florencia'],
          days: 8,
          isFlexibleDates: true,
          flexibleMonth: '09',
          flexibleYear: 2026,
          travelers: { adults: 2, children: 0, infants: 0 },
          interests: [],
          constraints: [],
          segments: [
            { id: 'seg-1', city: 'Roma', country: 'Italia', order: 0, nights: 5, days: [], hotelPlan: { searchStatus: 'idle' } },
            { id: 'seg-2', city: 'Florencia', country: 'Italia', order: 1, nights: 3, days: [], hotelPlan: { searchStatus: 'idle' } },
          ],
          generalTips: [],
          generationMeta: { source: 'chat', updatedAt: '2026-01-01T00:00:00Z', version: 1 },
        } as any,
      });
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('Cotizame este plan');
      });

      expect(vi.mocked(handleItineraryRequest)).not.toHaveBeenCalled();
      expect(p.setDraftPlannerFromRequest).not.toHaveBeenCalled();

      const assistantSave = vi.mocked(addMessageViaSupabase).mock.calls.find(
        call => call[0].role === 'assistant'
      );
      expect(assistantSave).toBeDefined();
      expect(assistantSave![0].content.text).toContain('Tengo el plan activo para cotizar');
      expect(assistantSave![0].content.text).toContain('sin volver a armar el viaje');
      expect((assistantSave![0].meta as any).quoteContext).toEqual(expect.objectContaining({
        source: 'active_planner',
        destinations: ['Roma', 'Florencia'],
        missingQuoteFields: ['ciudad de salida', 'fechas exactas'],
      }));
    });

    it('builds an itinerary from the latest quote/search context', async () => {
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
        requestType: 'general',
        originalMessage: 'Armame un itinerario con esta cotización',
      }) as any);
      vi.mocked(routeRequest).mockReturnValue({
        route: 'PLAN',
        score: 0.7,
        missingFields: [],
        collectQuestion: null,
        reason: 'itinerary_request',
        dimensions: {},
        inferredFields: [],
      } as any);
      vi.mocked(resolveConversationTurn).mockReturnValue({
        ...STANDARD_TURN,
        executionBranch: 'standard_itinerary',
        responseMode: 'proposal_first_plan',
        messageType: 'trip_planner',
        shouldUseStandardItinerary: true,
      } as any);

      const p = buildProps({
        loadContextState: vi.fn().mockResolvedValue({
          schemaVersion: 1,
          turnNumber: 1,
          constraintsHistory: [],
          lastSearch: {
            requestType: 'combined',
            timestamp: '2026-01-01T00:00:00Z',
            flightsParams: {
              origin: 'BUE',
              destination: 'MAD',
              departureDate: '2026-09-10',
              returnDate: '2026-09-18',
              adults: 2,
              children: 0,
              infants: 0,
            },
          },
        }),
      });
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('Armame un itinerario con esta cotización');
      });

      expect(vi.mocked(routeRequest)).toHaveBeenCalledWith(
        expect.objectContaining({
          requestType: 'itinerary',
          itinerary: expect.objectContaining({
            destinations: ['MAD'],
            startDate: '2026-09-10',
            endDate: '2026-09-18',
            days: 9,
            travelers: { adults: 2, children: 0, infants: 0 },
          }),
        }),
        null,
      );
      expect(vi.mocked(handleItineraryRequest)).toHaveBeenCalled();
    });

    it('runs a combined quote search when the active planner has exact quote fields', async () => {
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
        requestType: 'itinerary',
        originalMessage: 'Cotizame este plan',
        itinerary: {
          destinations: ['Roma', 'Florencia'],
          days: 8,
        } as any,
      }) as any);
      vi.mocked(routeRequest).mockReturnValue({
        route: 'QUOTE',
        score: 0.8,
        missingFields: [],
        collectQuestion: null,
        reason: 'quote_active_plan',
        dimensions: {},
        inferredFields: [],
      } as any);
      vi.mocked(resolveConversationTurn).mockReturnValue({
        ...STANDARD_TURN,
        responseMode: 'quote_or_search',
        messageType: 'search_results',
      } as any);

      const p = buildProps({
        chatMode: 'agency',
        plannerState: {
          id: 'plan-1',
          title: 'Roma y Florencia',
          summary: 'Arte, historia y sabores',
          startDate: '2026-09-10',
          endDate: '2026-09-18',
          isFlexibleDates: false,
          days: 8,
          travelers: { adults: 2, children: 0, infants: 0 },
          interests: [],
          constraints: [],
          destinations: ['Roma', 'Florencia'],
          origin: 'BUE',
          segments: [
            { id: 'seg-1', city: 'Roma', country: 'Italia', order: 0, nights: 5, days: [], hotelPlan: { searchStatus: 'idle' } },
            { id: 'seg-2', city: 'Florencia', country: 'Italia', order: 1, nights: 3, days: [], hotelPlan: { searchStatus: 'idle' } },
          ],
          generalTips: [],
          generationMeta: { source: 'chat', updatedAt: '2026-01-01T00:00:00Z', version: 1 },
        } as any,
      });
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('Cotizame este plan');
      });

      expect(vi.mocked(handleItineraryRequest)).not.toHaveBeenCalled();
      expect(vi.mocked(handleCombinedSearch)).toHaveBeenCalledWith(
        expect.objectContaining({
          requestType: 'combined',
          flights: expect.objectContaining({
            origin: 'BUE',
            destination: 'Roma',
            departureDate: '2026-09-10',
            returnDate: '2026-09-18',
            adults: 2,
          }),
          hotels: expect.objectContaining({
            city: 'Roma',
            checkinDate: '2026-09-10',
            checkoutDate: '2026-09-18',
            segments: expect.arrayContaining([
              expect.objectContaining({ city: 'Roma', checkinDate: '2026-09-10', checkoutDate: '2026-09-15' }),
              expect.objectContaining({ city: 'Florencia', checkinDate: '2026-09-15', checkoutDate: '2026-09-18' }),
            ]),
          }),
        }),
      );
    });

    it('calls addMessageViaSupabase with role assistant after flight search', async () => {
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
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
      // Chips display human-readable city names ('Madrid'), and the resulting
      // prompt also feeds the parser a city name. The parser re-applies IATA
      // (MAD) inside formatForStarling for flights; hotels stay as city names.
      expect((assistantSave![0].meta as any).suggestedActions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'Buscar vuelos para Madrid',
            prompt: expect.stringContaining('Quiero buscar vuelos para Madrid'),
            type: 'flight',
          }),
        ]),
      );
    });

    it('uses the first concrete planner city for suggested actions after regional itinerary expansion', async () => {
      vi.mocked(hasUsableItineraryDates).mockReturnValue(true);
      vi.mocked(hasFlexibleItineraryDateSelection).mockReturnValue(true);
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
        requestType: 'itinerary',
        originalMessage: 'armame un viaje a europa 20 dias',
        itinerary: {
          destinations: ['Europa'],
          days: 20,
          isFlexibleDates: true,
          flexibleMonth: '07',
          flexibleYear: 2026,
        },
      }) as any);
      vi.mocked(buildCanonicalResultFromStandard).mockReturnValue({
        response: 'itinerary results',
        plannerData: {
          generationMeta: { isDraft: false },
          destinations: ['Madrid', 'París', 'Londres'],
          segments: [
            { city: 'Madrid', order: 1, days: [], nights: 4 },
            { city: 'París', order: 2, days: [], nights: 5 },
          ],
        },
        flights: [],
        hotels: [],
        recommendedPlaces: [],
        responseMode: 'standard',
        conversationTurn: {
          shouldAskMinimalQuestion: false,
          executionBranch: 'standard_itinerary',
          responseMode: 'standard',
          messageType: 'trip_planner',
          normalizedMissingFields: [],
          uiMeta: {},
          turnNumber: 1,
        },
        source: 'AI_PARSER + EUROVIPS',
      } as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('armame un viaje a europa 20 dias');
      });

      const assistantSave = vi.mocked(addMessageViaSupabase).mock.calls.find(
        call => call[0].role === 'assistant'
      );
      const suggestedActions = (assistantSave?.[0].meta as any)?.suggestedActions;

      expect(suggestedActions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'Buscar vuelos para Madrid',
            prompt: expect.stringContaining('Quiero buscar vuelos para Madrid'),
            type: 'flight',
          }),
          expect.objectContaining({
            label: 'Buscar hotel en Madrid',
            prompt: expect.stringContaining('Quiero buscar hoteles en Madrid'),
            type: 'hotel',
          }),
        ]),
      );
      expect(JSON.stringify(suggestedActions)).not.toContain('Europa');
    });

    it('calls addMessageViaSupabase with role assistant after hotel search', async () => {
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
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
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
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
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
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

  // ---------------------------------------------------------------------------
  // Architectural guarantee — every actionable parsed turn must persist its
  // intent snapshot so the next turn's parser has previousContext. The bug
  // that motivated this suite: turn 1 said "vuelos a Madrid y después hotel",
  // validation ran the hotel branch alone (partial flow) and returned early
  // WITHOUT calling saveContextualMemory. Turn 2's "buscame los vuelos para
  // esa fecha" then saw `previousContext: null` and could not resolve the
  // anaphora — the router degraded to PLAN/low_definition → mode_bridge.
  //
  // The fix is structural: a `finally` block writes the snapshot once per
  // turn through `persistTurnIntentSnapshot`, regardless of which branch
  // produced the user-visible response. These tests pin the guarantee down
  // at the integration boundary so future early-returns can't regress it.
  // ---------------------------------------------------------------------------
  describe('handleSendMessage — turn intent persistence (architectural)', () => {
    it('persists the combined snapshot when the partial flow runs hotels alone (the original bug)', async () => {
      vi.mocked(validateFlightRequiredFields).mockReturnValueOnce({
        isValid: false,
        missingFields: ['origin'],
        missingFieldsSpanish: ['origen'],
      } as any);
      vi.mocked(validateHotelRequiredFields).mockReturnValueOnce({
        isValid: true,
        missingFields: [],
        missingFieldsSpanish: [],
      } as any);
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
        requestType: 'combined',
        originalMessage: 'Primero vuelos a Madrid y después hotel',
        flights: { destination: 'MAD', adults: 1 },
        hotels: { city: 'Madrid', checkinDate: '2026-05-23', checkoutDate: '2026-05-30', adults: 1 },
      }) as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('Primero vuelos a Madrid y después hotel');
      });

      // The next turn's parser reads `loadContextualMemory(conversationId)`.
      // If we didn't persist here, turn 2 sees null and "esa fecha" can't
      // be resolved → router lows-out → mode_bridge. The whole point of the
      // architectural fix is making this assertion hold.
      expect(p.saveContextualMemory).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ requestType: 'combined' }),
      );
    });

    it('persists the symmetric partial: flight valid, hotel missing', async () => {
      vi.mocked(validateFlightRequiredFields).mockReturnValueOnce({
        isValid: true,
        missingFields: [],
        missingFieldsSpanish: [],
      } as any);
      vi.mocked(validateHotelRequiredFields).mockReturnValueOnce({
        isValid: false,
        missingFields: ['city'],
        missingFieldsSpanish: ['ciudad'],
      } as any);
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
        requestType: 'combined',
        originalMessage: 'vuelos a Madrid y un hotel',
        flights: { origin: 'EZE', destination: 'MAD', departureDate: '2026-05-23', adults: 1 },
        hotels: { adults: 1 } as any, // intentionally lacks city
      }) as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('vuelos a Madrid y un hotel');
      });

      expect(p.saveContextualMemory).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ requestType: 'combined' }),
      );
    });

    it('persists the snapshot when a flight-only request lacks required fields and asks for them', async () => {
      vi.mocked(validateFlightRequiredFields).mockReturnValueOnce({
        isValid: false,
        missingFields: ['origin'],
        missingFieldsSpanish: ['origen'],
      } as any);
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
        requestType: 'flights',
        originalMessage: 'vuelo a Madrid',
        flights: { destination: 'MAD', adults: 1 },
      }) as any);

      const p = buildProps();
      const { result } = renderHandler(p);

      await act(async () => {
        await result.current.handleSendMessage('vuelo a Madrid');
      });

      expect(p.saveContextualMemory).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          requestType: 'flights',
          flights: expect.objectContaining({ destination: 'MAD' }),
        }),
      );
    });

    // Note: the rule that non-actionable parses (general / missing_info_request)
    // are skipped lives in `shouldPersistIntent` (covered by the
    // `turnIntentPersistence.test.ts` unit suite). Asserting it at the
    // integration boundary is brittle because other pre-existing call sites
    // in handleSendMessage may write contextual memory regardless of intent.

    it('a persistence failure does not break the turn', async () => {
      const persistError = new Error('persistence-down');
      vi.mocked(parseMessageWithAIStreaming).mockResolvedValue(buildParsedRequest({
        requestType: 'flights',
        originalMessage: 'vuelo a Madrid desde EZE',
        flights: { origin: 'EZE', destination: 'MAD', departureDate: '2026-06-01', adults: 1 },
      }) as any);

      const p = buildProps({
        saveContextualMemory: vi.fn().mockRejectedValue(persistError) as any,
      });
      const { result } = renderHandler(p);

      // The turn should NOT throw even if persistence rejects: the finally
      // block swallows the error and lets the user-visible response stand.
      await expect(
        act(async () => {
          await result.current.handleSendMessage('vuelo a Madrid desde EZE');
        }),
      ).resolves.not.toThrow();
    });
  });
});
