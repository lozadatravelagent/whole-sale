import { expect, type Page } from '@playwright/test';

/**
 * Hard-gate assertion:
 * a workflow must render structured results UI with at least one real result card,
 * not only assistant text.
 */
export async function expectStructuredResults(page: Page, timeout: number = 30_000) {
  const tabsOrSelectors = page.getByTestId('results-tabs')
    .or(page.getByRole('tab', { name: /Vuelos/i }))
    .or(page.getByRole('tab', { name: /Hoteles/i }));

  await expect(tabsOrSelectors.first()).toBeVisible({ timeout });

  const flightCards = page.locator('[data-testid^="flight-card-"]');
  const hotelCards = page.locator('[data-testid^="hotel-card-"]');

  await expect.poll(
    async () => (await flightCards.count()) + (await hotelCards.count()),
    { timeout },
  ).toBeGreaterThan(0);

  await expect(page.getByTestId('flights-empty-state')).toHaveCount(0);
  await expect(page.getByTestId('hotels-empty-state')).toHaveCount(0);
}

export async function selectFirstFlight(page: Page) {
  const flightCheckbox = page.locator('[data-testid^="select-flight-"]').first();
  await expect(flightCheckbox).toBeVisible({ timeout: 30_000 });
  await flightCheckbox.click();
}

export async function selectFirstHotel(page: Page) {
  const hotelCheckbox = page.locator('[data-testid^="select-hotel-"]').first();
  await expect(hotelCheckbox).toBeVisible({ timeout: 30_000 });
  await hotelCheckbox.click();
}

export async function getGeneratePdfButton(page: Page) {
  const button = page.getByTestId('generate-pdf-button');
  await expect(button).toBeVisible({ timeout: 30_000 });
  return button;
}
