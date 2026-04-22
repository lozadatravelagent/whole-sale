import { describe, expect, it } from 'vitest';
import { deriveDefaultMode } from '../utils/deriveDefaultMode';

describe('deriveDefaultMode', () => {
  it('agent with agency_id → agency', () => {
    expect(deriveDefaultMode({ accountType: 'agent', agency_id: 'agency-1' })).toBe('agency');
  });

  it('agent without agency_id (null) → passenger', () => {
    expect(deriveDefaultMode({ accountType: 'agent', agency_id: null })).toBe('passenger');
  });

  it('agent without agency_id (undefined) → passenger', () => {
    expect(deriveDefaultMode({ accountType: 'agent' })).toBe('passenger');
  });

  it('consumer → passenger (defensive; caller should not invoke for consumer)', () => {
    expect(deriveDefaultMode({ accountType: 'consumer', agency_id: null })).toBe('passenger');
    expect(deriveDefaultMode({ accountType: 'consumer', agency_id: 'irrelevant' })).toBe('passenger');
  });

  it('null/undefined user → passenger (defensive)', () => {
    expect(deriveDefaultMode(null)).toBe('passenger');
    expect(deriveDefaultMode(undefined)).toBe('passenger');
  });

  it('empty string agency_id is falsy → passenger', () => {
    expect(deriveDefaultMode({ accountType: 'agent', agency_id: '' })).toBe('passenger');
  });
});
