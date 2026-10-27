/**
 * Hosted-mode egress allowlist. Custom LLM base URLs, Ollama, LM Studio,
 * and non-git hosts are rejected so the public deployment cannot be used as
 * an open proxy. Self-hosted (loopback / HYPEABLE_SELF_HOSTED=1) skips host
 * allowlisting but still rejects userinfo, non-https, and header/method abuse
 * on the git proxy.
 *
 * Host matching is exact after lowercase + trailing-dot strip. Suffix matches
 * (`evil.github.com`) and IP literals are not allowlisted. Redirects must be
 * re-checked with `resolveAllowlistedRedirect` — never `redirect: 'follow'`.
 * Workers cannot pin DNS, so a poisoned answer for an allowlisted name is out
 * of scope (see docs/THREAT-MODEL.md).
 */

import { HOSTED_CUSTOM_ENDPOINT_MESSAGE, isHostedMode } from '~/lib/security/hosted';

export { HOSTED_CUSTOM_ENDPOINT_MESSAGE };

export const LOCAL_ENDPOINT_PROVIDERS = ['Ollama', 'LMStudio', 'OpenAILike'] as const;

export type LocalEndpointProvider = (typeof LOCAL_ENDPOINT_PROVIDERS)[number];

/** First-party provider API hosts this app already calls. Exact match only. */
export const FIRST_PARTY_PROVIDER_HOSTS: Record<string, readonly string[]> = {
  OpenAI: ['api.openai.com'],
  Anthropic: ['api.anthropic.com'],
  Google: ['generativelanguage.googleapis.com'],
  OpenRouter: ['openrouter.ai'],
  Groq: ['api.groq.com'],
  Deepseek: ['api.deepseek.com'],
  Mistral: ['api.mistral.ai'],
  xAI: ['api.x.ai'],
  Together: ['api.together.xyz'],
  Perplexity: ['api.perplexity.ai'],
  Cohere: ['api.cohere.ai', 'api.cohere.com'],
  HuggingFace: ['api-inference.huggingface.co', 'router.huggingface.co', 'huggingface.co'],
  Fireworks: ['api.fireworks.ai'],
  Cerebras: ['api.cerebras.ai'],
  AmazonBedrock: ['bedrock.amazonaws.com', 'bedrock-runtime.amazonaws.com'],
  Github: ['models.github.ai', 'models.inference.ai.azure.com'],
  Moonshot: ['api.moonshot.ai', 'api.moonshot.cn'],
  Hyperbolic: ['api.hyperbolic.xyz'],
  'Z.ai': ['api.z.ai', 'open.bigmodel.cn'],
};

export const GIT_PROXY_HOSTS = [
  'github.com',
  'www.github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'codeload.github.com',
  'gist.github.com',
  'gist.githubusercontent.com',
  'gitlab.com',
  'www.gitlab.com',
] as const;

/** Hosts GitHub uses for release zipballs after api.github.com 302s. */
export const GITHUB_ARCHIVE_HOSTS = [
  'api.github.com',
  'codeload.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github.com',
] as const;

export const GIT_SMART_HTTP_TIMEOUT_MS = 30_000;
export const GIT_SMART_HTTP_MAX_BYTES = 20 * 1024 * 1024;
export const GIT_PROXY_MAX_REDIRECTS = 3;
export const GIT_PROXY_ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'OPTIONS'] as const;

/**
 * Request headers isomorphic-git needs. Cookie / cf-* / forwarding headers
 * are never forwarded — see `shouldForwardGitProxyRequestHeader`.
 */
export const GIT_PROXY_FORWARD_REQUEST_HEADERS = [
  'accept',
  'accept-encoding',
  'accept-language',
  'authorization',
  'cache-control',
  'content-type',
  'pragma',
  'range',
  'user-agent',
  'x-authorization',
] as const;

export const GIT_PROXY_EXPOSE_HEADERS = [
  'accept-ranges',
  'age',
  'cache-control',
  'content-length',
  'content-language',
  'content-type',
  'date',
  'etag',
  'expires',
  'last-modified',
  'pragma',
  'vary',
  'x-github-request-id',
  'x-redirected-url',
] as const;

const GIT_PROXY_BLOCKED_REQUEST_HEADERS = new Set([
  'cookie',
  'cookie2',
  'set-cookie',
  'set-cookie2',
  'host',
  'connection',
  'keep-alive',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
  'referer',
  'origin',
  'access-control-allow-origin',
  'x-http-method-override',
  'content-length',
]);

const GIT_PROXY_BLOCKED_HEADER_PREFIXES = ['cf-', 'x-forwarded-', 'x-real-'];

const GIT_SMART_HTTP_PATH =
  /(?:^|\/)(?:info\/refs|git-upload-pack|git-receive-pack|HEAD|objects\/(?:info\/.+|pack\/[A-Za-z0-9._-]+|[0-9a-f]{2}\/[0-9a-f]{38}))$/i;

const RAW_GIT_HOSTS = new Set([
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'codeload.github.com',
  'gist.githubusercontent.com',
]);

/** Characters that must not appear in the git-proxy host segment. */
const GIT_PROXY_HOST_FORBIDDEN = /[\s\\@/?#<>[\]"'%]/;

export class HostedOutboundError extends Error {
  readonly status = 403;
  readonly provider?: string;

  constructor(message = HOSTED_CUSTOM_ENDPOINT_MESSAGE, provider?: string) {
    super(message);
    this.name = 'HostedOutboundError';
    this.provider = provider;
  }
}

export function hostedOutboundResponse(error: unknown): Response | undefined {
  if (!(error instanceof HostedOutboundError)) {
    return undefined;
  }

  return Response.json(
    {
      error: true,
      message: error.message,
      statusCode: 403,
      isRetryable: false,
      provider: error.provider ?? 'unknown',
    },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  );
}

export function isLocalEndpointProvider(name: string): boolean {
  return (LOCAL_ENDPOINT_PROVIDERS as readonly string[]).includes(name);
}

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, '');
}

/**
 * True for IPv4 dotted, IPv6, decimal/hex/octal forms, and bracketed literals.
 * Named hosts used in the allowlists never match this.
 */
export function isIpLiteralHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname).replace(/^\[|\]$/g, '');

  if (!host) {
    return true;
  }

  if (host.includes(':')) {
    return true;
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    return true;
  }

  if (/^0x[0-9a-f]+$/i.test(host)) {
    return true;
  }

  if (/^0[0-7]+(?:\.0[0-7]+)*$/.test(host)) {
    return true;
  }

  // Decimal IPv4 (2130706433) and odd dotted forms the URL parser may keep.
  if (/^\d+$/.test(host)) {
    return true;
  }

  return false;
}

export function hostnameAllowed(hostname: string, allowed: readonly string[]): boolean {
  const host = normalizeHostname(hostname);

  if (!host || isIpLiteralHostname(host)) {
    return false;
  }

  return allowed.some((entry) => host === normalizeHostname(entry));
}

export function shouldForwardGitProxyRequestHeader(name: string): boolean {
  const lower = name.toLowerCase();

  if (GIT_PROXY_BLOCKED_REQUEST_HEADERS.has(lower)) {
    return false;
  }

  if (GIT_PROXY_BLOCKED_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return false;
  }

  return (GIT_PROXY_FORWARD_REQUEST_HEADERS as readonly string[]).includes(lower);
}

function parseHttpsUrl(raw: string, provider?: string): URL {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE, provider);
  }

  if (url.protocol !== 'https:') {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE, provider);
  }

  if (url.username || url.password) {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE, provider);
  }

  if (url.port && url.port !== '443') {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE, provider);
  }

  const host = normalizeHostname(url.hostname);

  if (!host || isIpLiteralHostname(host)) {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE, provider);
  }

  return url;
}

function canonicalHttpsHref(url: URL): string {
  const canonical = new URL(url.href);
  canonical.hostname = normalizeHostname(url.hostname);
  canonical.port = '';
  canonical.username = '';
  canonical.password = '';

  return canonical.toString();
}

export function assertAllowlistedHttpsUrl(raw: string, allowed: readonly string[], provider?: string): URL {
  const url = parseHttpsUrl(raw, provider);

  if (!hostnameAllowed(url.hostname, allowed)) {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE, provider);
  }

  return new URL(canonicalHttpsHref(url));
}

/**
 * Re-validate a 3xx Location against the same host allowlist.
 * `location` is resolved relative to `current`.
 */
export function resolveAllowlistedRedirect(
  current: string,
  location: string | null,
  allowed: readonly string[],
  provider?: string,
): URL {
  if (!location) {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE, provider);
  }

  let next: URL;

  try {
    next = new URL(location, current);
  } catch {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE, provider);
  }

  return assertAllowlistedHttpsUrl(next.href, allowed, provider);
}

/**
 * Reject Ollama / LM Studio / OpenAILike, and any non-allowlisted provider
 * base URL, when hosted mode is on. No-op when self-hosted.
 */
export function assertHostedProviderAccess(
  env: Record<string, unknown> | undefined,
  providerName: string,
  baseUrl?: string,
  host?: string | null,
): void {
  if (!isHostedMode(env, host)) {
    return;
  }

  if (isLocalEndpointProvider(providerName)) {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE, providerName);
  }

  if (!baseUrl) {
    return;
  }

  const allowed = FIRST_PARTY_PROVIDER_HOSTS[providerName];

  if (!allowed) {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE, providerName);
  }

  assertAllowlistedHttpsUrl(baseUrl, allowed, providerName);
}

/**
 * GitLab API origin: gitlab.com only when hosted. Self-hosted GitLab URLs
 * stay allowed locally.
 */
export function assertHostedGitLabUrl(
  env: Record<string, unknown> | undefined,
  gitlabUrl: string,
  host?: string | null,
): void {
  if (!isHostedMode(env, host)) {
    return;
  }

  assertAllowlistedHttpsUrl(gitlabUrl, ['gitlab.com', 'www.gitlab.com']);
}

export type GitProxyTarget = {
  url: string;
  host: string;
};

function gitProxyHostSegment(raw: string): { hostname: string; port: string } {
  if (!raw || GIT_PROXY_HOST_FORBIDDEN.test(raw) || raw.includes('..')) {
    throw new HostedOutboundError('Invalid git proxy path');
  }

  let hostname = raw;
  let port = '';

  const colon = raw.lastIndexOf(':');

  if (colon > -1) {
    port = raw.slice(colon + 1);
    hostname = raw.slice(0, colon);

    if (!hostname || !/^\d+$/.test(port)) {
      throw new HostedOutboundError('Invalid git proxy path');
    }
  }

  return { hostname: normalizeHostname(hostname), port };
}

/**
 * Reconstruct and allowlist a git-proxy splat path. Hosted mode only for the
 * GitHub/GitLab host list; userinfo / encoding tricks are rejected everywhere.
 */
export function assertGitProxyTarget(
  env: Record<string, unknown> | undefined,
  path: string,
  search = '',
  requestHost?: string | null,
): GitProxyTarget {
  const parts = path.match(/^([^/]+)\/?(.*)$/);

  if (!parts) {
    throw new HostedOutboundError('Invalid git proxy path');
  }

  const { hostname, port } = gitProxyHostSegment(parts[1]);
  const remainingPath = parts[2] || '';
  const target = `https://${hostname}/${remainingPath}${search}`;

  if (port && port !== '443') {
    throw new HostedOutboundError(
      isHostedMode(env, requestHost) ? HOSTED_CUSTOM_ENDPOINT_MESSAGE : 'Invalid git proxy path',
    );
  }

  const url = parseHttpsUrl(target);

  if (!isHostedMode(env, requestHost)) {
    return { url: canonicalHttpsHref(url), host: normalizeHostname(url.hostname) };
  }

  const allowlisted = assertAllowlistedHttpsUrl(target, GIT_PROXY_HOSTS);
  const query = allowlisted.searchParams;

  if (query.has('token') || query.has('access_token') || query.has('private_token')) {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE);
  }

  const host = normalizeHostname(allowlisted.hostname);
  const pathname = allowlisted.pathname;

  if (RAW_GIT_HOSTS.has(host)) {
    return { url: allowlisted.toString(), host };
  }

  if (!GIT_SMART_HTTP_PATH.test(pathname)) {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE);
  }

  return { url: allowlisted.toString(), host };
}

/**
 * Fetch an allowlisted HTTPS URL. Redirects are re-validated on every hop
 * (`redirect: 'follow'` is never used).
 */
export async function fetchAllowlistedHttps(
  url: string,
  allowed: readonly string[],
  init: RequestInit = {},
  maxRedirects = GIT_PROXY_MAX_REDIRECTS,
): Promise<Response> {
  let current = assertAllowlistedHttpsUrl(url, allowed).href;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetch(current, { ...init, redirect: 'manual' });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    await response.body?.cancel().catch(() => undefined);

    if (!location || hop === maxRedirects) {
      return response;
    }

    current = resolveAllowlistedRedirect(current, location, allowed).href;
  }

  throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE);
}

/** Arbitrary page fetch (web-search fetch). Hosted mode rejects it. */
export function assertHostedWebFetch(
  env: Record<string, unknown> | undefined,
  url: string,
  host?: string | null,
): void {
  if (!isHostedMode(env, host)) {
    return;
  }

  parseHttpsUrl(url);
  throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE);
}
