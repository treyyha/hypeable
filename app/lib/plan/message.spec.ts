import { describe, expect, it } from 'vitest';
import { buildApprovedPlanMessage, buildLoopPlanContext, defaultTickedFeatureIds } from './message';
import type { HypeablePlan } from './schema';

const plan: HypeablePlan = {
  title: 'Notes',
  summary: 'Notes with tags.',
  pages: [{ name: 'Home', purpose: 'List' }],
  data: [{ entity: 'Note', storage: 'localStorage' }],
  features: [
    { id: 'list', text: 'List notes' },
    { id: 'tags', text: 'Tag a note', optional: true },
    { id: 'search', text: 'Search notes' },
  ],
  stack: ['Vite'],
  assumptions: ['offline'],
  risks: ['quota'],
};

describe('approved plan message', () => {
  it('ticks required features by default and omits optional ones', () => {
    expect(defaultTickedFeatureIds(plan)).toEqual(['list', 'search']);
  });

  it('contains only ticked features and asks for PLAN.md first', () => {
    const message = buildApprovedPlanMessage(plan, ['list', 'tags']);

    expect(message).toContain('Build exactly this');
    expect(message).toContain('PLAN.md');
    expect(message).toContain('List notes');
    expect(message).toContain('Tag a note');
    expect(message).not.toContain('Search notes');
  });
});

describe('loop plan context', () => {
  it('includes the error and what was tried so Replan can force the gate', () => {
    const text = buildLoopPlanContext({
      error: 'TypeError: map of undefined',
      count: 3,
      tried: ['rewrote src/App.tsx'],
    });

    expect(text).toContain('TypeError: map of undefined');
    expect(text).toContain('- rewrote src/App.tsx');
    expect(text).toContain('Do not write code yet');
    expect(text).toContain('failed 3 times');
  });
});
