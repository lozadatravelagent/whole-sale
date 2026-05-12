/**
 * Tests for the new copy branches of `formatHotelResponse`
 * — Phase 2 / sub-task C (exact-match-first hotel flow).
 *
 * Validates that each `responseMode` value produces the differentiated heading
 * spec'd in "reglas default" §10.1-10.2:
 *   - exact_match (1 result)              "Encontré <hotel> que pediste"
 *   - exact_match (N>1)                   "Encontré <hotel> y N opciones más en <city>"
 *   - alternatives_no_availability        "No había disponibilidad… Te muestro alternativas"
 *   - hotel_not_in_destination            "No encontré <hotel> en <city>… ¿querés cambiar?"
 *   - generic_search (default)            "X Hoteles Disponibles" (preserved)
 */

import { describe, it, expect } from 'vitest';

import { formatHotelResponse } from '../responseFormatters';
import type { LocalHotelData } from '@/types/external';

function makeHotel(name: string, city: string, price = 1000): LocalHotelData {
  return {
    name,
    city,
    nights: 7,
    check_in: '2026-07-10',
    check_out: '2026-07-17',
    rooms: [
      {
        type: 'DBL',
        description: 'Standard double room',
        total_price: price,
        currency: 'USD',
        meal_plan: 'all_inclusive',
        availability: 'available',
      } as unknown as LocalHotelData['rooms'][number],
    ],
  } as unknown as LocalHotelData;
}

describe('formatHotelResponse — exact_match copy', () => {
  it('renders the single-hotel exact-match heading when hotels.length === 1', () => {
    const hotels = [makeHotel('Riu Palace Aruba', 'Aruba')];
    const out = formatHotelResponse(hotels, 'es', {
      responseMode: 'exact_match',
      requestedHotelName: 'Riu Palace Aruba',
      requestedCity: 'Aruba',
    });

    expect(out).toContain('Riu Palace Aruba');
    // Heading uses "Encontré ... que pediste" — distinct from the generic copy.
    expect(out).toMatch(/Encontré.*Riu Palace Aruba.*que pediste/);
    // It must NOT be the generic heading.
    expect(out).not.toMatch(/Hoteles Disponibles/);
  });

  it('renders the multi-result exact-match heading when hotels.length > 1', () => {
    const hotels = [
      makeHotel('Riu Palace Aruba', 'Aruba', 1500),
      makeHotel('Tamarijn Aruba', 'Aruba', 800),
      makeHotel('Divi Aruba', 'Aruba', 900),
    ];
    const out = formatHotelResponse(hotels, 'es', {
      responseMode: 'exact_match',
      requestedHotelName: 'Riu Palace Aruba',
      requestedCity: 'Aruba',
    });

    expect(out).toContain('Riu Palace Aruba');
    // 3 hotels → "y 2 opciones más en Aruba"
    expect(out).toMatch(/Encontré.*Riu Palace Aruba.*y 2 opciones más en Aruba/);
  });
});

describe('formatHotelResponse — alternatives_no_availability copy', () => {
  it('renders the no-availability fallback heading with the requested hotel and alternative count', () => {
    const hotels = [
      makeHotel('Tamarijn Aruba', 'Aruba', 800),
      makeHotel('Divi Aruba', 'Aruba', 900),
    ];
    const out = formatHotelResponse(hotels, 'es', {
      responseMode: 'alternatives_no_availability',
      requestedHotelName: 'Riu Palace Aruba',
      requestedCity: 'Aruba',
    });

    expect(out).toContain('Riu Palace Aruba');
    expect(out).toMatch(/No había disponibilidad/);
    expect(out).toMatch(/2 alternativas similares en Aruba/);
  });
});

describe('formatHotelResponse — hotel_not_in_destination copy', () => {
  it('renders the recovery prompt with no list when the hotel is not in the destination', () => {
    const out = formatHotelResponse([], 'es', {
      responseMode: 'hotel_not_in_destination',
      requestedHotelName: 'Hotel Que No Existe',
      requestedCity: 'Aruba',
    });

    expect(out).toContain('Hotel Que No Existe');
    expect(out).toContain('Aruba');
    expect(out).toMatch(/¿/); // recovery question
  });
});

describe('formatHotelResponse — generic_search default (regression)', () => {
  it('preserves the original "X Hoteles Disponibles" heading when responseMode is omitted', () => {
    const hotels = [makeHotel('Some Hotel', 'Cancún')];
    const out = formatHotelResponse(hotels, 'es');

    // Original behavior — must not regress.
    expect(out).toMatch(/Hoteles Disponibles/);
    expect(out).toContain('Some Hotel');
  });
});
