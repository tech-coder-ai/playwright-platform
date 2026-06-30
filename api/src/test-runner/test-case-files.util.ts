import * as fs from 'fs/promises';
import * as path from 'path';
import { getTestsRoot } from './paths.util';

export async function validateTestCaseFiles(
  type: string,
  filePath: string,
): Promise<string | null> {
  const testsRoot = getTestsRoot();
  const normalized = filePath.replace(/\\/g, '/');

  if (type === 'gherkin') {
    const featurePath = normalized.endsWith('.feature') ? normalized : `${normalized}.feature`;
    const slug = path.basename(featurePath, '.feature');
    const stepFile = path.join('steps', `${slug}.steps.ts`);
    const pageObjectFile = path.join('page-objects', `${slug}.page.ts`);

    for (const relativePath of [featurePath, stepFile, pageObjectFile]) {
      try {
        await fs.access(path.join(testsRoot, relativePath));
      } catch {
        return `Missing test file: ${relativePath}. Re-record the test or restore generated files under tests/.`;
      }
    }
    return null;
  }

  try {
    await fs.access(path.join(testsRoot, normalized));
  } catch {
    return `Missing test file: ${normalized}`;
  }
  return null;
}

export function extractRunnerError(log: string, fallback: string): string {
  const moduleMatch = log.match(/Error: Cannot find module '([^']+)'/);
  if (moduleMatch) {
    return `Missing dependency: ${moduleMatch[1]}. Re-record the test or restore generated files under tests/.`;
  }

  const errorLine = log
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('Error:'));

  return errorLine?.replace(/^Error:\s*/, '') ?? fallback;
}
