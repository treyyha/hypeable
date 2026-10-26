/**
 * Hosted-mode egress allowlist. Custom LLM base URLs, Ollama, LM Studio,
 * and non-git hosts are rejected so the public deployment cannot be used as
 * an open proxy. Self-hosted (loopback / HYPEABLE_SELF_HOSTED=1) skips every check.
 */

import { HOSTED_CUSTOM_ENDPOINT_MESSAGE, isHostedMode } from '~/lib/security/hosted';

export { HOSTED_CUSTOM_ENDPOINT_MESSAGE };

export const LOCAL_ENDPOINT_PROVIDERS = ['Ollama', 'LMStudio', 'OpenAILike'] as const;

export type LocalEndpointProvider = (typeof LOCAL_ENDPOINT_PROVIDERS)[number];

/** First-party provider API hosts this app already calls. */
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

export const GIT_SMART_HTTP_TIMEOUT_MS = 30_000;
export const GIT_SMART_HTTP_MAX_BYTES = 20 * 1024 * 1024;

const GIT_SMART_HTTP_PATH =
  /(?:^|\/)(?:info\/refs|git-upload-pack|git-receive-pack|HEAD|objects\/(?:info\/.+|pack\/[A-Za-z0-9._-]+|[0-9a-f]{2}\/[0-9a-f]{38}))$/i;

const RAW_GIT_HOSTS = new Set([
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'codeload.github.com',
  'gist.githubusercontent.com',
]);

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

function hostnameAllowed(hostname: string, allowed: readonly string[]): boolean {
  const host = hostname.toLowerCase();

  return allowed.some((entry) => host === entry || host.endsWith(`.${entry}`));
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

  return url;
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

  const url = parseHttpsUrl(baseUrl, providerName);

  if (!hostnameAllowed(url.hostname, allowed)) {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE, providerName);
  }
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

  const url = parseHttpsUrl(gitlabUrl);
  const host = url.hostname.toLowerCase();

  if (host !== 'gitlab.com' && host !== 'www.gitlab.com') {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE);
  }
}

export type GitProxyTarget = {
  url: string;
  host: string;
};

/**
 * Reconstruct and allowlist a git-proxy splat path. Hosted mode only.
 */
export function assertGitProxyTarget(
  env: Record<string, unknown> | undefined,
  path: string,
  search = '',
  requestHost?: string | null,
): GitProxyTarget {
  const parts = path.match(/([^/]+)\/?(.*)/);

  if (!parts) {
    throw new HostedOutboundError('Invalid git proxy path');
  }

  const domain = parts[1].toLowerCase();
  const remainingPath = parts[2] || '';
  const target = `https://${domain}/${remainingPath}${search}`;

  if (!isHostedMode(env, requestHost)) {
    return { url: target, host: domain };
  }

  const url = parseHttpsUrl(target);

  if (!hostnameAllowed(url.hostname, GIT_PROXY_HOSTS)) {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE);
  }

  const query = url.searchParams;

  if (query.has('token') || query.has('access_token') || query.has('private_token')) {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE);
  }

  const host = url.hostname.toLowerCase();
  const pathname = url.pathname;

  if (RAW_GIT_HOSTS.has(host)) {
    return { url: url.toString(), host };
  }

  if (!GIT_SMART_HTTP_PATH.test(pathname)) {
    throw new HostedOutboundError(HOSTED_CUSTOM_ENDPOINT_MESSAGE);
  }

  return { url: url.toString(), host };
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
