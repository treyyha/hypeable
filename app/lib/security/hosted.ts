/**
 * Hosted-mode switch. Fail closed on a public, missing, empty, or unparseable
 * Host even if HYPEABLE_HOSTED was forgotten. Loopback / private-LAN and
 * HYPEABLE_SELF_HOSTED=1 stay open. Host comes from the request URL only —
 * never from Host / X-Forwarded-Host / Forwarded headers.
 */

export const HOSTED_CUSTOM_ENDPOINT_MESSAGE = 'Run Hypeable locally to use custom endpoints';

function truthyFlag(value: unknown): boolean {
  return value === '1' || value === 'true' || value === true;
}

function flagFrom(env: Record<string, unknown> | null | undefined, name: string): boolean {
  return truthyFlag(env?.[name]) || truthyFlag(process.env[name]);
}

function stripPort(host: string): string {
  const trimmed = host.trim().toLowerCase();

  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']');

    if (end > 0) {
      return trimmed.slice(1, end);
    }
  }

  const colon = trimmed.lastIndexOf(':');

  if (colon > -1 && trimmed.indexOf(':') === colon && /^\d+$/.test(trimmed.slice(colon + 1))) {
    return trimmed.slice(0, colon);
  }

  return trimmed;
}

function ipv4Octets(host: string): number[] | undefined {
  const parts = host.split('.');

  if (parts.length !== 4) {
    return undefined;
  }

  const octets = parts.map((part) => Number(part));

  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return undefined;
  }

  return octets;
}

function isMappedIpv4Loopback(host: string): boolean {
  return host.startsWith('::ffff:') && isPrivateOrLoopbackHost(host.slice('::ffff:'.length));
}

/**
 * Hostname from `request.url` only. Returns '' when the URL is missing,
 * unparseable, or has an empty hostname so callers can fail closed.
 * Ignores Host / X-Forwarded-Host / Forwarded — those are caller-controlled.
 */
export function hostnameFromRequestUrl(url: string | null | undefined): string {
  if (!url) {
    return '';
  }

  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** Request-URL hostname. Never reads spoofable forwarded-host headers. */
export function hostnameFromRequest(request: Request): string {
  return hostnameFromRequestUrl(request.url);
}

/** Loopback, link-local, RFC1918, unique-local IPv6, localhost, *.local */
export function isPrivateOrLoopbackHost(rawHost: string | null | undefined): boolean {
  if (!rawHost) {
    return false;
  }

  const host = stripPort(rawHost);

  if (!host) {
    return false;
  }

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '0.0.0.0') {
    return true;
  }

  if (host.includes(':')) {
    if (host === '::1' || host === '::' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
      return true;
    }
  }

  if (isMappedIpv4Loopback(host)) {
    return true;
  }

  const ipv4 = ipv4Octets(host);

  if (!ipv4) {
    return false;
  }

  const [a, b] = ipv4;

  if (a === 127 || a === 10 || a === 0) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  return false;
}

/**
 * HOSTED when HYPEABLE_HOSTED=1, or when Host is not loopback/private-LAN.
 * HYPEABLE_SELF_HOSTED=1 wins (operator-run public URL).
 *
 * A missing/empty/unparseable Host (`''` or `null`) fail-closes to hosted.
 * `undefined` means the caller did not have a request Host (inner provider
 * checks): only env flags apply, so localhost Ollama still works after the
 * route already allowed it.
 */
export function isHostedMode(env?: Record<string, unknown> | null, host?: string | null): boolean {
  if (flagFrom(env, 'HYPEABLE_SELF_HOSTED')) {
    return false;
  }

  if (flagFrom(env, 'HYPEABLE_HOSTED')) {
    return true;
  }

  if (host === undefined) {
    return false;
  }

  if (host === null || !host.trim()) {
    return true;
  }

  return !isPrivateOrLoopbackHost(host);
}

export function envFromContext(context?: unknown): Record<string, unknown> | undefined {
  return (context as { cloudflare?: { env?: Record<string, unknown> } } | undefined)?.cloudflare?.env;
}

/**
 * Hostname the Worker copied from `request.url`. Empty string when the
 * loader/action has no hostname — fail closed, do not look at headers.
 */
export function hostFromContext(context?: unknown): string {
  const hostname = (context as { hostname?: string } | undefined)?.hostname;

  return typeof hostname === 'string' ? hostname : '';
}

export function isHostedFromContext(context?: unknown): boolean {
  return isHostedMode(envFromContext(context), hostFromContext(context));
}

/** Empty 404 so disabled admin/debug routes do not leak that they exist. */
export function hostedNotFound(): Response {
  return new Response(null, { status: 404 });
}

export function hostedNotFoundIfEnabled(context?: unknown): Response | undefined {
  if (!isHostedFromContext(context)) {
    return undefined;
  }

  return hostedNotFound();
}
