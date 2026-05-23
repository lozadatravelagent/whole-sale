/**
 * Turn intent persistence — single write point for the conversation's
 * "last known parsed intent" snapshot.
 *
 * Architectural guarantee:
 *
 *   Every turn that produces a parsed, *actionable* intent must persist that
 *   intent before the turn finishes, regardless of which execution branch
 *   handled the user-visible response (partial validation, mode_bridge,
 *   ask_minimal, search, error, …).
 *
 *   Without this guarantee, early-return branches in `handleSendMessage`
 *   that successfully parsed a request — but resolved the user response via
 *   a non-search path (e.g. the validation gate runs hotels alone and asks
 *   for the missing flight origin) — leave the next turn with no
 *   `previousContext`. The parser then can't resolve anaphora ("esa fecha",
 *   "los vuelos") and the router degrades to `low_definition` → mode_bridge.
 *
 *   The fix is structural: a single helper, called once per turn from a
 *   `finally` block, that writes the parsed intent through
 *   `saveContextualMemory`. The branch logic stays untouched.
 *
 * What counts as "actionable":
 *   - One of `flights | hotels | combined | itinerary | services`
 *   - At least one product-shaped slot has data (e.g. a destination,
 *     city, or itinerary destination). A combined turn whose flight slot
 *     is invalid but whose hotel slot is valid still counts — that is the
 *     partial-flow case that originally motivated this module.
 *
 *   We deliberately do NOT persist `general` or `missing_info_request`
 *   parses: they carry no slot data the next turn can iterate on.
 */

import type { ParsedTravelRequest } from '@/services/aiMessageParser';

type SaveContextualMemoryFn = (
  conversationId: string,
  parsedRequest: ParsedTravelRequest,
) => Promise<void>;

/**
 * Should a parsed request be written back to contextual memory at end of turn?
 * Pure predicate — no I/O, no side effects.
 */
export function shouldPersistIntent(
  parsed: ParsedTravelRequest | null | undefined,
): boolean {
  if (!parsed || typeof parsed !== 'object') return false;

  const t = (parsed as ParsedTravelRequest).requestType;
  if (!t) return false;

  switch (t) {
    case 'general':
      // Chitchat / "hola" — no slot data the next turn can build on.
      return false;

    case 'missing_info_request' as ParsedTravelRequest['requestType']:
      // The parser asked the user for something (the COLLECT path).
      // Persisting this preserves conversation continuity: the next turn
      // sees `previousContext.requestType === 'missing_info_request'` and
      // its `originalMessage` / `missingFields`, which downstream
      // SEARCH-REFINEMENT-adjacent logic uses to interpret the user's reply
      // as a fill-in of the previously-asked slot.
      return true;

    case 'flights':
      return Boolean(parsed.flights?.destination || parsed.flights?.origin);

    case 'hotels':
      return Boolean(parsed.hotels?.city);

    case 'combined':
      // Partial-flow tolerance: persist as long as ONE product has data,
      // even if the other is incomplete. That is the entire point of this
      // module — see the file header.
      return Boolean(parsed.flights?.destination || parsed.hotels?.city);

    case 'itinerary': {
      const destinations = parsed.itinerary?.destinations;
      return Array.isArray(destinations) && destinations.length > 0;
    }

    case 'services':
      // Less structured shapes; trust the parser's classification.
      return true;

    default:
      return false;
  }
}

export interface PersistTurnIntentResult {
  persisted: boolean;
}

/**
 * Persist the turn's parsed intent through the provided
 * `saveContextualMemory` dependency, if the intent is actionable.
 *
 *   - Never throws: a failed persistence is logged and reported as
 *     `{ persisted: false }`, so a transient DB failure cannot break the
 *     conversation turn.
 *   - Idempotent at the conversation level: re-running this function in
 *     the same turn results in a newer "last known" row, which is what
 *     `loadContextualMemory` reads on the next turn. The legacy scattered
 *     call sites can therefore remain in place during migration — the
 *     finally-block write at most produces a redundant row, not corruption.
 */
export async function persistTurnIntentSnapshot(
  conversationId: string,
  parsed: ParsedTravelRequest | null | undefined,
  saveContextualMemory: SaveContextualMemoryFn,
): Promise<PersistTurnIntentResult> {
  if (!conversationId || !parsed) return { persisted: false };
  if (!shouldPersistIntent(parsed)) return { persisted: false };

  try {
    await saveContextualMemory(conversationId, parsed);
    return { persisted: true };
  } catch (err) {
    console.warn('⚠️ [TURN-PERSIST] Failed to persist turn intent snapshot:', err);
    return { persisted: false };
  }
}
