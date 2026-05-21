/**
 * Contract tests for the STATIC_SYSTEM_PROMPT.
 *
 * These tests enforce the OpenAI prompt-caching invariants documented in
 * `prompt.ts`:
 *   1. STATIC_SYSTEM_PROMPT contains NO unescaped `${...}` interpolations.
 *      A single dynamic byte breaks the cacheable prefix and silently drops
 *      hit rate to 0%.
 *   2. STATIC_SYSTEM_PROMPT is large enough to clear OpenAI's 1024-token
 *      caching minimum (~4000 chars at 4 chars/token, so ~12000 chars is a
 *      safe sanity floor).
 *   3. `buildSystemPrompt(args) === STATIC_SYSTEM_PROMPT + buildDynamicContextBlock(args)`
 *      — the only correct concatenation order. Any other layout breaks caching.
 *   4. PROMPT_VERSION follows the `emilia-parser-vN` pattern so telemetry can
 *      attribute cache hit rate to a specific prompt revision.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PROMPT_VERSION,
  STATIC_SYSTEM_PROMPT,
  buildDynamicContextBlock,
  buildSystemPrompt,
} from '../prompt.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROMPT_SOURCE_PATH = resolve(__dirname, '..', 'prompt.ts');

// ---------------------------------------------------------------------------
// PROMPT_VERSION
// ---------------------------------------------------------------------------

describe('PROMPT_VERSION', () => {
  it('matches the `emilia-parser-vN` pattern', () => {
    expect(PROMPT_VERSION).toMatch(/^emilia-parser-v\d+$/);
  });
});

// ---------------------------------------------------------------------------
// STATIC_SYSTEM_PROMPT — sanity + cache-friendly invariants
// ---------------------------------------------------------------------------

describe('STATIC_SYSTEM_PROMPT — sanity', () => {
  it('is non-empty and large enough to clear OpenAI cache minimum (~1024 tokens)', () => {
    expect(STATIC_SYSTEM_PROMPT.length).toBeGreaterThan(12_000);
  });

  it('starts with the persona line (regression: section reordering breaks cache)', () => {
    // The first non-whitespace line must be the persona declaration. If
    // anyone reorders sections, this fails loudly.
    expect(STATIC_SYSTEM_PROMPT.trimStart()).toMatch(
      /^Eres un experto asistente de viajes/,
    );
  });

  it('ends with the DYNAMIC CONTEXT bridge sentence', () => {
    // The constant must hand off cleanly to buildDynamicContextBlock. The
    // bridge sentence is what tells the model "more context is coming".
    expect(STATIC_SYSTEM_PROMPT.trimEnd()).toMatch(
      /A DYNAMIC CONTEXT block follows below[\s\S]*respond with JSON only\.$/,
    );
  });
});

// ---------------------------------------------------------------------------
// Source-file scan — block must contain no unescaped `${...}` interpolations
// ---------------------------------------------------------------------------

describe('STATIC_SYSTEM_PROMPT — source file integrity', () => {
  /**
   * Extract the substring of the source file that lies inside the
   * `export const STATIC_SYSTEM_PROMPT = \`...\`;` template literal.
   */
  function extractStaticBlockSource(): string {
    const source = readFileSync(PROMPT_SOURCE_PATH, 'utf-8');
    const startMarker = 'export const STATIC_SYSTEM_PROMPT = `';
    const startIdx = source.indexOf(startMarker);
    if (startIdx < 0) {
      throw new Error(
        `Could not find STATIC_SYSTEM_PROMPT declaration in ${PROMPT_SOURCE_PATH}. ` +
          'Did you rename or remove the export?',
      );
    }
    const blockBegin = startIdx + startMarker.length;
    // The closing backtick is followed by a semicolon on its own line.
    const endIdx = source.indexOf('\n`;\n', blockBegin);
    if (endIdx < 0) {
      throw new Error(
        'Could not find the closing "`;" of STATIC_SYSTEM_PROMPT. ' +
          'Did the export structure change?',
      );
    }
    return source.slice(blockBegin, endIdx);
  }

  it('contains no unescaped `${...}` interpolations', () => {
    const block = extractStaticBlockSource();
    // Match any `${` not preceded by `\` (i.e. a real interpolation, not the
    // escaped literal `\${` that we use to display syntax in examples).
    const interpolations = block.match(/(?<!\\)\$\{/g) ?? [];
    if (interpolations.length > 0) {
      // Surface first 5 line numbers to make debugging instant.
      const lines = block.split('\n');
      const offending: string[] = [];
      lines.forEach((line, idx) => {
        if (/(?<!\\)\$\{/.test(line)) {
          offending.push(`  line ${idx + 1}: ${line.trim().slice(0, 120)}`);
        }
      });
      throw new Error(
        `Found ${interpolations.length} unescaped \${...} interpolation(s) inside ` +
          `STATIC_SYSTEM_PROMPT. These break OpenAI prompt caching because the ` +
          `cacheable prefix ends at the first dynamic byte.\n\n` +
          `If you need dynamic content, add it to buildDynamicContextBlock instead.\n` +
          `If you need a literal "\${...}" in the static prompt, escape it as \\\${...}.\n\n` +
          `First offending line(s):\n${offending.slice(0, 5).join('\n')}`,
      );
    }
    expect(interpolations.length).toBe(0);
  });

  it('block source is non-trivially large (smoke-detects accidental truncation)', () => {
    const block = extractStaticBlockSource();
    expect(block.length).toBeGreaterThan(12_000);
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt composition contract
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PENDING ACTION — multi-slot fill rules (v23)
//
// These assertions pin the architectural contract that pending_action slot
// fills must (a) split multi-slot user replies by surface pattern and
// (b) mirror the same values into the final JSON envelope. They are deeper
// than the byte-level golden because they target the *load-bearing wording*
// rather than the whole file — so a future refactor that reshuffles other
// sections cannot silently delete this rule.
// ---------------------------------------------------------------------------

describe('STATIC_SYSTEM_PROMPT — PENDING ACTION slot-fill contract', () => {
  it('explicitly tells the model to split "X a Y" patterns into ordered fields', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(/MULTI-SLOT PATTERNS/);
    expect(STATIC_SYSTEM_PROMPT).toMatch(/"X a Y"/);
    expect(STATIC_SYSTEM_PROMPT).toMatch(/fields\[0\]\s*=\s*X,\s*fields\[1\]\s*=\s*Y/);
  });

  it('establishes the flight-route convention: X is origin, Y is destination', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(/origin \(X\).*destination \(Y\)/);
  });

  it('forbids stuffing the whole "X a Y" phrase into a single slot', () => {
    // This is the exact failure mode the v23 rules exist to prevent.
    expect(STATIC_SYSTEM_PROMPT).toMatch(/NEVER stuff a multi-word route phrase/);
  });

  it('requires apply_slot_values values to be mirrored into the JSON envelope', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(/JSON ENVELOPE MIRROR/);
    expect(STATIC_SYSTEM_PROMPT).toMatch(/MUST also appear in the final JSON envelope/);
  });

  it('includes the canonical field-name to envelope-path mapping', () => {
    // The mapping is what lets the model produce a structurally correct
    // envelope. We pin a few representative entries; the full list lives
    // in the golden.
    expect(STATIC_SYSTEM_PROMPT).toMatch(/`origin`\s+→\s+`flights\.origin`/);
    expect(STATIC_SYSTEM_PROMPT).toMatch(/`destination`\s+→\s+`flights\.destination`/);
    expect(STATIC_SYSTEM_PROMPT).toMatch(/`city`\s+→\s+`hotels\.city`/);
  });

  it('keeps the awaiting_user_confirmation arm intact (no v22 regression)', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(/kind="awaiting_user_confirmation"/);
    expect(STATIC_SYSTEM_PROMPT).toMatch(/confirm_pending_action/);
  });
});

describe('buildSystemPrompt composition', () => {
  const baseArgs = {
    currentDate: '2026-05-03',
    language: 'es' as const,
  };

  it('equals STATIC_SYSTEM_PROMPT + buildDynamicContextBlock(args) byte-for-byte', () => {
    const composed = buildSystemPrompt(baseArgs);
    const manual = STATIC_SYSTEM_PROMPT + buildDynamicContextBlock(baseArgs);
    expect(composed).toBe(manual);
  });

  it('places the static block FIRST (cache prefix is at offset 0)', () => {
    const composed = buildSystemPrompt(baseArgs);
    expect(composed.startsWith(STATIC_SYSTEM_PROMPT)).toBe(true);
    expect(composed.indexOf(STATIC_SYSTEM_PROMPT)).toBe(0);
  });

  it('keeps the static prefix byte-identical regardless of dynamic args', () => {
    const a = buildSystemPrompt({
      currentDate: '2026-05-03',
      language: 'es',
    });
    const b = buildSystemPrompt({
      currentDate: '2027-01-15',
      language: 'en',
      conversationHistoryText: 'user: hi\nassistant: hello',
      previousContext: { foo: 'bar' },
      plannerContext: { trip_id: 'abc' },
      memoryStateBlock: '<user_profile>...</user_profile>',
    });
    // The first STATIC_SYSTEM_PROMPT.length bytes MUST be identical.
    expect(a.slice(0, STATIC_SYSTEM_PROMPT.length)).toBe(
      b.slice(0, STATIC_SYSTEM_PROMPT.length),
    );
  });
});
