import { test, expect } from '@playwright/test';
import {
  buildSystemPrompt,
  PROMPT_CONTRACT_SNIPPETS,
  PROMPT_VERSION,
} from '../../../supabase/functions/ai-message-parser/prompt';
import { normalizeFlightRequest } from '../../../src/services/flightSegments';

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

  test('@prompt-smoke should document multi-city segments explicitly', async () => {
    const prompt = buildSystemPrompt({
      currentDate: '2026-02-27',
    });

    expect(prompt).toContain('MULTI-CITY FLIGHT SEGMENTS');
    expect(prompt).toContain('"tripType": "multi_city"');
    expect(prompt).toContain('"segments"');
  });

  test('@prompt-smoke should normalize multi-city flight requests without forcing returnDate', async () => {
    const normalized = normalizeFlightRequest({
      origin: 'Buenos Aires',
      destination: 'Madrid',
      departureDate: '2026-03-02',
      returnDate: '2026-03-15',
      segments: [
        {
          origin: 'Buenos Aires',
          destination: 'Madrid',
          departureDate: '2026-03-02',
        },
        {
          origin: 'Roma',
          destination: 'Buenos Aires',
          departureDate: '2026-03-15',
        },
      ],
      adults: 1,
      children: 0,
    });

    expect(normalized.tripType).toBe('multi_city');
    expect(normalized.returnDate).toBeUndefined();
    expect(normalized.segments).toHaveLength(2);
  });
});
