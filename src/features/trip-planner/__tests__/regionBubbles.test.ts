import { describe, it, expect } from 'vitest';
import { expandDestinationsIfRegional } from '@/features/trip-planner/utils';

// Verifies that every region shown as a bubble expands to at least one concrete
// city (not the raw region name). The exact city depends on weight ordering.
describe('region expansion — all bubbles', () => {
  const regions = [
    'Europa',
    'Caribe',
    'Europa del Este',
    'Asia',
    'Sudeste Asiático',
    'Sudamérica',
    'Norteamérica',
    'Centroamérica',
    'Escandinavia',
    'Medio Oriente',
    'África',
    'Oceanía',
    'Patagonia',
    'Costa Oeste',
  ];

  for (const region of regions) {
    it(`${region} expands to a concrete city`, () => {
      const { expandedDestinations, regionalMeta } = expandDestinationsIfRegional([region], 10);
      expect(regionalMeta, `"${region}" should be recognised as a region`).not.toBeNull();
      expect(expandedDestinations.length, `"${region}" should expand to at least 1 city`).toBeGreaterThan(0);
      expect(expandedDestinations[0].toLowerCase()).not.toBe(region.toLowerCase());
    });
  }

  // Spot-check top city for highest-weight regions
  it('Europa → París as top city', () => {
    const { expandedDestinations } = expandDestinationsIfRegional(['Europa'], 10);
    expect(expandedDestinations[0]).toBe('París');
  });

  it('Caribe → Punta Cana as top city', () => {
    const { expandedDestinations } = expandDestinationsIfRegional(['Caribe'], 10);
    expect(expandedDestinations[0]).toBe('Punta Cana');
  });

  it('Europa del Este → Praga as top city', () => {
    const { expandedDestinations } = expandDestinationsIfRegional(['Europa del Este'], 10);
    expect(expandedDestinations[0]).toBe('Praga');
  });
});
