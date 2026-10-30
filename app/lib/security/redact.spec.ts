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

  it('strips GitLab, GitHub fine-grained, Netlify, and Supabase PATs', () => {
    // Concatenate so gitleaks does not treat the spec as a live PAT.
    const gitlabPat = `gl${'pat-'}${'a'.repeat(20)}`;
    const githubPat = `github${'_pat_'}${'a'.repeat(20)}`;
    const netlifyPat = `nf${'p_'}${'a'.repeat(20)}`;
    const supabasePat = `sb${'p_'}${'a'.repeat(20)}`;

    expect(redact(gitlabPat)).toBe('[REDACTED]');
    expect(redact(githubPat)).toBe('[REDACTED]');
    expect(redact(netlifyPat)).toBe('[REDACTED]');
    expect(redact(supabasePat)).toBe('[REDACTED]');
    expect(redact(`PRIVATE-TOKEN: ${gitlabPat}`)).toContain('[REDACTED]');
  });

  it('strips Groq, xAI, Hugging Face, Google, Supabase secret, and AWS keys', () => {
    const keys = [
      `gs${'k_'}${'a1'.repeat(20)}`,
      `xa${'i-'}${'b2'.repeat(20)}`,
      `h${'f_'}${'c3'.repeat(15)}`,
      `AI${'za'}${'Sy'}${'d4'.repeat(16)}x`,
      `sb_${'secret_'}${'e5'.repeat(14)}`,
      `AK${'IA'}${'F6G7'.repeat(4)}`,
    ];

    for (const key of keys) {
      const out = redact(`provider said: invalid key ${key} (401)`);
      expect(out).not.toContain(key);
      expect(out).toContain('[REDACTED]');
    }
  });

  it('strips OpenRouter sk-or- keys constructed at runtime', () => {
    const openRouterKey = `sk-or-v1-${'a'.repeat(24)}`;
    expect(redact(`provider failed for ${openRouterKey}`)).not.toContain(openRouterKey);
    expect(redact(`provider failed for ${openRouterKey}`)).toContain('[REDACTED]');
  });

  it('strips OAuth code query params from URLs', () => {
    const url = 'http://localhost:5173/auth/openrouter/callback?code=auth_code_abc&state=csrf';
    expect(redact(url)).not.toContain('auth_code_abc');
    expect(redact(url)).toContain('state=csrf');
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

  it('stringifies null and undefined instead of throwing', () => {
    expect(redactUnknown(null)).toBe('null');
    expect(redactUnknown(undefined)).toBe('undefined');
    expect(redact(undefined as unknown as string)).toBe('undefined');
  });
});
