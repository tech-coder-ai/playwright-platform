import { defineConfig } from '@playwright/test';

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
    launchOptions: {
      slowMo: process.env['PW_HEADLESS'] === 'false' ? 250 : 0,
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
