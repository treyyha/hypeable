/**
 * Normalise provider / SDK usage blobs into the shape the meter stores.
 * OpenRouter's billed `cost` wins over the list-price estimate when present.
 */
export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  cost?: number;
};

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function nestedTotal(value: unknown): number | undefined {
  const direct = asFiniteNumber(value);

  if (direct !== undefined) {
    return direct;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return asFiniteNumber(record.total) ?? asFiniteNumber(record.value);
}

function nestedCacheRead(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return (
    asFiniteNumber(record.cacheRead) ??
    asFiniteNumber(record.cacheReadTokens) ??
    asFiniteNumber(record.cache_read) ??
    asFiniteNumber(record.cached) ??
    asFiniteNumber(record.cachedTokens)
  );
}

function nestedCacheWrite(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return (
    asFiniteNumber(record.cacheWrite) ??
    asFiniteNumber(record.cacheWriteTokens) ??
    asFiniteNumber(record.cache_write) ??
    asFiniteNumber(record.cacheCreation) ??
    asFiniteNumber(record.cacheCreationTokens)
  );
}

function readProviderCost(usage: Record<string, unknown>): number | undefined {
  const direct = asFiniteNumber(usage.cost);

  if (direct !== undefined && direct >= 0) {
    return direct;
  }

  const nested =
    usage.costDetails && typeof usage.costDetails === 'object'
      ? asFiniteNumber((usage.costDetails as Record<string, unknown>).total_cost)
      : undefined;

  if (nested !== undefined && nested >= 0) {
    return nested;
  }

  const metadata = usage.providerMetadata;

  if (metadata && typeof metadata === 'object') {
    const openrouter = (metadata as Record<string, unknown>).openrouter;

    if (openrouter && typeof openrouter === 'object') {
      const routerUsage = (openrouter as Record<string, unknown>).usage;

      const routerCost =
        asFiniteNumber((openrouter as Record<string, unknown>).cost) ??
        (routerUsage && typeof routerUsage === 'object'
          ? asFiniteNumber((routerUsage as Record<string, unknown>).cost)
          : undefined);

      if (routerCost !== undefined && routerCost >= 0) {
        return routerCost;
      }
    }
  }

  return undefined;
}

export function extractTokenUsage(usage: unknown): TokenUsage | undefined {
  if (usage == null) {
    return undefined;
  }

  if (typeof usage === 'number' && Number.isFinite(usage)) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: usage,
      cachedTokens: 0,
    };
  }

  if (typeof usage !== 'object') {
    return undefined;
  }

  const record = usage as Record<string, unknown>;

  const promptRaw =
    nestedTotal(record.promptTokens) ??
    nestedTotal(record.inputTokens) ??
    asFiniteNumber(record.prompt_tokens) ??
    asFiniteNumber(record.input_tokens) ??
    0;
  const completion =
    nestedTotal(record.completionTokens) ??
    nestedTotal(record.outputTokens) ??
    asFiniteNumber(record.completion_tokens) ??
    asFiniteNumber(record.output_tokens) ??
    0;
  const cached =
    asFiniteNumber(record.cachedTokens) ??
    asFiniteNumber(record.cachedInputTokens) ??
    asFiniteNumber(record.cacheReadInputTokens) ??
    asFiniteNumber(record.cache_read_input_tokens) ??
    nestedCacheRead(record.inputTokens) ??
    nestedCacheRead(record.inputTokenDetails) ??
    nestedCacheRead(record.promptTokensDetails) ??
    nestedCacheRead(record.prompt_tokens_details) ??
    0;
  const cacheWrite =
    asFiniteNumber(record.cacheWriteTokens) ??
    asFiniteNumber(record.cacheCreationInputTokens) ??
    asFiniteNumber(record.cache_creation_input_tokens) ??
    asFiniteNumber(record.cache_write_input_tokens) ??
    nestedCacheWrite(record.inputTokens) ??
    nestedCacheWrite(record.inputTokenDetails) ??
    nestedCacheWrite(record.promptTokensDetails) ??
    0;

  /*
   * Anthropic reports uncached input_tokens plus sibling cache_* fields.
   * OpenAI-style blobs already include cache-read inside prompt_tokens.
   */
  const separateCacheFields =
    asFiniteNumber(record.cache_read_input_tokens) !== undefined ||
    asFiniteNumber(record.cache_creation_input_tokens) !== undefined ||
    asFiniteNumber(record.cache_write_input_tokens) !== undefined ||
    asFiniteNumber(record.cacheReadInputTokens) !== undefined ||
    asFiniteNumber(record.cacheCreationInputTokens) !== undefined;

  const prompt = separateCacheFields ? promptRaw + cached + cacheWrite : promptRaw;

  const total = asFiniteNumber(record.totalTokens) ?? asFiniteNumber(record.total_tokens) ?? prompt + completion;
  const cost = readProviderCost(record);

  if (prompt === 0 && completion === 0 && total === 0 && cost === undefined) {
    return undefined;
  }

  return {
    promptTokens: Math.max(0, prompt),
    completionTokens: Math.max(0, completion),
    totalTokens: Math.max(0, total),
    cachedTokens: Math.max(0, cached),
    ...(cost !== undefined ? { cost } : {}),
  };
}

export type UsageAnnotation = TokenUsage & {
  id?: string;
  model?: string;
  provider?: string;
  type?: string;
};

export function toUsageAnnotation(
  usage: TokenUsage,
  extras: { id?: string; model?: string; provider?: string } = {},
): UsageAnnotation {
  return {
    ...extras,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    cachedTokens: usage.cachedTokens,
    ...(usage.cost !== undefined ? { cost: usage.cost } : {}),
  };
}

export const USAGE_MARKER_PREFIX = '\n<!--hypeable-usage:';
export const USAGE_MARKER_SUFFIX = '-->';

export function encodeUsageMarker(payload: UsageAnnotation): string {
  return `${USAGE_MARKER_PREFIX}${JSON.stringify(payload)}${USAGE_MARKER_SUFFIX}`;
}

export function takeUsageMarker(text: string): { text: string; usage?: UsageAnnotation } {
  const token = USAGE_MARKER_PREFIX.trimStart();

  const start =
    text.lastIndexOf(USAGE_MARKER_PREFIX) >= 0 ? text.lastIndexOf(USAGE_MARKER_PREFIX) : text.lastIndexOf(token);

  if (start < 0) {
    return { text };
  }

  const prefixLength = text.startsWith(USAGE_MARKER_PREFIX, start) ? USAGE_MARKER_PREFIX.length : token.length;
  const jsonStart = start + prefixLength;
  const end = text.indexOf(USAGE_MARKER_SUFFIX, jsonStart);

  if (end < 0) {
    return { text };
  }

  try {
    const parsed = JSON.parse(text.slice(jsonStart, end)) as UsageAnnotation;
    const before = text.slice(0, start);
    const after = text.slice(end + USAGE_MARKER_SUFFIX.length);

    return { text: `${before}${after}`, usage: parsed };
  } catch {
    return { text };
  }
}
