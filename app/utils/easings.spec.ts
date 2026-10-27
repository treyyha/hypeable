import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cubicEasingFn } from './easings';

const dir = dirname(fileURLToPath(import.meta.url));

describe('easings', () => {
  it('exports a cubic-bezier tuple without importing framer-motion', () => {
    expect(cubicEasingFn).toEqual([0.4, 0, 0.2, 1]);

    const src = readFileSync(join(dir, 'easings.ts'), 'utf8');
    expect(src).not.toMatch(/from ['"]framer-motion['"]/);
  });
});
