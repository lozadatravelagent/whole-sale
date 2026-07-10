/**
 * Build Delfos OpenAPI request bodies from Wholesale-ish search params.
 * Pure helpers.
 */

export interface FlightSearchInput {
  /** Pre-built journeys (IATA + date) */
  journeys?: Array<{ origin: string; destination: string; date: string }>;
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  infants?: number;
  /** Explicit ages override ADT/CHD/INF expansion */
  ages?: number[];
  maxResults?: number;
  tripType?: string;
  segments?: Array<{ origin: string; destination: string; departureDate: string }>;
}

export interface HotelSearchInput {
  checkIn?: string;
  checkOut?: string;
  checkinDate?: string;
  checkoutDate?: string;
  adults?: number;
  children?: number;
  infants?: number;
  childrenAges?: number[];
  hotelCodes?: string[];
  city?: string;
}

function iata3(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .slice(0, 3);
}

function expandAges(adults: number, children: number, infants: number): number[] {
  const ages: number[] = [];
  for (let i = 0; i < Math.max(0, adults); i++) ages.push(30);
  for (let i = 0; i < Math.max(0, children); i++) ages.push(8);
  for (let i = 0; i < Math.max(0, infants); i++) ages.push(1);
  return ages.length > 0 ? ages : [30];
}

export type BuildFlightResult =
  | { ok: true; body: Record<string, unknown>; ctx: { adults: number; children: number; infants: number; tripType: string } }
  | { ok: false; code: 'UNSUPPORTED_ITINERARY' | 'INVALID_REQUEST'; message: string };

export function buildDelfosFlightSearchBody(input: FlightSearchInput): BuildFlightResult {
  let journeys: Array<{ origin: string; destination: string; date: string }> = [];

  if (Array.isArray(input.journeys) && input.journeys.length > 0) {
    journeys = input.journeys.map((j) => ({
      origin: iata3(j.origin),
      destination: iata3(j.destination),
      date: String(j.date || '').slice(0, 10),
    }));
  } else if (Array.isArray(input.segments) && input.segments.length > 0) {
    journeys = input.segments.map((s) => ({
      origin: iata3(s.origin),
      destination: iata3(s.destination),
      date: String(s.departureDate || '').slice(0, 10),
    }));
  } else if (input.origin && input.destination && input.departureDate) {
    journeys = [
      {
        origin: iata3(input.origin),
        destination: iata3(input.destination),
        date: String(input.departureDate).slice(0, 10),
      },
    ];
    if (input.returnDate) {
      journeys.push({
        origin: iata3(input.destination),
        destination: iata3(input.origin),
        date: String(input.returnDate).slice(0, 10),
      });
    }
  }

  if (journeys.length === 0) {
    return { ok: false, code: 'INVALID_REQUEST', message: 'At least one journey is required' };
  }
  if (journeys.length > 2) {
    return {
      ok: false,
      code: 'UNSUPPORTED_ITINERARY',
      message: 'Delfos supports at most 2 journeys (one-way or round-trip); multi-city skipped',
    };
  }

  for (const j of journeys) {
    if (!/^[A-Z]{3}$/.test(j.origin) || !/^[A-Z]{3}$/.test(j.destination) || !/^\d{4}-\d{2}-\d{2}$/.test(j.date)) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'Invalid journey origin/destination/date' };
    }
    if (j.origin === j.destination) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'Journey origin and destination must differ' };
    }
  }

  const adults = Math.max(1, Number(input.adults) || 1);
  const children = Math.max(0, Number(input.children) || 0);
  const infants = Math.max(0, Number(input.infants) || 0);
  const ages =
    Array.isArray(input.ages) && input.ages.length > 0
      ? input.ages.map((a) => Math.min(120, Math.max(0, Number(a) || 0))).slice(0, 9)
      : expandAges(adults, children, infants).slice(0, 9);

  const tripType =
    input.tripType ||
    (journeys.length > 1 ? 'round_trip' : 'one_way');

  const body: Record<string, unknown> = {
    journeys,
    passengers: { ages },
    options: {
      max_results: Math.min(20, Math.max(1, Number(input.maxResults) || 20)),
    },
  };

  return {
    ok: true,
    body,
    ctx: { adults, children, infants, tripType },
  };
}

export type BuildHotelResult =
  | { ok: true; body: Record<string, unknown>; ctx: { checkIn: string; checkOut: string; city?: string; adults: number; children: number; infants: number; childrenAges: number[] } }
  | { ok: false; code: 'INVALID_REQUEST'; message: string };

export function buildDelfosHotelSearchBody(input: HotelSearchInput): BuildHotelResult {
  const checkIn = String(input.checkIn || input.checkinDate || '').slice(0, 10);
  const checkOut = String(input.checkOut || input.checkoutDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    return { ok: false, code: 'INVALID_REQUEST', message: 'check_in and check_out (YYYY-MM-DD) are required' };
  }
  if (checkOut <= checkIn) {
    return { ok: false, code: 'INVALID_REQUEST', message: 'check_out must be after check_in' };
  }

  const adults = Math.max(1, Number(input.adults) || 1);
  const children = Math.max(0, Number(input.children) || 0);
  const infants = Math.max(0, Number(input.infants) || 0);
  const childrenAges = Array.isArray(input.childrenAges)
    ? input.childrenAges.map((a) => Math.min(17, Math.max(0, Number(a) || 0))).slice(0, 9)
    : Array.from({ length: children }, () => 8);

  const room: Record<string, unknown> = { adults };
  if (childrenAges.length > 0) room.children_ages = childrenAges;

  const body: Record<string, unknown> = {
    check_in: checkIn,
    check_out: checkOut,
    rooms: [room], // Delfos Fase 1: max 1 room
  };

  if (Array.isArray(input.hotelCodes) && input.hotelCodes.length > 0) {
    body.hotel_codes = input.hotelCodes.map(String).slice(0, 100);
  }

  return {
    ok: true,
    body,
    ctx: {
      checkIn,
      checkOut,
      city: input.city,
      adults,
      children,
      infants,
      childrenAges,
    },
  };
}
