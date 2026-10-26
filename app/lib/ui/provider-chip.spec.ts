import { describe, expect, it } from 'vitest';
import { providerChipMeta } from './provider-chip';

describe('providerChipMeta', () => {
  it('maps known providers to two-letter codes', () => {
    expect(providerChipMeta('OpenAI').code).toBe('OA');
    expect(providerChipMeta('Anthropic').code).toBe('AN');
    expect(providerChipMeta('Google').code).toBe('GG');
    expect(providerChipMeta('OpenRouter').code).toBe('OR');
    expect(providerChipMeta('Deepseek').code).toBe('DS');
    expect(providerChipMeta('Ollama').code).toBe('OL');
    expect(providerChipMeta('OpenAILike').code).toBe('OK');
  });

  it('falls back to two letters for unknown names', () => {
    expect(providerChipMeta('CustomLab').code).toBe('CU');
    expect(providerChipMeta(undefined).code).toBe('UN');
  });
});
