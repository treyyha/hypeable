/**
 * Usage blobs copied from official provider docs (streaming and not).
 * Field names must stay in sync with those pages, not with memory.
 */
import { describe, expect, it } from 'vitest';
import { extractTokenUsage, mergeAnthropicStreamUsage } from './usage';

describe('provider-reported usage shapes', () => {
  it('parses OpenAI Chat Completions usage, including the include_usage stream chunk', () => {
    const usage = extractTokenUsage({
      prompt_tokens: 194,
      completion_tokens: 20,
      total_tokens: 214,
      prompt_tokens_details: { cached_tokens: 40, audio_tokens: 0 },
      completion_tokens_details: { reasoning_tokens: 8 },
    });

    expect(usage).toMatchObject({
      promptTokens: 194,
      cachedTokens: 40,
      completionTokens: 20,
      reasoningTokens: 8,
      reasoningIncludedInOutput: true,
      precision: 'exact',
    });
  });

  it('parses OpenRouter billed cost and cache-write from the usage-accounting docs', () => {
    const usage = extractTokenUsage({
      completion_tokens: 2,
      completion_tokens_details: { reasoning_tokens: 0 },
      cost: 0.95,
      cost_details: { upstream_inference_cost: 19 },
      prompt_tokens: 194,
      prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 100, audio_tokens: 0 },
      total_tokens: 196,
    });

    expect(usage).toMatchObject({
      promptTokens: 194,
      completionTokens: 2,
      cacheWriteTokens: 100,
      cost: 0.95,
      precision: 'exact',
    });
  });

  it('parses Anthropic message_start then message_delta usage', () => {
    const merged = mergeAnthropicStreamUsage(
      {
        input_tokens: 25,
        output_tokens: 1,
        cache_creation_input_tokens: 20,
        cache_read_input_tokens: 40,
      },
      { output_tokens: 15 },
    );

    expect(merged).toMatchObject({
      promptTokens: 85,
      uncachedPromptTokens: 25,
      cachedTokens: 40,
      cacheWriteTokens: 20,
      completionTokens: 15,
      precision: 'exact',
    });
  });

  it('parses Anthropic 5m vs 1h cache writes from cache_creation', () => {
    const usage = extractTokenUsage({
      input_tokens: 10,
      output_tokens: 4,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 30,
      cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 20 },
    });

    expect(usage).toMatchObject({
      cacheWriteTokens: 10,
      cacheWrite1hTokens: 20,
      promptTokens: 40,
    });
  });

  it('parses Google usageMetadata including thoughts billed on top of candidates', () => {
    const usage = extractTokenUsage({
      usageMetadata: {
        promptTokenCount: 9,
        cachedContentTokenCount: 0,
        candidatesTokenCount: 546,
        thoughtsTokenCount: 12,
        totalTokenCount: 567,
      },
    });

    expect(usage).toMatchObject({
      promptTokens: 9,
      completionTokens: 546,
      reasoningTokens: 12,
      reasoningIncludedInOutput: false,
      precision: 'exact',
    });
  });

  it('parses DeepSeek cache hits and reasoning_tokens', () => {
    const usage = extractTokenUsage({
      prompt_tokens: 9,
      completion_tokens: 2,
      total_tokens: 11,
      prompt_tokens_details: { cached_tokens: 0 },
      prompt_cache_hit_tokens: 0,
      prompt_cache_miss_tokens: 9,
      completion_tokens_details: { reasoning_tokens: 93 },
    });

    expect(usage).toMatchObject({
      promptTokens: 9,
      completionTokens: 2,
      reasoningTokens: 93,
      reasoningIncludedInOutput: true,
    });
  });

  it('parses Groq / Mistral OpenAI-compatible usage chunks', () => {
    expect(
      extractTokenUsage({
        prompt_tokens: 14,
        completion_tokens: 22,
        total_tokens: 36,
      }),
    ).toMatchObject({ promptTokens: 14, completionTokens: 22, totalTokens: 36, precision: 'exact' });
  });

  it('parses Mistral cached_tokens as a subset of prompt_tokens', () => {
    const usage = extractTokenUsage({
      prompt_tokens: 1013,
      total_tokens: 1043,
      completion_tokens: 30,
      prompt_tokens_details: { cached_tokens: 1008 },
    });

    expect(usage).toMatchObject({
      promptTokens: 1013,
      cachedTokens: 1008,
      uncachedPromptTokens: 5,
      completionTokens: 30,
    });
  });

  it('parses xAI usage with nested details', () => {
    const usage = extractTokenUsage({
      prompt_tokens: 50,
      completion_tokens: 10,
      total_tokens: 60,
      prompt_tokens_details: { cached_tokens: 16, image_tokens: 0, audio_tokens: 0 },
      completion_tokens_details: {
        reasoning_tokens: 4,
        audio_tokens: 0,
        accepted_prediction_tokens: 0,
        rejected_prediction_tokens: 0,
      },
    });

    expect(usage).toMatchObject({
      promptTokens: 50,
      cachedTokens: 16,
      completionTokens: 10,
      reasoningTokens: 4,
    });
  });

  it('parses flattened AI SDK usage', () => {
    expect(extractTokenUsage({ inputTokens: 11, outputTokens: 7, totalTokens: 18 })).toMatchObject({
      promptTokens: 11,
      completionTokens: 7,
      totalTokens: 18,
      precision: 'exact',
    });
  });

  it('parses AI SDK LanguageModelUsage input/output details', () => {
    const usage = extractTokenUsage({
      inputTokens: 194,
      inputTokenDetails: { noCacheTokens: 154, cacheReadTokens: 40, cacheWriteTokens: 0 },
      outputTokens: 20,
      outputTokenDetails: { textTokens: 12, reasoningTokens: 8 },
      totalTokens: 214,
    });

    expect(usage).toMatchObject({
      promptTokens: 194,
      cachedTokens: 40,
      completionTokens: 20,
      reasoningTokens: 8,
      reasoningIncludedInOutput: true,
      precision: 'exact',
    });
  });
});
