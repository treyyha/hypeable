import { describe, expect, it } from 'vitest';
import { providerNeedsUiKey } from './ModelKeyPopover';

describe('providerNeedsUiKey', () => {
  it('asks for a key on hosted providers and OpenAILike', () => {
    expect(providerNeedsUiKey('OpenAI')).toBe(true);
    expect(providerNeedsUiKey('OpenAILike')).toBe(true);
    expect(providerNeedsUiKey(undefined)).toBe(true);
  });

  it('skips the key field for local Ollama and LM Studio', () => {
    expect(providerNeedsUiKey('Ollama')).toBe(false);
    expect(providerNeedsUiKey('LMStudio')).toBe(false);
  });
});
