// =============================================================================
// responseSchema.ts — JSON Schema for ParsedTravelRequest (Structured Outputs)
// =============================================================================
//
// This schema is passed to OpenAI as `response_format.json_schema.schema` so
// the model is GUARANTEED to emit valid JSON conforming to the top-level shape
// of `ParsedTravelRequest` (see `src/services/aiMessageParser.ts`).
//
// Trade-off (strict-vs-permissive):
//   OpenAI's Structured Outputs strict mode (`strict: true`) requires:
//     • `additionalProperties: false` on every object
//     • EVERY property listed under `required`
//     • Optional fields modeled with `["type", "null"]` (no `oneOf` for opt)
//     • No `$ref` cycles, no `format`, no `pattern`/`minLength`/etc.
//
//   `ParsedTravelRequest` is too large for this:
//     • `flights`, `hotels`, `itinerary`, `packages`, `services` are deeply
//       nested optional sub-objects with their own conditional fields (e.g.
//       luggage only when user mentions baggage, mealPlan only when food is
//       mentioned). The parser prompt has dozens of "DO NOT include X unless
//       Y" rules — encoding that as required-with-null inflates the schema
//       hugely AND forces the model to emit `null` instead of OMITTING fields,
//       changing existing client-side behaviour (e.g. truthy checks like
//       `if (parsed.flights?.luggage)` already work because absent ≠ null).
//     • `editIntent`, `placeDiscoveryResult`, `pendingActionResolution` carry
//       free-form `Record<string, unknown>` payloads that strict mode rejects.
//
//   Therefore we:
//     1. Enforce strict shape ONLY on the top-level discriminator + numeric/
//        string fields the post-processor depends on (`requestType`,
//        `confidence`, `originalMessage`, plus a few defensive top-levels).
//     2. Keep ALL sub-objects (`flights`, `hotels`, etc.) as permissive
//        `additionalProperties: true` — the prompt's domain rules teach the
//        model what to put inside, and the existing TS-side normalizers
//        (`normalizeFlightRequest`, `normalizeIncomingHotelsPayload`,
//        `restoreCountryDestinationsForItinerary`) clean up the rest.
//     3. Ship with `strict: false` to allow this hybrid (strict mode would
//        reject `additionalProperties: true` on nested objects).
//
//   Net effect: the model can no longer hand back malformed JSON or wrap
//   the JSON in prose, but it retains full freedom to omit/include sub-
//   object fields per the prompt's domain rules. The TRY/CATCH JSON.parse
//   fallback in index.ts becomes a no-op for shape errors — only network
//   failures remain a concern. A small number of prompt tokens were
//   reclaimed by removing the literal `IMPORTANTE: Siempre responde solo
//   con JSON válido` reminder and the "partial JSON" qualifier in the
//   <persistence> block; conservative trim per the migration brief.
//
// If we ever need full-strict mode, the path is:
//   • Flatten optional sub-objects to `["object","null"]` with all leaf
//     fields required (and nullable) per OpenAI's strict rules.
//   • Drop free-form `payload`/`applied`/`meta` from the schema and only
//     surface them via the `meta.pendingActionResolution` envelope (already
//     done — those live OUTSIDE `parsed`).
// =============================================================================

/**
 * JSON Schema for the parser's final-message JSON.
 *
 * Passed as `response_format.json_schema.schema`. See header comment for the
 * strict-vs-permissive trade-off rationale.
 */
export const PARSED_TRAVEL_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  // Top-level allows additional properties so legacy/transitional fields
  // (e.g. `transfers`, `travelAssistance`, `placeDiscovery`, edge-case keys)
  // continue to round-trip even when not explicitly in the schema.
  additionalProperties: true,
  required: ["requestType", "confidence", "originalMessage"],
  properties: {
    requestType: {
      type: "string",
      enum: [
        "flights",
        "hotels",
        "packages",
        "services",
        "combined",
        "general",
        "missing_info_request",
        "itinerary",
      ],
      description:
        "Top-level discriminator. See parser prompt for routing rules per intent.",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Parser self-reported confidence in [0,1].",
    },
    originalMessage: {
      type: "string",
      description: "Echo of the user's raw message for audit/post-processing.",
    },
    // ---------------------------------------------------------------------
    // Sub-objects — declared so the model has light shape hints, but kept
    // permissive (additionalProperties: true) so the prompt's domain rules
    // about when to include/omit individual fields continue to govern.
    // ---------------------------------------------------------------------
    flights: {
      type: ["object", "null"],
      additionalProperties: true,
      description:
        "Flight request. Shape governed by prompt rules (luggage/stops/" +
        "cabinClass/etc. only when user explicitly mentions them).",
    },
    hotels: {
      type: ["object", "null"],
      additionalProperties: true,
      description:
        "Hotel request. Shape governed by prompt rules (roomType/mealPlan/" +
        "hotelChains only when user explicitly mentions them).",
    },
    packages: {
      type: ["object", "null"],
      additionalProperties: true,
    },
    services: {
      type: ["object", "null"],
      additionalProperties: true,
    },
    itinerary: {
      type: ["object", "null"],
      additionalProperties: true,
      description:
        "Trip-planner payload. May carry `editIntent` and free-form metadata.",
    },
    transfers: {
      type: ["object", "null"],
      additionalProperties: true,
    },
    travelAssistance: {
      type: ["object", "null"],
      additionalProperties: true,
    },
    placeDiscovery: {
      type: ["object", "null"],
      additionalProperties: true,
      description:
        "Place-discovery hint emitted alongside requestType=itinerary when " +
        "the user asks for concrete places to map.",
    },
    productOrder: {
      type: ["array", "null"],
      items: { type: "string", enum: ["flight", "hotel", "transfer"] },
      description:
        "Order in which the user mentioned the products. Emit ONLY when 2+ " +
        "products were mentioned in a clear sequence. Omit (null) for single " +
        "product or when user said 'paquete' without an explicit order.",
    },
    commercialIntent: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        kind: {
          type: "string",
          enum: [
            "flight_search",
            "hotel_search",
            "specific_hotel_search",
            "package_search",
            "ordered_multi_product_search",
            "budget_based_search",
            "price_sensitive_search",
            "family_trip_search",
            "premium_experience_search",
            "active_search_refinement",
            "correction",
            "add_product",
            "contradiction_detected",
            "trip_planning",
          ],
          description:
            "Agency/commercial search intent inferred semantically from the user message.",
        },
        agencyContext: {
          type: ["boolean", "null"],
          description:
            "True when the user speaks as an agent about a client/passenger rather than as the traveler.",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
        rationale: {
          type: ["string", "null"],
          description: "Short audit explanation for why this commercial intent was selected.",
        },
      },
      required: ["kind", "agencyContext", "confidence", "rationale"],
      description:
        "Semantic commercial intent contract. Emit from meaning, not regex, for agency shorthand, packages, ordered product searches, subjective budget/quality requests, corrections/refinements, add-ons, contradictions, and true planner requests.",
    },
    turnContinuity: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        relation: {
          type: "string",
          enum: [
            "continues_previous",
            "answers_pending_question",
            "refines_active_search",
            "selects_active_result",
            "adds_product",
            "changes_slot",
            "new_independent_request",
          ],
          description:
            "How the current user turn relates to the immediately previous assistant artifact.",
        },
        target: {
          type: "string",
          enum: ["last_search", "active_plan", "active_quote", "pending_action", "unknown"],
          description:
            "Conversation artifact the turn is continuing, if any.",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
        rationale: {
          type: ["string", "null"],
          description: "Short audit explanation for the continuity decision.",
        },
      },
      required: ["relation", "target", "confidence", "rationale"],
      description:
        "Semantic continuity contract. When previousContext, active_refs, pending_action, or recent search/proposal history exists, decide whether the user is continuing that context before classifying a new request. Prefer continuity for short partial second turns unless there is a clear new trip identity.",
    },
    travelerType: {
      type: ["string", "null"],
      enum: ["solo", "couple", "family", "group", null],
      description:
        "Traveler composition inferred from natural language: 'couple' for " +
        "pareja/novio/esposa, 'family' when kids/familia are mentioned, " +
        "'group' for amigos/grupo, 'solo' for solo trips. Null when the cue " +
        "is ambiguous.",
    },
    relativeDateHint: {
      type: ["string", "null"],
      enum: ["tomorrow", "this_weekend", "next_week", "next_month", null],
      description:
        "Canonical English enum for relative-date intent (mañana/tomorrow/" +
        "amanhã, este finde/this weekend, próxima semana/next week, próximo " +
        "mes/next month). Recognized multilingually; the client-side normalizer " +
        "performs the actual date arithmetic. Omit when no relative-date cue " +
        "is present or when the user gave explicit dates.",
    },
    partialStay: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        flightIntent: {
          type: "string",
          enum: ["one_way", "round_trip"],
          description:
            "Whether the flight portion is one-way (no return given) or " +
            "round-trip (explicit return mentioned).",
        },
        hotelNights: {
          type: ["number", "null"],
          description:
            "Number of paid hotel nights when explicitly stated by the user " +
            "(e.g. 'hotel 3 noches'). Null/omitted when not specified.",
        },
        extendsBeyondHotel: {
          type: "boolean",
          description:
            "True when the user signals they will continue the trip beyond " +
            "the booked hotel without booking lodging (staying with a friend, " +
            "family, road-tripping after, couch-surfing, etc.).",
        },
        signalsCaught: {
          type: "array",
          items: { type: "string" },
          description:
            "Verbatim cue strings (in the user's language) that indicate the " +
            "extends-beyond-hotel intent. Used for telemetry and audit.",
        },
      },
      required: ["flightIntent", "extendsBeyondHotel", "signalsCaught"],
      description:
        "Emit when the user signals 'flight + partial hotel stay' intent " +
        "(e.g. 'Cancún + hotel 3 noches, después me quedo con un amigo'). " +
        "The client-side normalizer applies the consequence (one-way flight, " +
        "checkout = checkin + hotelNights).",
    },
    quoteIntent: {
      type: ["boolean", "null"],
      description:
        "Semantic intent flag: TRUE when the user expresses intent to GET A " +
        "PRICE / SEARCH FOR AVAILABILITY (cotizame, dame precio, busca un " +
        "vuelo, cuánto sale / quote me, get me a price, search for, how much " +
        "is / me cota, qual o preço, busca um voo). Recognized multilingually " +
        "from MEANING — never from surface keywords. False/omitted when the " +
        "user is exploring without firm purchase intent.",
    },
    planIntent: {
      type: ["boolean", "null"],
      description:
        "Semantic intent flag: TRUE when the user asks to BUILD AN ITINERARY " +
        "/ ORGANIZE A TRIP STRUCTURE — not just price one product (armame un " +
        "viaje, planifica un recorrido, circuito por… / build me a trip, plan " +
        "a route, organize a trip through… / monta uma viagem, planeja um " +
        "roteiro). Recognized multilingually from MEANING. Independent of " +
        "quoteIntent — both can be true simultaneously.",
    },
    referencesCurrentPlan: {
      type: ["boolean", "null"],
      description:
        "Semantic anaphora flag: TRUE when the user message refers to a " +
        "previously-discussed plan/itinerary/quote via deictic markers (este " +
        "viaje, ese plan, lo anterior, lo que armamos / this trip, that plan, " +
        "the previous one, what we built / essa viagem, esse plano, o " +
        "anterior). Recognized multilingually from MEANING. Combinable with " +
        "quoteIntent and planIntent (e.g. 'cotizame este viaje').",
    },
    // ---------------------------------------------------------------------
    // Iteration intent — emitted when `previousContext` is non-empty so the
    // orchestrator can suppress mode_bridge and treat the turn as a refinement
    // of the active search rather than a fresh request. The LLM has full
    // conversation history + previousContext + current message and can
    // reason about meaning across languages; downstream regex fallback
    // (CASE 13/14 in `iterationDetection.ts`) acts as belt-and-suspenders.
    // See prompt section "ITERATION INTENT DETECTION" for emission rules.
    // ---------------------------------------------------------------------
    iterationIntent: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        isIteration: { type: "boolean" },
        type: {
          type: ["string", "null"],
          enum: [
            "duration_change",
            "destination_swap",
            "pax_change",
            "preference_change",
            "continuation",
            "unrelated",
            null,
          ],
        },
        modifiedFields: {
          type: "array",
          items: { type: "string" },
          description:
            "Dotted paths against the request schema (e.g. 'flights.destination', " +
            "'hotels.checkoutDate', 'itinerary.destinations'). Synthetic " +
            "'stayNights' is allowed when stay duration changes.",
        },
        rationale: {
          type: ["string", "null"],
          description: "1-line debug explanation, optional.",
        },
      },
      required: ["isIteration", "type", "modifiedFields"],
      description:
        "Iteration-intent signal. Emit when `previousContext` is non-empty and " +
        "the user's new message is refining (or pivoting away from) the prior " +
        "search/plan. Omit (or set isIteration=false, type=null) when no " +
        "previousContext was provided. The orchestrator consumes this signal " +
        "to keep the user on the same conversation track; the merged " +
        "ParsedTravelRequest is still emitted alongside per SEARCH REFINEMENT.",
    },
    // ---------------------------------------------------------------------
    // Search seeds — exploratory-but-actionable hints. Emitted when the
    // user names a destination AND at least one of: traveler type, budget
    // hint, occasion hint, OR an adult count, but the request does not
    // cleanly map to a precise QUOTE-ready flights/hotels/combined payload.
    // Downstream orchestration (router + voice layer) consumes these to
    // synthesize a one-click search proposal. See prompt section
    // "SEARCH SEEDS — EXPLORATORY INTENT" for emission rules.
    //
    // TODO(premium-categorization): `budgetHint` is a semantic label only
    // (budget|mid|premium|luxury). Concrete chain mappings (e.g. which
    // hotel chains count as "premium" in Riviera Maya) are intentionally
    // deferred — the downstream layer surfaces the hint as user-visible
    // copy without forcing concrete `hotelChains` choices. This is an open
    // product decision that applies to BOTH agency and passenger flows.
    // ---------------------------------------------------------------------
    searchSeeds: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        destination: {
          type: ["string", "null"],
          description:
            "City or region the user mentioned, even when requestType is " +
            "'general'. Verbatim — no IATA normalization here; downstream " +
            "handles it.",
        },
        travelerType: {
          type: ["string", "null"],
          enum: ["solo", "couple", "family", "group", null],
        },
        budgetHint: {
          type: ["string", "null"],
          enum: ["budget", "mid", "premium", "luxury", null],
        },
        occasionHint: {
          type: ["string", "null"],
          enum: [
            "anniversary",
            "honeymoon",
            "birthday",
            "business",
            "leisure",
            null,
          ],
        },
        productsImplied: {
          type: "array",
          items: {
            type: "string",
            enum: ["flight", "hotel", "transfer", "package"],
          },
        },
        adults: { type: ["number", "null"] },
        children: { type: ["number", "null"] },
      },
      required: ["productsImplied"],
      description:
        "Exploratory-but-actionable hints. Emit when the user names a " +
        "destination AND at least one of {travelerType, budgetHint, " +
        "occasionHint, adults}, even if requestType resolves to 'general' " +
        "or 'missing_info_request'. Always include `productsImplied` (≥1).",
    },
    // ---------------------------------------------------------------------
    // Missing-info / clarifying-question fields.
    // ---------------------------------------------------------------------
    message: {
      type: ["string", "null"],
      description:
        "User-facing clarifying question for missing_info_request.",
    },
    missingFields: {
      type: ["array", "null"],
      items: { type: "string" },
    },
    missingRequiredFields: {
      type: ["array", "null"],
      items: { type: "string" },
    },
    needsMoreInfo: {
      type: ["boolean", "null"],
    },
    summary: {
      type: ["string", "null"],
      description: "Optional human-readable summary of the parsed request.",
    },
  },
};

/**
 * Convenience helper — returns the full `response_format` payload to pass
 * straight into the OpenAI chat-completions body.
 *
 * Note: `strict: false` because nested sub-objects use
 * `additionalProperties: true`. See header comment for rationale.
 */
export function buildResponseFormat(): {
  type: "json_schema";
  json_schema: {
    name: string;
    schema: Record<string, unknown>;
    strict: boolean;
  };
} {
  return {
    type: "json_schema",
    json_schema: {
      name: "parsed_travel_request",
      schema: PARSED_TRAVEL_REQUEST_SCHEMA,
      strict: false,
    },
  };
}
