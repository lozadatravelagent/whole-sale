import { test, expect, type Page } from '@playwright/test';
import { mockExternalAPIs, mockAIParser } from '../../helpers/mock-apis';
import { loginAndGoToChat } from '../../helpers/auth';
import { expectStructuredResults } from '../../helpers/workflow-ui';
import path from 'path';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/pdfs');
const ASSISTANT_PDF_RESPONSE_PATTERN = /An[aá]lisis de tu Cotizaci[oó]n|PDF Analizado - Datos Manuales Requeridos|Error analizando PDF/i;
const USER_PDF_UPLOAD_MESSAGE_PATTERN = /He subido el PDF\s+"[^"]+"/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function startNewChat(page: Page) {
  const newChatButton = page.getByRole('button', { name: /Nuevo Chat/i });
  await expect(newChatButton).toBeVisible({ timeout: 10_000 });

  const conversationCreateRequest = page
    .waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/conversations') &&
        response.request().method() === 'POST' &&
        response.ok(),
      { timeout: 20_000 },
    )
    .catch(() => null);

  await newChatButton.click();
  await conversationCreateRequest;

  const fileInput = page.locator('input[type="file"][accept=".pdf"]');
  await expect(fileInput).toBeAttached({ timeout: 10_000 });
}

async function uploadPdfAndAssertChatExchange(page: Page, fixtureFile: string) {
  const fileInput = page.locator('input[type="file"][accept=".pdf"]');
  await expect(fileInput).toBeAttached({ timeout: 5_000 });

  const uploadMessagePattern = new RegExp(`He subido el PDF\\s+"${escapeRegExp(fixtureFile)}"`, 'i');
  const allUploadMessagesBefore = await page.getByText(USER_PDF_UPLOAD_MESSAGE_PATTERN).count();
  const fileUploadMessagesBefore = await page.getByText(uploadMessagePattern).count();
  const assistantMessagesBefore = await page.getByText(ASSISTANT_PDF_RESPONSE_PATTERN).count();

  await fileInput.setInputFiles(path.join(FIXTURES_DIR, fixtureFile));

  await expect
    .poll(async () => page.getByText(USER_PDF_UPLOAD_MESSAGE_PATTERN).count(), { timeout: 20_000 })
    .toBeGreaterThan(allUploadMessagesBefore);

  await expect
    .poll(async () => page.getByText(uploadMessagePattern).count(), { timeout: 20_000 })
    .toBeGreaterThan(fileUploadMessagesBefore);

  await expect
    .poll(async () => page.getByText(ASSISTANT_PDF_RESPONSE_PATTERN).count(), { timeout: 45_000 })
    .toBeGreaterThan(assistantMessagesBefore);

  return {
    allUploadMessagesAfter: await page.getByText(USER_PDF_UPLOAD_MESSAGE_PATTERN).count(),
    assistantMessagesAfter: await page.getByText(ASSISTANT_PDF_RESPONSE_PATTERN).count(),
  };
}

test.describe('Workflow 2: PDF Re-quote', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await mockExternalAPIs(page);
  });

  test('should show PDF upload button in chat', async ({ page }) => {
    await loginAndGoToChat(page);
    await startNewChat(page);

    const fileInput = page.locator('input[type="file"][accept=".pdf"]');
    await expect(fileInput).toBeAttached({ timeout: 5_000 });
  });

  test('should upload a PDF and trigger extraction', async ({ page }) => {
    await mockAIParser(page, {
      success: true,
      parsed: {
        requestType: 'combined',
        confidence: 0.90,
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
          city: 'Cancún',
          checkinDate: '2026-03-15',
          checkoutDate: '2026-03-22',
          adults: 2,
          children: 0,
          roomType: 'double',
          mealPlan: 'all_inclusive',
        },
      },
      aiResponse: 'He detectado un vuelo EZE-CUN del 15 al 22 de marzo y hotel en Cancún All Inclusive.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    await startNewChat(page);

    await uploadPdfAndAssertChatExchange(page, 'combined-itinerary.pdf');
  });

  test('should display confirmation message after PDF upload', async ({ page }) => {
    await mockAIParser(page, {
      success: true,
      parsed: {
        requestType: 'combined',
        confidence: 0.92,
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
          city: 'Cancún',
          checkinDate: '2026-03-15',
          checkoutDate: '2026-03-22',
          adults: 2,
          children: 0,
          roomType: 'double',
          mealPlan: 'all_inclusive',
        },
      },
      aiResponse: 'He detectado un vuelo EZE-CUN del 15 al 22 de marzo para 2 adultos y hotel All Inclusive en Cancún.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    await startNewChat(page);

    await uploadPdfAndAssertChatExchange(page, 'combined-itinerary.pdf');
  });

  test('should show search results after PDF upload and follow-up user request', async ({ page }) => {
    await mockAIParser(page, {
      success: true,
      parsed: {
        requestType: 'combined',
        confidence: 0.90,
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
          city: 'Cancún',
          checkinDate: '2026-03-15',
          checkoutDate: '2026-03-22',
          adults: 2,
          children: 0,
          roomType: 'double',
          mealPlan: 'all_inclusive',
        },
      },
      aiResponse: 'Detecté vuelo EZE-CUN y hotel. Buscando mejores opciones...',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    await startNewChat(page);

    await uploadPdfAndAssertChatExchange(page, 'search-trigger-itinerary.pdf');
    const chatInput = page.locator('#chat-message-input');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    await chatInput.fill('Vuelos y hotel en Cancún del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    await expectStructuredResults(page);
  });

  test('should handle multi-hotel PDF with Economic/Premium detection', async ({ page }) => {
    await mockAIParser(page, {
      success: true,
      parsed: {
        requestType: 'combined',
        confidence: 0.88,
        flights: {
          origin: 'Buenos Aires',
          destination: 'Punta Cana',
          departureDate: '2026-04-01',
          returnDate: '2026-04-08',
          adults: 2,
          stops: 'any',
        },
        hotels: {
          city: 'Punta Cana',
          checkinDate: '2026-04-01',
          checkoutDate: '2026-04-08',
          adults: 2,
          roomType: 'double',
          mealPlan: 'all_inclusive',
        },
      },
      aiResponse: 'Detecté 2 hoteles: opción económica (Riu Bambu) y premium (Barceló Bávaro Palace).',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    await startNewChat(page);

    await uploadPdfAndAssertChatExchange(page, 'multi-hotel-itinerary.pdf');
    const chatInput = page.locator('#chat-message-input');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    await chatInput.fill('Vuelos y hotel en Punta Cana del 1 al 8 de abril, 2 adultos');
    await chatInput.press('Enter');

    await expectStructuredResults(page);
  });

  test('should wait for Emilia response before processing a second PDF in the same chat', async ({ page }) => {
    await loginAndGoToChat(page);
    await startNewChat(page);

    const firstCycle = await uploadPdfAndAssertChatExchange(page, 'combined-itinerary.pdf');
    const secondCycle = await uploadPdfAndAssertChatExchange(page, 'multi-hotel-itinerary.pdf');

    expect(secondCycle.allUploadMessagesAfter).toBeGreaterThan(firstCycle.allUploadMessagesAfter);
    expect(secondCycle.assistantMessagesAfter).toBeGreaterThan(firstCycle.assistantMessagesAfter);
  });

  test('should support one PDF upload-response cycle per new chat', async ({ page }) => {
    await loginAndGoToChat(page);

    await startNewChat(page);
    await uploadPdfAndAssertChatExchange(page, 'combined-itinerary.pdf');

    await startNewChat(page);
    await expect(page.getByText(new RegExp(escapeRegExp('combined-itinerary.pdf'), 'i'))).toHaveCount(0);
    await uploadPdfAndAssertChatExchange(page, 'search-trigger-itinerary.pdf');
  });
});
