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

  const srgb = value.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/i);

  if (srgb) {
    const alphaRaw = srgb[4];
    let a = 1;

    if (alphaRaw) {
      a = alphaRaw.endsWith('%') ? Number.parseFloat(alphaRaw) / 100 : Number.parseFloat(alphaRaw);
    }

    return {
      r: Number.parseFloat(srgb[1]) * 255,
      g: Number.parseFloat(srgb[2]) * 255,
      b: Number.parseFloat(srgb[3]) * 255,
      a,
    };
  }

  const oklab = value.match(
    /oklab\(\s*([\d.e+-]+|none)\s+([\d.e+-]+|none)\s+([\d.e+-]+|none)(?:\s*\/\s*([\d.e+-]+%?|none))?\s*\)/i,
  );

  if (oklab) {
    const rgb = oklabToSrgb(cssNumber(oklab[1]), cssNumber(oklab[2]), cssNumber(oklab[3]));

    return { ...rgb, a: cssAlpha(oklab[4]) };
  }

  const oklch = value.match(
    /oklch\(\s*([\d.e+-]+|none)\s+([\d.e+-]+|none)\s+([\d.e+-]+|none)(?:\s*\/\s*([\d.e+-]+%?|none))?\s*\)/i,
  );

  if (oklch) {
    const L = cssNumber(oklch[1]);
    const C = cssNumber(oklch[2]);
    const H = cssNumber(oklch[3]);
    const rad = (H * Math.PI) / 180;
    const rgb = oklabToSrgb(L, C * Math.cos(rad), C * Math.sin(rad));

    return { ...rgb, a: cssAlpha(oklch[4]) };
  }

  throw new Error(`unsupported CSS color: ${value}`);
}

function cssNumber(raw: string | undefined): number {
  if (!raw || raw === 'none') {
    return 0;
  }

  return Number.parseFloat(raw);
}

function cssAlpha(raw: string | undefined): number {
  if (!raw || raw === 'none') {
    return raw === 'none' ? 0 : 1;
  }

  return raw.endsWith('%') ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);
}

function linToSrgbByte(lin: number): number {
  const sign = lin < 0 ? -1 : 1;
  const abs = Math.abs(lin);
  const mag = abs <= 0.0031308 ? 12.92 * abs : 1.055 * abs ** (1 / 2.4) - 0.055;

  return Math.min(255, Math.max(0, sign * mag * 255));
}

/** CSS Color 4 OKLab → sRGB bytes. */
function oklabToSrgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: linToSrgbByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linToSrgbByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linToSrgbByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
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

/** Unthemed ButtonFace / canvas white, not a saturated accent fill. */
export function isNearWhite({ r, g, b, a }: Rgba): boolean {
  if (a < 0.6) {
    return false;
  }

  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const luma = (r + g + b) / 3;

  return luma >= 230 && chroma < 22;
}

export function colorsEqual({ r: r1, g: g1, b: b1 }: Rgba, { r: r2, g: g2, b: b2 }: Rgba): boolean {
  return Math.abs(r1 - r2) < 8 && Math.abs(g1 - g2) < 8 && Math.abs(b1 - b2) < 8;
}

export function compositeStack(layers: Rgba[], fallback: Rgba): Rgba {
  let acc = fallback;

  for (const layer of layers) {
    acc = composite(layer, acc);
  }

  return acc;
}
