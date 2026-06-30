import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

Given('the user is on the NSE India homepage', async function () {
  await this.page.goto('https://www.nseindia.com/', {
    waitUntil: 'commit',
    timeout: 60_000,
  });
  await this.page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => undefined);
});

When('the user opens Most Active Equities under Market Data', async function () {
  await this.page.getByRole('link', { name: 'Market Data' }).click();
  await this.page.getByRole('menuitem', { name: 'Most Active Equities' }).click();
});

Then('HDFC Bank should be visible in the list', async function () {
  await expect(this.page.getByRole('link', { name: 'HDFCBANK' })).toBeVisible({
    timeout: 15_000,
  });
});
