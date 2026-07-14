import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestOpenAiChatCompletion } from '../llm/openaiChat';

describe('requestOpenAiChatCompletion', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('aborts a stalled OpenAI request at the configured deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));

    const request = requestOpenAiChatCompletion({
      apiKey: 'test-key',
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: 'hola' }],
      maxTokens: 100,
      timeoutMs: 100,
    });
    const rejection = expect(request).rejects.toThrow('timed out after 100ms');

    await vi.advanceTimersByTimeAsync(100);
    await rejection;
  });
});
