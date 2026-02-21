import { test, expect, type Page } from '@playwright/test';
import { mockExternalAPIs, mockAIParser } from '../../helpers/mock-apis';
import { loginAndGoToChat, getChatInput } from '../../helpers/auth';
import { expectStructuredResults, getGeneratePdfButton, selectFirstFlight, selectFirstHotel } from '../../helpers/workflow-ui';

async function mockCombinedParser(page: Page) {
  await mockAIParser(page, {
    success: true,
    parsed: {
      requestType: 'combined',
      confidence: 0.96,
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancun',
        departureDate: '2026-03-15',
        returnDate: '2026-03-22',
        adults: 2,
        children: 0,
        infants: 0,
        stops: 'any',
        cabinClass: 'economy',
      },
      hotels: {
        city: 'Punta Cana',
        checkinDate: '2026-03-15',
        checkoutDate: '2026-03-22',
        adults: 2,
        children: 0,
        roomType: 'double',
        mealPlan: 'all_inclusive',
      },
    },
    aiResponse: 'Busco vuelos y hotel para armar la cotizacion.',
    timestamp: '2026-03-01T12:00:00.000Z',
  });
}

test.describe('Temp check: PDF 1 flight + 1 hotel', () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalAPIs(page);
  });

  test('should send combined payload with 1 selected flight and 1 selected hotel', async ({ page }) => {
    let capturedPayload: any = null;
    let pdfRequestCount = 0;

    await page.route('**/api.pdfmonkey.io/**', async (route) => {
      pdfRequestCount += 1;
      try {
        capturedPayload = JSON.parse(route.request().postData() || '{}');
      } catch {
        capturedPayload = null;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          documentId: 'doc-combined-001',
          downloadUrl: 'https://api.pdfmonkey.io/documents/doc-combined-001/download',
          status: 'success',
        }),
      });
    });

    await mockCombinedParser(page);
    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos y hotel en Punta Cana del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    await expectStructuredResults(page);

    await selectFirstFlight(page);

    const hotelsTab = page.getByTestId('results-tab-hotels');
    await expect(hotelsTab).toBeVisible({ timeout: 15_000 });
    await hotelsTab.click();
    await selectFirstHotel(page);

    const generatePdfButton = await getGeneratePdfButton(page);
    await expect(generatePdfButton).toBeEnabled();
    await generatePdfButton.click();

    await expect.poll(() => pdfRequestCount, { timeout: 20_000 }).toBeGreaterThan(0);

    const requestDoc = capturedPayload?.document;
    const requestPayload = requestDoc?.payload;

    expect(requestDoc?.document_template_id).toBeTruthy();
    expect(requestDoc?.meta?._filename).toMatch(/^viaje-combinado-cotizacion-/);

    expect(Array.isArray(requestPayload?.selected_flights)).toBe(true);
    expect(Array.isArray(requestPayload?.best_hotels)).toBe(true);
    expect(requestPayload?.selected_flights?.length).toBe(1);
    expect(requestPayload?.best_hotels?.length).toBe(1);
    expect(requestPayload?.has_flights).toBe(true);
    expect(requestPayload?.total_price).toBeTruthy();
  });
});
