import {
  Before,
  After,
  AfterStep,
  setWorldConstructor,
  setDefaultTimeout,
  Status,
  World,
  IWorldOptions,
} from '@cucumber/cucumber';
import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

setDefaultTimeout(60_000);

export class PlaywrightWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  popup?: Page;
  stepIndex = 0;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(PlaywrightWorld);

function screenshotEnabled(): boolean {
  return process.env['PW_SCREENSHOT'] !== 'off';
}

function screenshotEveryStep(): boolean {
  return process.env['PW_SCREENSHOT'] === 'on';
}

function videoEnabled(): boolean {
  return process.env['PW_VIDEO'] !== 'off';
}

function videoDir(): string | undefined {
  return process.env['PW_VIDEO_DIR'];
}

function screenshotDir(): string | undefined {
  return process.env['PW_SCREENSHOT_DIR'];
}

Before(async function () {
  const headless = process.env['PW_HEADLESS'] !== 'false';
  this.stepIndex = 0;
  this.browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 250,
    args: ['--disable-http2'],
  });

  const contextOptions: Parameters<Browser['newContext']>[0] = {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-IN',
  };

  const dir = videoDir();
  if (videoEnabled() && dir) {
    await fs.mkdir(dir, { recursive: true });
    contextOptions.recordVideo = { dir, size: { width: 1280, height: 720 } };
  }

  this.context = await this.browser.newContext(contextOptions);
  this.page = await this.context.newPage();
});

AfterStep(async function () {
  if (!screenshotEveryStep()) return;
  const dir = screenshotDir();
  if (!dir || !this.page) return;

  this.stepIndex += 1;
  await fs.mkdir(dir, { recursive: true });
  await this.page.screenshot({
    path: path.join(dir, `step-${String(this.stepIndex).padStart(2, '0')}.png`),
    fullPage: true,
  });
});

After(async function ({ result }) {
  const failed = result?.status === Status.FAILED;

  if (failed && screenshotEnabled() && !screenshotEveryStep() && this.page) {
    const dir = screenshotDir();
    if (dir) {
      await fs.mkdir(dir, { recursive: true });
      await this.page.screenshot({
        path: path.join(dir, 'failure.png'),
        fullPage: true,
      });
    }
  }

  const saveVideo =
    videoEnabled() &&
    this.page &&
    (process.env['PW_VIDEO'] === 'on' || (process.env['PW_VIDEO'] === 'on-failure' && failed));

  if (saveVideo) {
    const dir = videoDir();
    const video = this.page.video();
    if (dir && video) {
      await fs.mkdir(dir, { recursive: true });
      await video.saveAs(path.join(dir, 'recording.webm'));
    }
  }

  await this.context?.close();
  await this.browser?.close();
});
