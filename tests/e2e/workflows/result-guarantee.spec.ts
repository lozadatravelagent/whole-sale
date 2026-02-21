import { test, expect, type Page } from '@playwright/test';
import { mockExternalAPIs, mockAIParser } from '../../helpers/mock-apis';
import { loginAndGoToChat, getChatInput } from '../../helpers/auth';
import { expectStructuredResults } from '../../helpers/workflow-ui';
import fs from 'fs';
import path from 'path';

const EMPTY_FLIGHTS_FIXTURE = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), 'tests/fixtures/mock-responses/workflow-hard-gate/starling-flights-empty.json'),
    'utf-8',
  ),
);

const DEFAULT_FLIGHTS_FIXTURE = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), 'tests/fixtures/mock-responses/starling-flights.json'),
    'utf-8',
  ),
);

async function mockFlightsOnlyParser(page: Page) {
  await mockAIParser(page, {
    success: true,
    parsed: {
      requestType: 'flights',
      confidence: 0.95,
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
        departureDate: '2026-03-15',
        returnDate: '2026-03-22',
        adults: 2,
        children: 0,
        infants: 0,
        stops: 'direct',
        cabinClass: 'economy',
      },
    },
    aiResponse: 'Busco vuelos directos para esas fechas.',
    timestamp: '2026-03-01T12:00:00.000Z',
  });
}

test.describe('Workflow Hard Gate: Results Guarantee', () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalAPIs(page);
  });

  test('should retry with broadened criteria when first flights response is empty and then render result cards', async ({ page }) => {
    let starlingCalls = 0;

    await page.route('**/functions/v1/starling-flights', async (route) => {
      starlingCalls += 1;
      const body = starlingCalls === 1 ? EMPTY_FLIGHTS_FIXTURE : DEFAULT_FLIGHTS_FIXTURE;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    await mockFlightsOnlyParser(page);
    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos directos a Cancún del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    await expect.poll(() => starlingCalls, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    await expectStructuredResults(page);
    await expect(page.locator('[data-testid^="flight-card-"]').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('flights-empty-state')).toHaveCount(0);
  });

  test('should never accept zero-result UI after retry (no empty-state rendering)', async ({ page }) => {
    let starlingCalls = 0;

    await page.route('**/functions/v1/starling-flights', async (route) => {
      starlingCalls += 1;
      const body = starlingCalls === 1 ? EMPTY_FLIGHTS_FIXTURE : DEFAULT_FLIGHTS_FIXTURE;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    await mockFlightsOnlyParser(page);
    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos directos a Cancún del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    await expect.poll(() => starlingCalls, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    await expectStructuredResults(page);
    await expect(page.locator('[data-testid^="flight-card-"]').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('flights-empty-state')).toHaveCount(0);
  });
});
