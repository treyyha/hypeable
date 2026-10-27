/**
 * Normalise provider / SDK usage blobs into the shape the meter stores.
 * Field names are taken from each provider's official API docs (see
 * docs/COST-METER.md). OpenRouter's billed `cost` is parsed here but the
 * table estimate is kept alongside it in `cost()`.
 */
import { estimateTokensFromText } from './calc';

export type UsagePrecision = 'exact' | 'estimate';

export type CallKind = 'chat' | 'enhancer' | 'plan' | 'summary' | 'context' | 'llmcall' | 'retry';

export type ApproximateReason =
  'unverified-price' | 'local-estimate' | 'unpriced-category' | 'aborted' | 'failed-maybe-billed' | 'unknown-model';

export type TokenUsage = {
  promptTokens: number;
  uncachedPromptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  cacheWrite1hTokens: number;
  reasoningTokens: number;

  /** False when reasoning is billed in addition to `completionTokens` (Google thoughts). */
  reasoningIncludedInOutput: boolean;
  imageTokens: number;
  cost?: number;
  precision: UsagePrecision;
  aborted?: boolean;
  maybeBilled?: boolean;
  callKind?: CallKind;
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

function nestedField(value: unknown, keys: string[]): number | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const found = asFiniteNumber(record[key]);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function nestedCacheRead(value: unknown): number | undefined {
  return nestedField(value, [
    'cacheRead',
    'cacheReadTokens',
    'cache_read',
    'cached',
    'cachedTokens',
    'cached_tokens',
    'cachedContentTokenCount',
  ]);
}

function nestedCacheWrite(value: unknown): number | undefined {
  return nestedField(value, [
    'cacheWrite',
    'cacheWriteTokens',
    'cache_write',
    'cacheCreation',
    'cacheCreationTokens',
    'cache_write_tokens',
  ]);
}

function nestedReasoning(value: unknown): number | undefined {
  return nestedField(value, ['reasoning', 'reasoningTokens', 'reasoning_tokens', 'thoughts', 'thoughtsTokenCount']);
}

function nestedImage(value: unknown): number | undefined {
  return nestedField(value, ['image', 'imageTokens', 'image_tokens']);
}

function imageFromModalityList(value: unknown): number | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  let total = 0;
  let found = false;

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const row = item as Record<string, unknown>;
    const modality = typeof row.modality === 'string' ? row.modality : typeof row.mod === 'string' ? row.mod : '';

    if (modality.toUpperCase() !== 'IMAGE') {
      continue;
    }

    const count = asFiniteNumber(row.tokenCount) ?? asFiniteNumber(row.token_count);

    if (count !== undefined) {
      total += count;
      found = true;
    }
  }

  return found ? total : undefined;
}

function readProviderCost(usage: Record<string, unknown>): number | undefined {
  const direct = asFiniteNumber(usage.cost);

  if (direct !== undefined && direct >= 0) {
    return direct;
  }

  const costDetails = usage.costDetails ?? usage.cost_details;

  if (costDetails && typeof costDetails === 'object') {
    const details = costDetails as Record<string, unknown>;
    const nested = asFiniteNumber(details.total_cost) ?? asFiniteNumber(details.cost);

    if (nested !== undefined && nested >= 0) {
      return nested;
    }
  }

  const metadata = usage.providerMetadata ?? usage.provider_metadata;

  if (metadata && typeof metadata === 'object') {
    const openrouter = (metadata as Record<string, unknown>).openrouter;

    if (openrouter && typeof openrouter === 'object') {
      const router = openrouter as Record<string, unknown>;
      const routerUsage = router.usage;

      const routerCost =
        asFiniteNumber(router.cost) ??
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

function googleUsageRecord(record: Record<string, unknown>): Record<string, unknown> {
  const nested = record.usageMetadata ?? record.usage_metadata;

  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }

  return record;
}

export function extractTokenUsage(usage: unknown, extras: Partial<TokenUsage> = {}): TokenUsage | undefined {
  if (usage == null) {
    return undefined;
  }

  if (typeof usage === 'number' && Number.isFinite(usage)) {
    return {
      promptTokens: 0,
      uncachedPromptTokens: 0,
      completionTokens: 0,
      totalTokens: usage,
      cachedTokens: 0,
      cacheWriteTokens: 0,
      cacheWrite1hTokens: 0,
      reasoningTokens: 0,
      reasoningIncludedInOutput: true,
      imageTokens: 0,
      precision: extras.precision ?? 'exact',
      ...pickFlags(extras),
    };
  }

  if (typeof usage !== 'object') {
    return undefined;
  }

  const raw = usage as Record<string, unknown>;
  const record = googleUsageRecord(raw);

  const promptRaw =
    nestedTotal(record.promptTokens) ??
    nestedTotal(record.inputTokens) ??
    asFiniteNumber(record.prompt_tokens) ??
    asFiniteNumber(record.input_tokens) ??
    asFiniteNumber(record.promptTokenCount) ??
    asFiniteNumber(record.prompt_token_count) ??
    0;

  const completionRaw =
    nestedTotal(record.completionTokens) ??
    nestedTotal(record.outputTokens) ??
    asFiniteNumber(record.completion_tokens) ??
    asFiniteNumber(record.output_tokens) ??
    asFiniteNumber(record.candidatesTokenCount) ??
    asFiniteNumber(record.candidates_token_count) ??
    0;

  const cached =
    asFiniteNumber(record.cachedTokens) ??
    asFiniteNumber(record.cachedInputTokens) ??
    asFiniteNumber(record.cacheReadInputTokens) ??
    asFiniteNumber(record.cache_read_input_tokens) ??
    asFiniteNumber(record.cachedContentTokenCount) ??
    asFiniteNumber(record.cached_content_token_count) ??
    asFiniteNumber(record.prompt_cache_hit_tokens) ??
    nestedCacheRead(record.inputTokens) ??
    nestedCacheRead(record.inputTokenDetails) ??
    nestedCacheRead(record.promptTokensDetails) ??
    nestedCacheRead(record.prompt_tokens_details) ??
    0;

  const cacheCreation = record.cache_creation;

  const cacheWrite5m =
    cacheCreation && typeof cacheCreation === 'object'
      ? (asFiniteNumber((cacheCreation as Record<string, unknown>).ephemeral_5m_input_tokens) ?? 0)
      : 0;
  const cacheWrite1h =
    cacheCreation && typeof cacheCreation === 'object'
      ? (asFiniteNumber((cacheCreation as Record<string, unknown>).ephemeral_1h_input_tokens) ?? 0)
      : 0;

  const cacheWriteTotal =
    asFiniteNumber(record.cacheWriteTokens) ??
    asFiniteNumber(record.cacheCreationInputTokens) ??
    asFiniteNumber(record.cache_creation_input_tokens) ??
    asFiniteNumber(record.cache_write_input_tokens) ??
    nestedCacheWrite(record.inputTokens) ??
    nestedCacheWrite(record.inputTokenDetails) ??
    nestedCacheWrite(record.promptTokensDetails) ??
    nestedCacheWrite(record.prompt_tokens_details) ??
    nestedField(record.prompt_tokens_details, ['cache_write_tokens', 'cacheWriteTokens']) ??
    cacheWrite5m + cacheWrite1h;

  const cacheWrite = cacheWriteTotal ?? 0;
  const cacheWrite1hTokens = cacheWrite1h;
  const cacheWriteTokens = Math.max(0, cacheWrite - cacheWrite1hTokens);

  const reasoning =
    asFiniteNumber(record.reasoningTokens) ??
    asFiniteNumber(record.reasoning_tokens) ??
    asFiniteNumber(record.thoughtsTokenCount) ??
    asFiniteNumber(record.thoughts_token_count) ??
    nestedReasoning(record.completionTokens) ??
    nestedReasoning(record.outputTokens) ??
    nestedReasoning(record.outputTokenDetails) ??
    nestedReasoning(record.completionTokensDetails) ??
    nestedReasoning(record.completion_tokens_details) ??
    nestedReasoning(record.output_tokens_details) ??
    0;

  const image =
    asFiniteNumber(record.imageTokens) ??
    asFiniteNumber(record.image_tokens) ??
    nestedImage(record.promptTokensDetails) ??
    nestedImage(record.prompt_tokens_details) ??
    nestedImage(record.inputTokenDetails) ??
    imageFromModalityList(record.promptTokensDetails) ??
    imageFromModalityList(record.prompt_tokens_details) ??
    0;

  const googleThoughts =
    asFiniteNumber(record.thoughtsTokenCount) !== undefined ||
    asFiniteNumber(record.thoughts_token_count) !== undefined;

  /*
   * Anthropic reports uncached input_tokens plus sibling cache_* fields.
   * OpenAI-style blobs already include cache-read inside prompt_tokens.
   * Google promptTokenCount includes cachedContentTokenCount.
   */
  const separateCacheFields =
    asFiniteNumber(record.cache_read_input_tokens) !== undefined ||
    asFiniteNumber(record.cache_creation_input_tokens) !== undefined ||
    asFiniteNumber(record.cache_write_input_tokens) !== undefined ||
    asFiniteNumber(record.cacheReadInputTokens) !== undefined ||
    asFiniteNumber(record.cacheCreationInputTokens) !== undefined;

  const prompt = separateCacheFields ? promptRaw + cached + cacheWrite : promptRaw;

  const uncached = Math.max(0, prompt - cached - cacheWrite);
  const completion = completionRaw;

  const total =
    asFiniteNumber(record.totalTokens) ??
    asFiniteNumber(record.total_tokens) ??
    asFiniteNumber(record.totalTokenCount) ??
    asFiniteNumber(record.total_token_count) ??
    prompt + completion + (googleThoughts ? reasoning : 0);

  const cost = readProviderCost(raw) ?? readProviderCost(record);

  if (prompt === 0 && completion === 0 && total === 0 && reasoning === 0 && cost === undefined) {
    return undefined;
  }

  return {
    promptTokens: Math.max(0, prompt),
    uncachedPromptTokens: uncached,
    completionTokens: Math.max(0, completion),
    totalTokens: Math.max(0, total),
    cachedTokens: Math.max(0, cached),
    cacheWriteTokens: Math.max(0, cacheWriteTokens),
    cacheWrite1hTokens: Math.max(0, cacheWrite1hTokens),
    reasoningTokens: Math.max(0, reasoning),
    reasoningIncludedInOutput: !googleThoughts,
    imageTokens: Math.max(0, image),
    ...(cost !== undefined ? { cost } : {}),
    precision: extras.precision ?? 'exact',
    ...pickFlags(extras),
  };
}

function pickFlags(extras: Partial<TokenUsage>): Pick<TokenUsage, 'aborted' | 'maybeBilled' | 'callKind'> {
  return {
    ...(extras.aborted ? { aborted: true } : {}),
    ...(extras.maybeBilled ? { maybeBilled: true } : {}),
    ...(extras.callKind ? { callKind: extras.callKind } : {}),
  };
}

export function estimateUsageFromText(
  text: string,
  extras: { promptTokens?: number; callKind?: CallKind; aborted?: boolean; maybeBilled?: boolean } = {},
): TokenUsage {
  const completionTokens = estimateTokensFromText(text);
  const promptTokens = extras.promptTokens ?? 0;

  return {
    promptTokens,
    uncachedPromptTokens: promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    cacheWrite1hTokens: 0,
    reasoningTokens: 0,
    reasoningIncludedInOutput: true,
    imageTokens: 0,
    precision: 'estimate',
    ...pickFlags({ aborted: extras.aborted, maybeBilled: extras.maybeBilled, callKind: extras.callKind }),
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
  extras: { id?: string; model?: string; provider?: string; callKind?: CallKind } = {},
): UsageAnnotation {
  return {
    ...usage,
    ...extras,
    ...(extras.callKind ? { callKind: extras.callKind } : {}),
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

    const extracted = extractTokenUsage(parsed, {
      precision: parsed.precision === 'estimate' ? 'estimate' : 'exact',
      aborted: parsed.aborted,
      maybeBilled: parsed.maybeBilled,
      callKind: parsed.callKind,
    });

    return {
      text: `${before}${after}`,
      usage: extracted
        ? toUsageAnnotation(extracted, { id: parsed.id, model: parsed.model, provider: parsed.provider })
        : parsed,
    };
  } catch {
    return { text };
  }
}

/** Merge Anthropic `message_start.usage` with later `message_delta.usage` (delta overwrites non-null fields). */
export function mergeAnthropicStreamUsage(start: unknown, delta: unknown): TokenUsage | undefined {
  const startRecord = start && typeof start === 'object' ? (start as Record<string, unknown>) : {};
  const deltaRecord = delta && typeof delta === 'object' ? (delta as Record<string, unknown>) : {};
  const merged: Record<string, unknown> = { ...startRecord };

  for (const [key, value] of Object.entries(deltaRecord)) {
    if (value !== null && value !== undefined) {
      merged[key] = value;
    }
  }

  return extractTokenUsage(merged);
}
