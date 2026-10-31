import { describe, expect, it } from 'vitest';
import { classifyUserError, stripStackTrace } from './user-facing';

describe('classifyUserError', () => {
  it('maps the common provider failures', () => {
    expect(classifyUserError({ online: false }).kind).toBe('offline');
    expect(classifyUserError({ statusCode: 401, message: 'Invalid or missing API key' }).kind).toBe('invalid_key');
    expect(classifyUserError({ statusCode: 402, message: 'Payment required' }).kind).toBe('no_credit');
    expect(classifyUserError({ message: 'insufficient credits' }).kind).toBe('no_credit');
    expect(classifyUserError({ statusCode: 429, message: 'Rate limit exceeded' }).kind).toBe('rate_limit');
    expect(classifyUserError({ statusCode: 503 }).kind).toBe('provider_down');
    expect(classifyUserError({ message: 'The AI provider stopped responding' }).kind).toBe('timeout');
    expect(classifyUserError({ message: 'Add an API key' }).kind).toBe('no_key');
  });

  it('tells the user how to get under the body cap on a 413', () => {
    const copy = classifyUserError({ statusCode: 413, message: 'Request body is too large. The limit is 2.0 MB.' });
    expect(copy.kind).toBe('too_large');
    expect(copy.message).toMatch(/new chat/i);
    expect(copy.message).not.toMatch(/provider status/i);
  });

  it('never returns a stack frame', () => {
    for (const kind of ['no_key', 'invalid_key', 'no_credit', 'rate_limit'] as const) {
      const copy = classifyUserError({
        statusCode: kind === 'invalid_key' ? 401 : kind === 'no_credit' ? 402 : kind === 'rate_limit' ? 429 : undefined,
        message: kind === 'no_key' ? 'Add an API key' : 'x',
      });
      expect(copy.message).not.toMatch(/at\s+\w+/);
      expect(copy.message).not.toContain('Error:');
    }
  });
});

describe('stripStackTrace', () => {
  it('drops V8 frames and keeps the first line', () => {
    expect(
      stripStackTrace("TypeError: Cannot read 'map'\n    at App (src/App.tsx:12:4)\n    at render (react.ts:1:1)"),
    ).toBe("TypeError: Cannot read 'map'");
  });
});
