import * as path from 'path';

export type BrowserProvider = 'playwright' | 'npm';

export function getBrowserProvider(): BrowserProvider {
  return process.env['BROWSER_PROVIDER'] === 'npm' ? 'npm' : 'playwright';
}

export function resolveChromiumExecutablePath(): string | undefined {
  if (process.env['CHROMIUM_EXECUTABLE_PATH']) {
    return process.env['CHROMIUM_EXECUTABLE_PATH'];
  }
  if (getBrowserProvider() !== 'npm') {
    return undefined;
  }

  const searchPaths = [
    path.join(process.cwd(), 'node_modules'),
    path.join(process.cwd(), '..', 'node_modules'),
    path.join(process.cwd(), '..', 'tests', 'node_modules'),
  ];

  for (const searchPath of searchPaths) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const chromium = require(require.resolve('chromium', { paths: [searchPath] })) as {
        path?: string;
      };
      if (chromium.path) return chromium.path;
    } catch {
      // try next path
    }
  }

  throw new Error(
    'BROWSER_PROVIDER=npm requires the "chromium" npm package. Install with: npm install chromium --workspace=tests',
  );
}

/** Env vars consumed by Playwright when launching Chromium. */
export function buildPlaywrightBrowserEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const env: Record<string, string> = {};
  const executablePath = resolveChromiumExecutablePath();
  if (executablePath) {
    // `playwright codegen` / `playwright open` only honor PWTEST_CLI_EXECUTABLE_PATH.
    env['PWTEST_CLI_EXECUTABLE_PATH'] = executablePath;
    // Child test processes (cucumber-js, playwright test) read this via
    // tests/support/browser-env.ts instead of re-resolving the chromium package.
    env['CHROMIUM_EXECUTABLE_PATH'] = executablePath;
  }
  env['BROWSER_PROVIDER'] = getBrowserProvider();
  return env;
}

export function getBrowserLaunchOptions(
  options: { headless?: boolean; slowMo?: number; args?: string[] } = {},
): {
  headless?: boolean;
  slowMo?: number;
  args?: string[];
  executablePath?: string;
} {
  const executablePath = resolveChromiumExecutablePath();
  return {
    ...options,
    ...(executablePath ? { executablePath } : {}),
  };
}
