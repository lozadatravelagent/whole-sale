import { describe, expect, it } from 'vitest';
import {
  buildConversationalMissingInfoMessage,
  deriveConversationGaps,
  extractRecommendedPlacesFromMeta,
  formatDiscoveryResponse,
  resolveConversationTurn,
} from '@/features/chat/services/conversationOrchestrator';
import { curateDiscoveryPlaces, detectDiscoverySubtype, hasStrongPlaceIdentity, isAttractionLikePlace } from '@/features/chat/services/discoveryService';

describe('conversationOrchestrator', () => {
  it('builds a shorter conversational missing-info message', () => {
    const message = buildConversationalMissingInfoMessage({
      parsedRequest: {
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
    });

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
    });

    expect(resolution.executionBranch).toBe('standard_itinerary');
    expect(resolution.responseMode).toBe('proposal_first_plan');
    expect(resolution.uiMeta.firstPlanHandledAs).toBe('standard_itinerary');
  });

  it('keeps active planner PLAN turns on planner-agent branch', () => {
    const resolution = resolveConversationTurn({
      parsedRequest: {
        requestType: 'itinerary',
        itinerary: {
          destinations: ['Barcelona'],
          editIntent: { action: 'change_dates' },
        },
        confidence: 0.9,
        originalMessage: 'Agregá una noche más en Barcelona',
      },
      routeResult: {
        route: 'PLAN',
        score: 0.8,
        dimensions: {
          destination: 1,
          dates: 1,
          passengers: 1,
          origin: 0.5,
          complexity: 0.5,
        },
        missingFields: [],
        inferredFields: [],
        reason: 'edit_existing_plan',
      },
      plannerState: { generationMeta: { isDraft: false } },
      hasPersistentContext: true,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
    });

    expect(resolution.shouldUsePlannerAgent).toBe(true);
    expect(resolution.executionBranch).toBe('planner_agent');
  });

  it('keeps discovery turns out of planner-agent even with an active planner', () => {
    const resolution = resolveConversationTurn({
      parsedRequest: {
        requestType: 'itinerary',
        itinerary: { destinations: ['Roma'] },
        confidence: 0.95,
        originalMessage: 'Qué ver en Roma',
      },
      routeResult: {
        route: 'PLAN',
        score: 0.5,
        dimensions: {
          destination: 1,
          dates: 0,
          passengers: 0.5,
          origin: 0.5,
          complexity: 0.5,
        },
        missingFields: [],
        inferredFields: [],
        reason: 'itinerary_request',
      },
      plannerState: { generationMeta: { isDraft: false } },
      hasPersistentContext: true,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
    });

    expect(resolution.shouldUsePlannerAgent).toBe(false);
    expect(resolution.responseMode).toBe('show_places');
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
    });

    expect(resolution.executionBranch).toBe('standard_itinerary');
    expect(resolution.responseMode).toBe('show_places');
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

  it('reranks broad discovery places toward iconic landmarks and filters weak places', () => {
    const selected = curateDiscoveryPlaces({
      destination: {
        city: 'Paris',
        lat: 48.8566,
        lng: 2.3522,
        confidence: 1,
        source: 'parsed_request',
      },
      queryType: 'broad_city_discovery',
      candidates: [
        { placeId: '1', name: 'MK2 Bibliothèque', category: 'activity', formattedAddress: 'Paris', photoUrls: [], rating: 3.8, userRatingsTotal: 10, types: ['movie_theater'] },
        { placeId: '2', name: 'Le Louvre', category: 'museum', formattedAddress: 'Paris', photoUrls: ['photo'], rating: 4.8, userRatingsTotal: 10000, types: ['museum'] },
        { placeId: '3', name: 'Torre Eiffel', category: 'sights', formattedAddress: 'Paris', photoUrls: ['photo'], rating: 4.8, userRatingsTotal: 15000, types: ['tourist_attraction'] },
        { placeId: '4', name: 'Montmartre', category: 'activity', formattedAddress: 'Paris', photoUrls: ['photo'], rating: 4.7, userRatingsTotal: 8000, types: ['neighborhood'] },
      ],
    });

    const response = formatDiscoveryResponse({ city: 'Paris', requestText: 'Cosas para hacer en París', places: selected });

    expect(response).toContain('Torre Eiffel');
    expect(response).toContain('Le Louvre');
    expect(response).toContain('Montmartre');
    expect(response).not.toContain('MK2');
    expect(response).toContain('- ');
  });

  it('builds a diverse broad discovery selection without city-specific fallback lists', () => {
    const selected = curateDiscoveryPlaces({
      destination: {
        city: 'Lisboa',
        lat: 38.7223,
        lng: -9.1393,
        confidence: 1,
        source: 'parsed_request',
      },
      queryType: 'broad_city_discovery',
      candidates: [
        { placeId: '1', name: 'Torre de Belem', category: 'sights', formattedAddress: 'Lisboa', photoUrls: ['a'], rating: 4.7, userRatingsTotal: 9000, types: ['tourist_attraction'] },
        { placeId: '2', name: 'Mosteiro dos Jeronimos', category: 'culture', formattedAddress: 'Lisboa', photoUrls: ['a'], rating: 4.8, userRatingsTotal: 8500, types: ['church'] },
        { placeId: '3', name: 'Museu Nacional do Azulejo', category: 'museum', formattedAddress: 'Lisboa', photoUrls: ['a'], rating: 4.7, userRatingsTotal: 4000, types: ['museum'] },
        { placeId: '4', name: 'Alfama', category: 'activity', formattedAddress: 'Lisboa', photoUrls: ['a'], rating: 4.6, userRatingsTotal: 3000, types: ['neighborhood'] },
        { placeId: '5', name: 'Miradouro de Santa Luzia', category: 'parks', formattedAddress: 'Lisboa', photoUrls: ['a'], rating: 4.7, userRatingsTotal: 5000, types: ['viewpoint'] },
        { placeId: '6', name: 'Cinema Sao Jorge', category: 'activity', formattedAddress: 'Lisboa', photoUrls: ['a'], rating: 4.4, userRatingsTotal: 1200, types: ['movie_theater'] },
      ],
    });

    expect(selected.some((place) => place.name.includes('Belem'))).toBe(true);
    expect(selected.some((place) => place.name.includes('Alfama'))).toBe(true);
    expect(selected.some((place) => place.name.includes('Azulejo'))).toBe(true);
    expect(selected.some((place) => place.name.includes('Cinema'))).toBe(false);
  });

  it('detects broad city discovery by default for que ver / que hacer queries', () => {
    expect(detectDiscoverySubtype('Qué hacer en Ámsterdam')).toBe('broad_city_discovery');
    expect(detectDiscoverySubtype('Imperdibles de Berlín')).toBe('broad_city_discovery');
    expect(detectDiscoverySubtype('Museos en Madrid')).toBe('museum_discovery');
  });

  it('recognizes attraction-like places and excludes commercial venues', () => {
    expect(isAttractionLikePlace({
      placeId: 'a1',
      name: 'Rijksmuseum',
      category: 'museum',
      photoUrls: ['x'],
      types: ['museum'],
    })).toBe(true);

    expect(isAttractionLikePlace({
      placeId: 'a2',
      name: 'Independent Outlet Skateboards Amsterdam',
      category: 'activity',
      photoUrls: [],
      types: ['store'],
    })).toBe(false);
  });

  it('rejects weak generic labels and keeps strong identities', () => {
    const destination = {
      city: 'Berlin',
      lat: 52.52,
      lng: 13.405,
      confidence: 1,
      source: 'parsed_request' as const,
    };

    expect(hasStrongPlaceIdentity({
      placeId: 'b1',
      name: 'Mirador de Berlin',
      category: 'parks',
      photoUrls: ['x'],
      types: ['viewpoint'],
      userRatingsTotal: 500,
    }, destination)).toBe(false);

    expect(hasStrongPlaceIdentity({
      placeId: 'b2',
      name: 'Berlin Cathedral (Berliner Dom)',
      category: 'nightlife',
      photoUrls: ['x'],
      types: ['church'],
      userRatingsTotal: 12000,
    }, destination)).toBe(true);
  });

  it('derives broad badges from curated buckets instead of raw nightlife category', () => {
    const selected = curateDiscoveryPlaces({
      destination: {
        city: 'Berlin',
        lat: 52.52,
        lng: 13.405,
        confidence: 1,
        source: 'parsed_request',
      },
      queryType: 'broad_city_discovery',
      candidates: [
        { placeId: '1', name: 'Berlin Cathedral (Berliner Dom)', category: 'nightlife', formattedAddress: 'Am Lustgarten 1', photoUrls: ['a'], rating: 4.8, userRatingsTotal: 12000, types: ['church'] },
        { placeId: '2', name: 'Mirador de Berlin', category: 'parks', formattedAddress: 'SV', photoUrls: ['a'], rating: 4.1, userRatingsTotal: 150, types: ['viewpoint'] },
        { placeId: '3', name: 'Brandenburg Gate', category: 'sights', formattedAddress: 'Pariser Platz', photoUrls: ['a'], rating: 4.7, userRatingsTotal: 15000, types: ['tourist_attraction'] },
        { placeId: '4', name: 'Tiergarten', category: 'parks', formattedAddress: 'Berlin', photoUrls: ['a'], rating: 4.7, userRatingsTotal: 9000, types: ['park'] },
        { placeId: '5', name: 'Museumsinsel', category: 'culture', formattedAddress: 'Berlin', photoUrls: ['a'], rating: 4.8, userRatingsTotal: 10000, types: ['historical_landmark'] },
        { placeId: '6', name: 'Unter den Linden', category: 'activity', formattedAddress: 'Berlin', photoUrls: ['a'], rating: 4.6, userRatingsTotal: 6000, types: ['route'] },
      ],
    });

    const cathedral = selected.find((place) => place.name.includes('Cathedral'));
    expect(selected.some((place) => place.name.includes('Mirador de Berlin'))).toBe(false);
    expect(cathedral?.bucket).toBe('historia');
    expect(cathedral?.category).toBe('Historia');
    expect(cathedral?.description).not.toBe('SV');
  });

  it('captures compact debug reasons for broad discovery curation', () => {
    const debug = {
      payload: {
        discoverySubtype: 'broad_city_discovery' as const,
        providerCategories: { activity: 2, parks: 1, nightlife: 1, sights: 1 },
        selectedBuckets: [],
        selectedPlaceIds: [],
        candidateCountBeforeFiltering: 0,
        candidateCountAfterFiltering: 0,
        candidateCountAfterCuration: 0,
        usedFallbackSelection: false,
        destinationResolutionSource: 'parsed_request' as const,
        destinationResolutionConfidence: 1,
        rejectedByQualityGate: [],
        rejectedByNoiseFilter: [],
        rejectedByDedup: [],
        rejectedBySelectionRules: [],
      },
    };

    const selected = curateDiscoveryPlaces({
      destination: {
        city: 'Berlin',
        lat: 52.52,
        lng: 13.405,
        confidence: 1,
        source: 'parsed_request',
      },
      queryType: 'broad_city_discovery',
      debug,
      candidates: [
        { placeId: '1', name: 'Mirador de Berlin', category: 'parks', formattedAddress: 'SV', photoUrls: ['a'], rating: 4.1, userRatingsTotal: 150, types: ['viewpoint'] },
        { placeId: '2', name: 'Berlin Cathedral (Berliner Dom)', category: 'nightlife', formattedAddress: 'Am Lustgarten 1', photoUrls: ['a'], rating: 4.8, userRatingsTotal: 12000, types: ['church'] },
        { placeId: '3', name: 'Independent Outlet Berlin', category: 'activity', formattedAddress: 'Berlin', photoUrls: ['a'], rating: 4.0, userRatingsTotal: 90, types: ['store'] },
        { placeId: '4', name: 'Brandenburg Gate', category: 'sights', formattedAddress: 'Pariser Platz', photoUrls: ['a'], rating: 4.8, userRatingsTotal: 15000, types: ['tourist_attraction'] },
        { placeId: '4', name: 'Brandenburg Gate', category: 'sights', formattedAddress: 'Pariser Platz', photoUrls: ['a'], rating: 4.4, userRatingsTotal: 3000, types: ['tourist_attraction'] },
      ],
    });

    expect(selected.some((place) => place.name.includes('Brandenburg Gate'))).toBe(true);
    expect(debug.payload.candidateCountBeforeFiltering).toBe(5);
    expect(debug.payload.rejectedByQualityGate.some((entry) => entry.reason === 'generic_city_label')).toBe(true);
    expect(debug.payload.rejectedByNoiseFilter.some((entry) => ['noise_filter', 'chain_brand', 'commercial_venue'].includes(entry.reason))).toBe(true);
    expect(debug.payload.rejectedByDedup.some((entry) => entry.reason === 'provider_duplicate')).toBe(true);
    expect(debug.payload.selectedBuckets.length).toBeGreaterThan(0);
  });

  it('PR 3 (C1): passing mode does not alter legacy routing when strict logic is not wired yet', () => {
    const baseOptions = {
      parsedRequest: {
        requestType: 'itinerary' as const,
        itinerary: { destinations: ['Asia'], days: 20 },
        confidence: 0.9,
        originalMessage: 'Quiero un viaje por Asia 20 días',
      },
      routeResult: {
        route: 'PLAN' as const,
        score: 0.2,
        dimensions: { destination: 0, dates: 0.3, passengers: 0.5, origin: 0.5, complexity: 0.5 },
        missingFields: ['dates'],
        inferredFields: [],
        reason: 'itinerary_request',
      },
      plannerState: null,
      hasPersistentContext: false,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
    };

    const legacy = resolveConversationTurn(baseOptions);
    const withAgency = resolveConversationTurn({ ...baseOptions, mode: 'agency' });
    const withPassenger = resolveConversationTurn({ ...baseOptions, mode: 'passenger' });

    expect(withAgency).toEqual(legacy);
    expect(withPassenger).toEqual(legacy);
    expect(legacy.executionBranch).toBe('standard_itinerary');
  });

  // TODO(1.1.x): These 3 tests are spec-first for companion routing in
  // resolveConversationTurn. Companion routing currently does NOT exist in
  // any layer: useMessageHandler accepts workspaceMode but explicitly ignores
  // it for routing (line 681: "route based on content, not workspace_mode").
  // resolveConversationTurn does not accept workspaceMode at all.
  // Fase 1.0/1.0.5 closed partial — companion routing was not implemented.
  // Recovered from stash during 1.1.b prerequisites verification.
  // See D14 in TECH_DEBT.md.
  describe.skip('companion mode routing', () => {
    it('companion mode: fallback routes to planner_agent with active planner', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: {
          requestType: 'combined',
          flights: {
            origin: 'BUE',
            destination: 'BCN',
            departureDate: '2026-09-10',
            adults: 2,
            children: 0,
          },
          hotels: {
            city: 'Barcelona',
            checkinDate: '2026-09-10',
            checkoutDate: '2026-09-20',
            adults: 2,
            children: 0,
          },
          confidence: 0.95,
          originalMessage: 'Buscame vuelo y hotel a Barcelona',
        },
        routeResult: {
          route: 'QUOTE',
          score: 0.9,
          dimensions: { destination: 1, dates: 1, passengers: 1, origin: 1, complexity: 0.5 },
          missingFields: [],
          inferredFields: [],
          reason: 'high_definition',
        },
        plannerState: { generationMeta: { isDraft: false } },
        hasPersistentContext: false,
        hasPreviousParsedRequest: false,
        recentCollectCount: 0,
        maxCollectTurns: 3,
        workspaceMode: 'companion',
      } as any);

      expect(resolution.executionBranch).toBe('planner_agent');
      expect(resolution.uiMeta.reason).toBe('companion_fallback');
    });

    it('companion mode: fallback routes to ask_minimal without planner', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: {
          requestType: 'combined',
          flights: {
            origin: 'BUE',
            destination: 'BCN',
            departureDate: '2026-09-10',
            adults: 2,
            children: 0,
          },
          hotels: {
            city: 'Barcelona',
            checkinDate: '2026-09-10',
            checkoutDate: '2026-09-20',
            adults: 2,
            children: 0,
          },
          confidence: 0.95,
          originalMessage: 'Buscame vuelo y hotel a Barcelona',
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
        hasPersistentContext: false,
        hasPreviousParsedRequest: false,
        recentCollectCount: 0,
        maxCollectTurns: 3,
        workspaceMode: 'companion',
      } as any);

      expect(resolution.executionBranch).toBe('ask_minimal');
      expect(resolution.responseMode).toBe('needs_input');
      expect(resolution.uiMeta.reason).toBe('companion_fallback');
    });

    it('standard mode: fallback unchanged when same input as companion test', () => {
      const resolution = resolveConversationTurn({
        parsedRequest: {
          requestType: 'combined',
          flights: {
            origin: 'BUE',
            destination: 'BCN',
            departureDate: '2026-09-10',
            adults: 2,
            children: 0,
          },
          hotels: {
            city: 'Barcelona',
            checkinDate: '2026-09-10',
            checkoutDate: '2026-09-20',
            adults: 2,
            children: 0,
          },
          confidence: 0.95,
          originalMessage: 'Buscame vuelo y hotel a Barcelona',
        },
        routeResult: {
          route: 'QUOTE',
          score: 0.9,
          dimensions: { destination: 1, dates: 1, passengers: 1, origin: 1, complexity: 0.5 },
          missingFields: [],
          inferredFields: [],
          reason: 'high_definition',
        },
        plannerState: { generationMeta: { isDraft: false } },
        hasPersistentContext: false,
        hasPreviousParsedRequest: false,
        recentCollectCount: 0,
        maxCollectTurns: 3,
        workspaceMode: 'standard',
      } as any);

      expect(resolution.executionBranch).toBe('standard_search');
      expect(resolution.responseMode).toBe('quote_or_search');
    });
  });
});
