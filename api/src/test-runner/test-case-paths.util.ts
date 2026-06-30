import * as path from 'path';

export interface GherkinTestPaths {
  featurePath: string;
  stepDefinitionsPath: string;
  pageObjectPath: string;
}

export function resolveGherkinPaths(filePath: string): GherkinTestPaths {
  const normalized = filePath.replace(/\\/g, '/');
  const featurePath = normalized.endsWith('.feature') ? normalized : `${normalized}.feature`;
  const slug = path.basename(featurePath, '.feature');
  return {
    featurePath,
    stepDefinitionsPath: path.join('steps', `${slug}.steps.ts`).replace(/\\/g, '/'),
    pageObjectPath: path.join('page-objects', `${slug}.page.ts`).replace(/\\/g, '/'),
  };
}
