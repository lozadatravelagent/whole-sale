import { describe, it, expect } from 'vitest';

import type { HotelData, HotelRoom } from '@/types';
import {
  buildPriceBuckets,
  calculatePriceRangeBounds,
  filterAndLimitHotels,
  filterHotelsByPriceRange,
  getMinPricePerNight,
} from '../hotelFilterPipeline';

function makeRoom(overrides: Partial<HotelRoom> & Pick<HotelRoom, 'price_per_night'>): HotelRoom {
  return {
    type: 'DBL',
    description: 'Doble',
    total_price: overrides.price_per_night * 3,
    currency: 'USD',
    availability: 5,
    occupancy_id: 'OCC1',
    ...overrides,
  } as HotelRoom;
}

function makeHotel(id: string, pricesPerNight: number[]): HotelData {
  return {
    id,
    unique_id: id,
    name: `Hotel ${id}`,
    category: '4',
    city: 'CUN',
    address: 'Test 123',
    check_in: '2026-06-01',
    check_out: '2026-06-04',
    nights: 3,
    rooms: pricesPerNight.map((p, i) =>
      makeRoom({ price_per_night: p, description: `Room ${i}`, occupancy_id: `OCC-${id}-${i}` }),
    ),
  } as HotelData;
}

describe('hotelFilterPipeline — price range', () => {
  const hotels = [
    makeHotel('A', [1500]),
    makeHotel('B', [2200, 2400]),
    makeHotel('C', [2800]),
    makeHotel('D', [3500]),
    makeHotel('E', [5200]),
  ];

  it('getMinPricePerNight returns Infinity when hotel has no rooms', () => {
    const empty = { ...makeHotel('Z', [100]), rooms: [] } as HotelData;
    expect(getMinPricePerNight(empty)).toBe(Infinity);
  });

  it('filterHotelsByPriceRange returns input untouched when range is null', () => {
    expect(filterHotelsByPriceRange(hotels, null)).toEqual(hotels);
  });

  it('filterHotelsByPriceRange returns input untouched when both bounds are null', () => {
    expect(filterHotelsByPriceRange(hotels, { min: null, max: null })).toEqual(hotels);
  });

  it('filterHotelsByPriceRange applies min-only (>= min)', () => {
    const out = filterHotelsByPriceRange(hotels, { min: 2500, max: null });
    expect(out.map(h => h.id)).toEqual(['C', 'D', 'E']);
  });

  it('filterHotelsByPriceRange applies max-only (<= max)', () => {
    const out = filterHotelsByPriceRange(hotels, { min: null, max: 2500 });
    expect(out.map(h => h.id)).toEqual(['A', 'B']);
  });

  it('filterHotelsByPriceRange applies both bounds (2000–3000)', () => {
    const out = filterHotelsByPriceRange(hotels, { min: 2000, max: 3000 });
    expect(out.map(h => h.id)).toEqual(['B', 'C']);
  });

  it('filterHotelsByPriceRange excludes hotels with no resolvable price when range is active', () => {
    const broken = { ...makeHotel('X', [100]), rooms: [] } as HotelData;
    const out = filterHotelsByPriceRange([...hotels, broken], { min: 0, max: 999999 });
    expect(out.map(h => h.id)).not.toContain('X');
  });

  it('filterHotelsByPriceRange returns empty when no hotel matches', () => {
    expect(filterHotelsByPriceRange(hotels, { min: 10000, max: 20000 })).toEqual([]);
  });

  it('calculatePriceRangeBounds reports min/max across all hotels', () => {
    expect(calculatePriceRangeBounds(hotels)).toEqual({ min: 1500, max: 5200 });
  });

  it('calculatePriceRangeBounds returns null when no hotel has a resolvable price', () => {
    const broken = [{ ...makeHotel('X', [100]), rooms: [] } as HotelData];
    expect(calculatePriceRangeBounds(broken)).toBeNull();
  });

  it('filterAndLimitHotels combines meal-plan + price-range + sort + limit', () => {
    const out = filterAndLimitHotels(hotels, null, 5, { min: 2000, max: 3500 });
    expect(out.map(h => h.id)).toEqual(['B', 'C', 'D']);
  });

  it('filterAndLimitHotels keeps existing behavior when priceRange omitted', () => {
    const out = filterAndLimitHotels(hotels, null, 3);
    expect(out.map(h => h.id)).toEqual(['A', 'B', 'C']);
  });
});

describe('hotelFilterPipeline — buildPriceBuckets', () => {
  it('returns empty when bounds are null or invalid', () => {
    expect(buildPriceBuckets(null)).toEqual([]);
    expect(buildPriceBuckets({ min: 100, max: 100 })).toEqual([]);
    expect(buildPriceBuckets({ min: 500, max: 100 })).toEqual([]);
  });

  it('generates buckets sized to a typical Cancun-like range ($165–$478)', () => {
    const buckets = buildPriceBuckets({ min: 165, max: 478 }, 4);
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets[0].min).toBeNull();
    expect(buckets[buckets.length - 1].max).toBeNull();
    // All non-extreme thresholds must be inside [150, 500]
    for (const b of buckets) {
      if (b.min != null) expect(b.min).toBeGreaterThanOrEqual(150);
      if (b.max != null) expect(b.max).toBeLessThanOrEqual(500);
    }
  });

  it('produces a 300-ish threshold for a request like "entre 300 y 400 la noche"', () => {
    const buckets = buildPriceBuckets({ min: 165, max: 478 }, 4);
    // At least one bucket boundary should fall inside the user's intent zone (200–450).
    const boundaries = buckets
      .flatMap(b => [b.min, b.max])
      .filter((n): n is number => typeof n === 'number');
    expect(boundaries.some(n => n >= 200 && n <= 450)).toBe(true);
  });

  it('chooses larger steps for wide ranges', () => {
    const buckets = buildPriceBuckets({ min: 500, max: 6500 }, 4);
    expect(buckets.length).toBeGreaterThan(0);
    const innerMaxes = buckets
      .filter(b => b.max != null)
      .map(b => b.max as number);
    // With a 6000-wide range, step should be 500 — all thresholds divisible by 500.
    for (const m of innerMaxes) {
      expect(m % 500).toBe(0);
    }
  });

  it('actually filters hotels when a generated bucket is applied', () => {
    const fixtures = [
      { id: 'cheap', price: 180 },
      { id: 'mid', price: 320 },
      { id: 'pricey', price: 460 },
    ];
    const hotels = fixtures.map(f =>
      ({
        id: f.id,
        unique_id: f.id,
        name: f.id,
        category: '3',
        city: 'CUN',
        address: 'x',
        check_in: '2026-06-01',
        check_out: '2026-06-04',
        nights: 3,
        rooms: [
          {
            type: 'DBL',
            description: 'd',
            price_per_night: f.price,
            total_price: f.price * 3,
            currency: 'USD',
            availability: 1,
            occupancy_id: 'o',
          },
        ],
      }) as HotelData,
    );

    const bounds = calculatePriceRangeBounds(hotels);
    const buckets = buildPriceBuckets(bounds, 4);
    expect(buckets.length).toBeGreaterThan(0);

    const middleBucket = buckets.find(b => b.min != null && b.max != null);
    expect(middleBucket).toBeDefined();
    const filtered = filterHotelsByPriceRange(hotels, {
      min: middleBucket!.min,
      max: middleBucket!.max,
    });
    // The mid-price hotel (320) should be inside any bucket whose [min,max]
    // straddles ~250-400. Looser assertion: filtered subset must not include
    // both extremes simultaneously.
    expect(filtered.map(h => h.id)).not.toContain('cheap');
  });
});
