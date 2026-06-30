import { buildPageObjectPrompt } from './prompts/page-object-from-codegen';
import { completePrompt, extractJsonBlock, resolveLlmModel } from './llm-client';

export interface GeneratedPageObjectArtifacts {
  pageObject: string;
  className: string;
  summary: string;
  rawRecording: string;
  model: string;
}

export interface GeneratePageObjectOptions {
  codegenOutput: string;
  targetUrl: string;
  screenName: string;
  componentName?: string;
  existingPageObject?: string;
  apiKey: string;
  model?: string;
}

export async function generatePageObjectFromCodegen(
  options: GeneratePageObjectOptions,
): Promise<GeneratedPageObjectArtifacts> {
  const prompt = buildPageObjectPrompt(
    options.codegenOutput,
    options.targetUrl,
    options.screenName,
    options.componentName,
    options.existingPageObject,
  );

  const { text, model } = await completePrompt({
    prompt,
    apiKey: options.apiKey,
    model: options.model ?? resolveLlmModel(),
    maxTokens: 4096,
  });

  const parsed = parsePageObjectJson(text);
  validatePageObject(parsed.pageObject, parsed.className);

  return {
    ...parsed,
    rawRecording: options.codegenOutput,
    model,
  };
}

function normalizeGeneratedContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return trimmed;
  const looksEscaped =
    trimmed.includes('\\n') && trimmed.split('\n').length <= 3 && trimmed.length > 80;
  if (!looksEscaped) return content;
  return trimmed
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function parsePageObjectJson(text: string): Omit<GeneratedPageObjectArtifacts, 'rawRecording' | 'model'> {
  const jsonText = extractJsonBlock(text);

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return {
      pageObject: normalizeGeneratedContent(String(parsed['pageObject'] ?? '')),
      className: String(parsed['className'] ?? ''),
      summary: String(parsed['summary'] ?? ''),
    };
  } catch (error) {
    throw new Error(`Failed to parse LLM JSON: ${error instanceof Error ? error.message : 'unknown'}`);
  }
}

export function validatePageObject(pageObject: string, className: string): void {
  const errors: string[] = [];
  if (!pageObject.trim()) errors.push('pageObject is empty');
  if (!className.trim()) errors.push('className is empty');
  if (!pageObject.includes('class ')) errors.push('pageObject missing class definition');
  if (className && !pageObject.includes(className)) {
    errors.push(`pageObject does not contain class ${className}`);
  }
  if (errors.length > 0) {
    throw new Error(`Generated page object failed validation: ${errors.join('; ')}`);
  }
}

export { buildPageObjectPrompt } from './prompts/page-object-from-codegen';
