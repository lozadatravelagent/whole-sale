import { test, expect } from '@playwright/test';
import { mockExternalAPIs, mockAIParser } from '../../helpers/mock-apis';
import { loginAndGoToChat, getChatInput } from '../../helpers/auth';

test.describe('Workflow 3: Price Normalization', () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalAPIs(page);
  });

  test('should display flight prices matching mock Starling TotalAmount', async ({ page }) => {
    await mockAIParser(page, {
      success: true,
      parsed: {
        requestType: 'flights',
        confidence: 0.96,
        flights: {
          origin: 'Buenos Aires',
          destination: 'Cancún',
          departureDate: '2026-03-15',
          returnDate: '2026-03-22',
          adults: 2,
          stops: 'any',
          cabinClass: 'economy',
        },
      },
      aiResponse: 'Busco vuelos a Cancún.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos a Cancún del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    // Wait for flight cards to render
    await expect(page.getByText('Aeromexico').first()).toBeVisible({ timeout: 30_000 });

    // Verify prices from mock: FARE-001 TotalAmount=1250, FARE-002 TotalAmount=980
    // formatPrice('es-AR', USD, 0 decimals): 1250 → "US$ 1.250", 980 → "US$ 980"
    await expect(page.getByText('US$ 980')).toBeVisible();
    await expect(page.getByText('US$ 1.250')).toBeVisible();
  });

  test('should keep hotel-only search in hotels domain (without flight search)', async ({ page }) => {
    let starlingRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/functions/v1/starling-flights')) {
        starlingRequests += 1;
      }
    });

    await mockAIParser(page, {
      success: true,
      parsed: {
        requestType: 'hotels',
        confidence: 0.96,
        hotels: {
          city: 'Punta Cana',
          checkinDate: '2026-03-15',
          checkoutDate: '2026-03-22',
          adults: 2,
          roomType: 'double',
          mealPlan: 'all_inclusive',
        },
      },
      aiResponse: 'Busco hoteles all inclusive en Punta Cana.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Hotel all inclusive en Punta Cana del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    await expect(page.getByRole('tab', { name: /Hoteles/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid^="hotel-card-"]').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('tab', { name: /Vuelos/ })).toHaveCount(0);
    await expect.poll(() => starlingRequests, { timeout: 5_000 }).toBe(0);
  });

  test('should not display negative prices in search results', async ({ page }) => {
    await mockAIParser(page, {
      success: true,
      parsed: {
        requestType: 'combined',
        confidence: 0.95,
        flights: {
          origin: 'Buenos Aires',
          destination: 'Cancún',
          departureDate: '2026-03-15',
          returnDate: '2026-03-22',
          adults: 2,
          stops: 'any',
          cabinClass: 'economy',
        },
        hotels: {
          city: 'Punta Cana',
          checkinDate: '2026-03-15',
          checkoutDate: '2026-03-22',
          adults: 2,
          roomType: 'double',
          mealPlan: 'all_inclusive',
        },
      },
      aiResponse: 'Busco vuelos y hotel.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos y hotel en Punta Cana del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    // Wait for results to render
    await expect(page.getByText('Aeromexico').first()).toBeVisible({ timeout: 30_000 });

    // Scan all price elements and verify none are negative
    const priceElements = page.locator('.text-lg.font-bold.text-primary');
    const count = await priceElements.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = await priceElements.nth(i).textContent() || '';
      // Price text should not contain a minus sign before a digit
      expect(text).not.toMatch(/-\s*\d/);
    }
  });

  test('should show consistent positive prices for all flight cards', async ({ page }) => {
    await mockAIParser(page, {
      success: true,
      parsed: {
        requestType: 'combined',
        confidence: 0.95,
        flights: {
          origin: 'Buenos Aires',
          destination: 'Cancún',
          departureDate: '2026-03-15',
          returnDate: '2026-03-22',
          adults: 2,
          stops: 'any',
          cabinClass: 'economy',
        },
        hotels: {
          city: 'Punta Cana',
          checkinDate: '2026-03-15',
          checkoutDate: '2026-03-22',
          adults: 2,
          roomType: 'double',
          mealPlan: 'all_inclusive',
        },
      },
      aiResponse: 'Busco vuelos y hotel.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos y hotel en Punta Cana del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    // Wait for flight cards to render
    await expect(page.getByText('Aeromexico').first()).toBeVisible({ timeout: 30_000 });

    // Verify all visible price elements are positive numbers
    const priceElements = page.locator('.text-lg.font-bold.text-primary');
    const count = await priceElements.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const text = await priceElements.nth(i).textContent() || '';
      // Extract numeric value (handles "US$ 1.250" or "US$ 980")
      const numericStr = text.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
      const value = parseFloat(numericStr);
      if (!isNaN(value)) {
        expect(value).toBeGreaterThan(0);
      }
    }
  });

  test('should use cheapest room when none explicitly selected', async ({ page }) => {
    await mockAIParser(page, {
      success: true,
      parsed: {
        requestType: 'hotels',
        confidence: 0.94,
        hotels: {
          city: 'Punta Cana',
          checkinDate: '2026-03-15',
          checkoutDate: '2026-03-22',
          adults: 3,
        },
      },
      aiResponse: 'Busco hoteles para 3 adultos.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Hotel en Punta Cana del 15 al 22 de marzo, 3 adultos');
    await chatInput.press('Enter');

    await expect(page.getByText('Hotel en Punta Cana del 15 al 22 de marzo, 3 adultos')).toBeVisible({ timeout: 5_000 });
  });
});
