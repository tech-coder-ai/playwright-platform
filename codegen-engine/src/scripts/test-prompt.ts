#!/usr/bin/env node
/**
 * Standalone script to test LLM prompt generation.
 * Usage: OPENAI_API_KEY=... node dist/scripts/test-prompt.js [path-to-recording.ts]
 */
import * as fs from 'fs';
import * as path from 'path';
import { generateFromCodegen } from '../generate';

async function main() {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('Set OPENAI_API_KEY');
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
