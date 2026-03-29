/**
 * Emilia 5.0 — Conversational Router
 *
 * Scores the "definition level" of a parsed travel request and decides
 * the next action: QUOTE (search), COLLECT (ask 1-2 fields), or PLAN (propose trip structure).
 *
 * This is a deterministic function — no LLM calls. Runs in <1ms after the AI parser.
 */

import type { ParsedTravelRequest } from '@/services/aiMessageParser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmiliaRoute = 'QUOTE' | 'COLLECT' | 'PLAN';

export interface RouteResult {
  route: EmiliaRoute;
  score: number;
  dimensions: {
    destination: number;
    dates: number;
    passengers: number;
    origin: number;
    complexity: number;
  };
  missingFields: string[];
  inferredFields: string[];
  collectQuestion?: string;
  reason: string;
}

export interface InferredField {
  field: string;
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEIGHTS = {
  destination: 0.30,
  dates: 0.25,
  passengers: 0.15,
  origin: 0.15,
  complexity: 0.15,
} as const;

const QUOTE_THRESHOLD = 0.75;
const PLAN_THRESHOLD = 0.40;

/** Regions that require city-level resolution before any search */
const REGIONS = new Set([
  'europa', 'europe', 'asia', 'caribe', 'caribbean',
  'sudamerica', 'norteamerica', 'centroamerica', 'oceania', 'africa',
  'medio oriente', 'middle east', 'sudeste asiatico', 'southeast asia',
  'patagonia', 'escandinavia', 'scandinavia',
]);

/** Countries — need to propose cities before quoting */
const COUNTRIES = new Set([
  'argentina', 'brasil', 'brazil', 'chile', 'colombia', 'peru', 'mexico',
  'espana', 'spain', 'italia', 'italy', 'francia', 'france',
  'alemania', 'germany', 'portugal', 'grecia', 'greece',
  'turquia', 'turkey', 'japon', 'japan', 'china',
  'tailandia', 'thailand', 'india', 'estados unidos', 'usa', 'united states',
  'canada', 'australia', 'nueva zelanda', 'new zealand',
  'marruecos', 'morocco', 'egipto', 'egypt', 'sudafrica', 'south africa',
  'corea', 'korea', 'vietnam', 'indonesia', 'filipinas', 'philippines',
  'cuba', 'republica dominicana', 'dominican republic', 'costa rica', 'panama',
  'uruguay', 'paraguay', 'bolivia', 'ecuador', 'venezuela',
  'reino unido', 'uk', 'united kingdom', 'irlanda', 'ireland',
  'suiza', 'switzerland', 'austria', 'belgica', 'belgium',
  'holanda', 'netherlands', 'paises bajos',
  'noruega', 'norway', 'suecia', 'sweden', 'dinamarca', 'denmark',
  'finlandia', 'finland', 'croacia', 'croatia', 'hungria', 'hungary',
  'republica checa', 'czech republic', 'polonia', 'poland',
  'rumania', 'romania', 'rusia', 'russia',
]);

const FAMILY_WORDS = /\b(familia|familias|familiar|flia)\b/i;

const QUOTE_INTENT =
  /\b(cotiz|precio|cuanto\s*(sale|cuesta|me\s*sale)|tarifa|busca(me)?|dame\s*(un\s*)?(vuelo|hotel|pasaje))\b/;

const PLAN_INTENT =
  /\b(arma(me)?|planifica|itinerario|recorrido|ruta|circuito|viaje\s+por)\b/;

// ---------------------------------------------------------------------------
// COLLECT question templates
// ---------------------------------------------------------------------------

const COLLECT_QUESTIONS: Record<string, string> = {
  passengers: '¿Cuántas personas viajan? Por ejemplo: 2 adultos, o 2 adultos y 2 niños.',
  passengers_and_dates: '¿Cuántas personas viajan y en qué fechas?',
  dates: '¿En qué fechas viajás? Por ejemplo: del 15 al 22 de enero.',
  dates_hotel: '¿Qué fechas de check-in y check-out necesitás?',
  origin: '¿Desde qué ciudad salís?',
  origin_and_dates: '¿Desde dónde viajás y en qué fechas?',
  duration: '¿Cuántas noches te quedás?',
  fallback: '¿Podés darme más detalles sobre tu viaje?',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isRegionOrCountry(destination: string): boolean {
  const n = norm(destination);
  return REGIONS.has(n) || COUNTRIES.has(n);
}

// ---------------------------------------------------------------------------
// Dimension scorers
// ---------------------------------------------------------------------------

function scoreDestination(p: ParsedTravelRequest): number {
  // Itinerary destinations
  if (p.itinerary?.destinations?.length) {
    const allVague = p.itinerary.destinations.every(isRegionOrCountry);
    if (allVague) return 0;
    const someVague = p.itinerary.destinations.some(isRegionOrCountry);
    return someVague ? 0.5 : 1.0;
  }
  if (p.flights?.destination) {
    return isRegionOrCountry(p.flights.destination) ? 0.5 : 1.0;
  }
  if (p.hotels?.city) {
    return isRegionOrCountry(p.hotels.city) ? 0.5 : 1.0;
  }
  return 0;
}

function scoreDates(p: ParsedTravelRequest): number {
  if (p.flights?.departureDate) return 1.0;
  if (p.hotels?.checkinDate && p.hotels.checkoutDate) return 1.0;
  if (p.itinerary) {
    if (p.itinerary.startDate) return 1.0;
    if (p.itinerary.isFlexibleDates && p.itinerary.flexibleMonth) return 0.5;
    if (p.itinerary.days && p.itinerary.days > 0) return 0.3;
  }
  return 0;
}

function scorePassengers(p: ParsedTravelRequest): number {
  const msg = norm(p.originalMessage || '');
  // "Familia" without explicit count → ambiguous
  if (FAMILY_WORDS.test(msg)) {
    if (!p.flights?.adultsExplicit && !p.hotels?.adultsExplicit) return 0;
  }
  if (p.flights?.adultsExplicit || p.hotels?.adultsExplicit) return 1.0;
  // Default 1 adult is safe — score as 0.5 (implied, not explicit)
  return 0.5;
}

function scoreOrigin(p: ParsedTravelRequest): number {
  if (p.flights?.origin) return 1.0;
  if (p.requestType === 'hotels' || p.requestType === 'packages') return 1.0;
  if (p.requestType === 'itinerary') return 0.5; // can be inferred later
  return 0;
}

function scoreComplexity(p: ParsedTravelRequest): number {
  if (p.flights?.segments && p.flights.segments.length > 1) return 0.5;
  if (p.flights?.tripType === 'multi_city') return 0.5;
  if (p.itinerary?.destinations?.length) {
    if (p.itinerary.destinations.length > 3) return 0;
    if (p.itinerary.destinations.length > 1) return 0.5;
  }
  return 1.0;
}

// ---------------------------------------------------------------------------
// COLLECT question builder
// ---------------------------------------------------------------------------

function buildCollectQuestion(
  missing: string[],
  p: ParsedTravelRequest,
): string {
  const needsDates = missing.includes('dates');
  const needsPax = missing.includes('passengers');
  const needsOrigin = missing.includes('origin');

  if (needsPax && needsDates) return COLLECT_QUESTIONS.passengers_and_dates;
  if (needsOrigin && needsDates) return COLLECT_QUESTIONS.origin_and_dates;
  if (needsPax) return COLLECT_QUESTIONS.passengers;
  if (needsDates) {
    return p.requestType === 'hotels'
      ? COLLECT_QUESTIONS.dates_hotel
      : COLLECT_QUESTIONS.dates;
  }
  if (needsOrigin) return COLLECT_QUESTIONS.origin;
  return COLLECT_QUESTIONS.fallback;
}

// ---------------------------------------------------------------------------
// Inferred field detection
// ---------------------------------------------------------------------------

function detectInferredFields(p: ParsedTravelRequest): InferredField[] {
  const inferred: InferredField[] = [];

  // Adults defaulted to 1 (not explicitly stated)
  if (p.flights && !p.flights.adultsExplicit && p.flights.adults === 1) {
    inferred.push({ field: 'adults', value: '1', label: '1 adulto (por defecto)' });
  }
  if (p.hotels && !p.hotels.adultsExplicit && p.hotels.adults === 1) {
    inferred.push({ field: 'adults', value: '1', label: '1 adulto (por defecto)' });
  }

  // One-way assumed when no return date on a flight request
  if (
    p.flights?.departureDate &&
    !p.flights.returnDate &&
    p.flights.tripType !== 'multi_city' &&
    !p.flights.tripType // no explicit type → was inferred as one_way
  ) {
    inferred.push({ field: 'tripType', value: 'one_way', label: 'solo ida (sin fecha de vuelta)' });
  }

  return inferred;
}

// ---------------------------------------------------------------------------
// Search summary builder (non-blocking transparency)
// ---------------------------------------------------------------------------

export function buildSearchSummary(
  p: ParsedTravelRequest,
  inferred: InferredField[],
): string {
  const parts: string[] = [];

  if (p.requestType === 'flights' || p.requestType === 'combined') {
    const f = p.flights;
    if (f) {
      let desc = `vuelo ${f.origin || '?'}→${f.destination || '?'}`;
      if (f.departureDate) desc += `, ${formatDateShort(f.departureDate)}`;
      if (f.returnDate) desc += ` al ${formatDateShort(f.returnDate)}`;
      const pax = describePax(f.adults, f.children, f.infants);
      if (pax) desc += `, ${pax}`;
      parts.push(desc);
    }
  }

  if (p.requestType === 'hotels' || p.requestType === 'combined') {
    const h = p.hotels;
    if (h) {
      let desc = `hotel en ${h.city || '?'}`;
      if (h.checkinDate) desc += `, ${formatDateShort(h.checkinDate)}`;
      if (h.checkoutDate) desc += ` al ${formatDateShort(h.checkoutDate)}`;
      const pax = describePax(h.adults, h.children, h.infants);
      if (pax) desc += `, ${pax}`;
      parts.push(desc);
    }
  }

  if (parts.length === 0) return '';

  const inferredLabels = inferred.map(i => i.label);
  const base = `Busqué ${parts.join(' + ')}`;

  if (inferredLabels.length > 0) {
    return `${base}. _Datos asumidos: ${inferredLabels.join(', ')}._ Si querés cambiar algo, decime.`;
  }
  return base + '.';
}

function formatDateShort(iso: string): string {
  try {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}

function describePax(adults?: number, children?: number, infants?: number): string {
  const parts: string[] = [];
  if (adults && adults > 0) parts.push(`${adults} adulto${adults > 1 ? 's' : ''}`);
  if (children && children > 0) parts.push(`${children} niño${children > 1 ? 's' : ''}`);
  if (infants && infants > 0) parts.push(`${infants} bebé${infants > 1 ? 's' : ''}`);
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

export function routeRequest(
  parsed: ParsedTravelRequest,
  plannerState?: {
    generationMeta?: { isDraft?: boolean };
    segments?: unknown[];
  } | null,
): RouteResult {
  const dimensions = {
    destination: scoreDestination(parsed),
    dates: scoreDates(parsed),
    passengers: scorePassengers(parsed),
    origin: scoreOrigin(parsed),
    complexity: scoreComplexity(parsed),
  };

  const score =
    dimensions.destination * WEIGHTS.destination +
    dimensions.dates * WEIGHTS.dates +
    dimensions.passengers * WEIGHTS.passengers +
    dimensions.origin * WEIGHTS.origin +
    dimensions.complexity * WEIGHTS.complexity;

  // Detect missing critical fields
  const missingFields: string[] = [];
  if (dimensions.destination === 0) missingFields.push('destination');
  if (dimensions.dates === 0) missingFields.push('dates');
  if (dimensions.passengers === 0) missingFields.push('passengers');
  if (
    dimensions.origin === 0 &&
    parsed.requestType !== 'hotels' &&
    parsed.requestType !== 'packages'
  ) {
    missingFields.push('origin');
  }

  const msg = norm(parsed.originalMessage || '');
  const inferredFields = detectInferredFields(parsed).map(f => f.field);

  // ----- Intent overrides -----

  // Explicit itinerary type or planning language → PLAN
  if (parsed.requestType === 'itinerary' || PLAN_INTENT.test(msg)) {
    return {
      route: 'PLAN',
      score,
      dimensions,
      missingFields,
      inferredFields,
      reason:
        parsed.itinerary?.editIntent &&
        plannerState &&
        !plannerState.generationMeta?.isDraft
          ? 'edit_existing_plan'
          : 'itinerary_request',
    };
  }

  // Destination is region/country (no city) → PLAN regardless of other fields
  if (dimensions.destination === 0.5 && dimensions.complexity < 1) {
    return {
      route: 'PLAN',
      score,
      dimensions,
      missingFields,
      inferredFields,
      reason: 'destination_too_vague',
    };
  }
  if (dimensions.destination === 0 && !missingFields.includes('destination')) {
    return {
      route: 'PLAN',
      score,
      dimensions,
      missingFields,
      inferredFields,
      reason: 'destination_too_vague',
    };
  }

  // Explicit quote intent with at least a city-level destination → QUOTE or COLLECT
  if (QUOTE_INTENT.test(msg) && dimensions.destination >= 1.0) {
    if (score >= QUOTE_THRESHOLD) {
      return {
        route: 'QUOTE',
        score,
        dimensions,
        missingFields,
        inferredFields,
        reason: 'quote_intent_complete',
      };
    }
    const q = buildCollectQuestion(missingFields, parsed);
    return {
      route: 'COLLECT',
      score,
      dimensions,
      missingFields,
      inferredFields,
      collectQuestion: q,
      reason: 'quote_intent_incomplete',
    };
  }

  // ----- Score-based routing -----

  if (score >= QUOTE_THRESHOLD) {
    return {
      route: 'QUOTE',
      score,
      dimensions,
      missingFields,
      inferredFields,
      reason: 'high_definition',
    };
  }

  if (score >= PLAN_THRESHOLD) {
    const q = buildCollectQuestion(missingFields, parsed);
    return {
      route: 'COLLECT',
      score,
      dimensions,
      missingFields,
      inferredFields,
      collectQuestion: q,
      reason: 'needs_clarification',
    };
  }

  // Low score → PLAN
  return {
    route: 'PLAN',
    score,
    dimensions,
    missingFields,
    inferredFields,
    reason: 'low_definition',
  };
}

/**
 * Returns the detailed list of inferred fields with labels, for building summaries.
 * Use this in the message handler after routing — routeRequest only returns field names.
 */
export function getInferredFieldDetails(parsed: ParsedTravelRequest): InferredField[] {
  return detectInferredFields(parsed);
}

// ---------------------------------------------------------------------------
// Destructive change detection
// ---------------------------------------------------------------------------

interface PlannerSegmentSlim {
  id?: string;
  city?: string;
  hotelPlan?: {
    matchStatus?: string;
    searchStatus?: string;
    confirmedInventoryHotel?: unknown;
    selectedHotelId?: string;
  };
  transportIn?: {
    searchStatus?: string;
    selectedOptionId?: string;
  };
  transportOut?: {
    searchStatus?: string;
    selectedOptionId?: string;
  };
}

export interface DestructiveWarning {
  hasQuotedHotels: boolean;
  hasSelectedFlights: boolean;
  affectedCities: string[];
  message: string;
}

/**
 * Checks if modifying the plan would destroy quoted/selected data.
 * Call this before executing plan modifications via the planner agent.
 */
export function detectDestructiveChanges(
  segments: PlannerSegmentSlim[],
): DestructiveWarning | null {
  const quotedHotelCities: string[] = [];
  const selectedFlightCities: string[] = [];

  for (const seg of segments) {
    const city = seg.city || '?';

    if (
      seg.hotelPlan?.matchStatus === 'quoted' ||
      seg.hotelPlan?.matchStatus === 'matched' ||
      seg.hotelPlan?.confirmedInventoryHotel ||
      seg.hotelPlan?.selectedHotelId
    ) {
      quotedHotelCities.push(city);
    }

    if (seg.transportIn?.selectedOptionId || seg.transportOut?.selectedOptionId) {
      selectedFlightCities.push(city);
    }
  }

  if (quotedHotelCities.length === 0 && selectedFlightCities.length === 0) {
    return null;
  }

  const parts: string[] = [];
  if (quotedHotelCities.length > 0) {
    parts.push(`hotel${quotedHotelCities.length > 1 ? 'es' : ''} cotizado${quotedHotelCities.length > 1 ? 's' : ''} en ${quotedHotelCities.join(', ')}`);
  }
  if (selectedFlightCities.length > 0) {
    parts.push(`vuelo${selectedFlightCities.length > 1 ? 's' : ''} seleccionado${selectedFlightCities.length > 1 ? 's' : ''} para ${selectedFlightCities.join(', ')}`);
  }

  return {
    hasQuotedHotels: quotedHotelCities.length > 0,
    hasSelectedFlights: selectedFlightCities.length > 0,
    affectedCities: [...new Set([...quotedHotelCities, ...selectedFlightCities])],
    message: `Este cambio puede afectar ${parts.join(' y ')}. ¿Querés continuar?`,
  };
}
