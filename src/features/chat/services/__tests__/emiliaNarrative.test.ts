/**
 * Phase 2 / sub-task D — Voice Layer (`buildEmiliaSearchNarrative`).
 *
 * Coverage:
 *   - Per mode × language sanity (5 modes × 3 languages).
 *   - Inline snapshots in `es` for the 5 modes (lock the exact tone).
 *   - Chip generation for inferred `tripType=one_way`.
 *   - Structured-data preservation for `plan_to_quote` (data.quoteContext).
 */

import { describe, expect, it } from 'vitest';
import { buildEmiliaSearchNarrative } from '../emiliaNarrative';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { TripPlannerState } from '@/features/trip-planner/types';

// ---------------------------------------------------------------------------
// Per-mode × per-language sanity (5 × 3 = 15 cases)
// ---------------------------------------------------------------------------

describe('buildEmiliaSearchNarrative — per mode × per language', () => {
  const baseFlights: ParsedTravelRequest = {
    requestType: 'flights',
    confidence: 0.9,
    originalMessage: 'BUE → MAD 10/09 al 18/09 para 2',
    flights: {
      origin: 'BUE',
      destination: 'MAD',
      departureDate: '2026-09-10',
      returnDate: '2026-09-18',
      adults: 2,
      children: 0,
      infants: 0,
    },
  };

  // -- search_summary -------------------------------------------------------
  it('search_summary / es contains the Spanish lead "Busqué"', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'search_summary',
      language: 'es',
      normalized: baseFlights,
      defaultsApplied: [],
    });
    expect(out.text).toContain('Busqué');
    expect(out.text).toContain('vuelo BUE→MAD');
  });

  it('search_summary / en contains the English lead "I searched"', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'search_summary',
      language: 'en',
      normalized: baseFlights,
      defaultsApplied: [],
    });
    expect(out.text).toContain('I searched');
    expect(out.text).toContain('flight BUE→MAD');
  });

  it('search_summary / pt contains the Portuguese lead "Busquei"', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'search_summary',
      language: 'pt',
      normalized: baseFlights,
      defaultsApplied: [],
    });
    expect(out.text).toContain('Busquei');
    expect(out.text).toContain('voo BUE→MAD');
  });

  // -- collect --------------------------------------------------------------
  const collectInput: ParsedTravelRequest = {
    requestType: 'combined',
    flights: { origin: '', destination: 'Tokio', departureDate: '', adults: 2, children: 0 },
    hotels: { city: 'Tokio', checkinDate: '', checkoutDate: '', adults: 2, children: 0 },
    confidence: 0.9,
    originalMessage: 'Tokio y Kioto con vuelo y hotel',
  };

  it('collect / es uses the empathic Spanish copy and asks for origin', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'collect',
      language: 'es',
      normalized: collectInput,
      missingFields: ['origin', 'dates', 'passengers'],
    });
    expect(out.text).toContain('Tokio');
    expect(out.text).toContain('desde qué ciudad');
  });

  it('collect / en uses the English copy and asks for departure city', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'collect',
      language: 'en',
      normalized: collectInput,
      missingFields: ['origin', 'dates'],
    });
    expect(out.text.toLowerCase()).toContain('departure city');
    expect(out.text).toContain('Tokio');
  });

  it('collect / pt uses the Portuguese copy and asks for departure city', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'collect',
      language: 'pt',
      normalized: collectInput,
      missingFields: ['origin', 'dates'],
    });
    expect(out.text.toLowerCase()).toContain('cidade saem');
    expect(out.text).toContain('Tokio');
  });

  // Regression: when origin AND destination are both missing (e.g. "quiero un
  // vuelo para el mes que viene"), askLine must combine both questions in one
  // turn instead of cascading to `origin` alone and ignoring `destination`.
  const originDestInput: ParsedTravelRequest = {
    requestType: 'flights',
    confidence: 0.9,
    originalMessage: 'quiero un vuelo para el mes que viene',
    flights: { origin: '', destination: '', departureDate: '2026-06-15', adults: 1, children: 0 },
  };

  it('collect / es asks for origin AND destination together when both missing', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'collect',
      language: 'es',
      normalized: originDestInput,
      missingFields: ['origin', 'destination'],
    });
    expect(out.text).toContain('desde qué ciudad');
    expect(out.text).toContain('a qué destino');
  });

  it('collect / en asks for departure city AND destination together when both missing', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'collect',
      language: 'en',
      normalized: originDestInput,
      missingFields: ['origin', 'destination'],
    });
    expect(out.text.toLowerCase()).toContain('departure city');
    expect(out.text.toLowerCase()).toContain('destination');
  });

  it('collect / pt asks for departure city AND destination together when both missing', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'collect',
      language: 'pt',
      normalized: originDestInput,
      missingFields: ['origin', 'destination'],
    });
    expect(out.text.toLowerCase()).toContain('cidade saem');
    expect(out.text.toLowerCase()).toContain('destino');
  });

  // -- plan_to_quote --------------------------------------------------------
  const plannerState: TripPlannerState = {
    id: 'plan-1',
    title: 'Italia',
    summary: '',
    startDate: '2026-09-10',
    endDate: '2026-09-18',
    isFlexibleDates: false,
    days: 8,
    travelers: { adults: 2, children: 0, infants: 0 },
    interests: [],
    constraints: [],
    destinations: ['Roma', 'Florencia'],
    origin: 'BUE',
    segments: [
      { id: 'seg-1', city: 'Roma', order: 0, nights: 5, days: [], hotelPlan: { searchStatus: 'idle' } },
      { id: 'seg-2', city: 'Florencia', order: 1, nights: 3, days: [], hotelPlan: { searchStatus: 'idle' } },
    ],
    generalTips: [],
    generationMeta: { source: 'chat', updatedAt: '2026-01-01T00:00:00Z', version: 1 },
  } as unknown as TripPlannerState;

  it('plan_to_quote / es summarizes the active plan in Spanish', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'plan_to_quote',
      language: 'es',
      plannerState,
    });
    expect(out.text).toContain('plan activo');
    expect(out.text).toContain('Roma');
    expect(out.text).toContain('Florencia');
  });

  it('plan_to_quote / en summarizes the active plan in English', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'plan_to_quote',
      language: 'en',
      plannerState,
    });
    expect(out.text).toContain('active plan');
    expect(out.text).toContain('Roma');
  });

  it('plan_to_quote / pt summarizes the active plan in Portuguese', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'plan_to_quote',
      language: 'pt',
      plannerState,
    });
    expect(out.text).toContain('plano ativo');
    expect(out.text).toContain('Roma');
  });

  // -- mode_bridge ----------------------------------------------------------
  it('mode_bridge / es / agency uses the Spanish toAgency copy', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'mode_bridge',
      language: 'es',
      bridge: { suggestedMode: 'agency' },
    });
    expect(out.text).toContain('cotizando vuelos y hoteles');
  });

  it('mode_bridge / en / agency uses the English toAgency copy', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'mode_bridge',
      language: 'en',
      bridge: { suggestedMode: 'agency' },
    });
    expect(out.text).toContain('quoting flights and hotels');
  });

  it('mode_bridge / pt / passenger uses the Portuguese toPassenger copy', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'mode_bridge',
      language: 'pt',
      bridge: { suggestedMode: 'passenger' },
    });
    expect(out.text).toContain('montando um itinerário');
  });

  // -- progress -------------------------------------------------------------
  it('progress / es announces the itinerary draft in Spanish', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'progress',
      language: 'es',
      progress: { destination: 'Roma', days: 7 },
    });
    expect(out.text).toContain('Ya tengo la base del viaje');
    expect(out.text).toContain('Roma');
    expect(out.text).toContain('7 días');
  });

  it('progress / en announces the itinerary draft in English', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'progress',
      language: 'en',
      progress: { destination: 'Rome', days: 7 },
    });
    expect(out.text).toContain('base of the trip');
    expect(out.text).toContain('Rome');
  });

  it('progress / pt announces the itinerary draft in Portuguese', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'progress',
      language: 'pt',
      progress: { destination: 'Roma', days: 7 },
    });
    expect(out.text).toContain('base da viagem');
    expect(out.text).toContain('Roma');
  });
});

// ---------------------------------------------------------------------------
// Inline snapshots — exact text in `es` for each mode (locks the voice)
// ---------------------------------------------------------------------------

describe('buildEmiliaSearchNarrative — `es` snapshots', () => {
  it('search_summary snapshot', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'search_summary',
      language: 'es',
      normalized: {
        requestType: 'flights',
        confidence: 0.9,
        originalMessage: '',
        flights: {
          origin: 'BUE',
          destination: 'MAD',
          departureDate: '2026-09-10',
          returnDate: '2026-09-18',
          adults: 2,
          children: 0,
          infants: 0,
        },
      },
      defaultsApplied: [
        { field: 'adults', value: '1', label: '1 adulto (por defecto)' },
      ],
    });
    expect(out.text).toMatchInlineSnapshot(
      `"Busqué vuelo BUE→MAD, 10 sept al 18 sept, 2 adultos. _Datos asumidos: 1 adulto (por defecto)._ Si querés cambiar algo, decime."`,
    );
  });

  it('collect snapshot', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'collect',
      language: 'es',
      normalized: {
        requestType: 'combined',
        flights: { origin: '', destination: 'Tokio', departureDate: '', adults: 2, children: 0 },
        hotels: { city: 'Tokio', checkinDate: '', checkoutDate: '', adults: 2, children: 0 },
        confidence: 0.9,
        originalMessage: '',
      },
      missingFields: ['origin', 'dates'],
    });
    expect(out.text).toMatchInlineSnapshot(
      `"Ya tengo bastante para trabajarte una base de viaje a Tokio. Para cerrarte una propuesta concreta, decime desde qué ciudad salen y en qué fechas quieren viajar."`,
    );
  });

  it('plan_to_quote snapshot', () => {
    const planner = {
      id: 'p',
      title: 'Italia',
      summary: '',
      startDate: '2026-09-10',
      endDate: '2026-09-18',
      isFlexibleDates: false,
      days: 8,
      travelers: { adults: 2, children: 0, infants: 0 },
      interests: [],
      constraints: [],
      destinations: ['Roma', 'Florencia'],
      origin: 'BUE',
      segments: [
        { id: 'a', city: 'Roma', order: 0, nights: 5, days: [], hotelPlan: { searchStatus: 'idle' } },
        { id: 'b', city: 'Florencia', order: 1, nights: 3, days: [], hotelPlan: { searchStatus: 'idle' } },
      ],
      generalTips: [],
      generationMeta: { source: 'chat', updatedAt: '2026-01-01T00:00:00Z', version: 1 },
    } as unknown as TripPlannerState;
    const out = buildEmiliaSearchNarrative({
      mode: 'plan_to_quote',
      language: 'es',
      plannerState: planner,
    });
    expect(out.text).toMatchInlineSnapshot(
      `
      "Tengo el plan activo para cotizar: Roma (5 noches) → Florencia (3 noches) · 8 días · 2 adultos · 2026-09-10 al 2026-09-18.

      Ya puedo usar este itinerario como base para buscar vuelos y hoteles, sin volver a armar el viaje."
    `,
    );
  });

  it('mode_bridge snapshot (agency)', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'mode_bridge',
      language: 'es',
      bridge: { suggestedMode: 'agency' },
    });
    expect(out.text).toMatchInlineSnapshot(
      `"Este pedido se resuelve mejor cotizando vuelos y hoteles. ¿Cambiamos de modo?"`,
    );
  });

  it('progress snapshot', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'progress',
      language: 'es',
      progress: { destination: 'Roma', days: 7 },
    });
    expect(out.text).toMatchInlineSnapshot(
      `"Ya tengo la base del viaje para Roma de 7 días. Estoy armando el itinerario completo y te lo muestro apenas termine."`,
    );
  });
});

// ---------------------------------------------------------------------------
// Chip generation — inferred tripType=one_way produces a round-trip chip
// ---------------------------------------------------------------------------

describe('buildEmiliaSearchNarrative — chip generation', () => {
  it('emits a round-trip chip when defaultsApplied includes tripType=one_way', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'search_summary',
      language: 'es',
      normalized: {
        requestType: 'flights',
        confidence: 0.9,
        originalMessage: '',
        flights: {
          origin: 'BUE',
          destination: 'MAD',
          departureDate: '2026-09-10',
          adults: 1,
          children: 0,
          infants: 0,
        },
      },
      defaultsApplied: [
        { field: 'tripType', value: 'one_way', label: 'solo ida (sin fecha de vuelta)' },
      ],
    });
    expect(out.chips).toBeDefined();
    expect(out.chips?.length ?? 0).toBeGreaterThan(0);
    expect(out.chips?.[0].action.kind).toBe('submit');
    expect(out.chips?.[0].action.text.toLowerCase()).toMatch(/ida y vuelta|round-trip|round trip|ida e volta/);
  });

  it('does not emit a round-trip chip when defaultsApplied is empty', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'search_summary',
      language: 'es',
      normalized: {
        requestType: 'flights',
        confidence: 0.9,
        originalMessage: '',
        flights: {
          origin: 'BUE',
          destination: 'MAD',
          departureDate: '2026-09-10',
          returnDate: '2026-09-18',
          adults: 1,
          children: 0,
          infants: 0,
        },
      },
      defaultsApplied: [],
    });
    expect(out.chips ?? []).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Phase 3 / sub-task B — collect mode `style` sub-variant
// ---------------------------------------------------------------------------

describe('buildEmiliaSearchNarrative — collect / style sub-variant', () => {
  const focusedInput: ParsedTravelRequest = {
    requestType: 'flights',
    confidence: 0.9,
    originalMessage: '',
    flights: { origin: '', destination: 'Cancún', departureDate: '', adults: 1, children: 0 },
  };

  it("collect / style='focused' / es produces just the focused question (no contextual lead)", () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'collect',
      style: 'focused',
      language: 'es',
      normalized: focusedInput,
      missingFields: ['passengers', 'dates'],
    });
    expect(out.text).toBe('¿Cuántas personas viajan y en qué fechas?');
    // No empathic lead — must NOT contain "Ya tengo" / context words
    expect(out.text).not.toContain('Ya tengo');
    expect(out.text).not.toContain('Cancún');
    expect(out.meta?.voice.tone).toBe('imperative');
  });

  it("collect / style='focused' / en produces just the focused question in English", () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'collect',
      style: 'focused',
      language: 'en',
      normalized: focusedInput,
      missingFields: ['passengers', 'dates'],
    });
    expect(out.text).toBe('How many people are traveling and on what dates?');
    expect(out.text).not.toMatch(/I already have|already located|base/i);
  });

  it("collect / style='focused' / pt produces just the focused question in Portuguese", () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'collect',
      style: 'focused',
      language: 'pt',
      normalized: focusedInput,
      missingFields: ['passengers', 'dates'],
    });
    expect(out.text).toBe('Quantas pessoas viajam e em quais datas?');
    expect(out.text).not.toMatch(/Já tenho/);
  });

  it("collect / style='empathic' (default) preserves the contextual lead + ask shape", () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'collect',
      language: 'es',
      normalized: {
        requestType: 'combined',
        flights: { origin: '', destination: 'Tokio', departureDate: '', adults: 2, children: 0 },
        hotels: { city: 'Tokio', checkinDate: '', checkoutDate: '', adults: 2, children: 0 },
        confidence: 0.9,
        originalMessage: '',
      },
      missingFields: ['origin', 'dates'],
    });
    // Empathic lead-in remains (proves no regression from the focused branch)
    expect(out.text).toContain('Ya tengo');
    expect(out.text).toContain('Tokio');
    expect(out.meta?.voice.tone).toBe('empathic');
  });

  it("collect / style='focused' falls back when missingFields is empty", () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'collect',
      style: 'focused',
      language: 'es',
      normalized: focusedInput,
      missingFields: [],
    });
    expect(out.text).toBe('¿Podés darme más detalles sobre tu viaje?');
  });

  it("collect / style='focused' / es snapshot for passengers_and_dates", () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'collect',
      style: 'focused',
      language: 'es',
      normalized: focusedInput,
      missingFields: ['passengers', 'dates'],
    });
    expect(out.text).toMatchInlineSnapshot(
      `"¿Cuántas personas viajan y en qué fechas?"`,
    );
  });
});

// ---------------------------------------------------------------------------
// Structured-data preservation — plan_to_quote forwards quoteContext
// ---------------------------------------------------------------------------

describe('buildEmiliaSearchNarrative — structured data', () => {
  it('plan_to_quote returns data.quoteContext populated from the planner state', () => {
    const planner = {
      id: 'plan-1',
      title: 'Roma',
      summary: '',
      startDate: '2026-09-10',
      endDate: '2026-09-18',
      isFlexibleDates: false,
      days: 8,
      travelers: { adults: 2, children: 1, infants: 0 },
      interests: [],
      constraints: [],
      destinations: ['Roma'],
      origin: 'BUE',
      segments: [
        { id: 'seg-1', city: 'Roma', order: 0, nights: 8, days: [], hotelPlan: { searchStatus: 'idle' } },
      ],
      generalTips: [],
      generationMeta: { source: 'chat', updatedAt: '2026-01-01T00:00:00Z', version: 1 },
    } as unknown as TripPlannerState;

    const out = buildEmiliaSearchNarrative({
      mode: 'plan_to_quote',
      language: 'es',
      plannerState: planner,
      extras: { missingQuoteFields: [], missingQuoteSlots: [] },
    });

    expect(out.data?.quoteContext).toBeTruthy();
    const ctx = out.data!.quoteContext as Record<string, unknown>;
    expect(ctx.source).toBe('active_planner');
    expect(ctx.title).toBe('Roma');
    expect(ctx.origin).toBe('BUE');
    expect(ctx.destinations).toEqual(['Roma']);
    expect(ctx.days).toBe(8);
    expect(Array.isArray(ctx.segments)).toBe(true);
    expect((ctx.segments as unknown[]).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 3 / sub-task A — discovery mode (migrated from formatDiscoveryResponse)
// ---------------------------------------------------------------------------

describe('buildEmiliaSearchNarrative — discovery', () => {
  const samplePlaces = [
    { name: 'Coliseo', description: 'icono romano', category: 'Historia', city: 'Roma' },
    { name: 'Vaticano', description: 'museo y arte', category: 'Cultura', city: 'Roma' },
  ];

  it('discovery / es — default heading + bulleted places + cta', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'discovery',
      language: 'es',
      discovery: { city: 'Roma', requestText: 'qué hacer en Roma', places: samplePlaces },
    });
    expect(out.text).toContain('Para Roma');
    expect(out.text).toContain('- Coliseo — icono romano');
    expect(out.text).toContain('- Vaticano — museo y arte');
    expect(out.meta?.voice.mode).toBe('discovery');
    expect(out.meta?.voice.tone).toBe('editorial');
  });

  it('discovery / en — default heading uses English copy', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'discovery',
      language: 'en',
      discovery: { city: 'Rome', requestText: 'what to do in Rome', places: samplePlaces },
    });
    expect(out.text).toContain('For Rome');
    expect(out.text).toContain('- Coliseo');
    expect(out.meta?.voice.tone).toBe('editorial');
  });

  it('discovery / pt — default heading uses Portuguese copy', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'discovery',
      language: 'pt',
      discovery: { city: 'Roma', requestText: 'o que fazer em Roma', places: samplePlaces },
    });
    expect(out.text).toContain('Para Roma');
    expect(out.text).toContain('- Coliseo');
    expect(out.meta?.voice.tone).toBe('editorial');
  });

  it('discovery / es — emits no chips (editorial card has its own visual ctas)', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'discovery',
      language: 'es',
      discovery: { city: 'Roma', requestText: 'museos en Roma', places: samplePlaces },
    });
    expect(out.chips ?? []).toEqual([]);
    // Culture pattern fires the culture heading variant.
    expect(out.text).toContain('cultura en Roma');
  });

  it('discovery / es — empty places list falls back to discoveryEmpty copy', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'discovery',
      language: 'es',
      discovery: { city: 'Roma', requestText: 'qué hacer en Roma', places: [] },
    });
    expect(out.text).toContain('base clara de imperdibles');
    // Defensive: no list bullets when there are no places.
    expect(out.text).not.toContain('—');
  });

  it('discovery / es — exact snapshot for the default heading + cta', () => {
    const out = buildEmiliaSearchNarrative({
      mode: 'discovery',
      language: 'es',
      discovery: {
        city: 'Roma',
        requestText: 'cosas para hacer en Roma 3 dias',
        places: [
          { name: 'Coliseo', description: 'icono romano', category: 'Historia', city: 'Roma' },
          { name: 'Vaticano', description: 'museo y arte', category: 'Cultura', city: 'Roma' },
        ],
      },
    });
    expect(out.text).toMatchInlineSnapshot(
      `
      "Para Roma, estos son los lugares que más vale la pena priorizar:
      - Coliseo — icono romano
      - Vaticano — museo y arte
      Si querés, te los ordeno en un recorrido por días para aprovechar mejor Roma."
    `,
    );
  });
});
