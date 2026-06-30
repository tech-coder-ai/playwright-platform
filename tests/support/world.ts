import { Before, After, setWorldConstructor, setDefaultTimeout, World, IWorldOptions } from '@cucumber/cucumber';
import { chromium, Browser, BrowserContext, Page } from '@playwright/test';

setDefaultTimeout(60_000);

export class PlaywrightWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  popup?: Page;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(PlaywrightWorld);

Before(async function () {
  const headless = process.env['PW_HEADLESS'] !== 'false';
  this.browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 250,
    args: ['--disable-http2'],
  });
  this.context = await this.browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-IN',
  });
  this.page = await this.context.newPage();
});

After(async function () {
  await this.context?.close();
  await this.browser?.close();
});
