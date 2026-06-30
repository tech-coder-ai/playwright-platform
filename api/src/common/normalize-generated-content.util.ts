export function normalizeGeneratedContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return trimmed;

  // LLM JSON occasionally returns literal \n sequences instead of real newlines.
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
