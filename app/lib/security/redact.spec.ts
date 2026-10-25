import { describe, expect, it } from 'vitest';
import { redact, redactUnknown } from './redact';

const FAKE_KEY = 'sk-testkeytestkeytestkey12';

describe('redact', () => {
  it('strips OpenAI-style keys, Anthropic keys, GitHub tokens, and Bearer values', () => {
    expect(redact(`Authorization: Bearer ${FAKE_KEY}`)).toContain('[REDACTED]');
    expect(redact(`Authorization: Bearer ${FAKE_KEY}`)).not.toContain(FAKE_KEY);
    expect(redact('sk-ant-fakekeyvalue')).toBe('[REDACTED]');
    expect(redact('gho_abcdefghijklmnopqrstuvwx')).toBe('[REDACTED]');
  });

  it('strips x-hypeable-key header dumps and apiKeys cookies', () => {
    expect(redact(`x-hypeable-key: ${FAKE_KEY}`)).not.toContain(FAKE_KEY);
    expect(redact(`Cookie: theme=dark; apiKeys=%7B%22OpenAI%22%3A%22${FAKE_KEY}%22%7D`)).not.toContain(FAKE_KEY);
    expect(redact(`Cookie: githubToken=${FAKE_KEY}`)).not.toContain(FAKE_KEY);
  });

  it('redacts keys nested in objects', () => {
    const dumped = redactUnknown({ headers: { 'x-hypeable-key': FAKE_KEY } });
    expect(dumped).not.toContain(FAKE_KEY);
  });
});

describe('redactUnknown', () => {
  it('redacts a key inside an Error before it can be logged', () => {
    expect(redactUnknown(new Error(`provider failed for ${FAKE_KEY}`))).not.toContain(FAKE_KEY);
    expect(redactUnknown(`provider failed for ${FAKE_KEY}`)).toContain('[REDACTED]');
  });
});
