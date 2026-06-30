import * as path from 'path';

export function getRepoRoot(): string {
  return path.resolve(__dirname, '../../..');
}

function resolveConfiguredPath(configured: string | undefined, fallback: string): string {
  if (!configured) return fallback;
  if (path.isAbsolute(configured)) return configured;
  return path.resolve(process.cwd(), configured);
}

export function getArtifactsRoot(): string {
  return resolveConfiguredPath(process.env['ARTIFACTS_DIR'], path.join(getRepoRoot(), 'artifacts'));
}

export function getTestsRoot(): string {
  return resolveConfiguredPath(process.env['TESTS_DIR'], path.join(getRepoRoot(), 'tests'));
}

export function getRunArtifactDir(runId: string): string {
  return path.join(getArtifactsRoot(), runId);
}
