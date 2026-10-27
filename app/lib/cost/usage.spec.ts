import { describe, expect, it } from 'vitest';
import { encodeUsageMarker, extractTokenUsage, takeUsageMarker } from './usage';

describe('usage extraction', () => {
  it('reads flattened AI SDK usage', () => {
    expect(
      extractTokenUsage({
        inputTokens: 11,
        outputTokens: 7,
        totalTokens: 18,
      }),
    ).toMatchObject({
      promptTokens: 11,
      completionTokens: 7,
      totalTokens: 18,
      cachedTokens: 0,
      precision: 'exact',
    });
  });

  it('reads nested cache-read tokens and OpenRouter billed cost', () => {
    expect(
      extractTokenUsage({
        inputTokens: { total: 100, cacheRead: 40 },
        outputTokens: { total: 20 },
        cost: 0.0042,
      }),
    ).toMatchObject({
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
      cachedTokens: 40,
      cost: 0.0042,
    });
  });

  it('adds Anthropic sibling cache-read and cache-write tokens into prompt', () => {
    expect(
      extractTokenUsage({
        input_tokens: 100,
        cache_read_input_tokens: 40,
        cache_creation_input_tokens: 20,
        output_tokens: 10,
      }),
    ).toMatchObject({
      promptTokens: 160,
      uncachedPromptTokens: 100,
      completionTokens: 10,
      totalTokens: 170,
      cachedTokens: 40,
      cacheWriteTokens: 20,
    });
  });

  it('round-trips a usage marker without leaking into prompt text', () => {
    const marker = encodeUsageMarker({
      model: 'gpt-4o',
      promptTokens: 10,
      uncachedPromptTokens: 10,
      completionTokens: 4,
      totalTokens: 14,
      cachedTokens: 0,
      cacheWriteTokens: 0,
      cacheWrite1hTokens: 0,
      reasoningTokens: 0,
      reasoningIncludedInOutput: true,
      imageTokens: 0,
      precision: 'exact',
      cost: 0.001,
    });

    const split = takeUsageMarker(`hello${marker}`);
    expect(split.text).toBe('hello');
    expect(split.usage).toMatchObject({ model: 'gpt-4o', promptTokens: 10, cost: 0.001 });
  });
});
