/**
 * Append a usage marker to a text stream once the provider reports tokens.
 * Chat uses data-usage parts; enhancer / llmcall have no annotation channel.
 *
 * If the stream is aborted or the provider never sends usage, we still emit
 * a marker from the tokens seen so far and label it an estimate.
 */
import {
  encodeUsageMarker,
  estimateUsageFromText,
  extractTokenUsage,
  toUsageAnnotation,
  type CallKind,
  type UsageAnnotation,
} from './usage';

export async function readUsagePromise(usage: Promise<unknown> | unknown): Promise<UsageAnnotation | undefined> {
  try {
    const resolved = await usage;
    const tokens = extractTokenUsage(resolved);

    return tokens ? toUsageAnnotation(tokens) : undefined;
  } catch {
    return undefined;
  }
}

async function* iterateText(stream: AsyncIterable<string> | ReadableStream<string>) {
  if (Symbol.asyncIterator in (stream as AsyncIterable<string>)) {
    yield* stream as AsyncIterable<string>;
    return;
  }

  const reader = (stream as ReadableStream<string>).getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      if (value) {
        yield value;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function markerFor(
  tokens: UsageAnnotation | undefined,
  extras: { model: string; provider?: string; id?: string; callKind?: CallKind },
  fallbackText: string,
  aborted: boolean,
): string {
  const usage =
    tokens ??
    estimateUsageFromText(fallbackText, {
      callKind: extras.callKind,
      aborted,
      maybeBilled: aborted || extras.callKind === 'llmcall',
    });

  return encodeUsageMarker({
    ...usage,
    precision: tokens ? usage.precision : 'estimate',
    aborted: aborted || usage.aborted,
    maybeBilled: aborted ? true : usage.maybeBilled,
    model: extras.model,
    provider: extras.provider,
    id: extras.id,
    callKind: extras.callKind ?? usage.callKind,
  });
}

export function wrapTextStreamWithUsage(
  textStream: AsyncIterable<string> | ReadableStream<string>,
  usage: Promise<unknown> | unknown,
  extras: { model: string; provider?: string; id?: string; callKind?: CallKind },
): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      let seen = '';

      try {
        for await (const chunk of iterateText(textStream)) {
          if (chunk) {
            seen += chunk;
            controller.enqueue(chunk);
          }
        }

        const tokens = await readUsagePromise(usage);
        controller.enqueue(markerFor(tokens, extras, seen, false));
      } catch {
        const tokens = await readUsagePromise(usage);
        controller.enqueue(markerFor(tokens, extras, seen, true));
        controller.close();

        return;
      }

      controller.close();
    },
  });
}

export function usageFromResult(result: {
  totalUsage?: Promise<unknown> | unknown;
  usage?: Promise<unknown> | unknown;
}): Promise<unknown> {
  if (result.totalUsage !== undefined) {
    return Promise.resolve(result.totalUsage);
  }

  if (result.usage !== undefined) {
    return Promise.resolve(result.usage);
  }

  return Promise.resolve(undefined);
}
