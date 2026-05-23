/**
 * Phase 5 / sub-task B — proposedSearchBuilder tests.
 *
 * Reparse-validation strategy: assertion-based. We don't run the LLM parser
 * here (it's an edge function). Instead we (a) assert the submit text contains
 * every critical field that routeRequest's dimension scorers care about, and
 * (b) construct a minimal `ParsedTravelRequest` mirroring what the parser
 * WOULD produce from that text and run `routeRequest` to confirm score >= 0.75.
 */

import { describe, expect, it } from 'vitest';
import { buildProposedSearch, type SearchSeeds } from '../proposedSearchBuilder';
import { routeRequest } from '../routeRequest';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { EmiliaProfile } from '@/features/chat/state/emiliaState';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const FROZEN_NOW = new Date('2026-05-11T12:00:00.000Z');
// today + 3 = 2026-05-14, today + 10 = 2026-05-21 (UTC)
const EXPECTED_START = '2026-05-14';
const EXPECTED_END = '2026-05-21';

const PROFILE_WITH_GEO: EmiliaProfile = {
  agency_id: 'agency-1',
  currency: 'USD',
  default_origin_city: 'EZE',
  language: 'es',
  preferences: {},
};

function makeParsed(seeds: SearchSeeds): ParsedTravelRequest {
  return {
    requestType: 'general',
    confidence: 0.5,
    originalMessage: '',
    // searchSeeds is appended by the schema-agent — cast through to set it
    // without needing the schema landed first.
    ...({ searchSeeds: seeds } as unknown as object),
  } as ParsedTravelRequest;
}

// ---------------------------------------------------------------------------
// 1. Canonical case — couple + anniversary + premium + Riviera Maya
// ---------------------------------------------------------------------------

describe('buildProposedSearch — canonical anniversary case', () => {
  const seeds: SearchSeeds = {
    destination: 'Riviera Maya',
    travelerType: 'couple',
    budgetHint: 'premium',
    occasionHint: 'anniversary',
    productsImplied: ['flight', 'hotel'],
    adults: 2,
    children: 0,
  };

  it('produces principal label + exhaustive submit text in es', () => {
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    expect(result).not.toBeNull();
    expect(result!.principalChipLabel).toBe(
      'Buscar vuelo + hotel premium a Riviera Maya',
    );
    expect(result!.principalSubmitText).toContain('Riviera Maya');
    expect(result!.principalSubmitText).toContain(EXPECTED_START);
    expect(result!.principalSubmitText).toContain(EXPECTED_END);
    expect(result!.principalSubmitText).toContain('2 adulto');
    expect(result!.principalSubmitText).toContain('doble');
    expect(result!.principalSubmitText).toContain('vuelo y hotel');
    expect(result!.principalSubmitText).toContain('premium');
    expect(result!.principalSubmitText).toContain('EZE');
  });

  it('principal submit text reparses to a request that routeRequest scores >= 0.75 (QUOTE)', () => {
    // Mirror what the parser WOULD produce from the principal submit text:
    // requestType='combined', flights origin/destination/dates/adults filled,
    // hotels city/dates/adults filled, no family signal, complexity 1 (single
    // city). routeRequest dimensions:
    //   destination 1.0 * 0.30 +
    //   dates       1.0 * 0.25 +
    //   passengers  1.0 * 0.15 +  (adultsExplicit=true)
    //   origin      1.0 * 0.15 +
    //   complexity  1.0 * 0.15
    // = 1.0 → QUOTE.
    const reparsed: ParsedTravelRequest = {
      requestType: 'combined',
      confidence: 0.95,
      originalMessage: 'Buscar vuelo y hotel premium a Riviera Maya …',
      flights: {
        origin: 'EZE',
        destination: 'Riviera Maya',
        departureDate: EXPECTED_START,
        returnDate: EXPECTED_END,
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
      hotels: {
        city: 'Riviera Maya',
        checkinDate: EXPECTED_START,
        checkoutDate: EXPECTED_END,
        adults: 2,
        adultsExplicit: true,
        children: 0,
        roomType: 'double',
      },
      productOrder: ['flight', 'hotel'],
      quoteIntent: true,
    };
    const route = routeRequest(reparsed, null);
    expect(route.score).toBeGreaterThanOrEqual(0.75);
    expect(route.route).toBe('QUOTE');
  });

  it('emits the adults-only alternative chip for anniversary + hotel + couple', () => {
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    const adultsOnly = result!.alternativeChips.find((c) => c.id === 'alt-adults-only');
    expect(adultsOnly).toBeDefined();
    expect(adultsOnly!.submitText.toLowerCase()).toContain('adults-only');
  });

  it('emits the only-hotel alternative when products bundle flight+hotel', () => {
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    const onlyHotel = result!.alternativeChips.find((c) => c.id === 'alt-only-hotel');
    expect(onlyHotel).toBeDefined();
    expect(onlyHotel!.label).toBe('Solo hotel');
    expect(onlyHotel!.submitText).toContain('hotel premium');
    expect(onlyHotel!.submitText).not.toContain('vuelo');
  });

  it('emits the economic-downgrade alternative for premium principal', () => {
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    const econ = result!.alternativeChips.find((c) => c.id === 'alt-economic');
    expect(econ).toBeDefined();
    expect(econ!.submitText).toContain('económico');
  });

  it('caps alternative chips at 4', () => {
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    expect(result!.alternativeChips.length).toBeLessThanOrEqual(4);
  });

  it('renders narrative segments with anniversary lead', () => {
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    expect(result!.segments.lead).toBe('Para tu aniversario en Riviera Maya');
    expect(result!.segments.proposal).toContain('vuelo y hotel');
    expect(result!.segments.proposal).toContain('premium');
    expect(result!.segments.dates).toBe(`del ${EXPECTED_START} al ${EXPECTED_END}`);
    expect(result!.segments.callToAction).toBe('¿Buscamos esto?');
  });
});

// ---------------------------------------------------------------------------
// 2. Family / Cancún / 4 pax / economic
// ---------------------------------------------------------------------------

describe('buildProposedSearch — family/Cancún', () => {
  it('produces a "vuelo + hotel económico" label for family + budget', () => {
    const seeds: SearchSeeds = {
      destination: 'Cancún',
      travelerType: 'family',
      budgetHint: 'budget',
      productsImplied: ['flight', 'hotel'],
      adults: 2,
      children: 2,
    };
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    expect(result!.principalChipLabel).toBe(
      'Buscar vuelo + hotel económico a Cancún',
    );
    expect(result!.principalSubmitText).toContain('Cancún');
    expect(result!.principalSubmitText).toContain('2 adultos');
    expect(result!.principalSubmitText).toContain('2 niños');
    expect(result!.principalSubmitText).toContain('económico');
    expect(result!.principalSubmitText).toContain('cuádruple');
  });
});

// ---------------------------------------------------------------------------
// 3. Solo / business / Madrid
// ---------------------------------------------------------------------------

describe('buildProposedSearch — solo/business/Madrid', () => {
  it('produces a flight + hotel proposal for solo business traveler', () => {
    const seeds: SearchSeeds = {
      destination: 'Madrid',
      travelerType: 'solo',
      occasionHint: 'business',
      productsImplied: ['flight', 'hotel'],
    };
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    expect(result).not.toBeNull();
    expect(result!.principalChipLabel).toContain('vuelo + hotel');
    expect(result!.principalChipLabel).toContain('Madrid');
    expect(result!.principalSubmitText).toContain('1 adulto');
    expect(result!.principalSubmitText).toContain('single');
    expect(result!.segments.lead).toContain('viaje de negocios');
  });
});

// ---------------------------------------------------------------------------
// 4. Honeymoon / Maldives — adults-only chip surfaces
// ---------------------------------------------------------------------------

describe('buildProposedSearch — honeymoon Maldives', () => {
  it('emits the adults-only alternative chip for honeymoon + couple + hotel', () => {
    const seeds: SearchSeeds = {
      destination: 'Maldives',
      travelerType: 'couple',
      occasionHint: 'honeymoon',
      budgetHint: 'luxury',
      productsImplied: ['flight', 'hotel'],
      adults: 2,
    };
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    const adultsOnly = result!.alternativeChips.find((c) => c.id === 'alt-adults-only');
    expect(adultsOnly).toBeDefined();
    expect(result!.segments.lead).toContain('luna de miel');
  });
});

// ---------------------------------------------------------------------------
// 5. Insufficient seeds — null returns
// ---------------------------------------------------------------------------

describe('buildProposedSearch — insufficient seeds', () => {
  it('returns null when seeds are missing entirely', () => {
    const result = buildProposedSearch(makeParsed({} as SearchSeeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    // {} as SearchSeeds has no destination → null
    expect(result).toBeNull();
  });

  it('returns null when destination is missing', () => {
    const seeds: SearchSeeds = {
      travelerType: 'couple',
      productsImplied: ['hotel'],
      adults: 2,
    };
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    expect(result).toBeNull();
  });

  it('returns null when destination present but no travelerType and no adults (too vague)', () => {
    const seeds: SearchSeeds = {
      destination: 'Tokio',
      productsImplied: ['flight', 'hotel'],
    };
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Geo origin from profile is included
// ---------------------------------------------------------------------------

describe('buildProposedSearch — geo origin handling', () => {
  it('includes default_origin_city in submit text when products include flight', () => {
    const seeds: SearchSeeds = {
      destination: 'Cancún',
      travelerType: 'couple',
      productsImplied: ['flight', 'hotel'],
    };
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: { ...PROFILE_WITH_GEO, default_origin_city: 'BUE' },
      now: FROZEN_NOW,
      language: 'es',
    });
    expect(result!.principalSubmitText).toContain('saliendo desde BUE');
  });

  it('omits origin clause when profile has no default_origin_city (still produces a submit text)', () => {
    const seeds: SearchSeeds = {
      destination: 'Cancún',
      travelerType: 'couple',
      productsImplied: ['flight', 'hotel'],
    };
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: { ...PROFILE_WITH_GEO, default_origin_city: undefined },
      now: FROZEN_NOW,
      language: 'es',
    });
    expect(result).not.toBeNull();
    expect(result!.principalSubmitText).not.toContain('saliendo desde');
  });

  it('omits origin clause for hotels-only requests even when geo is available', () => {
    const seeds: SearchSeeds = {
      destination: 'Punta Cana',
      travelerType: 'couple',
      budgetHint: 'budget',
      productsImplied: ['hotel'],
    };
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    expect(result!.principalSubmitText).not.toContain('saliendo desde');
  });
});

// ---------------------------------------------------------------------------
// 7. Language variants
// ---------------------------------------------------------------------------

describe('buildProposedSearch — language variants', () => {
  const seeds: SearchSeeds = {
    destination: 'Riviera Maya',
    travelerType: 'couple',
    budgetHint: 'premium',
    occasionHint: 'anniversary',
    productsImplied: ['flight', 'hotel'],
    adults: 2,
  };

  it('language=en produces an English submit text and lead', () => {
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'en',
    });
    expect(result!.principalSubmitText.startsWith('Search ')).toBe(true);
    expect(result!.principalSubmitText).toContain('flight and hotel');
    expect(result!.principalSubmitText).toContain('premium');
    expect(result!.principalSubmitText).toContain('to Riviera Maya');
    expect(result!.principalSubmitText).toContain('from 2026-05-14 to 2026-05-21');
    expect(result!.principalSubmitText).toContain('departing from EZE');
    expect(result!.segments.lead).toBe('For your anniversary in Riviera Maya');
    expect(result!.segments.callToAction).toBe('Shall we search?');
  });

  it('language=pt produces a Portuguese submit text and lead', () => {
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'pt',
    });
    expect(result!.principalSubmitText.startsWith('Buscar ')).toBe(true);
    expect(result!.principalSubmitText).toContain('voo e hotel');
    expect(result!.principalSubmitText).toContain('premium');
    expect(result!.principalSubmitText).toContain('para Riviera Maya');
    expect(result!.principalSubmitText).toContain('de 2026-05-14 a 2026-05-21');
    expect(result!.principalSubmitText).toContain('saindo de EZE');
    expect(result!.segments.lead).toBe('Para seu aniversário em Riviera Maya');
    expect(result!.segments.callToAction).toBe('Buscamos isso?');
  });
});

// ---------------------------------------------------------------------------
// 8. Date defaults — today+3 and today+10
// ---------------------------------------------------------------------------

describe('buildProposedSearch — date defaults', () => {
  it('principal submit text always includes today+3 and today+10 ISO dates', () => {
    const seeds: SearchSeeds = {
      destination: 'Bogotá',
      travelerType: 'couple',
      productsImplied: ['flight', 'hotel'],
    };
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    expect(result!.principalSubmitText).toContain(EXPECTED_START);
    expect(result!.principalSubmitText).toContain(EXPECTED_END);
  });

  it('5-night alternative computes today+3 → today+8', () => {
    const seeds: SearchSeeds = {
      destination: 'Bogotá',
      travelerType: 'couple',
      productsImplied: ['flight', 'hotel'],
    };
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    const fiveNights = result!.alternativeChips.find((c) => c.id === 'alt-five-nights');
    expect(fiveNights).toBeDefined();
    expect(fiveNights!.submitText).toContain('2026-05-14');
    expect(fiveNights!.submitText).toContain('2026-05-19');
  });
});

// ---------------------------------------------------------------------------
// 9. No economic-downgrade alternative when budget is non-premium
// ---------------------------------------------------------------------------

describe('buildProposedSearch — alternative chip gating', () => {
  it('omits economic-downgrade alternative when budgetHint is mid', () => {
    const seeds: SearchSeeds = {
      destination: 'Bariloche',
      travelerType: 'family',
      budgetHint: 'mid',
      productsImplied: ['flight', 'hotel'],
      adults: 2,
      children: 2,
    };
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    const econ = result!.alternativeChips.find((c) => c.id === 'alt-economic');
    expect(econ).toBeUndefined();
  });

  it('omits adults-only alternative when children > 0 (family with kids)', () => {
    const seeds: SearchSeeds = {
      destination: 'Riviera Maya',
      travelerType: 'family',
      occasionHint: 'anniversary', // unusual but valid combo
      productsImplied: ['flight', 'hotel'],
      adults: 2,
      children: 2,
    };
    const result = buildProposedSearch(makeParsed(seeds), {
      profile: PROFILE_WITH_GEO,
      now: FROZEN_NOW,
      language: 'es',
    });
    const adultsOnly = result!.alternativeChips.find((c) => c.id === 'alt-adults-only');
    expect(adultsOnly).toBeUndefined();
  });
});
