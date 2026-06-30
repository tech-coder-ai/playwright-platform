import {
  DEFAULT_RUN_ARTIFACTS_CONFIG,
  RunArtifactsConfig,
  ScreenshotCaptureMode,
  VideoCaptureMode,
} from '@playwright-platform/shared-types';

export function parseRunArtifactsConfig(raw: string | null | undefined): RunArtifactsConfig {
  if (!raw) return { ...DEFAULT_RUN_ARTIFACTS_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<RunArtifactsConfig>;
    return {
      screenshot: normalizeScreenshotMode(parsed.screenshot),
      video: normalizeVideoMode(parsed.video),
    };
  } catch {
    return { ...DEFAULT_RUN_ARTIFACTS_CONFIG };
  }
}

export function serializeRunArtifactsConfig(config: RunArtifactsConfig): string {
  return JSON.stringify({
    screenshot: normalizeScreenshotMode(config.screenshot),
    video: normalizeVideoMode(config.video),
  });
}

function normalizeScreenshotMode(value: unknown): ScreenshotCaptureMode {
  if (value === 'off' || value === 'on-failure' || value === 'on') return value;
  return DEFAULT_RUN_ARTIFACTS_CONFIG.screenshot;
}

function normalizeVideoMode(value: unknown): VideoCaptureMode {
  if (value === 'off' || value === 'on-failure' || value === 'on') return value;
  return DEFAULT_RUN_ARTIFACTS_CONFIG.video;
}

export function toPlaywrightScreenshotMode(mode: ScreenshotCaptureMode): 'off' | 'on' | 'only-on-failure' {
  if (mode === 'on') return 'on';
  if (mode === 'on-failure') return 'only-on-failure';
  return 'off';
}

export function toPlaywrightVideoMode(mode: VideoCaptureMode): 'off' | 'on' | 'retain-on-failure' {
  if (mode === 'on') return 'on';
  if (mode === 'on-failure') return 'retain-on-failure';
  return 'off';
}

export function buildArtifactEnvVars(
  config: RunArtifactsConfig,
  dirs: { videoDir: string; screenshotDir: string },
): Record<string, string> {
  return {
    PW_SCREENSHOT: config.screenshot,
    PW_VIDEO: config.video,
    PW_VIDEO_DIR: dirs.videoDir,
    PW_SCREENSHOT_DIR: dirs.screenshotDir,
  };
}
