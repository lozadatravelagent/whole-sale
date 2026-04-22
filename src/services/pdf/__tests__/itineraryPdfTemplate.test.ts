import { describe, it, expect } from 'vitest';
import { canExportPdf, renderItineraryHtml } from '../itineraryPdfTemplate';
import type { TripPlannerState } from '@/features/trip-planner/types';

// ─── FIXTURES ───

const MOCK_BRANDING = {
  agency_name: 'Agencia Test',
  agency_logo_url: '',
  agency_primary_color: '#1a56db',
  agency_secondary_color: '#666666',
  agency_contact_name: 'Contacto Test',
  agency_contact_email: 'test@test.com',
  agency_contact_phone: '+54 11 1234-5678',
  // pdf_footer_text is rendered as text in the footer — used to verify branding flows through
  pdf_footer_text: 'Agencia Test | test@test.com',
};

function makeDay(dayNumber: number, title: string) {
  return {
    id: `day-${dayNumber}`,
    dayNumber,
    city: 'Madrid',
    title,
    morning: [{ id: 'a1', title: 'Visita al Prado' }],
    afternoon: [{ id: 'a2', title: 'Paseo por el Retiro' }],
    evening: [],
    restaurants: [],
  };
}

function makeSegment(city: string, country: string, nights: number, days: ReturnType<typeof makeDay>[]) {
  return {
    id: `seg-${city}`,
    city,
    country,
    nights,
    order: 1,
    days,
    contentStatus: 'complete' as const,
  };
}

function makeState(overrides: Partial<TripPlannerState> = {}): TripPlannerState {
  return {
    id: 'test-state-id',
    title: 'Viaje a Europa',
    summary: 'Un viaje increíble por Europa',
    startDate: '2025-07-01',
    endDate: '2025-07-14',
    days: 14,
    travelers: { adults: 2, children: 0, infants: 0 },
    destinations: ['Madrid', 'París'],
    origin: 'Buenos Aires',
    segments: [
      makeSegment('Madrid', 'España', 7, [makeDay(1, 'Llegada a Madrid'), makeDay(2, 'Museos')]),
      makeSegment('París', 'Francia', 7, [makeDay(3, 'Torre Eiffel')]),
    ],
    interests: [],
    constraints: [],
    generalTips: [],
    generationMeta: { source: 'planner_agent', updatedAt: Date.now(), version: 1 },
    ...overrides,
  } as TripPlannerState;
}

// ─── canExportPdf ───

describe('canExportPdf', () => {
  it('returns false for null state', () => {
    expect(canExportPdf(null)).toBe(false);
  });

  it('returns false when isDraft is true', () => {
    const state = makeState({ generationMeta: { source: 'planner_agent', updatedAt: Date.now(), version: 1, isDraft: true } });
    expect(canExportPdf(state)).toBe(false);
  });

  it('returns false when segments is empty', () => {
    const state = makeState({ segments: [] });
    expect(canExportPdf(state)).toBe(false);
  });

  it('returns false when all segments have empty days', () => {
    const state = makeState({
      segments: [makeSegment('Madrid', 'España', 7, [])],
    });
    expect(canExportPdf(state)).toBe(false);
  });

  it('returns true when at least one segment has days', () => {
    expect(canExportPdf(makeState())).toBe(true);
  });
});

// ─── renderItineraryHtml ───

describe('renderItineraryHtml', () => {
  it('returns a non-empty HTML string', () => {
    const html = renderItineraryHtml(makeState(), MOCK_BRANDING);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(100);
  });

  it('includes segment city names', () => {
    const html = renderItineraryHtml(makeState(), MOCK_BRANDING);
    expect(html).toContain('Madrid');
    expect(html).toContain('París');
  });

  it('includes day titles from segment.days', () => {
    const html = renderItineraryHtml(makeState(), MOCK_BRANDING);
    expect(html).toContain('Llegada a Madrid');
    expect(html).toContain('Torre Eiffel');
  });

  it('includes activity titles', () => {
    const html = renderItineraryHtml(makeState(), MOCK_BRANDING);
    expect(html).toContain('Visita al Prado');
    expect(html).toContain('Paseo por el Retiro');
  });

  it('includes traveler info', () => {
    const html = renderItineraryHtml(makeState(), MOCK_BRANDING);
    expect(html).toContain('2 adultos');
  });

  it('includes agency name from branding', () => {
    const html = renderItineraryHtml(makeState(), MOCK_BRANDING);
    expect(html).toContain('Agencia Test');
  });

  it('does not produce "undefined" or "null" strings', () => {
    const html = renderItineraryHtml(makeState(), MOCK_BRANDING);
    expect(html).not.toContain('>undefined<');
    expect(html).not.toContain('>null<');
    // Also check common patterns where undefined leaks into template literals
    expect(html).not.toMatch(/:\s*undefined/);
    expect(html).not.toMatch(/:\s*null(?!\w)/);
  });

  it('handles flexible dates without crashing', () => {
    const state = makeState({
      startDate: undefined,
      endDate: undefined,
      isFlexibleDates: true,
      flexibleMonth: 'julio',
      flexibleYear: 2025,
    });
    const html = renderItineraryHtml(state, MOCK_BRANDING);
    expect(html).toContain('julio');
    expect(html).not.toContain('>undefined<');
  });

  it('handles a segment with no days without crashing', () => {
    const state = makeState({
      segments: [
        makeSegment('Berlín', 'Alemania', 3, []),
        makeSegment('París', 'Francia', 4, [makeDay(1, 'Llegada')]),
      ],
    });
    const html = renderItineraryHtml(state, MOCK_BRANDING);
    expect(html).toContain('París');
    expect(html).toContain('Llegada');
    // Berlín segment has no days so no day page for it
    expect(html).not.toContain('Berlín · Alemania');
  });

  it('escapes XSS in activity titles', () => {
    const state = makeState({
      segments: [
        makeSegment('Madrid', 'España', 2, [{
          id: 'day-1',
          dayNumber: 1,
          city: 'Madrid',
          title: 'Día normal',
          morning: [{ id: 'ax1', title: '<script>alert(\'x\')</script>' }],
          afternoon: [],
          evening: [],
          restaurants: [],
        }]),
      ],
    });
    const html = renderItineraryHtml(state, MOCK_BRANDING);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('uses segment.days and never renders bufferedDays content', () => {
    const confirmedDay = makeDay(1, 'Día confirmado');
    const state = makeState({
      segments: [{
        ...makeSegment('Madrid', 'España', 3, [confirmedDay]),
        bufferedDays: [{ ...makeDay(1, 'Día en buffer'), id: 'buf-1' }],
      }],
    });
    const html = renderItineraryHtml(state, MOCK_BRANDING);
    expect(html).toContain('Día confirmado');
    expect(html).not.toContain('Día en buffer');
  });
});
