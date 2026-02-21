import { type Page, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'agency2@agency.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || '12345678';

export async function loginAs(
  page: Page,
  email: string = TEST_EMAIL,
  password: string = TEST_PASSWORD,
) {
  await page.goto('/login');

  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page).toHaveURL(/\/(dashboard|chat|crm)/, { timeout: 15_000 });
}

/**
 * Login and navigate to chat page.
 * Returns the chat input locator (EmptyState or MessageInput).
 */
export async function loginAndGoToChat(page: Page) {
  await loginAs(page);
  await page.goto('/chat');

  // Wait for either the EmptyState input or the active conversation input
  const emptyStateInput = page.getByPlaceholder('Pregunta lo que quieras...');
  const messageInput = page.locator('#chat-message-input');

  await expect(emptyStateInput.or(messageInput)).toBeVisible({ timeout: 15_000 });
}

/** Get whichever chat input is currently visible */
export async function getChatInput(page: Page) {
  const emptyStateInput = page.getByPlaceholder('Pregunta lo que quieras...');
  const messageInput = page.locator('#chat-message-input');

  if (await emptyStateInput.isVisible()) return emptyStateInput;
  return messageInput;
}
