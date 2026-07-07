import * as path from 'path';

/**
 * Resolves the JS entry point of a CLI installed in (or hoisted above) the
 * tests workspace, so it can be spawned as `node <script> ...args`.
 *
 * Spawning `npx` directly breaks on Windows (spawn EINVAL/ENOENT — `npx` is a
 * .cmd shim and Node blocks .cmd spawns without a shell), so we always spawn
 * `process.execPath` with the resolved script instead.
 */
export function resolvePlaywrightCli(testsRoot: string): string {
  return require.resolve('@playwright/test/cli', { paths: [testsRoot] });
}

export function resolveCucumberCli(testsRoot: string): string {
  // The bin file is not listed in the package "exports" map, so resolve the
  // package root via package.json and join the known bin path.
  const packageJsonPath = require.resolve('@cucumber/cucumber/package.json', {
    paths: [testsRoot],
  });
  return path.join(path.dirname(packageJsonPath), 'bin', 'cucumber.js');
}
