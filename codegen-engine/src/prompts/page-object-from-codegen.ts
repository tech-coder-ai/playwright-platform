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
- LOCATOR FIDELITY: reuse the EXACT locator chains from the recording for every recorded action. Codegen already
  proved they work. Do NOT substitute "nicer" role/name locators — icon buttons (hamburgers, toggles) often have
  no id and no accessible name, so if the recording used a CSS locator, .first(), or .nth(n), keep it verbatim.
- Import wait helpers and use them for every action:
  import { waitAndClick, waitAndFill, openMenu, clickAndWaitForUrl } from '../helpers';
  - waitAndClick(locator) / waitAndFill(locator, value) — wait for loading + visibility, click/fill, retry if the
    click produced no reaction
  - openMenu(trigger, revealedContent) — for menus/drawers; verifies the menu opened and retries
  - clickAndWaitForUrl(page, locator) — REQUIRED for clicks that navigate; verifies the URL changed
- Recorded actions must FAIL when their element never appears. Only genuinely optional UI (cookie banners, promos)
  may return Promise<boolean> using isVisible/clickIfVisible.
- Export a single class with clear method names for each user action
- Include a \`goto()\` method when navigation is recorded; use the navigate(page, url) helper — it waits for DOM,
  network and loading spinners before returning
- Keep methods small and intention-revealing
- No test() blocks — Page Object only`;
}
