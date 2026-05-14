/**
 * Emilia 5.0 — Voice Layer (Phase 2 / sub-task D)
 *
 * Single, unified entry point for Emilia's user-facing narrative copy. Today
 * five different emitters compose chat messages with divergent tones and
 * inconsistent i18n strategies (some hardcoded ES, some via `chatResultCopy`
 * lambda registry, some via `react-i18next` JSON catalogues). This module
 * funnels all of them through one function that produces ONE consistent voice
 * for "qué entendí, qué busco, qué asumí, qué podés ajustar".
 *
 * Migration strategy (additive — minimum blast radius):
 *   - The legacy emitters keep their function signatures identical.
 *   - Their bodies are replaced by thin wrappers that delegate here.
 *   - All 9+ call sites of `buildConversationalMissingInfoMessage` (and the
 *     other 4 emitters) stay UNTOUCHED in this sub-task.
 *
 * Out of scope (deferred to Phase 3):
 *   - `formatDiscoveryResponse` — editorial card, distinct rendering.
 *   - `buildCollectQuestion` — router-internal imperative copy.
 *
 * Pure module: no React, no Supabase, no i18next runtime. All i18n resolves
 * via the existing `getXxxCopy(language)` lambdas in `chatResultCopy.ts`,
 * which already host the trilingual (es/en/pt) strings.
 */

import type { ParsedTravelRequest, UserLanguage } from '@/services/aiMessageParser';
import type { TripPlannerState } from '@/features/trip-planner/types';
import type { ProposedSearch } from './proposedSearchBuilder';
import {
  getCollectQuestionsCopy,
  getConversationalMissingInfoCopy,
  getModeBridgeCopy,
  getPlanToQuoteCopy,
  getPlannerBlockCopy,
  getProgressCopy,
  getTravelerCopy,
  LOCALE_BY_LANGUAGE,
} from '@/features/chat/i18n/chatResultCopy';

// ---------------------------------------------------------------------------
// Locally redeclared place shape — avoids a circular import with
// `conversationOrchestrator.ts` (which also re-exports `ChatRecommendedPlace`
// and now wraps `formatDiscoveryResponse` to delegate here). Identical shape.
// ---------------------------------------------------------------------------
export interface NarrativeRecommendedPlace {
  name: string;
  description?: string;
  category?: string;
  city?: string;
}

// Locally redeclared to avoid a runtime module cycle with `routeRequest.ts`,
// which now wraps `buildSearchSummary` to delegate here. Identical shape to
// `routeRequest.InferredField`.
export interface InferredField {
  field: string;
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type NarrativeMode =
  | 'search_summary'
  | 'collect'
  | 'plan_to_quote'
  | 'mode_bridge'
  | 'progress'
  | 'discovery'
  | 'search_proposal';

export type NarrativeTone =
  | 'casual'
  | 'imperative'
  | 'editorial'
  | 'empathic'
  | 'summary';

export interface NarrativeChip {
  id: string;
  label: string;
  icon?: string;
  action: { kind: 'submit' | 'prefill'; text: string };
}

export interface NarrativeProgressInput {
  /** Pre-resolved destination string (city name, already de-IATA-d if needed). */
  destination?: string;
  days?: number;
}

export interface NarrativeInput {
  mode: NarrativeMode;
  language: UserLanguage;
  /** Parsed travel request, when available. Required for `search_summary` and helpful for `collect`. */
  normalized?: ParsedTravelRequest | null;
  /** Inferred fields from the deterministic router (e.g., adults defaulted, one_way assumed). */
  defaultsApplied?: InferredField[];
  /** Search dispatch order (for future use; surfaced in chip metadata). */
  searchOrder?: ('flights' | 'hotels' | 'packages' | 'itinerary')[];
  /** Missing fields the user still needs to provide. Drives `collect` copy. */
  missingFields?: string[];
  /**
   * Sub-variant within the `collect` mode. Default `'empathic'` preserves the
   * existing conversational lead+ask. `'focused'` produces JUST the focused
   * question (used by the deterministic router's COLLECT branch, where the
   * orchestrator hasn't yet built the full conversational missing-info path).
   */
  style?: 'focused' | 'empathic';
  /** Active planner state, when available. Required for `plan_to_quote`. */
  plannerState?: TripPlannerState | null;
  /** Mode-bridge metadata: which mode the orchestrator suggests switching to. */
  bridge?: { suggestedMode: 'agency' | 'passenger' };
  /** Pre-built progress context (destination + days) for `progress` mode. */
  progress?: NarrativeProgressInput;
  /** Editorial-discovery payload: city, raw user text, and the curated places list. */
  discovery?: {
    city: string;
    requestText: string;
    places: NarrativeRecommendedPlace[];
  };
  /**
   * Phase 5 / sub-task B — payload for the `search_proposal` mode. Built by
   * `buildProposedSearch` (proposedSearchBuilder.ts) when an exploratory but
   * actionable agency-mode prompt arrives. Contains the principal chip, 2-3
   * dynamic alternative chips, and pre-rendered narrative segments.
   */
  proposedSearch?: ProposedSearch;
  /** Optional fallback string if upstream already produced a tailored message. */
  fallbackMessage?: string;
  /**
   * Optional shaped payload returned by some emitters (e.g., plan_to_quote)
   * for callers that need structured data alongside copy. Pass-through only;
   * the function does not interpret it.
   */
  extras?: Record<string, unknown>;
}

export interface NarrativeOutput {
  text: string;
  segments?: {
    lead?: string;
    assumptions?: string;
    ask?: string;
    cta?: string;
  };
  chips?: NarrativeChip[];
  meta?: {
    inferredFields: string[];
    voice: { mode: NarrativeMode; tone: NarrativeTone };
  };
  /**
   * Pass-through structured data from old emitters. Today only `plan_to_quote`
   * populates this (with `quoteContext`); other modes leave it undefined.
   */
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Public API — single entry point
// ---------------------------------------------------------------------------

export function buildEmiliaSearchNarrative(input: NarrativeInput): NarrativeOutput {
  switch (input.mode) {
    case 'search_summary':
      return buildSearchSummaryNarrative(input);
    case 'collect':
      return buildCollectNarrative(input);
    case 'plan_to_quote':
      return buildPlanToQuoteNarrative(input);
    case 'mode_bridge':
      return buildModeBridgeNarrative(input);
    case 'progress':
      return buildProgressNarrative(input);
    case 'discovery':
      return buildDiscoveryNarrative(input);
    case 'search_proposal':
      return buildSearchProposalNarrative(input);
    default: {
      const exhaustive: never = input.mode;
      void exhaustive;
      return { text: input.fallbackMessage ?? '' };
    }
  }
}

// ---------------------------------------------------------------------------
// Mode: search_summary
// ---------------------------------------------------------------------------
// Mirrors the current `buildSearchSummary` (routeRequest.ts). Today that
// helper is hardcoded ES; the new path adds en/pt in addition.

function buildSearchSummaryNarrative(input: NarrativeInput): NarrativeOutput {
  const { normalized, defaultsApplied = [], language } = input;
  if (!normalized) {
    return {
      text: input.fallbackMessage ?? '',
      meta: { inferredFields: [], voice: { mode: 'search_summary', tone: 'casual' } },
    };
  }

  const copy = SEARCH_SUMMARY_COPY[language] || SEARCH_SUMMARY_COPY.es;
  const parts: string[] = [];

  if (normalized.requestType === 'flights' || normalized.requestType === 'combined') {
    const f = normalized.flights;
    if (f) {
      let desc = `${copy.flight} ${f.origin || '?'}→${f.destination || '?'}`;
      if (f.departureDate) desc += `, ${formatDateShort(f.departureDate, language)}`;
      if (f.returnDate) desc += ` ${copy.dateRangeJoin} ${formatDateShort(f.returnDate, language)}`;
      const pax = describePax(f.adults, f.children, f.infants, language);
      if (pax) desc += `, ${pax}`;
      parts.push(desc);
    }
  }

  if (normalized.requestType === 'hotels' || normalized.requestType === 'combined') {
    const h = normalized.hotels;
    if (h) {
      let desc = `${copy.hotel} ${copy.in} ${h.city || '?'}`;
      if (h.checkinDate) desc += `, ${formatDateShort(h.checkinDate, language)}`;
      if (h.checkoutDate) desc += ` ${copy.dateRangeJoin} ${formatDateShort(h.checkoutDate, language)}`;
      const pax = describePax(h.adults, h.children, h.infants, language);
      if (pax) desc += `, ${pax}`;
      parts.push(desc);
    }
  }

  if (parts.length === 0) {
    return {
      text: '',
      meta: { inferredFields: defaultsApplied.map((f) => f.field), voice: { mode: 'search_summary', tone: 'casual' } },
    };
  }

  const inferredLabels = defaultsApplied.map((i) => i.label);
  const lead = `${copy.searched} ${parts.join(' + ')}`;
  let text: string;
  let assumptions: string | undefined;

  if (inferredLabels.length > 0) {
    assumptions = copy.assumptionsLine(inferredLabels.join(', '));
    text = `${lead}. ${assumptions}`;
  } else {
    text = `${lead}.`;
  }

  return {
    text,
    segments: { lead, assumptions },
    chips: buildSearchSummaryChips(defaultsApplied, language),
    meta: {
      inferredFields: defaultsApplied.map((f) => f.field),
      voice: { mode: 'search_summary', tone: 'casual' },
    },
  };
}

const SEARCH_SUMMARY_COPY: Record<UserLanguage, {
  flight: string;
  hotel: string;
  in: string;
  searched: string;
  dateRangeJoin: string;
  assumptionsLine: (labels: string) => string;
  adult: (n: number) => string;
  child: (n: number) => string;
  infant: (n: number) => string;
  oneWayChip: string;
  oneWayChipPrompt: string;
}> = {
  es: {
    flight: 'vuelo',
    hotel: 'hotel',
    in: 'en',
    searched: 'Busqué',
    dateRangeJoin: 'al',
    assumptionsLine: (labels) => `_Datos asumidos: ${labels}._ Si querés cambiar algo, decime.`,
    adult: (n) => `${n} adulto${n > 1 ? 's' : ''}`,
    child: (n) => `${n} niño${n > 1 ? 's' : ''}`,
    infant: (n) => `${n} bebé${n > 1 ? 's' : ''}`,
    oneWayChip: 'Pasarlo a ida y vuelta',
    oneWayChipPrompt: 'Hacelo ida y vuelta',
  },
  en: {
    flight: 'flight',
    hotel: 'hotel',
    in: 'in',
    searched: 'I searched',
    dateRangeJoin: 'to',
    assumptionsLine: (labels) => `_Assumptions: ${labels}._ Tell me if you want to change anything.`,
    adult: (n) => `${n} adult${n > 1 ? 's' : ''}`,
    child: (n) => `${n} child${n > 1 ? 'ren' : ''}`,
    infant: (n) => `${n} infant${n > 1 ? 's' : ''}`,
    oneWayChip: 'Make it round-trip',
    oneWayChipPrompt: 'Make it round-trip',
  },
  pt: {
    flight: 'voo',
    hotel: 'hotel',
    in: 'em',
    searched: 'Busquei',
    dateRangeJoin: 'a',
    assumptionsLine: (labels) => `_Suposições: ${labels}._ Me diga se quiser mudar algo.`,
    adult: (n) => `${n} adulto${n > 1 ? 's' : ''}`,
    child: (n) => `${n} criança${n > 1 ? 's' : ''}`,
    infant: (n) => `${n} bebê${n > 1 ? 's' : ''}`,
    oneWayChip: 'Trocar para ida e volta',
    oneWayChipPrompt: 'Faça ida e volta',
  },
};

function describePax(
  adults: number | undefined,
  children: number | undefined,
  infants: number | undefined,
  language: UserLanguage,
): string {
  const copy = SEARCH_SUMMARY_COPY[language] || SEARCH_SUMMARY_COPY.es;
  const parts: string[] = [];
  if (adults && adults > 0) parts.push(copy.adult(adults));
  if (children && children > 0) parts.push(copy.child(children));
  if (infants && infants > 0) parts.push(copy.infant(infants));
  return parts.join(', ');
}

function formatDateShort(iso: string, language: UserLanguage): string {
  try {
    const d = new Date(`${iso}T00:00:00`);
    const locale = LOCALE_BY_LANGUAGE[language] || LOCALE_BY_LANGUAGE.es;
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}

function buildSearchSummaryChips(
  defaults: InferredField[],
  language: UserLanguage,
): NarrativeChip[] {
  const copy = SEARCH_SUMMARY_COPY[language] || SEARCH_SUMMARY_COPY.es;
  const chips: NarrativeChip[] = [];
  for (const f of defaults) {
    if (f.field === 'tripType' && f.value === 'one_way') {
      chips.push({
        id: 'narrative-flip-trip-type',
        label: copy.oneWayChip,
        action: { kind: 'submit', text: copy.oneWayChipPrompt },
      });
    }
  }
  return chips;
}

// ---------------------------------------------------------------------------
// Mode: collect
// ---------------------------------------------------------------------------
// Empathic missing-info copy. Mirrors the current
// `buildConversationalMissingInfoMessage` so output text matches today's
// tone exactly (we re-use the same `getConversationalMissingInfoCopy`
// registry the legacy code already drives).

function buildCollectNarrative(input: NarrativeInput): NarrativeOutput {
  const { normalized, missingFields = [], fallbackMessage, language, style = 'empathic' } = input;

  // ----- focused: imperative single question, no contextual lead -----
  // Used by the deterministic router's COLLECT branch (`buildCollectQuestion`
  // in `routeRequest.ts`). Mirrors the legacy `COLLECT_QUESTIONS` map keys
  // verbatim in `es` (zero drift) and adds en/pt via `getCollectQuestionsCopy`.
  if (style === 'focused') {
    const focusedCopy = getCollectQuestionsCopy(language);
    const requestType = normalized?.requestType;
    const needsDates = missingFields.includes('dates');
    const needsPax = missingFields.includes('passengers');
    const needsOrigin = missingFields.includes('origin');

    let text: string;
    if (needsPax && needsDates) text = focusedCopy.passengers_and_dates;
    else if (needsOrigin && needsDates) text = focusedCopy.origin_and_dates;
    else if (needsPax) text = focusedCopy.passengers;
    else if (needsDates) text = requestType === 'hotels' ? focusedCopy.dates_hotel : focusedCopy.dates;
    else if (needsOrigin) text = focusedCopy.origin;
    else text = focusedCopy.fallback;

    return {
      text,
      segments: { ask: text },
      meta: { inferredFields: [], voice: { mode: 'collect', tone: 'imperative' } },
    };
  }

  // ----- empathic (default): contextual lead + ask -----
  const copy = getConversationalMissingInfoCopy(language);
  const requestType = normalized?.requestType ?? 'general';
  const normalizedFields = [...new Set(missingFields.map(normalizeMissingField))].slice(0, 2);

  if (requestType === 'itinerary' && normalizedFields.includes('dates') && fallbackMessage) {
    return {
      text: fallbackMessage,
      meta: { inferredFields: [], voice: { mode: 'collect', tone: 'empathic' } },
    };
  }

  if (normalizedFields.length === 0) {
    return {
      text: fallbackMessage || copy.emptyFallback,
      meta: { inferredFields: [], voice: { mode: 'collect', tone: 'empathic' } },
    };
  }

  const lead = buildKnownContextLead(normalized, language);
  const ask = buildAskLine(requestType, normalizedFields, language);
  const text = `${lead} ${ask}`;

  return {
    text,
    segments: { lead, ask },
    meta: { inferredFields: [], voice: { mode: 'collect', tone: 'empathic' } },
  };
}

function normalizeMissingField(field: string): string {
  // Mirror `normalizeText` from conversationOrchestrator (kept there because
  // `normalizedMissingFields` still calls it). Same regexes — must produce
  // byte-identical output.
  const normalized = (field || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!normalized) return field;
  if (normalized.includes('origin')) return 'origin';
  if (normalized.includes('destino')) return 'destination';
  if (normalized.includes('destination')) return 'destination';
  if (normalized.includes('city')) return 'destination';
  if (normalized.includes('segment')) return 'destination';
  if (normalized.includes('fecha') || normalized.includes('date')) return 'dates';
  if (normalized.includes('passenger') || normalized.includes('adult') || normalized.includes('traveler') || normalized.includes('cantidad de pasajeros')) return 'passengers';
  if (normalized.includes('duration') || normalized.includes('dias')) return 'duration';
  if (normalized.includes('budget')) return 'budget';
  if (normalized.includes('confirmation')) return 'confirmation';
  return normalized.replace(/\s+/g, '_');
}

function buildKnownContextLead(parsed: ParsedTravelRequest | null | undefined, language: UserLanguage): string {
  const copy = getConversationalMissingInfoCopy(language).contextLead;
  const requestType = parsed?.requestType ?? 'general';
  const destination = getKnownDestination(parsed);
  const duration = getKnownDuration(parsed, language);
  const travelers = getKnownTravelers(parsed, language);

  if (requestType === 'itinerary' && destination) {
    const detail = [duration, travelers].filter(Boolean).join(' · ');
    return copy.itinerary(detail, destination);
  }
  if (requestType === 'flights' && destination) return copy.flights(destination);
  if (requestType === 'hotels' && destination) return copy.hotels(destination);
  if (requestType === 'combined' && destination) return copy.combined(destination);
  return copy.fallback;
}

function buildAskLine(
  requestType: ParsedTravelRequest['requestType'] | 'general',
  fields: string[],
  language: UserLanguage,
): string {
  const copy = getConversationalMissingInfoCopy(language).askLine;
  const has = (field: string) => fields.includes(field);

  if (has('origin') && has('dates')) return copy.originDates;
  if (has('origin') && has('destination')) return copy.originDestination;
  if (has('passengers') && has('dates')) {
    return requestType === 'itinerary' ? copy.passengersDatesItinerary : copy.passengersDatesSearch;
  }
  if (has('origin')) return copy.origin;
  if (has('dates')) return requestType === 'itinerary' ? copy.datesItinerary : copy.datesSearch;
  if (has('duration')) return copy.duration;
  if (has('passengers')) return copy.passengers;
  if (has('budget')) return copy.budget;
  if (has('destination')) return copy.destination;
  return copy.fallback;
}

function getKnownDestination(parsed?: ParsedTravelRequest | null): string | undefined {
  if (!parsed) return undefined;
  if (parsed.itinerary?.destinations?.length) return parsed.itinerary.destinations.join(', ');
  if (parsed.hotels?.city) return parsed.hotels.city;
  if (parsed.flights?.destination) return parsed.flights.destination;
  if (parsed.packages?.destination) return parsed.packages.destination;
  return undefined;
}

function getKnownDuration(parsed: ParsedTravelRequest | null | undefined, language: UserLanguage): string | undefined {
  const days = parsed?.itinerary?.days;
  if (!days) return undefined;
  return getTravelerCopy(language).day(days);
}

function getKnownTravelers(parsed: ParsedTravelRequest | null | undefined, language: UserLanguage): string | undefined {
  if (!parsed) return undefined;
  const itineraryTravelers = parsed.itinerary?.travelers;
  const adults = itineraryTravelers?.adults ?? parsed.hotels?.adults ?? parsed.flights?.adults;
  const children = itineraryTravelers?.children ?? parsed.hotels?.children ?? parsed.flights?.children ?? 0;
  const infants = itineraryTravelers?.infants ?? parsed.hotels?.infants ?? parsed.flights?.infants ?? 0;
  if (!adults && !children && !infants) return undefined;
  // IMPORTANT: collect mode reuses TRAVELER_COPY (menor/bebé) — distinct from
  // search-summary tone (niño/bebé). Preserves byte-identical output for the
  // 9 legacy call sites.
  const copy = getTravelerCopy(language);
  const parts: string[] = [];
  if (adults && adults > 0) parts.push(copy.adult(adults));
  if (children && children > 0) parts.push(copy.child(children));
  if (infants && infants > 0) parts.push(copy.infant(infants));
  return parts.join(copy.join);
}

// ---------------------------------------------------------------------------
// Mode: plan_to_quote
// ---------------------------------------------------------------------------
// Mirrors `buildPlanToQuoteResponse` (conversationOrchestrator.ts). Returns
// `text` PLUS `data.quoteContext` so the wrapper can preserve the legacy
// `{response, data:{...}}` shape without rebuilding it.

function buildPlanToQuoteNarrative(input: NarrativeInput): NarrativeOutput {
  const { plannerState, language } = input;
  if (!plannerState) {
    return {
      text: input.fallbackMessage ?? '',
      meta: { inferredFields: [], voice: { mode: 'plan_to_quote', tone: 'summary' } },
    };
  }

  const copy = getPlanToQuoteCopy(language);
  const segments = (plannerState.segments || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const segmentLabels = segments.length > 0
    ? segments.map((segment) => `${segment.city}${segment.nights ? ` (${copy.night(segment.nights)})` : ''}`)
    : (plannerState.destinations || []);
  const days = plannerState.days || segments.reduce((total, segment) => total + (segment.nights || 0), 0);
  const travelers = plannerState.travelers;
  const travelerLabel = [
    copy.adult(travelers?.adults || 1),
    travelers?.children ? copy.child(travelers.children) : null,
    travelers?.infants ? copy.infant(travelers.infants) : null,
  ].filter(Boolean).join(', ');

  const dateLabel = plannerState.isFlexibleDates
    ? (() => {
        const flexibleLabel = plannerState.flexibleMonth
          ? new Date(`${plannerState.flexibleYear || new Date().getFullYear()}-${plannerState.flexibleMonth}-01T00:00:00`)
            .toLocaleDateString(LOCALE_BY_LANGUAGE[language] || LOCALE_BY_LANGUAGE.es, { month: 'long', year: 'numeric' })
          : copy.flexibleMonth;
        return `${flexibleLabel}${days ? ` (${copy.day(days)})` : ''}`;
      })()
    : `${plannerState.startDate || copy.noStartDate}${plannerState.endDate ? ` ${copy.to} ${plannerState.endDate}` : ''}`;

  const missingQuoteFields = (input.extras?.missingQuoteFields as string[] | undefined) ?? [];
  const missingQuoteSlots = (input.extras?.missingQuoteSlots as string[] | undefined) ?? [];

  const summary = [
    segmentLabels.length > 0 ? segmentLabels.join(' → ') : copy.activePlan,
    days ? copy.day(days) : null,
    travelerLabel,
    dateLabel,
  ].filter(Boolean).join(' · ');

  const text = missingQuoteFields.length > 0
    ? copy.missing(summary, missingQuoteFields.join(language === 'en' ? ' and ' : language === 'pt' ? ' e ' : ' y '))
    : copy.ready(summary);

  return {
    text,
    segments: { lead: summary, ask: missingQuoteFields.length > 0 ? missingQuoteFields.join(', ') : undefined },
    meta: { inferredFields: [], voice: { mode: 'plan_to_quote', tone: 'summary' } },
    data: {
      quoteContext: {
        source: 'active_planner',
        title: plannerState.title,
        destinations: plannerState.destinations || [],
        days,
        startDate: plannerState.startDate,
        endDate: plannerState.endDate,
        isFlexibleDates: plannerState.isFlexibleDates,
        flexibleMonth: plannerState.flexibleMonth,
        flexibleYear: plannerState.flexibleYear,
        origin: plannerState.origin || null,
        travelers: plannerState.travelers,
        missingQuoteFields,
        missingQuoteSlots,
        segments: segments.map((segment) => ({
          city: segment.city,
          country: segment.country,
          nights: segment.nights,
          startDate: segment.startDate,
          endDate: segment.endDate,
        })),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Mode: mode_bridge
// ---------------------------------------------------------------------------
// Migrated FROM react-i18next (chat.json:bridgeTitle.*) TO the lambda registry
// in chatResultCopy.ts. Justification: the narrative is a pure module that
// must work without the i18next runtime singleton (testability, edge-function
// reuse). The 2 keys are now duplicated in `MODE_BRIDGE_COPY`; the JSON keys
// stay until a follow-up cleanup release.

function buildModeBridgeNarrative(input: NarrativeInput): NarrativeOutput {
  const { bridge, language } = input;
  if (!bridge) {
    return {
      text: input.fallbackMessage ?? '',
      meta: { inferredFields: [], voice: { mode: 'mode_bridge', tone: 'imperative' } },
    };
  }
  const copy = getModeBridgeCopy(language);
  const text = bridge.suggestedMode === 'agency' ? copy.toAgency : copy.toPassenger;
  return {
    text,
    segments: { lead: text },
    meta: { inferredFields: [], voice: { mode: 'mode_bridge', tone: 'imperative' } },
  };
}

// ---------------------------------------------------------------------------
// Mode: progress
// ---------------------------------------------------------------------------
// Itinerary "draft generating" placeholder. Was hardcoded ES in
// useMessageHandler.ts; now trilingual via PROGRESS_COPY.

function buildProgressNarrative(input: NarrativeInput): NarrativeOutput {
  const { progress, language } = input;
  const copy = getProgressCopy(language);
  const destination = progress?.destination ?? '';
  const days = progress?.days;
  const text = copy.itinerary(destination, days);
  return {
    text,
    segments: { lead: text },
    meta: { inferredFields: [], voice: { mode: 'progress', tone: 'casual' } },
  };
}

// ---------------------------------------------------------------------------
// Mode: discovery
// ---------------------------------------------------------------------------
// Editorial card: heading + bulleted places + cta. Migrated from
// `formatDiscoveryResponse` (conversationOrchestrator.ts). The original
// regex-driven heading dispatcher (culture / food / neighborhood / default)
// lives here so the narrative is the single source of truth. The legacy
// patterns were ES-only; we extend them with EN/PT keywords too so the
// dispatcher works in all three languages.

const DISCOVERY_CULTURE_PATTERN =
  /\b(museos?|arte|galerias?|galerías|arquitectura|historia|museums?|art|galleries|architecture|history|museus?|arquitetura|história)\b/i;
const DISCOVERY_FOOD_PATTERN =
  /\b(restaurantes?|gastronomia|gastronomía|comida|cena|cafes?|cafés|food|dining|restaurants?|gastronomy|comer|jantar)\b/i;
const DISCOVERY_NEIGHBORHOOD_PATTERN =
  /\b(barrios?|zonas?|neighborhoods?|neighbourhoods?|areas?|bairros?)\b/i;
const DISCOVERY_DAYS_PATTERN = /\b(1|2|3|4|5|6|7|8|9|10)\s+dias?\b/i;

function buildDiscoveryHeadingText(
  requestText: string,
  city: string,
  language: UserLanguage,
): string {
  const copy = getPlannerBlockCopy(language);
  if (DISCOVERY_CULTURE_PATTERN.test(requestText)) {
    return copy.discoveryHeadingCulture(city);
  }
  if (DISCOVERY_FOOD_PATTERN.test(requestText)) {
    return copy.discoveryHeadingFood(city);
  }
  if (DISCOVERY_NEIGHBORHOOD_PATTERN.test(requestText)) {
    return copy.discoveryHeadingNeighborhood(city);
  }
  return copy.discoveryHeadingDefault(city);
}

function buildDiscoveryNarrative(input: NarrativeInput): NarrativeOutput {
  const { discovery, language } = input;
  const copy = getPlannerBlockCopy(language);
  const requestText = discovery?.requestText ?? '';
  const city = discovery?.city || copy.fallbackPlace;
  const finalPlaces = (discovery?.places ?? []).slice(0, 6);

  if (finalPlaces.length === 0) {
    const text = copy.discoveryEmpty(city);
    return {
      text,
      segments: { lead: text },
      meta: { inferredFields: [], voice: { mode: 'discovery', tone: 'editorial' } },
    };
  }

  const heading = buildDiscoveryHeadingText(requestText, city, language);
  // NOTE: byte-identical with the legacy `formatDiscoveryResponse`. The
  // legacy code used `description || category` with no fallback; if both
  // are undefined the line will end with the literal string "undefined".
  // Production callers always supply a non-empty `category` (the
  // `ChatRecommendedPlace` shape requires it), so this only matters in
  // tests that pass loose data — keep the legacy semantics.
  const lines = finalPlaces.map(
    (place) => `- ${place.name} — ${place.description || place.category}`,
  );
  const hasDays = DISCOVERY_DAYS_PATTERN.test(requestText);
  const cta = hasDays ? copy.discoveryCtaWithDays(city) : copy.discoveryCtaDefault();
  const text = `${heading}\n${lines.join('\n')}\n${cta}`;

  return {
    text,
    segments: { lead: heading, cta },
    meta: { inferredFields: [], voice: { mode: 'discovery', tone: 'editorial' } },
  };
}

// ---------------------------------------------------------------------------
// Mode: search_proposal (Phase 5 / sub-task B)
// ---------------------------------------------------------------------------
// Renders the Voice Layer output for an exploratory-but-actionable agency
// prompt. The narrative is fully pre-built by `buildProposedSearch`; this
// mode only assembles segments → text and maps chips → NarrativeChip[].

function buildSearchProposalNarrative(input: NarrativeInput): NarrativeOutput {
  const { proposedSearch } = input;
  if (!proposedSearch) {
    return {
      text: input.fallbackMessage ?? '',
      meta: { inferredFields: [], voice: { mode: 'search_proposal', tone: 'summary' } },
    };
  }

  const { segments, principalChipLabel, principalSubmitText, alternativeChips } = proposedSearch;
  const text = `${segments.lead} ${segments.proposal}. ${segments.dates}. ${segments.callToAction}`;

  const chips: NarrativeChip[] = [
    {
      id: 'proposed-search-principal',
      label: principalChipLabel,
      action: { kind: 'submit', text: principalSubmitText },
    },
    ...alternativeChips.map((alt) => ({
      id: alt.id,
      label: alt.label,
      action: { kind: 'submit' as const, text: alt.submitText },
    })),
  ];

  return {
    text,
    segments: {
      lead: segments.lead,
      ask: segments.proposal,
      cta: segments.callToAction,
    },
    chips,
    meta: { inferredFields: [], voice: { mode: 'search_proposal', tone: 'summary' } },
  };
}
