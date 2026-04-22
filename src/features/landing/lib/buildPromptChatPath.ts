/**
 * Builds the chat route path with a URL-encoded prompt query parameter.
 * Shared by PromptChip and InspirationCard so both entry points produce
 * identical destinations for the same prompt. The sessionStorage bridge
 * that consumes this query lives in EmiliaChatPage (see C6 of L1).
 */
export function buildPromptChatPath(prompt: string): string {
  return `/emilia/chat?prompt=${encodeURIComponent(prompt)}`;
}
