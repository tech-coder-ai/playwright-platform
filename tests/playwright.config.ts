import { defineConfig } from '@playwright/test';
import { getBrowserLaunchOptions } from './support/browser-env';

function screenshotMode(): 'off' | 'on' | 'only-on-failure' {
  const mode = process.env['PW_SCREENSHOT'] ?? 'on-failure';
  if (mode === 'on') return 'on';
  if (mode === 'off') return 'off';
  return 'only-on-failure';
}

function videoMode(): 'off' | 'on' | 'retain-on-failure' {
  const mode = process.env['PW_VIDEO'] ?? 'on-failure';
  if (mode === 'on') return 'on';
  if (mode === 'off') return 'off';
  return 'retain-on-failure';
}

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  outputDir: process.env['PW_OUTPUT_DIR'] ?? './test-results',
  reporter: [
    ['list'],
    ['json', { outputFile: process.env['PW_JSON_REPORT'] ?? './report.json' }],
  ],
  use: {
    baseURL: process.env['BASE_URL'] ?? 'http://localhost:4200',
    headless: process.env['PW_HEADLESS'] !== 'false',
    launchOptions: getBrowserLaunchOptions({
      slowMo: process.env['PW_HEADLESS'] === 'false' ? 250 : 0,
    }),
    trace: 'retain-on-failure',
    screenshot: screenshotMode(),
    video: videoMode(),
  },
});
