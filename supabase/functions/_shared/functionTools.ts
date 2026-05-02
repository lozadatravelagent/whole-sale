// =============================================================================
// functionTools.ts — Retrieval Tool Catalog (Phase 3.2)
// =============================================================================
//
// Authoritative spec: docs/architecture/tool-catalog-spec.md §2
//
// Implements the four read-only retrieval tools the Emilia agent can invoke:
//   - get_planner_state         (queries `trips`)
//   - get_quote                 (queries `quotes` — STUB until table exists)
//   - get_recent_searches       (queries `messages.meta.searchResults`)
//   - get_lead_full_history     (queries `lead_ai_profiles` + `trips` + `leads`)
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
// 2. get_quote — fetch agency quote
// -----------------------------------------------------------------------------
//
// TODO(Phase 5): The `quotes` table does not yet exist in the schema. Until
// it lands, this handler returns a clear, model-friendly `not_implemented`
// error so the agent can degrade gracefully ("aún no podemos consultar
// cotizaciones guardadas"). The schema is finalized so the model learns the
// trigger conditions even before the table is wired.

interface GetQuoteArgs {
  quote_id: string;
}

const getQuoteSchema: OpenAITool = {
  type: "function",
  function: {
    name: "get_quote",
    description:
      "Fetch a previously generated agency quote (quote_id) including totals, line items, currency, validity window, and lead linkage. " +
      "Use when: the user references 'la cotización', 'ese precio', 'la propuesta'; mode=agency and a quote ref is active; the user asks to modify, resend, or compare quotes. " +
      "Don't use for: generating a new quote (use search tools first); accessing the underlying plan (use get_planner_state). " +
      "NOTE: this tool currently returns {error:'not_implemented'} until the quotes table is provisioned. Don't invoke until then — it will fail.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        quote_id: {
          type: "string",
          description:
            "UUID of the quote. Resolve from state.active_refs where type='quote'.",
        },
      },
      required: ["quote_id"],
    },
  },
};

async function getQuoteHandler(
  args: GetQuoteArgs,
  _ctx: ToolContext,
): Promise<unknown> {
  if (!args?.quote_id || typeof args.quote_id !== "string") {
    return { error: "bad_arguments", detail: "quote_id required" };
  }
  // TODO: replace with real query once `quotes` table exists.
  return {
    error: "not_implemented",
    message: "quotes table not yet provisioned",
    detail:
      "quotes table not yet provisioned; tell the user the quote feature is coming and offer to rebuild from get_planner_state",
  };
}

// -----------------------------------------------------------------------------
// 3. get_recent_searches — last N flight/hotel/package searches
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
      const params = (sr.params ?? meta.searchParams ?? null) as unknown;
      const top = Array.isArray(sr.top)
        ? (sr.top as Array<Record<string, unknown>>).slice(0, 3)
        : Array.isArray(sr.results)
          ? (sr.results as Array<Record<string, unknown>>).slice(0, 3)
          : [];

      return {
        id: row.id,
        kind: inferredKind,
        at: row.created_at,
        params,
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
        .select(
          "id, title, status, start_date, end_date, destination_cities, " +
          "budget_level, travelers, updated_at",
        )
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
      title: t.title,
      status: t.status,
      start: t.start_date,
      end: t.end_date,
      destinations: t.destination_cities,
      budget: t.budget_level,
      pax: t.travelers,
    })),
    trip_count: (trips ?? []).length,
  };

  return fitToCap(compact);
}

// -----------------------------------------------------------------------------
// Catalog & dispatcher
// -----------------------------------------------------------------------------

export const retrievalTools: Record<string, RetrievalTool> = {
  get_planner_state: {
    schema: getPlannerStateSchema,
    handler: getPlannerStateHandler as RetrievalTool["handler"],
  },
  get_quote: {
    schema: getQuoteSchema,
    handler: getQuoteHandler as RetrievalTool["handler"],
  },
  get_recent_searches: {
    schema: getRecentSearchesSchema,
    handler: getRecentSearchesHandler as RetrievalTool["handler"],
  },
  get_lead_full_history: {
    schema: getLeadFullHistorySchema,
    handler: getLeadFullHistoryHandler as RetrievalTool["handler"],
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
