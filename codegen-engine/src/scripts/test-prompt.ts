#!/usr/bin/env node
/**
 * Standalone script to test LLM prompt generation.
 * Usage: node dist/scripts/test-prompt.js [path-to-recording.ts]
 * Uses the stellar provider by default; set LLM_PROVIDER=openai and
 * OPENAI_API_KEY=... to test against OpenAI.
 */
import * as fs from 'fs';
import * as path from 'path';
import { generateFromCodegen } from '../generate';
import { resolveLlmProvider } from '../llm-client';

async function main() {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (resolveLlmProvider() === 'openai' && !apiKey) {
    console.error('Set OPENAI_API_KEY (required when LLM_PROVIDER=openai)');
    process.exit(1);
  }

  const inputPath = process.argv[2] ?? path.join(__dirname, '../../fixtures/sample-recording.spec.ts');
  const codegenOutput = fs.readFileSync(inputPath, 'utf8');

  const result = await generateFromCodegen({
    codegenOutput,
    targetUrl: 'https://example.com',
    apiKey,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
