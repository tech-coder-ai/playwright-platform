export type ScreenshotCaptureMode = 'off' | 'on-failure' | 'on';

export type VideoCaptureMode = 'off' | 'on-failure' | 'on';

export interface RunArtifactsConfig {
  screenshot: ScreenshotCaptureMode;
  video: VideoCaptureMode;
}

export const DEFAULT_RUN_ARTIFACTS_CONFIG: RunArtifactsConfig = {
  screenshot: 'on-failure',
  video: 'on-failure',
};

export interface TestStepDetail {
  order: number;
  name: string;
  keyword?: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  durationMs?: number;
  errorMessage?: string;
}
