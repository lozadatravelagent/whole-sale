import { describe, expect, it } from 'vitest';
import { mergeFlights } from '../providers/mergeFlights';
import { mergeHotels } from '../providers/mergeHotels';

describe('client mergeFlights', () => {
  it('sorts by price', () => {
    const result = mergeFlights([
      [{ id: 'a', provider: 'STARLING', price: { amount: 900 }, airline: { code: 'AA' }, legs: [] }],
      [{ id: 'b', provider: 'DELFOS', price: { amount: 500 }, airline: { code: 'IB' }, legs: [] }],
    ]);
    expect(result[0].id).toBe('b');
  });
});

describe('client mergeHotels', () => {
  it('sorts by min room price', () => {
    const result = mergeHotels([
      [{
        id: 'a',
        name: 'Hotel A',
        check_in: '2026-08-01',
        check_out: '2026-08-05',
        provider: 'EUROVIPS',
        rooms: [{ total_price: 800, currency: 'USD' }],
      }],
      [{
        id: 'b',
        name: 'Hotel B',
        check_in: '2026-08-01',
        check_out: '2026-08-05',
        provider: 'DELFOS',
        rooms: [{ total_price: 300, currency: 'USD' }],
      }],
    ]);
    expect(result[0].id).toBe('b');
  });
});
