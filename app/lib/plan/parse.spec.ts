import { describe, expect, it } from 'vitest';
import { extractPlanFence, parsePlanReply } from './parse';

const plan = {
  title: 'Notes',
  summary: 'Notes with tags.',
  pages: [{ name: 'Home', purpose: 'List' }],
  data: [{ entity: 'Note', storage: 'localStorage' }],
  features: [{ id: 'list', text: 'List notes' }],
  stack: ['Vite'],
  assumptions: ['offline'],
  risks: ['quota'],
};

const reply = `Here is a plan.\n\n\`\`\`hypeable-plan\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n`;

describe('parsePlanReply', () => {
  it('extracts and parses a valid fence', () => {
    expect(extractPlanFence(reply)).toContain('"title": "Notes"');

    const parsed = parsePlanReply(reply);
    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      expect(parsed.plan.title).toBe('Notes');
      expect(parsed.intro).toBe('Here is a plan.');
    }
  });

  it('returns the raw text when JSON is missing or invalid', () => {
    expect(parsePlanReply('just a paragraph').ok).toBe(false);
    expect(parsePlanReply('```hypeable-plan\n{not json}\n```').ok).toBe(false);
    expect(parsePlanReply('```hypeable-plan\n{"title":"x"}\n```').ok).toBe(false);
  });
});
