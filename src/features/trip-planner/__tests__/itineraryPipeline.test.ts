import { describe, it, expect } from 'vitest';
import {
  isGenericPlaceholder,
  normalizeRecommendedPlaces,
  buildCanonicalResultFromStandard,
  buildCanonicalResultFromAgent,
  buildCanonicalMeta,
  resolveRenderPolicy,
  buildTurnContextState,
  RESPONSE_MODE_RENDER_POLICY,
} from '@/features/chat/services/itineraryPipeline';
import type { ConversationTurnResolution } from '@/features/chat/services/conversationOrchestrator';
import type { TripPlannerState } from '@/features/trip-planner/types';

// ── Fixtures ──

const MOCK_TURN: ConversationTurnResolution = {
  executionBranch: 'standard_itinerary',
  responseMode: 'proposal_first_plan',
  normalizedMissingFields: [],
  messageType: 'trip_planner',
  shouldUsePlannerAgent: false,
  shouldUseStandardItinerary: true,
  shouldAskMinimalQuestion: false,
  uiMeta: { route: 'PLAN', reason: 'test', firstPlanHandledAs: 'standard_itinerary' },
};

const MOCK_ROUTE = { route: 'PLAN', score: 1, reason: 'test', inferredFields: [] as string[] };

const MOCK_PLANNER_DATA = {
  id: 'test',
  title: 'Test Trip',
  summary: 'Test',
  days: 5,
  destinations: ['Roma'],
  segments: [{
    id: 'seg-1',
    city: 'Roma',
    order: 0,
    nights: 5,
    contentStatus: 'ready' as const,
    realPlacesStatus: 'idle' as const,
    days: [{
      id: 'd1',
      dayNumber: 1,
      city: 'Roma',
      title: 'Day 1',
      morning: [{ id: 'a1', title: 'Coliseo', category: 'Historia', description: 'Anfiteatro romano' }],
      afternoon: [{ id: 'a2', title: 'Paseo por Trastevere', category: 'Barrio' }],
      evening: [{ id: 'a3', title: 'Cena tranquila en zona centro', category: 'Comida' }],
      restaurants: [{ id: 'r1', name: 'Da Enzo', type: 'Trattoria' }],
    }],
    hotelPlan: { city: 'Roma', searchStatus: 'idle' as const, hotelRecommendations: [] },
  }],
  interests: [],
  constraints: [],
  generalTips: [],
  travelers: { adults: 2, children: 0, infants: 0 },
  generationMeta: { source: 'chat' as const, updatedAt: '', version: 1 },
} as unknown as TripPlannerState;

// ── isGenericPlaceholder ──

describe('isGenericPlaceholder', () => {
  it('filters known generic prefixes (ES)', () => {
    expect(isGenericPlaceholder('Paseo por el centro')).toBe(true);
    expect(isGenericPlaceholder('Desayuno en el hotel')).toBe(true);
    expect(isGenericPlaceholder('Tarde libre')).toBe(true);
    expect(isGenericPlaceholder('Cena tranquila en zona')).toBe(true);
    expect(isGenericPlaceholder('Traslado al aeropuerto')).toBe(true);
  });

  it('filters known generic prefixes (EN)', () => {
    expect(isGenericPlaceholder('Walking tour of downtown')).toBe(true);
    expect(isGenericPlaceholder('Free time')).toBe(true);
    expect(isGenericPlaceholder('Transfer to airport')).toBe(true);
    expect(isGenericPlaceholder('Breakfast at the hotel')).toBe(true);
  });

  it('keeps real place names', () => {
    expect(isGenericPlaceholder('Coliseo')).toBe(false);
    expect(isGenericPlaceholder('Museo Vaticano')).toBe(false);
    expect(isGenericPlaceholder('Paseo del Prado')).toBe(false);
    expect(isGenericPlaceholder('Da Enzo')).toBe(false);
    expect(isGenericPlaceholder('Fontana di Trevi')).toBe(false);
    expect(isGenericPlaceholder('Trattoria Da Mario')).toBe(false);
  });

  it('rejects very short names', () => {
    expect(isGenericPlaceholder('abc')).toBe(true);
    expect(isGenericPlaceholder('')).toBe(true);
    expect(isGenericPlaceholder('  ')).toBe(true);
  });
});

// ── normalizeRecommendedPlaces ──

describe('normalizeRecommendedPlaces', () => {
  it('filters generics and deduplicates', () => {
    const raw = [
      { name: 'Coliseo', city: 'Roma', category: 'Historia' },
      { name: 'Paseo por el centro', city: 'Roma', category: 'Barrio' },
      { name: 'Coliseo', city: 'Roma', category: 'Historia' },
      { name: 'Fontana di Trevi', city: 'Roma', category: 'Monumento' },
    ];
    const result = normalizeRecommendedPlaces(raw);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Coliseo');
    expect(result[1].name).toBe('Fontana di Trevi');
  });

  it('respects maxCount', () => {
    const raw = Array.from({ length: 20 }, (_, i) => ({
      name: `Real Place ${i}`,
      city: 'Roma',
      category: 'Actividad',
    }));
    expect(normalizeRecommendedPlaces(raw, 3)).toHaveLength(3);
  });

  it('normalizes category to title case', () => {
    const raw = [{ name: 'Coliseo', city: 'Roma', category: 'historia antigua' }];
    const result = normalizeRecommendedPlaces(raw);
    expect(result[0].category).toBe('Historia Antigua');
  });
});

// ── Convergence: both branches produce same canonical shape ──

describe('canonical result convergence', () => {
  it('standard branch meta contains plannerData', () => {
    const result = buildCanonicalResultFromStandard({
      response: 'Trip plan',
      structuredData: { itineraryData: { raw: true }, plannerData: MOCK_PLANNER_DATA, messageType: 'trip_planner' },
      conversationTurn: MOCK_TURN,
      routeResult: MOCK_ROUTE,
      requestText: '5 dias en Roma',
    });
    const meta = buildCanonicalMeta(result);

    expect(meta.source).toBe('AI_PARSER + EUROVIPS');
    expect(meta.plannerData).toBeDefined();
    expect(meta.messageType).toBe('trip_planner');
    expect(meta.conversationTurn).toBeDefined();
    expect(meta.emiliaRoute).toBeDefined();
    expect(meta.requestText).toBe('5 dias en Roma');
  });

  it('agent branch meta also contains plannerData', () => {
    const agentTurn = { ...MOCK_TURN, executionBranch: 'planner_agent' as const, shouldUsePlannerAgent: true };
    const result = buildCanonicalResultFromAgent({
      response: 'Trip plan',
      rawStructuredData: {
        rawItinerary: MOCK_PLANNER_DATA,
        recommendedPlaces: [{ name: 'Coliseo', segmentCity: 'Roma', category: 'Historia', suggestedSlot: 'morning' }],
      },
      plannerData: MOCK_PLANNER_DATA,
      flights: [],
      hotels: [],
      conversationTurn: agentTurn,
    });
    const meta = buildCanonicalMeta(result);

    expect(meta.source).toBe('planner-agent');
    expect(meta.plannerData).toBeDefined();
    expect(meta.messageType).toBe('trip_planner');
    expect(meta.conversationTurn).toBeDefined();
    expect(meta.recommendedPlaces).toBeDefined();
  });

  it('both branches include same required meta keys', () => {
    const stdResult = buildCanonicalResultFromStandard({
      response: 'test',
      structuredData: { plannerData: MOCK_PLANNER_DATA, messageType: 'trip_planner' },
      conversationTurn: MOCK_TURN,
      routeResult: MOCK_ROUTE,
      requestText: 'test',
    });
    const agentResult = buildCanonicalResultFromAgent({
      response: 'test',
      rawStructuredData: { rawItinerary: MOCK_PLANNER_DATA },
      plannerData: MOCK_PLANNER_DATA,
      flights: [],
      hotels: [],
      conversationTurn: { ...MOCK_TURN, executionBranch: 'planner_agent' as const },
    });

    const stdMeta = buildCanonicalMeta(stdResult);
    const agentMeta = buildCanonicalMeta(agentResult);

    // Both must have these keys
    const requiredKeys = ['source', 'messageType', 'responseMode', 'plannerData', 'conversationTurn'];
    for (const key of requiredKeys) {
      expect(stdMeta).toHaveProperty(key);
      expect(agentMeta).toHaveProperty(key);
    }
  });

  it('generic places filtered from standard branch recommendedPlaces', () => {
    const result = buildCanonicalResultFromStandard({
      response: 'test',
      structuredData: { plannerData: MOCK_PLANNER_DATA, messageType: 'trip_planner' },
      conversationTurn: MOCK_TURN,
      routeResult: MOCK_ROUTE,
      requestText: 'test',
    });

    // "Paseo por Trastevere" and "Cena tranquila en zona centro" should be filtered
    const names = result.recommendedPlaces.map(p => p.name);
    expect(names).not.toContain('Paseo por Trastevere');
    expect(names).not.toContain('Cena tranquila en zona centro');
    // "Coliseo" and "Da Enzo" should remain
    expect(names).toContain('Coliseo');
    expect(names).toContain('Da Enzo');
  });
});

// ── Render policy ──

describe('RESPONSE_MODE_RENDER_POLICY', () => {
  it('covers all defined modes', () => {
    const modes = ['proposal_first_plan', 'show_places', 'needs_input', 'quote_or_search', 'standard'] as const;
    for (const mode of modes) {
      expect(RESPONSE_MODE_RENDER_POLICY[mode]).toBeDefined();
      expect(typeof RESPONSE_MODE_RENDER_POLICY[mode].showPlannerCta).toBe('boolean');
      expect(typeof RESPONSE_MODE_RENDER_POLICY[mode].showRecommendedPlaces).toBe('boolean');
      expect(typeof RESPONSE_MODE_RENDER_POLICY[mode].showCombinedCards).toBe('boolean');
      expect(typeof RESPONSE_MODE_RENDER_POLICY[mode].showGaps).toBe('boolean');
    }
  });

  it('proposal_first_plan shows planner CTA but hides standalone places and cards', () => {
    const policy = RESPONSE_MODE_RENDER_POLICY.proposal_first_plan;
    expect(policy.showPlannerCta).toBe(true);
    expect(policy.showRecommendedPlaces).toBe(false);
    expect(policy.showCombinedCards).toBe(false);
  });

  it('show_places shows recommended places but no planner CTA', () => {
    const policy = RESPONSE_MODE_RENDER_POLICY.show_places;
    expect(policy.showPlannerCta).toBe(false);
    expect(policy.showRecommendedPlaces).toBe(true);
  });
});

// ── resolveRenderPolicy ──

describe('resolveRenderPolicy', () => {
  it('returns correct policy for known modes', () => {
    expect(resolveRenderPolicy('proposal_first_plan').showPlannerCta).toBe(true);
    expect(resolveRenderPolicy('show_places').showRecommendedPlaces).toBe(true);
    expect(resolveRenderPolicy('needs_input').showCombinedCards).toBe(false);
  });

  it('falls back to standard for unknown or null', () => {
    expect(resolveRenderPolicy(null)).toEqual(RESPONSE_MODE_RENDER_POLICY.standard);
    expect(resolveRenderPolicy(undefined)).toEqual(RESPONSE_MODE_RENDER_POLICY.standard);
    expect(resolveRenderPolicy('unknown_mode')).toEqual(RESPONSE_MODE_RENDER_POLICY.standard);
  });
});

// ── buildTurnContextState ──

describe('buildTurnContextState', () => {
  it('builds consistent structure with flights and hotels', () => {
    const state = buildTurnContextState({
      requestType: 'combined',
      flightsParams: { origin: 'BUE', destination: 'MAD', adults: 2 },
      hotelsParams: { city: 'Madrid', adults: 2 },
      flightsCount: 3,
      hotelsCount: 5,
      previousState: { turnNumber: 1, constraintsHistory: [] },
    }) as Record<string, unknown>;

    const lastSearch = state.lastSearch as Record<string, unknown>;
    expect(lastSearch.requestType).toBe('combined');
    expect(lastSearch.flightsParams).toBeDefined();
    expect(lastSearch.hotelsParams).toBeDefined();
    expect((lastSearch.resultsSummary as Record<string, unknown>).flightsCount).toBe(3);
    expect(state.turnNumber).toBe(2);
    expect(state.schemaVersion).toBe(1);
  });

  it('increments turnNumber from previous state', () => {
    const state = buildTurnContextState({
      requestType: 'flights',
      flightsCount: 1,
      hotelsCount: 0,
      previousState: { turnNumber: 5 },
    }) as Record<string, unknown>;
    expect(state.turnNumber).toBe(6);
  });

  it('preserves and appends constraints history', () => {
    const existing = [{ turn: 1, component: 'hotels', constraint: 'mealPlan', value: 'BB', timestamp: '2024-01-01' }];
    const state = buildTurnContextState({
      requestType: 'hotels',
      hotelsParams: { city: 'Roma' },
      flightsCount: 0,
      hotelsCount: 2,
      previousState: { turnNumber: 1, constraintsHistory: existing },
      newConstraints: [{ component: 'hotels', constraint: 'hotelChains', value: ['Marriott'] }],
    }) as Record<string, unknown>;

    const history = state.constraintsHistory as unknown[];
    expect(history).toHaveLength(2);
    expect((history[0] as Record<string, unknown>).constraint).toBe('mealPlan');
    expect((history[1] as Record<string, unknown>).constraint).toBe('hotelChains');
  });

  it('defaults turnNumber to 1 when no previous state', () => {
    const state = buildTurnContextState({
      requestType: 'flights',
      flightsCount: 0,
      hotelsCount: 0,
    }) as Record<string, unknown>;
    expect(state.turnNumber).toBe(1);
  });
});

// ── Phase 5: Render policy gates UI correctly ──

describe('render policy UI gates', () => {
  it('show_places hides planner CTA', () => {
    const policy = resolveRenderPolicy('show_places');
    expect(policy.showPlannerCta).toBe(false);
  });

  it('proposal_first_plan shows planner CTA', () => {
    const policy = resolveRenderPolicy('proposal_first_plan');
    expect(policy.showPlannerCta).toBe(true);
  });

  it('needs_input hides everything', () => {
    const policy = resolveRenderPolicy('needs_input');
    expect(policy.showPlannerCta).toBe(false);
    expect(policy.showRecommendedPlaces).toBe(false);
    expect(policy.showCombinedCards).toBe(false);
    expect(policy.showGaps).toBe(false);
  });

  it('standard mode shows combined cards only', () => {
    const policy = resolveRenderPolicy('standard');
    expect(policy.showPlannerCta).toBe(false);
    expect(policy.showCombinedCards).toBe(true);
  });
});
