/**
 * UnoCSS `/NN` opacity on `var(--hype-*)` / `var(--bolt-*)` cannot mix alpha
 * (the engine emits the solid variable and drops the percentage). Rewrite to
 * color-mix so tinted fills stay tints in both themes.
 */

const VAR_COLOR = /var\(--(?:hype|bolt)-[A-Za-z0-9-]+\)/g;
const OPACITY = /\\\/(\d{1,3})(?!\d)/;

export type CssEntry = [string, string | number | undefined, ...unknown[]];

export function opacityFromSelector(selector: string): number | null {
  const match = selector.match(OPACITY);

  if (!match) {
    return null;
  }

  const percent = Number(match[1]);

  if (!Number.isFinite(percent) || percent < 0 || percent >= 100) {
    return null;
  }

  return percent;
}

export function mixCssVarAlpha(selector: string, entries: CssEntry[]): CssEntry[] {
  const percent = opacityFromSelector(selector);

  if (percent === null) {
    return entries;
  }

  for (const entry of entries) {
    const value = entry[1];

    if (typeof value !== 'string' || !value.includes('var(--')) {
      continue;
    }

    VAR_COLOR.lastIndex = 0;
    entry[1] = value.replace(VAR_COLOR, (variable) => `color-mix(in srgb, ${variable} ${percent}%, transparent)`);
  }

  return entries;
}

export function varAlphaPostprocess(util: { selector: string; entries: CssEntry[] }): void {
  mixCssVarAlpha(util.selector, util.entries);
}
