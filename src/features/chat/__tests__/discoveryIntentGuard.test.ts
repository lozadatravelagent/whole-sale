/**
 * discoveryIntentGuard.test.ts
 * =============================================================================
 * Unit tests for the structural-pattern discovery-intent guard. Pure functions,
 * no mocks. The guard is a backstop for the worst-case fallback where the
 * LLM fails to detect a discovery query and the FE silently fabricates a
 * 7-day itinerary instead.
 * =============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  isDiscoveryQuery,
  extractCategoriesFromMessage,
  extractDestinationFromMessage,
} from '../services/discoveryIntentGuard';

describe('isDiscoveryQuery — positive cases', () => {
  it('matches "Qué restaurantes hay en Roma" (interrogative + category noun)', () => {
    const result = isDiscoveryQuery('Qué restaurantes hay en Roma');
    expect(result.isDiscovery).toBe(true);
    expect(result.reason).toBe('pattern_match');
  });

  it('matches "Dónde comer bien en Madrid" (vibe browse)', () => {
    const result = isDiscoveryQuery('Dónde comer bien en Madrid');
    expect(result.isDiscovery).toBe(true);
    expect(result.reason).toBe('vibe_browse');
  });

  it('matches "Recomendame museos en París" (browse verb + category noun)', () => {
    const result = isDiscoveryQuery('Recomendame museos en París');
    expect(result.isDiscovery).toBe(true);
    expect(result.reason).toBe('pattern_match');
  });

  it('matches "Quiero salir de noche en Buenos Aires" (vibe browse)', () => {
    const result = isDiscoveryQuery('Quiero salir de noche en Buenos Aires');
    expect(result.isDiscovery).toBe(true);
    expect(result.reason).toBe('vibe_browse');
  });
});

describe('isDiscoveryQuery — negative cases', () => {
  it('rejects "Itinerario de 5 días en Roma" (plan verb / duration present)', () => {
    const result = isDiscoveryQuery('Itinerario de 5 días en Roma');
    expect(result.isDiscovery).toBe(false);
    // "Itinerario" matches PLAN_VERB which is checked before DURATION_SIGNAL.
    expect(['plan_verb_present', 'duration_present']).toContain(result.reason);
  });

  it('rejects "Armame un viaje por Italia" (plan verb present)', () => {
    const result = isDiscoveryQuery('Armame un viaje por Italia');
    expect(result.isDiscovery).toBe(false);
    expect(result.reason).toBe('plan_verb_present');
  });

  it('rejects "Agregá el primero al día 2" (mutation verb)', () => {
    const result = isDiscoveryQuery('Agregá el primero al día 2');
    expect(result.isDiscovery).toBe(false);
    expect(result.reason).toBe('mutation_verb');
  });

  it('rejects "Cambiá los restaurantes del día 3" (mutation verb)', () => {
    const result = isDiscoveryQuery('Cambiá los restaurantes del día 3');
    expect(result.isDiscovery).toBe(false);
    expect(result.reason).toBe('mutation_verb');
  });

  it('rejects "Hola" (no_match)', () => {
    const result = isDiscoveryQuery('Hola');
    expect(result.isDiscovery).toBe(false);
    expect(result.reason).toBe('no_match');
  });

  it('rejects "Qué tal el clima" (no category noun)', () => {
    const result = isDiscoveryQuery('Qué tal el clima');
    expect(result.isDiscovery).toBe(false);
    expect(result.reason).toBe('no_match');
  });
});

describe('isDiscoveryQuery — defensive', () => {
  it('returns no_match for empty string', () => {
    expect(isDiscoveryQuery('').isDiscovery).toBe(false);
    expect(isDiscoveryQuery('').reason).toBe('no_match');
  });

  it('returns no_match for whitespace-only string', () => {
    expect(isDiscoveryQuery('   \n\t  ').isDiscovery).toBe(false);
  });

  it('returns no_match for null-like input without throwing', () => {
    // @ts-expect-error — intentional null input to verify defensive handling
    expect(isDiscoveryQuery(null).isDiscovery).toBe(false);
    // @ts-expect-error — intentional undefined input to verify defensive handling
    expect(isDiscoveryQuery(undefined).isDiscovery).toBe(false);
  });
});

describe('extractCategoriesFromMessage', () => {
  it('extracts "restaurant" from a restaurants question', () => {
    const cats = extractCategoriesFromMessage('Qué restaurantes hay en Roma');
    expect(cats).toContain('restaurant');
  });

  it('extracts "museum" from a museums question', () => {
    const cats = extractCategoriesFromMessage('Recomendame museos en París');
    expect(cats).toContain('museum');
  });

  it('extracts multiple categories from a multi-noun query', () => {
    const cats = extractCategoriesFromMessage('bares y cafés en Buenos Aires');
    expect(cats).toContain('bar');
    expect(cats).toContain('cafe');
  });

  it('falls back to "sights" when no category noun matches', () => {
    const cats = extractCategoriesFromMessage('algo interesante');
    expect(cats).toEqual(['sights']);
  });
});

describe('extractDestinationFromMessage', () => {
  it('extracts "Roma" via the "en <City>" pattern', () => {
    const dest = extractDestinationFromMessage('Qué restaurantes hay en Roma', null);
    expect(dest.city).toBe('Roma');
    expect(dest.country).toBeNull();
    expect(dest.lat).toBeNull();
    expect(dest.lng).toBeNull();
  });

  it('extracts "Buenos Aires" (multi-word) via the pattern', () => {
    const dest = extractDestinationFromMessage('mostrame bares en Buenos Aires', null);
    expect(dest.city).toBe('Buenos Aires');
  });

  it('falls back to first destination of active planner when message has no city', () => {
    const dest = extractDestinationFromMessage('mostrame los mejores', {
      destinations: [{ city: 'Madrid', country: 'España' }],
    });
    expect(dest.city).toBe('Madrid');
    expect(dest.country).toBe('España');
  });

  it('returns null city/country when no message city and no planner', () => {
    const dest = extractDestinationFromMessage('mostrame algo', null);
    expect(dest.city).toBeNull();
    expect(dest.country).toBeNull();
  });

  it('returns null city when planner has no destinations and message has none', () => {
    const dest = extractDestinationFromMessage('mostrame algo', { destinations: [] });
    expect(dest.city).toBeNull();
  });
});

describe('extended patterns — verb-question + bare-browse', () => {
  // VERB_QUESTION
  it('detects "qué comer en X"', () => {
    const r = isDiscoveryQuery('qué comer en Roma');
    expect(r.isDiscovery).toBe(true);
    expect(r.reason).toBe('pattern_match');
  });

  it('detects "qué hacer en X"', () => {
    expect(isDiscoveryQuery('qué hacer en Madrid').isDiscovery).toBe(true);
  });

  it('detects "qué visitar en X"', () => {
    expect(isDiscoveryQuery('qué visitar en París').isDiscovery).toBe(true);
  });

  it('detects "qué ver en X"', () => {
    expect(isDiscoveryQuery('qué ver en Lisboa').isDiscovery).toBe(true);
  });

  // BARE_BROWSE_LOCATION
  it('detects "restaurantes en X"', () => {
    const r = isDiscoveryQuery('restaurantes en Roma');
    expect(r.isDiscovery).toBe(true);
    expect(r.reason).toBe('pattern_match');
  });

  it('detects "actividades en X"', () => {
    expect(isDiscoveryQuery('actividades en Madrid').isDiscovery).toBe(true);
  });

  it('detects "bares cerca de X"', () => {
    expect(isDiscoveryQuery('bares cerca de Plaza Mayor').isDiscovery).toBe(true);
  });

  it('detects "cosas para hacer en X"', () => {
    expect(isDiscoveryQuery('cosas para hacer en Lisboa').isDiscovery).toBe(true);
  });

  // Anti-patterns still win
  it('does NOT trigger when duration is present (itinerary intent)', () => {
    const r = isDiscoveryQuery('5 días en Roma con restaurantes');
    expect(r.isDiscovery).toBe(false);
    expect(r.reason).toBe('duration_present');
  });

  it('does NOT trigger on mutation verb + category', () => {
    const r = isDiscoveryQuery('agregá restaurantes al día 2');
    expect(r.isDiscovery).toBe(false);
    expect(r.reason).toBe('mutation_verb');
  });

  it('does NOT trigger on plan verb + category', () => {
    const r = isDiscoveryQuery('armame un plan con restaurantes en Roma');
    expect(r.isDiscovery).toBe(false);
    expect(r.reason).toBe('plan_verb_present');
  });
});
