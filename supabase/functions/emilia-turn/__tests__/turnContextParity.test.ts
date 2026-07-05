import { describe, expect, it } from 'vitest';
import {
  applyResolvedSlotsToQuoteRequest,
  derivePendingAnswerSlots,
  forceApiQuoteOnlyRequest,
  normalizeApiQuoteMissingFields,
  resolveApiQuoteTurnContext,
  resolveApiTurnContext,
  shouldExecuteApiQuoteSearch,
  type ContextState,
} from '../turnContextParity';

function combinedContext(): ContextState {
  return {
    lastSearch: {
      requestType: 'combined',
      timestamp: '2026-05-28T00:00:00.000Z',
      flightsParams: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '2026-07-01',
        returnDate: '2026-07-15',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        infants: 0,
        tripType: 'round_trip',
      },
      hotelsParams: {
        city: 'Madrid',
        checkinDate: '2026-07-01',
        checkoutDate: '2026-07-15',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        infants: 0,
        roomType: 'double',
      },
      resultsSummary: {
        flightsCount: 5,
        hotelsCount: 5,
      },
    },
    constraintsHistory: [],
    turnNumber: 1,
    schemaVersion: 1,
  };
}

function flightContext(): ContextState {
  return {
    lastSearch: {
      requestType: 'flights',
      timestamp: '2026-05-28T00:00:00.000Z',
      flightsParams: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '2026-07-01',
        returnDate: '2026-07-07',
        adults: 2,
        adultsExplicit: true,
        children: 0,
        infants: 0,
        tripType: 'round_trip',
      },
      resultsSummary: {
        flightsCount: 5,
        hotelsCount: 0,
      },
    },
    constraintsHistory: [],
    turnNumber: 1,
    schemaVersion: 1,
  };
}

describe('emilia-turn context parity', () => {
  it('coerces itinerary requests into combined quote requests for the API surface', () => {
    const parsedRequest = forceApiQuoteOnlyRequest({
      type: 'itinerary',
      requestType: 'itinerary',
      originalMessage: 'armame un itinerario desde Buenos Aires a Madrid del 1 al 8 de julio para 2 adultos',
      confidence: 0.95,
      planIntent: true,
      itinerary: {
        destinations: ['Madrid'],
        startDate: '2026-07-01',
        days: 7,
        travelers: { adults: 2 },
      },
    } as any, 'armame un itinerario desde Buenos Aires a Madrid del 1 al 8 de julio para 2 adultos');

    expect(parsedRequest.type).toBe('combined');
    expect((parsedRequest as any).planIntent).toBe(false);
    expect((parsedRequest as any).quoteIntent).toBe(true);
    expect(parsedRequest.flights?.origin).toBe('Buenos Aires');
    expect(parsedRequest.flights?.destination).toBe('Madrid');
    expect(parsedRequest.flights?.departureDate).toBe('2026-07-01');
    expect(parsedRequest.flights?.returnDate).toBe('2026-07-08');
    expect(parsedRequest.flights?.adults).toBe(2);
    expect(parsedRequest.hotels?.city).toBe('Madrid');
    expect(parsedRequest.hotels?.checkinDate).toBe('2026-07-01');
    expect(parsedRequest.hotels?.checkoutDate).toBe('2026-07-08');
    expect(parsedRequest.hotels?.adults).toBe(2);
  });

  it('keeps hotel-only requests as quote requests when planner intent is present', () => {
    const parsedRequest = forceApiQuoteOnlyRequest({
      type: 'itinerary',
      requestType: 'itinerary',
      planIntent: true,
      itinerary: {
        destinations: ['Punta Cana'],
        startDate: '2026-07-01',
        endDate: '2026-07-07',
        travelers: { adults: 2 },
      },
    } as any, 'armame solo hoteles en Punta Cana');

    expect(parsedRequest.type).toBe('hotels');
    expect(parsedRequest.flights).toBeUndefined();
    expect(parsedRequest.hotels?.city).toBe('Punta Cana');
    expect((parsedRequest as any).planIntent).toBe(false);
    expect((parsedRequest as any).quoteIntent).toBe(true);
  });

  it('applies pending origin answers to top-level flights and round-trip segments before validation', () => {
    const parsedRequest = applyResolvedSlotsToQuoteRequest({
      type: 'combined',
      requestType: 'combined',
      originalMessage: 'Buenos Aires',
      flights: {
        origin: '',
        destination: 'Italia',
        departureDate: '2026-05-31',
        returnDate: '2026-06-07',
        tripType: 'round_trip',
        adults: 1,
        segments: [
          { origin: '', destination: 'Italia', departureDate: '2026-05-31' },
          { origin: 'Italia', destination: '', departureDate: '2026-06-07' },
        ],
      },
      hotels: {
        city: 'Italia',
        checkinDate: '2026-05-31',
        checkoutDate: '2026-06-07',
        adults: 1,
      },
    } as any, { origin: 'Buenos Aires' });

    expect(parsedRequest.type).toBe('combined');
    expect(parsedRequest.flights?.origin).toBe('Buenos Aires');
    expect(parsedRequest.flights?.destination).toBe('Italia');
    expect(parsedRequest.flights?.segments?.[0]).toEqual({
      origin: 'Buenos Aires',
      destination: 'Italia',
      departureDate: '2026-05-31',
    });
    expect(parsedRequest.flights?.segments?.[1]).toEqual({
      origin: 'Italia',
      destination: 'Buenos Aires',
      departureDate: '2026-06-07',
    });
  });

  it('normalizes dependent segment validation errors into canonical user slots', () => {
    const missingFields = normalizeApiQuoteMissingFields({
      type: 'combined',
      requestType: 'combined',
      flights: {
        origin: '',
        destination: 'Italia',
        departureDate: '2026-05-31',
        returnDate: '2026-06-07',
        tripType: 'round_trip',
        segments: [
          { origin: '', destination: 'Italia', departureDate: '2026-05-31' },
          { origin: 'Italia', destination: '', departureDate: '2026-06-07' },
        ],
      },
      hotels: {
        city: 'Italia',
        checkinDate: '2026-05-31',
        checkoutDate: '2026-06-07',
        adults: 1,
      },
    } as any, ['segment_1_origin', 'segment_2_destination']);

    expect(missingFields).toEqual(['origin']);
  });

  it('does not suppress a missing return date just because the outbound date exists', () => {
    const missingFields = normalizeApiQuoteMissingFields({
      type: 'flights',
      requestType: 'flights',
      flights: {
        origin: 'Buenos Aires',
        destination: 'París',
        departureDate: '2026-06-02',
        segments: [
          { origin: 'Buenos Aires', destination: 'París', departureDate: '2026-06-02' },
          { origin: 'París', destination: 'Buenos Aires', departureDate: '' },
        ],
      },
    } as any, ['segment_2_departureDate']);

    expect(missingFields).toEqual(['dates']);
  });

  it('derives short pending-action answers deterministically when the parser envelope misses the slot', () => {
    const slots = derivePendingAnswerSlots(
      {
        kind: 'awaiting_user_input',
        for: 'quote_completion',
        fields: ['origin', 'destination'],
      },
      'Buenos Aires',
      {
        type: 'combined',
        requestType: 'combined',
        flights: { origin: '', destination: 'Italia' },
        hotels: { city: 'Italia' },
      } as any,
    );

    expect(slots).toEqual({ origin: 'Buenos Aires' });
  });

  it('runs the API quote pre-route layer in one pass: quote-only, continuity, pending slots, segment repair', () => {
    const { parsedRequest, appliedSlots } = resolveApiQuoteTurnContext({
      persistentState: {
        lastSearch: {
          requestType: 'combined',
          timestamp: '2026-05-28T00:00:00.000Z',
          flightsParams: {
            origin: '',
            destination: 'Italia',
            departureDate: '2026-05-31',
            returnDate: '2026-06-07',
            tripType: 'round_trip',
            segments: [
              { origin: '', destination: 'Italia', departureDate: '2026-05-31' },
              { origin: 'Italia', destination: '', departureDate: '2026-06-07' },
            ],
            adults: 1,
          },
          hotelsParams: {
            city: 'Italia',
            checkinDate: '2026-05-31',
            checkoutDate: '2026-06-07',
            adults: 1,
          },
        },
        constraintsHistory: [],
        turnNumber: 1,
        schemaVersion: 1,
      },
      message: 'Buenos Aires',
      resolvedSlots: { origin: 'Buenos Aires' },
      parsedRequest: {
        type: 'combined',
        requestType: 'combined',
        originalMessage: 'Buenos Aires',
        flights: {
          origin: '',
          destination: 'Italia',
          departureDate: '2026-05-31',
          returnDate: '2026-06-07',
          tripType: 'round_trip',
          segments: [
            { origin: '', destination: 'Italia', departureDate: '2026-05-31' },
            { origin: 'Italia', destination: '', departureDate: '2026-06-07' },
          ],
          adults: 1,
        },
        hotels: {
          city: 'Italia',
          checkinDate: '2026-05-31',
          checkoutDate: '2026-06-07',
          adults: 1,
        },
      } as any,
    });

    expect(appliedSlots).toEqual({ origin: 'Buenos Aires' });
    expect(parsedRequest.type).toBe('combined');
    expect(parsedRequest.flights?.origin).toBe('Buenos Aires');
    expect(parsedRequest.flights?.segments?.[1].destination).toBe('Buenos Aires');
    expect((parsedRequest as any).quoteIntent).toBe(true);
    expect((parsedRequest as any).planIntent).toBe(false);
  });

  it('executes search from the canonical route result even when raw validation was repaired pre-route', () => {
    expect(shouldExecuteApiQuoteSearch({
      route: 'QUOTE',
      executionBranch: 'standard_search',
      requestType: 'flights',
      missingFields: [],
    })).toBe(true);

    expect(shouldExecuteApiQuoteSearch({
      route: 'COLLECT',
      executionBranch: 'standard_search',
      requestType: 'flights',
      missingFields: [],
    })).toBe(false);

    expect(shouldExecuteApiQuoteSearch({
      route: 'QUOTE',
      executionBranch: 'standard_search',
      requestType: 'flights',
      missingFields: ['dates'],
    })).toBe(false);
  });

  it('merges a date-change turn before routing so origin/destination/pax are preserved', () => {
    const { parsedRequest, iterationContext } = resolveApiTurnContext({
      persistentState: combinedContext(),
      message: 'cambia las fechas del 10 al 20 de Julio',
      parsedRequest: {
        type: 'combined',
        requestType: 'combined',
        originalMessage: 'cambia las fechas del 10 al 20 de Julio',
        confidence: 0.96,
        flights: {
          departureDate: '2026-07-10',
          returnDate: '2026-07-20',
        },
        hotels: {
          checkinDate: '2026-07-10',
          checkoutDate: '2026-07-20',
        },
        iterationIntent: {
          isIteration: true,
          type: 'duration_change',
          modifiedFields: [
            'flights.departureDate',
            'flights.returnDate',
            'hotels.checkinDate',
            'hotels.checkoutDate',
          ],
        },
      } as any,
    });

    expect(iterationContext.isIteration).toBe(true);
    expect(parsedRequest.type).toBe('combined');
    expect(parsedRequest.flights?.origin).toBe('Buenos Aires');
    expect(parsedRequest.flights?.destination).toBe('Madrid');
    expect(parsedRequest.flights?.departureDate).toBe('2026-07-10');
    expect(parsedRequest.flights?.returnDate).toBe('2026-07-20');
    expect(parsedRequest.flights?.adults).toBe(2);
    expect(parsedRequest.hotels?.city).toBe('Madrid');
    expect(parsedRequest.hotels?.checkinDate).toBe('2026-07-10');
    expect(parsedRequest.hotels?.checkoutDate).toBe('2026-07-20');
    expect(parsedRequest.hotels?.adults).toBe(2);
  });

  it('uses deterministic continuity for short duration follow-ups when the parser is generic', () => {
    const { parsedRequest, iterationContext } = resolveApiTurnContext({
      persistentState: combinedContext(),
      message: 'quiero una semana',
      parsedRequest: {
        type: 'general',
        requestType: 'general',
        originalMessage: 'quiero una semana',
        confidence: 0.5,
      } as any,
    });

    expect(iterationContext.iterationType).toBe('stay_duration_modification');
    expect(parsedRequest.type).toBe('combined');
    expect(parsedRequest.flights?.returnDate).toBe('2026-07-08');
    expect(parsedRequest.hotels?.checkoutDate).toBe('2026-07-08');
  });

  it('applies passenger follow-ups to both flight and hotel products', () => {
    const { parsedRequest, iterationContext } = resolveApiTurnContext({
      persistentState: combinedContext(),
      message: 'somos 3',
      parsedRequest: {
        type: 'general',
        requestType: 'general',
        originalMessage: 'somos 3',
        confidence: 0.5,
      } as any,
    });

    expect(iterationContext.iterationType).toBe('flight_modification');
    expect(parsedRequest.type).toBe('combined');
    expect(parsedRequest.flights?.adults).toBe(3);
    expect(parsedRequest.hotels?.adults).toBe(3);
    expect(parsedRequest.flights?.origin).toBe('Buenos Aires');
    expect(parsedRequest.hotels?.city).toBe('Madrid');
  });

  it('keeps combined hotel dates aligned when the parser emits a flight-only preference change', () => {
    const { parsedRequest, iterationContext } = resolveApiTurnContext({
      persistentState: combinedContext(),
      message: 'cambia las fechas del 10 al 20 de Julio',
      parsedRequest: {
        type: 'flights',
        requestType: 'flights',
        originalMessage: 'cambia las fechas del 10 al 20 de Julio',
        confidence: 0.96,
        flights: {
          departureDate: '2026-07-10',
          returnDate: '2026-07-20',
          tripType: 'round_trip',
        },
        iterationIntent: {
          isIteration: true,
          type: 'preference_change',
          modifiedFields: [
            'flights.departureDate',
            'flights.returnDate',
          ],
        },
      } as any,
    });

    expect(iterationContext.iterationType).toBe('flight_modification');
    expect(parsedRequest.type).toBe('combined');
    expect(parsedRequest.flights?.departureDate).toBe('2026-07-10');
    expect(parsedRequest.flights?.returnDate).toBe('2026-07-20');
    expect(parsedRequest.hotels?.checkinDate).toBe('2026-07-10');
    expect(parsedRequest.hotels?.checkoutDate).toBe('2026-07-20');
  });

  it('turns add-hotel follow-ups after a flight quote into a combined quote', () => {
    const { parsedRequest, iterationContext } = resolveApiTurnContext({
      persistentState: flightContext(),
      message: 'agregá hotel para las mismas fechas',
      parsedRequest: {
        type: 'flights',
        requestType: 'flights',
        originalMessage: 'agregá hotel para las mismas fechas',
        confidence: 0.88,
        flights: {
          destination: 'Madrid',
          returnDate: '2026-07-07',
          adults: 2,
        },
        hotels: {
          roomType: 'double',
        },
        iterationIntent: {
          isIteration: true,
          type: 'continuation',
          modifiedFields: [],
        },
      } as any,
    });

    expect(iterationContext.isIteration).toBe(true);
    expect(parsedRequest.type).toBe('combined');
    expect(parsedRequest.flights?.origin).toBe('Buenos Aires');
    expect(parsedRequest.flights?.destination).toBe('Madrid');
    expect(parsedRequest.flights?.departureDate).toBe('2026-07-01');
    expect(parsedRequest.flights?.returnDate).toBe('2026-07-07');
    expect(parsedRequest.flights?.adults).toBe(2);
    expect(parsedRequest.hotels?.city).toBe('Madrid');
    expect(parsedRequest.hotels?.checkinDate).toBe('2026-07-01');
    expect(parsedRequest.hotels?.checkoutDate).toBe('2026-07-07');
    expect(parsedRequest.hotels?.adults).toBe(2);
    expect(parsedRequest.hotels?.roomType).toBe('double');
  });

  it('preserves requested hotel name and chains when adding hotel to a flight quote', () => {
    const { parsedRequest } = resolveApiTurnContext({
      persistentState: flightContext(),
      message: 'agregá el hotel Riu Bambu para las mismas fechas',
      parsedRequest: {
        type: 'hotels',
        requestType: 'hotels',
        originalMessage: 'agregá el hotel Riu Bambu para las mismas fechas',
        confidence: 0.9,
        hotels: {
          hotelName: 'Riu Bambu',
          hotelChains: ['RIU'],
          roomType: 'double',
        },
        iterationIntent: {
          isIteration: true,
          type: 'continuation',
          modifiedFields: ['hotels.hotelName', 'hotels.hotelChains'],
        },
      } as any,
    });

    expect(parsedRequest.type).toBe('combined');
    expect(parsedRequest.flights?.origin).toBe('Buenos Aires');
    expect(parsedRequest.hotels?.city).toBe('Madrid');
    expect(parsedRequest.hotels?.hotelName).toBe('Riu Bambu');
    expect((parsedRequest.hotels as any)?.hotelChains).toEqual(['RIU']);
  });

  it('applies destination swaps to both products when the parser carries the old flight destination', () => {
    const { parsedRequest, iterationContext } = resolveApiTurnContext({
      persistentState: {
        lastSearch: {
          requestType: 'combined',
          timestamp: '2026-05-28T00:00:00.000Z',
          flightsParams: {
            origin: 'Buenos Aires',
            destination: 'Qaqortoq',
            departureDate: '2026-07-01',
            returnDate: '2026-07-07',
            adults: 2,
            children: 0,
            infants: 0,
            tripType: 'round_trip',
          },
          hotelsParams: {
            city: 'Qaqortoq',
            checkinDate: '2026-07-01',
            checkoutDate: '2026-07-07',
            adults: 2,
            children: 0,
            infants: 0,
          },
          resultsSummary: {
            flightsCount: 0,
            hotelsCount: 0,
          },
        },
        constraintsHistory: [],
        turnNumber: 1,
        schemaVersion: 1,
      },
      message: 'mejor Madrid',
      parsedRequest: {
        type: 'combined',
        requestType: 'combined',
        originalMessage: 'mejor Madrid',
        confidence: 0.9,
        flights: {
          origin: 'Buenos Aires',
          destination: 'Qaqortoq',
          departureDate: '2026-07-01',
          returnDate: '2026-07-07',
          adults: 2,
        },
        hotels: {
          city: 'Madrid',
          checkinDate: '2026-07-01',
          checkoutDate: '2026-07-07',
          adults: 2,
        },
        iterationIntent: {
          isIteration: true,
          type: 'destination_swap',
          modifiedFields: ['flights.destination', 'hotels.city'],
        },
      } as any,
    });

    expect(iterationContext.iterationType).toBe('destination_swap');
    expect(parsedRequest.type).toBe('combined');
    expect(parsedRequest.flights?.origin).toBe('Buenos Aires');
    expect(parsedRequest.flights?.destination).toBe('Madrid');
    expect(parsedRequest.hotels?.city).toBe('Madrid');
    expect(parsedRequest.flights?.departureDate).toBe('2026-07-01');
    expect(parsedRequest.hotels?.checkoutDate).toBe('2026-07-07');
  });
});
