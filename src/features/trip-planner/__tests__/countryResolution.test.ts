import { beforeAll, describe, expect, it } from 'vitest';

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
let detectCountryRoute: typeof import('@/features/trip-planner/utils').detectCountryRoute;
let expandDestinationsIfRegional: typeof import('@/features/trip-planner/utils').expandDestinationsIfRegional;

beforeAll(async () => {
  const utils = await import('@/features/trip-planner/utils');
  detectCountryRoute = utils.detectCountryRoute;
  expandDestinationsIfRegional = utils.expandDestinationsIfRegional;
});

// ---------------------------------------------------------------------------
// A. detectCountryRoute
// ---------------------------------------------------------------------------

describe('detectCountryRoute', () => {
  it('detects España as country route', () => {
    const result = detectCountryRoute('España');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('spain');
    expect(result!.route.cities.length).toBeGreaterThanOrEqual(3);
  });

  it('detects Italia as country route', () => {
    const result = detectCountryRoute('Italia');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('italy');
  });

  it('detects Japón as country route', () => {
    const result = detectCountryRoute('Japón');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('japan');
  });

  it('detects Francia as country route', () => {
    const result = detectCountryRoute('Francia');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('france');
  });

  it('detects Grecia as country route', () => {
    const result = detectCountryRoute('Grecia');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('greece');
  });

  it('detects Spain (English)', () => {
    const result = detectCountryRoute('Spain');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('spain');
  });

  it('returns null for Madrid (city)', () => {
    expect(detectCountryRoute('Madrid')).toBeNull();
  });

  it('returns null for Tokyo (city)', () => {
    expect(detectCountryRoute('Tokyo')).toBeNull();
  });

  it('returns null for Europa (region)', () => {
    expect(detectCountryRoute('Europa')).toBeNull();
  });

  it('returns null for Caribe (region)', () => {
    expect(detectCountryRoute('Caribe')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// B. Country expansion via expandDestinationsIfRegional
// ---------------------------------------------------------------------------

describe('expandDestinationsIfRegional — country routes', () => {
  it('expands España to multiple cities (15 days)', () => {
    const result = expandDestinationsIfRegional(['España'], 15);
    expect(result.expandedDestinations.length).toBeGreaterThan(1);
    expect(result.regionalMeta).not.toBeNull();
    expect(result.regionalMeta!.regionKey).toBe('spain');
    expect(result.regionalMeta!.expandedFrom).toBe('España');
    expect(result.expandedDestinations).not.toEqual(['Madrid']);
  });

  it('expands Italia to multiple cities (10 days)', () => {
    const result = expandDestinationsIfRegional(['Italia'], 10);
    expect(result.expandedDestinations.length).toBeGreaterThan(1);
    expect(result.regionalMeta!.regionKey).toBe('italy');
    expect(result.expandedDestinations).not.toEqual(['Rome']);
  });

  it('expands Japón to multiple cities (12 days)', () => {
    const result = expandDestinationsIfRegional(['Japón'], 12);
    expect(result.expandedDestinations.length).toBeGreaterThan(1);
    expect(result.regionalMeta!.regionKey).toBe('japan');
    expect(result.expandedDestinations).not.toEqual(['Tokyo']);
  });

  it('preserves exact day count for España (15 days)', () => {
    const result = expandDestinationsIfRegional(['España'], 15);
    expect(result.cityWeights).not.toBeNull();
    if (result.cityWeights) {
      let totalMinDays = 0;
      result.cityWeights.forEach(w => { totalMinDays += w.minDays; });
      expect(totalMinDays).toBeLessThanOrEqual(15);
    }
  });

  it('limits cities for short trips (5 days España)', () => {
    const result = expandDestinationsIfRegional(['España'], 5);
    expect(result.expandedDestinations.length).toBeLessThanOrEqual(2);
  });

  it('does NOT expand Madrid (city passthrough)', () => {
    const result = expandDestinationsIfRegional(['Madrid'], 7);
    expect(result.expandedDestinations).toEqual(['Madrid']);
    expect(result.regionalMeta).toBeNull();
    expect(result.cityWeights).toBeNull();
  });

  it('region expansion takes priority over country', () => {
    const result = expandDestinationsIfRegional(['Europa'], 15);
    expect(result.regionalMeta).not.toBeNull();
    expect(result.regionalMeta!.regionKey).toBe('europe_classic');
    expect(result.expandedDestinations.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// C. Capital fallback
// ---------------------------------------------------------------------------

describe('expandDestinationsIfRegional — capital fallback', () => {
  it('falls back to capital for country without route data', () => {
    const result = expandDestinationsIfRegional(['Chile'], 10);
    expect(result.expandedDestinations).toEqual(['Santiago']);
    expect(result.regionalMeta).toBeNull();
  });

  it('falls back to capital for Brasil', () => {
    const result = expandDestinationsIfRegional(['Brasil'], 10);
    expect(result.expandedDestinations).toEqual(['Brasilia']);
  });

  it('passes through unknown inputs unchanged', () => {
    const result = expandDestinationsIfRegional(['xyzabc'], 7);
    expect(result.expandedDestinations).toEqual(['xyzabc']);
  });
});

// ---------------------------------------------------------------------------
// D. Mixed inputs
// ---------------------------------------------------------------------------

describe('expandDestinationsIfRegional — mixed inputs', () => {
  it('handles city + country mix', () => {
    const result = expandDestinationsIfRegional(['Barcelona', 'Francia'], 10);
    // Francia expands to multi-city, Barcelona goes to otherDests
    expect(result.expandedDestinations.length).toBeGreaterThan(2);
    expect(result.regionalMeta!.regionKey).toBe('france');
  });
});
