import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FIRST_PARTY_PROVIDER_HOSTS,
  GIT_PROXY_FORWARD_REQUEST_HEADERS,
  HOSTED_CUSTOM_ENDPOINT_MESSAGE,
  HostedOutboundError,
  assertAllowlistedHttpsUrl,
  assertGitProxyTarget,
  assertHostedGitLabUrl,
  assertHostedProviderAccess,
  assertHostedWebFetch,
  fetchAllowlistedHttps,
  hostnameAllowed,
  isIpLiteralHostname,
  normalizeHostname,
  resolveAllowlistedRedirect,
  shouldForwardGitProxyRequestHeader,
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
      HostedOutboundError,
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

describe('hostname allowlist bypass table', () => {
  const github = ['github.com', 'www.github.com'] as const;
  const openai = ['api.openai.com'] as const;

  it('normalizes case and trailing dots to an exact match', () => {
    expect(normalizeHostname('GitHub.COM.')).toBe('github.com');
    expect(hostnameAllowed('github.com.', github)).toBe(true);
    expect(hostnameAllowed('GITHUB.COM', github)).toBe(true);
    expect(hostnameAllowed('api.openai.com.', openai)).toBe(true);
  });

  it('rejects suffix, lookalike, and userinfo hosts', () => {
    expect(hostnameAllowed('evil.github.com', github)).toBe(false);
    expect(hostnameAllowed('github.com.evil.com', github)).toBe(false);
    expect(hostnameAllowed('notgithub.com', github)).toBe(false);
    expect(hostnameAllowed('github.com.attacker.github.com', github)).toBe(false);
    expect(hostnameAllowed('api.openai.com.evil.com', openai)).toBe(false);
    expect(hostnameAllowed('evil.api.openai.com', openai)).toBe(false);
    expect(hostnameAllowed('xn--github-something.com', github)).toBe(false);
  });

  it('treats IP literals (v4, v6, decimal, hex) as never allowlisted', () => {
    expect(isIpLiteralHostname('127.0.0.1')).toBe(true);
    expect(isIpLiteralHostname('0x7f000001')).toBe(true);
    expect(isIpLiteralHostname('2130706433')).toBe(true);
    expect(isIpLiteralHostname('::1')).toBe(true);
    expect(isIpLiteralHostname('[::1]')).toBe(true);
    expect(isIpLiteralHostname('::ffff:127.0.0.1')).toBe(true);
    expect(hostnameAllowed('127.0.0.1', github)).toBe(false);
    expect(hostnameAllowed('8.8.8.8', github)).toBe(false);
  });

  const gitBypasses = [
    ['userinfo @', 'evil.com@github.com/owner/repo.git/info/refs'],
    ['userinfo reversed', 'github.com@evil.com/owner/repo.git/info/refs'],
    ['user:pass', 'user:pass@github.com/owner/repo.git/info/refs'],
    ['uppercase host is ok after normalize — suffix still rejected', 'EVIL.GITHUB.COM/owner/repo.git/info/refs'],
    ['trailing-dot suffix', 'evil.github.com./owner/repo.git/info/refs'],
    ['port 80', 'github.com:80/owner/repo.git/info/refs'],
    ['port 8080', 'github.com:8080/owner/repo.git/info/refs'],
    ['ipv4', '127.0.0.1/owner/repo.git/info/refs'],
    ['ipv6', '[::1]/owner/repo.git/info/refs'],
    ['decimal ipv4', '2130706433/owner/repo.git/info/refs'],
    ['hex ipv4', '0x7f000001/owner/repo.git/info/refs'],
    ['punycode lookalike', 'xn--githb-hsa.com/owner/repo.git/info/refs'],
    ['encoded slash in host', 'github.com%2fevil.com/owner/repo.git/info/refs'],
    ['double-encoded slash', 'github.com%252fevil.com/owner/repo.git/info/refs'],
    ['backslash', 'github.com\\@evil.com/owner/repo.git/info/refs'],
    ['hash in host', 'github.com#@evil.com/owner/repo.git/info/refs'],
    ['query in host', 'github.com?@evil.com/owner/repo.git/info/refs'],
    ['space', 'github.com /owner/repo.git/info/refs'],
    ['scheme in path', 'https://github.com/owner/repo.git/info/refs'],
    ['javascript scheme host', 'javascript:alert(1)/owner/repo.git/info/refs'],
    ['data scheme host', 'data:text/html,x/owner/repo.git/info/refs'],
    ['token query', 'github.com/owner/repo.git/info/refs?token=secret'],
    ['path traversal not git', 'github.com/../../etc/passwd'],
    ['html path', 'github.com/owner/repo/blob/main/README.md'],
  ] as const;

  it.each(gitBypasses)('rejects git-proxy bypass: %s', (_label, path) => {
    const search = path.includes('?') ? path.slice(path.indexOf('?')) : '';
    const splat = search ? path.slice(0, path.indexOf('?')) : path;
    expect(() => assertGitProxyTarget(hosted, splat, search)).toThrow(HostedOutboundError);
  });

  it('allows the documented github/gitlab smart-HTTP paths and strips a trailing dot', () => {
    const dotted = assertGitProxyTarget(hosted, 'github.com./owner/repo.git/info/refs', '?service=git-upload-pack');
    expect(dotted.host).toBe('github.com');
    expect(dotted.url.startsWith('https://github.com/')).toBe(true);
    expect(dotted.url).not.toContain('github.com.');

    expect(assertGitProxyTarget(hosted, 'GITHUB.COM/owner/repo.git/git-upload-pack').host).toBe('github.com');
    expect(assertGitProxyTarget(hosted, 'github.com:443/owner/repo.git/info/refs').host).toBe('github.com');
  });

  const providerBypasses: Array<[string, string, string]> = [
    ['OpenAI', 'https://evil.api.openai.com/v1', 'suffix'],
    ['OpenAI', 'https://api.openai.com.evil.com/v1', 'trailing extra domain'],
    ['OpenAI', 'https://api.openai.com:8080/v1', 'port'],
    ['OpenAI', 'http://api.openai.com/v1', 'http scheme'],
    ['OpenAI', 'https://user:pass@api.openai.com/v1', 'userinfo'],
    ['OpenAI', 'https://127.0.0.1/v1', 'ipv4'],
    ['OpenAI', 'https://[::1]/v1', 'ipv6'],
    ['OpenAI', 'javascript:alert(1)', 'javascript scheme'],
    ['OpenRouter', 'https://openrouter.ai.evil.com/api/v1', 'openrouter suffix'],
  ];

  it.each(providerBypasses)('rejects provider base URL %s %s (%s)', (provider, url) => {
    expect(() => assertHostedProviderAccess(hosted, provider, url)).toThrow(HOSTED_CUSTOM_ENDPOINT_MESSAGE);
  });
});

describe('redirect re-validation', () => {
  const allowed = ['github.com', 'www.github.com'] as const;

  it('follows an allowlisted hop and rejects a hop off the list', () => {
    const next = resolveAllowlistedRedirect(
      'https://github.com/old/repo.git/info/refs',
      'https://github.com/new/repo.git/info/refs',
      allowed,
    );
    expect(next.hostname).toBe('github.com');

    expect(() =>
      resolveAllowlistedRedirect('https://github.com/old/repo.git/info/refs', 'https://evil.example/steal', allowed),
    ).toThrow(HOSTED_CUSTOM_ENDPOINT_MESSAGE);

    expect(() =>
      resolveAllowlistedRedirect('https://github.com/old/repo.git/info/refs', 'http://github.com/new', allowed),
    ).toThrow(HOSTED_CUSTOM_ENDPOINT_MESSAGE);

    expect(() =>
      resolveAllowlistedRedirect('https://github.com/old/repo.git/info/refs', '//evil.example/steal', allowed),
    ).toThrow(HOSTED_CUSTOM_ENDPOINT_MESSAGE);

    expect(() => resolveAllowlistedRedirect('https://github.com/old', null, allowed)).toThrow(
      HOSTED_CUSTOM_ENDPOINT_MESSAGE,
    );
  });

  it('rejects protocol-relative and encoded redirects that leave the allowlist', () => {
    expect(() => assertAllowlistedHttpsUrl('https://github.com.evil.com/x', allowed)).toThrow(
      HOSTED_CUSTOM_ENDPOINT_MESSAGE,
    );
  });
});

describe('fetchAllowlistedHttps', () => {
  it('re-validates each redirect and refuses a hop off the list', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { Location: 'https://codeload.github.com/owner/repo/zip' } }),
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const allowed = ['api.github.com', 'codeload.github.com'] as const;
    const response = await fetchAllowlistedHttps('https://api.github.com/repos/owner/repo/zipball/tag', allowed);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://codeload.github.com/owner/repo/zip',
      expect.objectContaining({ redirect: 'manual' }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { Location: 'https://evil.example/steal' } }),
    );

    await expect(fetchAllowlistedHttps('https://api.github.com/repos/owner/repo/zipball/tag', allowed)).rejects.toThrow(
      HOSTED_CUSTOM_ENDPOINT_MESSAGE,
    );

    vi.unstubAllGlobals();
  });
});

describe('git-proxy request header allowlist', () => {
  it('forwards only the isomorphic-git headers and drops cookies / cf-* / forwarding', () => {
    expect(shouldForwardGitProxyRequestHeader('Authorization')).toBe(true);
    expect(shouldForwardGitProxyRequestHeader('content-type')).toBe(true);
    expect(shouldForwardGitProxyRequestHeader('user-agent')).toBe(true);
    expect(GIT_PROXY_FORWARD_REQUEST_HEADERS).not.toContain('cookie');

    expect(shouldForwardGitProxyRequestHeader('cookie')).toBe(false);
    expect(shouldForwardGitProxyRequestHeader('Cookie')).toBe(false);
    expect(shouldForwardGitProxyRequestHeader('set-cookie')).toBe(false);
    expect(shouldForwardGitProxyRequestHeader('cf-connecting-ip')).toBe(false);
    expect(shouldForwardGitProxyRequestHeader('CF-Ray')).toBe(false);
    expect(shouldForwardGitProxyRequestHeader('x-forwarded-for')).toBe(false);
    expect(shouldForwardGitProxyRequestHeader('x-forwarded-host')).toBe(false);
    expect(shouldForwardGitProxyRequestHeader('x-real-ip')).toBe(false);
    expect(shouldForwardGitProxyRequestHeader('referer')).toBe(false);
    expect(shouldForwardGitProxyRequestHeader('x-http-method-override')).toBe(false);
    expect(shouldForwardGitProxyRequestHeader('access-control-allow-origin')).toBe(false);
    expect(shouldForwardGitProxyRequestHeader('host')).toBe(false);
  });
});
