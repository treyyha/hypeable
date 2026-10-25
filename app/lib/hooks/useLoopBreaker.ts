/**
 * Wires loop-breaker signals into the live chat: abort on trigger, feed
 * alerts and user messages, optional ?debugLoop=1 demo.
 */
import { useEffect, useRef } from 'react';
import { isAutoFixRequest } from '~/lib/loop';
import { getMessageText } from '~/lib/persistence/messageMigration';
import { costStore, recordUsage } from '~/lib/stores/cost';
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

let debugLoopFired = false;

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
    if (!import.meta.env.DEV || debugLoopFired || typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (params.get('debugLoop') !== '1') {
      return;
    }

    debugLoopFired = true;

    const err = `TypeError: Cannot read properties of undefined (reading 'map')
    at App (/Users/demo/proj/src/App.tsx:12:4)`;
    reportLoopError(err, 'preview');
    recordUsage({
      id: 'debug-loop-cost',
      model: 'claude-3-haiku-20240307',
      promptTokens: 400_000,
      completionTokens: 80_000,
    });
    reportLoopError(
      `TypeError: Cannot read properties of undefined (reading 'map')
    at App (C:\\Users\\demo\\proj\\src\\App.tsx:44:8)`,
      'preview',
    );
    reportLoopError(err, 'preview');
  }, []);

  return {
    noteUserMessage: noteLoopUserMessage,
  };
}
