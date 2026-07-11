export type CodegenSessionStatus = 'starting' | 'recording' | 'stopped' | 'error';

export type CodegenSessionMode = 'test' | 'page-object';

/**
 * How the recording browser runs:
 * - `local`  — `playwright codegen` opens a headed browser on the machine
 *              running the API (original behavior; fine for local dev).
 * - `remote` — headless browser on the server, streamed into the web UI over
 *              CDP screencast; user input is forwarded back. Required when
 *              the platform is deployed on a server.
 */
export type CodegenRecorderMode = 'local' | 'remote';

export interface CodegenSessionMeta {
  id: string;
  projectId: string;
  url: string;
  mode: CodegenSessionMode;
  recorder: CodegenRecorderMode;
  targetPageObjectId?: string;
  status: CodegenSessionStatus;
  outputRelativePath: string;
  content: string;
  errorMessage?: string;
  startedAt: string;
  endedAt?: string;
  viewport?: { width: number; height: number };
}

export interface StartCodegenDto {
  projectId: string;
  url: string;
  mode?: CodegenSessionMode;
  recorder?: CodegenRecorderMode;
  targetPageObjectId?: string;
}

/** One JPEG frame of the remote (server-side) recording browser. */
export interface ScreencastFramePayload {
  sessionId: string;
  /** Base64-encoded JPEG. */
  data: string;
  /** CSS pixel size of the remote viewport the frame was captured at. */
  width: number;
  height: number;
}

export interface RemoteMouseEvent {
  kind: 'mouse';
  type: 'mousedown' | 'mouseup' | 'mousemove' | 'wheel';
  /** Coordinates in remote-viewport CSS pixels. */
  x: number;
  y: number;
  button?: 'left' | 'middle' | 'right';
  clickCount?: number;
  deltaX?: number;
  deltaY?: number;
  /** CDP modifier bitmask: 1=Alt, 2=Ctrl, 4=Meta, 8=Shift. */
  modifiers?: number;
}

export interface RemoteKeyboardEvent {
  kind: 'keyboard';
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  /** Printable text for the key, when any. */
  text?: string;
  modifiers?: number;
}

export type RemoteInputEvent = RemoteMouseEvent | RemoteKeyboardEvent;

export interface RemoteInputDto {
  sessionId: string;
  event: RemoteInputEvent;
}

export interface RemoteResizeDto {
  sessionId: string;
  width: number;
  height: number;
}

export interface GeneratedTestArtifacts {
  featureFile: string;
  stepDefinitions: string;
  pageObject: string;
  summary: string;
  rawRecording: string;
  model: string;
}

export interface SaveGeneratedTestDto {
  suiteId: string;
  testCaseName: string;
  screenName: string;
  featureFile: string;
  stepDefinitions: string;
  pageObject: string;
}

export interface SavedGeneratedTestResult {
  testCaseId: string;
  pageObjectId: string;
  featurePath: string;
  stepDefinitionsPath: string;
  pageObjectPath: string;
}

export interface GeneratedPageObjectArtifacts {
  pageObject: string;
  className: string;
  summary: string;
  rawRecording: string;
  model: string;
}

export interface SavePageObjectDto {
  name: string;
  screenName: string;
  pageObject: string;
  existingPageObjectId?: string;
}

export interface SavedPageObjectResult {
  pageObjectId: string;
  classFilePath: string;
  version: number;
  patched: boolean;
}
