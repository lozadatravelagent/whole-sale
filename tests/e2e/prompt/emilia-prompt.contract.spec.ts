import { test, expect } from '@playwright/test';
import {
  buildSystemPrompt,
  PROMPT_CONTRACT_SNIPPETS,
  PROMPT_VERSION,
} from '../../../supabase/functions/ai-message-parser/prompt';

test.describe('Emilia Prompt Contract', () => {
  test('@prompt-smoke should expose a versioned prompt builder', async () => {
    expect(PROMPT_VERSION).toBeTruthy();
    expect(PROMPT_VERSION).toMatch(/^emilia-parser-v\d+$/);
    expect(typeof buildSystemPrompt).toBe('function');
  });

  test('@prompt-smoke should include all hard-gate contract snippets', async () => {
    const prompt = buildSystemPrompt({
      currentDate: '2026-02-17',
      conversationHistoryText: 'user: necesito hotel',
      previousContext: { requestType: 'flights' },
    });

    for (const snippet of PROMPT_CONTRACT_SNIPPETS) {
      expect(prompt).toContain(snippet);
    }
  });

  test('@prompt-smoke should inject dynamic context blocks when provided', async () => {
    const prompt = buildSystemPrompt({
      currentDate: '2026-02-17',
      conversationHistoryText: 'user: vuelo a madrid',
      previousContext: { flights: { origin: 'EZE', destination: 'MAD' } },
    });

    expect(prompt).toContain('FECHA ACTUAL: 2026-02-17');
    expect(prompt).toContain('CONVERSATION HISTORY:');
    expect(prompt).toContain('PREVIOUS CONTEXT:');
  });
});

