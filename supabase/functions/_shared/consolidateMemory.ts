/**
 * consolidateMemory — Consolidate phase (Context Engineering Phase 2.2).
 *
 * At session end (or every N turns as a fallback), this routine de-dupes and
 * conflict-resolves the union of `session_memory.notes` and
 * `global_memory.notes` into a fresh `global_memory.notes` set, then clears
 * `session_memory.notes`.
 *
 * Spec: docs/architecture/context-engineering-spec.md §6.3
 *       docs/architecture/tool-catalog-spec.md §3 (server-side note constraints)
 *
 * Resilience:
 * - If the OpenAI call fails (any reason — network, rate limit, malformed
 *   JSON), the ORIGINAL state is returned unchanged. Consolidation is a
 *   maintenance pass; failing it must NEVER break the conversation.
 */

import type { EmiliaState, MemoryNote } from './emiliaStateTypes.ts';
import { MEMORY_NOTE_SCOPES } from './memoryTools.ts';

// ---------------------------------------------------------------------------
// OpenAI client surface
// ---------------------------------------------------------------------------

/**
 * Minimal client surface this module depends on. We keep it small so callers
 * can pass either the raw `requestOpenAiChatCompletion` helper from
 * `_shared/llm/openaiChat.ts` OR a custom-wired client (e.g., a test stub).
 */
export interface ConsolidateOpenAiClient {
  chatCompletion(input: {
    model: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature: number;
    maxTokens: number;
  }): Promise<{ choices: Array<{ message: { content: string | null } }> }>;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const CONSOLIDATE_MODEL = 'gpt-4.1';
const CONSOLIDATE_TEMPERATURE = 0.1;
const CONSOLIDATE_MAX_TOKENS = 2000;

/**
 * System prompt for consolidation. Mirrors the OpenAI Cookbook
 * "Context Engineering for Personalization" recipe exactly.
 *
 * Filled in via plain string interpolation at call time — no templating
 * library to keep the edge function bundle minimal.
 */
function buildConsolidatePrompt(
  globalNotes: MemoryNote[],
  sessionNotes: MemoryNote[],
): string {
  return [
    'You are consolidating session memory notes into global memory for a travel CRM agent.',
    '',
    'RULES:',
    '1. Keep only DURABLE info (drop ephemeral, trip-specific notes)',
    '2. Remove exact and near-duplicates with canonical phrasing',
    '3. Conflict resolution: most recent last_update_date wins',
    '4. Tie → SESSION_NOTES preferred over GLOBAL_NOTES',
    '5. NO invention beyond source notes',
    '6. Preserve scope tagging',
    '',
    'GLOBAL_NOTES (current):',
    JSON.stringify(globalNotes, null, 2),
    '',
    'SESSION_NOTES (this run):',
    JSON.stringify(sessionNotes, null, 2),
    '',
    'Output JSON: { "global_notes": [{"text", "last_update_date", "keywords", "scope"}], "dropped": [{"text", "reason"}] }',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

interface ConsolidateResponse {
  global_notes: MemoryNote[];
  dropped?: Array<{ text: string; reason: string }>;
}

const SCOPES_SET: ReadonlySet<string> = new Set(MEMORY_NOTE_SCOPES);

function isMemoryNote(value: unknown): value is MemoryNote {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.text !== 'string') return false;
  if (typeof v.last_update_date !== 'string') return false;
  if (!Array.isArray(v.keywords)) return false;
  if (!v.keywords.every((k) => typeof k === 'string')) return false;
  if (typeof v.scope !== 'string' || !SCOPES_SET.has(v.scope)) return false;
  return true;
}

function parseConsolidateResponse(raw: string): ConsolidateResponse | null {
  if (!raw) return null;

  // Tolerate code-fenced JSON (the model sometimes wraps despite the prompt).
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract a JSON object substring as a fallback.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.global_notes)) return null;
  const validNotes = obj.global_notes.filter(isMemoryNote) as MemoryNote[];

  return {
    global_notes: validNotes,
    dropped: Array.isArray(obj.dropped) ? (obj.dropped as ConsolidateResponse['dropped']) : [],
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Run the consolidate pass.
 *
 * - Builds the consolidate prompt from current session + global notes.
 * - Calls OpenAI (gpt-4.1, temperature 0.1).
 * - Replaces `state.global_memory.notes` with the consolidated set.
 * - Empties `state.session_memory.notes`.
 * - Stamps `state.meta.last_consolidated_at`.
 *
 * On ANY failure (network, parse, validation), returns the original `state`
 * unchanged. The failure is logged via `console.error` for ops visibility
 * but is never thrown to the caller.
 */
export async function consolidateMemory(
  state: EmiliaState,
  openaiClient: ConsolidateOpenAiClient,
): Promise<EmiliaState> {
  // Trivial case: nothing to consolidate, nothing to do.
  if (state.session_memory.notes.length === 0 && state.global_memory.notes.length === 0) {
    return state;
  }

  const prompt = buildConsolidatePrompt(
    state.global_memory.notes,
    state.session_memory.notes,
  );

  let raw: string | null = null;
  try {
    const response = await openaiClient.chatCompletion({
      model: CONSOLIDATE_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You consolidate memory notes. Respond ONLY with the requested JSON, no prose.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: CONSOLIDATE_TEMPERATURE,
      maxTokens: CONSOLIDATE_MAX_TOKENS,
    });
    raw = response?.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error('[consolidateMemory] OpenAI request failed:', err);
    return state;
  }

  if (!raw) {
    console.error('[consolidateMemory] empty response from OpenAI');
    return state;
  }

  const parsed = parseConsolidateResponse(raw);
  if (!parsed) {
    console.error('[consolidateMemory] failed to parse consolidate response:', raw.slice(0, 200));
    return state;
  }

  return {
    ...state,
    global_memory: { notes: parsed.global_notes },
    session_memory: { notes: [] },
    meta: {
      ...state.meta,
      last_consolidated_at: new Date().toISOString(),
    },
  };
}
