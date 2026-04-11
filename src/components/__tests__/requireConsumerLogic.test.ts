import { describe, it, expect } from 'vitest';
import { decideRequireConsumerAction } from '../requireConsumerLogic';

describe('decideRequireConsumerAction', () => {
  it('returns "wait" when auth is still loading', () => {
    expect(
      decideRequireConsumerAction({ loading: true, userPresent: false, isConsumer: false })
    ).toBe('wait');

    expect(
      decideRequireConsumerAction({ loading: true, userPresent: true, isConsumer: true })
    ).toBe('wait');
  });

  it('returns "redirect-login" when not loading and no user', () => {
    expect(
      decideRequireConsumerAction({ loading: false, userPresent: false, isConsumer: false })
    ).toBe('redirect-login');
  });

  it('returns "redirect-home" when user is authenticated but not a consumer', () => {
    expect(
      decideRequireConsumerAction({ loading: false, userPresent: true, isConsumer: false })
    ).toBe('redirect-home');
  });

  it('returns "render" when user is an authenticated consumer', () => {
    expect(
      decideRequireConsumerAction({ loading: false, userPresent: true, isConsumer: true })
    ).toBe('render');
  });

  it('prioritizes loading over everything else', () => {
    // Even with a "valid" consumer, still wait while loading
    expect(
      decideRequireConsumerAction({ loading: true, userPresent: true, isConsumer: true })
    ).toBe('wait');
  });

  it('never renders for an agent (accountType !== consumer)', () => {
    const result = decideRequireConsumerAction({
      loading: false,
      userPresent: true,
      isConsumer: false,
    });
    expect(result).not.toBe('render');
    expect(result).toBe('redirect-home');
  });
});
