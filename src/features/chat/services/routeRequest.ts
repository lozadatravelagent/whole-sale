/**
 * Emilia 5.0 — Conversational Router
 *
 * Scores the "definition level" of a parsed travel request and decides
 * the next action: QUOTE (search), COLLECT (ask 1-2 fields), or PLAN (propose trip structure).
 *
 * This is a deterministic function — no LLM calls. Runs in <1ms after the AI parser.
 */

import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import { buildEmiliaSearchNarrative } from './emiliaNarrative';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmiliaRoute = 'QUOTE' | 'COLLECT' | 'PLAN';

/**
 * Typed reason codes emitted by the deterministic router. Replaces the legacy
 * free-form `string` field. The orchestrator consumes a separate
 * `OrchestratorReason` union (defined in conversationOrchestrator.ts).
 *
 * load-bearing literals: `quote_active_plan` (used as a string equality check
 * by the orchestrator G4 guard and the bridge resolver) and
 * `quote_intent_incomplete` (used by the orchestrator's
 * shouldAskMinimalQuestion heuristic).
 */
export type RouterReason =
  | 'quote_active_plan'
  | 'edit_existing_plan'
  | 'itinerary_request'
  | 'destination_too_vague'
  | 'quote_intent_complete'
  | 'quote_intent_incomplete'
  | 'high_definition'
  | 'needs_clarification'
  | 'low_definition'
  // NEW codes (Phase 2 / sub-task B):
  | 'safe_defaults_applied'
  | 'ordered_products_ready'
  | 'hotel_exact_ready'
  | 'origin_missing_no_geo'
  | 'minor_ages_needed'
  // Phase 5 / sub-task C: exploratory-but-actionable. The user named a
  // destination + traveler context but the request didn't cleanly map to a
  // QUOTE-ready payload. The orchestrator routes this to a one-click search
  // proposal (`proposal_chip` branch) instead of asking another clarification
  // question.
  | 'exploratory_with_seeds';

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
  reason: RouterReason;
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
  'sudamerica', 'sudamérica', 'america del sur', 'américa del sur', 'south america',
  'norteamerica', 'norteamérica', 'america del norte', 'américa del norte', 'north america',
  'centroamerica', 'centroamérica', 'america central', 'américa central', 'central america',
  'oceania', 'oceanía', 'africa', 'áfrica',
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

// ---------------------------------------------------------------------------
// LEGACY intent regexes (Spanish-only)
//
// As of prompt v18 these signals are emitted by the AI parser as semantic
// fields on `ParsedTravelRequest`:
//   - travelerType === 'family'      replaces LEGACY_FAMILY_WORDS_REGEX
//   - quoteIntent === true           replaces LEGACY_QUOTE_INTENT_REGEX
//   - planIntent === true            replaces LEGACY_PLAN_INTENT_REGEX
//   - referencesCurrentPlan === true replaces LEGACY_CURRENT_PLAN_REFERENCE_REGEX
//
// These regexes are retained ONLY as a defensive fallback for cached/older
// parser outputs that lack the semantic fields. Each helper below probes the
// semantic field first and falls back to the regex when the field is
// undefined.
//
// REMOVE after one release cycle once all callers reliably emit v18+
// semantic fields (telemetry: zero `[router] legacy_fallback` events in 7d).
// ---------------------------------------------------------------------------

const LEGACY_FAMILY_WORDS_REGEX = /\b(familia|familias|familiar|flia)\b/i;

const LEGACY_QUOTE_INTENT_REGEX =
  /\b(cotiz\w*|precio|presupuesto|valor|cuanto\s*(sale|cuesta|me\s*sale)|tarifa|busca(me)?|dame\s*(un\s*)?(vuelo|hotel|pasaje))\b/;

const LEGACY_PLAN_INTENT_REGEX =
  /\b(arma(me)?|planifica|itinerario|recorrido|ruta|circuito|viaje\s+por)\b/;

const LEGACY_CURRENT_PLAN_REFERENCE_REGEX =
  /\b(este|esta|ese|esa|el|la)\s+(viaje|plan|itinerario|recorrido|propuesta)\b|\b(esto|eso|lo\s+(anterior|que\s+armamos|que\s+te\s+propuse))\b/;

// ---------------------------------------------------------------------------
// COLLECT question templates — moved to `chatResultCopy.ts` as
// `COLLECT_QUESTIONS_COPY` (es/en/pt) so the Voice Layer can localize the
// focused question. The legacy hardcoded ES map was deleted in Phase 3 / B.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Semantic-field helpers (Phase 4 / sub-task B)
//
// These helpers prefer the parser's semantic boolean fields (multilingual,
// emitted by prompt v18+) and fall back to the legacy Spanish regexes only
// when the field is undefined (older cached parses or missing parser
// output). Internal — do not export.
// ---------------------------------------------------------------------------

function hasQuoteIntent(parsed: ParsedTravelRequest, msg: string): boolean {
  if (typeof parsed.quoteIntent === 'boolean') return parsed.quoteIntent;
  return LEGACY_QUOTE_INTENT_REGEX.test(msg);
}

function hasPlanIntent(parsed: ParsedTravelRequest, msg: string): boolean {
  if (typeof parsed.planIntent === 'boolean') return parsed.planIntent;
  return LEGACY_PLAN_INTENT_REGEX.test(msg);
}

function referencesCurrentPlan(parsed: ParsedTravelRequest, msg: string): boolean {
  if (typeof parsed.referencesCurrentPlan === 'boolean') return parsed.referencesCurrentPlan;
  return LEGACY_CURRENT_PLAN_REFERENCE_REGEX.test(msg);
}

function isFamilyTravel(parsed: ParsedTravelRequest, msg: string): boolean {
  if (parsed.travelerType === 'family') return true;
  // Pax-based inference: any explicit children present implies a family
  // travel context regardless of language.
  const flightChildren = parsed.flights?.children ?? 0;
  const hotelChildren = parsed.hotels?.children ?? 0;
  const itineraryChildren = parsed.itinerary?.travelers?.children ?? 0;
  if (flightChildren > 0 || hotelChildren > 0 || itineraryChildren > 0) {
    return true;
  }
  // Fall back to legacy regex only when travelerType wasn't set at all.
  if (parsed.travelerType === undefined) {
    return LEGACY_FAMILY_WORDS_REGEX.test(msg);
  }
  return false;
}

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

function hasActivePlannerState(
  plannerState?: {
    generationMeta?: { isDraft?: boolean };
    segments?: unknown[];
  } | null,
): boolean {
  return Boolean(plannerState && !plannerState.generationMeta?.isDraft);
}

function isQuoteActivePlanIntent(
  parsed: ParsedTravelRequest,
  msg: string,
  plannerState?: {
    generationMeta?: { isDraft?: boolean };
    segments?: unknown[];
  } | null,
): boolean {
  if (!hasActivePlannerState(plannerState)) return false;
  if (!hasQuoteIntent(parsed, msg)) return false;
  if (referencesCurrentPlan(parsed, msg)) return true;
  return parsed.requestType === 'itinerary' && parsed.itinerary?.editIntent === true;
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
  const flightPax = (p.flights?.adults || 0) + (p.flights?.children || 0) + (p.flights?.infants || 0);
  const hotelPax = (p.hotels?.adults || 0) + (p.hotels?.children || 0) + (p.hotels?.infants || 0);
  const itineraryPax = (p.itinerary?.travelers?.adults || 0) + (p.itinerary?.travelers?.children || 0) + (p.itinerary?.travelers?.infants || 0);

  // Safe-default rule: a default the parser deemed safe (adults=1, not explicit)
  // is actionable, not missing. Score as 1.0. Genuine ambiguity — e.g. "familia"
  // with no adult fallback applied — still returns 0.
  const flightHasSafeDefault = p.flights?.adults === 1 && !p.flights.adultsExplicit;
  const hotelHasSafeDefault = p.hotels?.adults === 1 && !p.hotels.adultsExplicit;

  if (isFamilyTravel(p, msg)) {
    if (flightPax >= 4 || hotelPax >= 4 || itineraryPax >= 4) return 1.0;
    // Parser fallback to adults=1 still counts as a safe default for "familia".
    if (flightHasSafeDefault || hotelHasSafeDefault) return 1.0;
    // Family signal with NO adults default applied → genuine ambiguity.
    if (!p.flights?.adultsExplicit && !p.hotels?.adultsExplicit) return 0;
  }
  if (p.flights?.adultsExplicit || p.hotels?.adultsExplicit) return 1.0;
  // Default 1 adult is a safe default — treat as actionable, not missing.
  if (flightHasSafeDefault || hotelHasSafeDefault) return 1.0;
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
// Phase 3 / sub-task B — Voice Layer wrapper.
//
// Delegates to `buildEmiliaSearchNarrative({mode:'collect', style:'focused'})`
// so all user-facing copy emits through ONE consistent voice. Signature
// preserved for back-compat (consumer at `useMessageHandler.ts` reads
// `routeResult.collectQuestion: string` as a fallback message). The new path
// also gains en/pt support — the legacy implementation was hardcoded ES.

function buildCollectQuestion(
  missing: string[],
  p: ParsedTravelRequest,
): string {
  return buildEmiliaSearchNarrative({
    mode: 'collect',
    style: 'focused',
    missingFields: missing,
    normalized: p,
    language: p.responseLanguage ?? 'es',
  }).text;
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

/**
 * Phase 2 / sub-task D — Voice Layer wrapper.
 *
 * The body delegates to `buildEmiliaSearchNarrative({mode:'search_summary'})`
 * so we have ONE consistent voice across all 5 user-facing emitters. Signature
 * is preserved for back-compat (the legacy single call site in
 * `useMessageHandler.ts` stays untouched). The new path also gains en/pt
 * support — the legacy implementation was hardcoded ES.
 */
export function buildSearchSummary(
  p: ParsedTravelRequest,
  inferred: InferredField[],
): string {
  return buildEmiliaSearchNarrative({
    mode: 'search_summary',
    normalized: p,
    defaultsApplied: inferred,
    language: p.responseLanguage ?? 'es',
  }).text;
}

// ---------------------------------------------------------------------------
// Reason-code dispatch (Phase 2 / sub-task B)
// ---------------------------------------------------------------------------

/**
 * Picks a router reason for the score >= QUOTE_THRESHOLD branch. Inspects the
 * parsed request shape to detect whether the high score came from a
 * hotel-exact match, a fully ordered multi-product request, parser-safe
 * defaults, or a generic high-confidence signal.
 */
function pickHighScoreQuoteReason(
  parsed: ParsedTravelRequest,
  inferredFields: string[],
): RouterReason {
  // hotel-exact: hotels with exact dates + city + a hotelName/chain target
  if (
    parsed.requestType === 'hotels' &&
    parsed.hotels?.checkinDate &&
    parsed.hotels?.checkoutDate &&
    parsed.hotels?.city &&
    (parsed.hotels.hotelName || (parsed.hotels.hotelChains && parsed.hotels.hotelChains.length > 0))
  ) {
    return 'hotel_exact_ready';
  }

  // ordered multi-product request (combined/packages, or flights with explicit
  // tripType + an ordered productOrder array)
  const hasOrderedProducts = (parsed.productOrder?.length ?? 0) > 0;
  if (hasOrderedProducts) {
    if (
      parsed.requestType === 'combined' ||
      parsed.requestType === 'packages' ||
      (parsed.requestType === 'flights' && Boolean(parsed.flights?.tripType))
    ) {
      return 'ordered_products_ready';
    }
  }

  // parser-safe defaults filled gaps (adults=1 default, one-way inferred, etc.)
  if (inferredFields.length > 0) {
    return 'safe_defaults_applied';
  }

  // fallback: high score with no other distinguishing signal
  return 'high_definition';
}

/**
 * Picks a router reason for the score >= PLAN_THRESHOLD COLLECT branch.
 * Detects the two priority cases (origin missing on flight-bearing requests,
 * minor ages needed) and falls back to the generic clarification reason.
 */
function pickCollectReason(
  parsed: ParsedTravelRequest,
  missingFields: string[],
): RouterReason {
  // Phase 5 / sub-task C — exploratory-but-actionable.
  // When the parser emits `searchSeeds` with a concrete destination AND
  // either explicit traveler context (travelerType) OR adults > 0, we have
  // enough to PROPOSE a search via chips instead of asking another
  // clarification question. The route stays COLLECT (the orchestrator
  // branches on the reason code), keeping a clean separation between the
  // deterministic router and the proposal-chip rendering layer.
  const seeds = parsed.searchSeeds;
  if (
    seeds &&
    seeds.destination &&
    (seeds.travelerType || (typeof seeds.adults === 'number' && seeds.adults > 0))
  ) {
    return 'exploratory_with_seeds';
  }

  // children mentioned but ages not provided — need ages for accurate quoting
  const hasChildrenWithoutAges =
    ((parsed.flights?.children ?? 0) > 0 &&
      !(parsed.flights?.childrenAges && parsed.flights.childrenAges.length > 0)) ||
    ((parsed.hotels?.children ?? 0) > 0 &&
      !(parsed.hotels?.childrenAges && parsed.hotels.childrenAges.length > 0));
  if (hasChildrenWithoutAges) {
    return 'minor_ages_needed';
  }

  // origin missing on a flight-bearing request. Spec intent: surface this
  // distinct reason whenever a flight-bearing request needs origin and no
  // geo hint is available so the UI can show a geo-aware prompt instead of
  // the generic clarification ask. Note: the gate is not strict-only because
  // the COLLECT branch only fires when score < QUOTE_THRESHOLD, which is
  // unreachable when origin is the SOLE missing dimension under current
  // scoring (other dimensions full → score 0.85 → QUOTE).
  const isFlightBearing =
    parsed.requestType === 'flights' || parsed.requestType === 'combined';
  if (isFlightBearing && missingFields.includes('origin')) {
    return 'origin_missing_no_geo';
  }

  return 'needs_clarification';
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

  if (isQuoteActivePlanIntent(parsed, msg, plannerState)) {
    return {
      route: 'QUOTE',
      score,
      dimensions,
      missingFields,
      inferredFields,
      reason: 'quote_active_plan',
    };
  }

  // Explicit itinerary type or planning language → PLAN
  if (parsed.requestType === 'itinerary' || hasPlanIntent(parsed, msg)) {
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
  if (hasQuoteIntent(parsed, msg) && dimensions.destination >= 1.0) {
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
      reason: pickHighScoreQuoteReason(parsed, inferredFields),
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
      reason: pickCollectReason(parsed, missingFields),
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
