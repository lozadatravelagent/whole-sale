/**
 * Delfos FlightOffer → Wholesale canonical flight item (searchExecutor shape).
 * Pure — no Deno/network. Search-only; preserves offer_id for future booking.
 */

function parseMoneyAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100) / 100;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.round(n * 100) / 100;
  }
  return 0;
}

function splitNaiveDateTime(value: unknown): { date: string; time: string } {
  const raw = String(value || '');
  // "2026-08-15T22:00:00" or ISO with Z
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2})?/);
  if (m) return { date: m[1], time: m[2] };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { date: raw, time: '' };
  return { date: '', time: '' };
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return 'N/A';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export interface MapFlightsContext {
  adults?: number;
  children?: number;
  infants?: number;
  tripType?: string;
}

/**
 * Map one Delfos FlightOffer to canonical flight item.
 */
export function mapDelfosFlightOffer(offer: any, ctx: MapFlightsContext = {}): any {
  const journeys = Array.isArray(offer?.journeys) ? offer.journeys : [];
  const firstJourney = journeys[0] || {};
  const firstSegments = Array.isArray(firstJourney.segments) ? firstJourney.segments : [];
  const firstSeg = firstSegments[0] || {};
  const lastSeg = firstSegments[firstSegments.length - 1] || firstSeg;

  const dep = splitNaiveDateTime(firstSeg.departure_at || firstJourney.departure_at);
  const arr = splitNaiveDateTime(lastSeg.arrival_at || firstJourney.arrival_at);

  let returnDate: string | null = null;
  if (journeys.length > 1) {
    const retSeg = journeys[1]?.segments?.[0];
    returnDate = splitNaiveDateTime(retSeg?.departure_at || journeys[1]?.departure_at).date || null;
  }

  const totalStops = journeys.reduce((sum: number, j: any) => sum + (Number(j?.layovers) || 0), 0);
  const durationMinutes = Number(firstJourney.duration_minutes) || 0;
  const totalAmount = parseMoneyAmount(offer?.price?.total?.amount);
  const currency = String(offer?.price?.total?.currency || 'USD').toUpperCase();

  const marketing = String(firstSeg.marketing_carrier || offer?.validating_carrier || 'N/A');
  const operating = String(firstSeg.operating_carrier || marketing);

  const routeType = String(offer?.route_type || '').toUpperCase();
  const tripType =
    ctx.tripType ||
    (routeType === 'ROUND_TRIP' || journeys.length > 1 ? 'round_trip' : 'one_way');

  return {
    id: String(offer?.offer_id || `delfos-flight-${marketing}-${dep.date}`),
    airline: {
      code: marketing,
      name: operating || marketing,
    },
    price: {
      amount: totalAmount,
      currency,
      netAmount: totalAmount,
      taxAmount: 0,
      fareAmount: totalAmount,
    },
    adults: ctx.adults ?? 1,
    children: ctx.children ?? 0,
    childrens: ctx.children ?? 0,
    infants: ctx.infants ?? 0,
    departure_date: dep.date,
    departure_time: dep.time,
    arrival_date: arr.date,
    arrival_time: arr.time,
    return_date: returnDate,
    trip_type: tripType,
    duration: {
      total: durationMinutes,
      formatted: formatDuration(durationMinutes),
    },
    stops: {
      count: totalStops,
      direct: totalStops === 0,
      connections: totalStops,
    },
    baggage: {
      included: false,
      details: '',
      quantity: 0,
    },
    cabin: {
      class: 'Y',
      brandName: 'Economy',
    },
    booking: {
      validatingCarrier: String(offer?.validating_carrier || marketing),
      lastTicketingDate: offer?.time_limits?.last_ticket_date || '',
      fareType: offer?.is_private_fare ? 'PRIVATE' : 'PUBLIC',
    },
    legs: journeys.map((journey: any, legIndex: number) => {
      const segments = Array.isArray(journey?.segments) ? journey.segments : [];
      return {
        legNumber: legIndex + 1,
        options: [
          {
            optionId: `${offer?.offer_id || 'off'}-leg${legIndex}`,
            duration: Number(journey?.duration_minutes) || 0,
            segments: segments.map((segment: any) => {
              const sDep = splitNaiveDateTime(segment.departure_at);
              const sArr = splitNaiveDateTime(segment.arrival_at);
              return {
                airline: String(segment.marketing_carrier || ''),
                operatingAirline: String(segment.operating_carrier || ''),
                flightNumber: String(segment.flight_number || ''),
                departure: {
                  airportCode: String(segment.origin || ''),
                  date: sDep.date,
                  time: sDep.time,
                },
                arrival: {
                  airportCode: String(segment.destination || ''),
                  date: sArr.date,
                  time: sArr.time,
                },
                duration: 0,
                cabinClass: 'Y',
                baggage: '',
              };
            }),
          },
        ],
      };
    }),
    provider: 'DELFOS',
    providerOfferId: String(offer?.offer_id || ''),
    providerMeta: {
      priceableUntil: offer?.priceable_until ? String(offer.priceable_until) : undefined,
      sourceProvider: String(offer?.provider || 'lleego'),
    },
    transactionId: '',
  };
}

export function mapDelfosFlightOffers(offers: any[], ctx: MapFlightsContext = {}): any[] {
  if (!Array.isArray(offers)) return [];
  return offers.map((offer) => mapDelfosFlightOffer(offer, ctx));
}
