/**
 * Pick a stronger model the user already has a key for, preferring a
 * different provider family so the retry is not the same stack in a wig.
 */

export type PickerModel = {
  name: string;
  provider: string;
  label?: string;
};

function familyOf(provider: string): string {
  const name = provider.trim().toLowerCase();

  if (name.includes('anthropic') || name.includes('claude')) {
    return 'anthropic';
  }

  if (name.includes('openai') || name === 'openai') {
    return 'openai';
  }

  if (name.includes('google') || name.includes('gemini')) {
    return 'google';
  }

  if (name.includes('openrouter')) {
    return 'openrouter';
  }

  if (name.includes('groq')) {
    return 'groq';
  }

  if (name.includes('mistral')) {
    return 'mistral';
  }

  if (name.includes('xai') || name.includes('grok')) {
    return 'xai';
  }

  if (name.includes('deepseek')) {
    return 'deepseek';
  }

  return name.replace(/\s+/g, '');
}

function strengthOf(model: string): number {
  const id = model.toLowerCase();

  if (id.includes('opus')) {
    return 100;
  }

  if (/\bgpt-5\.[4-9]/.test(id) || id.includes('gpt-5.5') || /\bo3\b/.test(id) || id.includes('o3-pro')) {
    return 96;
  }

  if (id.includes('gpt-5') || id.includes('sonnet') || id.includes('gemini-3') || id.includes('pro')) {
    return 82;
  }

  if (id.includes('gpt-4o') || id.includes('gpt-4.1') || id.includes('haiku') || id.includes('flash')) {
    return 54;
  }

  if (id.includes('mini') || id.includes('nano') || id.includes('lite')) {
    return 20;
  }

  return 40;
}

function hasKey(provider: string, apiKeys: Record<string, string>, localProviders: Set<string>): boolean {
  if (localProviders.has(provider.trim().toLowerCase())) {
    return true;
  }

  const key = apiKeys[provider] ?? apiKeys[provider.trim()];

  return typeof key === 'string' && key.trim().length > 0;
}

export function pickStrongerModel(input: {
  currentModel: string;
  currentProvider: string;
  models: readonly PickerModel[];
  apiKeys: Record<string, string>;
  localProviders?: readonly string[];
}): PickerModel | undefined {
  const local = new Set(
    (input.localProviders ?? ['Ollama', 'LMStudio', 'OpenAILike']).map((name) => name.toLowerCase()),
  );

  const currentFamily = familyOf(input.currentProvider);
  const currentName = input.currentModel.trim().toLowerCase();

  const eligible = input.models.filter((model) => {
    if (model.name.trim().toLowerCase() === currentName && familyOf(model.provider) === currentFamily) {
      return false;
    }

    return hasKey(model.provider, input.apiKeys, local);
  });

  if (eligible.length === 0) {
    return undefined;
  }

  const ranked = [...eligible].sort((a, b) => {
    const familyDelta = Number(familyOf(a.provider) === currentFamily) - Number(familyOf(b.provider) === currentFamily);

    const strengthDelta = strengthOf(b.name) - strengthOf(a.name);

    if (familyDelta !== 0) {
      return familyDelta;
    }

    if (strengthDelta !== 0) {
      return strengthDelta;
    }

    return a.name.localeCompare(b.name);
  });

  return ranked[0];
}
