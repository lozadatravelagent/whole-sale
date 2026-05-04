// =============================================================================
// functionTools.ts — Retrieval Tool Catalog (Phase 3.2)
// =============================================================================
//
// Authoritative spec: docs/architecture/tool-catalog-spec.md §2
//
// Implements the read-only retrieval/provider tools the Emilia agent can invoke:
//   - get_planner_state         (queries `trips`)
//   - get_recent_searches       (queries `messages.meta.searchResults`)
//   - get_lead_full_history     (queries `lead_ai_profiles` + `trips` + `leads`)
//   - discover_places           (queries Foursquare-backed places shared service)
//
// All tools are PURE READS. No DB writes, no side effects on EmiliaState.
// All schemas are `strict: true` per OpenAI Function Calling Guide.
// All responses are compact JSON capped at ~2000 tokens (≈8000 chars).
//
// Phase 2 will append `save_memory_note` to the catalog by spreading its own
// tools into `getRetrievalToolSchemas()` upstream — this file only owns the
// retrieval surface.
// =============================================================================

// We type the supabase client loosely to avoid pinning to a specific export.
// The shape we need is `from(table).select(...).eq(...).order(...).limit(...)`.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

import type {
  PlannerPlaceCandidate,
  PlannerPlaceCategory,
  PlacesLocation,
} from "./places/types.ts";
import type { DiscoveryCandidateRef, EmiliaState } from "./emiliaStateTypes.ts";
import { MAX_DISCOVERY_CANDIDATES } from "./emiliaStateTypes.ts";

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

/** OpenAI function tool schema (chat.completions tools[] entry). */
export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    strict: true;
    parameters: {
      type: "object";
      additionalProperties: false;
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

/** Per-turn execution context handed to every tool handler. */
export interface ToolContext {
  supabase: SupabaseClient;
  conversationId: string;
  agencyId: string;
  leadId?: string;
}

/** Generic retrieval-tool definition. */
export interface RetrievalTool<TArgs = unknown, TResult = unknown> {
  schema: OpenAITool;
  handler: (args: TArgs, ctx: ToolContext) => Promise<TResult>;
}

// -----------------------------------------------------------------------------
// Token-budget helpers
// -----------------------------------------------------------------------------
//
// We do NOT have a real tokenizer in the Deno edge runtime, so we approximate:
// 1 token ≈ 4 characters of compact JSON. Hard cap: 2000 tokens ≈ 8000 chars.
// Exceeding this triggers a single round of truncation/summarization within
// the handler; the spec's §1.5 "tools must paginate or summarize" rule.

const RESPONSE_CHAR_CAP = 8000;

function fitToCap<T>(payload: T): T | { truncated: true; partial: T; note: string } {
  const json = JSON.stringify(payload);
  if (json.length <= RESPONSE_CHAR_CAP) return payload;
  return {
    truncated: true,
    partial: payload,
    note: "response_truncated_at_cap_use_more_specific_query",
  };
}

const DISCOVERY_CATEGORIES = [
  "restaurant",
  "cafe",
  "museum",
  "activity",
  "sights",
  "nightlife",
  "parks",
  "shopping",
  "culture",
] as const satisfies readonly PlannerPlaceCategory[];

type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];
type DiscoveryIntent =
  | "broad"
  | "food"
  | "nightlife"
  | "culture"
  | "sights"
  | "parks"
  | "shopping"
  | "neighborhoods";

export interface DiscoverPlacesArgs {
  destination_city: string;
  destination_country: string | null;
  lat: number | null;
  lng: number | null;
  categories: DiscoveryCategory[];
  intent: DiscoveryIntent;
  limit_per_category: number | null;
  radius_m: number | null;
}

function isDiscoveryCategory(value: unknown): value is DiscoveryCategory {
  return typeof value === "string" &&
    (DISCOVERY_CATEGORIES as readonly string[]).includes(value);
}

function defaultCategoriesForIntent(intent: DiscoveryIntent): DiscoveryCategory[] {
  switch (intent) {
    case "food":
      return ["restaurant", "cafe", "nightlife", "sights"];
    case "nightlife":
      return ["nightlife", "restaurant", "cafe", "activity"];
    case "culture":
      return ["museum", "culture", "sights", "activity"];
    case "sights":
      return ["sights", "museum", "parks", "culture"];
    case "parks":
      return ["parks", "sights", "activity", "cafe"];
    case "shopping":
      return ["shopping", "restaurant", "cafe", "sights"];
    case "neighborhoods":
      return ["sights", "activity", "parks", "culture", "cafe"];
    case "broad":
    default:
      return ["sights", "museum", "culture", "parks", "activity"];
  }
}

function clampInt(value: number | null | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.round(value as number)));
}

function validLocation(lat: unknown, lng: unknown): PlacesLocation | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const nextLat = Number(lat);
  const nextLng = Number(lng);
  if (nextLat < -90 || nextLat > 90 || nextLng < -180 || nextLng > 180) return null;
  return { lat: nextLat, lng: nextLng };
}

function compactPlace(place: PlannerPlaceCandidate): Record<string, unknown> {
  const lat = place.lat ?? null;
  const lng = place.lng ?? null;
  return {
    id: place.placeId,
    name: place.name,
    category: place.category,
    rating: place.rating ?? null,
    address: place.formattedAddress ?? null,
    coordinates: (Number.isFinite(lat) && Number.isFinite(lng))
      ? { lat, lng }
      : null,
  };
}

function dedupeByPlaceIdOrName(places: PlannerPlaceCandidate[]): PlannerPlaceCandidate[] {
  const seen = new Set<string>();
  const out: PlannerPlaceCandidate[] = [];
  for (const place of places) {
    const key = place.placeId || `${place.name.toLowerCase()}::${place.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(place);
  }
  return out;
}

function deriveCenter(location: PlacesLocation | null, places: PlannerPlaceCandidate[]): PlacesLocation | null {
  if (location) return location;
  const withCoords = places.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng));
  if (!withCoords.length) return null;
  return {
    lat: withCoords.reduce((sum, place) => sum + Number(place.lat), 0) / withCoords.length,
    lng: withCoords.reduce((sum, place) => sum + Number(place.lng), 0) / withCoords.length,
  };
}

/**
 * Round-robin flatten of per-category candidate lists so the resulting
 * ordering interleaves categories (top-1 of each → top-2 of each → ...).
 * Diversity matters because the LLM surfaces this list to the user; without
 * round-robin the "top 12" can degenerate into "12 restaurants" when the
 * provider over-indexes on a single category.
 *
 * Order of `categories` is preserved across the round-robin iteration so
 * callers can prioritize (e.g. user asked for "nightlife": pass nightlife
 * first → nightlife wins ties). Tail leftovers are appended in the same
 * order. Pure: caller may slice the result freely.
 */
function roundRobinByCategory(
  categories: readonly DiscoveryCategory[],
  byCategory: Partial<Record<DiscoveryCategory, PlannerPlaceCandidate[]>>,
): PlannerPlaceCandidate[] {
  const queues = categories.map((c) => [...(byCategory[c] ?? [])]);
  const out: PlannerPlaceCandidate[] = [];
  let drained = false;
  while (!drained) {
    drained = true;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        out.push(next);
        drained = false;
      }
    }
  }
  return out;
}

/**
 * Pure helper: convert a `discover_places` tool result into the persistable
 * `DiscoveryCandidateRef[]` shape. Returns `null` when the result is not a
 * successful place-discovery payload (so the closure in `index.ts` can skip
 * the persistence step without inspecting the shape itself).
 *
 * Persists only candidates that carry the minimum data the model needs to
 * reference them (placeId + name + lat/lng + category). Strips PII-leaning
 * fields and caps the array at `MAX_DISCOVERY_CANDIDATES`. Order matches the
 * order returned to the model so "the second one in the listing" resolves
 * the same place the user saw.
 */
/**
 * Server-side resolver for known `discover_places` args. When the model passes
 * `null` for lat/lng but a previous discovery on the same city already
 * surfaced coordinates, fill them in from `state.discovery_candidates`.
 *
 * Per OpenAI's Function Calling guide ("Don't make the model fill arguments
 * you already know"). Reduces hallucinated coordinates and improves the
 * downstream Foursquare query quality. Silent — never throws; returns the
 * original args on any unexpected condition.
 *
 * Strategy (Option A — cheap):
 *   - Look up the requested city by case-insensitive substring match against
 *     each cached candidate's `address` field. Foursquare addresses include
 *     the locality, so this is reliable.
 *   - On first match with finite coords, fill in lat/lng. Country is NOT
 *     resolved (DiscoveryCandidateRef has no country field).
 *
 * Returns args unchanged if state is null, candidates are empty, or no match.
 */
export function resolveKnownDiscoveryArgs(
  args: DiscoverPlacesArgs,
  state: EmiliaState | null,
): DiscoverPlacesArgs {
  try {
    if (!state) return args;
    const allKnown =
      typeof args.destination_country === "string" &&
      typeof args.lat === "number" &&
      Number.isFinite(args.lat) &&
      typeof args.lng === "number" &&
      Number.isFinite(args.lng);
    if (allKnown) return args;

    const candidates = state.discovery_candidates ?? [];
    if (candidates.length === 0) return args;

    const cityNorm = (args.destination_city ?? "").trim().toLowerCase();
    if (!cityNorm) return args;

    let resolvedLat: number | null = null;
    let resolvedLng: number | null = null;
    for (const c of candidates) {
      const addr = typeof c.address === "string" ? c.address.toLowerCase() : "";
      if (!addr.includes(cityNorm)) continue;
      if (
        typeof c.lat === "number" &&
        Number.isFinite(c.lat) &&
        typeof c.lng === "number" &&
        Number.isFinite(c.lng)
      ) {
        resolvedLat = c.lat;
        resolvedLng = c.lng;
        break;
      }
    }

    if (resolvedLat === null || resolvedLng === null) return args;

    const filledLat = typeof args.lat === "number" && Number.isFinite(args.lat) ? args.lat : resolvedLat;
    const filledLng = typeof args.lng === "number" && Number.isFinite(args.lng) ? args.lng : resolvedLng;

    if (filledLat !== args.lat || filledLng !== args.lng) {
      console.log(
        `[CTX-DISCOVERY-AUTORESOLVE] city=${args.destination_city} lat:${args.lat}->${filledLat} lng:${args.lng}->${filledLng}`,
      );
    }

    return { ...args, lat: filledLat, lng: filledLng };
  } catch (err) {
    console.warn("[CTX-DISCOVERY-AUTORESOLVE] resolver failed silently:", err);
    return args;
  }
}

export function extractDiscoveryCandidates(result: unknown): DiscoveryCandidateRef[] | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  if (r.ok !== true) return null;
  const rawPlaces = Array.isArray(r.places) ? r.places : null;
  if (!rawPlaces || rawPlaces.length === 0) return null;

  const candidates: DiscoveryCandidateRef[] = [];
  for (const raw of rawPlaces) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const placeId = typeof p.id === "string" ? p.id : null;
    const name = typeof p.name === "string" ? p.name : null;
    const coords = p.coordinates && typeof p.coordinates === "object"
      ? p.coordinates as Record<string, unknown>
      : null;
    const lat = coords && typeof coords.lat === "number" && Number.isFinite(coords.lat)
      ? coords.lat
      : null;
    const lng = coords && typeof coords.lng === "number" && Number.isFinite(coords.lng)
      ? coords.lng
      : null;
    const category = typeof p.category === "string" ? p.category : null;
    // All four are required to make the ref useful; drop incomplete entries.
    if (!placeId || !name || lat === null || lng === null || !category) continue;

    const ref: DiscoveryCandidateRef = { placeId, name, lat, lng, category };
    if (typeof p.rating === "number" && Number.isFinite(p.rating)) ref.rating = p.rating;
    if (typeof p.address === "string" && p.address.trim()) ref.address = p.address;

    candidates.push(ref);
    if (candidates.length >= MAX_DISCOVERY_CANDIDATES) break;
  }
  return candidates.length > 0 ? candidates : null;
}

// -----------------------------------------------------------------------------
// 1. get_planner_state — fetch full trip plan
// -----------------------------------------------------------------------------

interface GetPlannerStateArgs {
  planner_id: string;
}

const getPlannerStateSchema: OpenAITool = {
  type: "function",
  function: {
    name: "get_planner_state",
    description:
      "Fetch the full trip plan for a given planner_id (destinations, dates, hotels, transport, daily activities, budget, pace). " +
      "Use when: the user references 'the plan', 'el itinerario', or 'esto' and a plan ref is active; you need plan specifics to quote, edit, or compare; mode=agency and the user asks to price the current plan. " +
      "Don't use for: general questions about destinations the user has not added to a plan; quick suggestions where the active_refs summary already suffices.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        planner_id: {
          type: "string",
          description:
            "UUID of the trip planner. Resolve from state.active_refs where type='plan'.",
        },
      },
      required: ["planner_id"],
    },
  },
};

async function getPlannerStateHandler(
  args: GetPlannerStateArgs,
  ctx: ToolContext,
): Promise<unknown> {
  if (!args?.planner_id || typeof args.planner_id !== "string") {
    return { error: "bad_arguments", detail: "planner_id required" };
  }

  // RLS handles agency scoping, but we filter on agency_id explicitly as a
  // belt-and-braces safety check in case this runs with a service-role key.
  const { data: trip, error } = await ctx.supabase
    .from("trips")
    .select(
      "id, title, status, start_date, end_date, total_nights, budget_level, pace, " +
      "travelers, destination_cities, destination_countries, planner_state, " +
      "lead_id, updated_at",
    )
    .eq("id", args.planner_id)
    .eq("agency_id", ctx.agencyId)
    .maybeSingle();

  if (error) {
    return { error: "unavailable", detail: error.message ?? "trips_query_failed" };
  }
  if (!trip) {
    return { error: "not_found", detail: `planner_id ${args.planner_id} not found` };
  }

  // Pull denormalized segments for the compact destinations/hotels/transport view.
  const { data: segments } = await ctx.supabase
    .from("trip_segments")
    .select(
      "segment_index, city, country, start_date, end_date, nights, " +
      "hotel_name, hotel_price_per_night, flight_price_per_person",
    )
    .eq("trip_id", trip.id)
    .order("segment_index", { ascending: true });

  const destinations = (segments ?? []).map((s: Record<string, unknown>) => ({
    city: s.city,
    country: s.country,
    days: s.nights,
    arrive: s.start_date,
  }));

  const hotels = (segments ?? [])
    .filter((s: Record<string, unknown>) => s.hotel_name)
    .map((s: Record<string, unknown>) => ({
      city: s.city,
      name: s.hotel_name,
      nights: s.nights,
      rate_per_night: s.hotel_price_per_night,
    }));

  const compact = {
    planner_id: trip.id,
    title: trip.title ?? null,
    status: trip.status,
    currency: "USD", // trips table has no currency col yet; default for compact view
    budget: trip.budget_level,
    pace: trip.pace,
    start_date: trip.start_date,
    end_date: trip.end_date,
    nights: trip.total_nights,
    pax: trip.travelers,
    destinations,
    hotels,
    lead_id: trip.lead_id,
    updated_at: trip.updated_at,
  };

  return fitToCap(compact);
}

// -----------------------------------------------------------------------------
// 2. get_recent_searches — last N flight/hotel/package searches
// -----------------------------------------------------------------------------

type SearchKind = "flights" | "hotels" | "packages";

interface GetRecentSearchesArgs {
  // Per spec §2.3 the schema requires both fields and allows null.
  limit: number | null;
  kind: SearchKind | null;
}

const getRecentSearchesSchema: OpenAITool = {
  type: "function",
  function: {
    name: "get_recent_searches",
    description:
      "Fetch the last N flight/hotel/package searches executed in the current conversation, with key parameters and top results summary. " +
      "Use when: the user references 'esa búsqueda', 'los vuelos que vimos antes', 'el hotel de la mañana'; you need context from earlier exploration that was trimmed from the conversation tail. " +
      "Don't use for: re-running a search (call the search tool directly with fresh parameters); fetching results from a different conversation.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: {
          type: ["integer", "null"],
          description:
            "Max number of searches to return, ordered most-recent first. Null defaults to 5. Hard max 10.",
        },
        kind: {
          type: ["string", "null"],
          enum: ["flights", "hotels", "packages", null],
          description: "Filter by search kind. Null returns all kinds.",
        },
      },
      required: ["limit", "kind"],
    },
  },
};

const RECENT_SEARCHES_HARD_MAX = 10;

async function getRecentSearchesHandler(
  args: GetRecentSearchesArgs,
  ctx: ToolContext,
): Promise<unknown> {
  const requested = typeof args?.limit === "number" && args.limit > 0 ? args.limit : 5;
  const limit = Math.min(requested, RECENT_SEARCHES_HARD_MAX);
  const kind = args?.kind ?? null;

  // The contract: messages whose `meta.searchResults` is not null are the
  // search-result envelopes. Postgres JSONB does not let us cleanly express
  // "key exists" via PostgREST `.not('meta->searchResults', 'is', null)` on
  // every server, so we filter client-side after pulling a small candidate
  // set ordered by created_at DESC.
  const candidatePool = Math.min(limit * 4, 40); // headroom for non-search rows

  const { data: rows, error } = await ctx.supabase
    .from("messages")
    .select("id, role, meta, created_at")
    .eq("conversation_id", ctx.conversationId)
    .order("created_at", { ascending: false })
    .limit(candidatePool);

  if (error) {
    return { error: "unavailable", detail: error.message ?? "messages_query_failed" };
  }

  const filtered = (rows ?? [])
    .filter((row: Record<string, unknown>) => {
      const meta = (row.meta ?? {}) as Record<string, unknown>;
      const searchResults = meta?.searchResults;
      if (!searchResults) return false;
      if (kind && (meta.searchKind ?? (searchResults as Record<string, unknown>)?.kind) !== kind) {
        return false;
      }
      return true;
    })
    .slice(0, limit)
    .map((row: Record<string, unknown>) => {
      const meta = (row.meta ?? {}) as Record<string, unknown>;
      const sr = (meta.searchResults ?? {}) as Record<string, unknown>;
      const inferredKind = (meta.searchKind ?? sr.kind ?? "unknown") as string;

      // Trim params to search-identifying fields only; drop full provider request blobs.
      const rawParams = (sr.params ?? meta.searchParams ?? {}) as Record<string, unknown>;
      const params = {
        origin: rawParams.origin ?? rawParams.from ?? null,
        destination: rawParams.destination ?? rawParams.to ?? rawParams.city ?? null,
        check_in: rawParams.check_in ?? rawParams.checkIn ?? rawParams.depart ?? rawParams.date_from ?? null,
        check_out: rawParams.check_out ?? rawParams.checkOut ?? rawParams.return ?? rawParams.date_to ?? null,
        pax: rawParams.pax ?? rawParams.adults ?? rawParams.passengers ?? null,
      };

      const rawResults = Array.isArray(sr.top)
        ? (sr.top as Array<Record<string, unknown>>)
        : Array.isArray(sr.results)
          ? (sr.results as Array<Record<string, unknown>>)
          : [];
      const result_count = typeof sr.total === "number" ? sr.total : rawResults.length;

      // Trim each result to a lightweight summary; drop full provider schedules.
      const top = rawResults.slice(0, 3).map((item) => ({
        id: item.id ?? item.resultId ?? null,
        summary: item.summary ?? item.label ?? item.name ?? item.title ?? null,
        price: item.price ?? item.totalPrice ?? item.fare ?? null,
        destination: item.destination ?? item.city ?? item.hotel ?? item.to ?? null,
      }));

      return {
        id: row.id,
        kind: inferredKind,
        at: row.created_at,
        params,
        result_count,
        top,
      };
    });

  return fitToCap({ searches: filtered });
}

// -----------------------------------------------------------------------------
// 4. get_lead_full_history — extended profile + history
// -----------------------------------------------------------------------------

interface GetLeadFullHistoryArgs {
  lead_id: string;
}

const getLeadFullHistorySchema: OpenAITool = {
  type: "function",
  function: {
    name: "get_lead_full_history",
    description:
      "Fetch extended profile and historical activity for a lead (past trips, prior quotes, satisfaction notes, contact log). " +
      "Use when: planning long-term strategy for a recurring client; analyzing patterns ('¿qué tipo de viajes le gustan?'); the compact profile in state is insufficient. " +
      "Don't use for: routine lookups (the profile in state.profile already includes lead_id, currency, top preferences); quick personalization where active_refs lead summary suffices.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        lead_id: {
          type: "string",
          description:
            "Lead UUID. Resolve from state.profile.lead_id or active_refs.",
        },
      },
      required: ["lead_id"],
    },
  },
};

async function getLeadFullHistoryHandler(
  args: GetLeadFullHistoryArgs,
  ctx: ToolContext,
): Promise<unknown> {
  if (!args?.lead_id || typeof args.lead_id !== "string") {
    return { error: "bad_arguments", detail: "lead_id required" };
  }

  // Pull contact + status from leads, AI-built profile from lead_ai_profiles,
  // and the trip history from trips. All RLS-scoped to agency_id.
  const [{ data: lead, error: leadErr }, { data: aiProfile }, { data: trips }] =
    await Promise.all([
      ctx.supabase
        .from("leads")
        .select("id, contact, trip, status, created_at, updated_at")
        .eq("id", args.lead_id)
        .eq("agency_id", ctx.agencyId)
        .maybeSingle(),
      ctx.supabase
        .from("lead_ai_profiles")
        .select("profile_json, summary_text, updated_at")
        .eq("lead_id", args.lead_id)
        .eq("agency_id", ctx.agencyId)
        .maybeSingle(),
      ctx.supabase
        .from("trips")
        .select("id, status, start_date, end_date, destination_cities, travelers")
        .eq("lead_id", args.lead_id)
        .eq("agency_id", ctx.agencyId)
        .order("start_date", { ascending: false })
        .limit(20),
    ]);

  if (leadErr) {
    return { error: "unavailable", detail: leadErr.message ?? "leads_query_failed" };
  }
  if (!lead) {
    return { error: "not_found", detail: `lead_id ${args.lead_id} not found` };
  }

  const compact = {
    lead_id: lead.id,
    contact: lead.contact,
    status: lead.status,
    since: lead.created_at,
    last_update: lead.updated_at,
    trip_request: lead.trip ?? null,
    ai_profile: aiProfile?.profile_json ?? null,
    ai_summary: aiProfile?.summary_text ?? null,
    trips: (trips ?? []).map((t: Record<string, unknown>) => ({
      id: t.id,
      destination: t.destination_cities,
      dates: { start: t.start_date, end: t.end_date },
      status: t.status,
      pax_count: t.travelers,
    })),
    trip_count: (trips ?? []).length,
  };

  return fitToCap(compact);
}

// -----------------------------------------------------------------------------
// 5. discover_places — read-only provider-backed place discovery
// -----------------------------------------------------------------------------

const discoverPlacesSchema: OpenAITool = {
  type: "function",
  function: {
    name: "discover_places",
    description:
      "Find concrete non-hotel/non-flight places in a destination for map-backed travel discovery: things to do, restaurants, cafes, bars/nightlife, museums, sights, parks, shopping, culture, and neighborhoods. " +
      "Use when: the user asks for concrete places to visit/eat/drink/explore, wants bars/restaurants/things to do, or asks to show/hydrate places on the map. " +
      "Don't use for: flight or hotel searches, availability/pricing/quotes, generic conceptual destination questions without concrete place suggestions, or saving places into a planner. " +
      "When destination_country/lat/lng are unknown, pass null — the server-side resolver will auto-fill them from prior discovery_candidates if the city matches.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        destination_city: {
          type: "string",
          description: "Destination city to search, resolved from the user request, planner state, or recent conversation.",
        },
        destination_country: {
          type: ["string", "null"],
          description: "Destination country when known; null otherwise.",
        },
        lat: {
          type: ["number", "null"],
          description: "Latitude for the destination center when known; null if unavailable.",
        },
        lng: {
          type: ["number", "null"],
          description: "Longitude for the destination center when known; null if unavailable.",
        },
        categories: {
          type: "array",
          description: "Provider categories to search. Never include hotel.",
          items: {
            type: "string",
            enum: DISCOVERY_CATEGORIES,
          },
        },
        intent: {
          type: "string",
          enum: ["broad", "food", "nightlife", "culture", "sights", "parks", "shopping", "neighborhoods"],
          description: "Natural-language discovery intent inferred from the user request.",
        },
        limit_per_category: {
          type: ["number", "null"],
          description: "Optional per-category limit. Defaults to 4, max 6.",
        },
        radius_m: {
          type: ["number", "null"],
          description: "Optional radius in meters around lat/lng. Defaults to 2500, max 5000.",
        },
      },
      required: [
        "destination_city",
        "destination_country",
        "lat",
        "lng",
        "categories",
        "intent",
        "limit_per_category",
        "radius_m",
      ],
    },
  },
};

async function discoverPlacesHandler(
  args: DiscoverPlacesArgs,
  _ctx: ToolContext,
): Promise<unknown> {
  if (!args?.destination_city || typeof args.destination_city !== "string") {
    return { error: "bad_arguments", detail: "destination_city required" };
  }

  const requestedCategories = Array.isArray(args.categories)
    ? args.categories
    : [];
  const hasHotelCategory = (requestedCategories as string[]).some((category) => category === "hotel");
  if (hasHotelCategory) {
    return { error: "bad_arguments", detail: "hotel category is not allowed in discover_places" };
  }

  const intent = args.intent || "broad";
  const categories = (requestedCategories.filter(isDiscoveryCategory).length
    ? requestedCategories.filter(isDiscoveryCategory)
    : defaultCategoriesForIntent(intent)
  ).slice(0, 6);

  const city = args.destination_city.trim();
  let location = validLocation(args.lat, args.lng);
  const radius = clampInt(args.radius_m, 2500, 5000);
  const limitPerCategory = clampInt(args.limit_per_category, 4, 6);

  const [
    {
      getProviderCallCount,
      getProviderCooldownRemaining,
      resetProviderCallCount,
    },
    {
      fetchPlaceRecommendations,
      fetchViewportPlaces,
      resolveCityCoordinates,
    },
  ] = await Promise.all([
    import("./places/foursquare.ts"),
    import("./places/service.ts"),
  ]);

  resetProviderCallCount();
  const logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  // Internal geocoding fallback: the LLM frequently omits lat/lng even when
  // the schema requires them. Without coordinates we'd skip the high-quality
  // viewport path and rely solely on the broad text-search recommendations.
  // Resolving the city ourselves lets the productive path run on every call
  // where we at least know the destination_city. See [CTX-DISCOVERY-GEOCODE].
  let geocodingUsed: "llm" | "internal" | "none" = location ? "llm" : "none";
  if (!location && city) {
    const resolved = await resolveCityCoordinates(city, args.destination_country, logger);
    if (resolved) {
      location = resolved;
      geocodingUsed = "internal";
      console.log("[CTX-DISCOVERY-GEOCODE]", JSON.stringify({
        category: "CTX-DISCOVERY-GEOCODE",
        city,
        country: args.destination_country ?? null,
        lat: resolved.lat,
        lng: resolved.lng,
        source: "foursquare_text_search",
      }));
    }
  }

  let partial = false;
  let cacheStatus: "hit" | "miss" | "stale" | "unavailable" = "unavailable";

  // Round-robin requires preserving the per-category structure from the
  // viewport response. We diverge from the previous "category-by-category
  // flatMap" so the top of the merged list interleaves categories instead of
  // returning all restaurants then all cafes — see `roundRobinByCategory`.
  const viewportByCategory: Partial<Record<DiscoveryCategory, PlannerPlaceCandidate[]>> = {};
  if (location) {
    const viewport = await fetchViewportPlaces({
      city,
      location,
      categories,
      radius,
      limit: limitPerCategory,
    }, logger);
    cacheStatus = viewport.cacheStatus;
    partial = Boolean(viewport.data.partial);
    for (const category of categories) {
      const list = viewport.data.placesByCategory[category];
      if (list && list.length) viewportByCategory[category] = [...list];
    }
  }

  const recommendations = await fetchPlaceRecommendations({
    destinations: [city],
    limitPerCity: 8,
    // Honor the LLM-provided categories so the broad path (no lat/lng) doesn't
    // collapse to "top tourist attractions" when the user asked for something
    // specific (e.g. "bares en Madrid" → nightlife → bars/nightlife query).
    categories,
  }, logger).catch(() => null);
  const recommendationCandidates: PlannerPlaceCandidate[] = [];
  if (recommendations?.data?.destinations?.length) {
    recommendationCandidates.push(
      ...recommendations.data.destinations
        .filter((group) => group.city.toLowerCase() === city.toLowerCase())
        .flatMap((group) => group.places ?? []),
    );
    if (cacheStatus === "unavailable") cacheStatus = recommendations.cacheStatus;
  }

  // Round-robin viewport (diversity by category), then append the broad
  // recommendations as a tail (they're already ranked by relevance and aren't
  // partitioned by category). Dedup runs once, after merging, so identical
  // places coming from both paths are collapsed to one entry preserving the
  // earliest position.
  const interleaved = roundRobinByCategory(categories, viewportByCategory);
  const candidates: PlannerPlaceCandidate[] = [...interleaved, ...recommendationCandidates];

  const places = dedupeByPlaceIdOrName(candidates)
    .filter((place) => place.category !== "hotel")
    .slice(0, 12);
  const center = deriveCenter(location, places);

  // If neither the viewport (geocoded or LLM-supplied) nor the broad recommendations
  // path yielded any results, the city likely couldn't be resolved at all. Surface
  // a model-friendly hint so the LLM can re-ask the user for a clearer destination.
  if (places.length === 0) {
    return fitToCap({
      ok: false,
      error: "no_places_found",
      detail: geocodingUsed === "none"
        ? "Could not resolve coordinates for the destination_city; ask the user to clarify the city."
        : "No places found for the destination; ask the user to refine the destination or category.",
      destination: {
        city,
        country: args.destination_country ?? null,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
      },
      meta: {
        provider: "foursquare",
        cacheStatus,
        partial,
        providerCalls: getProviderCallCount(),
        cooldownRemainingS: getProviderCooldownRemaining(),
        geocodingUsed,
      },
    });
  }

  return fitToCap({
    ok: true,
    intent,
    destination: {
      city,
      country: args.destination_country ?? null,
      lat: center?.lat ?? null,
      lng: center?.lng ?? null,
    },
    categories,
    total_found: places.length,
    places: places.map(compactPlace),
    meta: {
      provider: "foursquare",
      cacheStatus,
      partial,
      providerCalls: getProviderCallCount(),
      cooldownRemainingS: getProviderCooldownRemaining(),
      geocodingUsed,
    },
  });
}

// -----------------------------------------------------------------------------
// Catalog & dispatcher
// -----------------------------------------------------------------------------

export const retrievalTools: Record<string, RetrievalTool> = {
  get_planner_state: {
    schema: getPlannerStateSchema,
    handler: getPlannerStateHandler as RetrievalTool["handler"],
  },
  get_recent_searches: {
    schema: getRecentSearchesSchema,
    handler: getRecentSearchesHandler as RetrievalTool["handler"],
  },
  get_lead_full_history: {
    schema: getLeadFullHistorySchema,
    handler: getLeadFullHistoryHandler as RetrievalTool["handler"],
  },
  discover_places: {
    schema: discoverPlacesSchema,
    handler: discoverPlacesHandler as RetrievalTool["handler"],
  },
};

/** Returns the OpenAI tool schemas to send to chat.completions `tools` array. */
export function getRetrievalToolSchemas(): OpenAITool[] {
  return Object.values(retrievalTools).map((t) => t.schema);
}

/**
 * Returns a `name -> handler` map, suitable for `runToolLoop({ toolHandlers })`.
 * Phase 2 will spread `save_memory_note` into this object at the call site.
 */
export function getRetrievalToolHandlers(): Record<
  string,
  (args: unknown, ctx: ToolContext) => Promise<unknown>
> {
  const out: Record<string, (args: unknown, ctx: ToolContext) => Promise<unknown>> = {};
  for (const [name, tool] of Object.entries(retrievalTools)) {
    out[name] = tool.handler as (args: unknown, ctx: ToolContext) => Promise<unknown>;
  }
  return out;
}

/**
 * Direct dispatcher kept for callers that prefer name-based execution outside
 * the loop runtime (e.g. unit tests, ad-hoc invocations from other functions).
 */
export async function executeRetrievalTool(
  name: string,
  args: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  const tool = retrievalTools[name];
  if (!tool) {
    return {
      error: "unknown_tool",
      detail: `no retrieval tool named '${name}'`,
      available: Object.keys(retrievalTools),
    };
  }
  return await tool.handler(args, ctx);
}
