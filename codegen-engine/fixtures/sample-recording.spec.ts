import { test, expect } from '@playwright/test';

test('sample recording', async ({ page }) => {
  await page.goto('https://example.com/');
  await expect(page).toHaveTitle(/Example Domain/);
  await page.getByRole('link', { name: 'More information...' }).click();
});
