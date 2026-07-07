export const HELPER_CATALOG = `
Available test helper functions (import from '../helpers' in step definition files):

Core navigation & forms:
- login(page: Page, credentials: { username: string; password: string }): Promise<void>
- navigate(page: Page, path: string): Promise<void>  // goto up to 3 min + domcontentloaded wait
- fillForm(page: Page, fields: Record<string, string>): Promise<void>
- clickButton(page: Page, label: string): Promise<void>  // waits for visible before click

Visibility waits (use BEFORE every interaction):
- waitForElement(page: Page, selector: string, timeout?: number): Promise<void>
  Waits until selector is visible (default 15s). Call before click/fill on that element.
- assertVisible(page: Page, selector: string, timeout?: number): Promise<void>
- assertToast(page: Page, message: string): Promise<void>
- isVisible(locator: Locator, timeout?: number): Promise<boolean>
  Returns true/false without throwing (default 15s probe). Use to branch or skip.

Resilient / optional interactions (use when UI may not always be present):
- clickIfVisible(page, selector, { timeout?, label? }): Promise<boolean>
  Clicks only if visible within 15s; returns false and logs [skip] when element is absent.
- clickRoleIfVisible(page, role, name, { timeout?, label? }): Promise<boolean>
  Role-based variant — preferred for links, buttons, menuitems (default 15s probe).
- interactWhenVisible(page, selector, action, { timeout?, label? }): Promise<'completed' | 'skipped'>
- runOptionalStep(label, action): Promise<'completed' | 'skipped'>
  Wraps non-critical steps (cookie banners, promos, optional menus) in try/catch; logs skip and continues.

Step definitions MUST prefer these helpers over bare page.click() / page.fill().
`;

export const WAIT_AND_RESILIENCE_RULES = `
WAIT & RESILIENCE RULES (mandatory):

1. Never call .click(), .fill(), .press(), or .selectOption() without a preceding visibility wait.
   - Prefer clickRoleIfVisible / clickIfVisible for actions that may not always appear (ads, modals, menus).
   - For required steps: await locator.waitFor({ state: 'visible', timeout: 15_000 }) then interact.
   - For menus/dropdowns: wait for the parent trigger to be visible, click it, THEN wait for menuitem/link visible before clicking child.

2. Mark optional UI in Gherkin with @optional tag on the Scenario or step comment.
   - Step definitions for @optional flows MUST use clickRoleIfVisible, clickIfVisible, interactWhenVisible, or runOptionalStep.
   - When skipped, log with console.warn and continue — do NOT fail the scenario.

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

8. Example pattern for a menu step:
\`\`\`typescript
When('the user opens {string} under {string}', async function (item: string, menu: string) {
  const page = this.page as Page;
  const opened = await clickRoleIfVisible(page, 'link', menu, { label: menu, timeout: 15_000 });
  if (!opened) return;
  await page.getByRole('menuitem', { name: item }).waitFor({ state: 'visible', timeout: 15_000 });
  const clicked = await clickRoleIfVisible(page, 'menuitem', item, { label: item, timeout: 15_000 });
  if (!clicked) console.warn('[skip] menu item not available:', item);
});
\`\`\`

9. Example pattern for optional overlay:
\`\`\`typescript
await runOptionalStep('dismiss cookie banner', async () => {
  await clickRoleIfVisible(page, 'button', 'Accept', { timeout: 15_000 });
});
\`\`\`
`;
