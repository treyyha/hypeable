import { describe, expect, it } from 'vitest';
import { buildReplanPrompt, isAutoFixRequest } from './replan';

describe('replan prompt', () => {
  it('asks for a different plan and waits for approval', () => {
    const prompt = buildReplanPrompt({
      error: 'TypeError: map of undefined',
      count: 3,
      tried: ['rewrote src/App.tsx'],
    });

    expect(prompt).toContain('Do NOT repeat it');
    expect(prompt).toContain('failed 3 times');
    expect(prompt).toContain('TypeError: map of undefined');
    expect(prompt).toContain('- rewrote src/App.tsx');
    expect(prompt).toContain('Wait for my approval');
  });

  it('detects auto-fix requests even with the chat preamble', () => {
    expect(isAutoFixRequest('*Fix this terminal error* \n```sh\nls\n```\n')).toBe(true);
    expect(
      isAutoFixRequest('[Model: gpt-4o]\n\n[Provider: OpenAI]\n\n*Fix this preview error* \n```js\nx\n```\n'),
    ).toBe(true);
    expect(isAutoFixRequest('please add a sidebar')).toBe(false);
  });
});
