/**
 * Contract tests for the TRAVELER TYPE detection rules added in prompt v15.
 *
 * Spec reference: Emilia / Vibook §5.4 (pareja → couple), §5.6 (familia →
 * family), Cases 11/12/15 (couple/family/anniversary).
 *
 * The prompt teaches the LLM to emit a top-level `travelerType` field with
 * one of {'solo','couple','family','group'} based on natural-language cues,
 * independent of the numeric adult/child counts on flights/hotels.
 *
 * These tests do NOT call the LLM — they pin the prompt and the schema so a
 * future edit cannot silently drop the rule or shrink the enum.
 */

import { describe, expect, it } from 'vitest';

import {
  PROMPT_CONTRACT_SNIPPETS,
  STATIC_SYSTEM_PROMPT,
} from '../prompt.ts';
import { PARSED_TRAVEL_REQUEST_SCHEMA } from '../responseSchema.ts';

describe('TRAVELER TYPE — prompt contract', () => {
  it('PROMPT_CONTRACT_SNIPPETS lists "TRAVELER TYPE"', () => {
    expect(PROMPT_CONTRACT_SNIPPETS).toContain('TRAVELER TYPE');
  });

  it('STATIC_SYSTEM_PROMPT contains the language-agnostic TRAVELER TYPE section', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(
      /## TRAVELER TYPE — SEMANTIC INFERENCE \(LANGUAGE-AGNOSTIC\)/,
    );
  });

  it('declares the four allowed values with canonical-English note', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'Allowed values (canonical, English): "solo" | "couple" | "family" | "group"',
    );
  });

  it('instructs the LLM to detect MEANINGS, not specific words', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'detect these MEANINGS, not specific words',
    );
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'The user may write in Spanish, English, Portuguese, or mix languages',
    );
  });

  it('couple cues are listed across es/en/pt', () => {
    // Spanish
    expect(STATIC_SYSTEM_PROMPT).toContain('pareja');
    expect(STATIC_SYSTEM_PROMPT).toContain('luna de miel');
    // English
    expect(STATIC_SYSTEM_PROMPT).toContain('partner');
    expect(STATIC_SYSTEM_PROMPT).toContain('honeymoon');
    expect(STATIC_SYSTEM_PROMPT).toContain('spouse');
    // Portuguese
    expect(STATIC_SYSTEM_PROMPT).toContain('lua de mel');
    expect(STATIC_SYSTEM_PROMPT).toContain('namorado/a');
  });

  it('family cues are listed across es/en/pt', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('familia');
    expect(STATIC_SYSTEM_PROMPT).toContain('con mis hijos');
    expect(STATIC_SYSTEM_PROMPT).toContain('with my kids/children');
    expect(STATIC_SYSTEM_PROMPT).toContain('com meus filhos');
  });

  it('group cues are listed across es/en/pt', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('amigos');
    expect(STATIC_SYSTEM_PROMPT).toContain('with friends');
    expect(STATIC_SYSTEM_PROMPT).toContain('em grupo');
  });

  it('solo cues are listed across es/en/pt', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('viajo solo');
    expect(STATIC_SYSTEM_PROMPT).toContain('by myself');
    expect(STATIC_SYSTEM_PROMPT).toContain('sozinho');
  });

  it('does NOT emit when only a numeric count is given (no relational qualifier)', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'Plain numeric count without a relational qualifier',
    );
  });

  it('explicitly notes travelerType is independent of adult/child counts', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'This is independent of the adult/child counts on `flights`/`hotels`',
    );
  });

  it('carries multilingual worked examples for each value', () => {
    // Spanish
    expect(STATIC_SYSTEM_PROMPT).toContain('Quiero un viaje a Cancún con mi pareja');
    // English
    expect(STATIC_SYSTEM_PROMPT).toContain('Trip to Cancun with my wife');
    // Portuguese
    expect(STATIC_SYSTEM_PROMPT).toContain('Viagem para Cancún com minha esposa');
    // family — es + en
    expect(STATIC_SYSTEM_PROMPT).toContain('mi mujer y mis dos hijos a Orlando');
    expect(STATIC_SYSTEM_PROMPT).toContain('Trip to Orlando with my wife and two kids');
    // group — es + en
    expect(STATIC_SYSTEM_PROMPT).toContain('grupo de 6 amigos a Brasil');
    expect(STATIC_SYSTEM_PROMPT).toContain('Group of 6 friends to Brazil');
    // canonical output values
    expect(STATIC_SYSTEM_PROMPT).toContain('travelerType: "couple"');
    expect(STATIC_SYSTEM_PROMPT).toContain('travelerType: "family"');
    expect(STATIC_SYSTEM_PROMPT).toContain('travelerType: "group"');
  });

  it('counter-examples cover both Spanish and English', () => {
    // Plain numeric count — both languages should NOT emit
    expect(STATIC_SYSTEM_PROMPT).toContain('Vuelo a Madrid para 2 adultos');
    expect(STATIC_SYSTEM_PROMPT).toContain('Flight to Madrid for 2 adults');
    // No traveler cue at all — multilingual
    expect(STATIC_SYSTEM_PROMPT).toContain('Quiero un vuelo a Miami');
    expect(STATIC_SYSTEM_PROMPT).toContain('Flight to Miami');
    expect(STATIC_SYSTEM_PROMPT).toContain('Voo para Miami');
  });
});

describe('TRAVELER TYPE — response schema', () => {
  it('PARSED_TRAVEL_REQUEST_SCHEMA exposes travelerType as a nullable enum', () => {
    const props = PARSED_TRAVEL_REQUEST_SCHEMA.properties as Record<string, unknown>;
    expect(props.travelerType).toBeDefined();
    const travelerType = props.travelerType as Record<string, unknown>;
    expect(travelerType.type).toEqual(['string', 'null']);
    expect(travelerType.enum).toEqual(['solo', 'couple', 'family', 'group', null]);
  });
});
