import { describe, it, expect } from 'vitest';
import {
  buildPlannerHotelSearchSignature,
  buildPlannerTransportSearchSignature,
  normalizeLocationLabel,
} from '../helpers';

describe('normalizeLocationLabel', () => {
  it('lowercases', () => {
    expect(normalizeLocationLabel('MADRID')).toBe('madrid');
  });
  it('removes accents', () => {
    expect(normalizeLocationLabel('París')).toBe('paris');
  });
  it('trims whitespace', () => {
    expect(normalizeLocationLabel('  Roma  ')).toBe('roma');
  });
  it('normalizes São Paulo', () => {
    expect(normalizeLocationLabel('São Paulo')).toBe('sao paulo');
  });
});

describe('buildPlannerHotelSearchSignature', () => {
  const base = {
    city: 'Madrid',
    checkinDate: '2025-07-10',
    checkoutDate: '2025-07-17',
    adults: 2,
    children: 0,
    infants: 0,
  };

  it('same params → same signature', () => {
    expect(buildPlannerHotelSearchSignature(base))
      .toBe(buildPlannerHotelSearchSignature(base));
  });
  it('different city → different signature', () => {
    expect(buildPlannerHotelSearchSignature(base))
      .not.toBe(buildPlannerHotelSearchSignature({ ...base, city: 'París' }));
  });
  it('different dates → different signature', () => {
    expect(buildPlannerHotelSearchSignature(base))
      .not.toBe(buildPlannerHotelSearchSignature({ ...base, checkinDate: '2025-08-10' }));
  });
  it('different adults → different signature', () => {
    expect(buildPlannerHotelSearchSignature(base))
      .not.toBe(buildPlannerHotelSearchSignature({ ...base, adults: 3 }));
  });
  it('returns non-empty string', () => {
    const sig = buildPlannerHotelSearchSignature(base);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
  });
});

describe('buildPlannerTransportSearchSignature', () => {
  const base = {
    origin: 'Buenos Aires',
    destination: 'Madrid',
    departureDate: '2025-07-10',
    adults: 2,
    children: 0,
    infants: 0,
  };

  it('same params → same signature', () => {
    expect(buildPlannerTransportSearchSignature(base))
      .toBe(buildPlannerTransportSearchSignature(base));
  });
  it('different origin → different signature', () => {
    expect(buildPlannerTransportSearchSignature(base))
      .not.toBe(buildPlannerTransportSearchSignature({ ...base, origin: 'Córdoba' }));
  });
  it('different destination → different signature', () => {
    expect(buildPlannerTransportSearchSignature(base))
      .not.toBe(buildPlannerTransportSearchSignature({ ...base, destination: 'Barcelona' }));
  });
  it('different date → different signature', () => {
    expect(buildPlannerTransportSearchSignature(base))
      .not.toBe(buildPlannerTransportSearchSignature({ ...base, departureDate: '2025-08-01' }));
  });
});
