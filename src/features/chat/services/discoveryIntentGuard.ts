/**
 * discoveryIntentGuard.ts
 * =============================================================================
 * Lightweight structural detector for place-discovery intent.
 *
 * BACKSTOP ONLY — primary classification is via the LLM's `discover_places`
 * tool call (handled in supabase/functions/ai-message-parser/index.ts). This
 * guard prevents the worst-case fallback where the system silently regenerates
 * a 7-day itinerary when the user clearly wanted place options.
 *
 * Approach: structural pattern matching (interrogative/browse verb + concrete
 * category noun) gated by anti-patterns (duration, plan verb, mutation verb).
 * NOT a keyword list — the morphemes used are semantic categories (restaurants,
 * museums, etc.), not enumerated phrases.
 *
 * Returns true when the message is structurally a discovery query AND has no
 * itinerary signals.
 * =============================================================================
 */

// Boundary helpers — `\b` is ASCII-only in JS regex, so accented characters
// (é, á, í, ó, ú, ñ) at word edges break naive word-boundary matches. We use
// custom lookaround groups that treat any Spanish/English letter as a word
// char.
//
// LB = "letter boundary before": start-of-string OR a non-letter char before
// LE = "letter boundary after":  end-of-string OR a non-letter char after
const LB = '(?:^|[^A-Za-zÁÉÍÓÚÑáéíóúñ])';
const LE = '(?![A-Za-zÁÉÍÓÚÑáéíóúñ])';

const INTERROGATIVE = new RegExp(`${LB}(qu[eé]|cu[aá]les?|d[oó]nde|c[oó]mo|que)${LE}`, 'i');
const BROWSE_VERB = new RegExp(`${LB}(recomend[aá]|recomendame|mostrame|decime|sugeri|sug[ie]ri)${LE}`, 'i');

const CATEGORY_NOUN = new RegExp(
  `${LB}(restaurantes?|museos?|bares?|caf[eé]s?|sitios?|lugares?|actividades?|cosas\\s+(?:para|que)\\s+(?:hacer|ver)|atracciones?|monumentos?|parques?|teatros?|galer[ií]as?|food\\s+spots?|things\\s+to\\s+do|places\\s+to\\s+(?:visit|eat|drink))${LE}`,
  'i',
);

const VIBE_BROWSE = new RegExp(
  `${LB}(salir\\s+de\\s+noche|tomar\\s+algo|comer\\s+bien|d[oó]nde\\s+(?:comer|tomar|cenar))${LE}`,
  'i',
);

// Verb-form question: "qué [comer|cenar|almorzar|ver|hacer|visitar|tomar|conocer]"
// Catches "qué comer en Roma", "qué hacer en Madrid", "qué visitar en París".
// Conscious tradeoff: "qué comer" is technically ambiguous (could be conceptual
// "what dishes to eat" vs locational "where to eat"). We bias toward locational
// because in the travel-CRM context the user almost always wants places to map.
const VERB_QUESTION = new RegExp(
  `${LB}(qu[eé])\\s+(comer|cenar|almorzar|desayunar|ver|hacer|visitar|tomar|conocer)${LE}`,
  'i',
);

// Bare-noun browse with explicit location: "restaurantes en Roma",
// "actividades en Madrid", "bares cerca de Plaza Mayor". The location
// preposition + non-empty token afterward distinguishes a browse query from
// passing conversational mentions like "los restaurantes son caros". False
// positives still possible (e.g. "el restaurante de Calle X estaba lleno");
// mitigated by the safety-net's graceful degradation (empty places + UI hint
// to refine).
const BARE_BROWSE_LOCATION = new RegExp(
  `${LB}(restaurantes?|museos?|bares?|caf[eé]s?|sitios?|lugares?|actividades?|cosas\\s+(?:para|que)\\s+(?:hacer|ver)|atracciones?|monumentos?|parques?|teatros?|galer[ií]as?|things\\s+to\\s+do|places\\s+to\\s+(?:visit|eat|drink))\\s+(en|in|de|cerca\\s+de|para|near)\\s+\\S+`,
  'i',
);

const DURATION_SIGNAL = new RegExp(
  `${LB}(\\d+\\s*(?:d[ií]as?|noches?|semanas?|days?|nights?|weeks?)|fin\\s+de\\s+semana|una?\\s+semana|dos\\s+semanas)${LE}`,
  'i',
);
const PLAN_VERB = new RegExp(
  `${LB}(armame|organiza|planifica|plan\\s+de\\s+viaje|itinerario|agenda|ruta\\s+de\\s+viaje)${LE}`,
  'i',
);
const MUTATION_VERB = new RegExp(
  `${LB}(agreg[aá]|quita|sac[aá]|cambi[aá]|reemplaz[aá]|alarg[aá]|acort[aá]|elimina)${LE}`,
  'i',
);

export type DiscoveryGuardReason =
  | 'pattern_match'
  | 'vibe_browse'
  | 'plan_verb_present'
  | 'duration_present'
  | 'mutation_verb'
  | 'no_match';

export interface DiscoveryGuardResult {
  isDiscovery: boolean;
  reason: DiscoveryGuardReason;
}

export function isDiscoveryQuery(message: string): DiscoveryGuardResult {
  const m = (message ?? '').trim();
  if (!m) return { isDiscovery: false, reason: 'no_match' };

  // Negative signals first — these block discovery classification.
  if (PLAN_VERB.test(m)) return { isDiscovery: false, reason: 'plan_verb_present' };
  if (DURATION_SIGNAL.test(m)) return { isDiscovery: false, reason: 'duration_present' };
  if (MUTATION_VERB.test(m)) return { isDiscovery: false, reason: 'mutation_verb' };

  // Positive: vibe-based browsing always wins.
  if (VIBE_BROWSE.test(m)) return { isDiscovery: true, reason: 'vibe_browse' };

  // Positive (extended): high-confidence structural patterns.
  //   VERB_QUESTION         — "qué comer/hacer/ver/visitar en X"
  //   BARE_BROWSE_LOCATION  — "[CATEGORY] en/cerca de [LOCATION]"
  // Both treated as `pattern_match` so toolChoicePolicy forces discover_places.
  if (VERB_QUESTION.test(m) || BARE_BROWSE_LOCATION.test(m)) {
    return { isDiscovery: true, reason: 'pattern_match' };
  }

  // Positive: structural pattern (interrogative/browse + category noun).
  const hasInterrogativeOrBrowse = INTERROGATIVE.test(m) || BROWSE_VERB.test(m);
  const hasCategoryNoun = CATEGORY_NOUN.test(m);

  if (hasInterrogativeOrBrowse && hasCategoryNoun) {
    return { isDiscovery: true, reason: 'pattern_match' };
  }

  return { isDiscovery: false, reason: 'no_match' };
}

// ---------------------------------------------------------------------------
// Helpers for the safety-net path: extract destination + categories from a
// discovery query when the LLM failed to call discover_places. These are
// best-effort heuristics for graceful degradation.
// ---------------------------------------------------------------------------

const CATEGORY_TO_FOURSQUARE: Array<[RegExp, string]> = [
  [new RegExp(`${LB}restaurantes?${LE}`, 'i'), 'restaurant'],
  [new RegExp(`${LB}museos?${LE}`, 'i'), 'museum'],
  [new RegExp(`${LB}bares?${LE}`, 'i'), 'bar'],
  [new RegExp(`${LB}caf[eé]s?${LE}`, 'i'), 'cafe'],
  [new RegExp(`${LB}parques?${LE}`, 'i'), 'park'],
  [new RegExp(`${LB}monumentos?${LE}`, 'i'), 'monument'],
  [new RegExp(`${LB}teatros?${LE}`, 'i'), 'theater'],
  [new RegExp(`${LB}galer[ií]as?${LE}`, 'i'), 'gallery'],
  [new RegExp(`${LB}(?:sitios?|lugares?)${LE}`, 'i'), 'sights'],
  [new RegExp(`${LB}(?:actividades?|things\\s+to\\s+do|cosas\\s+(?:para|que)\\s+hacer)${LE}`, 'i'), 'activity'],
];

export function extractCategoriesFromMessage(message: string): string[] {
  const m = message ?? '';
  const matches: string[] = [];
  for (const [pattern, category] of CATEGORY_TO_FOURSQUARE) {
    if (pattern.test(m) && !matches.includes(category)) matches.push(category);
  }
  return matches.length > 0 ? matches : ['sights']; // generic fallback
}

/**
 * Tries to extract a city name from the message. Falls back to the first
 * destination of the active planner if available. Returns null if neither
 * is resolvable.
 */
export function extractDestinationFromMessage(
  message: string,
  plannerState: { destinations?: Array<{ city?: string; country?: string }> } | null,
): { city: string | null; country: string | null; lat: null; lng: null } {
  const m = (message ?? '').trim();

  // Heuristic: look for "en <City>" or "in <City>" pattern
  const enMatch = m.match(/\b(?:en|in|de|to)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/);
  if (enMatch?.[1]) {
    return { city: enMatch[1], country: null, lat: null, lng: null };
  }

  // Fallback: first destination of active planner
  const firstDest = plannerState?.destinations?.[0];
  if (firstDest?.city) {
    return { city: firstDest.city, country: firstDest.country ?? null, lat: null, lng: null };
  }

  return { city: null, country: null, lat: null, lng: null };
}
