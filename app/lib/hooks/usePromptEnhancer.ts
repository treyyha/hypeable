import { useState } from 'react';
import { llmFetch } from '~/lib/api/api-key-storage';
import { estimateUsageFromText, takeUsageMarker } from '~/lib/cost/usage';
import { ingestUsageAnnotation, pendingUsageId } from '~/lib/stores/cost';
import type { ProviderInfo } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('usePromptEnhancement');

export function usePromptEnhancer() {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanced, setPromptEnhanced] = useState(false);

  const resetEnhancer = () => {
    setEnhancingPrompt(false);
    setPromptEnhanced(false);
  };

  const enhancePrompt = async (
    input: string,
    setInput: (value: string) => void,
    model: string,
    provider: ProviderInfo,
    apiKeys?: Record<string, string>,
  ) => {
    setEnhancingPrompt(true);
    setPromptEnhanced(false);

    const requestBody = {
      message: input,
      model,
      provider,
    };

    const response = await llmFetch(
      '/api/enhancer',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      apiKeys,
    );

    const reader = response.body?.getReader();

    const originalInput = input;

    if (reader) {
      const decoder = new TextDecoder();

      let _input = '';
      let _error;

      try {
        setInput('');

        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            break;
          }

          _input += decoder.decode(value);

          const visible = takeUsageMarker(_input).text;

          logger.trace('Set input', visible);

          setInput(visible);
        }
      } catch (error) {
        _error = error;
        setInput(originalInput);
      } finally {
        if (_error) {
          logger.error(_error);
        }

        const split = takeUsageMarker(_input);
        _input = split.text;

        if (split.usage) {
          ingestUsageAnnotation(split.usage, {
            id: pendingUsageId(`enhancer:${Date.now()}`),
            model,
            provider: provider.name,
          });
        } else if (_input) {
          ingestUsageAnnotation(
            estimateUsageFromText(split.text, {
              aborted: Boolean(_error),
              maybeBilled: true,
              callKind: 'enhancer',
            }),
            {
              id: pendingUsageId(`enhancer:${Date.now()}`),
              model,
              provider: provider.name,
            },
          );
        }

        setEnhancingPrompt(false);
        setPromptEnhanced(true);

        setTimeout(() => {
          setInput(_input);
        });
      }
    }
  };

  return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}
