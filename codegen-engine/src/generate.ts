import { buildGherkinGenerationPrompt } from './prompts/gherkin-from-codegen';
import { completePrompt, extractJsonBlock, resolveLlmModel } from './llm-client';

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

export interface GeneratedArtifacts {
  featureFile: string;
  stepDefinitions: string;
  pageObject: string;
  summary: string;
  rawRecording: string;
  model: string;
}

export interface GenerateOptions {
  codegenOutput: string;
  targetUrl: string;
  apiKey: string;
  model?: string;
}

export async function generateFromCodegen(options: GenerateOptions): Promise<GeneratedArtifacts> {
  const prompt = buildGherkinGenerationPrompt(options.codegenOutput, options.targetUrl);

  const { text, model } = await completePrompt({
    prompt,
    apiKey: options.apiKey,
    model: options.model ?? resolveLlmModel(),
    maxTokens: 8192,
  });

  const parsed = parseGeneratedJson(text);
  validateGeneratedArtifacts(parsed);

  return {
    ...parsed,
    rawRecording: options.codegenOutput,
    model,
  };
}

function parseGeneratedJson(text: string): Omit<GeneratedArtifacts, 'rawRecording' | 'model'> {
  const jsonText = extractJsonBlock(text);

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return {
      featureFile: normalizeGeneratedContent(String(parsed['featureFile'] ?? '')),
      stepDefinitions: normalizeGeneratedContent(String(parsed['stepDefinitions'] ?? '')),
      pageObject: normalizeGeneratedContent(String(parsed['pageObject'] ?? '')),
      summary: String(parsed['summary'] ?? ''),
    };
  } catch (error) {
    throw new Error(`Failed to parse LLM JSON: ${error instanceof Error ? error.message : 'unknown'}`);
  }
}

export function validateGeneratedArtifacts(artifacts: {
  featureFile: string;
  stepDefinitions: string;
  pageObject: string;
}): void {
  const errors: string[] = [];

  if (!artifacts.featureFile.trim()) errors.push('featureFile is empty');
  if (!artifacts.featureFile.includes('Feature:')) errors.push('featureFile missing Feature: keyword');
  if (!artifacts.stepDefinitions.trim()) errors.push('stepDefinitions is empty');
  if (!artifacts.pageObject.trim()) errors.push('pageObject is empty');
  if (!artifacts.pageObject.includes('class ')) errors.push('pageObject missing class definition');

  if (errors.length > 0) {
    throw new Error(`Generated artifacts failed validation: ${errors.join('; ')}`);
  }
}

export { buildGherkinGenerationPrompt } from './prompts/gherkin-from-codegen';
export { HELPER_CATALOG } from './helpers-catalog';
