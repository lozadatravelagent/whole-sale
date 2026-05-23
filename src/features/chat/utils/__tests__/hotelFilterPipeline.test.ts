import { describe, it, expect } from 'vitest';

import type { HotelData, HotelRoom } from '@/types';
import {
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
