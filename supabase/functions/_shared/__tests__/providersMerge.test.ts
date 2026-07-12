import { describe, expect, it } from 'vitest';
import { mergeFlights, normalizeAirline, normalizeFlightAirlines } from '../providers/mergeFlights.ts';
import { mergeHotels } from '../providers/mergeHotels.ts';
import { parseEnvFlag } from '../providers/flags.ts';

describe('parseEnvFlag', () => {
  it('accepts truthy values', () => {
    expect(parseEnvFlag('true')).toBe(true);
    expect(parseEnvFlag('1')).toBe(true);
    expect(parseEnvFlag('YES')).toBe(true);
  });

  it('rejects falsey values', () => {
    expect(parseEnvFlag(undefined)).toBe(false);
    expect(parseEnvFlag('false')).toBe(false);
    expect(parseEnvFlag('')).toBe(false);
  });
});

describe('mergeFlights', () => {
  const base = (id: string, amount: number, provider: string, flightNumber = '100') => ({
    id,
    provider,
    price: { amount, currency: 'USD' },
    airline: { code: 'IB', name: 'Iberia' },
    legs: [
      {
        options: [
          {
            segments: [
              {
                airline: 'IB',
                flightNumber,
                departure: { airportCode: 'EZE', date: '2026-08-15', time: '22:00' },
                arrival: { airportCode: 'MAD', date: '2026-08-16', time: '14:00' },
              },
            ],
          },
        ],
      },
    ],
  });

  it('concatenates and sorts by price', () => {
    const result = mergeFlights([
      [base('s1', 900, 'STARLING')],
      [base('d1', 700, 'DELFOS', '200')],
    ]);
    expect(result.map((f) => f.id)).toEqual(['d1', 's1']);
  });

  it('dedupes same soft key at same price', () => {
    const result = mergeFlights([
      [base('s1', 800, 'STARLING')],
      [base('d1', 800, 'DELFOS')],
    ]);
    expect(result).toHaveLength(1);
  });

  it('keeps both when same route but material price diff', () => {
    const result = mergeFlights([
      [base('s1', 800, 'STARLING')],
      [base('d1', 950, 'DELFOS')],
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].price.amount).toBe(800);
  });

  it('respects cap', () => {
    const batch = Array.from({ length: 10 }, (_, i) =>
      base(`f${i}`, 100 + i, 'STARLING', String(100 + i)),
    );
    expect(mergeFlights([batch], { cap: 3 })).toHaveLength(3);
  });
});

describe('normalizeAirline', () => {
  it.each([
    ['JJ', 'LATAM Airlines Brasil'],
    ['XL', 'LATAM Airlines Ecuador'],
    ['LA', 'LATAM Airlines'],
    ['CM', 'Copa Airlines'],
  ])('normalizes %s to its commercial name', (code, name) => {
    expect(normalizeAirline({ code, name: code })).toEqual({ code, name });
  });

  it('preserves a valid provider name', () => {
    expect(normalizeAirline({ code: 'AA', name: 'American Airlines' })).toEqual({
      code: 'AA',
      name: 'American Airlines',
    });
  });

  it('falls back safely for an unknown code', () => {
    expect(normalizeAirline({ code: 'ZZ', name: 'ZZ' })).toEqual({ code: 'ZZ', name: 'ZZ' });
    expect(normalizeAirline({ code: 'ZZ' })).toEqual({ code: 'ZZ', name: 'ZZ' });
  });

  it('trims and uppercases codes from airline.code or airline.name', () => {
    expect(normalizeAirline({ code: ' jj ', name: ' jj ' })).toEqual({
      code: 'JJ',
      name: 'LATAM Airlines Brasil',
    });
    expect(normalizeAirline({ name: ' cm ' })).toEqual({ code: 'CM', name: 'Copa Airlines' });
  });

  it('normalizes flight items without changing their other fields', () => {
    expect(normalizeFlightAirlines([{ id: 'f1', airline: { code: ' la ', name: 'LA' } }])).toEqual([
      { id: 'f1', airline: { code: 'LA', name: 'LATAM Airlines' } },
    ]);
  });
});

describe('mergeHotels', () => {
  const hotel = (id: string, name: string, price: number, provider: string) => ({
    id,
    unique_id: id,
    name,
    check_in: '2026-08-15',
    check_out: '2026-08-20',
    provider,
    rooms: [{ total_price: price, currency: 'USD' }],
  });

  it('sorts by min room price', () => {
    const result = mergeHotels([
      [hotel('e1', 'Riu Cancun', 500, 'EUROVIPS')],
      [hotel('d1', 'Iberostar', 400, 'DELFOS')],
    ]);
    expect(result[0].id).toBe('d1');
  });

  it('dedupes same name+dates at same price', () => {
    const result = mergeHotels([
      [hotel('e1', 'Hotel Ejemplo', 450, 'EUROVIPS')],
      [hotel('d1', 'Hotel Ejemplo', 450, 'DELFOS')],
    ]);
    expect(result).toHaveLength(1);
  });

  it('keeps different providers when prices differ', () => {
    const result = mergeHotels([
      [hotel('e1', 'Hotel Ejemplo', 400, 'EUROVIPS')],
      [hotel('d1', 'Hotel Ejemplo', 550, 'DELFOS')],
    ]);
    expect(result).toHaveLength(2);
  });
});
