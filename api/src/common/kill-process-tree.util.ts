import { spawn, type ChildProcess } from 'child_process';

/**
 * Stops a spawned CLI and everything it launched, on any OS.
 *
 * POSIX: a signal to the CLI is enough — Playwright/cucumber handle SIGINT/
 * SIGTERM and close their browsers.
 *
 * Windows: signals do not exist; `child.kill()` force-terminates only the CLI
 * itself, orphaning its Chromium children (a recording browser would stay
 * open forever). `taskkill /T` takes down the whole process tree.
 */
export function killProcessTree(
  child: ChildProcess | undefined,
  signal: 'SIGINT' | 'SIGTERM' = 'SIGTERM',
): void {
  if (!child || child.pid === undefined || child.killed || child.exitCode !== null) {
    return;
  }
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }).on(
      'error',
      // taskkill missing/blocked — fall back to killing at least the CLI.
      () => child.kill(),
    );
  } else {
    child.kill(signal);
  }
}
