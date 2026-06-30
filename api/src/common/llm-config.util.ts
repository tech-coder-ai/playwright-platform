import { BadRequestException } from '@nestjs/common';

export function getOpenAiApiKey(): string | undefined {
  return process.env['OPENAI_API_KEY']?.trim() || undefined;
}

export function requireOpenAiApiKey(): string {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new BadRequestException('OPENAI_API_KEY is not configured in api/.env');
  }
  return apiKey;
}
