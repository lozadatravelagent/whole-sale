/**
 * Pure logic for RequireAgent guard — extracted for unit testing.
 * The component in RequireAgent.tsx is a thin React wrapper around this.
 */

export type RequireAgentAction =
  | 'wait'             // Auth still loading, render spinner
  | 'redirect-login'   // Not authenticated, redirect to /login
  | 'redirect-chat'    // Authenticated but not an agent (consumer), redirect to /emilia/chat
  | 'render';          // Authenticated agent, render children

export interface RequireAgentInputs {
  loading: boolean;
  userPresent: boolean;
  isAgent: boolean;
}

export function decideRequireAgentAction(inputs: RequireAgentInputs): RequireAgentAction {
  if (inputs.loading) return 'wait';
  if (!inputs.userPresent) return 'redirect-login';
  if (!inputs.isAgent) return 'redirect-chat';
  return 'render';
}
