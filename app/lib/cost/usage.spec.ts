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
    ).toEqual({
      promptTokens: 11,
      completionTokens: 7,
      totalTokens: 18,
      cachedTokens: 0,
    });
  });

  it('reads nested cache-read tokens and OpenRouter billed cost', () => {
    expect(
      extractTokenUsage({
        inputTokens: { total: 100, cacheRead: 40 },
        outputTokens: { total: 20 },
        cost: 0.0042,
      }),
    ).toEqual({
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
      cachedTokens: 40,
      cost: 0.0042,
    });
  });

  it('round-trips a usage marker without leaking into prompt text', () => {
    const marker = encodeUsageMarker({
      model: 'gpt-4o',
      promptTokens: 10,
      completionTokens: 4,
      totalTokens: 14,
      cachedTokens: 0,
      cost: 0.001,
    });

    const split = takeUsageMarker(`hello${marker}`);
    expect(split.text).toBe('hello');
    expect(split.usage).toMatchObject({ model: 'gpt-4o', promptTokens: 10, cost: 0.001 });
  });
});
