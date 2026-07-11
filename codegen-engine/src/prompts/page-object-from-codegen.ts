import { HELPER_CATALOG } from '../helpers-catalog';

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
## EXISTING PAGE OBJECT (patch mode)
Merge the newly recorded interactions into this class. Preserve unrelated methods and their
behavior; add or revise methods only for what the new recording covers. Keep the exported class
name unless it conflicts.
\`\`\`typescript
${existingPageObject}
\`\`\`
`
    : 'Create a new Page Object class from scratch.';

  return `You are a senior test automation engineer. Convert a Playwright codegen recording into a
clean, typed Page Object class for a slow enterprise web application.

## ENVIRONMENT FACTS
- First page load can take up to 3 MINUTES; the SPA keeps rendering after DOM load, so elements
  are visible before their handlers attach and early clicks are silently swallowed.
- The helper library below wraps interactions with readiness gates, visibility waits, effect
  verification, and retries. Every action method must go through it.

## TARGET
URL: ${targetUrl}
Screen name: ${screenName}
${componentHint}

${patchSection}

## RECORDING (ground truth for locators)
\`\`\`typescript
${codegenOutput}
\`\`\`
${HELPER_CATALOG}

## HARD RULES
1. LOCATOR FIDELITY: reuse the recording's locator chains VERBATIM for every recorded action.
   Codegen proved they work. Icon-only buttons (hamburgers, toggles, close buttons) usually have
   no id and no accessible name — if the recording used page.locator('css'), .first(), .nth(n),
   or a filter chain, keep it exactly. Never substitute a getByRole guess.
2. Every action method uses a helper — never bare .click()/.fill()/.press():
   - clicks that navigate → clickAndWaitForUrl(this.page, locator)
   - clicks that reveal content (menus, dialogs, dropdowns) → openMenu(trigger, revealedContent)
   - other clicks → waitAndClick(locator); text input → waitAndFill(locator, value)
3. Include a goto() method when navigation was recorded, implemented with the navigate(page, url)
   helper (it carries the 180s first-load budget and app-ready gate).
4. The first interaction after goto() passes { firstInteraction: true } (60s visibility budget).
5. Recorded actions FAIL when their element never appears. Only genuinely optional UI (cookie
   banners, promos — things NOT in the recording) may use isVisible/clickIfVisible and return
   Promise<boolean>.
6. Import every helper used from '../helpers' in this file. Use @playwright/test Page and Locator
   types. Small, intention-revealing methods; one method per user action. Export exactly one
   class. No test() blocks.

## OUTPUT CONTRACT
Respond with ONLY a single JSON object — no markdown fences, no commentary.
Use standard JSON string escaping (\\n for newlines inside string values).

{
  "pageObject": "<complete TypeScript page object file>",
  "className": "<PascalCase name of the exported class>",
  "summary": "<one sentence: locators and actions captured>"
}`;
}
