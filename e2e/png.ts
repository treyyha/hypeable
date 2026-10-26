/**
 * Minimal 8-bit RGB/RGBA PNG reader so presentation tests can sample pixels
 * from Playwright screenshots without an extra image library.
 */
import { inflateSync } from 'node:zlib';

export type Rgb = { r: number; g: number; b: number };

function asBytes(png: Uint8Array): Uint8Array {
  return png;
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
  );
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDelta = Math.abs(estimate - left);
  const upDelta = Math.abs(estimate - up);
  const upLeftDelta = Math.abs(estimate - upLeft);

  if (leftDelta <= upDelta && leftDelta <= upLeftDelta) {
    return left;
  }

  if (upDelta <= upLeftDelta) {
    return up;
  }

  return upLeft;
}

function applyFilter(filter: number, dest: Uint8Array, up: Uint8Array | null, bytesPerPixel: number): void {
  const stride = dest.length;

  if (filter === 0) {
    return;
  }

  if (filter === 1) {
    for (let i = bytesPerPixel; i < stride; i++) {
      dest[i] = (dest[i] + dest[i - bytesPerPixel]) & 255;
    }

    return;
  }

  if (filter === 2) {
    if (!up) {
      return;
    }

    for (let i = 0; i < stride; i++) {
      dest[i] = (dest[i] + up[i]) & 255;
    }

    return;
  }

  if (filter === 3) {
    for (let i = 0; i < stride; i++) {
      const left = i >= bytesPerPixel ? dest[i - bytesPerPixel] : 0;
      const above = up ? up[i] : 0;
      dest[i] = (dest[i] + Math.floor((left + above) / 2)) & 255;
    }

    return;
  }

  if (filter === 4) {
    const previous = up ?? new Uint8Array(stride);

    for (let i = 0; i < stride; i++) {
      const left = i >= bytesPerPixel ? dest[i - bytesPerPixel] : 0;
      const above = previous[i];
      const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0;
      dest[i] = (dest[i] + paeth(left, above, upLeft)) & 255;
    }

    return;
  }

  throw new Error(`unsupported PNG filter ${filter}`);
}

export function pngSize(png: Uint8Array): { width: number; height: number } {
  const bytes = asBytes(png);

  if (ascii(bytes, 1, 4) !== 'PNG') {
    throw new Error('not a PNG');
  }

  return { width: readU32(bytes, 16), height: readU32(bytes, 20) };
}

export function pngPixel(png: Uint8Array, x: number, y: number): Rgb {
  const bytes = asBytes(png);

  if (ascii(bytes, 1, 4) !== 'PNG') {
    throw new Error('not a PNG');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Uint8Array[] = [];

  while (offset + 12 <= bytes.length) {
    const length = readU32(bytes, offset);
    const type = ascii(bytes, offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = readU32(data, 0);
      height = readU32(data, 4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported PNG ${bitDepth}/${colorType}`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const concatenated = new Uint8Array(idat.reduce((sum, chunk) => sum + chunk.length, 0));
  let cursor = 0;

  for (const chunk of idat) {
    concatenated.set(chunk, cursor);
    cursor += chunk.length;
  }

  const raw = inflateSync(concatenated);
  const stride = width * bytesPerPixel;
  const pixels = new Uint8Array(height * stride);
  let src = 0;

  for (let row = 0; row < height; row++) {
    const filter = raw[src++];
    const dest = pixels.subarray(row * stride, (row + 1) * stride);
    dest.set(raw.subarray(src, src + stride));
    src += stride;
    applyFilter(filter, dest, row > 0 ? pixels.subarray((row - 1) * stride, row * stride) : null, bytesPerPixel);
  }

  const sampleX = Math.min(width - 1, Math.max(0, Math.round(x)));
  const sampleY = Math.min(height - 1, Math.max(0, Math.round(y)));
  const index = (sampleY * width + sampleX) * bytesPerPixel;

  return { r: pixels[index], g: pixels[index + 1], b: pixels[index + 2] };
}
