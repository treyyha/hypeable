import { describe, expect, it } from 'vitest';
import { modelChipCaption, providerNeedsUiKey } from './ModelKeyPopover';

describe('modelChipCaption', () => {
  it('shows Add key text when the provider still needs a key', () => {
    expect(modelChipCaption({ keyReady: false, providerName: 'Anthropic', model: 'claude-3-5-sonnet-latest' })).toEqual(
      {
        visible: 'Add key',
        title: 'Add key. Anthropic · claude-3-5-sonnet-latest. Model and key',
      },
    );
  });

  it('shows provider and model when a key is present', () => {
    expect(modelChipCaption({ keyReady: true, providerName: 'OpenAILike', model: 'mock-model' })).toEqual({
      visible: 'OpenAILike · mock-model',
      title: 'OpenAILike · mock-model. Model and key',
    });
  });
});

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
