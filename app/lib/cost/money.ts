/**
 * Integer nano-dollars (1e-9 USD) so a single cheap-model token still
 * counts, while the pill and cap check share one rounded dollar figure.
 */
export const NANOS_PER_DOLLAR = 1_000_000_000;
export const MICROS_PER_DOLLAR = 1_000_000;

/** USD per 1M tokens → nanos for `tokens` units. */
export function tokensToNanos(tokens: number, pricePerMillion: number): number {
  const safeTokens = Number.isFinite(tokens) ? Math.max(0, tokens) : 0;
  const price = Number.isFinite(pricePerMillion) ? Math.max(0, pricePerMillion) : 0;

  return Math.round(safeTokens * price * 1_000);
}

export function dollarsToNanos(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * NANOS_PER_DOLLAR);
}

export function nanosToDollars(nanos: number): number {
  if (!Number.isFinite(nanos)) {
    return 0;
  }

  return nanos / NANOS_PER_DOLLAR;
}

/** Display / cap unit: the same micro-dollar rounding the pill uses. */
export function roundDollars(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * MICROS_PER_DOLLAR) / MICROS_PER_DOLLAR;
}

export function dollarsFromNanos(nanos: number): number {
  return roundDollars(nanosToDollars(nanos));
}
