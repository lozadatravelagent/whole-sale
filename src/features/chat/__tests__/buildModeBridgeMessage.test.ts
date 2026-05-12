import { describe, expect, it } from 'vitest';
import { buildModeBridgeMessage, resolveConversationTurn, resolveTravelContextBridge } from '../services/conversationOrchestrator';
import { routeRequest } from '../services/routeRequest';

// Phase 3 / sub-task A: the legacy i18next-driven copy was deleted. The
// narrative (chatResultCopy.getModeBridgeCopy) is the single source of truth
// and these tests now assert on its trilingual output directly.

describe('buildModeBridgeMessage', () => {
  it('suggestedMode=agency, es → narrative toAgency copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'agency', language: 'es' });
    expect(text).toBe(
      'Este pedido se resuelve mejor cotizando vuelos y hoteles. ¿Cambiamos de modo?',
    );
  });

  it('suggestedMode=agency, en → narrative toAgency copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'agency', language: 'en' });
    expect(text).toContain('quoting flights and hotels');
  });

  it('suggestedMode=agency, pt → narrative toAgency copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'agency', language: 'pt' });
    expect(text.toLowerCase()).toContain('cotando voos e hot');
  });

  it('suggestedMode=passenger, es → narrative toPassenger copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'passenger', language: 'es' });
    expect(text).toBe(
      'Este pedido funciona mejor armando un itinerario. ¿Cambiamos de modo?',
    );
  });

  it('suggestedMode=passenger, en → narrative toPassenger copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'passenger', language: 'en' });
    expect(text.toLowerCase()).toContain('itinerary');
  });

  it('suggestedMode=passenger, pt → narrative toPassenger copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'passenger', language: 'pt' });
    expect(text.toLowerCase()).toContain('itiner');
  });

  it('defaults to es when no language is provided (back-compat for legacy callers)', () => {
    const agency = buildModeBridgeMessage({ suggestedMode: 'agency' });
    const passenger = buildModeBridgeMessage({ suggestedMode: 'passenger' });
    expect(agency).toContain('cotizando vuelos y hoteles');
    expect(passenger).toContain('armando un itinerario');
  });
});

describe('resolveConversationTurn mode bridge', () => {
  it('does not bridge agency back to passenger when quoting an active planner', () => {
    const turn = resolveConversationTurn({
      parsedRequest: {
        requestType: 'itinerary',
        confidence: 0.9,
        originalMessage: 'Cotizame este viaje',
        itinerary: {
          destinations: ['Roma', 'Florencia'],
          days: 8,
        },
      },
      routeResult: {
        route: 'QUOTE',
        score: 0.65,
        missingFields: [],
        collectQuestion: null,
        reason: 'quote_active_plan',
        dimensions: {
          destination: 1,
          dates: 0.5,
          passengers: 1,
          origin: 0,
          complexity: 0.5,
        },
        inferredFields: [],
      },
      plannerState: { generationMeta: { isDraft: false } },
      hasPersistentContext: false,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
      mode: 'agency',
    });

    expect(turn.executionBranch).toBe('standard_search');
    expect(turn.responseMode).toBe('quote_or_search');
    expect(turn.messageType).toBe('search_results');
    expect(turn.uiMeta.suggestedMode).toBeUndefined();
  });

  it('still bridges agency itinerary edits without quote intent to passenger', () => {
    const turn = resolveConversationTurn({
      parsedRequest: {
        requestType: 'itinerary',
        confidence: 0.9,
        originalMessage: 'Sumale Venecia al viaje',
        itinerary: {
          destinations: ['Venecia'],
          days: 2,
        },
      },
      routeResult: {
        route: 'PLAN',
        score: 0.65,
        missingFields: [],
        collectQuestion: null,
        reason: 'edit_existing_plan',
        dimensions: {
          destination: 1,
          dates: 0.5,
          passengers: 1,
          origin: 0,
          complexity: 0.5,
        },
        inferredFields: [],
      },
      plannerState: { generationMeta: { isDraft: false } },
      hasPersistentContext: false,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
      mode: 'agency',
    });

    expect(turn.executionBranch).toBe('mode_bridge');
    expect(turn.uiMeta.suggestedMode).toBe('passenger');
  });

  // G5 — high-confidence explicit itinerary intent: skip bridge to passenger
  // when the user clearly asked for a trip in plain language. Avoids the
  // "user has to repeat the message" UX trap that cost ~11s per first turn.
  it('does not bridge agency to passenger for high-confidence explicit itinerary intent', () => {
    const turn = resolveConversationTurn({
      parsedRequest: {
        requestType: 'itinerary',
        confidence: 0.95,
        originalMessage: 'armame un viaje al caribe 15 dias',
        itinerary: {
          destinations: ['Caribe'],
          days: 15,
        },
      },
      routeResult: {
        route: 'PLAN',
        score: 0.38,
        missingFields: ['origin'],
        collectQuestion: null,
        reason: 'itinerary_request',
        dimensions: {
          destination: 0.5,
          dates: 0.3,
          passengers: 0.5,
          origin: 0.5,
          complexity: 1,
        },
        inferredFields: [],
      },
      plannerState: null,
      hasPersistentContext: false,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
      mode: 'agency',
    });

    // The crucial assertion: G5 prevents mode_bridge. The downstream branch
    // (standard_search for agency, standard_itinerary for passenger) depends
    // on `mode`; useMessageHandler's switch dispatches by requestType so the
    // itinerary handler runs in either case.
    expect(turn.executionBranch).not.toBe('mode_bridge');
    expect(turn.uiMeta.suggestedMode).toBeUndefined();
  });

  // G5 negative case: high-confidence itinerary WITHOUT PLAN_INTENT keywords
  // should still bridge to passenger. Guards against G5 swallowing the bridge
  // for cases where the parser inferred itinerary from ambient context but
  // the user didn't explicitly ask for a trip.
  it('still bridges high-confidence itinerary that lacks explicit PLAN_INTENT keywords', () => {
    const turn = resolveConversationTurn({
      parsedRequest: {
        requestType: 'itinerary',
        confidence: 0.95,
        originalMessage: 'el caribe es lindo',
        itinerary: {
          destinations: ['Caribe'],
        },
      },
      routeResult: {
        route: 'PLAN',
        score: 0.38,
        missingFields: ['dates'],
        collectQuestion: null,
        reason: 'itinerary_request',
        dimensions: {
          destination: 0.5,
          dates: 0,
          passengers: 0.5,
          origin: 0.5,
          complexity: 1,
        },
        inferredFields: [],
      },
      plannerState: null,
      hasPersistentContext: false,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
      mode: 'agency',
    });

    expect(turn.executionBranch).toBe('mode_bridge');
    expect(turn.uiMeta.suggestedMode).toBe('passenger');
  });

  it('stops asking minimal questions once the collect cap is exhausted', () => {
    const turn = resolveConversationTurn({
      parsedRequest: {
        requestType: 'flights',
        confidence: 0.7,
        originalMessage: 'quiero vuelos a Cancun',
        flights: {
          destination: 'Cancun',
          adults: 1,
        },
      },
      routeResult: {
        route: 'COLLECT',
        score: 0.55,
        missingFields: ['dates'],
        collectQuestion: '¿En qué fechas viajás?',
        reason: 'needs_clarification',
        dimensions: {
          destination: 1,
          dates: 0,
          passengers: 0.5,
          origin: 0,
          complexity: 1,
        },
        inferredFields: [],
      },
      plannerState: null,
      hasPersistentContext: false,
      hasPreviousParsedRequest: false,
      recentCollectCount: 3,
      maxCollectTurns: 3,
      mode: 'passenger',
    });

    expect(turn.executionBranch).toBe('standard_itinerary');
    expect(turn.shouldAskMinimalQuestion).toBe(false);
    expect(turn.messageType).toBe('trip_planner');
  });
});

describe('routeRequest active planner quote intent', () => {
  it('routes "Cotizame este viaje" as quote_active_plan when a planner is active', () => {
    const route = routeRequest(
      {
        requestType: 'itinerary',
        confidence: 0.9,
        originalMessage: 'Cotizame este viaje',
        itinerary: {
          destinations: ['Roma', 'Florencia'],
          days: 8,
        },
      },
      { generationMeta: { isDraft: false }, segments: [{ city: 'Roma' }] },
    );

    expect(route.route).toBe('QUOTE');
    expect(route.reason).toBe('quote_active_plan');
  });

  it('keeps active planner structural edits on PLAN', () => {
    const route = routeRequest(
      {
        requestType: 'itinerary',
        confidence: 0.9,
        originalMessage: 'Sumale Venecia al viaje',
        itinerary: {
          destinations: ['Venecia'],
          days: 2,
          editIntent: true,
        },
      },
      { generationMeta: { isDraft: false }, segments: [{ city: 'Roma' }] },
    );

    expect(route.route).toBe('PLAN');
    expect(route.reason).toBe('edit_existing_plan');
  });

  it('does not treat a new trip quote as quote_active_plan just because a planner exists', () => {
    const route = routeRequest(
      {
        requestType: 'itinerary',
        confidence: 0.9,
        originalMessage: 'Cotizame un viaje a Japon',
        itinerary: {
          destinations: ['Japon'],
          days: 12,
        },
      },
      { generationMeta: { isDraft: false }, segments: [{ city: 'Roma' }] },
    );

    expect(route.reason).not.toBe('quote_active_plan');
  });
});

describe('resolveTravelContextBridge', () => {
  it('reuses the latest quote/search context when the user asks for an itinerary from it', () => {
    const bridge = resolveTravelContextBridge({
      message: 'Armame un itinerario con esta cotización',
      parsedRequest: {
        requestType: 'general',
        confidence: 0.6,
        originalMessage: 'Armame un itinerario con esta cotización',
      },
      persistentState: {
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
      },
    });

    expect(bridge.kind).toBe('quote_to_plan');
    expect(bridge.parsedRequest).toEqual(expect.objectContaining({
      requestType: 'itinerary',
      itinerary: expect.objectContaining({
        destinations: ['MAD'],
        startDate: '2026-09-10',
        endDate: '2026-09-18',
        days: 9,
        travelers: { adults: 2, children: 0, infants: 0 },
      }),
    }));
  });

  it('does not convert quote context into itinerary edits when a planner is active', () => {
    const bridge = resolveTravelContextBridge({
      message: 'Armame un itinerario con esta cotización',
      parsedRequest: {
        requestType: 'general',
        confidence: 0.6,
        originalMessage: 'Armame un itinerario con esta cotización',
      },
      plannerState: {
        generationMeta: { isDraft: false },
      } as any,
      persistentState: {
        schemaVersion: 1,
        turnNumber: 1,
        constraintsHistory: [],
        lastSearch: {
          requestType: 'flights',
          timestamp: '2026-01-01T00:00:00Z',
          flightsParams: {
            origin: 'BUE',
            destination: 'MAD',
            departureDate: '2026-09-10',
            adults: 2,
            children: 0,
            infants: 0,
          },
        },
      },
    });

    expect(bridge.kind).toBeNull();
    expect(bridge.parsedRequest.requestType).toBe('general');
  });

  it('converts a complete active planner into a combined quote request', () => {
    const bridge = resolveTravelContextBridge({
      message: 'Cotizame este plan',
      routeResult: {
        route: 'QUOTE',
        score: 0.8,
        missingFields: [],
        collectQuestion: null,
        reason: 'quote_active_plan',
        dimensions: {
          destination: 1,
          dates: 1,
          passengers: 1,
          origin: 1,
          complexity: 0.5,
        },
        inferredFields: [],
      },
      parsedRequest: {
        requestType: 'itinerary',
        confidence: 0.9,
        originalMessage: 'Cotizame este plan',
        itinerary: {
          destinations: ['Roma', 'Florencia'],
          days: 8,
        },
      },
      plannerState: {
        id: 'plan-1',
        title: 'Italia',
        summary: '',
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
          { id: 'seg-1', city: 'Roma', order: 0, nights: 5, days: [], hotelPlan: { searchStatus: 'idle' } },
          { id: 'seg-2', city: 'Florencia', order: 1, nights: 3, days: [], hotelPlan: { searchStatus: 'idle' } },
        ],
        generalTips: [],
        generationMeta: { source: 'chat', updatedAt: '2026-01-01T00:00:00Z', version: 1 },
      } as any,
    });

    expect(bridge.kind).toBe('plan_to_quote');
    expect(bridge.parsedRequest).toEqual(expect.objectContaining({
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
        adults: 2,
        segments: expect.arrayContaining([
          expect.objectContaining({ city: 'Roma', checkinDate: '2026-09-10', checkoutDate: '2026-09-15' }),
          expect.objectContaining({ city: 'Florencia', checkinDate: '2026-09-15', checkoutDate: '2026-09-18' }),
        ]),
      }),
    }));
  });
});
