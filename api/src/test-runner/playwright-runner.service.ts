import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { RunArtifactsConfig } from '@playwright-platform/shared-types';
import { getRunArtifactDir, getTestsRoot } from './paths.util';
import { buildArtifactEnvVars } from './run-artifacts.util';
import { buildPlaywrightBrowserEnv } from '../common/browser-env.util';
import { resolveCucumberCli, resolvePlaywrightCli } from '../common/cli-path.util';

export interface PlaywrightRunResult {
  exitCode: number;
  log: string;
  reportPath: string;
  outputDir: string;
  artifactPaths: string[];
}

export interface RunPlaywrightOptions {
  headed?: boolean;
  artifacts?: RunArtifactsConfig;
}

export async function runPlaywrightSpec(
  runId: string,
  specFile: string,
  env: Record<string, string>,
  options: RunPlaywrightOptions = {},
): Promise<PlaywrightRunResult> {
  // Playwright treats the file argument as a pattern; forward slashes match on
  // every OS, backslashes (a Windows-style path from the DB/UI) never do.
  const normalizedSpec = specFile.replace(/\\/g, '/');
  const args = [
    resolvePlaywrightCli(getTestsRoot()),
    'test',
    normalizedSpec,
    '--config=playwright.config.ts',
  ];
  if (options.headed) {
    args.push('--headed');
  }
  return runPlaywrightCommand(runId, normalizedSpec, args, env, options);
}

export async function runGherkinFeature(
  runId: string,
  featureFile: string,
  env: Record<string, string>,
  options: RunPlaywrightOptions = {},
): Promise<PlaywrightRunResult> {
  const resolvedFeature = resolveFeaturePath(featureFile);
  const slug = path.basename(resolvedFeature, '.feature');
  // CLI arguments use POSIX separators on every OS: cucumber resolves
  // --require through glob matching, where a Windows backslash is an escape
  // character and silently loads nothing.
  const stepFile = `steps/${slug}.steps.ts`;
  const stepPath = path.join(getTestsRoot(), 'steps', `${slug}.steps.ts`);

  try {
    await fs.access(stepPath);
  } catch {
    throw new Error(`Step definitions not found: ${stepFile}`);
  }

  return runPlaywrightCommand(runId, resolvedFeature, [
    resolveCucumberCli(getTestsRoot()),
    resolvedFeature,
    '--config',
    'cucumber.config.js',
    '--require',
    stepFile,
  ], env, options);
}

async function runPlaywrightCommand(
  runId: string,
  caseLabel: string,
  args: string[],
  env: Record<string, string>,
  options: RunPlaywrightOptions = {},
): Promise<PlaywrightRunResult> {
  const headed = options.headed ?? false;
  const artifacts = options.artifacts;
  const runDir = getRunArtifactDir(runId);
  const caseDir = path.join(runDir, sanitizeDirName(caseLabel));
  await fs.mkdir(caseDir, { recursive: true });

  const logPath = path.join(caseDir, 'output.log');
  const reportPath = path.join(caseDir, 'report.json');
  const outputDir = path.join(caseDir, 'playwright-output');
  const videoDir = path.join(caseDir, 'videos');
  const screenshotDir = path.join(caseDir, 'screenshots');

  const artifactEnv = artifacts
    ? buildArtifactEnvVars(artifacts, { videoDir, screenshotDir })
    : {};

  const runEnv = {
    ...process.env,
    ...env,
    ...artifactEnv,
    ...buildPlaywrightBrowserEnv(),
    PW_OUTPUT_DIR: outputDir,
    PW_JSON_REPORT: reportPath,
    CUCUMBER_JSON_REPORT: reportPath,
    PW_HEADLESS: headed ? 'false' : 'true',
  };

  const testsRoot = getTestsRoot();
  const { exitCode, log } = await spawnProcess(process.execPath, args, testsRoot, runEnv);
  await fs.writeFile(logPath, log, 'utf8');

  const artifactPaths = await collectArtifacts(caseDir, runId);

  return {
    exitCode,
    log,
    reportPath,
    outputDir,
    artifactPaths,
  };
}

function resolveFeaturePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.endsWith('.feature')) return normalized;
  return `${normalized}.feature`;
}

async function spawnProcess(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ exitCode: number; log: string }> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    const child = spawn(command, args, { cwd, env, shell: false });

    child.stdout.on('data', (data: Buffer) => chunks.push(data.toString()));
    child.stderr.on('data', (data: Buffer) => chunks.push(data.toString()));

    child.on('close', (code) => {
      resolve({ exitCode: code ?? 1, log: chunks.join('') });
    });

    child.on('error', (error) => {
      chunks.push(`\nProcess error: ${error.message}\n`);
      resolve({ exitCode: 1, log: chunks.join('') });
    });
  });
}

async function collectArtifacts(caseDir: string, runId: string): Promise<string[]> {
  const artifacts: string[] = [];
  const runRelative = path.relative(getRunArtifactDir(runId), caseDir);

  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (isArtifactFile(entry.name)) {
        const relative = path.join(runRelative, path.relative(caseDir, fullPath));
        artifacts.push(relative.replace(/\\/g, '/'));
      }
    }
  }

  await walk(caseDir);
  return artifacts;
}

function isArtifactFile(name: string): boolean {
  return /\.(png|jpg|jpeg|webm|zip|json|log|html|md)$/i.test(name) && name !== 'report.json';
}

function sanitizeDirName(specFile: string): string {
  return specFile.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export function getCaseOutputLogPath(runId: string, caseLabel: string): string {
  return path.join(getRunArtifactDir(runId), sanitizeDirName(caseLabel), 'output.log');
}

export async function readCaseOutputLog(runId: string, caseLabel: string): Promise<string | null> {
  try {
    return await fs.readFile(getCaseOutputLogPath(runId, caseLabel), 'utf8');
  } catch {
    return null;
  }
}

export async function appendRunLog(runId: string, text: string): Promise<string> {
  const logPath = path.join(getRunArtifactDir(runId), 'run.log');
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, text, 'utf8');
  return logPath;
}

export async function readRunLog(runId: string): Promise<string | null> {
  const logPath = path.join(getRunArtifactDir(runId), 'run.log');
  try {
    return await fs.readFile(logPath, 'utf8');
  } catch {
    return null;
  }
}

export function resolveArtifactPath(runId: string, relativePath: string): string {
  const runDir = getRunArtifactDir(runId);
  const resolved = path.resolve(runDir, relativePath);
  // path.relative-based containment: unlike a startsWith check it cannot be
  // fooled by sibling dirs sharing a prefix and is separator/case-correct on
  // Windows as well as POSIX.
  const relative = path.relative(runDir, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid artifact path');
  }
  return resolved;
}
