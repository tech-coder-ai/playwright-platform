import { GHERKIN_EXAMPLE, HELPER_CATALOG, WAIT_AND_RESILIENCE_RULES } from '../helpers-catalog';

export function buildGherkinGenerationPrompt(codegenOutput: string, targetUrl: string): string {
  return `You are a senior test automation engineer. Convert a Playwright codegen recording into a
production-ready Cucumber test (feature file + step definitions + page object) for a slow
enterprise web application.

## ENVIRONMENT FACTS (design for these — they are why naive conversions fail)
- First page load can take up to 3 MINUTES; the SPA keeps rendering long after DOM load.
- Elements become visible BEFORE their click handlers attach, so early clicks are silently
  swallowed; spinners/skeletons appear between route changes.
- Tests run headless under cucumber-js. \`this.page\` in each step is a Playwright Page provided
  by the World; the per-step timeout is already 240s (do not set it yourself).
- The helper library below wraps every interaction with readiness gates, visibility waits,
  effect verification, and retries. Output that bypasses it is mechanically rejected.

## TARGET URL
${targetUrl}

## RECORDING (ground truth for locators — see rule R1)
\`\`\`typescript
${codegenOutput}
\`\`\`
${HELPER_CATALOG}
${WAIT_AND_RESILIENCE_RULES}
${GHERKIN_EXAMPLE}

## METHOD — follow in order
1. Parse the recording into an ordered list of actions (goto, click, fill, press, select),
   keeping each action's locator chain verbatim.
2. Classify every click:
   a. the recording navigated after it (link, submit, menu entry that loads a page)
      → clickAndWaitForUrl
   b. it revealed content that the NEXT recorded action targets (menu, dropdown, dialog,
      accordion, expander) → openMenu(trigger, thatRevealedContent)
   c. anything else → waitAndClick
3. Design the scenario: Given = navigation via navigate(); When = one step per user intent
   (an openMenu + selection may be one step); Then = at least one assertion on visible evidence
   that the final action worked (heading, table, toast the flow revealed).
4. Write the page object first: one intention-revealing method per screen interaction, wrapping
   the recorded locators with helpers; the FIRST interaction after navigation passes
   { firstInteraction: true }.
5. Write step definitions that only call navigate(), page-object methods, and assertions.
6. Self-check before answering:
   - every feature line has exactly one matching step definition, none unused (R6)
   - zero bare .click()/.fill()/.press()/.goto() anywhere (R2, R3)
   - every recorded action's locator appears verbatim in the page object (R1)
   - every navigation click uses clickAndWaitForUrl; every reveal click uses openMenu (R5)
   - every helper used is imported from '../helpers' in THAT file
   - the class imported by step definitions matches the class the page object exports (R7)
   - no skippable helper (clickIfVisible / runOptionalStep / …) on a recorded action (R8)

## OUTPUT CONTRACT
Respond with ONLY a single JSON object — no markdown fences, no commentary before or after.
Use standard JSON string escaping (\\n for newlines inside the string values).

{
  "featureFile": "<complete .feature file>",
  "stepDefinitions": "<complete TypeScript step definitions file>",
  "pageObject": "<complete TypeScript page object file>",
  "summary": "<one sentence: what flow the test covers>"
}

Every file must be complete and runnable exactly as emitted.`;
}
