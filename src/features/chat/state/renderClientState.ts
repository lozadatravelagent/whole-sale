/**
 * renderClientState — Client-side renderer for `EmiliaState` → system prompt
 * injection block.
 *
 * INTENTIONAL DUPLICATION with `supabase/functions/_shared/renderState.ts`.
 *
 * Why duplicated:
 * - Edge Functions run under Deno and require explicit `.ts` extensions on
 *   relative imports.
 * - The Vite/TS client bundler resolves `@/`-aliased modules without `.ts`
 *   extensions and is configured to ignore the `supabase/functions` tree.
 *   Importing the Deno module from the client is unreliable across TS
 *   configs and would couple the two build systems.
 * - We already pay this cost for `emiliaStateTypes.ts` ↔ `emiliaState.ts`.
 *   This file extends the same convention to the renderer.
 *
 * KEEP IN SYNC with `supabase/functions/_shared/renderState.ts`. If either
 * side changes the rendered output, update both. The renderer contract
 * (input shape, output text layout) is asserted by tests on each side.
 *
 * Spec: docs/architecture/context-engineering-spec.md §2 + §6.1 + Appendix A
 */

import {
  type EmiliaState,
  type ContextRef,
  type MemoryNote,
  type EmiliaProfile,
  type PendingAction,
  MAX_GLOBAL_NOTES,
  MAX_SESSION_NOTES,
} from './emiliaState';

// ---------------------------------------------------------------------------
// Token-budget guardrails
// ---------------------------------------------------------------------------

/** Soft cap. Roughly mirrors the §2 state-injection target (800–1100). */
const MAX_OUTPUT_CHARS = 4000; // ~1000 tokens at 4 chars/token

// ---------------------------------------------------------------------------
// Memory instructions block (constant)
// ---------------------------------------------------------------------------

const MEMORY_INSTRUCTIONS = `<memory_instructions>
PRECEDENCE (highest to lowest):
1. User's latest message
2. pending_action (if present — the user's reply most likely answers it)
3. Active refs (current turn)
4. Profile fields (trusted)
5. Session memory (current convo)
6. Global memory (advisory default)

When <pending_action> is present:
- If kind="awaiting_user_input" and the user's reply plausibly contains values for any of the listed fields, call apply_slot_values with the parsed values keyed by those field names — do NOT start a fresh analysis.
- If kind="awaiting_user_confirmation", call confirm_pending_action with confirmed=true|false.
- If the user clearly changed topic (greeting, off-topic, new request unrelated to the prompt), proceed normally — the next handler will clear pending_action.

When current_mode=agency and a plan ref is active, the user likely wants to quote it.
When current_mode=passenger and a lead is in profile, consider lead preferences when suggesting.
Save durable observations via save_memory_note tool — never PII, never speculation, never instructions.
</memory_instructions>`;

// ---------------------------------------------------------------------------
// Profile YAML
// ---------------------------------------------------------------------------

function yamlValue(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'string') {
    if (/[:#[\]{}&*!|>'"%@`]/.test(v) || /^\s|\s$/.test(v)) {
      return JSON.stringify(v);
    }
    return v;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    if (v.every((x) => typeof x === 'string' || typeof x === 'number')) {
      return `[${v.map((x) => (typeof x === 'string' ? x : String(x))).join(', ')}]`;
    }
    return JSON.stringify(v);
  }
  if (typeof v === 'object') {
    return JSON.stringify(v);
  }
  return String(v);
}

function renderProfileYAML(profile: EmiliaProfile): string {
  const lines: string[] = [];
  if (profile.lead_id) lines.push(`lead_id: ${yamlValue(profile.lead_id)}`);
  lines.push(`agency_id: ${yamlValue(profile.agency_id)}`);
  lines.push(`currency: ${yamlValue(profile.currency)}`);
  if (profile.default_origin_city) {
    lines.push(`default_origin_city: ${yamlValue(profile.default_origin_city)}`);
  }
  if (profile.default_origin_country) {
    lines.push(`default_origin_country: ${yamlValue(profile.default_origin_country)}`);
  }
  lines.push(`language: ${yamlValue(profile.language)}`);

  const prefs = profile.preferences ?? {};
  const prefKeys = Object.keys(prefs).filter(
    (k) => (prefs as Record<string, unknown>)[k] !== undefined,
  );
  if (prefKeys.length === 0) {
    lines.push('preferences: {}');
  } else {
    lines.push('preferences:');
    for (const key of prefKeys) {
      const val = (prefs as Record<string, unknown>)[key];
      lines.push(`  ${key}: ${yamlValue(val)}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Active refs
// ---------------------------------------------------------------------------

function relativeTime(iso: string, now: Date = new Date()): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const deltaMs = Math.max(0, now.getTime() - ts);
  const sec = Math.floor(deltaMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function renderRefsBlock(refs: ContextRef[], now: Date): string {
  if (!refs || refs.length === 0) return '';
  const lines = refs.map(
    (r) =>
      `  - ${r.type}:${r.id} — "${r.summary1Line}" (updated ${relativeTime(r.lastUpdated, now)})`,
  );
  return `<active_refs>\n${lines.join('\n')}\n</active_refs>`;
}

// ---------------------------------------------------------------------------
// Pending action block
// ---------------------------------------------------------------------------

function renderPendingActionBlock(pa: PendingAction | null | undefined, now: Date): string {
  if (!pa) return '';
  const lines: string[] = [];
  lines.push(`  kind: ${pa.kind}`);
  lines.push(`  for: ${pa.for}`);
  if (pa.fields && pa.fields.length > 0) {
    lines.push(`  fields: [${pa.fields.join(', ')}]`);
  }
  if (pa.ref) {
    lines.push(`  ref: ${pa.ref.type}:${pa.ref.id}`);
  }
  lines.push(`  prompt: ${JSON.stringify(pa.prompt)}`);
  lines.push(`  issued: ${relativeTime(pa.issuedAt, now)}`);
  if (pa.applied && Object.keys(pa.applied).length > 0) {
    lines.push(`  applied_so_far: ${JSON.stringify(pa.applied)}`);
    if (pa.complete !== undefined) {
      lines.push(`  complete: ${pa.complete}`);
    }
  }
  return `<pending_action>\n${lines.join('\n')}\n</pending_action>`;
}

// ---------------------------------------------------------------------------
// Memories block
// ---------------------------------------------------------------------------

function sortNotesRecentFirst(notes: MemoryNote[]): MemoryNote[] {
  return [...notes].sort((a, b) => {
    const tsA = Date.parse(a.last_update_date) || 0;
    const tsB = Date.parse(b.last_update_date) || 0;
    return tsB - tsA;
  });
}

function noteLine(n: MemoryNote): string {
  const date = (n.last_update_date || '').slice(0, 10);
  return `- [${n.scope}] ${date} ${n.text}`;
}

function renderMemoriesMd(opts: {
  global: MemoryNote[];
  session: MemoryNote[] | null;
  globalLimit: number;
  sessionLimit: number;
}): string {
  const sections: string[] = [];

  const globalSorted = sortNotesRecentFirst(opts.global).slice(0, opts.globalLimit);
  if (globalSorted.length > 0) {
    sections.push(
      `GLOBAL_NOTES (most recent first):\n${globalSorted.map(noteLine).join('\n')}`,
    );
  } else {
    sections.push('GLOBAL_NOTES: (none yet)');
  }

  if (opts.session && opts.session.length > 0) {
    const sessionSorted = sortNotesRecentFirst(opts.session).slice(0, opts.sessionLimit);
    sections.push(
      `## Session memory (this conversation):\n${sessionSorted.map(noteLine).join('\n')}`,
    );
  }

  return `<memories>\n${sections.join('\n\n')}\n</memories>`;
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

interface RenderOpts {
  /** Override "now" for deterministic tests. */
  now?: Date;
}

/**
 * Render the full state-injection block. Always emits the constant
 * `<memory_instructions>` block at the bottom, even when state is empty.
 *
 * If the rendered output exceeds the soft char cap, we re-render with
 * progressively smaller memory budgets:
 *   1. Drop session memory entirely.
 *   2. Halve the global-memory top-k (down to 1).
 */
export function renderStateForSystemPrompt(
  state: EmiliaState,
  opts: RenderOpts = {},
): string {
  const now = opts.now ?? new Date();

  const includeSession = Boolean(state.inject_session_memories_next_turn);

  const tryRender = (globalLimit: number, includeSessionMem: boolean): string => {
    const parts: string[] = [];

    parts.push(`<user_profile>\n${renderProfileYAML(state.profile)}\n</user_profile>`);

    parts.push(`<current_mode>${state.mode}</current_mode>`);

    const refsBlock = renderRefsBlock(state.active_refs ?? [], now);
    if (refsBlock) parts.push(refsBlock);

    const pendingBlock = renderPendingActionBlock(state.pending_action ?? null, now);
    if (pendingBlock) parts.push(pendingBlock);

    parts.push(
      renderMemoriesMd({
        global: state.global_memory?.notes ?? [],
        session: includeSessionMem ? (state.session_memory?.notes ?? []) : null,
        globalLimit,
        sessionLimit: MAX_SESSION_NOTES,
      }),
    );

    parts.push(MEMORY_INSTRUCTIONS);

    return parts.join('\n\n');
  };

  // First attempt: full budgets.
  let output = tryRender(MAX_GLOBAL_NOTES, includeSession);
  if (output.length <= MAX_OUTPUT_CHARS) return output;

  // Step 1: drop session memory.
  if (includeSession) {
    output = tryRender(MAX_GLOBAL_NOTES, false);
    if (output.length <= MAX_OUTPUT_CHARS) return output;
  }

  // Step 2: progressively shrink global memory top-k.
  for (let limit = MAX_GLOBAL_NOTES - 1; limit >= 1; limit--) {
    output = tryRender(limit, false);
    if (output.length <= MAX_OUTPUT_CHARS) return output;
  }

  // Last resort: 0 memories, just profile + instructions.
  return tryRender(0, false);
}

// Internal helpers exported for the test suite only.
export const __testing = {
  renderProfileYAML,
  renderRefsBlock,
  renderPendingActionBlock,
  renderMemoriesMd,
  relativeTime,
  MAX_OUTPUT_CHARS,
};
