export type ChatMode = 'agency' | 'passenger';

export interface DeriveDefaultModeUser {
  accountType?: 'agent' | 'consumer' | null;
  agency_id?: string | null;
}

// PR 3 (C5): derives the initial chat mode for an agent user based on the
// AuthContext shape. Consumers never see the ModeSwitch — this util is
// defensive for them and returns 'passenger' so the signature is safe to
// invoke unconditionally. In practice ChatFeature only passes `chatMode` to
// `useMessageHandler` when `accountType === 'agent'`; consumers fall to the
// orchestrator's legacy path regardless of the derived value.
export function deriveDefaultMode(user: DeriveDefaultModeUser | null | undefined): ChatMode {
  if (!user) return 'passenger';
  if (user.accountType === 'agent' && user.agency_id) return 'agency';
  return 'passenger';
}
