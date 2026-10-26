/**
 * Hosted-mode switch. Set HYPEABLE_HOSTED=1 only on the public deployment.
 * Self-hosted (unset / any other value) must behave exactly as today.
 */

export const HOSTED_CUSTOM_ENDPOINT_MESSAGE = 'Run Hypeable locally to use custom endpoints';

function truthyFlag(value: unknown): boolean {
  return value === '1' || value === 'true' || value === true;
}

export function isHostedMode(env?: Record<string, unknown> | null): boolean {
  if (truthyFlag(env?.HYPEABLE_HOSTED)) {
    return true;
  }

  return truthyFlag(process.env.HYPEABLE_HOSTED);
}

export function envFromContext(context?: unknown): Record<string, unknown> | undefined {
  return (context as { cloudflare?: { env?: Record<string, unknown> } } | undefined)?.cloudflare?.env;
}

export function isHostedFromContext(context?: unknown): boolean {
  return isHostedMode(envFromContext(context));
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
