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
- Tag scenarios with @optional on steps that depend on UI that may not always render (banners, promos, secondary menus)
- Step definitions must import helpers from '../helpers' — do not invent helper names outside the catalog
- NEVER emit bare .click() or .fill() without a prior waitFor({ state: 'visible' }) or a helper that waits internally
- Use clickRoleIfVisible / clickIfVisible / runOptionalStep for any action that might be absent in headless or alternate environments
- For multi-step menus: wait for each level to become visible before the next interaction
- Then steps must use assertVisible, assertToast, or expect(...).toBeVisible({ timeout: 15_000 })
- Page Object: role-based locators first; every public action method waits for visibility before interacting; optional actions return Promise<boolean>
- Keep file contents complete and runnable
- Do not include explanations outside the JSON object`;
}
