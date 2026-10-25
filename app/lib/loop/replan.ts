/**
 * Structured prompt that asks for a different plan and waits for approval.
 */

export const AUTO_FIX_RE = /^\*Fix this (preview|terminal|deployment) error\*/i;

const MODEL_WRAP_RE = /^\[Model: .*?\]\n\n(?:\[Provider: .*?\]\n\n)?/;

export function unwrapChatPreamble(text: string): string {
  return text.trim().replace(MODEL_WRAP_RE, '');
}

export function isAutoFixRequest(text: string): boolean {
  return AUTO_FIX_RE.test(unwrapChatPreamble(text));
}

export function buildReplanPrompt(input: { error: string; count: number; tried?: readonly string[] }): string {
  const error = input.error.trim() || 'unknown error';
  const tried = (input.tried ?? []).map((item) => item.trim()).filter(Boolean);

  const triedBlock =
    tried.length > 0 ? tried.map((item) => `- ${item}`).join('\n') : '- repeating the same fix for this error';

  return [
    '[Hypeable loop breaker] The previous approach is stuck. Do NOT repeat it.',
    `The same error failed ${input.count} times:`,
    '```',
    error,
    '```',
    `Already tried:\n${triedBlock}`,
    'Explain a DIFFERENT approach in plain numbered steps.',
    'Wait for my approval before writing or editing any code.',
  ].join('\n\n');
}
