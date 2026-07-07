import type { Locator, Page } from '@playwright/test';
import {
  ACTION_TIMEOUT_MS,
  FIRST_INTERACTION_TIMEOUT_MS,
  LOAD_STATE_TIMEOUT_MS,
  NAVIGATION_TIMEOUT_MS,
  SKIP_VISIBILITY_TIMEOUT_MS,
  VISIBILITY_TIMEOUT_MS,
} from './timeouts';

async function waitForPageReady(page: Page): Promise<void> {
  await page
    .waitForLoadState('domcontentloaded', { timeout: LOAD_STATE_TIMEOUT_MS })
    .catch(() => undefined);
}

export async function login(
  page: Page,
  credentials: { username: string; password: string },
): Promise<void> {
  await page.goto('/login', { waitUntil: 'commit', timeout: NAVIGATION_TIMEOUT_MS });
  await waitForPageReady(page);
  await page.fill('[name="username"]', credentials.username);
  await page.fill('[name="password"]', credentials.password);
  await page.click('button[type="submit"]');
}

export async function navigate(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'commit', timeout: NAVIGATION_TIMEOUT_MS });
  await waitForPageReady(page);
}

export async function waitForElement(
  page: Page,
  selector: string,
  timeout = VISIBILITY_TIMEOUT_MS,
): Promise<void> {
  await page.locator(selector).waitFor({ state: 'visible', timeout });
}

/**
 * Waits for the locator to be visible, then clicks. Accepts any Locator, so
 * exact codegen-recorded chains (icon buttons without ids, .first(), CSS)
 * work unchanged. Use firstInteraction for the first action after navigate().
 */
export async function waitAndClick(
  locator: Locator,
  options: { timeout?: number; firstInteraction?: boolean } = {},
): Promise<void> {
  const timeout =
    options.timeout ??
    (options.firstInteraction ? FIRST_INTERACTION_TIMEOUT_MS : VISIBILITY_TIMEOUT_MS);
  await locator.waitFor({ state: 'visible', timeout });
  await locator.click({ timeout: ACTION_TIMEOUT_MS });
}

/** Waits for the locator to be visible, then fills it. */
export async function waitAndFill(
  locator: Locator,
  value: string,
  options: { timeout?: number; firstInteraction?: boolean } = {},
): Promise<void> {
  const timeout =
    options.timeout ??
    (options.firstInteraction ? FIRST_INTERACTION_TIMEOUT_MS : VISIBILITY_TIMEOUT_MS);
  await locator.waitFor({ state: 'visible', timeout });
  await locator.fill(value, { timeout: ACTION_TIMEOUT_MS });
}

/**
 * Opens a menu/drawer: waits for the trigger (e.g. a hamburger icon button),
 * clicks it, then waits until the revealed content is visible before returning.
 */
export async function openMenu(
  trigger: Locator,
  revealedContent: Locator,
  options: { timeout?: number; firstInteraction?: boolean } = {},
): Promise<void> {
  await waitAndClick(trigger, options);
  await revealedContent.waitFor({ state: 'visible', timeout: VISIBILITY_TIMEOUT_MS });
}

/** Returns true if the locator becomes visible within the timeout. */
export async function isVisible(
  locator: Locator,
  timeout = SKIP_VISIBILITY_TIMEOUT_MS,
): Promise<boolean> {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/** Clicks only when the selector is visible; logs and returns false when skipped. */
export async function clickIfVisible(
  page: Page,
  selector: string,
  options: { timeout?: number; label?: string } = {},
): Promise<boolean> {
  const locator = page.locator(selector);
  const visible = await isVisible(locator, options.timeout ?? SKIP_VISIBILITY_TIMEOUT_MS);
  if (!visible) {
    console.warn(`[skip] Element not visible: ${options.label ?? selector}`);
    return false;
  }
  await locator.click({ timeout: ACTION_TIMEOUT_MS });
  return true;
}

/** Clicks a role-based locator only when visible; logs and returns false when skipped. */
export async function clickRoleIfVisible(
  page: Page,
  role: Parameters<Page['getByRole']>[0],
  name: string | RegExp,
  options: { timeout?: number; label?: string } = {},
): Promise<boolean> {
  const locator = page.getByRole(role, { name });
  const visible = await isVisible(locator, options.timeout ?? SKIP_VISIBILITY_TIMEOUT_MS);
  if (!visible) {
    console.warn(`[skip] ${role} "${String(name)}" not visible — skipping step`);
    return false;
  }
  await locator.click({ timeout: ACTION_TIMEOUT_MS });
  return true;
}

/** Runs an action only after the target locator is visible; skips gracefully otherwise. */
export async function interactWhenVisible(
  page: Page,
  selector: string,
  action: (target: Locator) => Promise<void>,
  options: { timeout?: number; label?: string } = {},
): Promise<'completed' | 'skipped'> {
  const locator = page.locator(selector);
  const visible = await isVisible(locator, options.timeout ?? VISIBILITY_TIMEOUT_MS);
  if (!visible) {
    console.warn(`[skip] ${options.label ?? selector} not available`);
    return 'skipped';
  }
  await action(locator);
  return 'completed';
}

/** Wraps a non-critical step in try/catch so the scenario continues when it fails. */
export async function runOptionalStep(
  label: string,
  action: () => Promise<void>,
): Promise<'completed' | 'skipped'> {
  try {
    await action();
    return 'completed';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[skip] Optional step skipped (${label}): ${message}`);
    return 'skipped';
  }
}

export async function fillForm(page: Page, fields: Record<string, string>): Promise<void> {
  for (const [selector, value] of Object.entries(fields)) {
    const field = page.locator(selector);
    await field.waitFor({ state: 'visible', timeout: VISIBILITY_TIMEOUT_MS });
    await field.fill(value, { timeout: ACTION_TIMEOUT_MS });
  }
}

export async function clickButton(page: Page, label: string): Promise<void> {
  const button = page.getByRole('button', { name: label });
  await button.waitFor({ state: 'visible', timeout: VISIBILITY_TIMEOUT_MS });
  await button.click({ timeout: ACTION_TIMEOUT_MS });
}

export async function assertToast(page: Page, message: string): Promise<void> {
  await page.getByText(message).waitFor({ state: 'visible', timeout: VISIBILITY_TIMEOUT_MS });
}

export async function assertVisible(
  page: Page,
  selector: string,
  timeout = VISIBILITY_TIMEOUT_MS,
): Promise<void> {
  await page.locator(selector).waitFor({ state: 'visible', timeout });
}
