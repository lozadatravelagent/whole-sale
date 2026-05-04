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
