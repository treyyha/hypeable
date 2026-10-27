import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, STARTER_TEMPLATES, WORK_DIR } from './constants-core';

const dir = dirname(fileURLToPath(import.meta.url));

describe('constants-core', () => {
  it('keeps the product default and starter templates without LLM SDKs', () => {
    expect(DEFAULT_MODEL.length).toBeGreaterThan(0);
    expect(WORK_DIR).toContain('project');
    expect(STARTER_TEMPLATES.length).toBeGreaterThan(0);

    const src = readFileSync(join(dir, 'constants-core.ts'), 'utf8');
    expect(src).not.toMatch('llm/manager');
    expect(src).not.toMatch('provider-list');
  });
});
