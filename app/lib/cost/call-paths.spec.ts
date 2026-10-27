import { describe, expect, it } from 'vitest';
import { applyUsage, costFromEntry } from './apply';
import { METERED_CALL_PATHS } from './call-paths';
import { emptySnapshot } from './persist';
import { wrapTextStreamWithUsage } from './stream-usage';
import { encodeUsageMarker, extractTokenUsage, takeUsageMarker, type CallKind } from './usage';

async function readStringStream(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();

  let text = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      return text;
    }

    text += value;
  }
}

const now = new Date('2026-10-27T12:00:00');

function report(callKind: CallKind, usage: unknown) {
  const extracted = extractTokenUsage(usage, { callKind });
  expect(extracted).toBeDefined();

  const { snapshot } = applyUsage(
    emptySnapshot(now),
    {
      id: `path:${callKind}`,
      model: 'gpt-4o-mini',
      provider: 'OpenAI',
      promptTokens: extracted!.promptTokens,
      completionTokens: extracted!.completionTokens,
      cachedTokens: extracted!.cachedTokens,
      actualCost: extracted!.cost,
      precision: extracted!.precision,
      callKind,
    },
    now,
  );

  expect(snapshot.messages[`path:${callKind}`]?.callKind).toBe(callKind);
  expect(snapshot.sessionTotal).toBeGreaterThan(0);

  return snapshot;
}

describe('every model call reports to the meter', () => {
  it('lists each live LLM path', () => {
    expect(METERED_CALL_PATHS.map((path) => path.id).sort()).toEqual(
      ['chat', 'context', 'enhancer', 'llmcall-json', 'llmcall-stream', 'plan', 'retry', 'summary'].sort(),
    );
  });

  it.each(METERED_CALL_PATHS.filter((path) => path.transport !== 'usage-marker'))(
    '$id reports provider usage as a meter entry',
    (path) => {
      const snapshot = report(path.callKind, { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 });
      expect(snapshot.sessionPromptTokens).toBe(100);
      expect(costFromEntry(snapshot, snapshot.messages[`path:${path.callKind}`] as never).dollars).toBe(
        snapshot.sessionTotal,
      );
    },
  );

  it('enhancer / llmcall markers round-trip into the meter', async () => {
    const stream = wrapTextStreamWithUsage(
      (async function* () {
        yield 'hello';
      })(),
      { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      { model: 'gpt-4o-mini', provider: 'OpenAI', callKind: 'enhancer' },
    );

    const text = await readStringStream(stream);
    const split = takeUsageMarker(text);

    expect(split.text).toBe('hello');
    expect(split.usage).toMatchObject({
      model: 'gpt-4o-mini',
      promptTokens: 10,
      completionTokens: 4,
      callKind: 'enhancer',
      precision: 'exact',
    });

    const { snapshot } = applyUsage(
      emptySnapshot(now),
      {
        id: 'enhancer:1',
        model: split.usage!.model ?? 'gpt-4o-mini',
        provider: split.usage!.provider,
        promptTokens: split.usage!.promptTokens,
        completionTokens: split.usage!.completionTokens,
        precision: split.usage!.precision,
        callKind: 'enhancer',
      },
      now,
    );

    expect(snapshot.messages['enhancer:1'].callKind).toBe('enhancer');
  });

  it('emits an estimate marker when the stream is aborted before usage arrives', async () => {
    const stream = wrapTextStreamWithUsage(
      (async function* () {
        yield 'partial';
        throw new Error('aborted');
      })(),
      Promise.resolve(undefined),
      { model: 'gpt-4o-mini', callKind: 'llmcall' },
    );

    const split = takeUsageMarker(await readStringStream(stream));

    expect(split.text).toBe('partial');
    expect(split.usage).toMatchObject({
      precision: 'estimate',
      aborted: true,
      maybeBilled: true,
      callKind: 'llmcall',
    });
  });

  it('encodes a failed-maybe-billed chat row', () => {
    const marker = encodeUsageMarker({
      promptTokens: 8,
      uncachedPromptTokens: 8,
      completionTokens: 2,
      totalTokens: 10,
      cachedTokens: 0,
      cacheWriteTokens: 0,
      cacheWrite1hTokens: 0,
      reasoningTokens: 0,
      reasoningIncludedInOutput: true,
      imageTokens: 0,
      precision: 'estimate',
      maybeBilled: true,
      callKind: 'chat',
      model: 'gpt-4o-mini',
    });

    expect(takeUsageMarker(`ok${marker}`).usage).toMatchObject({
      maybeBilled: true,
      precision: 'estimate',
      callKind: 'chat',
    });
  });
});
