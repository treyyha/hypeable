import { describe, expect, it } from 'vitest';
import { formatReceipt } from './receipt';

describe('cost receipt', () => {
  it('formats a shareable line with real totals', () => {
    expect(
      formatReceipt({
        sessionTotal: 0.42,
        sessionPromptTokens: 20000,
        sessionCompletionTokens: 18000,
        byModel: {
          'claude-sonnet-4-6': { dollars: 0.3, promptTokens: 15000, completionTokens: 10000 },
          'gpt-5.4': { dollars: 0.12, promptTokens: 5000, completionTokens: 8000 },
        },
      }),
    ).toBe('Built with Hypeable: $0.42 | 38k tokens | claude-sonnet-4-6, gpt-5.4 | hypeable.dev');
  });

  it('still produces a line when nothing has been spent', () => {
    expect(
      formatReceipt({
        sessionTotal: 0,
        sessionPromptTokens: 0,
        sessionCompletionTokens: 0,
        byModel: {},
      }),
    ).toBe('Built with Hypeable: $0.00 | 0 tokens | no model | hypeable.dev');
  });
});
