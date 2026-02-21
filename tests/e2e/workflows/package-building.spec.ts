import { test, expect } from '@playwright/test';
import { mockExternalAPIs, mockAIParser } from '../../helpers/mock-apis';
import { loginAndGoToChat, getChatInput } from '../../helpers/auth';
import { expectStructuredResults } from '../../helpers/workflow-ui';

test.describe('Workflow 1: Package Building', () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalAPIs(page);
  });

  test('should send a combined search message and display flight + hotel results', async ({ page }) => {
    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos y hotel en Cancún del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    await expect(page.getByText('Vuelos y hotel en Cancún del 15 al 22 de marzo, 2 adultos')).toBeVisible({ timeout: 5_000 });
    await expectStructuredResults(page);
  });

  test('should handle flight search timeout gracefully', async ({ page }) => {
    await page.route('**/functions/v1/starling-flights', (route) => {
      route.abort('timedout');
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos a Miami del 10 al 17 de abril');
    await chatInput.press('Enter');

    await expect(page.getByText('Vuelos a Miami del 10 al 17 de abril')).toBeVisible({ timeout: 5_000 });
  });

  test('should parse a flights-only request correctly', async ({ page }) => {
    await mockAIParser(page, {
      success: true,
      parsed: {
        requestType: 'flights',
        confidence: 0.98,
        flights: {
          origin: 'Buenos Aires',
          destination: 'Cancún',
          departureDate: '2026-04-10',
          returnDate: '2026-04-17',
          adults: 1,
          children: 0,
          infants: 0,
          stops: 'direct',
          cabinClass: 'economy',
        },
      },
      aiResponse: 'Busco vuelos directos a Cancún.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos directos a Cancún del 10 al 17 de abril');
    await chatInput.press('Enter');

    await expect(page.getByText('Vuelos directos a Cancún del 10 al 17 de abril')).toBeVisible({ timeout: 5_000 });
    await expectStructuredResults(page);
  });

  test('should parse a hotels-only request correctly', async ({ page }) => {
    await mockAIParser(page, {
      success: true,
      parsed: {
        requestType: 'hotels',
        confidence: 0.97,
        hotels: {
          city: 'Punta Cana',
          checkinDate: '2026-05-01',
          checkoutDate: '2026-05-08',
          adults: 2,
          children: 0,
          infants: 0,
          roomType: 'double',
          mealPlan: 'all_inclusive',
        },
      },
      aiResponse: 'Busco hoteles en Punta Cana.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Hotel all inclusive en Punta Cana del 1 al 8 de mayo, 2 adultos');
    await chatInput.press('Enter');

    await expect(page.getByText('Hotel all inclusive en Punta Cana del 1 al 8 de mayo, 2 adultos')).toBeVisible({ timeout: 5_000 });
    await expectStructuredResults(page);
  });

  test('should keep hotel-only request as hotels-only after a previous combined search in the same chat', async ({ page }) => {
    await page.unroute('**/functions/v1/ai-message-parser');

    let aiCalls = 0;
    await page.route('**/functions/v1/ai-message-parser', async (route) => {
      aiCalls += 1;

      const fixture = aiCalls === 1
        ? {
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
              infants: 0,
              roomType: 'double',
              mealPlan: 'all_inclusive',
            },
          },
          aiResponse: 'Busco vuelos y hotel para esas fechas.',
          timestamp: '2026-03-01T12:00:00.000Z',
        }
        : {
          success: true,
          parsed: {
            requestType: 'hotels',
            confidence: 0.97,
            hotels: {
              city: 'Punta Cana',
              checkinDate: '2026-03-15',
              checkoutDate: '2026-03-22',
              adults: 2,
              children: 0,
              infants: 0,
              roomType: 'double',
              mealPlan: 'all_inclusive',
            },
          },
          aiResponse: 'Busco hoteles all inclusive en Punta Cana.',
          timestamp: '2026-03-01T12:01:00.000Z',
        };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixture),
      });
    });

    let starlingRequests = 0;
    let hotelRequests = 0;
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/functions/v1/starling-flights')) {
        starlingRequests += 1;
      }
      if (url.includes('/functions/v1/eurovips-soap')) {
        hotelRequests += 1;
      }
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos y hotel en Cancún del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    await expect(page.getByText('Aeromexico').first()).toBeVisible({ timeout: 30_000 });
    expect(starlingRequests).toBeGreaterThan(0);
    expect(hotelRequests).toBeGreaterThan(0);

    const starlingRequestsAfterCombined = starlingRequests;
    const hotelRequestsAfterCombined = hotelRequests;
    const flightCardsAfterCombined = await page.locator('[data-testid^="flight-card-"]').count();

    const followUpInput = await getChatInput(page);
    await followUpInput.fill('Hotel all inclusive en Punta Cana del 15 al 22 de marzo, 2 adultos');
    await followUpInput.press('Enter');

    await expect(page.getByText('Hotel all inclusive en Punta Cana del 15 al 22 de marzo, 2 adultos')).toBeVisible({ timeout: 5_000 });
    await expect.poll(() => aiCalls, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => hotelRequests, { timeout: 30_000 }).toBeGreaterThan(hotelRequestsAfterCombined);

    // Hotel-only second turn must not trigger a new flights supplier request.
    await expect.poll(() => starlingRequests, { timeout: 5_000 }).toBe(starlingRequestsAfterCombined);

    const flightCardsAfterHotelOnly = await page.locator('[data-testid^="flight-card-"]').count();
    expect(flightCardsAfterHotelOnly).toBe(flightCardsAfterCombined);
    await expect(page.getByTestId('hotels-empty-state')).toHaveCount(0);
  });

  test('should render flight cards with airline name, airport codes, and price format', async ({ page }) => {
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
      aiResponse: 'Busco vuelos y hotel en Cancún del 15 al 22 de marzo.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos y hotel en Cancún del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    // Wait for flight cards to render (airline names from mock Starling data)
    await expect(page.getByText('Aeromexico').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('LATAM Airlines').first()).toBeVisible();

    // Verify departure/arrival airport codes from mock
    await expect(page.getByText('EZE').first()).toBeVisible();
    await expect(page.getByText('CUN').first()).toBeVisible();

    // Verify price element has currency format (US$ or USD)
    const priceElement = page.locator('.text-lg.font-bold.text-primary').first();
    await expect(priceElement).toBeVisible();
    const priceText = await priceElement.textContent();
    expect(priceText).toMatch(/US\$|USD/);
  });

  test('should render hotel tab in combined search results', async ({ page }) => {
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
      aiResponse: 'Busco vuelos y hotel en Punta Cana.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos y hotel en Punta Cana del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    // Wait for CombinedTravelSelector to render with flight data
    await expect(page.getByText('Aeromexico').first()).toBeVisible({ timeout: 30_000 });

    // Verify the Hotels tab exists and renders at least one real hotel card
    const hotelsTab = page.getByRole('tab', { name: /Hoteles/ });
    await expect(hotelsTab).toBeVisible();
    await hotelsTab.click();
    await expect(page.locator('[data-testid^="hotel-card-"]').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('hotels-empty-state')).toHaveCount(0);

    // Verify the Vuelos tab shows correct count from mock (2 fares)
    const flightsTab = page.getByRole('tab', { name: /Vuelos \(2\)/ });
    await expect(flightsTab).toBeVisible();
  });

  test('should show both Vuelos and Hoteles tabs in combined search', async ({ page }) => {
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
      aiResponse: 'Busco vuelos y hotel.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos y hotel en Punta Cana del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    // Wait for flight cards to render
    await expect(page.getByText('Aeromexico').first()).toBeVisible({ timeout: 30_000 });

    // Verify both tabs exist in combined selector
    await expect(page.getByRole('tab', { name: /Vuelos/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Hoteles/ })).toBeVisible();

    // Verify both airline flight cards rendered
    await expect(page.getByText('LATAM Airlines').first()).toBeVisible();
    await expect(page.getByText('Aeromexico').first()).toBeVisible();
  });

  test('should display flight departure and return dates from search', async ({ page }) => {
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
      aiResponse: 'Busco vuelos y hotel en Cancún del 15 al 22 de marzo.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos y hotel en Cancún del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    // Wait for flight cards to render
    await expect(page.getByText('Aeromexico').first()).toBeVisible({ timeout: 30_000 });

    // Verify departure date (2026-03-15) visible in flight card
    await expect(page.getByText('2026-03-15').first()).toBeVisible();

    // Verify return date (2026-03-22) visible in flight card
    await expect(page.getByText('2026-03-22').first()).toBeVisible();
  });

  test('should display timestamps on sent messages', async ({ page }) => {
    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Mensaje de prueba para verificar timestamp');
    await chatInput.press('Enter');

    await expect(page.getByText('Mensaje de prueba para verificar timestamp')).toBeVisible({ timeout: 5_000 });

    // Verify timestamp element with opacity-70 class exists on the sent message
    const timestamp = page.locator('.opacity-70').first();
    await expect(timestamp).toBeVisible({ timeout: 5_000 });

    // Verify timestamp contains time format (HH:MM)
    const tsText = await timestamp.textContent();
    expect(tsText).toMatch(/\d{1,2}:\d{2}/);
  });
});
