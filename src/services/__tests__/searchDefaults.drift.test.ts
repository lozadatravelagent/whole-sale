/**
 * Drift guard between the client-side `searchDefaults.ts` and the edge-runtime
 * mirror at `supabase/functions/_shared/searchDefaults.ts`.
 *
 * The two files cannot share a module (Deno vs. Node tsconfig), so they live
 * as a 3-constant contract that we enforce equal in CI. If you tweak one value
 * and forget the mirror, this test fails BEFORE the bug ships to the LLM
 * prompt or the parser fallback layer.
 *
 * The test reads both files as text and extracts numeric literals via regex —
 * deliberately decoupled from the module loader so we don't accidentally rely
 * on a bundler-specific resolution path.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import * as clientDefaults from '../searchDefaults';

const EDGE_PATH = resolve(
  __dirname,
  '../../../supabase/functions/_shared/searchDefaults.ts',
);

const PROMPT_PATH = resolve(
  __dirname,
  '../../../supabase/functions/ai-message-parser/prompt.ts',
);

function readEdgeConstants(): Record<string, number> {
  const text = readFileSync(EDGE_PATH, 'utf-8');
  const constants: Record<string, number> = {};
  const re = /export\s+const\s+(\w+)\s*=\s*(-?\d+(?:\.\d+)?)\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    constants[match[1]] = Number(match[2]);
  }
  return constants;
}

describe('searchDefaults drift (client ↔ edge mirror)', () => {
  const edge = readEdgeConstants();

  it('exports the same constants in both files', () => {
    const clientKeys = Object.keys(clientDefaults).filter(
      (k) => typeof (clientDefaults as Record<string, unknown>)[k] === 'number',
    ).sort();
    const edgeKeys = Object.keys(edge).sort();
    expect(edgeKeys).toEqual(clientKeys);
  });

  it.each([
    'SEARCH_START_OFFSET_DAYS',
    'SEARCH_STAY_NIGHTS',
    'DEFAULT_FAMILY_TRAVELERS_TOTAL',
  ])('%s matches in both files', (name) => {
    const clientValue = (clientDefaults as Record<string, unknown>)[name];
    expect(typeof clientValue).toBe('number');
    expect(edge[name]).toBe(clientValue);
  });
});

/**
 * The LLM system prompt cannot use template interpolation (cache invariant —
 * see `staticPrompt.contract.test.ts`). Instead, the prompt embeds the numeric
 * defaults as literals. This block scans the prompt source for the well-known
 * phrasings and fails if they diverge from the canonical constants.
 *
 * If you intentionally reword a sentence, update the regex here too.
 */
describe('searchDefaults drift (LLM prompt literals)', () => {
  const promptSource = readFileSync(PROMPT_PATH, 'utf-8');
  const { SEARCH_START_OFFSET_DAYS, SEARCH_STAY_NIGHTS } = clientDefaults;

  it(`prompt uses "current date + ${SEARCH_START_OFFSET_DAYS} days" for the start offset`, () => {
    const expected = new RegExp(
      `current date \\+ ${SEARCH_START_OFFSET_DAYS} days`,
      'g',
    );
    const matches = promptSource.match(expected) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it(`prompt uses "${SEARCH_STAY_NIGHTS}-day default window" for the stay duration`, () => {
    expect(promptSource).toContain(`${SEARCH_STAY_NIGHTS}-day default window`);
  });

  it(`prompt itinerary Example D defaults to ${SEARCH_STAY_NIGHTS} days`, () => {
    expect(promptSource).toContain(
      `Example D - Missing days (default to ${SEARCH_STAY_NIGHTS} days)`,
    );
  });

  it(`prompt itinerary fallback sets days = ${SEARCH_STAY_NIGHTS}`, () => {
    expect(promptSource).toMatch(
      new RegExp(`set days = ${SEARCH_STAY_NIGHTS}\\b`),
    );
  });
});
