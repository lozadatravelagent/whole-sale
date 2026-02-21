import { test, expect } from '@playwright/test';
import { mockExternalAPIs, mockAIParser } from '../../helpers/mock-apis';
import { loginAndGoToChat, getChatInput } from '../../helpers/auth';
import { expectStructuredResults } from '../../helpers/workflow-ui';
import fs from 'fs';
import path from 'path';

const EUROVIPS_FIXTURE = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), 'tests/fixtures/mock-responses/eurovips-hotels.json'),
    'utf-8',
  ),
);

const STARLING_FIXTURE = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), 'tests/fixtures/mock-responses/starling-flights.json'),
    'utf-8',
  ),
);

test.describe('Workflow Hard Gate: Roundtrip Hotel Alignment', () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalAPIs(page);
  });

  test('should enforce hotel check-in/check-out to match round-trip flight dates before supplier search', async ({ page }) => {
    let capturedHotelRequest: any = null;

    await page.route('**/functions/v1/eurovips-soap', async (route) => {
      try {
        capturedHotelRequest = JSON.parse(route.request().postData() || '{}');
      } catch {
        capturedHotelRequest = null;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EUROVIPS_FIXTURE),
      });
    });

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
          checkinDate: '2026-03-14',
          checkoutDate: '2026-03-24',
          adults: 2,
          children: 0,
          roomType: 'double',
          mealPlan: 'all_inclusive',
        },
      },
      aiResponse: 'Busco vuelos y hotel ida y vuelta para esas fechas.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos y hotel ida y vuelta del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    await expect.poll(() => capturedHotelRequest, { timeout: 20_000 }).not.toBeNull();
    await expectStructuredResults(page);

    expect(capturedHotelRequest?.data?.cityCode).toBe('CUN');
    expect(capturedHotelRequest?.data?.checkinDate).toBe('2026-03-15');
    expect(capturedHotelRequest?.data?.checkoutDate).toBe('2026-03-22');
    expect(capturedHotelRequest?.data?.cityCode).not.toBe('PUJ');
    expect(capturedHotelRequest?.data?.checkoutDate).not.toBe('2026-03-24');
  });

  test('should align combined flight and hotel destination to the destination explicitly mentioned by the user', async ({ page }) => {
    let capturedHotelRequest: any = null;
    let capturedFlightRequest: any = null;

    await page.route('**/functions/v1/eurovips-soap', async (route) => {
      try {
        capturedHotelRequest = JSON.parse(route.request().postData() || '{}');
      } catch {
        capturedHotelRequest = null;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EUROVIPS_FIXTURE),
      });
    });

    await page.route('**/functions/v1/starling-flights', async (route) => {
      try {
        capturedFlightRequest = JSON.parse(route.request().postData() || '{}');
      } catch {
        capturedFlightRequest = null;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(STARLING_FIXTURE),
      });
    });

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
      aiResponse: 'Busco vuelos y hotel para Punta Cana.',
      timestamp: '2026-03-01T12:00:00.000Z',
    });

    await loginAndGoToChat(page);
    const chatInput = await getChatInput(page);

    await chatInput.fill('Vuelos y hotel en Punta Cana del 15 al 22 de marzo, 2 adultos');
    await chatInput.press('Enter');

    await expect.poll(() => capturedHotelRequest, { timeout: 20_000 }).not.toBeNull();
    await expect.poll(() => capturedFlightRequest, { timeout: 20_000 }).not.toBeNull();
    await expectStructuredResults(page);

    const outboundLeg = capturedFlightRequest?.data?.Legs?.[0];
    expect(outboundLeg?.ArrivalAirportCity).toBe('PUJ');
    expect(outboundLeg?.ArrivalAirportCity).not.toBe('CUN');

    expect(capturedHotelRequest?.data?.cityCode).toBe('PUJ');
    expect(capturedHotelRequest?.data?.cityCode).not.toBe('CUN');
  });
});
