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

  it('STATIC_SYSTEM_PROMPT contains the OPERATIONAL ORDER section header', () => {
    expect(STATIC_SYSTEM_PROMPT).toMatch(
      /## OPERATIONAL ORDER — RESPECT WHAT THE USER SAID FIRST/,
    );
  });

  it('STATIC_SYSTEM_PROMPT names the productOrder field with allowed values', () => {
    expect(STATIC_SYSTEM_PROMPT).toContain('productOrder');
    expect(STATIC_SYSTEM_PROMPT).toContain('"flight"');
    expect(STATIC_SYSTEM_PROMPT).toContain('"hotel"');
    expect(STATIC_SYSTEM_PROMPT).toContain('"transfer"');
  });

  it('STATIC_SYSTEM_PROMPT carries the 5 worked examples that exemplify the rule', () => {
    // Hotel-first
    expect(STATIC_SYSTEM_PROMPT).toContain('hotel en Cancún, seguro necesito vuelos');
    expect(STATIC_SYSTEM_PROMPT).toContain('productOrder: ["hotel", "flight"]');
    // Flight-first
    expect(STATIC_SYSTEM_PROMPT).toContain('Vuelos a Cancún en julio y después hotel');
    expect(STATIC_SYSTEM_PROMPT).toContain('productOrder: ["flight", "hotel"]');
    // Three products in user-expressed order
    expect(STATIC_SYSTEM_PROMPT).toContain('traslado del aeropuerto al hotel');
    expect(STATIC_SYSTEM_PROMPT).toContain('productOrder: ["transfer", "hotel", "flight"]');
    // Paquete without expressed order → suppressed
    expect(STATIC_SYSTEM_PROMPT).toContain('Paquete a Punta Cana');
    expect(STATIC_SYSTEM_PROMPT).toContain('paquete sin orden expresado');
    // Single product → suppressed
    expect(STATIC_SYSTEM_PROMPT).toContain('Hotel Riu en Cancún');
    expect(STATIC_SYSTEM_PROMPT).toContain('solo un producto');
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
