import { test, expect } from '@playwright/test';
import { loginAndGoToChat, getChatInput } from '../../helpers/auth';
import { expectStructuredResults } from '../../helpers/workflow-ui';
import { callAiMessageParser, hasPromptApiConfig } from '../../helpers/prompt-api';

interface ParserRoutePayload {
  message?: string;
  prompt?: string;
  currentDate?: string;
  previousContext?: unknown;
  conversationHistory?: Array<{ role: string; content: string; timestamp: string }>;
}

interface ParsedTravelOutput {
  requestType?: string;
  flights?: { returnDate?: string };
  hotels?: { checkoutDate?: string };
}

test.describe('Workflow: Live Parser to UI Bridge', () => {
  test('@prompt-full should render structured UI results from live Emilia parser output', async ({ page, request }) => {
    test.setTimeout(180_000);
    test.skip(!hasPromptApiConfig(), 'Missing Supabase config for live parser tests');

    let parserCalls = 0;
    let starlingCalls = 0;
    let eurovipsCalls = 0;
    let latestParsed: ParsedTravelOutput | null = null;

    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/functions/v1/starling-flights')) {
        starlingCalls += 1;
      }
      if (url.includes('/functions/v1/eurovips-soap')) {
        eurovipsCalls += 1;
      }
    });

    await page.route('**/functions/v1/ai-message-parser', async (route) => {
      parserCalls += 1;

      let payload: ParserRoutePayload = {};
      try {
        const parsedBody: unknown = JSON.parse(route.request().postData() || '{}');
        if (parsedBody && typeof parsedBody === 'object') {
          payload = parsedBody as ParserRoutePayload;
        }
      } catch {
        payload = {};
      }

      const live = await callAiMessageParser(
        request,
        payload.message ?? payload.prompt ?? '',
        {
          currentDate: payload.currentDate,
          previousContext: payload.previousContext,
          conversationHistory: payload.conversationHistory,
        },
      );

      latestParsed = (live.body?.parsed as ParsedTravelOutput | undefined) ?? null;

      await route.fulfill({
        status: live.status,
        contentType: 'application/json',
        body: JSON.stringify(live.body ?? {
          success: false,
          error: 'Empty parser response body',
        }),
      });
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Quiero vuelo y hotel en Cancún del 15 al 22 de marzo para 2 adultos');
    await chatInput.press('Enter');

    await expect.poll(() => parserCalls, { timeout: 45_000 }).toBeGreaterThan(0);
    await expect.poll(() => starlingCalls, { timeout: 120_000 }).toBeGreaterThan(0);
    await expect.poll(() => eurovipsCalls, { timeout: 120_000 }).toBeGreaterThan(0);
    await expectStructuredResults(page, 120_000);
    await expect(page.getByTestId('results-tab-flights')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('results-tab-hotels')).toBeVisible({ timeout: 30_000 });

    expect(latestParsed?.requestType).toBe('combined');
    expect(latestParsed?.flights?.returnDate).toBeTruthy();
    expect(latestParsed?.hotels?.checkoutDate).toBe(latestParsed?.flights?.returnDate);
  });
});
