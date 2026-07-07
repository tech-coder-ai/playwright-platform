import { BadRequestException } from '@nestjs/common';

export type LlmProvider = 'stellar' | 'openai';

/** stellar (local endpoint, no key) is the default; set LLM_PROVIDER=openai to switch. */
export function getLlmProvider(): LlmProvider {
  return process.env['LLM_PROVIDER'] === 'openai' ? 'openai' : 'stellar';
}

export function getOpenAiApiKey(): string | undefined {
  return process.env['OPENAI_API_KEY']?.trim() || undefined;
}

/** Returns the API key when the active provider needs one (openai only). */
export function requireLlmApiKey(): string | undefined {
  if (getLlmProvider() !== 'openai') {
    return undefined;
  }
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new BadRequestException(
      'OPENAI_API_KEY is not configured in api/.env (required when LLM_PROVIDER=openai)',
    );
  }
  return apiKey;
}
