import { describe, expect, it } from 'vitest';
import { hypeablePlanSchema, parseHypeablePlan } from './schema';

const valid = {
  title: 'Notes app',
  summary: 'A small notes app with tags.',
  pages: [{ name: 'Home', purpose: 'List notes' }],
  data: [{ entity: 'Note', storage: 'localStorage' }],
  features: [
    { id: 'list', text: 'List notes' },
    { id: 'tags', text: 'Tag a note', optional: true },
  ],
  stack: ['Vite', 'React'],
  assumptions: ['Single user'],
  risks: ['localStorage quota'],
};

describe('hypeablePlanSchema', () => {
  it('accepts a valid plan', () => {
    expect(hypeablePlanSchema.parse(valid).title).toBe('Notes app');
    expect(parseHypeablePlan(valid)).toEqual({ ok: true, plan: valid });
  });

  it('rejects missing fields, extra keys, and empty title', () => {
    expect(parseHypeablePlan({ ...valid, title: '' }).ok).toBe(false);
    expect(parseHypeablePlan({ ...valid, extra: true }).ok).toBe(false);
    expect(parseHypeablePlan({ title: 'x' }).ok).toBe(false);
    expect(parseHypeablePlan(null).ok).toBe(false);
  });
});
