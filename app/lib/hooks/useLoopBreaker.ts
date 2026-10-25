/**
 * Wires loop-breaker signals into the live chat: abort on trigger, feed
 * alerts and user messages. A development-only demo helper is loaded behind
 * `import.meta.env.DEV` so production builds cannot trigger it.
 */
import { useEffect, useRef } from 'react';
import { isAutoFixRequest } from '~/lib/loop';
import { getMessageText } from '~/lib/persistence/messageMigration';
import { costStore } from '~/lib/stores/cost';
import {
  loopAbortTick,
  noteLoopUserMessage,
  refreshLoopCost,
  reportLoopError,
  reportLoopSuccess,
  setLoopChat,
  setLoopContext,
} from '~/lib/stores/loop';
import type { ActionAlert, DeployAlert } from '~/types/actions';

type ChatLikeMessage = {
  id?: string;
  role?: string;
};

export function useLoopBreaker(options: {
  abort: () => void;
  chatId?: string | null;
  messages: ChatLikeMessage[];
  actionAlert?: ActionAlert;
  deployAlert?: DeployAlert;
}) {
  const abortRef = useRef(options.abort);
  abortRef.current = options.abort;

  useEffect(() => {
    return loopAbortTick.listen(() => {
      abortRef.current();
    });
  }, []);

  useEffect(() => {
    setLoopChat(options.chatId ?? '');
  }, [options.chatId]);

  useEffect(() => {
    const last = options.messages.at(-1);

    const lastSafe = [...options.messages]
      .reverse()
      .find((message) => message.role === 'user' && message.id && !isAutoFixRequest(getMessageText(message as never)));
    setLoopContext(last?.id, lastSafe?.id);
  }, [options.messages]);

  useEffect(() => {
    if (!options.actionAlert) {
      return;
    }

    const raw = [options.actionAlert.title, options.actionAlert.description, options.actionAlert.content]
      .filter(Boolean)
      .join('\n');

    const source = options.actionAlert.source === 'preview' ? 'preview' : 'terminal';
    reportLoopError(raw, source);
  }, [options.actionAlert]);

  useEffect(() => {
    if (options.deployAlert?.type === 'success' || options.deployAlert?.buildStatus === 'complete') {
      reportLoopSuccess();
    }
  }, [options.deployAlert]);

  useEffect(() => {
    return costStore.subscribe(() => {
      refreshLoopCost();
    });
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    void import('~/lib/loop/debug-loop').then((mod) => mod.runDebugLoopOnce());
  }, []);

  return {
    noteUserMessage: noteLoopUserMessage,
  };
}
