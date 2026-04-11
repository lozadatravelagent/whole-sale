import { describe, it, expect } from 'vitest';
import { decideAuthRedirectAction } from '../utils/authRedirectDecider';

describe('decideAuthRedirectAction', () => {
  it('returns "wait" when auth is still loading', () => {
    expect(
      decideAuthRedirectAction({
        loading: true,
        userPresent: false,
        isConsumer: false,
        isAgent: false,
      })
    ).toBe('wait');
  });

  it('returns "none" when no user is authenticated', () => {
    expect(
      decideAuthRedirectAction({
        loading: false,
        userPresent: false,
        isConsumer: false,
        isAgent: false,
      })
    ).toBe('none');
  });

  it('returns "chat" when an authenticated consumer hits an auth page', () => {
    expect(
      decideAuthRedirectAction({
        loading: false,
        userPresent: true,
        isConsumer: true,
        isAgent: false,
      })
    ).toBe('chat');
  });

  it('returns "dashboard" when an authenticated agent hits a B2C auth page', () => {
    expect(
      decideAuthRedirectAction({
        loading: false,
        userPresent: true,
        isConsumer: false,
        isAgent: true,
      })
    ).toBe('dashboard');
  });

  it('prioritizes loading over any other state', () => {
    expect(
      decideAuthRedirectAction({
        loading: true,
        userPresent: true,
        isConsumer: true,
        isAgent: false,
      })
    ).toBe('wait');
  });

  it('returns "none" for authenticated user with no account type flags set', () => {
    expect(
      decideAuthRedirectAction({
        loading: false,
        userPresent: true,
        isConsumer: false,
        isAgent: false,
      })
    ).toBe('none');
  });
});
