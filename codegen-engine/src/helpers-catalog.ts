export const HELPER_CATALOG = `
Available test helper functions. Import them from '../helpers' in EVERY file that uses them —
both step definition files (tests/steps/) and page object files (tests/page-objects/) sit next
to tests/helpers/, so the import path is '../helpers' in both:
  import { navigate, waitAndClick, waitAndFill, openMenu } from '../helpers';

Core navigation & forms:
- login(page: Page, credentials: { username: string; password: string }): Promise<void>
- navigate(page: Page, path: string): Promise<void>
  goto up to 3 min + domcontentloaded + networkidle (30s cap) so the SPA is hydrated before the next step
- clickAndWaitForUrl(page: Page, locator: Locator, { expectedUrl?, timeout?, firstInteraction? }): Promise<void>
  REQUIRED for every click that should navigate or change the route (links, submit buttons, menu entries
  that open a page). Verifies the URL actually changed and RETRIES the click if it was swallowed by a
  still-loading UI. Never use a bare click for navigation.
- fillForm(page: Page, fields: Record<string, string>): Promise<void>
- clickButton(page: Page, label: string): Promise<void>  // waits for visible before click

Locator-based waits (preferred — reuse the EXACT recorded locator chain):
- waitAndClick(locator: Locator, { timeout?, firstInteraction? }): Promise<void>
  Waits visible then clicks. Pass { firstInteraction: true } for the FIRST action after navigate() (60s wait — slow SPA render).
- waitAndFill(locator: Locator, value: string, { timeout?, firstInteraction? }): Promise<void>
- openMenu(trigger: Locator, revealedContent: Locator, { firstInteraction? }): Promise<void>
  Clicks a menu trigger (hamburger / icon button), waits for the revealed panel or first item to be
  visible, and re-clicks if the menu did not open (click landed while the UI was still hydrating).

Visibility waits (use BEFORE every interaction):
- waitForElement(page: Page, selector: string, timeout?: number): Promise<void>
  Waits until selector is visible (default 15s). Call before click/fill on that element.
- assertVisible(page: Page, selector: string, timeout?: number): Promise<void>
- assertToast(page: Page, message: string): Promise<void>
- isVisible(locator: Locator, timeout?: number): Promise<boolean>
  Returns true/false without throwing (default 15s probe). Use to branch or skip.

App readiness:
- waitForAppReady(page, { timeout? }): Promise<void>
  Blocks until DOM loaded + network quiet + all loading indicators (spinners/overlays/skeletons)
  are gone. navigate() calls this automatically; call it directly after in-app route changes.

Skippable interactions — ONLY for UI that is NOT part of the recorded flow (cookie banners,
promos, survey popups). NEVER use these for actions that appear in the codegen recording:
a recorded action exists on the page, so if it cannot be performed the test MUST FAIL, not skip.
- clickIfVisible(page, selector, { timeout?, label? }): Promise<boolean>
  Clicks only if visible within 15s; returns false and logs [skip] when element is absent.
- clickRoleIfVisible(page, role, name, { timeout?, label? }): Promise<boolean>
- interactWhenVisible(page, selector, action, { timeout?, label? }): Promise<'completed' | 'skipped'>
- runOptionalStep(label, action): Promise<'completed' | 'skipped'>
  Wraps non-critical extras (cookie banners, promos) in try/catch; logs skip and continues.

Step definitions MUST use waitAndClick / waitAndFill / openMenu / clickAndWaitForUrl for recorded
actions — these wait for loading to finish and FAIL LOUDLY when the element never appears.
`;

export const WAIT_AND_RESILIENCE_RULES = `
LOCATOR FIDELITY RULES (mandatory — violations make the test fail immediately):

A. For every recorded action, reuse the EXACT locator chain from the codegen recording, verbatim.
   Codegen already proved those locators work. Do NOT substitute a "nicer" locator:
   - NEVER replace a recorded locator with getByRole('menuitem'|'button'|'link', { name: ... }) that is not in the recording.
   - Icon-only buttons (hamburger menus, toggles, close buttons) usually have NO id and NO accessible name — if the recording used page.locator('css'), .first(), .nth(n), or a filter chain, keep it exactly as recorded.
   - You may only add waits/helpers AROUND recorded locators, never change the locator itself.
B. Only assertions (Then steps) may use locators that are not in the recording, since codegen does not record assertions. Prefer role/text of content that the recorded flow actually made visible.
C. Parameterized page-object methods may interpolate step arguments into a recorded locator pattern, but the pattern must come from the recording.

WAIT & RESILIENCE RULES (mandatory):

1. Never call .click(), .fill(), .press(), or .selectOption() without a preceding visibility wait.
   - Recorded actions are REQUIRED: use waitAndClick / waitAndFill / openMenu / clickAndWaitForUrl, which wait for
     loading to finish, wait for visibility, and THROW when the element never appears. Never let a recorded action
     silently skip (no clickIfVisible, no \`if (!clicked) return;\` for recorded actions).
   - For menus/dropdowns: use openMenu(trigger, revealedContent) — it waits, clicks, verifies the menu opened, retries.

2. Skippable helpers (clickIfVisible / clickRoleIfVisible / interactWhenVisible / runOptionalStep) are ONLY for UI
   that is NOT in the recording — cookie banners, promos, surveys. Tag such steps @optional in Gherkin.
   - If a step maps to a recorded action, it must NOT be skippable — a skip there hides real failures and makes
     every following step meaningless.

3. Assertions must wait:
   - Use assertVisible / assertToast helpers, or expect(locator).toBeVisible({ timeout: 15_000 }).
   - Never use immediate expect without timeout for dynamic content.

4. Navigation resilience (enterprise apps may take 2–3 minutes on first load):
   - page.goto(url, { waitUntil: 'commit', timeout: 180_000 })
   - Then await page.waitForLoadState('domcontentloaded', { timeout: 180_000 }).catch(() => undefined)
   - Do NOT use short goto timeouts on initial navigation steps.

5. Page Object methods must embed waits:
   - Each action method waits for its locator visible before click/fill.
   - goto() must use 180_000 ms navigation timeout and domcontentloaded wait.
   - Expose optional actions via methods returning Promise<boolean> using isVisible internally.

6. Timeouts (minimums — do not use shorter values):
   - Navigation / initial page load: 180_000 ms (3 minutes)
   - Cucumber step budget: 240_000 ms (4 minutes)
   - Primary element visibility wait: 15_000 ms
   - Optional / skip visibility probe: 15_000 ms
   - Post-visible click/fill action: 30_000 ms

7. Example pattern for a slow-loading app Given step:
\`\`\`typescript
Given('the user is on the application homepage', async function () {
  const page = this.page as Page;
  await page.goto('https://example.com', { waitUntil: 'commit', timeout: 180_000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 180_000 }).catch(() => undefined);
});
\`\`\`

8. Example pattern for a menu step (recorded actions — must fail loudly, never skip):
\`\`\`typescript
When('the user opens {string} under {string}', async function (item: string, menu: string) {
  const page = this.page as Page;
  // wait for the trigger, click, verify the menu opened (retries through slow loads)
  await openMenu(page.getByRole('link', { name: menu }), page.getByRole('menuitem', { name: item }));
  await clickAndWaitForUrl(page, page.getByRole('menuitem', { name: item }));
});
\`\`\`

9. Example pattern for optional overlay:
\`\`\`typescript
await runOptionalStep('dismiss cookie banner', async () => {
  await clickRoleIfVisible(page, 'button', 'Accept', { timeout: 15_000 });
});
\`\`\`

10. First interaction after navigation must allow extra render time:
   - The app may keep rendering long after domcontentloaded. The first element you touch gets a 60s wait: waitAndClick(locator, { firstInteraction: true }) or locator.waitFor({ state: 'visible', timeout: 60_000 }).

10b. Visible is NOT clickable — verify every click had an effect:
   - While a SPA is still loading, elements are visible before their click handlers attach; a click "succeeds" but nothing happens.
   - Any click that should navigate / change the route MUST use clickAndWaitForUrl(page, locator, ...) — it verifies the URL changed and retries the click.
   - Any click that should reveal content (menus, dialogs, accordions) MUST use openMenu(trigger, revealedContent) or follow the click with a waitFor on the revealed element.
   - NEVER end a When step right after a click without verifying its effect.

11. Example: hamburger / icon menu with no id or accessible name.
   Recording contained: await page.locator('.app-header button.menu-toggle').click();
   followed by:        await page.getByText('Reports').click();
\`\`\`typescript
// Page object — keep the recorded locators verbatim:
import type { Page } from '@playwright/test';
import { openMenu, waitAndClick } from '../helpers';

export class AppShellPage {
  constructor(private readonly page: Page) {}

  async openNavigationMenu(): Promise<void> {
    // exact locator from the recording — do NOT swap in a role guess
    const trigger = this.page.locator('.app-header button.menu-toggle');
    const firstMenuEntry = this.page.getByText('Reports');
    await openMenu(trigger, firstMenuEntry, { firstInteraction: true });
  }

  async selectMenuEntry(label: string): Promise<void> {
    await waitAndClick(this.page.getByText(label));
  }
}
\`\`\`
`;
