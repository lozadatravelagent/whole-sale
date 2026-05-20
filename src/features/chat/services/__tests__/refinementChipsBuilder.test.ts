import { describe, it, expect } from 'vitest';
import {
  buildRefinementChips,
  formatIsoDateToSpanish,
} from '../refinementChipsBuilder';
import { SEARCH_STAY_NIGHTS } from '@/services/searchDefaults';

const NOW = new Date('2026-05-16T00:00:00.000Z');

describe('buildRefinementChips', () => {
  it('returns [] when there is no flights nor hotels search', () => {
    expect(buildRefinementChips({}, NOW, 'es')).toEqual([]);
  });

  it('emits a round-trip chip only when the flight search is one-way', () => {
    const chips = buildRefinementChips(
      {
        flights: {
          origin: 'EZE', destination: 'MAD', departureDate: '2026-07-01',
          tripType: 'one_way', adults: 2, children: 0, infants: 0,
        },
      },
      NOW,
      'es',
    );
    const roundtrip = chips.find((c) => c.id === 'refine-roundtrip');
    expect(roundtrip).toBeTruthy();
    expect(SEARCH_STAY_NIGHTS).toBe(7);
    // Dates render in friendly Spanish; underlying ISO is preserved in `context`.
    expect(roundtrip!.prompt).toContain('1 de Julio');
    expect(roundtrip!.prompt).toContain('8 de Julio');
    expect(roundtrip!.prompt).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(roundtrip!.prompt).toContain('MAD');
    expect(roundtrip!.prompt).toContain('EZE');
    expect(roundtrip!.prompt).toContain('2 adultos');
    expect(roundtrip!.type).toBe('refine');
    expect(roundtrip!.behavior).toBe('autocomplete');
    expect(roundtrip!.intent).toBe('convert_to_round_trip');
    expect(roundtrip!.expectedRequestType).toBe('flights');
    expect(roundtrip!.expectedProducts).toEqual(['flight']);
    expect(roundtrip!.context).toMatchObject({
      product: 'flight',
      origin: 'EZE',
      destination: 'MAD',
      departureDate: '2026-07-01',
      returnDate: '2026-07-08',
    });
  });

  it('does NOT emit a round-trip chip when the flight is already round-trip', () => {
    const chips = buildRefinementChips(
      {
        flights: {
          origin: 'EZE', destination: 'MAD', departureDate: '2026-07-01',
          returnDate: '2026-07-10', tripType: 'round_trip',
          adults: 2, children: 0, infants: 0,
        },
      },
      NOW,
      'es',
    );
    expect(chips.find((c) => c.id === 'refine-roundtrip')).toBeUndefined();
  });

  it('emits passengers + duration + edit chips for a round-trip flight search', () => {
    const chips = buildRefinementChips(
      {
        flights: {
          origin: 'EZE', destination: 'MAD', departureDate: '2026-07-01',
          returnDate: '2026-07-08', tripType: 'round_trip',
          adults: 2, children: 1, infants: 0,
        },
      },
      NOW,
      'es',
    );
    const ids = chips.map((c) => c.id);
    expect(ids).toContain('refine-passengers');
    expect(ids).toContain('refine-duration');
    expect(ids).toContain('refine-search');
    const pax = chips.find((c) => c.id === 'refine-passengers')!;
    expect(pax.prompt).toContain('vuelo a MAD');
    expect(pax.prompt).toContain('1 de Julio');
    expect(pax.prompt).toContain('8 de Julio');
    expect(pax.prompt).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(pax.prompt).toContain('2 adultos');
    expect(pax.prompt).toContain('1 niño');
    expect(pax.intent).toBe('change_passengers');
    expect(pax.editableFields).toEqual(['passengers']);
  });

  it('uses hotel params (city + dates) when there is no flight search', () => {
    const chips = buildRefinementChips(
      {
        hotels: {
          city: 'Cancún', checkinDate: '2026-08-01', checkoutDate: '2026-08-06',
          adults: 2, children: 0, infants: 0,
        },
      },
      NOW,
      'es',
    );
    const ids = chips.map((c) => c.id);
    expect(ids).toContain('refine-passengers');
    expect(ids).toContain('refine-duration');
    expect(ids).toContain('refine-search');
    expect(ids).not.toContain('refine-roundtrip');
    expect(chips.find((c) => c.id === 'refine-search')!.prompt).toContain('Cancún');
    expect(chips.find((c) => c.id === 'refine-duration')!.prompt).toContain('hotel en Cancún');
    expect(chips.find((c) => c.id === 'refine-duration')!.reasonCodes).toContain('current_duration_5_nights');
    expect(chips.find((c) => c.id === 'refine-duration')!.expectedRequestType).toBe('hotels');
    expect(chips.find((c) => c.id === 'refine-duration')!.expectedProducts).toEqual(['hotel']);
  });

  it('emits complete autocomplete prompts and expected products for combined searches', () => {
    const chips = buildRefinementChips(
      {
        flights: {
          origin: 'EZE',
          destination: 'CUN',
          departureDate: '2026-07-01',
          returnDate: '2026-07-08',
          tripType: 'round_trip',
          adults: 2,
          children: 0,
          infants: 0,
        },
        hotels: {
          city: 'Cancún',
          checkinDate: '2026-07-01',
          checkoutDate: '2026-07-08',
          adults: 2,
          children: 0,
          infants: 0,
        },
      },
      NOW,
      'es',
    );

    for (const chip of chips) {
      expect(chip.behavior).toBe('autocomplete');
      expect(chip.prompt).toContain('vuelo y hotel a Cancún');
      expect(chip.prompt).toContain('1 de Julio');
      expect(chip.prompt).toContain('8 de Julio');
      expect(chip.prompt).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(chip.prompt).toContain('2 adultos');
      expect(chip.expectedRequestType).toBe('combined');
      expect(chip.expectedProducts).toEqual(['flight', 'hotel']);
      expect(chip.reasonCodes).toContain('autocomplete_chip_generated');
    }
  });

  it('preserves ISO dates in chip context even though the prompt is in Spanish (parser/API path is unaffected)', () => {
    const chips = buildRefinementChips(
      {
        flights: {
          origin: 'EZE', destination: 'MAD', departureDate: '2026-07-01',
          returnDate: '2026-07-08', tripType: 'round_trip',
          adults: 2, children: 0, infants: 0,
        },
      },
      NOW,
      'es',
    );
    for (const chip of chips) {
      // The chip's displayed text masks the raw dates …
      expect(chip.prompt).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      // … but the underlying context retains the canonical ISO form so any
      // downstream consumer (telemetry, deterministic fallbacks, etc.) keeps
      // working without re-parsing the Spanish phrase.
      const ctx = chip.context as Record<string, unknown>;
      if (ctx.departureDate) expect(ctx.departureDate).toBe('2026-07-01');
      if (ctx.returnDate) expect(ctx.returnDate).toBe('2026-07-08');
    }
  });

  it('omits the year when the search is in the same year as the reference date', () => {
    const chips = buildRefinementChips(
      {
        flights: {
          origin: 'EZE', destination: 'MAD', departureDate: '2026-07-01',
          returnDate: '2026-07-08', tripType: 'round_trip',
          adults: 1, children: 0, infants: 0,
        },
      },
      NOW, // 2026
      'es',
    );
    for (const chip of chips) {
      expect(chip.prompt).not.toContain('de 2026');
    }
  });

  it('includes the year when the search is in a different year from the reference date', () => {
    const chips = buildRefinementChips(
      {
        flights: {
          origin: 'EZE', destination: 'MAD', departureDate: '2027-07-01',
          returnDate: '2027-07-08', tripType: 'round_trip',
          adults: 1, children: 0, infants: 0,
        },
      },
      NOW, // 2026
      'es',
    );
    const pax = chips.find((c) => c.id === 'refine-passengers')!;
    expect(pax.prompt).toContain('1 de Julio de 2027');
    expect(pax.prompt).toContain('8 de Julio de 2027');
  });

  it('does NOT emit a round-trip chip when tripType is undefined (not explicitly one-way)', () => {
    const chips = buildRefinementChips(
      { flights: { origin: 'EZE', destination: 'MAD', departureDate: '2026-07-01', adults: 1, children: 0, infants: 0 } },
      NOW,
      'es',
    );
    expect(chips.find((c) => c.id === 'refine-roundtrip')).toBeUndefined();
    const ids = chips.map((c) => c.id);
    expect(ids).toContain('refine-passengers');
    expect(ids).toContain('refine-duration');
    expect(ids).toContain('refine-search');
  });
});

describe('formatIsoDateToSpanish', () => {
  const NOW = new Date('2026-05-16T00:00:00.000Z');

  it('formats an ISO date in the same year without a year suffix', () => {
    expect(formatIsoDateToSpanish('2026-05-23', NOW)).toBe('23 de Mayo');
  });

  it('formats every Spanish month name correctly', () => {
    expect(formatIsoDateToSpanish('2026-01-15', NOW)).toBe('15 de Enero');
    expect(formatIsoDateToSpanish('2026-08-01', NOW)).toBe('1 de Agosto');
    expect(formatIsoDateToSpanish('2026-12-31', NOW)).toBe('31 de Diciembre');
  });

  it('drops the leading zero on single-digit days', () => {
    expect(formatIsoDateToSpanish('2026-05-09', NOW)).toBe('9 de Mayo');
  });

  it('appends the year when the date is in a different year from the reference', () => {
    expect(formatIsoDateToSpanish('2027-05-23', NOW)).toBe('23 de Mayo de 2027');
    expect(formatIsoDateToSpanish('2025-12-31', NOW)).toBe(
      '31 de Diciembre de 2025',
    );
  });

  it('accepts an ISO datetime and uses the date portion', () => {
    expect(formatIsoDateToSpanish('2026-05-23T10:00:00Z', NOW)).toBe('23 de Mayo');
  });

  it('returns the original input unchanged when unparseable (defensive)', () => {
    expect(formatIsoDateToSpanish('not-a-date', NOW)).toBe('not-a-date');
    expect(formatIsoDateToSpanish('2026-13-01', NOW)).toBe('2026-13-01');
  });

  it('returns an empty string when the input is empty or nullish', () => {
    expect(formatIsoDateToSpanish('', NOW)).toBe('');
    expect(formatIsoDateToSpanish(undefined, NOW)).toBe('');
    expect(formatIsoDateToSpanish(null, NOW)).toBe('');
  });
});
