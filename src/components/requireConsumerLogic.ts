/**
 * Pure logic for RequireConsumer guard — extracted for unit testing.
 * The component in RequireConsumer.tsx is a thin React wrapper around this.
 */

export type RequireConsumerAction =
  | 'wait'        // Auth still loading, render spinner
  | 'redirect-login'  // Not authenticated, redirect to /login
  | 'redirect-home'   // Authenticated but not a consumer, redirect to /
  | 'render';     // Authenticated consumer, render children

export interface RequireConsumerInputs {
  loading: boolean;
  userPresent: boolean;
  isConsumer: boolean;
}

export function decideRequireConsumerAction(inputs: RequireConsumerInputs): RequireConsumerAction {
  if (inputs.loading) return 'wait';
  if (!inputs.userPresent) return 'redirect-login';
  if (!inputs.isConsumer) return 'redirect-home';
  return 'render';
}
