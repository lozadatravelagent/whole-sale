export type FlightTripType = 'one_way' | 'round_trip' | 'multi_city';

export interface FlightSegmentInput {
  origin?: string;
  destination?: string;
  departureDate?: string;
}

interface FlightRequestLike {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  tripType?: FlightTripType;
  segments?: FlightSegmentInput[];
  [key: string]: unknown;
}

function cleanValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSegment(segment: FlightSegmentInput): Required<FlightSegmentInput> {
  return {
    origin: cleanValue(segment.origin),
    destination: cleanValue(segment.destination),
    departureDate: cleanValue(segment.departureDate),
  };
}

function buildLegacySegments(flights: FlightRequestLike): Required<FlightSegmentInput>[] {
  const origin = cleanValue(flights.origin);
  const destination = cleanValue(flights.destination);
  const departureDate = cleanValue(flights.departureDate);
  const returnDate = cleanValue(flights.returnDate);
  const segments: Required<FlightSegmentInput>[] = [];

  if (origin || destination || departureDate) {
    segments.push({ origin, destination, departureDate });
  }

  if (returnDate) {
    segments.push({
      origin: destination,
      destination: origin,
      departureDate: returnDate,
    });
  }

  return segments;
}

function isReverseRoute(
  outbound: Required<FlightSegmentInput>,
  inbound: Required<FlightSegmentInput>
): boolean {
  return (
    outbound.origin.toLowerCase() === inbound.destination.toLowerCase() &&
    outbound.destination.toLowerCase() === inbound.origin.toLowerCase()
  );
}

export function inferTripTypeFromSegments(
  segments: Array<Required<FlightSegmentInput>>,
  explicitTripType?: string
): FlightTripType {
  if (explicitTripType === 'multi_city' || explicitTripType === 'round_trip' || explicitTripType === 'one_way') {
    return explicitTripType;
  }

  if (segments.length <= 1) return 'one_way';
  if (segments.length === 2 && isReverseRoute(segments[0], segments[1])) return 'round_trip';
  return 'multi_city';
}

export function getNormalizedFlightSegments(flights?: FlightRequestLike | null): Array<Required<FlightSegmentInput>> {
  if (!flights) return [];

  const providedSegments = Array.isArray(flights.segments)
    ? flights.segments.map((segment, index) => {
        const normalized = normalizeSegment(segment || {});

        if (index === 0) {
          return {
            origin: normalized.origin || cleanValue(flights.origin),
            destination: normalized.destination || cleanValue(flights.destination),
            departureDate: normalized.departureDate || cleanValue(flights.departureDate),
          };
        }

        return normalized;
      })
    : [];

  const nonEmptyProvidedSegments = providedSegments.filter(
    (segment) => segment.origin || segment.destination || segment.departureDate
  );

  if (nonEmptyProvidedSegments.length === 1 && cleanValue(flights.returnDate)) {
    const first = nonEmptyProvidedSegments[0];
    nonEmptyProvidedSegments.push({
      origin: first.destination,
      destination: first.origin,
      departureDate: cleanValue(flights.returnDate),
    });
  }

  if (nonEmptyProvidedSegments.length > 0) {
    return nonEmptyProvidedSegments;
  }

  return buildLegacySegments(flights);
}

export function normalizeFlightRequest<T extends FlightRequestLike | undefined | null>(flights: T): T {
  if (!flights) return flights;

  const segments = getNormalizedFlightSegments(flights);
  if (segments.length === 0) return flights;

  const tripType = inferTripTypeFromSegments(segments, cleanValue(flights.tripType));
  const firstSegment = segments[0];
  const normalized = {
    ...flights,
    origin: firstSegment.origin,
    destination: firstSegment.destination,
    departureDate: firstSegment.departureDate,
    tripType,
    segments,
  } as FlightRequestLike;

  if (tripType === 'round_trip' && segments[1]?.departureDate) {
    normalized.returnDate = segments[1].departureDate;
  } else {
    delete normalized.returnDate;
  }

  return normalized as T;
}

export function normalizeParsedFlightRequest<T extends { flights?: FlightRequestLike | null }>(parsed: T): T {
  if (!parsed?.flights) return parsed;

  return {
    ...parsed,
    flights: normalizeFlightRequest(parsed.flights),
  };
}
