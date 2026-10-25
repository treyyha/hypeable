/**
 * Whether this request can call `providerName`: a per-request BYO key, or a
 * server env var the deployment owner configured.
 */
import { LLMManager } from '~/lib/modules/llm/manager';

function envString(env: unknown, key: string): string | undefined {
  if (!env || typeof env !== 'object') {
    return undefined;
  }

  const value = (env as Record<string, unknown>)[key];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function providerHasCredential(
  providerName: string,
  apiKeys: Record<string, string> | undefined,
  env?: unknown,
): boolean {
  if (apiKeys?.[providerName]) {
    return true;
  }

  const manager = LLMManager.getInstance(env as Record<string, string> | undefined);
  const envVar = manager.getProvider(providerName)?.config.apiTokenKey;

  if (!envVar) {
    return false;
  }

  return Boolean(envString(env, envVar) || process.env[envVar] || manager.env[envVar]);
}
