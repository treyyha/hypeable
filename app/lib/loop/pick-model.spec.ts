import { describe, expect, it } from 'vitest';
import { pickStrongerModel } from './pick-model';

const models = [
  { name: 'claude-haiku-4-5', provider: 'Anthropic' },
  { name: 'claude-opus-4-6', provider: 'Anthropic' },
  { name: 'gpt-5.4', provider: 'OpenAI' },
  { name: 'gpt-4o-mini', provider: 'OpenAI' },
  { name: 'gemini-2.5-pro', provider: 'Google' },
];

describe('pickStrongerModel', () => {
  it('prefers a stronger model on a different provider the user has a key for', () => {
    const picked = pickStrongerModel({
      currentModel: 'claude-haiku-4-5',
      currentProvider: 'Anthropic',
      models,
      apiKeys: { OpenAI: 'present', Anthropic: 'present' },
    });

    expect(picked?.provider).toBe('OpenAI');
    expect(picked?.name).toBe('gpt-5.4');
  });

  it('falls back to a stronger model on the same family when that is all they have', () => {
    const picked = pickStrongerModel({
      currentModel: 'claude-haiku-4-5',
      currentProvider: 'Anthropic',
      models,
      apiKeys: { Anthropic: 'present' },
    });

    expect(picked).toEqual({ name: 'claude-opus-4-6', provider: 'Anthropic' });
  });

  it('returns undefined when no other keyed model exists', () => {
    expect(
      pickStrongerModel({
        currentModel: 'claude-haiku-4-5',
        currentProvider: 'Anthropic',
        models: [{ name: 'claude-haiku-4-5', provider: 'Anthropic' }],
        apiKeys: { Anthropic: 'present' },
      }),
    ).toBeUndefined();
  });
});
