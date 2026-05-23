import { describe, expect, it } from 'vitest';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { EmiliaState } from '@/features/chat/state/emiliaState';
import { resolveIntentElicitation } from '../intentElicitationLayer';

const STATE = {
  profile: {
    agency_id: 'agency-1',
    currency: 'USD',
    language: 'es',
    preferences: {},
  },
} as EmiliaState;

function parsed(overrides: Partial<ParsedTravelRequest>): ParsedTravelRequest {
  return {
    requestType: 'general',
    confidence: 0.7,
    originalMessage: 'test',
    ...overrides,
  } as ParsedTravelRequest;
}

describe('resolveIntentElicitation', () => {
  it('executes when an agency request already has structured search payload', () => {
    const result = resolveIntentElicitation(
      parsed({
        requestType: 'hotels',
        commercialIntent: {
          kind: 'hotel_search',
          agencyContext: true,
          confidence: 0.95,
        },
        travelerType: 'couple',
        hotels: {
          city: 'Cancún',
          checkinDate: '2026-07-01',
          checkoutDate: '2026-07-08',
          adults: 2,
          children: 0,
          roomType: 'double',
          mealPlan: 'all_inclusive',
        } as ParsedTravelRequest['hotels'],
      }),
      { emiliaState: STATE, language: 'es' },
    );

    expect(result.action).toBe('execute');
    expect(result.executableRequest?.requestType).toBe('hotels');
    expect(result.missingDecision).toEqual([]);
  });

  it('guides with destination chips for broad region + month agency intent', () => {
    const result = resolveIntentElicitation(
      parsed({
        requestType: 'missing_info_request',
        commercialIntent: {
          kind: 'package_search',
          agencyContext: true,
          confidence: 0.86,
        },
        searchSeeds: {
          destination: 'Caribe',
          destinationKind: 'region',
          dateWindow: { kind: 'month', month: 'julio' },
          agencyLanguageSignals: ['cliente quiere'],
          softPreferences: ['playa'],
          missingDecision: ['destination', 'passengers'],
          productsImplied: ['package'],
          adults: null,
          children: null,
        },
      }),
      { emiliaState: STATE, language: 'es' },
    );

    expect(result.action).toBe('guide_with_chips');
    expect(result.message).toBe(
      'Perfecto. Entiendo búsqueda de playa en Caribe para julio. Para llevarlo a cotización, podemos arrancar por un destino concreto.',
    );
    expect(result.pendingAction?.for).toBe('intent_elicitation');
    expect(result.pendingAction?.fields).toEqual(['destination', 'passengers']);
    expect(result.chips.map((chip) => chip.label)).toEqual([
      'Cancún',
      'Punta Cana',
      'Aruba',
      'Definir pasajeros',
    ]);
    expect(result.chips[0]).toMatchObject({
      behavior: 'autocomplete',
      expectedRequestType: 'combined',
      expectedProducts: ['package'],
    });
    expect(result.chips[0].prompt).toContain('paquete a Cancún en julio para 1 adulto');
  });

  it('guides when a concrete destination has soft preferences but no dates', () => {
    const result = resolveIntentElicitation(
      parsed({
        requestType: 'missing_info_request',
        commercialIntent: {
          kind: 'price_sensitive_search',
          agencyContext: true,
          confidence: 0.9,
        },
        travelerType: 'couple',
        searchSeeds: {
          destination: 'Punta Cana',
          destinationKind: 'city',
          dateWindow: { kind: 'missing' },
          agencyLanguageSignals: ['tengo una pareja'],
          softPreferences: ['hotel lindo', 'precio sensible'],
          missingDecision: ['dates'],
          travelerType: 'couple',
          budgetHint: 'mid',
          productsImplied: ['hotel'],
          adults: 2,
          children: 0,
        },
      }),
      { emiliaState: STATE, language: 'es' },
    );

    expect(result.action).toBe('guide_with_chips');
    expect(result.missingDecision).toEqual(['dates']);
    expect(result.chips.map((chip) => chip.label)).toContain('Usar 7 noches');
    expect(result.chips.map((chip) => chip.label)).toContain('Ver más económico');
  });

  it('does not intercept planner or place-discovery turns', () => {
    const itinerary = resolveIntentElicitation(
      parsed({
        requestType: 'itinerary',
        planIntent: true,
        commercialIntent: {
          kind: 'trip_planning',
          agencyContext: false,
          confidence: 0.95,
        },
        itinerary: { destinations: ['Italia'], days: 10 },
      }),
      { emiliaState: STATE, language: 'es' },
    );

    const discovery = resolveIntentElicitation(
      parsed({
        requestType: 'itinerary',
        commercialIntent: {
          kind: 'hotel_search',
          agencyContext: true,
          confidence: 0.8,
        },
        placeDiscoveryResult: { ok: true, places: [] },
      }),
      { emiliaState: STATE, language: 'es' },
    );

    expect(itinerary.action).toBe('ignore');
    expect(discovery.action).toBe('ignore');
  });
});
