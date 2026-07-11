/**
 * Resolves the Playwright library installed in (or hoisted above) the tests
 * workspace so the API can drive browsers directly (remote recorder) without
 * declaring its own copy of Playwright.
 */

// Minimal structural types for the parts of Playwright the API uses at
// runtime. The private `_enableRecorder` channel (the same one the
// `playwright codegen` CLI uses) is intentionally typed loosely.
export interface PlaywrightPage {
  url(): string;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  close(): Promise<void>;
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  on(event: string, handler: (...args: never[]) => void): void;
  isClosed(): boolean;
}

export interface PlaywrightCdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(event: string, handler: (payload: never) => void): void;
  detach(): Promise<void>;
}

export interface PlaywrightBrowserContext {
  newPage(): Promise<PlaywrightPage>;
  newCDPSession(page: PlaywrightPage): Promise<PlaywrightCdpSession>;
  close(): Promise<void>;
  pages(): PlaywrightPage[];
  on(event: string, handler: (...args: never[]) => void): void;
}

export interface PlaywrightBrowser {
  newContext(options?: Record<string, unknown>): Promise<PlaywrightBrowserContext>;
  close(): Promise<void>;
}

export interface PlaywrightChromium {
  launch(options?: Record<string, unknown>): Promise<PlaywrightBrowser>;
}

export function resolveChromiumLibrary(testsRoot: string): PlaywrightChromium {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const playwright = require(
    require.resolve('@playwright/test', { paths: [testsRoot] }),
  ) as { chromium?: PlaywrightChromium };
  if (!playwright.chromium) {
    throw new Error(
      'Could not load Playwright chromium from the tests workspace. Run npm install in the repo root.',
    );
  }
  return playwright.chromium;
}
