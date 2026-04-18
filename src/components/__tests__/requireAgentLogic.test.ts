import { describe, it, expect } from 'vitest';
import { decideRequireAgentAction } from '../requireAgentLogic';

describe('decideRequireAgentAction', () => {
  it('returns "wait" when auth is still loading', () => {
    expect(
      decideRequireAgentAction({ loading: true, userPresent: false, isAgent: false })
    ).toBe('wait');

    expect(
      decideRequireAgentAction({ loading: true, userPresent: true, isAgent: true })
    ).toBe('wait');
  });

  it('returns "redirect-login" when not loading and no user', () => {
    expect(
      decideRequireAgentAction({ loading: false, userPresent: false, isAgent: false })
    ).toBe('redirect-login');
  });

  it('returns "redirect-chat" when user is authenticated but not an agent', () => {
    expect(
      decideRequireAgentAction({ loading: false, userPresent: true, isAgent: false })
    ).toBe('redirect-chat');
  });

  it('returns "render" when user is an authenticated agent', () => {
    expect(
      decideRequireAgentAction({ loading: false, userPresent: true, isAgent: true })
    ).toBe('render');
  });

  it('prioritizes loading over everything else', () => {
    // Even with a "valid" agent, still wait while loading
    expect(
      decideRequireAgentAction({ loading: true, userPresent: true, isAgent: true })
    ).toBe('wait');
  });
});
