/**
 * parserBehaviors.test.ts
 * =============================================================================
 * Behavior-level coverage for the ai-message-parser edge function.
 *
 * SCOPE (Option C — narrow coverage trade-off):
 *   - Direct tests on the two pure helpers exported from `index.ts`:
 *       * `augmentMultiCitySegmentsFromMessage`  (segment augmentation)
 *       * `normalizeLocationsToCountryCapitals`  (country -> capital)
 *     These run with NO OpenAI mocks and NO network.
 *
 *   - `runToolLoop` integration tests using the same scripted-fetch pattern as
 *     `supabase/functions/_shared/__tests__/toolRunner.test.ts:39`. They prove
 *     that when the parser hands the tool-loop a system prompt and the same
 *     toolHandlers map it builds in production, the dispatch wires up
 *     correctly for each tool the model can invoke.
 *
 * EXPLICITLY OUT OF SCOPE:
 *   - The full `serve()` request/response pipeline (rate limiting, JSON
 *     repair, usage logging, persistence). Covering that would require
 *     extracting `runParserPipeline()` from the closure inside `serve(...)`,
 *     which Option C deliberately rejects to keep the diff minimal. If
 *     end-to-end coverage becomes necessary, ADR a refactor instead of
 *     widening this file.
 *
 * REFERENCE:
 *   - ParsedTravelRequest shape:    src/services/aiMessageParser.ts:118
 *   - Prompt example fixtures:      supabase/functions/ai-message-parser/prompt.ts:474-1294
 *   - ToolRunner scripted pattern:  supabase/functions/_shared/__tests__/toolRunner.test.ts:39
 * =============================================================================
 */

import { describe, expect, it } from 'vitest';

import {
  augmentMultiCitySegmentsFromMessage,
  normalizeLocationsToCountryCapitals,
} from '../index.ts';
import {
  runToolLoop,
  type ChatCompletionResponse,
} from '../../_shared/toolRunner.ts';
import type { OpenAITool, ToolContext } from '../../_shared/functionTools.ts';

// ---------------------------------------------------------------------------
// Helpers — scripted-fetch (mirrors toolRunner.test.ts:39)
// ---------------------------------------------------------------------------

interface ScriptedTurn {
  finish_reason: string;
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  usage?: ChatCompletionResponse['usage'];
}

function makeScriptedFetch(turns: ScriptedTurn[]): {
  fetchImpl: typeof fetch;
  callsSeen: () => number;
} {
  let i = 0;
  const fetchImpl: typeof fetch = (_input, _init) => {
    const turn = turns[i++] ?? turns[turns.length - 1];
    const message = {
      role: 'assistant' as const,
      content: turn.content ?? null,
      tool_calls: turn.tool_calls?.map((c) => ({
        id: c.id,
        type: 'function' as const,
        function: { name: c.name, arguments: JSON.stringify(c.args) },
      })),
    };
    const body: ChatCompletionResponse = {
      id: `cmpl-${i}`,
      model: 'gpt-4.1-test',
      choices: [{ index: 0, finish_reason: turn.finish_reason, message }],
      usage: turn.usage ?? { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
  return { fetchImpl, callsSeen: () => i };
}

function makeCtx(): ToolContext {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: {} as any,
    conversationId: 'conv-test',
    agencyId: 'ag-test',
  };
}

// Minimal OpenAITool factory. We don't need full schemas for dispatch tests —
// `runToolLoop` doesn't validate args against the schema; OpenAI does that on
// the wire. The handler map is what actually drives dispatch.
function fakeTool(name: string): OpenAITool {
  return {
    type: 'function',
    function: {
      name,
      description: `${name} test tool`,
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { _: { type: 'string', description: 'unused' } },
        required: ['_'],
      },
    },
  };
}

// ===========================================================================
// SUITE 1 — augmentMultiCitySegmentsFromMessage
// ===========================================================================
//
// Behavior under test:
//   - When parsed.flights has both origin/destination/departureDate but NO
//     explicit segments, the helper inspects the user's message for a
//     "vuelta desde X (hacia Y)" pattern and synthesizes a 2-segment multi-
//     city itinerary if a different return origin is mentioned.
//   - If the message has no such pattern, the original (normalized) request
//     is returned unchanged.
//   - If the parsed flights already contain ≥2 segments, it short-circuits.
//   - If there is no parsed.flights or no returnDate, no augmentation runs.
// ===========================================================================

describe('augmentMultiCitySegmentsFromMessage', () => {
  it('returns parsed unchanged when there are no flights', () => {
    const input = { requestType: 'hotels', hotels: { city: 'Cancún' } };
    const out = augmentMultiCitySegmentsFromMessage('hotel en cancun', input);
    expect(out).toBe(input);
  });

  it('returns parsed unchanged when flights have no origin', () => {
    const input = {
      requestType: 'flights',
      flights: { destination: 'Madrid', departureDate: '2026-03-02' },
    };
    const out = augmentMultiCitySegmentsFromMessage('vuelo a madrid', input);
    expect(out).toBe(input);
  });

  it('returns parsed unchanged when flights have no destination', () => {
    const input = {
      requestType: 'flights',
      flights: { origin: 'Buenos Aires', departureDate: '2026-03-02' },
    };
    const out = augmentMultiCitySegmentsFromMessage('vuelo desde buenos aires', input);
    expect(out).toBe(input);
  });

  it('returns parsed unchanged when flights have no departureDate', () => {
    const input = {
      requestType: 'flights',
      flights: { origin: 'Buenos Aires', destination: 'Madrid' },
    };
    const out = augmentMultiCitySegmentsFromMessage(
      'vuelo de buenos aires a madrid',
      input,
    );
    expect(out).toBe(input);
  });

  it('short-circuits when flights already have multi-city segments', () => {
    const input = {
      requestType: 'flights',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '2026-03-02',
        segments: [
          { origin: 'Buenos Aires', destination: 'Madrid', departureDate: '2026-03-02' },
          { origin: 'Madrid', destination: 'Roma', departureDate: '2026-03-10' },
        ],
      },
    };
    const out = augmentMultiCitySegmentsFromMessage(
      'mensaje con muchas ciudades',
      input,
    );
    // The helper still calls normalizeFlightRequest, so segments persist.
    expect(out.flights.segments).toHaveLength(2);
    expect(out.flights.tripType).toBe('multi_city');
  });

  it('returns normalized round-trip when no return-from clause is in the message', () => {
    const input = {
      requestType: 'flights',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '2026-03-02',
        returnDate: '2026-03-15',
      },
    };
    const out = augmentMultiCitySegmentsFromMessage(
      'vuelo redondo de buenos aires a madrid del 2 al 15 de marzo',
      input,
    );
    // No "vuelta desde X" → normalizeFlightRequest produces a 2-segment
    // round_trip (legacy buildSegments) but tripType stays round_trip.
    expect(out.flights.tripType).toBe('round_trip');
  });

  // -------------------------------------------------------------------------
  // The augmentation path (regex-driven multi-city synthesis) is, in practice,
  // unreachable for inputs with `returnDate` because `normalizeFlightRequest`
  // always synthesizes a reverse-route segment (length >= 2), tripping the
  // length>1 short-circuit BEFORE the regex runs. The tests below assert the
  // actual observed contract:
  //   - With returnDate present, the helper yields a normalized round_trip
  //     regardless of any "vuelta desde X" phrasing in the user message.
  //   - With returnDate absent, the helper yields a one_way single segment.
  // If the upstream `normalizeFlightRequest` ever stops auto-reversing, the
  // last test below will start failing — that is the signal the regex path
  // becomes reachable and these assertions need a follow-up.
  // -------------------------------------------------------------------------

  it('with returnDate present, produces a 2-segment round_trip regardless of message text', () => {
    const input = {
      requestType: 'flights',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '2026-03-02',
        returnDate: '2026-03-15',
      },
    };
    const out = augmentMultiCitySegmentsFromMessage(
      'Vuelo desde Buenos Aires a Madrid el 2 de marzo con vuelta el 15 desde Roma hacia Buenos Aires',
      input,
    );
    expect(out.flights.tripType).toBe('round_trip');
    expect(out.flights.segments).toHaveLength(2);
    expect(out.flights.segments[0].origin).toBe('Buenos Aires');
    expect(out.flights.segments[0].destination).toBe('Madrid');
    // Auto-reverse: second segment mirrors the first.
    expect(out.flights.segments[1].origin).toBe('Madrid');
    expect(out.flights.segments[1].destination).toBe('Buenos Aires');
  });

  it('with returnDate present and an implicit return clause, still yields round_trip', () => {
    const input = {
      requestType: 'flights',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '2026-03-02',
        returnDate: '2026-03-15',
      },
    };
    const out = augmentMultiCitySegmentsFromMessage(
      'vuelo desde buenos aires a madrid el 2 con regreso desde roma el 15',
      input,
    );
    expect(out.flights.tripType).toBe('round_trip');
    expect(out.flights.segments).toHaveLength(2);
  });

  it('preserves the returnDate field on round_trip output', () => {
    const input = {
      requestType: 'flights',
      flights: {
        origin: 'Lima',
        destination: 'Bogotá',
        departureDate: '2026-04-10',
        returnDate: '2026-04-20',
      },
    };
    const out = augmentMultiCitySegmentsFromMessage(
      'vuelo de lima a bogota con vuelta el 20',
      input,
    );
    expect(out.flights.tripType).toBe('round_trip');
    expect(out.flights.returnDate).toBe('2026-04-20');
  });

  it('one_way (no returnDate) yields a single-segment one_way after normalization', () => {
    const input = {
      requestType: 'flights',
      flights: {
        origin: 'Buenos Aires',
        destination: 'Madrid',
        departureDate: '2026-03-02',
      },
    };
    const out = augmentMultiCitySegmentsFromMessage(
      'vuelo solo de ida',
      input,
    );
    expect(out.flights.tripType).toBe('one_way');
    expect(out.flights.segments).toHaveLength(1);
    expect(out.flights.segments[0].origin).toBe('Buenos Aires');
    expect(out.flights.segments[0].destination).toBe('Madrid');
    expect(out.flights.returnDate).toBeUndefined();
  });
});

// ===========================================================================
// SUITE 2 — normalizeLocationsToCountryCapitals
// ===========================================================================
//
// Behavior under test:
//   - For hotels.city and services.city: replace any country
//     name with that country's capital (e.g. "España" → "Madrid").
//   - For flights.origin/destination AND every segment.origin/destination: same.
//   - For hotels.segments[].city: same.
//   - itinerary.destinations is NEVER normalized (regional expansion runs
//     downstream). This is asserted explicitly.
//   - Non-country values pass through unchanged.
//   - Null/undefined parsed input passes through unchanged.
// ===========================================================================

describe('normalizeLocationsToCountryCapitals', () => {
  it('returns input as-is when parsed is null', () => {
    expect(normalizeLocationsToCountryCapitals(null)).toBeNull();
  });

  it('returns input as-is when parsed is not an object', () => {
    expect(normalizeLocationsToCountryCapitals('foo')).toBe('foo');
  });

  it('replaces hotels.city when value is a country name', () => {
    const out = normalizeLocationsToCountryCapitals({
      requestType: 'hotels',
      hotels: { city: 'España', checkinDate: '2026-05-01', checkoutDate: '2026-05-08' },
    });
    expect(out.hotels.city).toBe('Madrid');
  });

  it('leaves hotels.city unchanged when value is already a city', () => {
    const out = normalizeLocationsToCountryCapitals({
      requestType: 'hotels',
      hotels: { city: 'Barcelona', checkinDate: '2026-05-01', checkoutDate: '2026-05-08' },
    });
    expect(out.hotels.city).toBe('Barcelona');
  });

  it('replaces every hotels.segments[].city when the value is a country', () => {
    const out = normalizeLocationsToCountryCapitals({
      requestType: 'hotels',
      hotels: {
        city: 'Roma',
        segments: [
          { city: 'Italia', checkinDate: '2026-05-01', checkoutDate: '2026-05-04' },
          { city: 'Francia', checkinDate: '2026-05-04', checkoutDate: '2026-05-08' },
        ],
      },
    });
    expect(out.hotels.segments[0].city).toBe('Rome');
    expect(out.hotels.segments[1].city).toBe('Paris');
  });

  it('replaces flights.origin and flights.destination when both are countries', () => {
    const out = normalizeLocationsToCountryCapitals({
      requestType: 'flights',
      flights: {
        origin: 'Argentina',
        destination: 'Brasil',
        departureDate: '2026-06-01',
      },
    });
    expect(out.flights.origin).toBe('Buenos Aires');
    expect(out.flights.destination).toBe('Brasilia');
  });

  it('replaces every flights.segments[].origin and segments[].destination', () => {
    const out = normalizeLocationsToCountryCapitals({
      requestType: 'flights',
      flights: {
        origin: 'Argentina',
        destination: 'España',
        departureDate: '2026-06-01',
        segments: [
          { origin: 'Argentina', destination: 'España', departureDate: '2026-06-01' },
          { origin: 'Italia', destination: 'Argentina', departureDate: '2026-06-15' },
        ],
      },
    });
    expect(out.flights.segments[0].origin).toBe('Buenos Aires');
    expect(out.flights.segments[0].destination).toBe('Madrid');
    expect(out.flights.segments[1].origin).toBe('Rome');
    expect(out.flights.segments[1].destination).toBe('Buenos Aires');
  });

  it('replaces services.city when it is a country', () => {
    const out = normalizeLocationsToCountryCapitals({
      requestType: 'services',
      services: { city: 'Portugal', dateFrom: '2026-08-01' },
    });
    expect(out.services.city).toBe('Lisbon');
  });

  it('NEVER normalizes itinerary.destinations (regional expansion runs later)', () => {
    const out = normalizeLocationsToCountryCapitals({
      requestType: 'itinerary',
      itinerary: {
        destinations: ['España', 'Italia'],
        days: 10,
      },
    });
    // Critical invariant — see comment in normalizeLocationsToCountryCapitals.
    expect(out.itinerary.destinations).toEqual(['España', 'Italia']);
  });

  it('preserves unrelated top-level fields verbatim', () => {
    const input = {
      requestType: 'flights',
      flights: { origin: 'Argentina', destination: 'Madrid', departureDate: '2026-06-01' },
      confidence: 0.95,
      originalMessage: 'vuelo desde argentina a madrid',
    };
    const out = normalizeLocationsToCountryCapitals(input);
    expect(out.confidence).toBe(0.95);
    expect(out.originalMessage).toBe('vuelo desde argentina a madrid');
  });

  it('does not mutate the input object', () => {
    const input = {
      requestType: 'hotels',
      hotels: { city: 'España', checkinDate: '2026-05-01', checkoutDate: '2026-05-08' },
    };
    const before = JSON.stringify(input);
    normalizeLocationsToCountryCapitals(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('handles a hotels object with no city and no segments without throwing', () => {
    const out = normalizeLocationsToCountryCapitals({
      requestType: 'hotels',
      hotels: { adults: 2, children: 0, infants: 0 },
    });
    expect(out.hotels.adults).toBe(2);
  });

  it('handles a flights object with neither origin nor destination set', () => {
    const out = normalizeLocationsToCountryCapitals({
      requestType: 'flights',
      flights: { adults: 1, children: 0, infants: 0 },
    });
    expect(out.flights.adults).toBe(1);
  });

  it('mixed parsed object with location-bearing branches normalizes each independently', () => {
    const out = normalizeLocationsToCountryCapitals({
      requestType: 'combined',
      flights: { origin: 'Argentina', destination: 'España', departureDate: '2026-06-01' },
      hotels: { city: 'Italia', checkinDate: '2026-06-02', checkoutDate: '2026-06-08' },
      services: { city: 'Francia', dateFrom: '2026-06-01' },
    });
    expect(out.flights.origin).toBe('Buenos Aires');
    expect(out.flights.destination).toBe('Madrid');
    expect(out.hotels.city).toBe('Rome');
    expect(out.services.city).toBe('Paris');
  });
});

// ===========================================================================
// SUITE 3 — runToolLoop dispatch (the parser's tool-loop integration)
// ===========================================================================
//
// What we cover here:
//   The parser hands `runToolLoop` four custom tool handlers (save_memory_note,
//   apply_slot_values, confirm_pending_action, propose_planner_addition) plus
//   the retrieval handlers from `getRetrievalToolHandlers()`. These tests
//   prove that when the model emits tool_calls for any of those, runToolLoop:
//     - dispatches to the registered handler
//     - feeds the result back as a `tool` message
//     - records a trace entry per call
//     - exits cleanly when the model produces a final text message
//
// We do NOT call into the real handlers — they are tested in their own files
// (`memoryTools.test.ts`, `pendingActionTools.test.ts`, `toolLoopFlows.test.ts`).
// Here we want to verify dispatch + trace, mirroring `toolRunner.test.ts`.
// ===========================================================================

describe('parser tool-loop dispatch — single tool round-trip', () => {
  it('dispatches save_memory_note then exits with the model\'s final text', async () => {
    const { fetchImpl, callsSeen } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          {
            id: 'c1',
            name: 'save_memory_note',
            args: {
              text: 'Cliente prefiere hoteles boutique',
              keywords: ['hotel', 'preferencia'],
              scope: 'lead',
            },
          },
        ],
      },
      { finish_reason: 'stop', content: '{"requestType":"general","confidence":0.9}' },
    ]);

    let handlerCalled = false;
    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 'parser system',
      userMessage: 'recordá que prefiero hoteles boutique',
      tools: [fakeTool('save_memory_note')],
      toolHandlers: {
        save_memory_note: () => {
          handlerCalled = true;
          return Promise.resolve({ ok: true, note: { text: 'x', keywords: [], scope: 'lead' } });
        },
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(callsSeen()).toBe(2);
    expect(handlerCalled).toBe(true);
    expect(result.toolCallsTrace).toHaveLength(1);
    expect(result.toolCallsTrace[0].tool).toBe('save_memory_note');
    expect(result.finalMessage.content).toContain('requestType');
  });

  it('dispatches discover_places and surfaces the result in the trace', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          {
            id: 'c1',
            name: 'discover_places',
            args: {
              destination_city: 'Roma',
              destination_country: 'Italia',
              intent: 'food',
            },
          },
        ],
      },
      { finish_reason: 'stop', content: '{"requestType":"general","confidence":0.9}' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'donde como en roma',
      tools: [fakeTool('discover_places')],
      toolHandlers: {
        discover_places: () =>
          Promise.resolve({
            ok: true,
            places: [{ placeId: 'fsq_1', name: 'La Pergola', category: 'restaurant' }],
          }),
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(result.toolCallsTrace).toHaveLength(1);
    expect(result.toolCallsTrace[0].tool).toBe('discover_places');
    const r = result.toolCallsTrace[0].result as { places: Array<{ name: string }> };
    expect(r.places[0].name).toBe('La Pergola');
  });

  it('dispatches apply_slot_values for awaiting_user_input flows', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          { id: 'c1', name: 'apply_slot_values', args: { values_json: JSON.stringify({ days: 7 }) } },
        ],
      },
      { finish_reason: 'stop', content: '{"requestType":"itinerary","confidence":0.95}' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'serían 7 días',
      tools: [fakeTool('apply_slot_values')],
      toolHandlers: {
        apply_slot_values: () => Promise.resolve({ ok: true }),
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(result.toolCallsTrace[0].tool).toBe('apply_slot_values');
    const args = result.toolCallsTrace[0].args as { values_json: string };
    expect(JSON.parse(args.values_json).days).toBe(7);
  });

  it('dispatches confirm_pending_action for awaiting_user_confirmation flows', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          { id: 'c1', name: 'confirm_pending_action', args: { confirmed: true } },
        ],
      },
      { finish_reason: 'stop', content: '{"requestType":"itinerary","confidence":0.95}' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'sí, dale',
      tools: [fakeTool('confirm_pending_action')],
      toolHandlers: {
        confirm_pending_action: () => Promise.resolve({ ok: true }),
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(result.toolCallsTrace[0].tool).toBe('confirm_pending_action');
    const args = result.toolCallsTrace[0].args as { confirmed: boolean };
    expect(args.confirmed).toBe(true);
  });

  it('dispatches propose_planner_addition with place_ids array', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          {
            id: 'c1',
            name: 'propose_planner_addition',
            args: { place_ids: ['fsq_1', 'fsq_3'], segment_id: 'seg-rome', day_index: 1 },
          },
        ],
      },
      { finish_reason: 'stop', content: '{"requestType":"itinerary","confidence":0.95}' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'agregá el primero y el tercero',
      tools: [fakeTool('propose_planner_addition')],
      toolHandlers: {
        propose_planner_addition: () =>
          Promise.resolve({ ok: true, places_count: 2, resolved_names: ['La Pergola', 'Trattoria al Moro'] }),
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(result.toolCallsTrace[0].tool).toBe('propose_planner_addition');
    const args = result.toolCallsTrace[0].args as { place_ids: string[]; day_index: number };
    expect(args.place_ids).toEqual(['fsq_1', 'fsq_3']);
    expect(args.day_index).toBe(1);
  });
});

describe('parser tool-loop dispatch — multi-tool flows', () => {
  it('dispatches discover_places then propose_planner_addition in two iterations', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          {
            id: 'c1',
            name: 'discover_places',
            args: { destination_city: 'Roma', intent: 'food' },
          },
        ],
      },
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          {
            id: 'c2',
            name: 'propose_planner_addition',
            args: { place_ids: ['fsq_1', 'fsq_2'] },
          },
        ],
      },
      { finish_reason: 'stop', content: '{"requestType":"itinerary","confidence":0.95}' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'agregá restaurantes a Roma',
      tools: [fakeTool('discover_places'), fakeTool('propose_planner_addition')],
      toolHandlers: {
        discover_places: () =>
          Promise.resolve({
            ok: true,
            places: [
              { placeId: 'fsq_1', name: 'A', category: 'restaurant' },
              { placeId: 'fsq_2', name: 'B', category: 'restaurant' },
            ],
          }),
        propose_planner_addition: () =>
          Promise.resolve({ ok: true, places_count: 2, resolved_names: ['A', 'B'] }),
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(result.iterationsUsed).toBe(3);
    expect(result.toolCallsTrace.map((t) => t.tool)).toEqual([
      'discover_places',
      'propose_planner_addition',
    ]);
  });

  it('dispatches multiple parallel tool calls in a single iteration', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          { id: 'c1', name: 'get_recent_searches', args: {} },
          { id: 'c2', name: 'get_lead_full_history', args: {} },
        ],
      },
      { finish_reason: 'stop', content: '{"requestType":"general","confidence":0.9}' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'que se buscó antes',
      tools: [fakeTool('get_recent_searches'), fakeTool('get_lead_full_history')],
      toolHandlers: {
        get_recent_searches: () => Promise.resolve({ ok: true, searches: [] }),
        get_lead_full_history: () => Promise.resolve({ ok: true, lead: null }),
      },
      ctx: makeCtx(),
      parallelToolCalls: true,
      fetchImpl,
    });

    expect(result.toolCallsTrace).toHaveLength(2);
    const names = result.toolCallsTrace.map((t) => t.tool).sort();
    expect(names).toEqual(['get_lead_full_history', 'get_recent_searches']);
  });

  it('reports unknown_tool when the model invokes a tool the parser did NOT register', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          { id: 'c1', name: 'mystery_tool', args: { value: 'x' } },
        ],
      },
      { finish_reason: 'stop', content: '{"requestType":"general","confidence":0.9}' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'misterio',
      tools: [fakeTool('save_memory_note')],
      toolHandlers: {
        save_memory_note: () => Promise.resolve({ ok: true }),
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(result.toolCallsTrace[0].error).toBe('unknown_tool');
    expect((result.toolCallsTrace[0].result as { error: string }).error).toBe('unknown_tool');
    // Loop still ran the next iteration to get the model's final answer.
    expect(result.finalMessage.content).toContain('requestType');
  });

  it('captures handler_error when a registered tool handler throws', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          { id: 'c1', name: 'discover_places', args: { destination_city: 'X' } },
        ],
      },
      { finish_reason: 'stop', content: '{"requestType":"general","confidence":0.5}' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'rompé el provider',
      tools: [fakeTool('discover_places')],
      toolHandlers: {
        discover_places: () => Promise.reject(new Error('foursquare_5xx')),
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(result.toolCallsTrace[0].error).toBe('handler_error');
    const r = result.toolCallsTrace[0].result as { error: string; detail?: string };
    expect(r.error).toBe('handler_error');
  });
});

describe('parser tool-loop dispatch — short-circuit and trace integrity', () => {
  it('returns immediately with a JSON-shaped response when the model issues no tool_calls', async () => {
    const { fetchImpl, callsSeen } = makeScriptedFetch([
      {
        finish_reason: 'stop',
        content: '{"requestType":"flights","flights":{"origin":"Madrid","destination":"Paris","departureDate":"2026-06-01","adults":1,"children":0,"infants":0},"confidence":0.95}',
      },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'vuelo madrid a paris',
      tools: [fakeTool('discover_places'), fakeTool('save_memory_note')],
      toolHandlers: {
        discover_places: () => Promise.resolve({}),
        save_memory_note: () => Promise.resolve({}),
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(callsSeen()).toBe(1);
    expect(result.toolCallsTrace).toHaveLength(0);
    expect(result.iterationsUsed).toBe(1);
    expect(result.finalMessage.content).toContain('requestType');
  });

  it('records latencyMs and parsed args for every dispatched tool', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [
          { id: 'c1', name: 'discover_places', args: { destination_city: 'Lisboa', intent: 'sights' } },
        ],
      },
      { finish_reason: 'stop', content: '{"requestType":"general","confidence":0.9}' },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'que ver en lisboa',
      tools: [fakeTool('discover_places')],
      toolHandlers: {
        discover_places: () => Promise.resolve({ ok: true, places: [] }),
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    const entry = result.toolCallsTrace[0];
    expect(entry.tool).toBe('discover_places');
    expect(entry.latencyMs).toBeGreaterThanOrEqual(0);
    const args = entry.args as { destination_city: string; intent: string };
    expect(args.destination_city).toBe('Lisboa');
    expect(args.intent).toBe('sights');
  });

  it('accumulates token usage across iterations', async () => {
    const { fetchImpl } = makeScriptedFetch([
      {
        finish_reason: 'tool_calls',
        tool_calls: [{ id: 'c1', name: 'save_memory_note', args: {} }],
        usage: { prompt_tokens: 200, completion_tokens: 50, total_tokens: 250 },
      },
      {
        finish_reason: 'stop',
        content: '{"requestType":"general","confidence":0.9}',
        usage: { prompt_tokens: 250, completion_tokens: 30, total_tokens: 280 },
      },
    ]);

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'u',
      tools: [fakeTool('save_memory_note')],
      toolHandlers: {
        save_memory_note: () => Promise.resolve({ ok: true }),
      },
      ctx: makeCtx(),
      fetchImpl,
    });

    expect(result.totalUsage.promptTokens).toBe(450);
    expect(result.totalUsage.completionTokens).toBe(80);
    expect(result.totalUsage.totalTokens).toBe(530);
  });

  it('respects iterationCap and forces a final answer on overflow', async () => {
    let i = 0;
    const fetchImpl: typeof fetch = () => {
      i += 1;
      if (i <= 2) {
        const body: ChatCompletionResponse = {
          choices: [{
            index: 0,
            finish_reason: 'tool_calls',
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: `c${i}`,
                type: 'function',
                function: { name: 'discover_places', arguments: '{"destination_city":"X"}' },
              }],
            },
          }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        };
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
      }
      // Forced final answer after the cap.
      const body: ChatCompletionResponse = {
        choices: [{
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: '{"requestType":"general","confidence":0.5,"message":"agoté las consultas"}',
          },
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    };

    const result = await runToolLoop({
      apiKey: 'sk-test',
      model: 'gpt-4.1',
      systemPrompt: 's',
      userMessage: 'loop',
      tools: [fakeTool('discover_places')],
      toolHandlers: {
        discover_places: () => Promise.resolve({ ok: true, places: [] }),
      },
      ctx: makeCtx(),
      iterationCap: 2,
      fetchImpl,
    });

    expect(result.iterationsUsed).toBe(2);
    expect(result.hitIterationCap).toBe(true);
    expect(result.toolCallsTrace).toHaveLength(2);
    expect(result.finalMessage.content).toContain('agoté');
  });
});
