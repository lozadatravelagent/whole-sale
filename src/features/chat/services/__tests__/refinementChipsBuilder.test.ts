import { describe, it, expect } from 'vitest';
import { buildRefinementChips } from '../refinementChipsBuilder';
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
    expect(roundtrip!.prompt).toContain('2026-07-08');
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
    expect(pax.prompt).toContain('2026-07-01');
    expect(pax.prompt).toContain('2026-07-08');
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
      expect(chip.prompt).toContain('2026-07-01');
      expect(chip.prompt).toContain('2026-07-08');
      expect(chip.prompt).toContain('2 adultos');
      expect(chip.expectedRequestType).toBe('combined');
      expect(chip.expectedProducts).toEqual(['flight', 'hotel']);
      expect(chip.reasonCodes).toContain('autocomplete_chip_generated');
    }
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
