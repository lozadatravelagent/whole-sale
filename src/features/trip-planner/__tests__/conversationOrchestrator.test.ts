import { describe, expect, it } from 'vitest';
import {
  buildConversationalMissingInfoMessage,
  deriveConversationGaps,
  extractRecommendedPlacesFromMeta,
  formatDiscoveryResponse,
  resolveConversationTurn,
} from '@/features/chat/services/conversationOrchestrator';
import { curateDiscoveryPlaces } from '@/features/chat/services/discoveryService';

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
      queryType: 'broad',
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
      queryType: 'broad',
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
});
