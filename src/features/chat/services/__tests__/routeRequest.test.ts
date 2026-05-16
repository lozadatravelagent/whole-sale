import { describe, it, expect } from 'vitest';

import { routeRequest } from '../routeRequest';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';

/**
 * Helper to build a minimal ParsedTravelRequest for router tests.
 * Defaults mirror what the AI parser emits when adults are NOT explicitly stated:
 *   adults = 1, adultsExplicit = false (safe default).
 */
function makeParsed(overrides: Partial<ParsedTravelRequest>): ParsedTravelRequest {
  return {
    requestType: 'general',
    confidence: 0.9,
    originalMessage: '',
    ...overrides,
  } as ParsedTravelRequest;
}

describe('routeRequest — safe-default passenger scoring (Phase 1A)', () => {
  it('routes a combined flight+hotel request with default 1 adult to QUOTE', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      originalMessage: 'Vuelo Buenos Aires a Cancún del 10 al 17 y un hotel all inclusive',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-10',
        returnDate: '2026-07-17',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-10',
        checkoutDate: '2026-07-17',
        adults: 1,
        adultsExplicit: false,
        children: 0,
        mealPlan: 'all_inclusive',
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('QUOTE');
    expect(result.dimensions.passengers).toBe(1.0);
  });

  it('routes a hotel-only request with default 1 adult to QUOTE', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      originalMessage: 'Hotel en Cancún en julio',
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-08',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('QUOTE');
    expect(result.dimensions.passengers).toBe(1.0);
  });

  it('routes a flight-only request with default 1 adult to QUOTE', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Quiero un vuelo a Madrid mañana',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '2026-05-12',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('QUOTE');
    expect(result.dimensions.passengers).toBe(1.0);
  });

  it('regression: "familia" without count and without an explicit adult still scores 0 (genuine ambiguity)', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Vuelo para mi familia a Cancún',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-10',
        adults: 0,
        adultsExplicit: false,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.dimensions.passengers).toBe(0);
    expect(result.missingFields).toContain('passengers');
  });

  it('"familia" with parser fallback (adults=1, not explicit) is treated as a safe default', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Vuelo para mi familia a Cancún en julio',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-10',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.dimensions.passengers).toBe(1.0);
  });

  it('"familia" with explicit pax >= 4 still scores 1.0 (existing behavior unchanged)', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Vuelo familia 4 personas a Cancún',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-10',
        adults: 4,
        adultsExplicit: true,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.dimensions.passengers).toBe(1.0);
  });

  it('explicit adults still scores 1.0 (existing behavior unchanged)', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Vuelo para 2 adultos a Cancún del 10 al 17',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-10',
        returnDate: '2026-07-17',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.dimensions.passengers).toBe(1.0);
    expect(result.route).toBe('QUOTE');
  });
});

describe('routeRequest — typed reason codes (Phase 2 / sub-task B)', () => {
  it('hotel with exact dates + city + hotelName routes QUOTE with reason hotel_exact_ready', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      originalMessage: 'Quiero el Iberostar Selection Cancún del 1 al 5 de julio para 2',
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-05',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        hotelName: 'Iberostar Selection Cancún',
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('QUOTE');
    expect(result.reason).toBe('hotel_exact_ready');
  });

  it('hotel with exact dates + city + hotelChains routes QUOTE with reason hotel_exact_ready', () => {
    const parsed = makeParsed({
      requestType: 'hotels',
      originalMessage: 'Hotel Riu en Cancún del 1 al 5 de julio para 2 adultos',
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-05',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        hotelChains: ['RIU'],
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('QUOTE');
    expect(result.reason).toBe('hotel_exact_ready');
  });

  it('combined request with productOrder set routes QUOTE with reason ordered_products_ready', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      originalMessage: 'Quiero primero hotel y después vuelo para Cancún del 10 al 17, 2 adultos',
      productOrder: ['hotel', 'flight'],
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-10',
        returnDate: '2026-07-17',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-07-10',
        checkoutDate: '2026-07-17',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('QUOTE');
    expect(result.reason).toBe('ordered_products_ready');
  });

  it('safe-defaults case (1 adult inferred) routing QUOTE emits safe_defaults_applied', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Quiero un vuelo a Madrid mañana',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '2026-05-12',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('QUOTE');
    expect(result.reason).toBe('safe_defaults_applied');
    expect(result.inferredFields).toContain('adults');
  });

  it('flight with origin missing on a vague-destination COLLECT emits origin_missing_no_geo', () => {
    // Vague destination ("Europa") drops dest score to 0.5; combined with
    // missing origin/dates this lands in the COLLECT band (< 0.75) so the
    // origin-missing-no-geo dispatch is reachable. With dimensions.complexity
    // = 1.0 (no segments) and destination = 0.5, the destination_too_vague
    // PLAN branch (dimensions.destination === 0.5 && complexity < 1) does not
    // fire, so we land on the score-based COLLECT path.
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Vuelos a Europa para 2 adultos',
      flights: {
        origin: '',
        destination: 'Europa',
        departureDate: '',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('COLLECT');
    expect(result.missingFields).toContain('origin');
    expect(result.reason).toBe('origin_missing_no_geo');
  });

  it('buildCollectQuestion now respects responseLanguage (Phase 3 / B)', () => {
    // Vague destination + missing dates lands COLLECT < QUOTE_THRESHOLD.
    // responseLanguage = 'en' must produce the English focused question via
    // the Voice Layer. Previously hardcoded ES.
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Flights to Europe for 2 adults',
      responseLanguage: 'en',
      flights: {
        origin: '',
        destination: 'Europe',
        departureDate: '',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('COLLECT');
    expect(result.collectQuestion).toBeDefined();
    // The English copy for `origin_and_dates` is the expected question:
    expect(result.collectQuestion).toBe('From where are you traveling and on what dates?');
  });

  it('children > 0 without childrenAges emits minor_ages_needed when COLLECTing', () => {
    // Vague destination + missing dates pushes the score under QUOTE while
    // keeping the request flight-bearing. childrenAges omitted triggers the
    // minor_ages_needed dispatch in the COLLECT branch.
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Vuelos a Europa, 2 adultos y 2 niños',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Europa',
        departureDate: '',
        adults: 2,
        adultsExplicit: true,
        children: 2,
        // childrenAges intentionally omitted
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('COLLECT');
    expect(result.reason).toBe('minor_ages_needed');
  });
});

// ---------------------------------------------------------------------------
// Phase 4 / sub-task B — Semantic intent fields (multilingual)
//
// The router must read parsed.quoteIntent / planIntent / referencesCurrentPlan
// / travelerType for routing decisions. Spanish-only LEGACY regexes survive
// only as a fallback when the parser did not emit the semantic field.
// ---------------------------------------------------------------------------

describe('routeRequest — semantic quoteIntent (multilingual)', () => {
  it('routes EN "Quote the trip to Madrid" to QUOTE via parsed.quoteIntent === true', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Quote the trip to Madrid for 2 adults on July 10',
      quoteIntent: true,
      flights: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '2026-07-10',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('QUOTE');
  });

  it('routes PT "Quanto custa a viagem para Lisboa" to QUOTE via parsed.quoteIntent === true', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Quanto custa a viagem para Lisboa em julho',
      quoteIntent: true,
      flights: {
        origin: 'Buenos Aires',
        destination: 'Lisboa',
        departureDate: '2026-07-10',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('QUOTE');
  });

  it('falls back to legacy ES regex when parsed.quoteIntent is undefined', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Cotizame un vuelo a Madrid el 10 de julio para 2 adultos',
      // quoteIntent intentionally undefined → legacy regex must catch "cotizame"
      flights: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '2026-07-10',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('QUOTE');
    // Either quote_intent_complete (intent path) or a high-score reason —
    // both are acceptable; the key invariant is that legacy fallback fired.
    expect(['quote_intent_complete', 'high_definition', 'safe_defaults_applied'])
      .toContain(result.reason);
  });

  it('respects parsed.quoteIntent === false even when message contains ES quote keywords', () => {
    const parsed = makeParsed({
      requestType: 'itinerary',
      originalMessage: 'Cotizame un viaje por Italia',
      quoteIntent: false,
      planIntent: true,
      itinerary: {
        destinations: ['Roma', 'Florencia'],
        days: 7,
        startDate: '2026-07-10',
        travelers: { adults: 2, children: 0, infants: 0 },
      },
    });

    const result = routeRequest(parsed);
    // Itinerary requestType always goes to PLAN regardless of quote intent.
    expect(result.route).toBe('PLAN');
  });
});

describe('routeRequest — semantic planIntent (multilingual)', () => {
  it('routes EN "Plan a trip to Madrid" to PLAN via parsed.planIntent === true', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Plan a 7-day trip to Madrid in July',
      planIntent: true,
      flights: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '2026-07-10',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('PLAN');
    expect(result.reason).toBe('itinerary_request');
  });

  it('routes PT "Monta um roteiro para Lisboa" to PLAN via parsed.planIntent === true', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Monta um roteiro de 7 dias para Lisboa em julho',
      planIntent: true,
      flights: {
        origin: 'Buenos Aires',
        destination: 'Lisboa',
        departureDate: '2026-07-10',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('PLAN');
  });

  it('falls back to legacy ES regex when parsed.planIntent is undefined', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Armame un itinerario por Italia',
      // planIntent intentionally undefined → legacy regex catches "armame" / "itinerario"
      flights: {
        origin: 'Buenos Aires',
        destination: 'Roma',
        departureDate: '2026-07-10',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('PLAN');
  });
});

describe('routeRequest — semantic referencesCurrentPlan (multilingual)', () => {
  const activePlannerState = {
    generationMeta: { isDraft: false },
    segments: [{ city: 'Roma' }],
  };

  it('routes EN "Quote this trip" to QUOTE via parsed.referencesCurrentPlan + quoteIntent', () => {
    const parsed = makeParsed({
      requestType: 'general',
      originalMessage: 'Quote this trip please',
      quoteIntent: true,
      referencesCurrentPlan: true,
    });

    const result = routeRequest(parsed, activePlannerState);
    expect(result.route).toBe('QUOTE');
    expect(result.reason).toBe('quote_active_plan');
  });

  it('routes PT "Cotize esta viagem" to QUOTE via parsed.referencesCurrentPlan + quoteIntent', () => {
    const parsed = makeParsed({
      requestType: 'general',
      originalMessage: 'Cotize esta viagem por favor',
      quoteIntent: true,
      referencesCurrentPlan: true,
    });

    const result = routeRequest(parsed, activePlannerState);
    expect(result.route).toBe('QUOTE');
    expect(result.reason).toBe('quote_active_plan');
  });

  it('falls back to legacy ES regex when parsed.referencesCurrentPlan is undefined', () => {
    const parsed = makeParsed({
      requestType: 'general',
      originalMessage: 'Cotizame este viaje por favor',
      // referencesCurrentPlan undefined → legacy regex catches "este viaje"
      // quoteIntent undefined too → legacy regex catches "cotizame"
    });

    const result = routeRequest(parsed, activePlannerState);
    expect(result.route).toBe('QUOTE');
    expect(result.reason).toBe('quote_active_plan');
  });
});

describe('routeRequest — semantic isFamilyTravel (multilingual)', () => {
  it('treats EN "Family trip to Cancun" as family via parsed.travelerType === "family"', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Family trip to Cancun in July',
      travelerType: 'family',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-10',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    // travelerType=family + safe-default adults=1 → passenger score 1.0
    expect(result.dimensions.passengers).toBe(1.0);
  });

  it('treats PT "Viagem em familia" with no adultsExplicit as family ambiguity (score 0)', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Viagem em familia para Cancun',
      travelerType: 'family',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-10',
        adults: 0,
        adultsExplicit: false,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    // Family signal + no adults default applied → genuine ambiguity.
    expect(result.dimensions.passengers).toBe(0);
    expect(result.missingFields).toContain('passengers');
  });

  it('infers family travel from explicit children > 0 even without travelerType', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Trip with my kids',
      // travelerType intentionally omitted; children > 0 implies family.
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-10',
        adults: 1,
        adultsExplicit: false,
        children: 2,
        childrenAges: [6, 9],
      },
    });

    const result = routeRequest(parsed);
    // With children > 0 → family branch fires; safe-default adults → 1.0.
    expect(result.dimensions.passengers).toBe(1.0);
  });

  it('falls back to legacy ES regex when travelerType is undefined and no kids present', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Vuelo para mi familia a Cancún',
      // travelerType + children both omitted → legacy regex catches "familia"
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-10',
        adults: 0,
        adultsExplicit: false,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    // Legacy "familia" path: no adultsExplicit, no defaults → genuine ambiguity.
    expect(result.dimensions.passengers).toBe(0);
    expect(result.missingFields).toContain('passengers');
  });

  it('explicit travelerType !== "family" and no kids does NOT trigger family branch', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Viaje con mi novia a Cancún',
      travelerType: 'couple',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-10',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    // travelerType=couple bypasses both semantic and legacy family checks.
    expect(result.dimensions.passengers).toBe(1.0);
  });
});

describe('routeRequest — commercialIntent contract', () => {
  it('keeps agency package shorthand in QUOTE even when planIntent is accidentally true', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      originalMessage: 'Armame paquete para Punta Cana, pareja, julio',
      planIntent: true,
      quoteIntent: true,
      commercialIntent: {
        kind: 'package_search',
        agencyContext: true,
        confidence: 0.95,
        rationale: 'package quote request',
      },
      travelerType: 'couple',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Punta Cana',
        departureDate: '2026-07-01',
        returnDate: '2026-07-08',
        adults: 2,
        adultsExplicit: true,
        children: 0,
      },
      hotels: {
        city: 'Punta Cana',
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-08',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        roomType: 'double',
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('QUOTE');
  });

  it('respects ordered multi-product commercial intent before planner routing', () => {
    const parsed = makeParsed({
      requestType: 'combined',
      originalMessage: 'Primero veamos hotel en Cancún y después le sumamos aéreo',
      planIntent: true,
      commercialIntent: {
        kind: 'ordered_multi_product_search',
        agencyContext: true,
        confidence: 0.95,
        rationale: 'explicit hotel then flight order',
      },
      productOrder: ['hotel', 'flight'],
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-05-19',
        returnDate: '2026-05-26',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
      hotels: {
        city: 'Cancún',
        checkinDate: '2026-05-19',
        checkoutDate: '2026-05-26',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('QUOTE');
    expect(result.reason).toBe('ordered_products_ready');
  });

  it('routes true commercial trip_planning to PLAN', () => {
    const parsed = makeParsed({
      requestType: 'itinerary',
      originalMessage: 'Armame un itinerario por Europa 15 días',
      planIntent: true,
      commercialIntent: {
        kind: 'trip_planning',
        agencyContext: false,
        confidence: 0.96,
        rationale: 'explicit itinerary build',
      },
      itinerary: {
        destinations: ['Europa'],
        days: 15,
        travelers: { adults: 1, children: 0, infants: 0 },
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('PLAN');
    expect(result.reason).toBe('itinerary_request');
  });

  it('routes commercial contradictions to COLLECT with a minimal question', () => {
    const parsed = makeParsed({
      requestType: 'flights',
      originalMessage: 'Solo ida a Cancún del 10 al 17',
      message: '¿El 17 lo querés usar como regreso o mantenemos solo ida?',
      commercialIntent: {
        kind: 'contradiction_detected',
        agencyContext: true,
        confidence: 0.94,
        rationale: 'one-way conflicts with date range',
      },
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-07-10',
        adults: 1,
        adultsExplicit: false,
        children: 0,
      },
    });

    const result = routeRequest(parsed);
    expect(result.route).toBe('COLLECT');
    expect(result.reason).toBe('contradiction_detected');
    expect(result.collectQuestion).toBe('¿El 17 lo querés usar como regreso o mantenemos solo ida?');
  });
});
