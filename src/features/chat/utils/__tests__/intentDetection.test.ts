import { describe, it, expect } from 'vitest';

import { isPriceChangeRequest } from '../intentDetection';

/**
 * Covers the two defects called out in
 * docs/superpowers/specs/2026-05-19-legacy-intent-gate-registry-design.md:
 *
 *  Defect 1 — relative-operator patterns `[-+]\s*\$?\s*(\d+)` matched the
 *             hyphen inside ISO dates like `2026-05-22`.
 *  Defect 2 — `isSearchRequest` only accepted single-word origins and missed
 *             ISO date ranges as a search signal.
 *
 * Tests are intentionally written against the public API (`isPriceChangeRequest`)
 * since `isSearchRequest` is an inline const, not exported.
 */
describe('isPriceChangeRequest — regex defect fixes', () => {
  describe('relative-operator anchoring (defect 1)', () => {
    it('does not match the "-<number>" pattern inside an ISO date', () => {
      // "2026-05-22" contains "-05" and "-22" — must not be treated as "-N"
      expect(isPriceChangeRequest('reunion el 2026-05-22')).toBe(false);
    });

    it('does not match a hyphen sandwiched between digits as a relative decrease', () => {
      // "100-50" is a code/range, not a "-50" adjustment
      expect(isPriceChangeRequest('codigo 100-50')).toBe(false);
    });

    it('still classifies a bare relative decrease ("-300") as a price change', () => {
      expect(isPriceChangeRequest('-300')).toBe(true);
    });

    it('still classifies a bare relative increase ("+500") as a price change', () => {
      expect(isPriceChangeRequest('+500')).toBe(true);
    });

    it('still classifies a relative decrease with a leading space ("bajalo -300")', () => {
      expect(isPriceChangeRequest('bajalo -300')).toBe(true);
    });
  });

  describe('isSearchRequest exclusion strengthening (defect 2)', () => {
    it('excludes flight searches whose origin is a multi-word city', () => {
      // "desde Buenos Aires a Madrid" — two-word origin must still be recognized
      expect(
        isPriceChangeRequest('buscar vuelo desde Buenos Aires a Madrid'),
      ).toBe(false);
    });

    it('excludes a flight-search phrase with a multi-word origin when no explicit search verb is present', () => {
      // Without a search verb, today's `desde \w+ a \w+` exclusion misses the
      // multi-word origin and the "bajale 500" tail wrongly classifies the
      // whole message as a price change. Fix: multi-word origin in the
      // `desde … (a|para|hasta)` exclusion clause.
      expect(
        isPriceChangeRequest('vuelo desde Buenos Aires a Madrid bajale 500'),
      ).toBe(false);
    });

    it('excludes messages whose pattern would otherwise match because of an ISO date range', () => {
      // Even a numeric "500" present, an ISO date range is a search signal
      expect(
        isPriceChangeRequest('vuelo del 2026-05-22 al 2026-05-29 por 500'),
      ).toBe(false);
    });
  });

  describe('real reproduction from the bug report', () => {
    it('does not classify the reported flight search as a price change', () => {
      const message =
        'vuelo a CUN del 2026-05-22 al 2026-05-29 saliendo desde Buenos Aires para 2 adulto';
      expect(isPriceChangeRequest(message)).toBe(false);
    });
  });
});
