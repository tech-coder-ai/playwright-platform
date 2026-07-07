export type LlmProvider = 'stellar' | 'openai';

const DEFAULT_STELLAR_URL = 'http://localhost:8080/apiv1/stellar/chat';

const DEFAULT_SYSTEM_PROMPT =
  'You are a senior test automation engineer. Follow the user instructions exactly and respond with ONLY a valid JSON object — no markdown fences, no commentary.';

export interface CompletePromptOptions {
  prompt: string;
  /** Required for the openai provider; unused by stellar. */
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
}

export function resolveLlmProvider(): LlmProvider {
  return process.env['LLM_PROVIDER'] === 'openai' ? 'openai' : 'stellar';
}

export function resolveStellarUrl(): string {
  return process.env['STELLAR_API_URL']?.trim() || DEFAULT_STELLAR_URL;
}

export function resolveLlmModel(model?: string): string {
  if (model) return model;
  if (resolveLlmProvider() === 'stellar') return 'stellar';
  return process.env['OPENAI_MODEL'] ?? 'gpt-4o';
}

export async function completePrompt(
  options: CompletePromptOptions,
): Promise<{ text: string; model: string }> {
  if (resolveLlmProvider() === 'stellar') {
    return completeWithStellar(options);
  }
  return completeWithOpenAi(options);
}

async function completeWithStellar(
  options: CompletePromptOptions,
): Promise<{ text: string; model: string }> {
  const url = resolveStellarUrl();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        userMessage: options.prompt,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Stellar LLM unreachable at ${url}: ${message}`);
  }

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Stellar LLM error (${response.status}): ${body}`);
  }

  const text = extractStellarText(body);
  if (!text) {
    throw new Error('Empty response from Stellar LLM');
  }

  return { text, model: options.model ?? 'stellar' };
}

/**
 * Pulls the completion text out of a stellar response. Accepts a plain-text
 * body or a JSON envelope with any of the common content field names.
 */
function extractStellarText(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';

  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return trimmed;
  }

  if (typeof payload === 'string') return payload.trim();
  if (typeof payload !== 'object' || payload === null) return trimmed;

  const record = payload as Record<string, unknown>;
  const candidateKeys = ['response', 'message', 'content', 'text', 'output', 'answer', 'result', 'completion', 'data'];
  for (const key of candidateKeys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object') {
      const nested = (value as Record<string, unknown>)['content'];
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
  }

  const choices = record['choices'];
  if (Array.isArray(choices)) {
    const content = (choices[0] as { message?: { content?: string } } | undefined)?.message?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
  }

  // The whole body may itself be the generated JSON artifact object.
  return trimmed;
}

async function completeWithOpenAi(
  options: CompletePromptOptions,
): Promise<{ text: string; model: string }> {
  if (!options.apiKey) {
    throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai');
  }
  const model = resolveLlmModel(options.model);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 8192,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT },
        { role: 'user', content: options.prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('Empty response from OpenAI API');
  }

  return { text, model };
}

export function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;

  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match?.[1]) return match[1].trim();

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  throw new Error('No JSON object found in LLM response');
}
