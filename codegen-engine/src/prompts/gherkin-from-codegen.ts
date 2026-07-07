import { HELPER_CATALOG, WAIT_AND_RESILIENCE_RULES } from '../helpers-catalog';

export function buildGherkinGenerationPrompt(codegenOutput: string, targetUrl: string): string {
  return `You are a senior test automation engineer. Convert Playwright codegen output into resilient, production-ready Gherkin tests that handle slow UIs and optional elements.

Target URL: ${targetUrl}

${HELPER_CATALOG}

${WAIT_AND_RESILIENCE_RULES}

Playwright codegen recording:
\`\`\`typescript
${codegenOutput}
\`\`\`

Respond with ONLY valid JSON (no markdown fences) matching this schema:
{
  "featureFile": "Gherkin feature file content",
  "stepDefinitions": "TypeScript step definitions file content using @cucumber/cucumber and the helpers above",
  "pageObject": "TypeScript Page Object class for the main screen",
  "summary": "One sentence describing what was generated"
}

Rules:
- Use clear Gherkin Given/When/Then steps that map to the recorded actions
- Every single Gherkin step in featureFile MUST have exactly one matching Given/When/Then definition in stepDefinitions — no undefined and no unused steps
- Tag scenarios with @optional on steps that depend on UI that may not always render (banners, promos, secondary menus)
- Every helper used in stepDefinitions AND in pageObject must be imported from '../helpers' in that same file — do not invent helper names outside the catalog
- Step definitions MUST import the page object exactly as: import { <ClassName> } from '../page-objects/page-object'; (the platform rewrites this path on save — never invent another path, and <ClassName> must be the class exported by pageObject)
- The initial navigation Given step MUST use the navigate(page, url) helper (it has the 3-minute first-load timeout built in) — never a raw page.goto with default timeout
- The FIRST interaction after navigation must pass { firstInteraction: true } to waitAndClick/waitAndFill/openMenu/clickAndWaitForUrl (60s wait — the app keeps rendering after load)
- If the recording shows the URL changed after a click, that click MUST use clickAndWaitForUrl — a visible element on a still-loading page can swallow clicks, so the effect must be verified and the click retried
- All screen interactions in step definitions must go through page object methods; do not inline locators for the main screen in step definitions
- Page object methods should wrap the EXACT recorded locators with waitAndClick / waitAndFill / openMenu — see LOCATOR FIDELITY RULES above; inventing a different locator than the recording is the #1 cause of failing generated tests
- NEVER emit bare .click() or .fill() without a prior waitFor({ state: 'visible' }) or a helper that waits internally
- Use clickRoleIfVisible / clickIfVisible / runOptionalStep for any action that might be absent in headless or alternate environments
- For multi-step menus: wait for each level to become visible before the next interaction
- Then steps must use assertVisible, assertToast, or expect(...).toBeVisible({ timeout: 15_000 })
- Page Object: role-based locators first; every public action method waits for visibility before interacting; optional actions return Promise<boolean>
- Keep file contents complete and runnable
- Do not include explanations outside the JSON object`;
}
