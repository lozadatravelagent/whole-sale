/**
 * Empathic search opener — covers the "Respuestas esperadas" scenarios from
 * the product doc (sección "reglas default"). Each case asserts a substring
 * match (not exact byte parity) so wording can evolve without breaking the
 * contract: the test guards the EMPATHIC STRUCTURE (opener + intent + dates +
 * closing), not literal punctuation.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { buildSearchOpener } from '../emiliaSearchOpener';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';

const FIXED_NOW = new Date('2026-05-14T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// today + 3 days = 2026-05-17, +7 nights = 2026-05-24
const TODAY_PLUS_3 = '2026-05-17';
const TODAY_PLUS_10 = '2026-05-24';

function makeParsed(partial: Partial<ParsedTravelRequest>): ParsedTravelRequest {
  return {
    requestType: 'general',
    originalMessage: 'test',
    confidence: 0.9,
    ...partial,
  } as ParsedTravelRequest;
}

// ---------------------------------------------------------------------------
// §2.1 — Fecha sin mes ni fecha exacta
// ---------------------------------------------------------------------------

describe('buildSearchOpener — §2.1 sin fecha (today+3)', () => {
  it('hotel: "Busco hotel en Cancún desde dentro de 3 días por 7 noches. Si querés otra fecha, lo ajusto."', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      hotels: {
        city: 'Cancún',
        checkinDate: TODAY_PLUS_3,
        checkoutDate: TODAY_PLUS_10,
        checkinDateInferred: true,
        checkoutDateInferred: true,
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('Perfecto.');
    expect(out.text).toContain('Busco hotel en Cancún');
    expect(out.text).toContain('desde dentro de 3 días por 7 noches');
    // Hotel + pax inferred → closing offers to adjust pax/room.
    expect(out.text).toMatch(/ajusto\.?$/);
    expect(out.hadAssumptions).toBe(true);
  });

  it('vuelo unitario one-way: "Busco vuelo solo ida a Cancún ... Si querés, también puedo buscar ida y vuelta."', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: TODAY_PLUS_3,
        departureDateInferred: true,
        tripTypeInferred: true,
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('Busco vuelo solo ida a Cancún');
    expect(out.text).toContain('para 1 adulto');
    expect(out.text).toContain('saliendo desde Buenos Aires');
    expect(out.text).toMatch(/ida y vuelta/);
  });

  it('vuelo + hotel: "Busco vuelo y hotel a Cancún desde dentro de 3 días por 7 noches."', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: TODAY_PLUS_3,
        returnDate: TODAY_PLUS_10,
        departureDateInferred: true,
        returnDateInferred: true,
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: TODAY_PLUS_3,
        checkoutDate: TODAY_PLUS_10,
        checkinDateInferred: true,
        checkoutDateInferred: true,
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('Busco vuelo y hotel a Cancún');
    expect(out.text).toContain('desde dentro de 3 días por 7 noches');
  });
});

// ---------------------------------------------------------------------------
// §2.2 — Mes sin fecha exacta (day 1 → day 8)
// ---------------------------------------------------------------------------

describe('buildSearchOpener — §2.2 mes sin fecha exacta', () => {
  it('hotel en julio: "del 1 al 8 de julio"', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-08',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('Busco hotel en Cancún');
    expect(out.text).toContain('del 1 al 8 de julio');
  });

  it('vuelo+hotel en julio: combined con rango 1-8', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-01',
        returnDate: '2026-07-08',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-08',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('Busco vuelo y hotel a Cancún');
    expect(out.text).toContain('para 2 adultos');
    expect(out.text).toContain('del 1 al 8 de julio');
  });
});

// ---------------------------------------------------------------------------
// §2.5 — Fechas completas (respeta input, sin assumption)
// ---------------------------------------------------------------------------

describe('buildSearchOpener — §2.5 fechas completas', () => {
  it('"vuelo a Cancún del 10 al 17 de julio" → opener empático sin "Si querés otra fecha"', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-10',
        returnDate: '2026-07-17',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        tripType: 'round_trip',
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('Busco vuelo ida y vuelta a Cancún');
    expect(out.text).toContain('para 2 adultos');
    expect(out.text).toContain('del 10');
    expect(out.text).toContain('al 17');
    // No assumptions → no closing.
    expect(out.hadAssumptions).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §3 — Relativas (mañana / finde / semana / próximo mes)
// ---------------------------------------------------------------------------

describe('buildSearchOpener — §3 relativas', () => {
  it('§3.1 mañana / vuelo unitario one-way', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      relativeDateHint: 'tomorrow',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-05-15',
        adults: 1,
        adultsExplicit: false,
        children: 0,
        tripTypeInferred: true,
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('Busco vuelo solo ida a Cancún');
    expect(out.text).toContain('para mañana');
  });

  it('§3.2 este finde / hotel', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      relativeDateHint: 'this_weekend',
      hotels: {
        city: 'Mendoza',
        checkinDate: '2026-05-15',
        checkoutDate: '2026-05-17',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('Busco hotel en Mendoza');
    expect(out.text).toContain('del próximo viernes al domingo');
  });

  it('§3.3 semana que viene / vuelo+hotel', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      relativeDateHint: 'next_week',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Miami',
        departureDate: '2026-05-18',
        returnDate: '2026-05-25',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Miami',
        checkinDate: '2026-05-18',
        checkoutDate: '2026-05-25',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('Busco vuelo y hotel a Miami');
    expect(out.text).toContain('próximo lunes');
  });
});

// ---------------------------------------------------------------------------
// §5 — Pasajeros (pareja, familia sin edades)
// ---------------------------------------------------------------------------

describe('buildSearchOpener — §5/§6 pasajeros y habitación', () => {
  it('§5.4 pareja → "para 2 adultos, en habitación doble"', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      travelerType: 'couple',
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-08',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        roomType: 'double',
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('para 2 adultos');
    expect(out.text).toContain('en habitación doble');
  });

  it('§5.6 familia sin edades → "Tomo 4 personas para avanzar"', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      travelerType: 'family',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Orlando',
        departureDate: TODAY_PLUS_3,
        returnDate: TODAY_PLUS_10,
        departureDateInferred: true,
        returnDateInferred: true,
        adults: 2,
        adultsExplicit: true,
        children: 2,
      },
      hotels: {
        city: 'Orlando',
        checkinDate: TODAY_PLUS_3,
        checkoutDate: TODAY_PLUS_10,
        checkinDateInferred: true,
        checkoutDateInferred: true,
        adults: 2,
        adultsExplicit: true,
        children: 2,
        // No childrenAges → ambiguous family.
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toMatch(/Tomo 4 personas para avanzar/);
    expect(out.text).toMatch(/edades/i);
  });

  it('§6.2 habitación derivada por pax (3 personas → triple)', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-08',
        adults: 3,
        adultsExplicit: true,
        children: 0,
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('en habitación triple');
  });
});

// ---------------------------------------------------------------------------
// §9 — Multiproducto ordenado
// ---------------------------------------------------------------------------

describe('buildSearchOpener — §9 multiproducto ordenado', () => {
  it('§9.6 vuelos primero, después hotel → "Busco primero ... Después sumo ..."', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      productOrder: ['flight', 'hotel'],
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-01',
        returnDate: '2026-07-08',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-08',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        roomType: 'double',
        mealPlan: 'all_inclusive',
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('Busco primero vuelo a Cancún');
    expect(out.text).toContain('para 2 adultos');
    expect(out.text).toMatch(/Después sumo hotel all inclusive/);
    expect(out.text).toContain('en habitación doble');
  });

  it('§9.8 vuelo + hotel + traslado sin orden → incluye los tres productos', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Punta Cana',
        departureDate: TODAY_PLUS_3,
        returnDate: TODAY_PLUS_10,
        departureDateInferred: true,
        returnDateInferred: true,
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Punta Cana',
        checkinDate: TODAY_PLUS_3,
        checkoutDate: TODAY_PLUS_10,
        checkinDateInferred: true,
        checkoutDateInferred: true,
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      transfers: { included: true, type: 'in_out' },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('Punta Cana');
    expect(out.text).toContain('vuelo');
    expect(out.text).toContain('hotel');
    expect(out.text).toContain('traslado');
  });
});

// ---------------------------------------------------------------------------
// i18n trilingüe
// ---------------------------------------------------------------------------

describe('buildSearchOpener — trilingue (es/en/pt)', () => {
  const base = makeParsed({
    requestType: 'hotels',
    hotels: {
      city: 'Cancún',
      checkinDate: '2026-07-01',
      checkoutDate: '2026-07-08',
      adults: 1,
      adultsExplicit: false,
      children: 0,
    },
  });

  it('es: "Perfecto." + "Busco hotel"', () => {
    const out = buildSearchOpener(base, 'es');
    expect(out.text).toContain('Perfecto.');
    expect(out.text).toContain('Busco hotel en Cancún');
  });

  it('en: "Got it." + "I\'ll search a hotel"', () => {
    const out = buildSearchOpener(base, 'en');
    expect(out.text).toContain('Got it.');
    expect(out.text).toContain("I'll search a hotel in Cancún");
  });

  it('pt: "Perfeito." + "Busco hotel em"', () => {
    const out = buildSearchOpener(base, 'pt');
    expect(out.text).toContain('Perfeito.');
    expect(out.text).toContain('Busco hotel em Cancún');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('buildSearchOpener — edge cases', () => {
  it('no destination → empty text', () => {
    const out = buildSearchOpener(makeParsed({ requestType: 'general' }), 'es');
    expect(out.text).toBe('');
  });

  it('all defaults provided by user → opener without closing', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '2026-09-10',
        returnDate: '2026-09-18',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        tripType: 'round_trip',
      },
      hotels: {
        city: 'Madrid',
        checkinDate: '2026-09-10',
        checkoutDate: '2026-09-18',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        roomType: 'double',
      },
    });
    const out = buildSearchOpener(parsed, 'es');
    expect(out.text).toContain('Busco vuelo y hotel a Madrid');
    expect(out.text).toContain('para 2 adultos');
    expect(out.text).toContain('en habitación doble');
    expect(out.hadAssumptions).toBe(false);
  });
});
