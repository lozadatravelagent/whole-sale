/**
 * Pure decision function for where a consumer-area page (signup / login)
 * should auto-redirect an already-authenticated user. Extracted for unit
 * testing without DOM, router, or auth mocks.
 *
 * Rules:
 *   - Loading → 'wait' (render spinner, no navigation yet).
 *   - No user → 'none' (stay on the current page and render the form).
 *   - Authenticated consumer on /emilia/signup or /emilia/login → 'chat'
 *     (already logged in, skip the form).
 *   - Authenticated agent on any /emilia/* public auth page → 'dashboard'
 *     (this is the B2C product; send them back to the B2B workspace).
 *   - Anything else → 'none'.
 */

export type AuthRedirectAction =
  | 'wait'
  | 'none'
  | 'chat'       // → /emilia/chat
  | 'dashboard'; // → /dashboard

export interface AuthRedirectInputs {
  loading: boolean;
  userPresent: boolean;
  isConsumer: boolean;
  isAgent: boolean;
}

export function decideAuthRedirectAction(inputs: AuthRedirectInputs): AuthRedirectAction {
  if (inputs.loading) return 'wait';
  if (!inputs.userPresent) return 'none';
  if (inputs.isConsumer) return 'chat';
  if (inputs.isAgent) return 'dashboard';
  return 'none';
}
