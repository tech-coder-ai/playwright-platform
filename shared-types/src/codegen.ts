export type CodegenSessionStatus = 'starting' | 'recording' | 'stopped' | 'error';

export type CodegenSessionMode = 'test' | 'page-object';

export interface CodegenSessionMeta {
  id: string;
  projectId: string;
  url: string;
  mode: CodegenSessionMode;
  targetPageObjectId?: string;
  status: CodegenSessionStatus;
  outputRelativePath: string;
  content: string;
  errorMessage?: string;
  startedAt: string;
  endedAt?: string;
}

export interface StartCodegenDto {
  projectId: string;
  url: string;
  mode?: CodegenSessionMode;
  targetPageObjectId?: string;
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
