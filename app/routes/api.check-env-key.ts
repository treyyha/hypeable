import type { LoaderFunction } from 'react-router';
import { LLMManager } from '~/lib/modules/llm/manager';

export const loader: LoaderFunction = async ({ context, request }) => {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');

  if (!provider) {
    return Response.json({ isSet: false });
  }

  const cloudflareEnv = context?.cloudflare?.env as unknown as Record<string, string> | undefined;
  const llmManager = LLMManager.getInstance(cloudflareEnv);
  const providerInstance = llmManager.getProvider(provider);

  if (!providerInstance || !providerInstance.config.apiTokenKey) {
    return Response.json({ isSet: false });
  }

  const envVarName = providerInstance.config.apiTokenKey;

  /*
   * Only report *server* env keys. Client keys live in web storage and the
   * browser already knows whether they are set; they must not be inferred
   * from a cookie on this request.
   */
  const isSet = !!(cloudflareEnv?.[envVarName] || process.env[envVarName] || llmManager.env[envVarName]);

  return Response.json({ isSet }, { headers: { 'Cache-Control': 'no-store' } });
};
