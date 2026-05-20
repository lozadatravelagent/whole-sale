import { describe, it, expect, vi } from 'vitest';

import {
  LEGACY_INTENT_GATES,
  runGates,
  runLegacyIntentGates,
  type GateContext,
  type LegacyIntentGate,
} from '../legacyIntentGates';

/**
 * The registry under test. Spec:
 *   docs/superpowers/specs/2026-05-19-legacy-intent-gate-registry-design.md
 *
 * Two surfaces are exercised:
 *
 *   1. `runGates` — the pure runner. Tested with synthetic gates so the
 *      algorithm (matches × precondition → handled / fallthrough, declared
 *      order, async-precondition support) is verified independently of the
 *      real production gates.
 *
 *   2. `LEGACY_INTENT_GATES` + `runLegacyIntentGates` — the real registry.
 *      The "characteristic call" of each gate's run body
 *      (handleCheaperFlightsSearch / handleHotelSearch / handlePriceChangeRequest)
 *      is asserted via spies on the GateContext to confirm which gate
 *      handled — without re-testing the imported handlers themselves.
 */

function makeStubCtx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    conversationId: 'conv-1',
    message: '',
    lastPdfAnalysis: null,
    loadContextState: vi.fn().mockResolvedValue(null),
    setMessage: vi.fn(),
    setIsLoading: vi.fn(),
    setIsTyping: vi.fn(),
    setTypingMessage: vi.fn(),
    typingCopy: {
      changingPrice: 'changingPrice',
      generatingPdf: 'generatingPdf',
    } as GateContext['typingCopy'],
    addOptimisticMessage: vi.fn(),
    saveAndDisplayMessage: vi.fn().mockResolvedValue({}),
    handleCheaperFlightsSearch: vi.fn().mockResolvedValue('cheaper flights result'),
    handlePriceChangeRequest: vi
      .fn()
      .mockResolvedValue({ response: 'price change ok', modifiedPdfUrl: undefined }),
    handleHotelSearch: vi.fn().mockResolvedValue({ response: 'hotel ok', data: {} }),
    saveContextualMemory: vi.fn().mockResolvedValue(undefined),
    detectHotelPreferencesFromMessage: vi
      .fn()
      .mockReturnValue({ hotelChains: [], roomType: undefined, mealPlan: undefined }),
    searchStayNights: 3,
    userLanguage: 'es',
    toast: vi.fn(),
    t: (k: string) => k,
    ...overrides,
  };
}

function makeGate(
  name: LegacyIntentGate['name'],
  matches: boolean,
  precondition: boolean | Promise<boolean>,
): LegacyIntentGate & { run: ReturnType<typeof vi.fn> } {
  const run = vi.fn().mockResolvedValue('handled' as const);
  return {
    name,
    matches: () => matches,
    precondition: () => precondition,
    run,
  };
}

describe('runGates (runner contract)', () => {
  it('returns "fallthrough" when no gates are registered', async () => {
    const result = await runGates([], 'anything', makeStubCtx());
    expect(result).toBe('fallthrough');
  });

  it('returns "fallthrough" when no gate matches', async () => {
    const gateA = makeGate('cheaper_flights', false, true);
    const gateB = makeGate('add_hotel', false, true);
    const result = await runGates([gateA, gateB], 'msg', makeStubCtx());
    expect(result).toBe('fallthrough');
    expect(gateA.run).not.toHaveBeenCalled();
    expect(gateB.run).not.toHaveBeenCalled();
  });

  it('runs the first matching gate when its precondition passes', async () => {
    const gateA = makeGate('cheaper_flights', true, true);
    const gateB = makeGate('add_hotel', true, true);
    const result = await runGates([gateA, gateB], 'msg', makeStubCtx());
    expect(result).toBe('handled');
    expect(gateA.run).toHaveBeenCalledOnce();
    expect(gateB.run).not.toHaveBeenCalled();
  });

  it('falls through to the next gate when matched gate\'s precondition fails (silent)', async () => {
    // Key behavior change: cheaper_flights and price_change today swallow /
    // dead-end when their preconditions are unmet. The spec generalizes
    // add_hotel's silent fall-through to all gates.
    const gateA = makeGate('cheaper_flights', true, false);
    const gateB = makeGate('add_hotel', true, true);
    const result = await runGates([gateA, gateB], 'msg', makeStubCtx());
    expect(result).toBe('handled');
    expect(gateA.run).not.toHaveBeenCalled();
    expect(gateB.run).toHaveBeenCalledOnce();
  });

  it('returns "fallthrough" when every matched gate has a failing precondition', async () => {
    const gateA = makeGate('cheaper_flights', true, false);
    const gateB = makeGate('price_change', true, false);
    const result = await runGates([gateA, gateB], 'msg', makeStubCtx());
    expect(result).toBe('fallthrough');
    expect(gateA.run).not.toHaveBeenCalled();
    expect(gateB.run).not.toHaveBeenCalled();
  });

  it('supports async preconditions', async () => {
    const gateA = makeGate('add_hotel', true, Promise.resolve(true));
    const result = await runGates([gateA], 'msg', makeStubCtx());
    expect(result).toBe('handled');
    expect(gateA.run).toHaveBeenCalledOnce();
  });

  it('treats run\'s "fallthrough" return as a soft fall-through to Emilia', async () => {
    // Refines spec's Promise<void>: a gate that internally caught a soft
    // error (today: add_hotel) signals fallthrough so Emilia takes over.
    const gateA: LegacyIntentGate = {
      name: 'add_hotel',
      matches: () => true,
      precondition: () => true,
      run: vi.fn().mockResolvedValue('fallthrough' as const),
    };
    const result = await runGates([gateA], 'msg', makeStubCtx());
    expect(result).toBe('fallthrough');
  });

  it('continues to later gates after run signals "fallthrough"', async () => {
    const gateA: LegacyIntentGate = {
      name: 'add_hotel',
      matches: () => true,
      precondition: () => true,
      run: vi.fn().mockResolvedValue('fallthrough' as const),
    };
    const gateB = makeGate('price_change', true, true);
    const result = await runGates([gateA, gateB], 'msg', makeStubCtx());
    expect(result).toBe('handled');
    expect(gateB.run).toHaveBeenCalledOnce();
  });
});

describe('LEGACY_INTENT_GATES (real registry)', () => {
  it('exports the three gates in the declared order', () => {
    expect(LEGACY_INTENT_GATES.map((g) => g.name)).toEqual([
      'cheaper_flights',
      'add_hotel',
      'price_change',
    ]);
  });

  describe('the real bug message', () => {
    const bugMessage =
      'vuelo a CUN del 2026-05-22 al 2026-05-29 saliendo desde Buenos Aires para 2 adulto';

    it('falls through with no PDF and no flight context', async () => {
      const ctx = makeStubCtx({ lastPdfAnalysis: null });
      const result = await runLegacyIntentGates(bugMessage, ctx);
      expect(result).toBe('fallthrough');
      expect(ctx.handleCheaperFlightsSearch).not.toHaveBeenCalled();
      expect(ctx.handlePriceChangeRequest).not.toHaveBeenCalled();
      expect(ctx.handleHotelSearch).not.toHaveBeenCalled();
    });

    it('falls through even when a PDF exists for this conversation', async () => {
      // After the regex fix, the bug message no longer matches any gate's
      // matches() — Emilia must handle it regardless of PDF state.
      const ctx = makeStubCtx({ lastPdfAnalysis: { conversationId: 'conv-1' } });
      const result = await runLegacyIntentGates(bugMessage, ctx);
      expect(result).toBe('fallthrough');
    });
  });

  describe('cheaper_flights gate', () => {
    const msg = 'buscar vuelos mas baratos';

    it('handles when the PDF belongs to the current conversation', async () => {
      const ctx = makeStubCtx({ lastPdfAnalysis: { conversationId: 'conv-1' } });
      const result = await runLegacyIntentGates(msg, ctx);
      expect(result).toBe('handled');
      expect(ctx.handleCheaperFlightsSearch).toHaveBeenCalledWith(msg);
    });

    it('falls through silently when no PDF exists (no swallowed message)', async () => {
      const ctx = makeStubCtx({ lastPdfAnalysis: null });
      const result = await runLegacyIntentGates(msg, ctx);
      expect(result).toBe('fallthrough');
      expect(ctx.handleCheaperFlightsSearch).not.toHaveBeenCalled();
    });

    it('falls through when the PDF belongs to a different conversation', async () => {
      const ctx = makeStubCtx({ lastPdfAnalysis: { conversationId: 'other-conv' } });
      const result = await runLegacyIntentGates(msg, ctx);
      expect(result).toBe('fallthrough');
      expect(ctx.handleCheaperFlightsSearch).not.toHaveBeenCalled();
    });
  });

  describe('add_hotel gate', () => {
    const msg = 'agrega un hotel';

    it('handles when persistent flight context exists', async () => {
      const ctx = makeStubCtx({
        loadContextState: vi.fn().mockResolvedValue({
          lastSearch: {
            flightsParams: {
              origin: 'EZE',
              destination: 'CUN',
              departureDate: '2026-05-22',
              returnDate: '2026-05-29',
              adults: 2,
              children: 0,
              infants: 0,
            },
          },
        }),
      });
      const result = await runLegacyIntentGates(msg, ctx);
      expect(result).toBe('handled');
      expect(ctx.handleHotelSearch).toHaveBeenCalled();
    });

    it('falls through silently when no persistent flight context (today\'s behavior preserved)', async () => {
      const ctx = makeStubCtx({ loadContextState: vi.fn().mockResolvedValue(null) });
      const result = await runLegacyIntentGates(msg, ctx);
      expect(result).toBe('fallthrough');
      expect(ctx.handleHotelSearch).not.toHaveBeenCalled();
    });

    it('falls through when the run body errors internally (preserves today\'s catch + fall-through)', async () => {
      // Today, useMessageHandler.ts:903–906 catches errors inside the
      // add_hotel branch and lets Emilia take over. Same intent here.
      const ctx = makeStubCtx({
        loadContextState: vi.fn().mockResolvedValue({
          lastSearch: {
            flightsParams: {
              origin: 'EZE',
              destination: 'CUN',
              departureDate: '2026-05-22',
              adults: 2,
            },
          },
        }),
        handleHotelSearch: vi.fn().mockRejectedValue(new Error('boom')),
      });
      const result = await runLegacyIntentGates(msg, ctx);
      expect(result).toBe('fallthrough');
    });
  });

  describe('price_change gate', () => {
    const msg = 'cambia el precio total a 500';

    it('handles when the PDF belongs to the current conversation', async () => {
      const ctx = makeStubCtx({ lastPdfAnalysis: { conversationId: 'conv-1' } });
      const result = await runLegacyIntentGates(msg, ctx);
      expect(result).toBe('handled');
      expect(ctx.handlePriceChangeRequest).toHaveBeenCalledWith(msg);
    });

    it('falls through silently when no PDF exists (no more "❌ No hay PDF analizado" dead-end)', async () => {
      const ctx = makeStubCtx({ lastPdfAnalysis: null });
      const result = await runLegacyIntentGates(msg, ctx);
      expect(result).toBe('fallthrough');
      expect(ctx.handlePriceChangeRequest).not.toHaveBeenCalled();
    });
  });
});
