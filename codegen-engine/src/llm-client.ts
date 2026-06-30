export interface CompletePromptOptions {
  prompt: string;
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export function resolveLlmModel(model?: string): string {
  return model ?? process.env['OPENAI_MODEL'] ?? 'gpt-4o';
}

export async function completePrompt(
  options: CompletePromptOptions,
): Promise<{ text: string; model: string }> {
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
      messages: [{ role: 'user', content: options.prompt }],
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
