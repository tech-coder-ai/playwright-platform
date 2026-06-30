import * as path from 'path';
import { getArtifactsRoot } from '../test-runner/paths.util';

export function getCodegenSessionDir(sessionId: string): string {
  return path.join(getArtifactsRoot(), 'codegen', sessionId);
}

export function getCodegenOutputPath(sessionId: string, mode: 'test' | 'page-object' = 'test'): string {
  const filename = mode === 'page-object' ? 'page-object-recording.spec.ts' : 'recording.spec.ts';
  return path.join(getCodegenSessionDir(sessionId), filename);
}

export function getCodegenRelativeOutputPath(
  sessionId: string,
  mode: 'test' | 'page-object' = 'test',
): string {
  const filename = mode === 'page-object' ? 'page-object-recording.spec.ts' : 'recording.spec.ts';
  return path.join('codegen', sessionId, filename).replace(/\\/g, '/');
}
