import { describe, expect, it } from 'vitest';

import {
  parseMessageWithAI,
  detectMessageLanguage,
  generateMissingInfoMessage,
  tryParseSimpleItineraryDeterministically,
  validateFlightRequiredFields,
  validateHotelRequiredFields,
} from '@/services/aiMessageParser';

describe('aiMessageParser validation', () => {
  it('rejects placeholder flight values before provider formatting', () => {
    const result = validateFlightRequiredFields({
      origin: 'Buenos Aires',
      destination: 'Madrid',
      departureDate: '[EXTRACT from user or context]',
      adults: 2,
      children: 0,
      infants: 0,
    });

    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('segment_1_departureDate');
  });

  it('rejects invalid hotel placeholder dates', () => {
    const result = validateHotelRequiredFields({
      city: 'Madrid',
      checkinDate: 'Invalid Date',
      checkoutDate: '[DATE]',
      adults: 2,
      children: 0,
    });

    expect(result.isValid).toBe(false);
    expect(result.missingFields).toEqual(expect.arrayContaining(['checkinDate', 'checkoutDate']));
  });

  it('requires returnDate when a flight request is explicitly round-trip', () => {
    const result = validateFlightRequiredFields({
      origin: 'Buenos Aires',
      destination: 'MIA',
      departureDate: '2026-08-01',
      tripType: 'round_trip',
      adults: 1,
      children: 0,
      infants: 0,
    });

    expect(result.isValid).toBe(false);
    expect(result.missingFields).toEqual(['returnDate']);
    expect(result.missingFieldsSpanish).toEqual(['fecha de regreso']);
  });

  it('parses simple itinerary requests locally', () => {
    const result = tryParseSimpleItineraryDeterministically(
      'Armame un itinerario por Japon de 15 dias en julio para 2 personas',
      null,
      new Date('2026-05-06T00:00:00')
    );

    expect(result?.requestType).toBe('itinerary');
    expect(result?.itinerary?.destinations).toEqual(['Japon']);
    expect(result?.itinerary?.days).toBe(15);
    expect(result?.itinerary?.flexibleMonth).toBe('07');
    expect(result?.itinerary?.flexibleYear).toBe(2026);
    expect(result?.itinerary?.travelers?.adults).toBe(2);
  });

  it('defaults simple itinerary duration to 7 days when user omits days', () => {
    const result = tryParseSimpleItineraryDeterministically(
      'Armame un itinerario para Madrid',
      null,
      new Date('2026-05-06T00:00:00')
    );

    expect(result?.requestType).toBe('itinerary');
    expect(result?.itinerary?.destinations).toEqual(['Madrid']);
    expect(result?.itinerary?.days).toBe(7);
  });

  it('keeps quote/provider requests on the CE parser path', () => {
    const result = tryParseSimpleItineraryDeterministically(
      'Cotizame vuelos y hoteles para Japon de 15 dias en julio',
      null,
      new Date('2026-05-06T00:00:00')
    );

    expect(result).toBeNull();
  });

  it('detects English travel requests independently from the UI language', () => {
    expect(detectMessageLanguage('I need a flight from Madrid to Miami in July for 2 adults', 'es')).toBe('en');
  });

  it('localizes deterministic missing-info prompts', () => {
    const result = generateMissingInfoMessage(['origen', 'fecha de salida'], 'flights', undefined, 'en');

    expect(result).toContain('To find the best flights');
    expect(result).toContain('Origin');
    expect(result).toContain('Departure date');
  });

  it('completes a pending flight context without switching back to itinerary', async () => {
    const result = await parseMessageWithAI(
      'Buenos Aires en julio',
      {
        requestType: 'flights',
        originalMessage: 'Quiero buscar vuelos para Paris para 2 adultos',
        confidence: 0.9,
        flights: {
          origin: '',
          destination: 'Paris',
          departureDate: '',
          adults: 2,
          children: 0,
          infants: 0,
        },
      },
      [],
      undefined,
      'es'
    );

    expect(result.requestType).toBe('flights');
    expect(result.flights?.origin).toBe('Buenos Aires');
    expect(result.flights?.destination).toBe('Paris');
    expect(result.flights?.adults).toBe(2);
  });

  it('defaults missing pending flight date and family travelers', async () => {
    const result = await parseMessageWithAI(
      'Buenos Aires para mi familia',
      {
        requestType: 'flights',
        originalMessage: 'Quiero buscar vuelos para Paris',
        confidence: 0.9,
        flights: {
          origin: '',
          destination: 'Paris',
          departureDate: '',
          adults: 1,
          adultsExplicit: false,
          children: 0,
          infants: 0,
        },
      },
      [],
      undefined,
      'es'
    );

    expect(result.requestType).toBe('flights');
    expect(result.flights?.origin).toBe('Buenos Aires');
    expect(result.flights?.departureDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.flights?.adults).toBe(2);
    expect(result.flights?.children).toBe(2);
    expect(result.flights?.adultsExplicit).toBe(true);
  });

  it('keeps pending hotel context as hotels while filling slots', async () => {
    const result = await parseMessageWithAI(
      'Madrid para 2 adultos',
      {
        requestType: 'hotels',
        originalMessage: 'Buscame hotel',
        confidence: 0.9,
        hotels: {
          city: '',
          checkinDate: '',
          checkoutDate: '',
          adults: 0,
          children: 0,
        },
      },
      [],
      undefined,
      'es'
    );

    expect(result.requestType).toBe('hotels');
    expect(result.hotels?.city).toBe('Madrid');
    expect(result.hotels?.adults).toBe(2);
  });

  it('keeps pending itinerary context as itinerary while filling slots', async () => {
    const result = await parseMessageWithAI(
      'Italia en julio',
      {
        requestType: 'itinerary',
        originalMessage: 'Armame un itinerario',
        confidence: 0.9,
        itinerary: {
          destinations: [],
          days: 10,
        },
      },
      [],
      undefined,
      'es'
    );

    expect(result.requestType).toBe('itinerary');
    expect(result.itinerary?.destinations).toEqual(['Italia']);
    expect(result.itinerary?.flexibleMonth).toBe('07');
  });
});
