import type { Page } from '@playwright/test';

export async function login(
  page: Page,
  credentials: { username: string; password: string },
): Promise<void> {
  await page.goto('/login');
  await page.fill('[name="username"]', credentials.username);
  await page.fill('[name="password"]', credentials.password);
  await page.click('button[type="submit"]');
}

export async function navigate(page: Page, path: string): Promise<void> {
  await page.goto(path);
}

export async function waitForElement(page: Page, selector: string): Promise<void> {
  await page.locator(selector).waitFor({ state: 'visible' });
}

export async function fillForm(page: Page, fields: Record<string, string>): Promise<void> {
  for (const [selector, value] of Object.entries(fields)) {
    await page.fill(selector, value);
  }
}

export async function clickButton(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label }).click();
}

export async function assertToast(page: Page, message: string): Promise<void> {
  await page.getByText(message).waitFor({ state: 'visible' });
}

export async function assertVisible(page: Page, selector: string): Promise<void> {
  await page.locator(selector).waitFor({ state: 'visible' });
}
