import { describe, expect, it } from 'vitest';
import { cost, estimateTokensFromText, formatDollars, formatTokenCount, lookupPrice, roundDollars } from './calc';

describe('cost calculator', () => {
  it('prices Anthropic Sonnet 4.6 from the official table', () => {
    const result = cost('claude-sonnet-4-6', 1_000_000, 1_000_000);
    expect(result.unknown).toBe(false);

    if (result.unknown) {
      return;
    }

    expect(result.dollars).toBe(18);
    expect(result.source).toBe('table');
  });

  it('prices OpenAI GPT-5.4 from the official table', () => {
    const result = cost('gpt-5.4', 2_000_000, 0);
    expect(result.unknown).toBe(false);

    if (result.unknown) {
      return;
    }

    expect(result.dollars).toBe(5);
  });

  it('prices Google Gemini 2.5 Flash from the official table', () => {
    const result = cost('gemini-2.5-flash', 1_000_000, 1_000_000);
    expect(result.unknown).toBe(false);

    if (result.unknown) {
      return;
    }

    expect(result.dollars).toBe(2.8);
  });

  it('prices DeepSeek V4 Flash from the official table', () => {
    const result = cost('deepseek-v4-flash', 1_000_000, 1_000_000);
    expect(result.unknown).toBe(false);

    if (result.unknown) {
      return;
    }

    expect(result.dollars).toBe(0.42);
  });

  it('matches dated Anthropic snapshots via the model-id pattern', () => {
    const result = cost('claude-haiku-4-5-20251001', 1_000_000, 0);
    expect(result.unknown).toBe(false);

    if (result.unknown) {
      return;
    }

    expect(result.dollars).toBe(1);
  });

  it('matches OpenRouter-style vendor prefixes against the underlying model', () => {
    const result = cost('anthropic/claude-sonnet-4-6', 1_000_000, 0);
    expect(result.unknown).toBe(false);

    if (result.unknown) {
      return;
    }

    expect(result.dollars).toBe(3);
  });

  it('uses cached input rates when cache-read tokens are present', () => {
    const result = cost('claude-sonnet-4-6', 1_000_000, 0, { cachedTokens: 1_000_000 });
    expect(result.unknown).toBe(false);

    if (result.unknown) {
      return;
    }

    expect(result.dollars).toBe(0.3);
  });

  it('prefers OpenRouter billed cost over the list-price estimate', () => {
    const result = cost('openai/gpt-4o', 1000, 1000, { actualCost: 0.0123 });
    expect(result.unknown).toBe(false);

    if (result.unknown) {
      return;
    }

    expect(result.dollars).toBe(0.0123);
    expect(result.source).toBe('provider');
  });

  it('returns unknown for a model with no table or custom price', () => {
    const result = cost('mystery-model-xyz', 1000, 50);
    expect(result).toMatchObject({
      unknown: true,
      dollars: 0,
      promptTokens: 1000,
      completionTokens: 50,
    });
  });

  it('applies a user-supplied per-model price', () => {
    const result = cost('mystery-model-xyz', 1_000_000, 500_000, {
      customPrices: { 'mystery-model-xyz': { input: 1, output: 2 } },
    });
    expect(result.unknown).toBe(false);

    if (result.unknown) {
      return;
    }

    expect(result.dollars).toBe(2);
    expect(result.source).toBe('custom');
  });

  it('treats Ollama and LM Studio as free', () => {
    expect(cost('llama3', 10_000, 10_000, { provider: 'Ollama' })).toMatchObject({
      unknown: false,
      dollars: 0,
      source: 'local',
    });
    expect(cost('local-model', 10_000, 10_000, { provider: 'LMStudio' })).toMatchObject({
      unknown: false,
      dollars: 0,
      source: 'local',
    });
  });

  it('rounds to 6 decimal places to keep float noise out of the meter', () => {
    expect(roundDollars(0.1 + 0.2)).toBe(0.3);
    expect(cost('gpt-4o-mini', 1, 1)).toMatchObject({ unknown: false, dollars: 0.000001 });
  });

  it('formats the header pill and compact token counts', () => {
    expect(formatDollars(0.043)).toBe('$0.043');
    expect(formatDollars(0.42, 2)).toBe('$0.42');
    expect(formatTokenCount(38_000)).toBe('38k');
    expect(formatTokenCount(250)).toBe('250');
  });

  it('estimates tokens from text with the 4-chars heuristic', () => {
    expect(estimateTokensFromText('abcd'.repeat(10))).toBe(10);
    expect(estimateTokensFromText('')).toBe(0);
  });

  it('looks up a known price and leaves unknown models unset', () => {
    expect(lookupPrice('gpt-4o')?.verified).toBe(true);
    expect(lookupPrice('not-a-real-model')).toBeUndefined();
  });
});
