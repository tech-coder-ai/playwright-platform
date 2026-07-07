import { buildGherkinGenerationPrompt } from './prompts/gherkin-from-codegen';
import { completePrompt, extractJsonBlock, resolveLlmModel } from './llm-client';
import {
  collectLocatorFidelityWarnings,
  collectResilienceWarnings,
  collectValidationErrors,
} from './validate-artifacts';

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
  /** Required for the openai provider; unused by stellar. */
  apiKey?: string;
  model?: string;
}

export async function generateFromCodegen(options: GenerateOptions): Promise<GeneratedArtifacts> {
  const prompt = buildGherkinGenerationPrompt(options.codegenOutput, options.targetUrl);
  const llmModel = options.model ?? resolveLlmModel();

  const { text, model } = await completePrompt({
    prompt,
    apiKey: options.apiKey,
    model: llmModel,
    maxTokens: 8192,
  });

  const lint = (artifacts: ReturnType<typeof parseGeneratedJson>) => [
    ...collectResilienceWarnings(artifacts),
    ...collectLocatorFidelityWarnings(options.codegenOutput, artifacts),
  ];

  let parsed = parseGeneratedJson(text);
  let errors = collectValidationErrors(parsed);
  let warnings = lint(parsed);

  // One repair pass: feed the exact problems back so undefined steps, broken
  // page-object imports, and missing waits get fixed before the user sees them.
  if (errors.length > 0 || warnings.length > 0) {
    const repairPrompt = buildRepairPrompt(prompt, parsed, [...errors, ...warnings]);
    const repaired = await completePrompt({
      prompt: repairPrompt,
      apiKey: options.apiKey,
      model: llmModel,
      maxTokens: 8192,
    });

    try {
      const reparsed = parseGeneratedJson(repaired.text);
      const reerrors = collectValidationErrors(reparsed);
      // Keep the repaired version only when it is strictly no worse.
      if (reerrors.length <= errors.length) {
        parsed = reparsed;
        errors = reerrors;
        warnings = lint(reparsed);
      }
    } catch {
      // Repair response unparsable — fall back to the first attempt.
    }
  }

  if (errors.length > 0) {
    throw new Error(`Generated artifacts failed validation:\n- ${errors.join('\n- ')}`);
  }

  return {
    ...parsed,
    rawRecording: options.codegenOutput,
    model,
  };
}

function buildRepairPrompt(
  originalPrompt: string,
  artifacts: { featureFile: string; stepDefinitions: string; pageObject: string; summary: string },
  problems: string[],
): string {
  return `${originalPrompt}

Your previous answer had these problems:
${problems.map((problem) => `- ${problem}`).join('\n')}

Previous answer:
${JSON.stringify(artifacts)}

Fix EVERY listed problem and respond again with ONLY the complete corrected JSON object (same schema). Every Gherkin step in featureFile must have a matching Given/When/Then in stepDefinitions, the page-object import name must match the exported class, every interaction must be preceded by a visibility wait, and every action must use the EXACT locator chain from the codegen recording — never a substituted role/name guess.`;
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
  const errors = collectValidationErrors(artifacts);
  if (errors.length > 0) {
    throw new Error(`Generated artifacts failed validation: ${errors.join('; ')}`);
  }
}

export { buildGherkinGenerationPrompt } from './prompts/gherkin-from-codegen';
export { HELPER_CATALOG } from './helpers-catalog';
export {
  collectValidationErrors,
  collectResilienceWarnings,
  collectLocatorFidelityWarnings,
  extractPageObjectClassName,
} from './validate-artifacts';
