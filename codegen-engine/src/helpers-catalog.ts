export const HELPER_CATALOG = `
## HELPER LIBRARY ('../helpers')

Every file you generate (step definitions AND page objects) must import the helpers it uses from
'../helpers' — both tests/steps/ and tests/page-objects/ sit next to tests/helpers/:
  import { navigate, waitAndClick, waitAndFill, openMenu, clickAndWaitForUrl } from '../helpers';

These helpers exist because the target apps are slow enterprise SPAs: first page load can take
3 minutes, the UI keeps hydrating after DOM load, and spinners appear between route changes.
Each helper gates on "app not loading", waits for visibility, performs the action, then verifies
it had an effect (retrying when a click landed on not-yet-hydrated DOM).

### Required for RECORDED actions (fail loudly when the element never appears)
| Helper | Use for | Behavior |
|---|---|---|
| navigate(page, url) | Every initial navigation | goto with 180s timeout + waits for DOM, network-quiet, and all spinners/skeletons gone |
| waitAndClick(locator, { firstInteraction? }) | Plain clicks | Waits visible (15s; 60s with firstInteraction), clicks, retries up to 3x if the page showed no reaction |
| waitAndFill(locator, value, { firstInteraction? }) | Text input | Waits visible, fills |
| openMenu(trigger, revealedContent, { firstInteraction? }) | Clicks that reveal UI (menus, drawers, dialogs, accordions) | Clicks trigger, verifies revealedContent became visible, re-clicks if the menu never opened |
| clickAndWaitForUrl(page, locator, { expectedUrl? }) | Clicks that navigate / change the route | Clicks, verifies the URL actually changed, retries swallowed clicks, then waits for the new page to be ready |
| waitForAppReady(page) | After in-app route changes | Blocks until DOM + network quiet + loading indicators gone |

### Assertions (Then steps)
| Helper | Use |
|---|---|
| assertVisible(page, selector, timeout?) | CSS-selector visibility assertion (15s default) |
| assertToast(page, message) | Toast/text appears |
| expect(locator).toBeVisible({ timeout: 15_000 }) | Role/text locator assertions (import expect from '@playwright/test') |

### ONLY for UI that is NOT in the recording (cookie banners, promos, surveys)
| Helper | Behavior |
|---|---|
| clickIfVisible(page, selector, { label? }) | Clicks if visible within 15s, else logs [skip] and returns false |
| clickRoleIfVisible(page, role, name, { label? }) | Same, role-based |
| interactWhenVisible(page, selector, action, { label? }) | Runs action only if target appears; returns 'completed' | 'skipped' |
| runOptionalStep(label, action) | try/catch wrapper; logs and continues on failure |
| isVisible(locator, timeout?) | Boolean probe, never throws |

NEVER use a skippable helper for an action that appears in the recording: the recorded element
existed, so if it cannot be found the test MUST FAIL — a silent skip hides the real failure and
invalidates every step after it.

### Misc
login(page, { username, password }) · fillForm(page, fields) · clickButton(page, label) ·
waitForElement(page, selector, timeout?)
`;

export const WAIT_AND_RESILIENCE_RULES = `
## HARD RULES
Violating any of these produces a test that fails or flakes — your output is mechanically
validated against them and rejected on violation.

R1. LOCATOR FIDELITY. For every recorded action, reuse the recording's locator chain VERBATIM.
    Codegen proved those locators work; "nicer" ones you invent usually do not exist.
    - If the recording used page.locator('css…'), .first(), .nth(n), or a filter chain — keep it
      exactly. Icon-only buttons (hamburgers, toggles) typically have no id and no accessible
      name, so a getByRole guess for them WILL fail.
    - You may wrap recorded locators in helpers, and parameterized page-object methods may
      interpolate step arguments into a recorded pattern — but never redesign the locator.
    - Only Then-step assertions may use locators not present in the recording (codegen does not
      record assertions); assert on content the recorded flow actually made visible.

R2. NO BARE INTERACTIONS. Never call .click() / .fill() / .press() / .selectOption() directly on
    a recorded action. Route every recorded action through waitAndClick / waitAndFill / openMenu /
    clickAndWaitForUrl.

R3. NO RAW page.goto() in step definitions — use navigate(page, url). It carries the 180s
    first-load timeout and the app-ready gate (validators reject raw goto).

R4. FIRST INTERACTION. The first action after navigate() gets { firstInteraction: true } — the
    app keeps rendering long after page load, so that element gets a 60s visibility budget.

R5. VERIFY CLICK EFFECTS. Visible is not clickable: while a SPA hydrates, clicks can land on dead
    DOM. Therefore:
    - a click after which the recording shows a URL change → clickAndWaitForUrl (verifies + retries)
    - a click that reveals content (menu, dialog, accordion, dropdown) → openMenu(trigger, revealed)
    - never end a When step on an unverified click.

R6. EVERY STEP DEFINED, NONE EXTRA. Every Gherkin line in featureFile must match exactly one
    Given/When/Then in stepDefinitions (cucumber "undefined step" is a hard failure), and no
    unused definitions.

R7. PAGE OBJECT OWNS THE SCREEN. Step definitions never inline locators for the main screen; they
    call page-object methods. The page object wraps the recorded locators with helpers. Steps
    import it exactly as:
      import { <ClassName> } from '../page-objects/page-object';
    (the platform rewrites this path on save; <ClassName> must be the exported class name).

R8. OPTIONAL UI. UI that may not render (cookie banners, promos) gets a separate step tagged
    @optional using runOptionalStep / clickRoleIfVisible. Never mix optional handling into a
    recorded action's step.

R9. ASSERTIONS WAIT. Then steps use assertVisible / assertToast / expect(...).toBeVisible({
    timeout: 15_000 }). Never a zero-timeout expect on dynamic content.

R10. TIMEOUT FLOORS (helpers already respect them — do not pass shorter values):
    initial navigation 180_000 · first interaction 60_000 · element visibility 15_000 ·
    post-visibility action 30_000. The cucumber step budget is 240_000 (already configured
    globally — do not call setDefaultTimeout yourself).
`;

/**
 * Complete worked example embedded in the generation prompt. Few-shot beats
 * rules: models copy the shape of what they see far more reliably than they
 * follow abstract instructions.
 */
export const GHERKIN_EXAMPLE = `
## WORKED EXAMPLE — copy this structure exactly

### Input recording
\`\`\`typescript
import { test, expect } from '@playwright/test';

test('recorded flow', async ({ page }) => {
  await page.goto('https://portal.example.com/');
  await page.locator('.app-header button.menu-toggle').click();
  await page.getByText('Reports').click();
  await page.getByRole('link', { name: 'Quarterly Summary' }).click();
});
\`\`\`
(The last click changed the URL to /reports/quarterly — treat link/menu-entry clicks that load a
page as navigation clicks.)

### Output (values of the JSON fields)

featureFile:
\`\`\`gherkin
Feature: Quarterly summary report
  A user opens the reports menu and views the quarterly summary.

  Scenario: User opens the quarterly summary report
    Given the user is on the portal home page
    When the user opens the navigation menu
    And the user opens "Quarterly Summary" under "Reports"
    Then the quarterly summary page is displayed
\`\`\`

stepDefinitions:
\`\`\`typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { navigate } from '../helpers';
import { PortalHomePage } from '../page-objects/page-object';

Given('the user is on the portal home page', async function () {
  const page = this.page as Page;
  await navigate(page, 'https://portal.example.com/');
});

When('the user opens the navigation menu', async function () {
  const page = this.page as Page;
  await new PortalHomePage(page).openNavigationMenu();
});

When('the user opens {string} under {string}', async function (item: string, menu: string) {
  const page = this.page as Page;
  await new PortalHomePage(page).openMenuEntry(menu, item);
});

Then('the quarterly summary page is displayed', async function () {
  const page = this.page as Page;
  await expect(page.getByRole('heading', { name: 'Quarterly Summary' })).toBeVisible({ timeout: 15_000 });
});
\`\`\`

pageObject:
\`\`\`typescript
import type { Page } from '@playwright/test';
import { openMenu, waitAndClick, clickAndWaitForUrl } from '../helpers';

export class PortalHomePage {
  constructor(private readonly page: Page) {}

  /** Recorded locator kept verbatim — the icon button has no accessible name. */
  async openNavigationMenu(): Promise<void> {
    const trigger = this.page.locator('.app-header button.menu-toggle');
    const firstEntry = this.page.getByText('Reports');
    await openMenu(trigger, firstEntry, { firstInteraction: true });
  }

  async openMenuEntry(menu: string, item: string): Promise<void> {
    // Recorded pattern, parameterized with the step arguments.
    await waitAndClick(this.page.getByText(menu));
    await clickAndWaitForUrl(this.page, this.page.getByRole('link', { name: item }));
  }
}
\`\`\`

Why this shape:
- navigate() carries the 3-minute first-load budget; the menu toggle is the first interaction so
  it gets { firstInteraction: true }.
- The menu toggle is an icon button recorded as CSS — kept verbatim (R1), wrapped in openMenu so
  a swallowed click gets retried (R5).
- The final click loads a page, so it uses clickAndWaitForUrl, not waitAndClick (R5).
- Every feature line has exactly one matching definition (R6); the screen's locators live in the
  page object (R7); the assertion targets content the flow made visible with a 15s wait (R9).
`;
