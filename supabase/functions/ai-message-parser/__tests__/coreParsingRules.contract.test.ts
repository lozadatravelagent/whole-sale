/**
 * Contract tests for the core parsing rules that map to the Emilia / Vibook
 * product spec (§3 fechas, §4 origen, §5 pasajeros, §6 habitación, §7 cadenas,
 * §8 productos, §11 intenciones).
 *
 * These tests do NOT call the LLM. They pin the prompt-level rules that drive
 * deterministic behavior so silent drift fails loudly (e.g. a prompt edit that
 * accidentally drops the "first day of month" default).
 *
 * Each test maps to a specific section of the spec; if the spec evolves, the
 * matching test must be updated together.
 */

import { describe, expect, it } from 'vitest';

import { STATIC_SYSTEM_PROMPT } from '../prompt.ts';

// ---------------------------------------------------------------------------
// §3 — Reglas de fechas
// ---------------------------------------------------------------------------

describe('§3 dates — defaults', () => {
  it('§3.2 month-only → first day of month', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(
      /Month names.*→ first day of month/,
    );
  });

  it('§3.1 no date mentioned → current date + 3 days', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('No date mentioned → current date + 3 days');
  });

  it('§3.4 nights only → start = today + 3, derived end', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(
      /If exact dates are missing but the user gave a duration.*current date \+ 3 days/,
    );
  });

  it('year logic compares full date (month+day), not month alone', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('Compare the FULL DATE (month AND day)');
  });
});

// ---------------------------------------------------------------------------
// §4 — Origen
// ---------------------------------------------------------------------------

describe('§4 origin — smart default + never invent', () => {
  it('§4.1 explicit origin in user message wins over profile default', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'Explicit origin in the user message ALWAYS wins over the profile default.',
    );
  });

  it('§4.2 never invent origin without geolocation/profile', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('Never invent an origin');
  });

  it('falls back to profile.default_origin_city (geo-hydrated)', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('profile.default_origin_city');
  });
});

// ---------------------------------------------------------------------------
// §5 — Pasajeros
// ---------------------------------------------------------------------------

describe('§5 passengers — defaults', () => {
  it('§5.1 no passengers → 1 adult', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(
      /DEFAULT = 1 if NO passengers mentioned/,
    );
  });

  it('§5.6 family without count → 2 adults + 2 children', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(
      /"familia".*"flia".*adults 2, children 2, infants 0/,
    );
  });

  it('§5.6 only-minors without adults → adults=0 (validation surfaces error)', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'When user mentions ONLY minors (children/infants) without any adults, set adults = 0',
    );
  });

  it('infants are detected from "bebé/baby/infant/menor de 2/en brazos"', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('"bebé"');
    expect(STATIC_SYSTEM_PROMPT).toContain('"infante"');
    expect(STATIC_SYSTEM_PROMPT).toContain('"en brazos"');
  });
});

// ---------------------------------------------------------------------------
// §6 — Habitación
// ---------------------------------------------------------------------------

describe('§6 room — types + tolerant matching', () => {
  it('roomType maps to standard enum single|double|triple', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(
      /Map all variations to standard enum.*'single', 'double', 'triple'/,
    );
  });

  it('roomType is omitted when user does not mention it', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      "NO roomType or mealPlan because user didn't mention them",
    );
  });

  it('mealPlan is gated by explicit food keywords in the CURRENT message', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'NEVER infer mealPlan from context, previous messages, or assumptions',
    );
  });
});

// ---------------------------------------------------------------------------
// §7 — Hoteles específicos y cadenas
// ---------------------------------------------------------------------------

describe('§7 hotel chain + specific hotel detection', () => {
  it('§7.2 known major chains are listed (Riu, Iberostar, Melia, ...)', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('Riu, RIU Hotels, RIU Palace');
    expect(STATIC_SYSTEM_PROMPT).toContain('Iberostar');
    expect(STATIC_SYSTEM_PROMPT).toContain('Melia');
    expect(STATIC_SYSTEM_PROMPT).toContain('Bahia Principe');
    expect(STATIC_SYSTEM_PROMPT).toContain('Barcelo');
  });

  it('hotelChains supports MULTIPLE chains as an array', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('MULTI-CITY FLIGHT SEGMENTS');
    expect(STATIC_SYSTEM_PROMPT).toContain('hotelChains: ["Riu", "Iberostar"]');
  });

  it('§7.1 specific hotel names get their own slot (hotelName)', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(
      /SPECIFIC HOTEL NAME DETECTION \(hotelName\)/,
    );
  });
});

// ---------------------------------------------------------------------------
// §8 / §11 — Producto e intent classification
// ---------------------------------------------------------------------------

describe('§11 intent classification', () => {
  it('flight intention is detected from request-context keywords (verbs + flight nouns)', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'FLIGHT REQUEST INTENTION DETECTION (CRITICAL)',
    );
    expect(STATIC_SYSTEM_PROMPT).toContain(
      '**Request Context Indicators:**',
    );
  });

  it('typo and casual-language tolerance is required', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'TYPO AND VARIATION TOLERANCE (CRITICAL)',
    );
    expect(STATIC_SYSTEM_PROMPT).toContain('"bulo" → vuelo');
  });

  it('itinerary vs discovery boundary is documented', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(
      /A query is ITINERARY when ANY of these structural signals/,
    );
    expect(STATIC_SYSTEM_PROMPT).toMatch(
      /A query is DISCOVERY when:/,
    );
  });

  it('itinerary preserves country names (does NOT resolve to capital)', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'CRITICAL FOR ITINERARY: When the user mentions a COUNTRY name without specific cities',
    );
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'keep the COUNTRY NAME exactly as-is in the destinations array',
    );
  });

  it('preloaded regions ("Caribe", "Europa", ...) stay verbatim for the planner', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('PRELOADED REGION DESTINATIONS');
  });
});

// ---------------------------------------------------------------------------
// MULTI-CITY rules (§ Cases 8, 9, multi_city)
// ---------------------------------------------------------------------------

describe('multi-city flights — segment shape and tripType', () => {
  it('declares the three valid tripType values', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('`one_way`');
    expect(STATIC_SYSTEM_PROMPT).toContain('`round_trip`');
    expect(STATIC_SYSTEM_PROMPT).toContain('`multi_city`');
  });

  it('caps multi-city at 3 segments (current limit)', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'Maximum supported in this version: 3 segments',
    );
  });

  it('vuelta-desde-X with different city ⇒ multi_city, not round_trip', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      '"con vuelta el [fecha] desde [ciudad distinta]" is NOT necessarily round-trip',
    );
  });
});

// ---------------------------------------------------------------------------
// COMBINED date alignment (Cases 7, 8, 9 — vuelo+hotel)
// ---------------------------------------------------------------------------

describe('combined flight+hotel date alignment', () => {
  it('explicit hotel dates win over flight dates', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'If requestType is "combined" and the user specifies EXPLICIT hotel dates',
    );
  });

  it('falls back to flight dates only when hotel dates are NOT specified', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'ONLY fall back to flight dates when the user does NOT specify separate hotel dates',
    );
  });
});

// ---------------------------------------------------------------------------
// Persistence / closure-policy (avoid blocking with questions — §Regla madre)
// ---------------------------------------------------------------------------

describe('conversation closure policy — bias toward action', () => {
  it('prefers defaults over clarification whenever intent is clear enough', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'Prefer defaults over clarification whenever the user intent is clear enough',
    );
  });

  it('vague regions (Caribe, Europa, playa) become representative city options', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'For vague regions such as "Caribe", "Europa", or "playa", choose representative city-level options',
    );
  });

  it('after 3 assistant turns, missing_info_request must not be emitted (hard cap)', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'If it contains 3 or more assistant responses, do not emit missing_info_request',
    );
  });
});
