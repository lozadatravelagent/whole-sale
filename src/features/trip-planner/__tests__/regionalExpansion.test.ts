import { beforeAll, describe, expect, it } from 'vitest';
import type { TripPlannerState } from '@/features/trip-planner/types';
import regionalRoutesData from '@/data/regional_routes.json';

// Stub localStorage before any imports that trigger supabase client
beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };
  }
});

// Dynamic import to ensure localStorage stub is in place
let expandRegionalDestination: typeof import('@/features/trip-planner/utils').expandRegionalDestination;
let selectRegionalSubroute: typeof import('@/features/trip-planner/utils').selectRegionalSubroute;
let summarizePlannerForChat: typeof import('@/features/trip-planner/utils').summarizePlannerForChat;

beforeAll(async () => {
  const utils = await import('@/features/trip-planner/utils');
  expandRegionalDestination = utils.expandRegionalDestination;
  selectRegionalSubroute = utils.selectRegionalSubroute;
  summarizePlannerForChat = utils.summarizePlannerForChat;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const europeRoute = regionalRoutesData.europe_classic as any;

describe('selectRegionalSubroute', () => {
  it('selects max 3 cities for 10 days', () => {
    const result = selectRegionalSubroute(europeRoute, 10);
    expect(result.length).toBeLessThanOrEqual(3);
    const sum = result.reduce((s, c) => s + c.days, 0);
    expect(sum).toBe(10);
  });

  it('selects max 2 cities for 7 days', () => {
    const result = selectRegionalSubroute(europeRoute, 7);
    expect(result.length).toBeLessThanOrEqual(2);
    const sum = result.reduce((s, c) => s + c.days, 0);
    expect(sum).toBe(7);
  });

  it('selects 1 city for 5 days', () => {
    const result = selectRegionalSubroute(europeRoute, 5);
    expect(result.length).toBe(1);
    const sum = result.reduce((s, c) => s + c.days, 0);
    expect(sum).toBe(5);
  });

  it('selects cities by highest weight first', () => {
    const result = selectRegionalSubroute(europeRoute, 10);
    const topWeights = [...europeRoute.cities]
      .sort((a: any, b: any) => b.weight - a.weight)
      .slice(0, result.length)
      .map((c: any) => c.name);
    for (const city of result) {
      expect(topWeights).toContain(city.name);
    }
  });

  it('assigns at least 1 day per city', () => {
    const result = selectRegionalSubroute(europeRoute, 3);
    for (const city of result) {
      expect(city.days).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('expandRegionalDestination', () => {
  it('preserves user days for 10-day Europe request', () => {
    const result = expandRegionalDestination('europe_classic', 10);
    expect(result.expanded).toBe(true);
    expect(result.suggestedDays).toBe(10);
    expect(result.cities.length).toBeLessThanOrEqual(3);
    const sum = result.cities.reduce((s, c) => s + c.days, 0);
    expect(sum).toBe(10);
  });

  it('preserves user days for 7-day Europe request', () => {
    const result = expandRegionalDestination('europe_classic', 7);
    expect(result.suggestedDays).toBe(7);
    expect(result.cities.length).toBeLessThanOrEqual(2);
    const sum = result.cities.reduce((s, c) => s + c.days, 0);
    expect(sum).toBe(7);
  });

  it('uses all cities for 16-day Europe request (true minimum for all cities)', () => {
    const result = expandRegionalDestination('europe_classic', 16);
    expect(result.suggestedDays).toBe(16);
    expect(result.cities.length).toBe(5);
    const sum = result.cities.reduce((s, c) => s + c.days, 0);
    expect(sum).toBe(16);
  });

  it('uses subroute for 15-day request (below city min_days sum)', () => {
    // Route says min 15 but cities min_days sum to 16 — so 15 days gets subroute
    const result = expandRegionalDestination('europe_classic', 15);
    expect(result.suggestedDays).toBe(15);
    expect(result.cities.length).toBeLessThanOrEqual(4);
    const sum = result.cities.reduce((s, c) => s + c.days, 0);
    expect(sum).toBe(15);
  });

  it('caps at maxDays for very long requests', () => {
    const result = expandRegionalDestination('europe_classic', 30);
    expect(result.suggestedDays).toBe(30);
    const sum = result.cities.reduce((s, c) => s + c.days, 0);
    expect(sum).toBe(21); // maxDays for europe_classic
  });

  it('returns expanded false for unknown region', () => {
    const result = expandRegionalDestination('nonexistent', 10);
    expect(result.expanded).toBe(false);
    expect(result.suggestedDays).toBe(10);
  });
});

describe('summarizePlannerForChat', () => {
  const basePlannerState: TripPlannerState = {
    id: 'test',
    title: 'Test Trip',
    summary: 'Test summary',
    days: 10,
    isFlexibleDates: true,
    travelers: { adults: 2, children: 0, infants: 0 },
    interests: [],
    constraints: [],
    destinations: ['Madrid', 'París', 'Roma'],
    segments: [
      {
        id: 's1', city: 'Madrid', nights: 3, days: [],
        hotelPlan: { matchStatus: null, hotelRecommendations: [], searchSignature: null },
      },
      {
        id: 's2', city: 'París', nights: 4, days: [],
        hotelPlan: { matchStatus: null, hotelRecommendations: [], searchSignature: null },
      },
      {
        id: 's3', city: 'Roma', nights: 3, days: [],
        hotelPlan: { matchStatus: null, hotelRecommendations: [], searchSignature: null },
      },
    ] as any,
    notes: [],
    generalTips: [],
  } as any;

  it('does not contain "Ya te armé"', () => {
    const result = summarizePlannerForChat(basePlannerState);
    expect(result).not.toContain('Ya te armé');
  });

  it('does not contain "Estoy completando cada tramo"', () => {
    const result = summarizePlannerForChat(basePlannerState);
    expect(result).not.toContain('Estoy completando cada tramo');
  });

  it('does not contain "Ya te dejo encaminada"', () => {
    const result = summarizePlannerForChat(basePlannerState);
    expect(result).not.toContain('Ya te dejo encaminada');
  });

  it('uses proposal tone', () => {
    const result = summarizePlannerForChat(basePlannerState);
    expect(result).toContain('primera idea');
    expect(result).toContain('te propongo');
  });

  it('includes route proposal with day counts', () => {
    const result = summarizePlannerForChat(basePlannerState);
    expect(result).toContain('Madrid (3)');
    expect(result).toContain('París (4)');
    expect(result).toContain('Roma (3)');
  });
});

describe('slot label fallback', () => {
  it('returns Sugerido for undefined slot', () => {
    const slotLabel = (slot?: string) =>
      slot === 'morning' ? 'Mañana' : slot === 'afternoon' ? 'Tarde' : slot === 'evening' ? 'Noche' : 'Sugerido';
    expect(slotLabel(undefined)).toBe('Sugerido');
    expect(slotLabel('morning')).toBe('Mañana');
    expect(slotLabel('afternoon')).toBe('Tarde');
    expect(slotLabel('evening')).toBe('Noche');
  });
});

describe('recommended places filtering', () => {
  it('filters out places without city', () => {
    const places = [
      { name: 'Museo del Prado', segmentCity: 'Madrid', category: 'museo' },
      { name: 'Bad Place', category: 'museo' }, // no city at all
      { name: 'Colosseum', city: 'Roma', category: 'sights' }, // has city but not segmentCity
    ];

    const filtered = places.filter((rp: any) => rp.segmentCity || rp.city);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].name).toBe('Museo del Prado');
    expect(filtered[1].name).toBe('Colosseum');
  });
});
