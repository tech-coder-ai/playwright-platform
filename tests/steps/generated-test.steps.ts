import { Given, When, Then } from '@cucumber/cucumber';
import { Page } from '@playwright/test';
import { navigate } from '../helpers';
import { MSNPage } from '../page-objects/generated-test.page';

Given('the user is on the MSN India homepage', async function () {
  const page = this.page as Page;
  await navigate(page, 'https://www.msn.com/en-in');
});

When('the user clicks on the {string} link', async function (linkName: string) {
  const page = this.page as Page;
  const msnPage = new MSNPage(page);
  const popupPromise = page.waitForEvent('popup');
  await msnPage.clickLinkByText(linkName);
  this.popup = await popupPromise;
});

Then('a new page with heading containing {string} should be visible', async function (expectedHeading: string) {
  const popup = this.popup as Page;
  await popup.getByRole('heading', { name: new RegExp(expectedHeading, 'i') }).waitFor({
    state: 'visible',
    timeout: 15_000,
  });
});
