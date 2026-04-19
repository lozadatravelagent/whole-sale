import { describe, it, expect } from 'vitest';
import { buildPromptChatPath } from '../lib/buildPromptChatPath';

describe('buildPromptChatPath', () => {
  it('uses /emilia/chat?prompt= as the base path', () => {
    expect(buildPromptChatPath('x')).toBe('/emilia/chat?prompt=x');
  });

  it('URL-encodes spaces', () => {
    expect(buildPromptChatPath('Plan Italy')).toBe(
      '/emilia/chat?prompt=Plan%20Italy',
    );
  });

  it('URL-encodes reserved URL characters', () => {
    expect(buildPromptChatPath('A&B=C?D#E')).toBe(
      '/emilia/chat?prompt=A%26B%3DC%3FD%23E',
    );
  });

  it('URL-encodes unicode accented characters', () => {
    expect(buildPromptChatPath('café')).toBe('/emilia/chat?prompt=caf%C3%A9');
  });

  it('URL-encodes emojis as percent-encoded UTF-8 bytes', () => {
    expect(buildPromptChatPath('🚀')).toBe('/emilia/chat?prompt=%F0%9F%9A%80');
  });

  it('URL-encodes newlines', () => {
    expect(buildPromptChatPath('a\nb')).toBe('/emilia/chat?prompt=a%0Ab');
  });

  it('returns an empty prompt query when input is an empty string (current behavior)', () => {
    expect(buildPromptChatPath('')).toBe('/emilia/chat?prompt=');
  });
});
