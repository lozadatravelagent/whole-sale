import { describe, expect, it } from 'vitest';
import { buildModeBridgeMessage, resolveConversationTurn, resolveTravelContextBridge } from '../services/conversationOrchestrator';
import { routeRequest } from '../services/routeRequest';

// Stand-in for react-i18next's `t` function. Returns direction-specific copy
// keyed by locale, matching the actual contents of the 3 chat.json locales.
// Exact-match assertions per the C4 spec (not `toContain`).
const MESSAGES: Record<string, Record<string, string>> = {
  es: {
    'mode.bridgeTitle.toAgency':
      'Este pedido se resuelve mejor cotizando vuelos y hoteles. ¿Cambiamos de modo?',
    'mode.bridgeTitle.toPassenger':
      'Este pedido funciona mejor armando un itinerario. ¿Cambiamos de modo?',
  },
  en: {
    'mode.bridgeTitle.toAgency':
      'This works better in agency mode for quoting flights and hotels. Switch?',
    'mode.bridgeTitle.toPassenger':
      'This works better in passenger mode for itinerary planning. Switch?',
  },
  pt: {
    'mode.bridgeTitle.toAgency':
      'Este pedido funciona melhor cotando voos e hotéis. Mudamos de modo?',
    'mode.bridgeTitle.toPassenger':
      'Este pedido funciona melhor planejando o roteiro. Mudamos de modo?',
  },
};

function makeT(locale: string) {
  return (key: string) => MESSAGES[locale][key] ?? key;
}

describe('buildModeBridgeMessage', () => {
  it('suggestedMode=agency, es → exact Spanish toAgency copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'agency', t: makeT('es') });
    expect(text).toBe(
      'Este pedido se resuelve mejor cotizando vuelos y hoteles. ¿Cambiamos de modo?',
    );
  });

  it('suggestedMode=agency, en → exact English toAgency copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'agency', t: makeT('en') });
    expect(text).toBe(
      'This works better in agency mode for quoting flights and hotels. Switch?',
    );
  });

  it('suggestedMode=agency, pt → exact Portuguese toAgency copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'agency', t: makeT('pt') });
    expect(text).toBe(
      'Este pedido funciona melhor cotando voos e hotéis. Mudamos de modo?',
    );
  });

  it('suggestedMode=passenger, es → exact Spanish toPassenger copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'passenger', t: makeT('es') });
    expect(text).toBe(
      'Este pedido funciona mejor armando un itinerario. ¿Cambiamos de modo?',
    );
  });

  it('suggestedMode=passenger, en → exact English toPassenger copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'passenger', t: makeT('en') });
    expect(text).toBe(
      'This works better in passenger mode for itinerary planning. Switch?',
    );
  });

  it('suggestedMode=passenger, pt → exact Portuguese toPassenger copy', () => {
    const text = buildModeBridgeMessage({ suggestedMode: 'passenger', t: makeT('pt') });
    expect(text).toBe(
      'Este pedido funciona melhor planejando o roteiro. Mudamos de modo?',
    );
  });

  it('selects the correct key per direction (agency → toAgency, passenger → toPassenger)', () => {
    const keysRequested: string[] = [];
    const probe = (key: string) => {
      keysRequested.push(key);
      return key;
    };
    buildModeBridgeMessage({ suggestedMode: 'agency', t: probe });
    buildModeBridgeMessage({ suggestedMode: 'passenger', t: probe });
    expect(keysRequested).toEqual(['mode.bridgeTitle.toAgency', 'mode.bridgeTitle.toPassenger']);
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
