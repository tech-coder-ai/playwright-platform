import type { Locator, Page } from '@playwright/test';
import {
  ACTION_TIMEOUT_MS,
  APP_READY_TIMEOUT_MS,
  CLICK_EFFECT_TIMEOUT_MS,
  CLICK_REACTION_TIMEOUT_MS,
  FIRST_INTERACTION_TIMEOUT_MS,
  LOAD_STATE_TIMEOUT_MS,
  LOADING_INDICATOR_TIMEOUT_MS,
  NAVIGATION_TIMEOUT_MS,
  NETWORK_IDLE_TIMEOUT_MS,
  SKIP_VISIBILITY_TIMEOUT_MS,
  VISIBILITY_TIMEOUT_MS,
} from './timeouts';

/**
 * Selectors treated as "the app is still loading". Extend or replace via the
 * PW_LOADING_INDICATORS env var (comma-separated CSS selectors).
 */
const DEFAULT_LOADING_INDICATORS = [
  '[aria-busy="true"]',
  '.spinner',
  '.loader',
  '.loading',
  '.loading-overlay',
  '#nprogress',
  '.MuiCircularProgress-root',
  '.MuiSkeleton-root',
  'mat-spinner',
  'mat-progress-spinner',
  'mat-progress-bar',
  '.ant-spin-spinning',
  '.ant-skeleton-active',
  '.p-progress-spinner',
  '[class*="skeleton" i]',
];

function loadingIndicatorSelector(): string {
  const custom = process.env['PW_LOADING_INDICATORS'];
  const selectors = custom
    ? custom.split(',').map((selector) => selector.trim()).filter(Boolean)
    : DEFAULT_LOADING_INDICATORS;
  return selectors.join(', ');
}

async function hasVisibleLoadingIndicator(page: Page): Promise<boolean> {
  try {
    return await page.$$eval(loadingIndicatorSelector(), (elements) =>
      elements.some((el) => el.getClientRects().length > 0 && (el as HTMLElement).offsetParent !== null),
    );
  } catch {
    return false; // page navigating / selector unavailable — don't block
  }
}

/**
 * Blocks until loading indicators have been gone for two consecutive checks,
 * or the budget runs out (warn and continue — a stuck spinner should surface
 * as a real assertion failure, not a hang).
 */
async function waitForLoadingIndicatorsGone(page: Page, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout;
  let clearChecks = 0;
  let warned = false;
  while (Date.now() < deadline) {
    if (await hasVisibleLoadingIndicator(page)) {
      clearChecks = 0;
      if (!warned) {
        console.warn('[wait] loading indicator visible — holding actions until it clears');
        warned = true;
      }
      await page.waitForTimeout(300);
    } else {
      clearChecks += 1;
      if (clearChecks >= 2) return;
      await page.waitForTimeout(200);
    }
  }
  console.warn(`[wait] loading indicator still visible after ${timeout}ms — continuing`);
}

/**
 * Full readiness gate used after every navigation: DOM loaded, network quiet,
 * and no loading spinner/overlay/skeleton on screen.
 */
export async function waitForAppReady(
  page: Page,
  options: { timeout?: number } = {},
): Promise<void> {
  await page
    .waitForLoadState('domcontentloaded', { timeout: LOAD_STATE_TIMEOUT_MS })
    .catch(() => undefined);
  // Let the SPA fetch data and attach event handlers — elements can be
  // visible before their click handlers exist, swallowing clicks. Capped and
  // non-fatal: long-polling apps never reach networkidle.
  await page
    .waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS })
    .catch(() => undefined);
  await waitForLoadingIndicatorsGone(page, options.timeout ?? APP_READY_TIMEOUT_MS);
}

/** Cheap pre-action gate: only waits when a loading indicator is actually up. */
async function ensureNotLoading(page: Page): Promise<void> {
  if (await hasVisibleLoadingIndicator(page)) {
    await waitForLoadingIndicatorsGone(page, LOADING_INDICATOR_TIMEOUT_MS);
  }
}

async function waitForPageReady(page: Page): Promise<void> {
  await waitForAppReady(page);
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
/**
 * Clicks and reports whether the page visibly reacted (any DOM mutation or a
 * URL change within CLICK_REACTION_TIMEOUT_MS). A click on an element whose
 * handlers have not attached yet (app still hydrating) produces no reaction.
 */
async function clickAndDetectReaction(locator: Locator): Promise<boolean> {
  const page = locator.page();
  const beforeUrl = page.url();

  try {
    await page.evaluate(() => {
      const w = window as unknown as {
        __pwReactions?: number;
        __pwReactionObserver?: MutationObserver;
      };
      w.__pwReactions = 0;
      w.__pwReactionObserver?.disconnect();
      const observer = new MutationObserver(() => {
        w.__pwReactions = (w.__pwReactions ?? 0) + 1;
      });
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      w.__pwReactionObserver = observer;
    });
  } catch {
    // Cannot instrument (e.g. page mid-navigation) — click without detection.
    await locator.click({ timeout: ACTION_TIMEOUT_MS });
    return true;
  }

  await locator.click({ timeout: ACTION_TIMEOUT_MS });

  const deadline = Date.now() + CLICK_REACTION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (page.url() !== beforeUrl) return true;
    try {
      const mutations = await page.evaluate(
        () => (window as unknown as { __pwReactions?: number }).__pwReactions ?? 0,
      );
      if (mutations > 0) return true;
    } catch {
      return true; // context destroyed — the click navigated
    }
    await page.waitForTimeout(150);
  }
  return false;
}

export async function waitAndClick(
  locator: Locator,
  options: { timeout?: number; firstInteraction?: boolean; attempts?: number } = {},
): Promise<void> {
  const timeout =
    options.timeout ??
    (options.firstInteraction ? FIRST_INTERACTION_TIMEOUT_MS : VISIBILITY_TIMEOUT_MS);
  const attempts = options.attempts ?? 3;

  await ensureNotLoading(locator.page());
  await locator.waitFor({ state: 'visible', timeout });

  for (let attempt = 1; attempt <= attempts; attempt++) {
    await ensureNotLoading(locator.page());
    if (await clickAndDetectReaction(locator)) return;
    if (attempt < attempts) {
      console.warn(
        `[retry] click produced no page reaction (attempt ${attempt}/${attempts}) — handlers may not be attached yet, re-clicking`,
      );
    } else {
      console.warn(
        `[warn] click never produced a visible page reaction after ${attempts} attempts — continuing, but the element may be inert`,
      );
    }
  }
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
  await ensureNotLoading(locator.page());
  await locator.waitFor({ state: 'visible', timeout });
  await ensureNotLoading(locator.page());
  await locator.fill(value, { timeout: ACTION_TIMEOUT_MS });
}

/**
 * Opens a menu/drawer: waits for the trigger (e.g. a hamburger icon button),
 * clicks it, then waits until the revealed content is visible.
 *
 * The click is retried: while the app is still hydrating, a visible trigger
 * may have no handler attached yet, so the first click can land on dead DOM.
 * If the menu content does not appear, we click again (checking first that
 * the menu is not already open, so a retry cannot toggle it closed).
 */
export async function openMenu(
  trigger: Locator,
  revealedContent: Locator,
  options: { timeout?: number; firstInteraction?: boolean; attempts?: number } = {},
): Promise<void> {
  const attempts = options.attempts ?? 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1 && (await isVisible(revealedContent, 1_000))) return;
    await waitAndClick(trigger, attempt === 1 ? options : { timeout: options.timeout });
    if (await isVisible(revealedContent, CLICK_EFFECT_TIMEOUT_MS)) return;
    console.warn(
      `[retry] menu content did not appear after click (attempt ${attempt}/${attempts}) — UI may still be loading`,
    );
  }
  // Final chance with the full wait so the failure message names the element.
  await revealedContent.waitFor({ state: 'visible', timeout: VISIBILITY_TIMEOUT_MS });
}

/**
 * Clicks something that should navigate (link, submit, menu entry) and
 * verifies the page actually moved on — by default, that the URL changed;
 * pass expectedUrl to require a specific target. If the URL does not change
 * (click swallowed by a still-loading UI), the click is retried.
 */
export async function clickAndWaitForUrl(
  page: Page,
  locator: Locator,
  options: {
    expectedUrl?: string | RegExp;
    timeout?: number;
    firstInteraction?: boolean;
    attempts?: number;
  } = {},
): Promise<void> {
  const attempts = options.attempts ?? 3;
  const initialUrl = page.url();
  const target = options.expectedUrl ?? ((url: URL) => url.toString() !== initialUrl);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    await waitAndClick(locator, attempt === 1 ? options : { timeout: options.timeout });
    try {
      await page.waitForURL(target, { timeout: CLICK_EFFECT_TIMEOUT_MS, waitUntil: 'commit' });
      await waitForPageReady(page);
      return;
    } catch {
      if (attempt === attempts) {
        throw new Error(
          `Click did not navigate after ${attempts} attempts (URL still ${page.url()}) — the UI was likely still loading when the element became visible`,
        );
      }
      console.warn(
        `[retry] click did not change the URL (attempt ${attempt}/${attempts}) — UI may still be hydrating`,
      );
    }
  }
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
  // Don't let the skip-probe run against a loading screen — that turns a slow
  // app into silently skipped steps.
  await ensureNotLoading(page);
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
  await ensureNotLoading(page);
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
  await ensureNotLoading(page);
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
  await ensureNotLoading(page);
  for (const [selector, value] of Object.entries(fields)) {
    const field = page.locator(selector);
    await field.waitFor({ state: 'visible', timeout: VISIBILITY_TIMEOUT_MS });
    await field.fill(value, { timeout: ACTION_TIMEOUT_MS });
  }
}

export async function clickButton(page: Page, label: string): Promise<void> {
  await ensureNotLoading(page);
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
