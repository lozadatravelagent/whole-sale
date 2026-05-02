/**
 * memoryTools — Distill phase (Context Engineering Phase 2.1).
 *
 * Implements the `save_memory_note` function-calling tool that the agent
 * invokes during a turn to capture durable observations into
 * `EmiliaState.session_memory`.
 *
 * Spec: docs/architecture/context-engineering-spec.md §1.3 + §6.1
 *       docs/architecture/tool-catalog-spec.md §3
 *
 * This module is PURE: no I/O, no DB writes, no globals. The runtime
 * (Phase 3 tool-runner) is responsible for plumbing the validated note
 * back into persisted state.
 */

import type { EmiliaState, MemoryNote } from './emiliaStateTypes.ts';

// ---------------------------------------------------------------------------
// Constants & schema
// ---------------------------------------------------------------------------

/** Allowed `scope` values for a saved memory note. */
export const MEMORY_NOTE_SCOPES = ['planning', 'pricing', 'lead-context', 'decisions'] as const;
export type MemoryNoteScope = typeof MEMORY_NOTE_SCOPES[number];

const MAX_TEXT_LENGTH = 500;
const MIN_KEYWORDS = 1;
const MAX_KEYWORDS = 6;

/**
 * OpenAI Chat Completions function tool definition for `save_memory_note`.
 *
 * Conforms to the GPT-5.1 strict-mode requirement (`strict: true`,
 * `additionalProperties: false`, every property required). Wired into the
 * tool-loop request body in Phase 3.
 */
export const saveMemoryNoteToolSchema = {
  type: 'function',
  function: {
    name: 'save_memory_note',
    description:
      "Persist a durable observation about the user/lead/conversation to session memory. " +
      "Use when: user explicitly states a preference, constraint, or decision that affects " +
      "future recommendations; you confirm a non-obvious detail. Don't use for: speculation, " +
      "instructions to yourself, sensitive PII (passports, payments, DOB, SSN), trip-specific " +
      "ephemeral details that won't matter next time.",
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        text: {
          type: 'string',
          description: `The memory text, ≤${MAX_TEXT_LENGTH} chars. Must be a fact stated/confirmed by user.`,
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: `Searchable tags. ${MIN_KEYWORDS}-${MAX_KEYWORDS} short keywords.`,
        },
        scope: {
          type: 'string',
          enum: [...MEMORY_NOTE_SCOPES],
          description: 'Category of the note.',
        },
      },
      required: ['text', 'keywords', 'scope'],
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** PII / shape rejection patterns. Order matters only for the returned reason. */
const PII_PATTERNS: Array<{ name: string; rx: RegExp }> = [
  // Passports — ISO-style 1-2 letters + 6-9 digits. Catches AR (AAA000000), US (123456789).
  { name: 'pii_passport', rx: /\b[A-Z]{1,2}\d{6,9}\b/ },
  // SSN — must come BEFORE the generic payment-card check, otherwise the digit
  // run can be matched as a card and report the wrong reason.
  { name: 'pii_ssn', rx: /\b\d{3}-?\d{2}-?\d{4}\b/ },
  // Date of birth in ISO-ish form.
  { name: 'pii_dob', rx: /\b\d{4}[-/]\d{2}[-/]\d{2}\b/ },
  // Payment cards — any 13–19 digit run (PAN length range).
  { name: 'pii_payment', rx: /\b\d{13,19}\b/ },
];

const INSTRUCTION_PATTERN =
  /\b(remember that|always do|your rule is|never do)\b/i;

const SPECULATION_PATTERN =
  /\b(i think|probably|maybe|i guess)\b/i;

export interface ValidationOk {
  ok: true;
}

export interface ValidationFail {
  ok: false;
  reason: string;
}

export type ValidationResult = ValidationOk | ValidationFail;

/**
 * Validate a candidate memory note. Pure function: no side effects, no
 * dependence on runtime state. The tool-runner calls this BEFORE appending
 * to `state.session_memory.notes`.
 *
 * Failure reasons match the catalog spec (`too_long`, `pii_*`,
 * `instruction_shaped`, `speculation`, `invalid_scope`, `invalid_keywords`).
 */
export function validateMemoryNote(
  text: unknown,
  keywords: unknown,
  scope: unknown,
): ValidationResult {
  // -- text --
  if (typeof text !== 'string') {
    return { ok: false, reason: 'invalid_text' };
  }
  if (text.length === 0) {
    return { ok: false, reason: 'empty_text' };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return { ok: false, reason: 'too_long' };
  }

  for (const { name, rx } of PII_PATTERNS) {
    if (rx.test(text)) {
      return { ok: false, reason: name };
    }
  }

  if (INSTRUCTION_PATTERN.test(text)) {
    return { ok: false, reason: 'instruction_shaped' };
  }

  if (SPECULATION_PATTERN.test(text)) {
    return { ok: false, reason: 'speculation' };
  }

  // -- keywords --
  if (!Array.isArray(keywords)) {
    return { ok: false, reason: 'invalid_keywords' };
  }
  if (keywords.length < MIN_KEYWORDS || keywords.length > MAX_KEYWORDS) {
    return { ok: false, reason: 'invalid_keywords' };
  }
  for (const kw of keywords) {
    if (typeof kw !== 'string' || kw.trim().length === 0) {
      return { ok: false, reason: 'invalid_keywords' };
    }
  }

  // -- scope --
  if (typeof scope !== 'string' || !(MEMORY_NOTE_SCOPES as readonly string[]).includes(scope)) {
    return { ok: false, reason: 'invalid_scope' };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pure executor
// ---------------------------------------------------------------------------

export interface SaveMemoryNoteArgs {
  text: string;
  keywords: string[];
  scope: MemoryNoteScope;
}

/**
 * Append a validated note to `state.session_memory.notes` and return a NEW
 * EmiliaState. Does NOT mutate the input.
 *
 * Throws if validation fails — the tool-runner is expected to catch and
 * convert into the `{ ok: false, reason }` tool response that goes back to
 * the model.
 */
export function executeSaveMemoryNote(
  state: EmiliaState,
  args: SaveMemoryNoteArgs,
): EmiliaState {
  const validation = validateMemoryNote(args.text, args.keywords, args.scope);
  if (!validation.ok) {
    throw new Error(`save_memory_note rejected: ${validation.reason}`);
  }

  const note: MemoryNote = {
    text: args.text,
    keywords: args.keywords.map((k) => k.trim().toLowerCase()),
    scope: args.scope,
    last_update_date: new Date().toISOString(),
  };

  // Immutable update: shallow-clone state, then deep-replace the slices we touch.
  return {
    ...state,
    session_memory: {
      ...state.session_memory,
      notes: [...state.session_memory.notes, note],
    },
  };
}
