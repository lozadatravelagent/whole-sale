import { test, expect, type Page } from '@playwright/test';
import { mockExternalAPIs, mockAIParser } from '../../helpers/mock-apis';
import { loginAndGoToChat, getChatInput } from '../../helpers/auth';
import { expectStructuredResults, getGeneratePdfButton, selectFirstFlight, selectFirstHotel } from '../../helpers/workflow-ui';
import fs from 'fs';
import path from 'path';

async function mockCombinedParser(page: Page) {
  await mockAIParser(page, {
    success: true,
    parsed: {
      requestType: 'combined',
      confidence: 0.96,
      flights: {
        origin: 'Buenos Aires',
        destination: 'Cancún',
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
    aiResponse: 'Busco vuelos y hotel para armar la cotización.',
    timestamp: '2026-03-01T12:00:00.000Z',
  });
}

test.describe('Workflow 4: PDF Generation', () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalAPIs(page);
  });

  test('should require selecting at least one flight/hotel before enabling Generar PDF', async ({ page }) => {
    let pdfRequestCount = 0;

    await page.route('**/api.pdfmonkey.io/**', async (route) => {
      pdfRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          documentId: 'doc-mock-001',
          downloadUrl: 'https://api.pdfmonkey.io/documents/doc-mock-001/download',
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

    const generatePdfButton = await getGeneratePdfButton(page);
    await expect(generatePdfButton).toBeDisabled();
    await expect.poll(() => pdfRequestCount).toBe(0);
  });

  test('should generate PDF only after selecting a flight and clicking Generar PDF', async ({ page }) => {
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
          documentId: 'doc-flight-001',
          downloadUrl: 'https://api.pdfmonkey.io/documents/doc-flight-001/download',
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

    const generatePdfButton = await getGeneratePdfButton(page);
    await expect(generatePdfButton).toBeEnabled();
    await generatePdfButton.click();

    await expect.poll(() => pdfRequestCount, { timeout: 20_000 }).toBeGreaterThan(0);
    expect(JSON.stringify(capturedPayload || {})).toMatch(/flight|selected_flights|EZE|CUN/i);
  });

  test('should generate PDF only after selecting a hotel and clicking Generar PDF', async ({ page }) => {
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
          documentId: 'doc-hotel-001',
          downloadUrl: 'https://api.pdfmonkey.io/documents/doc-hotel-001/download',
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

    const hotelsTab = page.getByTestId('results-tab-hotels');
    await expect(hotelsTab).toBeVisible({ timeout: 15_000 });
    await hotelsTab.click();

    await selectFirstHotel(page);

    const generatePdfButton = await getGeneratePdfButton(page);
    await expect(generatePdfButton).toBeEnabled();
    await generatePdfButton.click();

    await expect.poll(() => pdfRequestCount, { timeout: 20_000 }).toBeGreaterThan(0);
    expect(JSON.stringify(capturedPayload || {})).toMatch(/hotel|best_hotels|Punta Cana|Riu|Barcelo/i);
  });

  test('should always render structured results UI (not only chat text) before PDF flow', async ({ page }) => {
    await mockCombinedParser(page);
    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos y hotel en Punta Cana del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    await expect(page.getByText('Vuelos y hotel en Punta Cana del 15 al 22 de marzo, 2 adultos')).toBeVisible({ timeout: 10_000 });
    await expectStructuredResults(page);
  });

  test('should have disclaimer text in PDF templates', async () => {
    const templatesDir = path.resolve(process.cwd(), 'src/templates/pdf');
    const templateFiles = ['combined-flight-hotel.html', 'flights-multiple.html', 'flights-simple.html'];

    for (const file of templateFiles) {
      const filePath = path.join(templatesDir, file);
      const exists = fs.existsSync(filePath);
      expect(exists).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('sujeto a disponibilidad');
    }
  });
});
