/**
 * Tests for the `save_memory_note` Distill-phase tool.
 *
 * Spec: docs/architecture/tool-catalog-spec.md §3
 */

import { describe, expect, it } from 'vitest';

import {
  MEMORY_NOTE_SCOPES,
  executeSaveMemoryNote,
  saveMemoryNoteToolSchema,
  validateMemoryNote,
  type MemoryNoteScope,
} from '../memoryTools.ts';
import type { EmiliaState } from '../emiliaStateTypes.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildState(overrides?: Partial<EmiliaState>): EmiliaState {
  const base: EmiliaState = {
    profile: {
      agency_id: 'ag-1',
      currency: 'ARS',
      language: 'es',
      preferences: {},
    },
    global_memory: { notes: [] },
    session_memory: { notes: [] },
    active_refs: [],
    mode: 'agency',
    trip_history: { trips: [] },
    inject_session_memories_next_turn: false,
    meta: {
      conversation_id: 'conv-1',
      agency_id: 'ag-1',
      schema_version: 1,
      turn_count: 0,
    },
  };
  return { ...base, ...(overrides ?? {}) };
}

// ---------------------------------------------------------------------------
// Schema sanity
// ---------------------------------------------------------------------------

describe('saveMemoryNoteToolSchema', () => {
  it('declares strict mode and the required fields', () => {
    const fn = saveMemoryNoteToolSchema.function;
    expect(saveMemoryNoteToolSchema.type).toBe('function');
    expect(fn.name).toBe('save_memory_note');
    expect(fn.strict).toBe(true);
    expect(fn.parameters.additionalProperties).toBe(false);
    expect(fn.parameters.required).toEqual(['text', 'keywords', 'scope']);
    expect(fn.parameters.properties.scope.enum).toEqual([...MEMORY_NOTE_SCOPES]);
  });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('validateMemoryNote — happy path', () => {
  it('accepts a well-formed note', () => {
    const result = validateMemoryNote(
      'Cliente prefiere hoteles boutique en zonas céntricas con desayuno incluido.',
      ['hoteles', 'boutique', 'desayuno'],
      'planning' satisfies MemoryNoteScope,
    );
    expect(result.ok).toBe(true);
  });

  it('accepts notes at exactly the 500 char boundary', () => {
    const text = 'a'.repeat(500);
    expect(validateMemoryNote(text, ['k'], 'planning').ok).toBe(true);
  });

  it('accepts each declared scope', () => {
    for (const scope of MEMORY_NOTE_SCOPES) {
      const r = validateMemoryNote('Test note', ['k'], scope);
      expect(r.ok, `scope ${scope}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Length rejection
// ---------------------------------------------------------------------------

describe('validateMemoryNote — length', () => {
  it('rejects text > 500 chars', () => {
    const text = 'a'.repeat(501);
    const r = validateMemoryNote(text, ['k'], 'planning');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('too_long');
  });

  it('rejects empty text', () => {
    const r = validateMemoryNote('', ['k'], 'planning');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('empty_text');
  });

  it('rejects non-string text', () => {
    const r = validateMemoryNote(42 as unknown as string, ['k'], 'planning');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_text');
  });
});

// ---------------------------------------------------------------------------
// PII rejection
// ---------------------------------------------------------------------------

describe('validateMemoryNote — PII', () => {
  it('rejects passport-shaped tokens', () => {
    const r = validateMemoryNote(
      'Cliente viajará con pasaporte AB123456 vigente.',
      ['pasaporte'],
      'lead-context',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('pii_passport');
  });

  it('rejects payment-card-shaped digit runs', () => {
    const r = validateMemoryNote(
      'Pagó con tarjeta 4111111111111111 hoy.',
      ['pago'],
      'pricing',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('pii_payment');
  });

  it('rejects ISO date-of-birth strings', () => {
    const r = validateMemoryNote(
      'Cumpleaños del cliente: 1985-07-12',
      ['cumple'],
      'lead-context',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('pii_dob');
  });

  it('rejects SSN-shaped tokens', () => {
    const r = validateMemoryNote(
      'Su SSN es 123-45-6789.',
      ['ssn'],
      'lead-context',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('pii_ssn');
  });
});

// ---------------------------------------------------------------------------
// Instruction-shaped + speculation rejection
// ---------------------------------------------------------------------------

describe('validateMemoryNote — shape', () => {
  it.each([
    'Remember that the client prefers direct flights.',
    'Always do a search before quoting.',
    'Your rule is: never propose layovers >4h.',
    'Never do bookings without confirmation.',
  ])('rejects instruction-shaped text: %s', (text) => {
    const r = validateMemoryNote(text, ['k'], 'planning');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('instruction_shaped');
  });

  it.each([
    'I think the client wants beach destinations.',
    'Probably the budget is around USD 5000.',
    'Maybe they will travel in summer.',
    'I guess the family is of four.',
  ])('rejects speculation marker: %s', (text) => {
    const r = validateMemoryNote(text, ['k'], 'planning');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('speculation');
  });
});

// ---------------------------------------------------------------------------
// Scope + keyword rejection
// ---------------------------------------------------------------------------

describe('validateMemoryNote — scope/keywords', () => {
  it('rejects an unknown scope', () => {
    const r = validateMemoryNote(
      'Some valid note text.',
      ['k'],
      'totally-not-a-scope' as unknown as MemoryNoteScope,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_scope');
  });

  it('rejects an empty keywords array', () => {
    const r = validateMemoryNote('Some note.', [], 'planning');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_keywords');
  });

  it('rejects too many keywords (>6)', () => {
    const r = validateMemoryNote('Some note.', ['a', 'b', 'c', 'd', 'e', 'f', 'g'], 'planning');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_keywords');
  });

  it('rejects non-string keywords', () => {
    const r = validateMemoryNote(
      'Some note.',
      ['ok', 42 as unknown as string],
      'planning',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_keywords');
  });
});

// ---------------------------------------------------------------------------
// executeSaveMemoryNote
// ---------------------------------------------------------------------------

describe('executeSaveMemoryNote', () => {
  it('appends a note and does not mutate the input', () => {
    const before = buildState();
    const beforeJson = JSON.stringify(before);

    const after = executeSaveMemoryNote(before, {
      text: 'Cliente prefiere vuelos directos.',
      keywords: ['Vuelos', 'Directos'],
      scope: 'planning',
    });

    // Input untouched.
    expect(JSON.stringify(before)).toBe(beforeJson);
    expect(before.session_memory.notes).toHaveLength(0);

    // Output has the new note.
    expect(after.session_memory.notes).toHaveLength(1);
    const note = after.session_memory.notes[0];
    expect(note.text).toBe('Cliente prefiere vuelos directos.');
    expect(note.scope).toBe('planning');
    // Keywords are normalized to lowercase + trimmed.
    expect(note.keywords).toEqual(['vuelos', 'directos']);
    expect(typeof note.last_update_date).toBe('string');
    expect(Number.isNaN(Date.parse(note.last_update_date))).toBe(false);

    // Other slices preserved by reference equality where untouched.
    expect(after.profile).toBe(before.profile);
    expect(after.global_memory).toBe(before.global_memory);
  });

  it('throws when validation fails (caller converts to ok:false)', () => {
    const state = buildState();
    expect(() =>
      executeSaveMemoryNote(state, {
        text: 'I think this is too speculative.',
        keywords: ['k'],
        scope: 'planning',
      }),
    ).toThrow(/speculation/);
  });
});
