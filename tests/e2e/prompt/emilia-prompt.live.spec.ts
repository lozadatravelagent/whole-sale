import { test, expect } from '@playwright/test';
import { callAiMessageParser, hasPromptApiConfig } from '../../helpers/prompt-api';
import { PROMPT_VERSION } from '../../../supabase/functions/ai-message-parser/prompt';

test.describe('Emilia Prompt Live Behavior', () => {
  test('@prompt-smoke should parse room type without implicitly adding meal plan', async ({ request }) => {
    test.skip(!hasPromptApiConfig(), 'Missing Supabase config for live parser tests');

    const res = await callAiMessageParser(
      request,
      'Quiero hotel en Cancún del 10 al 15 de abril, habitación doble para 2 personas',
    );

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    if (res.body?.meta?.promptVersion !== undefined) {
      expect(res.body.meta.promptVersion).toBe(PROMPT_VERSION);
    }
    expect(res.body?.parsed?.requestType).toBe('hotels');
    expect(res.body?.parsed?.hotels?.roomType).toBe('double');
    expect(res.body?.parsed?.hotels?.mealPlan).toBeUndefined();
  });

  test('@prompt-smoke should include meal plan only when explicitly requested', async ({ request }) => {
    test.skip(!hasPromptApiConfig(), 'Missing Supabase config for live parser tests');

    const res = await callAiMessageParser(
      request,
      'Quiero hotel en Cancún del 10 al 15 de abril, habitación doble con desayuno para 2 personas',
    );

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.parsed?.requestType).toBe('hotels');
    expect(res.body?.parsed?.hotels?.roomType).toBe('double');
    expect(res.body?.parsed?.hotels?.mealPlan).toBe('breakfast');
  });

  test('@prompt-smoke should extract multiple hotel chains as an array', async ({ request }) => {
    test.skip(!hasPromptApiConfig(), 'Missing Supabase config for live parser tests');

    const res = await callAiMessageParser(
      request,
      'Necesito hotel en Punta Cana del 10 al 15 de abril en cadena Riu y Iberostar, habitación doble',
    );

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.parsed?.requestType).toBe('hotels');

    const chains = res.body?.parsed?.hotels?.hotelChains || [];
    expect(Array.isArray(chains)).toBe(true);
    const lower = chains.map((c: string) => c.toLowerCase());
    expect(lower).toContain('riu');
    expect(lower).toContain('iberostar');
  });

  test('@prompt-smoke should not add luggage when user does not mention baggage', async ({ request }) => {
    test.skip(!hasPromptApiConfig(), 'Missing Supabase config for live parser tests');

    const res = await callAiMessageParser(
      request,
      'Quiero vuelo de Buenos Aires a Miami el 10 de abril para 2 adultos',
    );

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.parsed?.requestType).toBe('flights');
    expect(res.body?.parsed?.flights?.origin).toBeTruthy();
    expect(res.body?.parsed?.flights?.destination).toBeTruthy();
    expect(res.body?.parsed?.flights?.luggage).toBeUndefined();
  });

  test('@prompt-smoke should detect itinerary requests', async ({ request }) => {
    test.skip(!hasPromptApiConfig(), 'Missing Supabase config for live parser tests');

    const res = await callAiMessageParser(
      request,
      'Armame un itinerario de 5 días para Roma',
    );

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.parsed?.requestType).toBe('itinerary');
    expect(Array.isArray(res.body?.parsed?.itinerary?.destinations)).toBe(true);
    expect(res.body?.parsed?.itinerary?.days).toBe(5);
  });

  test('@prompt-full should reuse context for follow-up hotel request with "esas fechas"', async ({ request }) => {
    test.skip(!hasPromptApiConfig(), 'Missing Supabase config for live parser tests');

    const res = await callAiMessageParser(
      request,
      'También quiero hotel para esas fechas',
      {
        conversationHistory: [
          {
            role: 'user',
            content: 'Quiero vuelo de Buenos Aires a Cancún del 2026-03-15 al 2026-03-22 para 2 adultos',
            timestamp: '2026-02-16T15:00:00.000Z',
          },
          {
            role: 'assistant',
            content: 'Perfecto, busco vuelos para esas fechas.',
            timestamp: '2026-02-16T15:00:05.000Z',
          },
        ],
      },
    );

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.parsed?.requestType).toBe('hotels');
    expect(res.body?.parsed?.hotels?.checkinDate).toBe('2026-03-15');
    expect(res.body?.parsed?.hotels?.checkoutDate).toBe('2026-03-22');
  });

  test('@prompt-full should detect minors-only requests without inventing adults', async ({ request }) => {
    test.skip(!hasPromptApiConfig(), 'Missing Supabase config for live parser tests');

    const res = await callAiMessageParser(
      request,
      'Quiero un vuelo a Madrid para un menor',
    );

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.parsed?.requestType).toBe('flights');
    expect(res.body?.parsed?.flights?.adults).toBe(0);
    expect(res.body?.parsed?.flights?.children).toBeGreaterThanOrEqual(1);
  });

  test('@prompt-full should detect transfers and travel assistance only when explicitly requested', async ({ request }) => {
    test.skip(!hasPromptApiConfig(), 'Missing Supabase config for live parser tests');

    const res = await callAiMessageParser(
      request,
      'Quiero vuelo y hotel en Punta Cana del 10 al 15 de abril para 2 adultos con traslados y seguro de viaje',
    );

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.parsed?.requestType).toBe('combined');
    expect(res.body?.parsed?.transfers?.included).toBe(true);
    expect(res.body?.parsed?.travelAssistance?.included).toBe(true);
  });

  test('@prompt-full should keep hotel and flight dates aligned for round-trip combined requests', async ({ request }) => {
    test.skip(!hasPromptApiConfig(), 'Missing Supabase config for live parser tests');

    const res = await callAiMessageParser(
      request,
      'Quiero vuelo y hotel en Cancún del 15 al 22 de marzo para 2 adultos',
    );

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.parsed?.requestType).toBe('combined');
    expect(res.body?.parsed?.flights?.departureDate).toBeTruthy();
    expect(res.body?.parsed?.flights?.returnDate).toBeTruthy();
    expect(res.body?.parsed?.hotels?.checkinDate).toBe(res.body?.parsed?.flights?.departureDate);
    expect(res.body?.parsed?.hotels?.checkoutDate).toBe(res.body?.parsed?.flights?.returnDate);
  });
});
