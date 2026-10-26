import { getProviderSettingsFromRequest } from '~/lib/api/provider-settings';
import { getApiKeysFromRequest, LLM_NO_STORE_HEADERS } from '~/lib/api/request-keys';
import { LLMManager } from '~/lib/modules/llm/manager';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { envFromContext, hostFromContext } from '~/lib/security/hosted';
import { assertHostedProviderAccess, hostedOutboundResponse } from '~/lib/security/outbound';
import type { ProviderInfo } from '~/types/model';

let cachedProviders: ProviderInfo[] | null = null;
let cachedDefaultProvider: ProviderInfo | null = null;

function getProviderInfo(llmManager: LLMManager) {
  if (!cachedProviders) {
    cachedProviders = llmManager.getAllProviders().map((provider) => ({
      name: provider.name,
      staticModels: provider.staticModels,
      getApiKeyLink: provider.getApiKeyLink,
      labelForGetApiKey: provider.labelForGetApiKey,
      icon: provider.icon,
    }));
  }

  if (!cachedDefaultProvider) {
    const defaultProvider = llmManager.getDefaultProvider();
    cachedDefaultProvider = {
      name: defaultProvider.name,
      staticModels: defaultProvider.staticModels,
      getApiKeyLink: defaultProvider.getApiKeyLink,
      labelForGetApiKey: defaultProvider.labelForGetApiKey,
      icon: defaultProvider.icon,
    };
  }

  return { providers: cachedProviders, defaultProvider: cachedDefaultProvider };
}

export async function loader({
  request,
  params,
  context,
}: {
  request: Request;
  params: { provider?: string };
  context: {
    cloudflare?: {
      env: Record<string, string>;
    };
  };
}): Promise<Response> {
  const llmManager = LLMManager.getInstance(context.cloudflare?.env);

  const apiKeys = getApiKeysFromRequest(request);
  const providerSettings = getProviderSettingsFromRequest(request);

  try {
    if (params.provider) {
      assertHostedProviderAccess(
        envFromContext(context),
        params.provider,
        providerSettings[params.provider]?.baseUrl,
        hostFromContext(context),
      );
    }
  } catch (error) {
    const rejected = hostedOutboundResponse(error);

    if (rejected) {
      return rejected;
    }

    throw error;
  }

  const enabledProviderNames = new URL(request.url).searchParams.get('providers')?.split(',').filter(Boolean);

  const { providers, defaultProvider } = getProviderInfo(llmManager);

  let modelList: ModelInfo[] = [];

  if (params.provider) {
    // Only update models for the specific provider
    const provider = llmManager.getProvider(params.provider);

    if (provider) {
      modelList = await llmManager.getModelListFromProvider(provider, {
        apiKeys,
        providerSettings,
        serverEnv: context.cloudflare?.env,
      });
    }
  } else {
    // Update all models
    modelList = await llmManager.updateModelList({
      apiKeys,
      providerSettings,
      serverEnv: context.cloudflare?.env,
      enabledProviderNames,
    });
  }

  return Response.json(
    {
      modelList,
      providers,
      defaultProvider,
    },
    { headers: { ...LLM_NO_STORE_HEADERS } },
  );
}
