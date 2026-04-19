/**
 * Contract for the "pending prompt" bridge between the landing and the chat
 * feature: the landing (PromptChip, InspirationCard) writes the user's chosen
 * prompt to sessionStorage right before navigating to /emilia/chat; the chat
 * feature's useChatState hook consumes (reads + clears) the value at mount
 * and preloads it into the chat input.
 *
 * SessionStorage is used instead of the URL query because Login.tsx discards
 * the location.search when redirecting after authentication (it reads only
 * state.from.pathname), which would lose ?prompt=... in the anonymous flow.
 * sessionStorage survives the /login round trip as long as the tab stays
 * open, which is the exact lifetime we need.
 *
 * Contract owner: the landing. Consumer: the chat feature's useChatState.
 * The import direction (chat -> landing) is an exception justified by this
 * ownership: the landing defines the protocol.
 */
const STORAGE_KEY = 'emilia:pendingPrompt';

/**
 * Write the pending prompt to sessionStorage. Silently no-ops if storage is
 * unavailable (SSR, privacy mode, quota, etc.).
 */
export function writePendingPrompt(prompt: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, prompt);
  } catch {
    // sessionStorage unavailable -- no-op, the landing will still navigate.
  }
}

/**
 * Read + clear the pending prompt. Returns the normalized (trimmed, non-empty)
 * value if present, otherwise null. After this call the key is removed so the
 * prompt is not replayed on subsequent mounts or refreshes.
 */
export function consumePendingPrompt(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (typeof raw !== 'string') return null;
    window.sessionStorage.removeItem(STORAGE_KEY);
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export { STORAGE_KEY as PENDING_PROMPT_STORAGE_KEY };
