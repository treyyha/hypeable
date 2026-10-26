/**
 * Contrast helpers for presentation tests. Computed CSS colors are composited
 * over the header fill before WCAG 2.x contrast is measured.
 */

export type Rgba = { r: number; g: number; b: number; a: number };

export function parseCssColor(value: string): Rgba {
  const hex = value.trim().match(/^#([0-9a-f]{3,8})$/i);

  if (hex) {
    let body = hex[1];

    if (body.length === 3 || body.length === 4) {
      body = body
        .split('')
        .map((char) => char + char)
        .join('');
    }

    const r = Number.parseInt(body.slice(0, 2), 16);
    const g = Number.parseInt(body.slice(2, 4), 16);
    const b = Number.parseInt(body.slice(4, 6), 16);
    const a = body.length >= 8 ? Number.parseInt(body.slice(6, 8), 16) / 255 : 1;

    return { r, g, b, a };
  }

  const rgb = value.match(/rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i);

  if (rgb) {
    const alphaRaw = rgb[4];
    let a = 1;

    if (alphaRaw) {
      a = alphaRaw.endsWith('%') ? Number.parseFloat(alphaRaw) / 100 : Number.parseFloat(alphaRaw);
    }

    return { r: Number.parseFloat(rgb[1]), g: Number.parseFloat(rgb[2]), b: Number.parseFloat(rgb[3]), a };
  }

  throw new Error(`unsupported CSS color: ${value}`);
}

export function composite(fg: Rgba, bg: Rgba): Rgba {
  const alpha = Math.min(1, Math.max(0, fg.a));

  return {
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
    a: 1,
  };
}

function srgbToLin(channel: number): number {
  const value = channel / 255;

  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgba): number {
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}
