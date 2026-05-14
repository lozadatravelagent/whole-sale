import { describe, expect, it } from 'vitest';
import {
  deriveConversationGaps,
  extractRecommendedPlacesFromMeta,
  formatDiscoveryResponse,
  resolveConversationTurn,
} from '@/features/chat/services/conversationOrchestrator';
import { buildEmiliaSearchNarrative } from '@/features/chat/services/emiliaNarrative';
import { buildDiscoveryResponseFromToolResult } from '@/features/chat/services/discoveryService';

describe('conversationOrchestrator', () => {
  // Phase 3 / sub-task C: `buildConversationalMissingInfoMessage` was removed
  // after the 9 callers in `useMessageHandler.ts` switched to invoking
  // `buildEmiliaSearchNarrative({mode:'collect'})` directly. The empathic
  // missing-info copy now lives end-to-end inside the narrative module.
  it('builds a shorter conversational missing-info message via the narrative collect mode', () => {
    const message = buildEmiliaSearchNarrative({
      mode: 'collect',
      language: 'es',
      normalized: {
        requestType: 'combined',
        flights: {
          origin: '',
          destination: 'Tokio',
          departureDate: '',
          adults: 2,
          children: 0,
        },
        hotels: {
          city: 'Tokio',
          checkinDate: '',
          checkoutDate: '',
          adults: 2,
          children: 0,
        },
        confidence: 0.9,
        originalMessage: 'Tokio y Kioto con vuelo y hotel',
      },
      missingFields: ['origin', 'dates', 'passengers'],
    }).text;

    expect(message).toContain('Tokio');
    expect(message).toContain('desde qué ciudad');
    expect(message).not.toContain('1.');
  });

  it('extracts recommended places from planner metadata', () => {
    const places = extractRecommendedPlacesFromMeta({
      plannerData: {
        segments: [
          {
            city: 'Roma',
            days: [
              {
                morning: [
                  {
                    title: 'Coliseo',
                    description: 'Imperdible para una primera vez',
                    category: 'Historia',
                    photoUrls: ['https://example.com/coliseo.jpg'],
                  },
                ],
                afternoon: [],
                evening: [],
                restaurants: [],
              },
            ],
          },
        ],
      },
    } as any);

    expect(places).toHaveLength(1);
    expect(places[0].name).toBe('Coliseo');
    expect(places[0].city).toBe('Roma');
  });

  it('derives real gaps from planner state instead of hardcoded placeholders', () => {
    const gaps = deriveConversationGaps({
      plannerData: {
        origin: 'Buenos Aires',
        isFlexibleDates: false,
        startDate: '2026-09-10',
        endDate: '2026-09-20',
        segments: [
          {
            city: 'Tokio',
            hotelPlan: { hotelRecommendations: [], matchStatus: 'idle' },
            transportIn: { searchStatus: 'idle', options: [] },
            transportOut: null,
          },
          {
            city: 'Kioto',
            hotelPlan: { hotelRecommendations: [{ id: 'h1' }], matchStatus: 'needs_confirmation' },
            transportIn: { searchStatus: 'ready', options: [{ id: 'f1' }] },
            transportOut: { searchStatus: 'idle', options: [] },
          },
        ],
      },
    } as any);

    expect(gaps.map((gap) => gap.key)).toContain('hotels');
    expect(gaps.map((gap) => gap.key)).toContain('flights');
    expect(gaps.map((gap) => gap.key)).toContain('return_flight');
    expect(gaps.some((gap) => gap.label.includes('Tokio'))).toBe(true);
  });

  it('routes first PLAN through a normalized conversation resolution', () => {
    const resolution = resolveConversationTurn({
      parsedRequest: {
        requestType: 'itinerary',
        itinerary: {
          destinations: ['Asia'],
          days: 20,
        },
        confidence: 0.9,
        originalMessage: 'Quiero un viaje por Asia 20 días',
      },
      routeResult: {
        route: 'PLAN',
        score: 0.2,
        dimensions: {
          destination: 0,
          dates: 0.3,
          passengers: 0.5,
          origin: 0.5,
          complexity: 0.5,
        },
        missingFields: ['dates'],
        inferredFields: [],
        reason: 'itinerary_request',
      },
      plannerState: null,
      hasPersistentContext: false,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
      mode: 'passenger',
    });

    expect(resolution.executionBranch).toBe('standard_itinerary');
    expect(resolution.responseMode).toBe('proposal_first_plan');
    expect(resolution.uiMeta.firstPlanHandledAs).toBe('standard_itinerary');
  });

  it('marks quote turns as search_results with quote_or_search mode', () => {
    const resolution = resolveConversationTurn({
      parsedRequest: {
        requestType: 'combined',
        flights: {
          origin: 'BUE',
          destination: 'TYO',
          departureDate: '2026-09-10',
          adults: 2,
          children: 0,
        },
        hotels: {
          city: 'Tokio',
          checkinDate: '2026-09-10',
          checkoutDate: '2026-09-20',
          adults: 2,
          children: 0,
        },
        confidence: 0.95,
        originalMessage: 'Tokio y Kioto del 10 al 20 de septiembre, 2 adultos, vuelo + hotel',
      },
      routeResult: {
        route: 'QUOTE',
        score: 0.9,
        dimensions: {
          destination: 1,
          dates: 1,
          passengers: 1,
          origin: 1,
          complexity: 0.5,
        },
        missingFields: [],
        inferredFields: [],
        reason: 'high_definition',
      },
      plannerState: null,
      hasPersistentContext: false,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
      mode: 'agency',
    });

    expect(resolution.messageType).toBe('search_results');
    expect(resolution.responseMode).toBe('quote_or_search');
  });

  it('classifies discovery requests as show_places instead of proposal_first_plan', () => {
    const resolution = resolveConversationTurn({
      parsedRequest: {
        requestType: 'itinerary',
        itinerary: {
          destinations: ['Roma'],
        },
        placeDiscoveryResult: {
          ok: true,
          intent: 'broad',
          destination: { city: 'Roma', country: 'Italia', lat: 41.9028, lng: 12.4964 },
          places: [{ name: 'Coliseo', category: 'sights', lat: 41.89, lng: 12.49 }],
        },
        confidence: 0.95,
        originalMessage: 'Cosas para hacer en Roma',
      },
      routeResult: {
        route: 'PLAN',
        score: 0.3,
        dimensions: {
          destination: 1,
          dates: 0,
          passengers: 0.5,
          origin: 0.5,
          complexity: 0.5,
        },
        missingFields: ['dates'],
        inferredFields: [],
        reason: 'itinerary_request',
      },
      plannerState: null,
      hasPersistentContext: false,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
      mode: 'passenger',
    });

    expect(resolution.executionBranch).toBe('standard_itinerary');
    expect(resolution.responseMode).toBe('show_places');
  });

  it('uses placeDiscoveryResult tool signal for show_places even without regex match', () => {
    const resolution = resolveConversationTurn({
      parsedRequest: {
        requestType: 'itinerary',
        itinerary: {
          destinations: ['Madrid'],
        },
        placeDiscoveryResult: {
          ok: true,
          intent: 'nightlife',
          destination: { city: 'Madrid', country: 'España', lat: 40.4168, lng: -3.7038 },
          categories: ['nightlife', 'restaurant'],
          places: [{ name: 'Cafe Central', category: 'nightlife', lat: 40.41, lng: -3.71 }],
        },
        confidence: 0.95,
        originalMessage: 'Quiero salir tranqui después de cenar por Madrid',
      },
      routeResult: {
        route: 'PLAN',
        score: 0.3,
        dimensions: {
          destination: 1,
          dates: 0,
          passengers: 0.5,
          origin: 0.5,
          complexity: 0.5,
        },
        missingFields: ['dates'],
        inferredFields: [],
        reason: 'itinerary_request',
      },
      plannerState: null,
      hasPersistentContext: false,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
      mode: 'passenger',
    });

    expect(resolution.responseMode).toBe('show_places');
    expect(resolution.messageType).toBe('discovery_results');
  });

  it('formats discovery responses without planner framing', () => {
    const response = formatDiscoveryResponse({
      city: 'Roma',
      requestText: 'Cosas para hacer en Roma',
      places: [
        { name: 'Museos Vaticanos', city: 'Roma', category: 'Museo', description: 'Colecciones clave del Vaticano' },
        { name: 'Coliseo', city: 'Roma', category: 'Historia', description: 'El clásico absoluto de una primera visita' },
        { name: 'Panteón', city: 'Roma', category: 'Historia', description: 'Uno de los templos mejor conservados' },
      ],
    });

    expect(response).toContain('Para Roma');
    expect(response).toContain('Coliseo');
    expect(response).not.toContain('base de viaje');
    expect(response).not.toContain('hoteles');
  });

  it('maps discover_places tool output to discoveryContext for the chat map', () => {
    const result = buildDiscoveryResponseFromToolResult({
      message: 'Dónde comer bien en Roma',
      placeDiscoveryResult: {
        ok: true,
        intent: 'food',
        destination: { city: 'Roma', country: 'Italia', lat: 41.9028, lng: 12.4964 },
        categories: ['restaurant', 'cafe'],
        places: [
          {
            placeId: 'p1',
            name: 'Roscioli',
            category: 'restaurant',
            lat: 41.895,
            lng: 12.474,
            rating: 4.6,
            photoUrl: 'https://example.com/roscioli.jpg',
            description: 'Via dei Giubbonari',
            source: 'foursquare',
          },
        ],
      },
    });

    expect(result?.discoveryContext?.destination.city).toBe('Roma');
    expect(result?.discoveryContext?.queryType).toBe('food_discovery');
    expect(result?.discoveryContext?.places[0].lat).toBe(41.895);
    expect(result?.recommendedPlaces[0].bucket).toBe('gastronomia');
  });

  // Tests for the legacy regex-driven curation pipeline (curateDiscoveryPlaces,
  // detectDiscoverySubtype, hasStrongPlaceIdentity, isAttractionLikePlace) were
  // removed alongside `buildDiscoveryResponsePayload`. Discovery now flows
  // exclusively through the LLM `discover_places` tool result; the active
  // mapping is covered by `buildDiscoveryResponseFromToolResult` above.

  // ===========================================================================
  // PR 3 / C3 — strict agency/passenger routing + mode_bridge
  // ===========================================================================

  describe('strict mode routing (PR 3)', () => {
    const combinedQuoteRequest = {
      requestType: 'combined' as const,
      flights: { origin: 'BUE', destination: 'BCN', departureDate: '2026-09-10', adults: 2, children: 0 },
      hotels: { city: 'Barcelona', checkinDate: '2026-09-10', checkoutDate: '2026-09-20', adults: 2, children: 0 },
      confidence: 0.95,
      originalMessage: 'Buscame vuelo y hotel a Barcelona',
    };
    const combinedQuoteRoute = {
      route: 'QUOTE' as const,
      score: 0.9,
      dimensions: { destination: 1, dates: 1, passengers: 1, origin: 1, complexity: 0.5 },
      missingFields: [],
      inferredFields: [],
      reason: 'high_definition',
    };
    const itineraryPlanRequest = {
      requestType: 'itinerary' as const,
      itinerary: { destinations: ['Italia'], days: 10 },
      confidence: 0.9,
      originalMessage: 'Armame Italia 10 días',
    };
    const itineraryPlanRoute = {
      route: 'PLAN' as const,
      score: 0.4,
      dimensions: { destination: 1, dates: 0, passengers: 0.5, origin: 0.5, complexity: 0.5 },
      missingFields: ['dates'],
      inferredFields: [],
      reason: 'itinerary_request',
    };
    const baseFlags = {
      hasPersistentContext: false,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
    };

    // -------------------------------------------------------------------------
    // C8 (Phase 5) closure: the legacy `mode === undefined` fallthrough path
    // has been deleted. `mode` is now required. The two tests previously
    // here ("legacy: standard_itinerary" and "D14 #3 legacy:
    // standard_search") asserted that exact path and were removed alongside
    // the code they exercised.
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // D14 adapted tests — spec closed. See commit body for adaptation details.
    // -------------------------------------------------------------------------
    it('D14 #1 (passenger + QUOTE + active planner) → standard_itinerary (bridge refined by !hasActivePlanner, C7.1.e revert)', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: combinedQuoteRequest,
        routeResult: combinedQuoteRoute,
        plannerState: { generationMeta: { isDraft: false } },
        mode: 'passenger',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('standard_itinerary');
      expect(resolution.shouldUseStandardItinerary).toBe(true);
      expect(resolution.responseMode).toBe('proposal_first_plan');
      expect(resolution.uiMeta.firstPlanHandledAs).toBeNull();
    });

    it('D14 #2 (passenger + QUOTE + no planner) → mode_bridge to agency — EXPECTATION CHANGED from ask_minimal per ADR-002', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: combinedQuoteRequest,
        routeResult: combinedQuoteRoute,
        plannerState: null,
        mode: 'passenger',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('mode_bridge');
      expect(resolution.responseMode).toBe('needs_mode_switch');
      expect(resolution.messageType).toBe('mode_bridge');
      expect(resolution.uiMeta.suggestedMode).toBe('agency');
    });

    // -------------------------------------------------------------------------
    // Agency mode matrix
    // -------------------------------------------------------------------------
    it('agency + itinerary intent + PLAN → mode_bridge(passenger)', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: itineraryPlanRequest,
        routeResult: itineraryPlanRoute,
        plannerState: null,
        mode: 'agency',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('mode_bridge');
      expect(resolution.uiMeta.suggestedMode).toBe('passenger');
    });

    it('agency + combined QUOTE → standard_search (no bridge, no planner_agent)', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: combinedQuoteRequest,
        routeResult: combinedQuoteRoute,
        plannerState: { generationMeta: { isDraft: false } },
        mode: 'agency',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('standard_search');
      expect(resolution.responseMode).toBe('quote_or_search');
    });

    it('agency + COLLECT + missing passengers → ask_minimal', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: {
          requestType: 'flights',
          flights: { origin: 'BUE', destination: 'MAD', departureDate: '', adults: 0, children: 0 },
          confidence: 0.7,
          originalMessage: 'Vuelos a Madrid',
        },
        routeResult: {
          route: 'COLLECT',
          score: 0.6,
          dimensions: { destination: 1, dates: 0, passengers: 0, origin: 1, complexity: 0.5 },
          missingFields: ['passengers', 'dates'],
          inferredFields: [],
          reason: 'quote_intent_incomplete',
          collectQuestion: '¿Cuántos viajan y en qué fechas?',
        },
        plannerState: null,
        mode: 'agency',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('ask_minimal');
      expect(resolution.responseMode).toBe('needs_input');
    });

    it('agency + flights QUOTE without itinerary/PLAN intent → standard_search (ambiguous content, no bridge)', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: {
          requestType: 'flights',
          flights: { origin: 'BUE', destination: 'MAD', departureDate: '2026-09-10', adults: 2, children: 0 },
          confidence: 0.9,
          originalMessage: 'Cotizame un vuelo BUE-MAD',
        },
        routeResult: {
          route: 'QUOTE',
          score: 0.9,
          dimensions: { destination: 1, dates: 1, passengers: 1, origin: 1, complexity: 0.5 },
          missingFields: [],
          inferredFields: [],
          reason: 'high_definition',
        },
        plannerState: null,
        mode: 'agency',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('standard_search');
    });

    // -------------------------------------------------------------------------
    // Passenger mode matrix
    // -------------------------------------------------------------------------
    it('passenger + itinerary + PLAN + no planner → standard_itinerary with firstPlanHandledAs=standard_itinerary (C7.1.e revert)', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: itineraryPlanRequest,
        routeResult: itineraryPlanRoute,
        plannerState: null,
        mode: 'passenger',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('standard_itinerary');
      expect(resolution.shouldUseStandardItinerary).toBe(true);
      expect(resolution.uiMeta.firstPlanHandledAs).toBe('standard_itinerary');
    });

    it('passenger + PLAN + planner active → standard_itinerary with firstPlanHandledAs=null (C7.1.e revert)', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: itineraryPlanRequest,
        routeResult: itineraryPlanRoute,
        plannerState: { generationMeta: { isDraft: false } },
        mode: 'passenger',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('standard_itinerary');
      expect(resolution.shouldUseStandardItinerary).toBe(true);
      expect(resolution.uiMeta.firstPlanHandledAs).toBeNull();
    });

    it('passenger + COLLECT + missing passengers → ask_minimal', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: {
          requestType: 'itinerary',
          itinerary: { destinations: ['Paris'] },
          confidence: 0.7,
          originalMessage: 'Quiero ir a Paris',
        },
        routeResult: {
          route: 'COLLECT',
          score: 0.5,
          dimensions: { destination: 1, dates: 0, passengers: 0, origin: 0.5, complexity: 0.5 },
          missingFields: ['passengers', 'dates'],
          inferredFields: [],
          reason: 'quote_intent_incomplete',
          collectQuestion: '¿Cuántos viajan?',
        },
        plannerState: null,
        mode: 'passenger',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('ask_minimal');
    });

    it('passenger + flights QUOTE + no planner → mode_bridge(agency)', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: {
          requestType: 'flights',
          flights: { origin: 'BUE', destination: 'MAD', departureDate: '2026-09-10', adults: 2, children: 0 },
          confidence: 0.9,
          originalMessage: 'Cotizame un vuelo BUE-MAD',
        },
        routeResult: {
          route: 'QUOTE',
          score: 0.9,
          dimensions: { destination: 1, dates: 1, passengers: 1, origin: 1, complexity: 0.5 },
          missingFields: [],
          inferredFields: [],
          reason: 'high_definition',
        },
        plannerState: null,
        mode: 'passenger',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('mode_bridge');
      expect(resolution.uiMeta.suggestedMode).toBe('agency');
    });

    // -------------------------------------------------------------------------
    // Guardrails
    // -------------------------------------------------------------------------
    it('G1: agency + itinerary intent + previousMessageType=mode_bridge → falls to agency default (standard_search), no bridge', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: itineraryPlanRequest,
        routeResult: itineraryPlanRoute,
        plannerState: null,
        mode: 'agency',
        previousMessageType: 'mode_bridge',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('standard_search');
    });

    it('G2: agency + itinerary intent + forceCurrentMode=true → falls to agency default (standard_search), no bridge', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: itineraryPlanRequest,
        routeResult: itineraryPlanRoute,
        plannerState: null,
        mode: 'agency',
        forceCurrentMode: true,
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('standard_search');
    });

    it('G1 (passenger side): passenger + QUOTE + no planner + previousMessageType=mode_bridge → falls to passenger default (standard_itinerary, C7.1.e revert)', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: combinedQuoteRequest,
        routeResult: combinedQuoteRoute,
        plannerState: null,
        mode: 'passenger',
        previousMessageType: 'mode_bridge',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('standard_itinerary');
      expect(resolution.shouldUseStandardItinerary).toBe(true);
    });

    it('G2 (passenger side): passenger + QUOTE + no planner + forceCurrentMode=true → falls to passenger default (standard_itinerary, C7.1.e revert)', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: combinedQuoteRequest,
        routeResult: combinedQuoteRoute,
        plannerState: null,
        mode: 'passenger',
        forceCurrentMode: true,
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('standard_itinerary');
      expect(resolution.shouldUseStandardItinerary).toBe(true);
    });

    it('edge: mode set, both guardrail params undefined → bridge emits normally (C3 default behavior)', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: itineraryPlanRequest,
        routeResult: itineraryPlanRoute,
        plannerState: null,
        mode: 'agency',
        // previousMessageType and forceCurrentMode omitted on purpose
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('mode_bridge');
    });

    // ---- G3 / G4: Phase 5 Context-Engineering bridge guards ---------------
    it('G3: agency + itinerary intent + hasPendingAction + active planner → no bridge (slot-fill in progress)', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: itineraryPlanRequest,
        routeResult: itineraryPlanRoute,
        plannerState: { generationMeta: { isDraft: false } },
        mode: 'agency',
        hasPendingAction: true,
        ...baseFlags,
      });
      // Active planner + agency + pending_action → falls to standard_search
      // (the bridge is suppressed so the in-flight ask isn't interrupted).
      expect(resolution.executionBranch).not.toBe('mode_bridge');
      expect(resolution.executionBranch).toBe('standard_search');
    });

    it('G3 negative: hasPendingAction without active planner → bridge still fires (no risk of interrupting an ask)', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: itineraryPlanRequest,
        routeResult: itineraryPlanRoute,
        plannerState: null,
        mode: 'agency',
        hasPendingAction: true,
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('mode_bridge');
    });

    it('G4: previousMessageType=quote_active_plan → no bridge (user is answering the quote prompt)', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: itineraryPlanRequest,
        routeResult: itineraryPlanRoute,
        plannerState: null,
        mode: 'agency',
        previousMessageType: 'quote_active_plan',
        ...baseFlags,
      });
      expect(resolution.executionBranch).not.toBe('mode_bridge');
      expect(resolution.executionBranch).toBe('standard_search');
    });

    // -------------------------------------------------------------------------
    // Discovery bypass — strict mode is bypassed when isDiscoveryIntent=true.
    // Carryover for C8: discovery needs its own branch before standard_itinerary
    // can be removed.
    // -------------------------------------------------------------------------
    it('discovery bypass: passenger + PLAN + planner active + discover_places result → standard_itinerary (show_places), not planner_agent, not mode_bridge', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: {
          requestType: 'itinerary',
          itinerary: { destinations: ['Roma'] },
          placeDiscoveryResult: {
            ok: true,
            intent: 'broad',
            destination: { city: 'Roma', country: 'Italia', lat: 41.9028, lng: 12.4964 },
            places: [{ name: 'Coliseo', category: 'sights', lat: 41.89, lng: 12.49 }],
          },
          confidence: 0.95,
          originalMessage: 'Qué ver en Roma',
        },
        routeResult: {
          route: 'PLAN',
          score: 0.5,
          dimensions: { destination: 1, dates: 0, passengers: 0.5, origin: 0.5, complexity: 0.5 },
          missingFields: [],
          inferredFields: [],
          reason: 'itinerary_request',
        },
        plannerState: { generationMeta: { isDraft: false } },
        mode: 'passenger',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('standard_itinerary');
      expect(resolution.responseMode).toBe('show_places');
    });

    it('discovery bypass: agency + PLAN + discover_places result → standard_itinerary, NOT mode_bridge', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: {
          requestType: 'itinerary',
          itinerary: { destinations: ['Roma'] },
          placeDiscoveryResult: {
            ok: true,
            intent: 'broad',
            destination: { city: 'Roma', country: 'Italia', lat: 41.9028, lng: 12.4964 },
            places: [{ name: 'Coliseo', category: 'sights', lat: 41.89, lng: 12.49 }],
          },
          confidence: 0.95,
          originalMessage: 'Qué ver en Roma',
        },
        routeResult: {
          route: 'PLAN',
          score: 0.5,
          dimensions: { destination: 1, dates: 0, passengers: 0.5, origin: 0.5, complexity: 0.5 },
          missingFields: [],
          inferredFields: [],
          reason: 'itinerary_request',
        },
        plannerState: null,
        mode: 'agency',
        ...baseFlags,
      });
      expect(resolution.executionBranch).toBe('standard_itinerary');
      expect(resolution.responseMode).toBe('show_places');
    });

    // ---------------------------------------------------------------------
    // G6 — mode_bridge suppression on iteration (bugfix)
    // ---------------------------------------------------------------------
    describe('mode_bridge suppression on iteration', () => {
      it('G6: agency + itinerary intent + iterationContext.isIteration=true → no mode_bridge (user is refining)', () => {
        const resolution = resolveConversationTurn({
          parsedRequest: itineraryPlanRequest,
          routeResult: itineraryPlanRoute,
          plannerState: null,
          mode: 'agency',
          iterationContext: {
            isIteration: true,
            iterationType: 'flight_modification',
            baseRequestType: 'flights',
            modifiedComponent: 'flights',
            preserveFields: [],
            confidence: 0.95,
          },
          ...baseFlags,
        });
        expect(resolution.executionBranch).not.toBe('mode_bridge');
      });

      it('G6 negative: same setup but iterationContext.isIteration=false → mode_bridge still fires (guard does not over-suppress)', () => {
        const resolution = resolveConversationTurn({
          parsedRequest: itineraryPlanRequest,
          routeResult: itineraryPlanRoute,
          plannerState: null,
          mode: 'agency',
          iterationContext: {
            isIteration: false,
            iterationType: 'new_search',
            baseRequestType: null,
            modifiedComponent: null,
            preserveFields: [],
            confidence: 1.0,
          },
          ...baseFlags,
        });
        expect(resolution.executionBranch).toBe('mode_bridge');
      });
    });

    // ---------------------------------------------------------------------
    // Phase 5 / sub-task C — proposal_chip branch (exploratory_with_seeds)
    // ---------------------------------------------------------------------
    describe('proposal_chip branch (Phase 5 / sub-task C)', () => {
      const exploratoryRequest = {
        requestType: 'general' as const,
        confidence: 0.4,
        originalMessage: 'Quiero algo premium en Riviera Maya para aniversario, dos personas',
        searchSeeds: {
          destination: 'Riviera Maya',
          travelerType: 'couple' as const,
          budgetHint: 'premium' as const,
          occasionHint: 'anniversary' as const,
          productsImplied: ['flight' as const, 'hotel' as const],
          adults: 2,
        },
      };
      const exploratoryRoute = {
        route: 'COLLECT' as const,
        score: 0.4,
        dimensions: { destination: 1, dates: 0, passengers: 0.5, origin: 0.5, complexity: 0.5 },
        missingFields: ['dates'],
        inferredFields: [],
        reason: 'exploratory_with_seeds' as const,
      };

      it('agency mode + exploratory_with_seeds reason → executionBranch=proposal_chip', () => {
        const resolution = resolveConversationTurn({
          parsedRequest: exploratoryRequest,
          routeResult: exploratoryRoute,
          plannerState: null,
          mode: 'agency',
          ...baseFlags,
        });
        expect(resolution.executionBranch).toBe('proposal_chip');
        expect(resolution.responseMode).toBe('proposal_first_search');
        expect(resolution.messageType).toBe('search_proposal');
        expect(resolution.shouldUseStandardItinerary).toBe(false);
        expect(resolution.shouldAskMinimalQuestion).toBe(false);
      });

      it('passenger mode + exploratory_with_seeds reason → does NOT enter proposal_chip branch', () => {
        const resolution = resolveConversationTurn({
          parsedRequest: exploratoryRequest,
          routeResult: exploratoryRoute,
          plannerState: null,
          mode: 'passenger',
          ...baseFlags,
        });
        expect(resolution.executionBranch).not.toBe('proposal_chip');
      });

      it('agency mode + exploratory_with_seeds + hasPendingAction → does NOT enter proposal_chip', () => {
        const resolution = resolveConversationTurn({
          parsedRequest: exploratoryRequest,
          routeResult: exploratoryRoute,
          plannerState: null,
          mode: 'agency',
          hasPendingAction: true,
          ...baseFlags,
        });
        expect(resolution.executionBranch).not.toBe('proposal_chip');
      });

      it('agency mode + exploratory_with_seeds + isQuoteFromActivePlanner (reason=quote_active_plan) → does NOT enter proposal_chip', () => {
        const resolution = resolveConversationTurn({
          parsedRequest: exploratoryRequest,
          routeResult: { ...exploratoryRoute, reason: 'quote_active_plan' as const },
          plannerState: { generationMeta: { isDraft: false } },
          mode: 'agency',
          ...baseFlags,
        });
        expect(resolution.executionBranch).not.toBe('proposal_chip');
      });
    });
  });
});
