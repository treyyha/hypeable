import { describe, expect, it } from 'vitest';
import { injectStreamUsageOption } from './include-usage-fetch';

describe('injectStreamUsageOption', () => {
  it('adds stream_options.include_usage to Chat Completions streams', () => {
    const init = injectStreamUsageOption({
      method: 'POST',
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        stream: true,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    expect(JSON.parse(String(init?.body))).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
    });
  });

  it('leaves Responses API bodies alone', () => {
    const body = JSON.stringify({ model: 'gpt-5.3-codex', stream: true, input: 'hi' });
    const init = injectStreamUsageOption({ method: 'POST', body });

    expect(init?.body).toBe(body);
  });

  it('does not touch non-streaming Chat Completions', () => {
    const body = JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] });
    const init = injectStreamUsageOption({ method: 'POST', body });

    expect(init?.body).toBe(body);
  });
});
