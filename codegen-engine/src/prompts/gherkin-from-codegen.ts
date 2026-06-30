import { HELPER_CATALOG } from '../helpers-catalog';

export function buildGherkinGenerationPrompt(codegenOutput: string, targetUrl: string): string {
  return `You are a test automation expert. Convert Playwright codegen output into a maintainable Gherkin-based test structure.

Target URL: ${targetUrl}

${HELPER_CATALOG}

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
- Step definitions must import helpers from '../helpers' — do not invent helper names outside the catalog
- Page Object should use role-based locators first, CSS as fallback
- Keep file contents complete and runnable
- Do not include explanations outside the JSON object`;
}
