import { type Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/mock-responses');

function loadFixture(name: string) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8'));
}

function applyRequestedAirportCodes(
  fixture: Record<string, unknown>,
  originCode?: string,
  destinationCode?: string,
) {
  if (!originCode || !destinationCode) {
    return fixture;
  }

  const cloned = JSON.parse(JSON.stringify(fixture));

  const rewrite = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(rewrite);
      return;
    }

    if (!value || typeof value !== 'object') {
      return;
    }

    for (const [key, current] of Object.entries(value)) {
      if (typeof current === 'string') {
        // Fixture baseline uses EZE/CUN as endpoints; rewrite to requested route.
        if (current === 'EZE') {
          (value as Record<string, unknown>)[key] = originCode;
        } else if (current === 'CUN') {
          (value as Record<string, unknown>)[key] = destinationCode;
        }
      } else {
        rewrite(current);
      }
    }
  };

  rewrite(cloned);
  return cloned;
}

/** Mock the AI message parser (OpenAI via Supabase Edge Function) */
export async function mockAIParser(page: Page, overrides?: Record<string, unknown>) {
  const fixture = { ...loadFixture('openai-parser.json'), ...overrides };

  await page.route('**/functions/v1/ai-message-parser', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    });
  });
}

/** Mock Starling flights search (via Supabase Edge Function) */
export async function mockStarlingFlights(page: Page, overrides?: Record<string, unknown>) {
  const fixture = { ...loadFixture('starling-flights.json'), ...overrides };

  await page.route('**/functions/v1/starling-flights', (route) => {
    let originCode: string | undefined;
    let destinationCode: string | undefined;

    try {
      const requestBody = JSON.parse(route.request().postData() || '{}');
      const legs = requestBody?.data?.Legs || requestBody?.data?.requestParams?.Legs || [];
      originCode = legs?.[0]?.DepartureAirportCity;
      destinationCode = legs?.[0]?.ArrivalAirportCity;
    } catch {
      originCode = undefined;
      destinationCode = undefined;
    }

    const responseFixture = applyRequestedAirportCodes(fixture, originCode, destinationCode);

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseFixture),
    });
  });
}

/** Mock EUROVIPS hotel search (via Supabase Edge Function) */
export async function mockEurovipsHotels(page: Page, overrides?: Record<string, unknown>) {
  const fixture = { ...loadFixture('eurovips-hotels.json'), ...overrides };

  await page.route('**/functions/v1/eurovips-soap', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    });
  });
}

/** Mock PDFMonkey document generation */
export async function mockPDFMonkey(page: Page, overrides?: Record<string, unknown>) {
  const fixture = { ...loadFixture('pdfmonkey-document.json'), ...overrides };

  await page.route('**/api.pdfmonkey.io/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    });
  });
}

/** Mock only external service APIs (uses real Supabase auth & data) */
export async function mockExternalAPIs(page: Page) {
  await mockAIParser(page);
  await mockStarlingFlights(page);
  await mockEurovipsHotels(page);
  await mockPDFMonkey(page);
}
