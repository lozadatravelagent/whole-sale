import { describe, it, expect } from 'vitest';
import { buildRefinementChips } from '../refinementChipsBuilder';

// Mirrors the dedupe/slice contract buildSuggestedActions applies after merging.
describe('refinement chips merge contract', () => {
  it('produces refine-typed chips that sort after quote/flight by priority', () => {
    const refine = buildRefinementChips(
      { flights: { origin: 'EZE', destination: 'MAD', departureDate: '2026-07-01', tripType: 'one_way', adults: 1, children: 0, infants: 0 } },
      new Date('2026-05-16T00:00:00Z'),
      'es',
    );
    const merged = [
      { id: 'q', label: 'Cotizar', prompt: 'Cotizar', type: 'quote' as const, priority: 0 },
      ...refine,
    ].sort((a, b) => a.priority - b.priority).slice(0, 3);
    expect(merged[0].type).toBe('quote');
    expect(merged.some((c) => c.id === 'refine-roundtrip')).toBe(true);
  });
});
