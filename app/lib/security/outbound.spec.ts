import { afterEach, describe, expect, it } from 'vitest';
import {
  FIRST_PARTY_PROVIDER_HOSTS,
  HOSTED_CUSTOM_ENDPOINT_MESSAGE,
  HostedOutboundError,
  assertGitProxyTarget,
  assertHostedGitLabUrl,
  assertHostedProviderAccess,
  assertHostedWebFetch,
} from './outbound';

const hosted = { HYPEABLE_HOSTED: '1' };
const original = process.env.HYPEABLE_HOSTED;

afterEach(() => {
  if (original === undefined) {
    delete process.env.HYPEABLE_HOSTED;
  } else {
    process.env.HYPEABLE_HOSTED = original;
  }
});

describe('hosted outbound allowlist', () => {
  it('lists openrouter.ai as a first-party OpenRouter host', () => {
    expect(FIRST_PARTY_PROVIDER_HOSTS.OpenRouter).toContain('openrouter.ai');
  });

  it('is a no-op when self-hosted', () => {
    delete process.env.HYPEABLE_HOSTED;
    expect(() => assertHostedProviderAccess(undefined, 'Ollama', 'http://127.0.0.1:11434')).not.toThrow();
    expect(() => assertHostedGitLabUrl(undefined, 'https://gitlab.example.com')).not.toThrow();
    expect(() => assertHostedWebFetch(undefined, 'https://example.com')).not.toThrow();
    expect(assertGitProxyTarget(undefined, 'example.com/repo.git/info/refs', '?service=git-upload-pack').host).toBe(
      'example.com',
    );
  });

  it('rejects Ollama, LM Studio, and OpenAILike when hosted', () => {
    expect(() => assertHostedProviderAccess(hosted, 'Ollama', 'https://api.openai.com/v1')).toThrow(
      HostedOutboundError,
    );
    expect(() => assertHostedProviderAccess(hosted, 'LMStudio')).toThrow(HOSTED_CUSTOM_ENDPOINT_MESSAGE);
    expect(() => assertHostedProviderAccess(hosted, 'OpenAILike', 'https://api.openai.com/v1')).toThrow(
      HOSTED_CUSTOM_ENDPOINT_MESSAGE,
    );
  });

  it('allows first-party hosts and rejects a forged base URL', () => {
    expect(() => assertHostedProviderAccess(hosted, 'OpenAI', 'https://api.openai.com/v1')).not.toThrow();
    expect(() => assertHostedProviderAccess(hosted, 'Anthropic', 'https://api.anthropic.com')).not.toThrow();
    expect(() => assertHostedProviderAccess(hosted, 'OpenRouter', 'https://openrouter.ai/api/v1')).not.toThrow();
    expect(() => assertHostedProviderAccess(hosted, 'OpenAI', 'https://evil.example/v1')).toThrow(
      HOSTED_CUSTOM_ENDPOINT_MESSAGE,
    );
    expect(() => assertHostedProviderAccess(hosted, 'Together', 'https://api.together.xyz/v1')).not.toThrow();
  });

  it('rejects credentials in git URLs and non-git hosts when hosted', () => {
    expect(() => assertGitProxyTarget(hosted, 'evil.example/repo.git/info/refs')).toThrow(
      HOSTED_CUSTOM_ENDPOINT_MESSAGE,
    );
    expect(() => assertGitProxyTarget(hosted, 'user:pass@github.com/owner/repo.git/info/refs')).toThrow(
      HOSTED_CUSTOM_ENDPOINT_MESSAGE,
    );
    expect(assertGitProxyTarget(hosted, 'github.com/owner/repo.git/info/refs', '?service=git-upload-pack').host).toBe(
      'github.com',
    );
    expect(assertGitProxyTarget(hosted, 'gitlab.com/group/proj.git/git-upload-pack').host).toBe('gitlab.com');
    expect(assertGitProxyTarget(hosted, 'raw.githubusercontent.com/owner/repo/main/README.md').host).toBe(
      'raw.githubusercontent.com',
    );
  });

  it('rejects hosted GitLab self-hosted URLs and arbitrary web fetches', () => {
    expect(() => assertHostedGitLabUrl(hosted, 'https://gitlab.com')).not.toThrow();
    expect(() => assertHostedGitLabUrl(hosted, 'https://gitlab.mycompany.com')).toThrow(HOSTED_CUSTOM_ENDPOINT_MESSAGE);
    expect(() => assertHostedWebFetch(hosted, 'https://example.com/page')).toThrow(HOSTED_CUSTOM_ENDPOINT_MESSAGE);
  });

  it('fail-closes on a public Host even without HYPEABLE_HOSTED', () => {
    delete process.env.HYPEABLE_HOSTED;
    expect(() => assertHostedProviderAccess(undefined, 'OpenAILike', undefined, 'hypeable.dev')).toThrow(
      HOSTED_CUSTOM_ENDPOINT_MESSAGE,
    );
    expect(() => assertHostedProviderAccess(undefined, 'OpenAILike', undefined, 'localhost')).not.toThrow();
  });

  it('fail-closes on a missing request Host', () => {
    delete process.env.HYPEABLE_HOSTED;
    expect(() => assertHostedProviderAccess(undefined, 'OpenAILike', undefined, '')).toThrow(
      HOSTED_CUSTOM_ENDPOINT_MESSAGE,
    );
    expect(() => assertHostedProviderAccess(undefined, 'OpenAILike', undefined, null)).toThrow(
      HOSTED_CUSTOM_ENDPOINT_MESSAGE,
    );
  });
});
