import { afterEach, describe, expect, it } from 'vitest';
import { githubTemplateAuthToken } from './api.github-template';

describe('githubTemplateAuthToken', () => {
  const original = process.env.GITHUB_TOKEN;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = original;
    }
  });

  it('returns undefined on hosted even if an operator token is set', () => {
    process.env.GITHUB_TOKEN = 'operator-github-token-value';

    expect(
      githubTemplateAuthToken({
        hostname: 'hypeable.dev',
        cloudflare: { env: { HYPEABLE_HOSTED: '1', GITHUB_TOKEN: 'operator-github-token-value' } },
      }),
    ).toBeUndefined();
  });

  it('can use an operator token when self-hosted', () => {
    expect(
      githubTemplateAuthToken({
        hostname: 'localhost',
        cloudflare: { env: { HYPEABLE_SELF_HOSTED: '1', GITHUB_TOKEN: 'operator-github-token-value' } },
      }),
    ).toBe('operator-github-token-value');
  });
});
