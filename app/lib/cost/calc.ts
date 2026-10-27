/**
 * Token × list-price → dollars. Unknown models stay unknown so the UI can
 * prompt for a custom price instead of silently inventing one.
 *
 * Arithmetic is integer nano-dollars; the pill and cap check both read the
 * micro-dollar rounding of that total.
 */
import { dollarsFromNanos, dollarsToNanos, roundDollars, tokensToNanos } from './money';
import pricesCatalog from './prices.json';
import type { ApproximateReason, TokenUsage, UsagePrecision } from './usage';

export { roundDollars } from './money';

export const TOKENS_PER_DOLLAR_UNIT = 1_000_000;

export type PriceRow = {
  pattern: string;
  input: number;
  output: number;
  cachedInput?: number;

  /** 5-minute cache-write USD / 1M tokens (Anthropic default TTL). */
  cacheWrite?: number;

  /** 1-hour cache-write USD / 1M tokens. */
  cacheWrite1h?: number;
  image?: number;
  verified: boolean;
  source?: string;
  checkedAt?: string;
};

export type ProviderPrices = {
  id: string;
  source: string;
  models: PriceRow[];
};

export type PricesCatalog = {
  checkedAt: string;
  providers: ProviderPrices[];
};

export type CustomModelPrice = {
  input: number;
  output: number;
  cachedInput?: number;
  cacheWrite?: number;
  cacheWrite1h?: number;
  image?: number;
};

export type CostOptions = {
  cachedTokens?: number;
  cacheWriteTokens?: number;
  cacheWrite1hTokens?: number;
  reasoningTokens?: number;
  reasoningIncludedInOutput?: boolean;
  imageTokens?: number;
  actualCost?: number;
  customPrices?: Record<string, CustomModelPrice>;
  provider?: string;
  precision?: UsagePrecision;
  aborted?: boolean;
  maybeBilled?: boolean;
};

export type CostSource = 'table' | 'custom' | 'provider' | 'local';

export type KnownCost = {
  unknown: false;
  dollars: number;
  nanos: number;
  computedDollars: number;
  computedNanos: number;
  providerDollars?: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  cacheWrite1hTokens: number;
  reasoningTokens: number;
  imageTokens: number;
  price: PriceRow | CustomModelPrice;
  source: CostSource;
  verified: boolean;
  approximate: boolean;
  approximateReasons: ApproximateReason[];
  precision: UsagePrecision;
  divergenceNanos?: number;
  cachedBilledAsInput: boolean;
};

export type UnknownCost = {
  unknown: true;
  dollars: 0;
  nanos: 0;
  computedDollars: 0;
  computedNanos: 0;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  cacheWrite1hTokens: number;
  reasoningTokens: number;
  imageTokens: number;
  approximate: true;
  approximateReasons: ApproximateReason[];
  precision: UsagePrecision;
};

export type CostResult = KnownCost | UnknownCost;

const LOCAL_PROVIDERS = new Set(['ollama', 'lmstudio', 'lm studio']);

const catalog = pricesCatalog as PricesCatalog;

type IndexedRow = PriceRow & { providerId: string; source: string; rank: number };

const indexedRows: IndexedRow[] = catalog.providers.flatMap((provider) =>
  provider.models.map((row) => ({
    ...row,
    providerId: provider.id,
    source: provider.source,
    rank: row.pattern.replace(/\*/g, '').length,
  })),
);

indexedRows.sort((a, b) => b.rank - a.rank);

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function modelCandidates(model: string): string[] {
  const trimmed = model.trim();
  const slash = trimmed.split('/').pop() ?? trimmed;
  const dot = trimmed.includes('.') ? (trimmed.split('.').pop() ?? trimmed) : trimmed;

  return [...new Set([trimmed, slash, dot].filter((value) => value.length > 0))];
}

function matchesPattern(model: string, pattern: string): boolean {
  const regex = globToRegExp(pattern);
  return modelCandidates(model).some((candidate) => regex.test(candidate));
}

export function getPricesCatalog(): PricesCatalog {
  return catalog;
}

export function formatDollars(value: number, digits = 3): string {
  const rounded = roundDollars(value);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);

  return `${sign}$${abs.toFixed(digits)}`;
}

/** Unverified list prices and local estimates; the ≈ prefix is the visual cue. */
export function formatSpend(
  value: number,
  options: { verified?: boolean; approximate?: boolean; digits?: number } = {},
): string {
  const amount = formatDollars(value, options.digits ?? 3);
  const approx = options.approximate === true || options.verified === false;

  return approx ? `≈${amount}` : amount;
}

export function formatPricesCheckedAt(isoDate: string): string {
  const parsed = Date.parse(`${isoDate}T00:00:00Z`);

  if (!Number.isFinite(parsed)) {
    return `prices checked ${isoDate}`;
  }

  const formatted = new Date(parsed).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return `prices checked ${formatted}`;
}

export function formatTokenCount(tokens: number): string {
  const safe = Math.max(0, Math.round(tokens));

  if (safe < 1000) {
    return String(safe);
  }

  const thousands = safe / 1000;

  if (thousands < 100) {
    return `${thousands.toFixed(thousands >= 10 ? 0 : 1).replace(/\.0$/, '')}k`;
  }

  return `${Math.round(thousands)}k`;
}

export function estimateTokensFromText(text: string): number {
  if (!text) {
    return 0;
  }

  return Math.max(0, Math.ceil(text.length / 4));
}

function isLocalProvider(provider?: string): boolean {
  if (!provider) {
    return false;
  }

  return LOCAL_PROVIDERS.has(provider.trim().toLowerCase());
}

function lookupCustomPrice(
  model: string,
  customPrices: Record<string, CustomModelPrice> | undefined,
): CustomModelPrice | undefined {
  if (!customPrices) {
    return undefined;
  }

  for (const candidate of modelCandidates(model)) {
    const exact = customPrices[candidate] ?? customPrices[candidate.toLowerCase()];

    if (exact) {
      return exact;
    }
  }

  return undefined;
}

export function lookupPrice(
  model: string,
  options: Pick<CostOptions, 'customPrices' | 'provider'> = {},
): { price: PriceRow | CustomModelPrice; source: 'table' | 'custom' | 'local'; verified: boolean } | undefined {
  if (isLocalProvider(options.provider)) {
    return { price: { pattern: '*', input: 0, output: 0, verified: true }, source: 'local', verified: true };
  }

  const custom = lookupCustomPrice(model, options.customPrices);

  if (custom) {
    return { price: custom, source: 'custom', verified: true };
  }

  const providerId = options.provider?.trim().toLowerCase().replace(/\s+/g, '');

  const match = indexedRows.find((row) => {
    // Catch-alls (`*`) are local-provider rows and must not steal cloud models.
    if (row.pattern === '*') {
      return providerId === row.providerId;
    }

    return matchesPattern(model, row.pattern);
  });

  if (!match) {
    return undefined;
  }

  return { price: match, source: 'table', verified: match.verified };
}

function emptyReasons(options: CostOptions): ApproximateReason[] {
  const reasons: ApproximateReason[] = [];

  if (options.precision === 'estimate') {
    reasons.push('local-estimate');
  }

  if (options.aborted) {
    reasons.push('aborted');
  }

  if (options.maybeBilled) {
    reasons.push('failed-maybe-billed');
  }

  return reasons;
}

function nanosFromPrice(
  price: Pick<PriceRow, 'input' | 'output' | 'cachedInput' | 'cacheWrite' | 'cacheWrite1h' | 'image'>,
  input: {
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    cacheWriteTokens: number;
    cacheWrite1hTokens: number;
    reasoningTokens: number;
    reasoningIncludedInOutput: boolean;
    imageTokens: number;
  },
): { nanos: number; reasons: ApproximateReason[]; cachedBilledAsInput: boolean } {
  const cacheWrite = Math.max(0, input.cacheWriteTokens);
  const cacheWrite1h = Math.max(0, input.cacheWrite1hTokens);
  const cached = Math.min(Math.max(0, input.cachedTokens), Math.max(0, input.promptTokens));
  const uncached = Math.max(0, input.promptTokens - cached - cacheWrite - cacheWrite1h);
  const reasons: ApproximateReason[] = [];

  let nanos = 0;

  nanos += tokensToNanos(uncached, price.input);

  if (cached > 0) {
    if (typeof price.cachedInput === 'number') {
      nanos += tokensToNanos(cached, price.cachedInput);
    } else {
      nanos += tokensToNanos(cached, price.input);
      reasons.push('unpriced-category');
    }
  }

  if (cacheWrite > 0) {
    if (typeof price.cacheWrite === 'number') {
      nanos += tokensToNanos(cacheWrite, price.cacheWrite);
    } else {
      nanos += tokensToNanos(cacheWrite, price.input);
      reasons.push('unpriced-category');
    }
  }

  if (cacheWrite1h > 0) {
    if (typeof price.cacheWrite1h === 'number') {
      nanos += tokensToNanos(cacheWrite1h, price.cacheWrite1h);
    } else {
      nanos += tokensToNanos(cacheWrite1h, typeof price.cacheWrite === 'number' ? price.cacheWrite : price.input);
      reasons.push('unpriced-category');
    }
  }

  if (input.imageTokens > 0 && typeof price.image !== 'number') {
    /*
     * Image tokens are usually already inside prompt_tokens; if a dedicated
     * rate is missing we keep the prompt billing and mark the total ≈.
     */
    reasons.push('unpriced-category');
  } else if (input.imageTokens > 0 && typeof price.image === 'number') {
    nanos += tokensToNanos(input.imageTokens, price.image);
  }

  const extraReasoning = input.reasoningIncludedInOutput ? 0 : Math.max(0, input.reasoningTokens);
  nanos += tokensToNanos(Math.max(0, input.completionTokens) + extraReasoning, price.output);

  return {
    nanos,
    reasons: [...new Set(reasons)],
    cachedBilledAsInput: cached > 0 && typeof price.cachedInput !== 'number',
  };
}

export function costFromUsage(
  model: string,
  usage: Pick<
    TokenUsage,
    | 'promptTokens'
    | 'completionTokens'
    | 'cachedTokens'
    | 'cacheWriteTokens'
    | 'cacheWrite1hTokens'
    | 'reasoningTokens'
    | 'reasoningIncludedInOutput'
    | 'imageTokens'
    | 'cost'
    | 'precision'
    | 'aborted'
    | 'maybeBilled'
  >,
  options: Omit<CostOptions, 'cachedTokens' | 'actualCost'> = {},
): CostResult {
  return cost(model, usage.promptTokens, usage.completionTokens, {
    ...options,
    cachedTokens: usage.cachedTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    cacheWrite1hTokens: usage.cacheWrite1hTokens,
    reasoningTokens: usage.reasoningTokens,
    reasoningIncludedInOutput: usage.reasoningIncludedInOutput,
    imageTokens: usage.imageTokens,
    actualCost: usage.cost,
    precision: usage.precision,
    aborted: usage.aborted,
    maybeBilled: usage.maybeBilled,
  });
}

export function cost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  options: CostOptions = {},
): CostResult {
  const prompt = Number.isFinite(promptTokens) ? Math.max(0, promptTokens) : 0;
  const completion = Number.isFinite(completionTokens) ? Math.max(0, completionTokens) : 0;
  const cached = Number.isFinite(options.cachedTokens) ? Math.max(0, options.cachedTokens ?? 0) : 0;
  const cacheWrite = Number.isFinite(options.cacheWriteTokens) ? Math.max(0, options.cacheWriteTokens ?? 0) : 0;
  const cacheWrite1h = Number.isFinite(options.cacheWrite1hTokens) ? Math.max(0, options.cacheWrite1hTokens ?? 0) : 0;
  const reasoning = Number.isFinite(options.reasoningTokens) ? Math.max(0, options.reasoningTokens ?? 0) : 0;
  const image = Number.isFinite(options.imageTokens) ? Math.max(0, options.imageTokens ?? 0) : 0;
  const precision = options.precision ?? 'exact';
  const baseReasons = emptyReasons(options);

  const tokenFields = {
    promptTokens: prompt,
    completionTokens: completion,
    cachedTokens: cached,
    cacheWriteTokens: cacheWrite,
    cacheWrite1hTokens: cacheWrite1h,
    reasoningTokens: reasoning,
    imageTokens: image,
  };

  const lookedUp = lookupPrice(model, options);

  const billed = lookedUp
    ? nanosFromPrice(lookedUp.price, {
        ...tokenFields,
        reasoningIncludedInOutput: options.reasoningIncludedInOutput !== false,
      })
    : undefined;

  const computedNanos = billed?.nanos ?? 0;
  const computedDollars = dollarsFromNanos(computedNanos);

  const actualCost = options.actualCost;

  if (typeof actualCost === 'number' && Number.isFinite(actualCost) && actualCost >= 0) {
    const providerNanos = dollarsToNanos(actualCost);
    const divergenceNanos = billed ? providerNanos - billed.nanos : undefined;
    const reasons = [...baseReasons];

    return {
      unknown: false,
      dollars: dollarsFromNanos(providerNanos),
      nanos: providerNanos,
      computedDollars,
      computedNanos,
      providerDollars: dollarsFromNanos(providerNanos),
      model,
      ...tokenFields,
      price: lookedUp?.price ?? { pattern: model, input: 0, output: 0, verified: true },
      source: 'provider',
      verified: true,
      approximate: reasons.length > 0,
      approximateReasons: reasons,
      precision,
      ...(divergenceNanos !== undefined ? { divergenceNanos } : {}),
      cachedBilledAsInput: billed?.cachedBilledAsInput ?? false,
    };
  }

  if (!lookedUp || !billed) {
    return {
      unknown: true,
      dollars: 0,
      nanos: 0,
      computedDollars: 0,
      computedNanos: 0,
      model,
      ...tokenFields,
      approximate: true,
      approximateReasons: [...baseReasons, 'unknown-model'],
      precision,
    };
  }

  const reasons = [...baseReasons, ...billed.reasons];

  if (lookedUp.verified === false) {
    reasons.push('unverified-price');
  }

  const uniqueReasons = [...new Set(reasons)];

  return {
    unknown: false,
    dollars: computedDollars,
    nanos: computedNanos,
    computedDollars,
    computedNanos,
    model,
    ...tokenFields,
    price: lookedUp.price,
    source: lookedUp.source,
    verified: lookedUp.verified && uniqueReasons.length === 0,
    approximate: uniqueReasons.length > 0,
    approximateReasons: uniqueReasons,
    precision,
    cachedBilledAsInput: billed.cachedBilledAsInput,
  };
}
