/**
 * Golden-file regression test for STATIC_SYSTEM_PROMPT.
 *
 * The golden file is a byte-identical capture of the prompt at the version
 * named in `PROMPT_VERSION`. If anyone edits `prompt.ts` and changes the
 * static block, this test fails — forcing a conscious decision to:
 *
 *   1. Bump `PROMPT_VERSION` (e.g. emilia-parser-v7 → emilia-parser-v8)
 *   2. Rename the golden file to match the new version
 *   3. Update `EXPECTED_PROMPT_VERSION` below
 *   4. Run `vitest -u` to regenerate the golden contents
 *
 * Why this exists: post-distillation regressions are silent. The model still
 * answers, but key behaviors (e.g. "no implicit mealPlan", multi-city date
 * alignment) can quietly degrade. A version bump + golden refresh creates a
 * paper trail in `git log` and `llm_request_logs.prompt_version` so we can
 * correlate behavioral changes to specific prompt revisions.
 *
 * To regenerate: `npx vitest run supabase/functions/ai-message-parser/__tests__/promptGolden.test.ts -u`
 */

import { describe, expect, it } from 'vitest';

import { PROMPT_VERSION, STATIC_SYSTEM_PROMPT } from '../prompt.ts';

// Update this when bumping PROMPT_VERSION. Forces a single conscious touchpoint
// rather than two independent edits that could drift.
const EXPECTED_PROMPT_VERSION = 'emilia-parser-v13';
const GOLDEN_FILE_PATH = './__snapshots__/prompt-v13.golden.txt';

describe('STATIC_SYSTEM_PROMPT golden file', () => {
  it('PROMPT_VERSION matches EXPECTED_PROMPT_VERSION (bump both together)', () => {
    expect(PROMPT_VERSION).toBe(EXPECTED_PROMPT_VERSION);
  });

  it(`matches the golden file at ${GOLDEN_FILE_PATH}`, async () => {
    // toMatchFileSnapshot does byte-for-byte comparison and writes the file
    // on first run or when invoked with `-u`. A failing test prints a diff.
    await expect(STATIC_SYSTEM_PROMPT).toMatchFileSnapshot(GOLDEN_FILE_PATH);
  });
});
