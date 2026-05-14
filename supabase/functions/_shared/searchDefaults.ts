/**
 * Search defaults — single source of truth for SUPABASE EDGE FUNCTIONS (Deno).
 *
 * Mirror file: `src/services/searchDefaults.ts` (client / Node).
 * Both files MUST stay in sync; the drift test
 * `src/services/__tests__/searchDefaults.drift.test.ts` enforces this.
 *
 * Why two files: edge functions run under Deno with their own tsconfig and
 * cannot import from `src/`. The duplication is intentional and minimal — it's
 * a 3-constant contract.
 */

/**
 * Offset in days from "today" to the synthesized start date when no explicit
 * nor relative date was provided by the user. See client mirror for rationale.
 */
export const SEARCH_START_OFFSET_DAYS = 3;

/**
 * Default stay duration (in nights) when neither user nor relative-date hint
 * supplied a checkout / return date. See client mirror for rationale.
 */
export const SEARCH_STAY_NIGHTS = 7;

/**
 * Total travelers (adults + children) when the user mentions "familia" /
 * "family" / "flia" without a count. See client mirror for rationale.
 */
export const DEFAULT_FAMILY_TRAVELERS_TOTAL = 4;
