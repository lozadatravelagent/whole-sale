import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('should display login form with email and password fields', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('should login successfully and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#email').fill('agency2@agency.com');
    await page.locator('#password').fill('12345678');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page).toHaveURL(/\/(dashboard|chat|crm)/, { timeout: 15_000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#email').fill('wrong@email.com');
    await page.locator('#password').fill('badpassword');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    // Expect an error toast to appear
    await expect(page.getByText('Error en el login', { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('should redirect unauthenticated users from protected routes to login', async ({ page }) => {
    await page.goto('/chat');

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
