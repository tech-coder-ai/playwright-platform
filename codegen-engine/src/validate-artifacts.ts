export interface GeneratedArtifactContents {
  featureFile: string;
  stepDefinitions: string;
  pageObject: string;
}

const WAIT_MARKERS = [
  'waitFor(',
  'waitForElement(',
  'isVisible(',
  'clickIfVisible(',
  'clickRoleIfVisible(',
  'interactWhenVisible(',
  'runOptionalStep(',
  'clickButton(',
  'fillForm(',
  'assertVisible(',
  'toBeVisible(',
];

/** Lines that interact with the page and therefore need a preceding wait. */
const BARE_INTERACTION = /\.(click|fill|press|selectOption|check|uncheck)\(/;

export function extractPageObjectClassName(pageObject: string): string | undefined {
  return /export\s+(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(pageObject)?.[1];
}

/** Parses executable step lines (Given/When/Then/And/But/*) out of a feature file. */
export function extractFeatureSteps(featureFile: string): string[] {
  const steps: string[] = [];
  for (const rawLine of featureFile.split('\n')) {
    const line = rawLine.trim();
    const match = /^(Given|When|Then|And|But|\*)\s+(.+)$/.exec(line);
    if (match) steps.push(match[2].trim());
  }
  return steps;
}

/** Extracts cucumber expressions / regexes registered in a step definition file. */
export function extractStepExpressions(stepDefinitions: string): RegExp[] {
  const expressions: RegExp[] = [];

  const stringPattern = /\b(?:Given|When|Then)\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  for (const match of stepDefinitions.matchAll(stringPattern)) {
    const regex = cucumberExpressionToRegExp(match[2]);
    if (regex) expressions.push(regex);
  }

  const regexPattern = /\b(?:Given|When|Then)\s*\(\s*\/((?:\\.|[^/])+)\/([a-z]*)/g;
  for (const match of stepDefinitions.matchAll(regexPattern)) {
    try {
      expressions.push(new RegExp(match[1], match[2].replace('g', '')));
    } catch {
      // Malformed regex — surfaced separately by the unmatched-step check.
    }
  }

  return expressions;
}

/** Converts a cucumber expression into an anchored RegExp for matching step text. */
function cucumberExpressionToRegExp(expression: string): RegExp | undefined {
  const PLACEHOLDER = '\u0000';
  const params: string[] = [];

  const withTokens = expression.replace(/\{(string|int|float|word|[^}]*)\}/g, (_all, kind) => {
    switch (kind) {
      case 'string':
        params.push('("[^"]*"|\'[^\']*\')');
        break;
      case 'int':
        params.push('(-?\\d+)');
        break;
      case 'float':
        params.push('(-?\\d*\\.?\\d+)');
        break;
      case 'word':
        params.push('([^\\s]+)');
        break;
      default:
        params.push('(.*)');
        break;
    }
    return PLACEHOLDER;
  });

  let escaped = withTokens.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Cucumber optional text: `word(s)` — the parens were escaped above.
  escaped = escaped.replace(/\\\(([^)]+)\\\)/g, '(?:$1)?');
  // Cucumber alternation: `is/are` → (?:is|are). Skip expressions containing
  // URLs, where slashes are literal.
  if (!expression.includes('://')) {
    escaped = escaped.replace(/([^\s\\/]+)(?:\/([^\s\\/]+))+/g, (group) => `(?:${group.split('/').join('|')})`);
  }

  let index = 0;
  const pattern = escaped.replace(new RegExp(PLACEHOLDER, 'g'), () => params[index++] ?? '(.*)');

  try {
    return new RegExp(`^${pattern}$`);
  } catch {
    return undefined;
  }
}

/**
 * Hard validation — failures here mean cucumber cannot execute the test at all
 * (missing files, undefined steps, broken page object wiring).
 */
export function collectValidationErrors(artifacts: GeneratedArtifactContents): string[] {
  const errors: string[] = [];

  if (!artifacts.featureFile.trim()) errors.push('featureFile is empty');
  if (!artifacts.featureFile.includes('Feature:')) errors.push('featureFile missing Feature: keyword');
  if (!artifacts.stepDefinitions.trim()) errors.push('stepDefinitions is empty');
  if (!artifacts.pageObject.trim()) errors.push('pageObject is empty');

  const className = extractPageObjectClassName(artifacts.pageObject);
  if (artifacts.pageObject.trim() && !className) {
    errors.push('pageObject has no exported class');
  }

  // Every feature step must be matched by a step definition, otherwise the
  // run fails with "undefined step" before the browser even opens.
  if (artifacts.featureFile.trim() && artifacts.stepDefinitions.trim()) {
    const expressions = extractStepExpressions(artifacts.stepDefinitions);
    for (const step of extractFeatureSteps(artifacts.featureFile)) {
      if (!expressions.some((expression) => expression.test(step))) {
        errors.push(`No step definition matches feature step: "${step}"`);
      }
    }
  }

  // If step definitions import from ../page-objects/, the imported name must be
  // the class the page object actually exports.
  const importMatch = /import\s*\{([^}]+)\}\s*from\s*['"](\.\.?\/page-objects\/[^'"]+)['"]/.exec(
    artifacts.stepDefinitions,
  );
  if (importMatch && className) {
    const importedNames = importMatch[1].split(',').map((name) => name.trim().split(/\s+as\s+/)[0]);
    if (!importedNames.includes(className)) {
      errors.push(
        `stepDefinitions imports "${importMatch[1].trim()}" from page-objects but the page object exports class "${className}"`,
      );
    }
  }

  return errors;
}

const LOCATOR_FRAGMENT =
  /\.(getByRole|getByText|getByLabel|getByPlaceholder|getByTestId|getByTitle|getByAltText|locator)\(((?:[^()]|\([^()]*\))*)\)/g;

/** Keys/values allowed inside a locator argument without making it "parameterized". */
const LOCATOR_ARG_KEYWORDS = new Set([
  'name', 'exact', 'hasText', 'hasNotText', 'has', 'hasNot', 'level',
  'checked', 'selected', 'expanded', 'pressed', 'disabled', 'includeHidden',
  'true', 'false', 'new', 'RegExp', 'i', 'g',
]);

function normalizeLocatorText(text: string): string {
  return text.replace(/["`]/g, "'").replace(/\s+/g, ' ').trim();
}

/** True when the locator args reference variables (step params) — skip those. */
function isParameterizedLocator(args: string): boolean {
  const withoutLiterals = args
    .replace(/'(?:\\.|[^'\\])*'/g, '')
    .replace(/\/(?:\\.|[^/\\])+\/[a-z]*/g, '');
  const identifiers = withoutLiterals.match(/[A-Za-z_$][\w$]*/g) ?? [];
  return identifiers.some((identifier) => !LOCATOR_ARG_KEYWORDS.has(identifier));
}

function extractLocatorFragments(code: string): string[] {
  const fragments: string[] = [];
  for (const match of code.matchAll(LOCATOR_FRAGMENT)) {
    fragments.push(`.${match[1]}(${match[2]})`);
  }
  return fragments;
}

/**
 * Actions must target locators that appear in the codegen recording — codegen
 * already proved those work. Flags "improved" locators the LLM invented
 * (e.g. swapping a recorded CSS hamburger-button locator for a
 * getByRole('menuitem') guess that does not exist on the page).
 * Assertion-only locators are not checked; codegen does not record assertions.
 */
export function collectLocatorFidelityWarnings(
  codegenOutput: string,
  artifacts: GeneratedArtifactContents,
): string[] {
  const warnings: string[] = [];
  const recording = normalizeLocatorText(codegenOutput);
  if (!recording) return warnings;

  const isActionLine = (line: string) =>
    BARE_INTERACTION.test(line) || /\b(waitAndClick|waitAndFill|openMenu)\s*\(/.test(line);

  for (const [label, content] of [
    ['stepDefinitions', artifacts.stepDefinitions],
    ['pageObject', artifacts.pageObject],
  ] as const) {
    const lines = content.split('\n');

    // Locators bound to fields/consts, so `this.trigger.click()` can be traced
    // back to the locator it was built from.
    const boundLocators = new Map<string, string[]>();
    for (const line of lines) {
      const binding = /(?:readonly\s+|const\s+|let\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[\w.<>\[\]]+\s*)?=\s*(?:this\.)?page\b(.*)$/.exec(
        line.trim(),
      );
      if (binding) boundLocators.set(binding[1], extractLocatorFragments(binding[2]));
    }

    const flagged = new Set<string>();
    for (const line of lines) {
      if (!isActionLine(line)) continue;

      const fragments = extractLocatorFragments(line);
      for (const name of line.matchAll(/(?:this\.)?([A-Za-z_$][\w$]*)/g)) {
        fragments.push(...(boundLocators.get(name[1]) ?? []));
      }

      for (const fragment of fragments) {
        const [, args = ''] = /\((.*)\)$/s.exec(fragment) ?? [];
        if (isParameterizedLocator(args)) continue;
        const normalized = normalizeLocatorText(fragment);
        if (!recording.includes(normalized) && !flagged.has(normalized)) {
          flagged.add(normalized);
          warnings.push(
            `${label}: action uses locator not present in the recording: ${fragment} — reuse the EXACT locator chain codegen recorded (do not invent roles/names for icon buttons or menu items)`,
          );
        }
      }
    }
  }

  return warnings;
}

/**
 * Soft lint — the test may run, but flakes on slow apps. Used to trigger an
 * LLM repair pass, not to block saving user-edited content.
 */
export function collectResilienceWarnings(artifacts: GeneratedArtifactContents): string[] {
  const warnings: string[] = [];

  for (const [label, content] of [
    ['stepDefinitions', artifacts.stepDefinitions],
    ['pageObject', artifacts.pageObject],
  ] as const) {
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      if (/\.goto\(/.test(line)) {
        const statement = lines.slice(i, i + 4).join(' ');
        if (!/timeout/.test(statement)) {
          warnings.push(
            `${label} line ${i + 1}: page.goto() without an explicit timeout — use the navigate() helper or goto(url, { waitUntil: 'commit', timeout: 180_000 })`,
          );
        }
      }

      if (BARE_INTERACTION.test(line) && !WAIT_MARKERS.some((marker) => line.includes(marker))) {
        const context = lines.slice(Math.max(0, i - 6), i + 1).join('\n');
        if (!WAIT_MARKERS.some((marker) => context.includes(marker))) {
          warnings.push(
            `${label} line ${i + 1}: interaction without a preceding visibility wait — call waitFor({ state: 'visible', timeout: 15_000 }) first or use a helper (clickIfVisible, clickButton, fillForm, ...)`,
          );
        }
      }
    });
  }

  return warnings;
}
