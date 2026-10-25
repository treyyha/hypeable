import { useEffect, useRef } from 'react';
import { estimateTokensFromText } from '~/lib/cost/calc';
import { getMessageText } from '~/lib/persistence/messageMigration';
import {
  beginPendingUsage,
  costAbortTick,
  costStore,
  estimateRequestCost,
  evaluateOutgoingCost,
  ingestUsageAnnotation,
  pendingUsageId,
  registerCapResume,
  settleUsage,
} from '~/lib/stores/cost';

type ChatLikeMessage = {
  id?: string;
  role?: string;
  parts?: unknown;
  content?: unknown;
};

export function useCostGuard(options: {
  model: string;
  provider?: string;
  messages: ChatLikeMessage[];
  isStreaming: boolean;
  abort: () => void;
}) {
  const pendingIdRef = useRef<string | null>(null);
  const promptTokensRef = useRef(0);
  const lastCompletionRef = useRef(0);
  const retryRef = useRef<(() => void) | null>(null);
  const abortRef = useRef(options.abort);
  const modelRef = useRef(options.model);
  const providerRef = useRef(options.provider);
  abortRef.current = options.abort;
  modelRef.current = options.model;
  providerRef.current = options.provider;

  useEffect(() => {
    return costAbortTick.listen(() => {
      abortRef.current();
    });
  }, []);

  useEffect(() => {
    return registerCapResume(() => {
      retryRef.current?.();
    });
  }, []);

  useEffect(() => {
    const pendingId = pendingIdRef.current;

    if (!options.isStreaming || !pendingId) {
      return;
    }

    const lastAssistant = [...options.messages].reverse().find((message) => message.role === 'assistant');
    const streamed = lastAssistant ? getMessageText(lastAssistant as never) : '';
    const completionTokens = estimateTokensFromText(streamed);

    if (Math.abs(completionTokens - lastCompletionRef.current) < 16) {
      return;
    }

    lastCompletionRef.current = completionTokens;
    beginPendingUsage({
      id: pendingId,
      model: modelRef.current,
      provider: providerRef.current,
      promptTokens: promptTokensRef.current,
      completionTokens,
    });
  }, [options.isStreaming, options.messages]);

  const contextText = options.messages.map((message) => getMessageText(message as never)).join('\n');

  const beforeSend = (nextUserText: string, retry: () => void): 'send' | 'wait' | 'block' => {
    const estimated = estimateRequestCost({
      model: options.model,
      provider: options.provider,
      contextText: `${contextText}\n${nextUserText}`,
    });

    const pendingId = pendingUsageId(`chat:${Date.now()}`);

    const armPending = () => {
      pendingIdRef.current = pendingId;
      promptTokensRef.current = estimated.promptTokens;
      lastCompletionRef.current = 0;
      beginPendingUsage({
        id: pendingId,
        model: options.model,
        provider: options.provider,
        promptTokens: estimated.promptTokens,
        completionTokens: 0,
      });
    };

    retryRef.current = () => {
      armPending();
      retry();
    };

    const decision = evaluateOutgoingCost(estimated.dollars);

    if (decision.blocking) {
      return 'block';
    }

    if (decision.wouldCross) {
      return 'wait';
    }

    retryRef.current = null;
    armPending();

    return 'send';
  };

  const onUsage = (data: unknown) => {
    ingestUsageAnnotation(data, {
      id: pendingIdRef.current ?? undefined,
      model: options.model,
      provider: options.provider,
    });
    pendingIdRef.current = null;
  };

  const onStreamEnd = () => {
    const id = pendingIdRef.current;
    const existing = id ? costStore.get().messages[id] : undefined;

    if (id && existing?.pending) {
      settleUsage({
        id,
        model: existing.model,
        provider: existing.provider,
        promptTokens: existing.promptTokens,
        completionTokens: existing.completionTokens,
        cachedTokens: existing.cachedTokens,
      });
    }

    pendingIdRef.current = null;
  };

  return { beforeSend, onUsage, onStreamEnd };
}
