/**
 * run-eval.ts — Context Engineering eval runner (Phase 8.7 SKELETON)
 *
 * Authoritative spec: docs/architecture/context-engineering-spec.md (Phase 8.7)
 * See README.md in this folder for the dataset shape and operational notes.
 *
 * What this is:
 *   - The contract for how Phase 9 will replay user turns against the
 *     `ai-message-parser` edge function and score actual vs expected.
 *
 * What this is NOT:
 *   - A working eval. Every step that talks to the parser is a TODO. The
 *     skeleton compiles, type-checks, and runs end-to-end against the
 *     example dataset, but every case is reported as `skipped` until
 *     Phase 9 wires the actual edge-function invocation.
 *
 * Run (today, against the example dataset, all skipped):
 *   npx tsx evals/context-engineering/run-eval.ts
 *
 * Phase 9 will add:
 *   - real edge-function calls (HTTP POST to `EVAL_PARSER_URL`)
 *   - response parsing (read `meta.toolLoop.trace`, `parsed.requestType`)
 *   - retry/timeout policy
 *   - aggregated metrics (Phase 8.2)
 *   - JUnit / CI reporter
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Types — mirror dataset.example.json shape (see README.md §"Case shape")
// ---------------------------------------------------------------------------

export interface EvalTurn {
  user: string;
  expected_intent: string;
  expected_tools: string[];
}

export interface EvalCase {
  id: string;
  description: string;
  turns: EvalTurn[];
}

export interface EvalDataset {
  cases: EvalCase[];
}

export interface TurnResult {
  turn_index: number;
  /**
   * `pass` — actual matched expected.
   * `fail` — actual diverged from expected (mismatch).
   * `skipped` — runner did not produce an actual (Phase 8 default).
   */
  outcome: 'pass' | 'fail' | 'skipped';
  expected_intent: string;
  actual_intent?: string;
  expected_tools: string[];
  actual_tools?: string[];
  notes?: string;
}

export interface CaseResult {
  id: string;
  description: string;
  turns: TurnResult[];
  /** Aggregate per-case outcome (worst-of). */
  outcome: 'pass' | 'fail' | 'skipped';
}

// ---------------------------------------------------------------------------
// Dataset loader — pure, testable in isolation
// ---------------------------------------------------------------------------

export function loadDataset(filePath: string): EvalDataset {
  const raw = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<EvalDataset> & Record<string, unknown>;

  if (!Array.isArray(parsed.cases)) {
    throw new Error(`dataset at ${filePath} is missing a 'cases' array`);
  }

  for (const c of parsed.cases) {
    if (!c.id || !Array.isArray(c.turns) || c.turns.length === 0) {
      throw new Error(`dataset case malformed: ${JSON.stringify(c)}`);
    }
    for (const t of c.turns) {
      if (typeof t.user !== 'string' || typeof t.expected_intent !== 'string') {
        throw new Error(`turn malformed in case ${c.id}: ${JSON.stringify(t)}`);
      }
      if (!Array.isArray(t.expected_tools)) {
        throw new Error(`turn missing expected_tools in case ${c.id}: ${JSON.stringify(t)}`);
      }
    }
  }

  return parsed as EvalDataset;
}

// ---------------------------------------------------------------------------
// Phase 9 extension point: replay a single turn against the parser
// ---------------------------------------------------------------------------

/**
 * Phase 9: replace the body with a real fetch against `EVAL_PARSER_URL`.
 *
 * Suggested implementation:
 *   const url = process.env.EVAL_PARSER_URL ?? 'http://localhost:54321/functions/v1/ai-message-parser';
 *   const resp = await fetch(url, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.EVAL_PARSER_TOKEN}` },
 *     body: JSON.stringify({ message: turn.user, conversationHistory, contextMeta }),
 *   });
 *   const json = await resp.json();
 *   return {
 *     intent: json.parsed?.requestType ?? null,
 *     tools: (json.meta?.toolLoop?.trace ?? []).map((t: { tool: string }) => t.tool),
 *   };
 */
export async function replayTurn(_turn: EvalTurn): Promise<{
  intent: string | null;
  tools: string[];
  skipped: true;
} | {
  intent: string | null;
  tools: string[];
  skipped: false;
}> {
  // SKELETON: do not invoke the parser. Phase 9 will replace this body.
  return { intent: null, tools: [], skipped: true };
}

// ---------------------------------------------------------------------------
// Comparison — pure, testable in isolation
// ---------------------------------------------------------------------------

/**
 * Score a turn given expected vs actual. Tool comparison is set-based
 * (order-insensitive); intent is exact string match.
 */
export function scoreTurn(
  turn: EvalTurn,
  turnIndex: number,
  actual: { intent: string | null; tools: string[]; skipped: boolean },
): TurnResult {
  if (actual.skipped) {
    return {
      turn_index: turnIndex,
      outcome: 'skipped',
      expected_intent: turn.expected_intent,
      expected_tools: turn.expected_tools,
      notes: 'Phase 8 skeleton: replayTurn() not yet wired to real parser',
    };
  }

  const intentOk = actual.intent === turn.expected_intent;
  const expectedToolSet = new Set(turn.expected_tools);
  const actualToolSet = new Set(actual.tools);
  const toolsOk =
    expectedToolSet.size === actualToolSet.size &&
    [...expectedToolSet].every((t) => actualToolSet.has(t));

  return {
    turn_index: turnIndex,
    outcome: intentOk && toolsOk ? 'pass' : 'fail',
    expected_intent: turn.expected_intent,
    actual_intent: actual.intent ?? undefined,
    expected_tools: turn.expected_tools,
    actual_tools: actual.tools,
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runEval(dataset: EvalDataset): Promise<CaseResult[]> {
  const results: CaseResult[] = [];

  for (const c of dataset.cases) {
    const turnResults: TurnResult[] = [];
    for (let i = 0; i < c.turns.length; i++) {
      const turn = c.turns[i];
      const actual = await replayTurn(turn);
      turnResults.push(scoreTurn(turn, i, actual));
    }

    // Worst-of aggregation: fail > skipped > pass.
    const hasFail = turnResults.some((t) => t.outcome === 'fail');
    const hasSkipped = turnResults.some((t) => t.outcome === 'skipped');
    const outcome: CaseResult['outcome'] = hasFail
      ? 'fail'
      : hasSkipped
        ? 'skipped'
        : 'pass';

    results.push({
      id: c.id,
      description: c.description,
      turns: turnResults,
      outcome,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// CLI entry — only runs when invoked directly (not when imported by tests)
// ---------------------------------------------------------------------------

function isMain(): boolean {
  try {
    const here = fileURLToPath(import.meta.url);
    const argv1 = process.argv[1] ? resolve(process.argv[1]) : '';
    return here === argv1;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const datasetPath = process.env.EVAL_DATASET ?? resolve(__dirname, 'dataset.example.json');
  console.log(`[eval] loading dataset: ${datasetPath}`);

  const dataset = loadDataset(datasetPath);
  const results = await runEval(dataset);

  const counts = results.reduce(
    (acc, r) => {
      acc[r.outcome] += 1;
      return acc;
    },
    { pass: 0, fail: 0, skipped: 0 } as Record<CaseResult['outcome'], number>,
  );

  console.log(JSON.stringify({ summary: counts, results }, null, 2));

  if (counts.fail > 0) process.exit(1);
}

if (isMain()) {
  main().catch((err) => {
    console.error('[eval] fatal:', err);
    process.exit(2);
  });
}
