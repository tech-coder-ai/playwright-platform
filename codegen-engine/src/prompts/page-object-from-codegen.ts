export function buildPageObjectPrompt(
  codegenOutput: string,
  targetUrl: string,
  screenName: string,
  componentName?: string,
  existingPageObject?: string,
): string {
  const componentHint = componentName
    ? `Focus on the "${componentName}" component/popup within the screen.`
    : 'Cover the full screen interactions from the recording.';

  const patchSection = existingPageObject
    ? `
Existing Page Object to patch (preserve unrelated methods, merge new locators/actions):
\`\`\`typescript
${existingPageObject}
\`\`\`

Update the existing class: add or revise methods for the newly recorded interactions. Bump internal locator names if needed. Do not remove unrelated methods unless they conflict.
`
    : 'Create a new Page Object class from scratch.';

  return `You are a Playwright Page Object expert. Convert codegen output into a clean, typed Page Object class.

Target URL: ${targetUrl}
Screen name: ${screenName}
${componentHint}

${patchSection}

Playwright codegen recording:
\`\`\`typescript
${codegenOutput}
\`\`\`

Respond with ONLY valid JSON (no markdown fences):
{
  "pageObject": "Complete TypeScript Page Object class",
  "className": "PascalCase class name",
  "summary": "One sentence describing locators and actions captured"
}

Rules:
- Use @playwright/test Page and Locator types
- Prefer getByRole, getByLabel, getByText over brittle CSS
- Every action method MUST wait for its target locator to be visible before click/fill (use waitFor({ state: 'visible', timeout: 15_000 }))
- Optional actions (dismissals, secondary buttons) should return Promise<boolean> — true when completed, false when element was not available
- Export a single class with clear method names for each user action
- Include a \`goto()\` method when navigation is recorded; use waitUntil: 'commit', timeout: 180_000, then waitForLoadState('domcontentloaded', { timeout: 180_000 })
- Keep methods small and intention-revealing
- No test() blocks — Page Object only`;
}
