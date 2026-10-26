/**
 * Two-letter provider codes for inline model avatars. No remote images.
 */

export type ProviderChipTone = 'lime' | 'mint' | 'cyan' | 'warn' | 'muted';

export type ProviderChipMeta = {
  code: string;
  tone: ProviderChipTone;
  name: string;
};

type KnownProvider = {
  match: string;
  code: string;
  tone: ProviderChipTone;
};

const KNOWN: KnownProvider[] = [
  { match: 'openailike', code: 'OK', tone: 'lime' },
  { match: 'openrouter', code: 'OR', tone: 'mint' },
  { match: 'openai', code: 'OA', tone: 'lime' },
  { match: 'anthropic', code: 'AN', tone: 'warn' },
  { match: 'google', code: 'GG', tone: 'cyan' },
  { match: 'deepseek', code: 'DS', tone: 'cyan' },
  { match: 'ollama', code: 'OL', tone: 'muted' },
  { match: 'groq', code: 'GQ', tone: 'warn' },
  { match: 'mistral', code: 'MI', tone: 'warn' },
  { match: 'cohere', code: 'CO', tone: 'mint' },
  { match: 'huggingface', code: 'HF', tone: 'warn' },
  { match: 'together', code: 'TG', tone: 'cyan' },
  { match: 'fireworks', code: 'FW', tone: 'warn' },
  { match: 'perplexity', code: 'PX', tone: 'cyan' },
  { match: 'xai', code: 'XA', tone: 'muted' },
  { match: 'moonshot', code: 'MS', tone: 'mint' },
  { match: 'cerebras', code: 'CB', tone: 'warn' },
  { match: 'amazonbedrock', code: 'AB', tone: 'warn' },
  { match: 'github', code: 'GH', tone: 'muted' },
  { match: 'hyperbolic', code: 'HY', tone: 'mint' },
  { match: 'lmstudio', code: 'LM', tone: 'muted' },
  { match: 'openailike', code: 'OK', tone: 'lime' },
  { match: 'zai', code: 'ZA', tone: 'cyan' },
  { match: 'z.ai', code: 'ZA', tone: 'cyan' },
];

function normalizeProvider(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '');
}

function fallbackCode(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, '');

  if (letters.length >= 2) {
    return letters.slice(0, 2).toUpperCase();
  }

  return (name.trim().slice(0, 2) || '?').toUpperCase();
}

export function providerChipMeta(provider?: string): ProviderChipMeta {
  const name = provider?.trim() || 'Unknown';
  const normalized = normalizeProvider(name);

  const known =
    KNOWN.find((row) => normalized === row.match) ??
    KNOWN.find((row) => row.match.length > 2 && normalized.startsWith(row.match));

  if (known) {
    return { code: known.code, tone: known.tone, name };
  }

  return { code: fallbackCode(name), tone: 'muted', name };
}
