export type BrowserProvider = 'playwright' | 'npm';

export function getBrowserProvider(): BrowserProvider {
  return process.env['BROWSER_PROVIDER'] === 'npm' ? 'npm' : 'playwright';
}

function resolveFromChromiumPackage(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const chromium = require('chromium') as { path?: string };
    return chromium.path;
  } catch {
    return undefined;
  }
}

export function resolveChromiumExecutablePath(): string | undefined {
  if (process.env['CHROMIUM_EXECUTABLE_PATH']) {
    return process.env['CHROMIUM_EXECUTABLE_PATH'];
  }
  if (getBrowserProvider() !== 'npm') {
    return undefined;
  }
  const fromPackage = resolveFromChromiumPackage();
  if (!fromPackage) {
    throw new Error(
      'BROWSER_PROVIDER=npm requires the "chromium" npm package. Install with: npm install chromium --workspace=tests',
    );
  }
  return fromPackage;
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

export function applyPlaywrightBrowserEnv(): void {
  const executablePath = resolveChromiumExecutablePath();
  if (executablePath) {
    process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'] = executablePath;
  }
  process.env['BROWSER_PROVIDER'] = getBrowserProvider();
}

applyPlaywrightBrowserEnv();
