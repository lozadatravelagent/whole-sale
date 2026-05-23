/**
 * Contract tests for the OPERATIONAL ORDER section of the parser prompt.
 *
 * The product spec (Emilia / Vibook §9) requires that when the user mentions
 * multiple travel products, the parser captures the order the user expressed
 * and the downstream UI/response respect it. This is implemented as:
 *
 *   - A dedicated `OPERATIONAL ORDER` section in the static system prompt.
 *   - A `productOrder?: ('flight'|'hotel'|'transfer')[]` field on
 *     ParsedTravelRequest, surfaced in the response schema.
 *   - UI render-order in CombinedTravelSelector honoring `combinedData.productOrder`.
 *
 * These tests pin the contract at the prompt level so a future edit cannot
 * silently drop the rule.
 */

import { describe, expect, it } from 'vitest';

import {
  PROMPT_CONTRACT_SNIPPETS,
  STATIC_SYSTEM_PROMPT,
} from '../prompt.ts';
import { PARSED_TRAVEL_REQUEST_SCHEMA } from '../responseSchema.ts';

describe('OPERATIONAL ORDER — contract', () => {
  it('PROMPT_CONTRACT_SNIPPETS lists "OPERATIONAL ORDER"', () => {
    expect(PROMPT_CONTRACT_SNIPPETS).toContain('OPERATIONAL ORDER');
  });

  it('STATIC_SYSTEM_PROMPT contains the language-agnostic OPERATIONAL ORDER section', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(
      /## OPERATIONAL ORDER — RESPECT WHAT THE USER SAID FIRST \(LANGUAGE-AGNOSTIC\)/,
    );
  });

  it('STATIC_SYSTEM_PROMPT names the productOrder field with allowed values', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('productOrder');
    expect(STATIC_SYSTEM_PROMPT).toContain('"flight"');
    expect(STATIC_SYSTEM_PROMPT).toContain('"hotel"');
    expect(STATIC_SYSTEM_PROMPT).toContain('"transfer"');
  });

  it('instructs the LLM to detect ORDER SEMANTICALLY across languages', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'detect ORDER SEMANTICALLY across languages',
    );
    expect(STATIC_SYSTEM_PROMPT).toContain(
      'The output array uses canonical English values',
    );
  });

  it('carries multilingual worked examples for hotel-first order', () => {
    // Spanish
    expect(STATIC_SYSTEM_PROMPT).toContain('hotel en Cancún, seguro necesito vuelos');
    // English
    expect(STATIC_SYSTEM_PROMPT).toContain("I want a hotel in Cancun, I'll also need flights");
    // Portuguese
    expect(STATIC_SYSTEM_PROMPT).toContain('Quero hotel em Cancún, e também voos');
    // canonical output appears at least once after these examples
    expect(STATIC_SYSTEM_PROMPT).toContain('productOrder: ["hotel", "flight"]');
  });

  it('carries multilingual worked examples for flight-first order', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('Vuelos a Cancún en julio y después hotel');
    expect(STATIC_SYSTEM_PROMPT).toContain('Flights to Cancun in July and then an all-inclusive hotel');
    expect(STATIC_SYSTEM_PROMPT).toContain('productOrder: ["flight", "hotel"]');
  });

  it('carries multilingual examples for three-product order (transfer→hotel→flight)', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('traslado del aeropuerto al hotel');
    expect(STATIC_SYSTEM_PROMPT).toContain('Airport-to-hotel transfer, plus hotel and flights');
    expect(STATIC_SYSTEM_PROMPT).toContain('productOrder: ["transfer", "hotel", "flight"]');
  });

  it('umbrella-word counter-examples cover both Spanish and English', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('Paquete a Punta Cana con vuelo, hotel y traslados');
    expect(STATIC_SYSTEM_PROMPT).toContain('Package to Punta Cana with flight, hotel and transfer');
    expect(STATIC_SYSTEM_PROMPT).toContain('umbrella word');
  });

  it('single-product counter-example covers all three supported languages', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('Hotel Riu en Cancún');
    expect(STATIC_SYSTEM_PROMPT).toContain('Riu hotel in Cancun');
    expect(STATIC_SYSTEM_PROMPT).toContain('Hotel Riu em Cancún');
    expect(STATIC_SYSTEM_PROMPT).toContain('only one product');
  });

  it('classic flight→hotel→transfer assumption is explicitly forbidden', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(
      /DO NOT assume the classic order flight → hotel → transfer/,
    );
  });
});

describe('OPERATIONAL ORDER — response schema', () => {
  it('PARSED_TRAVEL_REQUEST_SCHEMA exposes productOrder as a nullable string array', () => {
    const props = PARSED_TRAVEL_REQUEST_SCHEMA.properties as Record<string, unknown>;
    expect(props.productOrder).toBeDefined();
    const productOrder = props.productOrder as Record<string, unknown>;
    expect(productOrder.type).toEqual(['array', 'null']);

    const items = productOrder.items as Record<string, unknown>;
    expect(items.type).toBe('string');
    expect(items.enum).toEqual(['flight', 'hotel', 'transfer']);
  });
});

describe('INTENT ELICITATION — response schema', () => {
  it('searchSeeds exposes optional elicitation fields without changing required fields', () => {
    const props = PARSED_TRAVEL_REQUEST_SCHEMA.properties as Record<string, unknown>;
    const searchSeeds = props.searchSeeds as Record<string, unknown>;
    expect(searchSeeds).toBeDefined();
    expect(searchSeeds.required).toEqual(['productsImplied']);

    const seedProps = searchSeeds.properties as Record<string, Record<string, unknown>>;
    const destinationKind = seedProps.destinationKind;
    const dateWindow = seedProps.dateWindow as { properties: Record<string, Record<string, unknown>> };
    const missingDecision = seedProps.missingDecision as { items: Record<string, unknown> };
    expect(destinationKind.enum).toEqual(['city', 'region', 'country', 'vibe', null]);
    expect(dateWindow.properties.kind.enum).toEqual(['exact', 'month', 'default', 'missing']);
    expect(seedProps.agencyLanguageSignals.type).toBe('array');
    expect(seedProps.softPreferences.type).toBe('array');
    expect(missingDecision.items.enum).toEqual([
      'destination',
      'passengers',
      'dates',
      'product',
      'budget',
      'origin',
    ]);
  });
});
