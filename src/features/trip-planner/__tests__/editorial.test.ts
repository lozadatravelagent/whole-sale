import { beforeAll, describe, expect, it } from 'vitest';
import type { TripPlannerState, PlannerSegment, PlannerDay, PlannerActivity, PlannerRestaurant, SegmentHotelPlan } from '../types';

// Stub localStorage before any imports that trigger supabase client
beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };
  }
});

let buildEditorialData: typeof import('../editorial').buildEditorialData;
let detectCountryRoute: typeof import('../utils').detectCountryRoute;
let expandDestinationsIfRegional: typeof import('../utils').expandDestinationsIfRegional;

beforeAll(async () => {
  const editorial = await import('../editorial');
  buildEditorialData = editorial.buildEditorialData;
  const utils = await import('../utils');
  detectCountryRoute = utils.detectCountryRoute;
  expandDestinationsIfRegional = utils.expandDestinationsIfRegional;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeActivity(title: string, description?: string, category?: string): PlannerActivity {
  return {
    id: `act-${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    description,
    category,
  };
}

function makeRestaurant(name: string, type?: string): PlannerRestaurant {
  return {
    id: `rest-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    type,
  };
}

function makeDay(opts: {
  dayNumber: number;
  city: string;
  title?: string;
  morning?: PlannerActivity[];
  afternoon?: PlannerActivity[];
  evening?: PlannerActivity[];
  restaurants?: PlannerRestaurant[];
}): PlannerDay {
  return {
    id: `day-${opts.dayNumber}`,
    dayNumber: opts.dayNumber,
    city: opts.city,
    title: opts.title || `Día ${opts.dayNumber}`,
    morning: opts.morning || [],
    afternoon: opts.afternoon || [],
    evening: opts.evening || [],
    restaurants: opts.restaurants || [],
  };
}

function makeHotelPlan(city: string): SegmentHotelPlan {
  return { city, searchStatus: 'idle', hotelRecommendations: [] };
}

function makeSegment(opts: {
  city: string;
  country?: string;
  order: number;
  nights?: number;
  summary?: string;
  highlights?: string[];
  days: PlannerDay[];
}): PlannerSegment {
  return {
    id: `seg-${opts.city.toLowerCase()}`,
    city: opts.city,
    country: opts.country,
    order: opts.order,
    nights: opts.nights || opts.days.length,
    summary: opts.summary,
    highlights: opts.highlights,
    hotelPlan: makeHotelPlan(opts.city),
    days: opts.days,
  };
}

function makePlannerState(opts: {
  title?: string;
  summary?: string;
  days?: number;
  destinations?: string[];
  segments: PlannerSegment[];
  pace?: 'relaxed' | 'balanced' | 'fast';
}): TripPlannerState {
  return {
    id: 'test-plan',
    title: opts.title || 'Test Trip',
    summary: opts.summary || '',
    days: opts.days || opts.segments.reduce((s, seg) => s + (seg.nights || seg.days.length), 0),
    destinations: opts.destinations || opts.segments.map(s => s.city),
    segments: opts.segments,
    travelers: { adults: 2, children: 0, infants: 0 },
    interests: [],
    constraints: [],
    generalTips: [],
    pace: opts.pace,
    generationMeta: { source: 'chat', updatedAt: new Date().toISOString(), version: 1 },
  } as TripPlannerState;
}

// ---------------------------------------------------------------------------
// A. buildEditorialData — full content
// ---------------------------------------------------------------------------

describe('buildEditorialData', () => {
  const spainState = makePlannerState({
    title: 'Ruta por España',
    summary: 'Recorrido clasico por las principales ciudades de Espana.',
    days: 12,
    destinations: ['Madrid', 'Barcelona', 'Sevilla'],
    segments: [
      makeSegment({
        city: 'Madrid',
        country: 'Spain',
        order: 0,
        nights: 4,
        summary: 'Capital cultural con arte y tapas.',
        highlights: ['Museo del Prado', 'Parque del Retiro'],
        days: [
          makeDay({
            dayNumber: 1, city: 'Madrid', title: 'Prado y Retiro',
            morning: [makeActivity('Museo del Prado', 'Pinacoteca iconica con Velazquez y Goya.', 'Museo')],
            afternoon: [makeActivity('Parque del Retiro', 'Gran pulmon verde ideal para caminar.', 'Parque')],
            evening: [makeActivity('Casa Dani', 'Tortilla espanola clasica en el Mercado de la Paz.', 'Gastronomia')],
            restaurants: [makeRestaurant('Casa Dani', 'Tapas')],
          }),
          makeDay({
            dayNumber: 2, city: 'Madrid', title: 'Gran Via y Barrio de las Letras',
            morning: [makeActivity('Museo Reina Sofia', 'Guernica de Picasso y arte contemporaneo.', 'Museo')],
            afternoon: [makeActivity('Gran Via', 'Paseo por la arteria comercial.', 'Paseo')],
            evening: [makeActivity('Mercado de San Miguel', 'Tapas gourmet en mercado historico.', 'Gastronomia')],
          }),
          makeDay({ dayNumber: 3, city: 'Madrid', title: 'Dia 3', morning: [], afternoon: [], evening: [] }),
          makeDay({ dayNumber: 4, city: 'Madrid', title: 'Dia 4', morning: [], afternoon: [], evening: [] }),
        ],
      }),
      makeSegment({
        city: 'Barcelona',
        country: 'Spain',
        order: 1,
        nights: 5,
        summary: 'Arquitectura unica y gastronomia mediterranea.',
        highlights: ['La Sagrada Familia', 'Park Guell'],
        days: [
          makeDay({
            dayNumber: 5, city: 'Barcelona', title: 'Llegada a Barcelona',
            morning: [makeActivity('Llegada a Barcelona', '', 'Traslado')],
            afternoon: [makeActivity('Barrio Gotico', 'Paseo por calles medievales.', 'Paseo')],
            evening: [],
          }),
          makeDay({
            dayNumber: 6, city: 'Barcelona', title: 'Gaudi y modernismo',
            morning: [makeActivity('La Sagrada Familia', 'Basilica inacabada de Gaudi, Patrimonio UNESCO.', 'Landmark')],
            afternoon: [makeActivity('Park Guell', 'Jardin de mosaicos con vistas a la ciudad.', 'Parque')],
            evening: [makeActivity('Can Paixano', 'Cava y tapas en bodega emblematica.', 'Gastronomia')],
            restaurants: [makeRestaurant('Can Paixano', 'Bodega')],
          }),
          makeDay({ dayNumber: 7, city: 'Barcelona', title: 'Dia 7', morning: [], afternoon: [], evening: [] }),
          makeDay({ dayNumber: 8, city: 'Barcelona', title: 'Dia 8', morning: [], afternoon: [], evening: [] }),
          makeDay({ dayNumber: 9, city: 'Barcelona', title: 'Dia 9', morning: [], afternoon: [], evening: [] }),
        ],
      }),
      makeSegment({
        city: 'Sevilla',
        country: 'Spain',
        order: 2,
        nights: 3,
        summary: 'Flamenco, historia arabe y calor andaluz.',
        highlights: ['Real Alcazar', 'Plaza de Espana'],
        days: [
          makeDay({
            dayNumber: 10, city: 'Sevilla', title: 'Llegada y Alcazar',
            morning: [makeActivity('Traslado a Sevilla', '', 'Traslado')],
            afternoon: [makeActivity('Real Alcazar', 'Palacio mudéjar con jardines historicos.', 'Landmark')],
            evening: [makeActivity('Tablao flamenco', 'Show de flamenco autentico.', 'Experiencia')],
          }),
          makeDay({
            dayNumber: 11, city: 'Sevilla', title: 'Plaza de Espana y Triana',
            morning: [makeActivity('Plaza de España', 'Impresionante plaza semicircular del 1929.', 'Landmark')],
            afternoon: [makeActivity('Barrio de Triana', 'Cruce del rio, ceramica y tapas.', 'Paseo')],
            evening: [],
          }),
          makeDay({ dayNumber: 12, city: 'Sevilla', title: 'Dia 12', morning: [], afternoon: [], evening: [] }),
        ],
      }),
    ],
  });

  it('produces structured editorial with correct mode', () => {
    const result = buildEditorialData(spainState);
    expect(result.mode).toBe('multi_city_country');
    expect(result.segments.length).toBe(3);
    expect(result.totalDays).toBe(12);
    expect(result.totalCities).toBe(3);
  });

  it('extracts highlights from activities, filtering generic placeholders', () => {
    const result = buildEditorialData(spainState);
    const madridHighlights = result.segments[0].highlights;
    expect(madridHighlights.length).toBeGreaterThanOrEqual(2);

    const highlightNames = madridHighlights.map(h => h.name);
    expect(highlightNames).toContain('Museo del Prado');
    expect(highlightNames).toContain('Parque del Retiro');

    // Should not contain generic placeholders
    highlightNames.forEach(name => {
      expect(name.toLowerCase()).not.toMatch(/^paseo por|^traslado|^llegada/);
    });
  });

  it('extracts day previews excluding transfer days', () => {
    const result = buildEditorialData(spainState);
    const barcelonaPreviews = result.segments[1].dayPreviews;
    // Should prefer "Gaudi y modernismo" over "Llegada a Barcelona"
    expect(barcelonaPreviews.length).toBeGreaterThanOrEqual(1);
    const titles = barcelonaPreviews.map(p => p.title);
    expect(titles).toContain('Gaudi y modernismo');
  });

  it('builds day oneLiner from activity titles', () => {
    const result = buildEditorialData(spainState);
    const madridPreviews = result.segments[0].dayPreviews;
    const day1 = madridPreviews.find(p => p.dayNumber === 1);
    expect(day1).toBeDefined();
    expect(day1!.oneLiner).toContain('Museo del Prado');
    expect(day1!.oneLiner).toContain('Parque del Retiro');
    expect(day1!.oneLiner).toContain('Casa Dani');
  });

  it('extracts extraordinary highlights across all segments', () => {
    const result = buildEditorialData(spainState);
    expect(result.extraordinaryHighlights.length).toBeGreaterThanOrEqual(3);
    // Should contain descriptions
    const hasDescribed = result.extraordinaryHighlights.some(h => h.includes(' — '));
    expect(hasDescribed).toBe(true);
  });

  it('builds route overview with arrow separator', () => {
    const result = buildEditorialData(spainState);
    expect(result.routeOverview).toContain('Madrid');
    expect(result.routeOverview).toContain('Barcelona');
    expect(result.routeOverview).toContain('Sevilla');
    expect(result.routeOverview).toContain('\u2192');
  });

  it('builds next actions with hotel suggestion when no hotels', () => {
    const result = buildEditorialData(spainState);
    const hotelAction = result.nextActions.find(a => a.icon === 'hotel');
    expect(hotelAction).toBeDefined();
  });

  it('includes metadata with hasFullDayContent true when days have activities', () => {
    const result = buildEditorialData(spainState);
    expect(result.metadata.hasFullDayContent).toBe(true);
    expect(result.metadata.sourceSegmentCount).toBe(3);
  });

  it('includes regional expansion metadata when provided', () => {
    const result = buildEditorialData(spainState, {
      regionalExpansion: { originalInput: 'España', expandedTo: ['Madrid', 'Barcelona', 'Sevilla'] },
    });
    expect(result.metadata.regionalExpansion).toBeDefined();
    expect(result.metadata.regionalExpansion!.originalInput).toBe('España');
  });

  it('handles skeleton mode (no day content) gracefully', () => {
    const skeletonState = makePlannerState({
      title: 'Ruta por Italia',
      days: 10,
      segments: [
        makeSegment({
          city: 'Roma', order: 0, nights: 4, highlights: ['Coliseo', 'Vaticano'],
          days: [
            makeDay({ dayNumber: 1, city: 'Roma', title: 'Coliseo y Foro Romano' }),
            makeDay({ dayNumber: 2, city: 'Roma', title: 'Vaticano y Trastevere' }),
            makeDay({ dayNumber: 3, city: 'Roma', title: 'Dia 3' }),
            makeDay({ dayNumber: 4, city: 'Roma', title: 'Dia 4' }),
          ],
        }),
        makeSegment({
          city: 'Florencia', order: 1, nights: 3, highlights: ['Uffizi', 'Ponte Vecchio'],
          days: [
            makeDay({ dayNumber: 5, city: 'Florencia', title: 'Llegada' }),
            makeDay({ dayNumber: 6, city: 'Florencia', title: 'Uffizi y centro' }),
            makeDay({ dayNumber: 7, city: 'Florencia', title: 'Dia libre' }),
          ],
        }),
        makeSegment({
          city: 'Venecia', order: 2, nights: 3, highlights: ['San Marco', 'Murano'],
          days: [
            makeDay({ dayNumber: 8, city: 'Venecia', title: 'Llegada' }),
            makeDay({ dayNumber: 9, city: 'Venecia', title: 'San Marco' }),
            makeDay({ dayNumber: 10, city: 'Venecia', title: 'Murano y Burano' }),
          ],
        }),
      ],
    });

    const result = buildEditorialData(skeletonState);
    expect(result.metadata.hasFullDayContent).toBe(false);
    expect(result.segments.length).toBe(3);
    // Should still use segment.highlights as fallback
    expect(result.segments[0].highlights.length).toBeGreaterThanOrEqual(1);
    // No day previews in skeleton mode
    expect(result.segments[0].dayPreviews.length).toBe(0);
    // Extraordinary highlights from segment-level highlights
    expect(result.extraordinaryHighlights.length).toBeGreaterThanOrEqual(1);
  });

  it('single city mode for one-segment plans', () => {
    const singleState = makePlannerState({
      title: '4 dias en Shanghai',
      days: 4,
      segments: [
        makeSegment({
          city: 'Shanghái', order: 0, nights: 4,
          highlights: ['The Bund', 'Yu Garden'],
          days: [
            makeDay({ dayNumber: 1, city: 'Shanghái', title: 'The Bund y Pudong',
              morning: [makeActivity('The Bund', 'Paseo frente al skyline historico.', 'Landmark')],
              afternoon: [makeActivity('Torre de Shanghai', 'Mirador a 632m de altura.', 'Mirador')],
              evening: [],
            }),
            makeDay({ dayNumber: 2, city: 'Shanghái', title: 'Dia 2', morning: [], afternoon: [], evening: [] }),
            makeDay({ dayNumber: 3, city: 'Shanghái', title: 'Dia 3', morning: [], afternoon: [], evening: [] }),
            makeDay({ dayNumber: 4, city: 'Shanghái', title: 'Dia 4', morning: [], afternoon: [], evening: [] }),
          ],
        }),
      ],
    });

    const result = buildEditorialData(singleState);
    expect(result.mode).toBe('single_city');
    expect(result.totalCities).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// B. Country expansion for new countries
// ---------------------------------------------------------------------------

describe('country expansion — new countries', () => {
  it('detects China as country route', () => {
    const result = detectCountryRoute('China');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('china');
    expect(result!.route.cities.length).toBeGreaterThanOrEqual(3);
  });

  it('detects Tailandia as country route', () => {
    const result = detectCountryRoute('Tailandia');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('thailand');
  });

  it('detects Turquía as country route', () => {
    const result = detectCountryRoute('Turquía');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('turkey');
  });

  it('detects México as country route', () => {
    const result = detectCountryRoute('México');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('mexico');
  });

  it('detects Vietnam as country route', () => {
    const result = detectCountryRoute('Vietnam');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('vietnam');
  });

  it('detects India as country route', () => {
    const result = detectCountryRoute('India');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('india');
  });

  it('detects UK as country route', () => {
    const result = detectCountryRoute('UK');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('uk');
  });

  it('detects Alemania as country route', () => {
    const result = detectCountryRoute('Alemania');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('germany');
  });

  it('detects Portugal as country route', () => {
    const result = detectCountryRoute('Portugal');
    expect(result).not.toBeNull();
    expect(result!.countryKey).toBe('portugal');
  });

  it('China 11 days expands to 3-4 cities', () => {
    const { expandedDestinations } = expandDestinationsIfRegional(['China'], 11);
    expect(expandedDestinations.length).toBeGreaterThanOrEqual(3);
    expect(expandedDestinations.length).toBeLessThanOrEqual(5);
    expect(expandedDestinations).toContain('Beijing');
    expect(expandedDestinations).toContain('Shanghái');
  });

  it('España 15 days expands to 4-5 cities', () => {
    const { expandedDestinations } = expandDestinationsIfRegional(['España'], 15);
    expect(expandedDestinations.length).toBeGreaterThanOrEqual(4);
    expect(expandedDestinations).toContain('Madrid');
    expect(expandedDestinations).toContain('Barcelona');
  });

  it('Shanghái (city) is NOT expanded', () => {
    const { expandedDestinations } = expandDestinationsIfRegional(['Shanghái'], 4);
    expect(expandedDestinations).toEqual(['Shanghái']);
  });

  it('Thailand 14 days expands to multiple cities', () => {
    const { expandedDestinations } = expandDestinationsIfRegional(['Tailandia'], 14);
    expect(expandedDestinations.length).toBeGreaterThanOrEqual(3);
    expect(expandedDestinations).toContain('Bangkok');
  });
});
