import { describe, expect, it } from 'vitest';
import { resolveEffectiveMode } from '@/features/chat/utils/resolveEffectiveMode';

describe('resolveEffectiveMode (C7.1.a)', () => {
  // The core regression guard: when a bridge chip handler just called
  // setChatMode, React hasn't re-rendered yet, so the closure-captured
  // chatMode is still the pre-click value. The override must win.
  it('override wins when it is agency, even if fallback is passenger', () => {
    expect(resolveEffectiveMode('agency', 'passenger')).toBe('agency');
  });

  it('override wins when it is passenger, even if fallback is agency', () => {
    expect(resolveEffectiveMode('passenger', 'agency')).toBe('passenger');
  });

  it('falls back to closure chatMode when override is undefined', () => {
    expect(resolveEffectiveMode(undefined, 'agency')).toBe('agency');
    expect(resolveEffectiveMode(undefined, 'passenger')).toBe('passenger');
  });

  it('returns undefined when both are undefined (consumer legacy path)', () => {
    // Consumer chats don't pass chatMode — orchestrator falls to its
    // legacy routing. Override left undefined must preserve that.
    expect(resolveEffectiveMode(undefined, undefined)).toBeUndefined();
  });

  it('override wins even over an undefined fallback', () => {
    expect(resolveEffectiveMode('agency', undefined)).toBe('agency');
  });
});
