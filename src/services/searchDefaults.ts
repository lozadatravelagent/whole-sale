/**
 * Search defaults — single source of truth for the CLIENT side.
 *
 * Mirror file: `supabase/functions/_shared/searchDefaults.ts` (Deno runtime).
 * Both files MUST stay in sync; the drift test
 * `src/services/__tests__/searchDefaults.drift.test.ts` enforces this.
 *
 * When tweaking any of these numbers, change them HERE and in the edge mirror.
 * Do not duplicate the values elsewhere — import them from this module instead.
 */

/**
 * Offset in days from "today" to the synthesized start date when no explicit
 * nor relative date was provided by the user.
 *
 * Why 3: providers (EUROVIPS, SOFTUR, Starling) return poor results — or
 * outright nothing — for same-day searches. Giving a 3-day runway lets the
 * search land on dates that actually have inventory while still feeling
 * "soon" to the user.
 */
export const SEARCH_START_OFFSET_DAYS = 3;

/**
 * Default stay duration (in nights) when neither user nor relative-date hint
 * supplied a checkout / return date. Used by:
 *   - searchIntentNormalizer's structural fallback (final layer)
 *   - proposedSearchBuilder's principal chip
 *   - useMessageHandler's hotel chip + add_hotel_intent fallback
 *   - LLM prompt instructions
 */
export const SEARCH_STAY_NIGHTS = 7;

/**
 * Total travelers (adults + children) when the user mentions "familia" /
 * "family" / "flia" without a count. Mapped to 2 adults + 2 children by the
 * legacy Spanish fast-path family inference.
 *
 * Only used by the deterministic fast-path in `aiMessageParser.ts`. The LLM
 * path emits explicit counts via `travelerType: 'family'` + adults/children.
 */
export const DEFAULT_FAMILY_TRAVELERS_TOTAL = 4;
