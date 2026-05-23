/**
 * run-eval-report.ts
 * =============================================================================
 * Standalone eval report for the AI message parser golden fixtures.
 *
 * This script does NOT call the real OpenAI API. It:
 *   1. Reads the golden fixtures from `fixtures/parser-golden.json`
 *   2. Runs the deterministic `routeRequest` against each fixture's expected
 *      ParsedTravelRequest shape (the only part testable outside the edge function)
 *   3. Prints an ASCII results table
 *   4. Prints a summary line
 *   5. Exits with code 1 if any assertion fails
 *
 * Usage (from repo root):
 *   npx tsx tests/evals/run-eval-report.ts
 *   # or
 *   node --loader ts-node/esm tests/evals/run-eval-report.ts
 *
 * What each column means:
 *   ID              — fixture id
 *   expected type   — expected requestType from the fixture
 *   expected route  — expected QUOTE/COLLECT/PLAN from the fixture
 *   actual route    — what routeRequest actually returned
 *   result          — PASS or FAIL
 *
 * Note: The "actual requestType" column is always equal to the fixture's
 * expected.requestType because we feed the router exactly that value. The
 * meaningful assertion is the route decision.
 * =============================================================================
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ---- Resolve __dirname for ESM ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Load fixtures ----
const require = createRequire(import.meta.url);
const fixturesRaw = require('./fixtures/parser-golden.json') as GoldenFixture[];

// ---- Types (mirrors parser-eval.test.ts, kept local to avoid dep) ----

interface FlightExpected {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  infants?: number;
}

interface HotelExpected {
  city?: string;
  checkinDate?: string;
  checkoutDate?: string;
  adults?: number;
  children?: number;
}

interface ItineraryExpected {
  destinations?: string[];
  days?: number;
}

interface GoldenFixture {
  id: string;
  description: string;
  input: {
    message: string;
    language: 'es' | 'en' | 'pt';
  };
  expected: {
    requestType: string;
    confidence_min?: number;
    route?: 'QUOTE' | 'COLLECT' | 'PLAN';
    flights?: FlightExpected;
    hotels?: HotelExpected;
    itinerary?: ItineraryExpected;
  };
}

// ---- Inline minimal ParsedTravelRequest for routeRequest ----
// We re-implement the minimum shape so the script has zero imports from
// src/ (avoids needing the full Vite alias resolution outside of vitest).

type RequestType = 'flights' | 'hotels' | 'services' | 'combined' | 'general' | 'missing_info_request' | 'itinerary';

interface MinimalParsed {
  requestType: RequestType;
  confidence: number;
  originalMessage: string;
  flights?: {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    adults: number;
    adultsExplicit?: boolean;
    children: number;
    infants?: number;
  };
  hotels?: {
    city: string;
    checkinDate: string;
    checkoutDate: string;
    adults: number;
    adultsExplicit?: boolean;
    children: number;
  };
  itinerary?: {
    destinations: string[];
    days?: number;
    startDate?: string;
    editIntent?: unknown;
  };
}

// ---- Inline routeRequest (mirrors src/features/chat/services/routeRequest.ts) ----
// We inline the scoring constants + logic so the script is self-contained.
// If the real routeRequest changes its thresholds, update here too.

type EmiliaRoute = 'QUOTE' | 'COLLECT' | 'PLAN';

interface RouteResult {
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

const WEIGHTS = {
  destination: 0.30,
  dates: 0.25,
  passengers: 0.15,
  origin: 0.15,
  complexity: 0.15,
} as const;

const QUOTE_THRESHOLD = 0.75;
const PLAN_THRESHOLD = 0.40;

const REGIONS = new Set([
  'europa', 'europe', 'asia', 'caribe', 'caribbean',
  'sudamerica', 'norteamerica', 'centroamerica', 'oceania', 'africa',
  'medio oriente', 'middle east', 'sudeste asiatico', 'southeast asia',
  'patagonia', 'escandinavia', 'scandinavia',
]);

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

const PLAN_INTENT = /\b(arma(me)?|planifica|itinerario|recorrido|ruta|circuito|viaje\s+por)\b/;

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function isRegionOrCountry(destination: string): boolean {
  const n = norm(destination);
  return REGIONS.has(n) || COUNTRIES.has(n);
}

function routeRequestInline(p: MinimalParsed): RouteResult {
  let destScore = 0;
  if (p.itinerary?.destinations?.length) {
    const allVague = p.itinerary.destinations.every(isRegionOrCountry);
    if (!allVague) {
      const someVague = p.itinerary.destinations.some(isRegionOrCountry);
      destScore = someVague ? 0.5 : 1.0;
    }
  } else if (p.flights?.destination) {
    destScore = isRegionOrCountry(p.flights.destination) ? 0.5 : 1.0;
  } else if (p.hotels?.city) {
    destScore = isRegionOrCountry(p.hotels.city) ? 0.5 : 1.0;
  }

  let datesScore = 0;
  if (p.flights?.departureDate) datesScore = 1.0;
  else if (p.hotels?.checkinDate && p.hotels.checkoutDate) datesScore = 1.0;
  else if (p.itinerary?.days && p.itinerary.days > 0) datesScore = 0.3;

  let paxScore = 0.5;
  if (p.flights?.adultsExplicit || p.hotels?.adultsExplicit) paxScore = 1.0;

  let originScore = 0;
  if (p.flights?.origin) originScore = 1.0;
  else if (p.requestType === 'hotels') originScore = 1.0;
  else if (p.requestType === 'itinerary') originScore = 0.5;

  const complexityScore = 1.0;

  const dims = {
    destination: destScore,
    dates: datesScore,
    passengers: paxScore,
    origin: originScore,
    complexity: complexityScore,
  };

  const score =
    dims.destination * WEIGHTS.destination +
    dims.dates * WEIGHTS.dates +
    dims.passengers * WEIGHTS.passengers +
    dims.origin * WEIGHTS.origin +
    dims.complexity * WEIGHTS.complexity;

  const missingFields: string[] = [];
  if (dims.destination === 0) missingFields.push('destination');
  if (dims.dates === 0) missingFields.push('dates');
  if (dims.passengers === 0) missingFields.push('passengers');
  if (dims.origin === 0 && p.requestType !== 'hotels') {
    missingFields.push('origin');
  }

  const msg = norm(p.originalMessage || '');

  if (p.requestType === 'itinerary' || PLAN_INTENT.test(msg)) {
    return {
      route: 'PLAN',
      score,
      dimensions: dims,
      missingFields,
      inferredFields: [],
      reason: 'itinerary_request',
    };
  }

  if (dims.destination === 0.5 && dims.complexity < 1) {
    return {
      route: 'PLAN',
      score,
      dimensions: dims,
      missingFields,
      inferredFields: [],
      reason: 'destination_too_vague',
    };
  }

  if (score >= QUOTE_THRESHOLD) {
    return {
      route: 'QUOTE',
      score,
      dimensions: dims,
      missingFields,
      inferredFields: [],
      reason: 'high_definition',
    };
  }

  if (score >= PLAN_THRESHOLD) {
    return {
      route: 'COLLECT',
      score,
      dimensions: dims,
      missingFields,
      inferredFields: [],
      collectQuestion: '¿Podés darme más detalles sobre tu viaje?',
      reason: 'needs_clarification',
    };
  }

  return {
    route: 'PLAN',
    score,
    dimensions: dims,
    missingFields,
    inferredFields: [],
    reason: 'low_definition',
  };
}

// ---- Build minimal parsed from fixture ----

function buildParsed(fixture: GoldenFixture): MinimalParsed {
  const base: MinimalParsed = {
    requestType: fixture.expected.requestType as RequestType,
    confidence: fixture.expected.confidence_min ?? 0.8,
    originalMessage: fixture.input.message,
  };

  if (fixture.expected.flights) {
    base.flights = {
      origin: fixture.expected.flights.origin ?? '',
      destination: fixture.expected.flights.destination ?? '',
      departureDate: fixture.expected.flights.departureDate ?? '',
      returnDate: fixture.expected.flights.returnDate,
      adults: fixture.expected.flights.adults ?? 1,
      adultsExplicit: (fixture.expected.flights.adults ?? 1) > 1,
      children: fixture.expected.flights.children ?? 0,
      infants: fixture.expected.flights.infants ?? 0,
    };
  }

  if (fixture.expected.hotels) {
    base.hotels = {
      city: fixture.expected.hotels.city ?? '',
      checkinDate: fixture.expected.hotels.checkinDate ?? '',
      checkoutDate: fixture.expected.hotels.checkoutDate ?? '',
      adults: fixture.expected.hotels.adults ?? 1,
      adultsExplicit: (fixture.expected.hotels.adults ?? 1) > 1,
      children: fixture.expected.hotels.children ?? 0,
    };
  }

  if (fixture.expected.itinerary) {
    base.itinerary = {
      destinations: fixture.expected.itinerary.destinations ?? [],
      days: fixture.expected.itinerary.days,
    };
  }

  return base;
}

// ---- ASCII table helpers ----

function pad(str: string, width: number): string {
  return str.slice(0, width).padEnd(width);
}

function hr(widths: number[]): string {
  return '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';
}

function row(cells: string[], widths: number[]): string {
  return '|' + cells.map((c, i) => ` ${pad(c, widths[i])} `).join('|') + '|';
}

// ---- Main ----

interface EvalRow {
  id: string;
  expectedType: string;
  expectedRoute: string;
  actualRoute: string;
  pass: boolean;
}

const results: EvalRow[] = [];

for (const fixture of fixturesRaw) {
  const expectedRoute = fixture.expected.route ?? '—';
  let actualRoute = '—';
  let pass = true;

  if (fixture.expected.route) {
    const parsed = buildParsed(fixture);
    const result = routeRequestInline(parsed);
    actualRoute = result.route;
    pass = result.route === fixture.expected.route;
  }

  results.push({
    id: fixture.id,
    expectedType: fixture.expected.requestType,
    expectedRoute,
    actualRoute,
    pass,
  });
}

// ---- Print table ----

const cols = [32, 22, 14, 12, 6];
const headers = ['ID', 'Expected Type', 'Exp Route', 'Act Route', 'Result'];

console.log('\n=== AI Message Parser — Eval Report ===\n');
console.log(hr(cols));
console.log(row(headers, cols));
console.log(hr(cols));

for (const r of results) {
  const resultStr = r.pass ? 'PASS' : 'FAIL';
  console.log(row([r.id, r.expectedType, r.expectedRoute, r.actualRoute, resultStr], cols));
}

console.log(hr(cols));

// ---- Summary ----

const passing = results.filter(r => r.pass).length;
const total = results.length;
const failing = results.filter(r => !r.pass);

console.log(`\nSummary: ${passing}/${total} passing`);

if (failing.length > 0) {
  console.log('\nFailing cases:');
  for (const r of failing) {
    console.log(`  [FAIL] ${r.id}: expected route=${r.expectedRoute}, got=${r.actualRoute}`);
  }
  process.exit(1);
} else {
  console.log('\nAll route assertions passed.');
  process.exit(0);
}
