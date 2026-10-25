/**
 * Token × list-price → dollars. Unknown models stay unknown so the UI can
 * prompt for a custom price instead of silently inventing one.
 */
import pricesCatalog from './prices.json';

export const TOKENS_PER_DOLLAR_UNIT = 1_000_000;

export type PriceRow = {
  pattern: string;
  input: number;
  output: number;
  cachedInput?: number;
  verified: boolean;
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
};

export type CostOptions = {
  cachedTokens?: number;
  actualCost?: number;
  customPrices?: Record<string, CustomModelPrice>;
  provider?: string;
};

export type KnownCost = {
  unknown: false;
  dollars: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  price: PriceRow | CustomModelPrice;
  source: 'table' | 'custom' | 'provider' | 'local';
};

export type UnknownCost = {
  unknown: true;
  dollars: 0;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
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

export function roundDollars(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 1e6) / 1e6;
}

export function formatDollars(value: number, digits = 3): string {
  const rounded = roundDollars(value);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);

  return `${sign}$${abs.toFixed(digits)}`;
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

function dollarsFromPrice(
  price: Pick<PriceRow, 'input' | 'output' | 'cachedInput'>,
  promptTokens: number,
  completionTokens: number,
  cachedTokens: number,
): number {
  const cached = Math.min(Math.max(0, cachedTokens), Math.max(0, promptTokens));
  const uncached = Math.max(0, promptTokens - cached);
  const cachedRate = price.cachedInput ?? price.input;

  return roundDollars(
    (uncached * price.input + cached * cachedRate + Math.max(0, completionTokens) * price.output) /
      TOKENS_PER_DOLLAR_UNIT,
  );
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

  if (typeof options.actualCost === 'number' && Number.isFinite(options.actualCost) && options.actualCost >= 0) {
    return {
      unknown: false,
      dollars: roundDollars(options.actualCost),
      model,
      promptTokens: prompt,
      completionTokens: completion,
      cachedTokens: cached,
      price: { pattern: model, input: 0, output: 0, verified: true },
      source: 'provider',
    };
  }

  const lookedUp = lookupPrice(model, options);

  if (!lookedUp) {
    return {
      unknown: true,
      dollars: 0,
      model,
      promptTokens: prompt,
      completionTokens: completion,
      cachedTokens: cached,
    };
  }

  return {
    unknown: false,
    dollars: dollarsFromPrice(lookedUp.price, prompt, completion, cached),
    model,
    promptTokens: prompt,
    completionTokens: completion,
    cachedTokens: cached,
    price: lookedUp.price,
    source: lookedUp.source,
  };
}
