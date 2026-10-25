/**
 * Per-chat streak of identical errors / identical file writes.
 * Pure: the store is a thin wrapper around reduceLoop.
 */
import { contentHash, signatureFromError } from './normalize';
import { isAutoFixRequest } from './replan';
import { clampThreshold, DEFAULT_LOOP_SETTINGS, type LoopSettings } from './settings';
import { wastedCostSince } from './wasted';

export type LoopKind = 'error' | 'write';

export type LoopDetectorState = {
  chatId: string;
  settings: LoopSettings;
  errorSignature: string | null;
  errorCount: number;
  errorPreview: string;
  writeKey: string | null;
  writePath: string;
  writeCount: number;
  isLooping: boolean;
  loopKind: LoopKind | null;
  revertToMessageId: string | null;
  lastSafeMessageId: string | null;
  lastMessageId: string | null;
  sessionTotalAtFirst: number;
  wastedCost: number;
  tried: string[];
  shouldAbort: boolean;
};

export type LoopFeed =
  | {
      type: 'error';
      raw: string;
      source?: string;
      messageId?: string;
      sessionTotal: number;
    }
  | {
      type: 'write';
      filePath: string;
      content: string;
      messageId?: string;
      sessionTotal: number;
    }
  | { type: 'success' }
  | { type: 'user'; text: string; messageId?: string }
  | { type: 'chat'; chatId: string }
  | { type: 'context'; lastMessageId?: string; lastSafeMessageId?: string }
  | { type: 'settings'; settings: Partial<LoopSettings> }
  | { type: 'dismiss' }
  | { type: 'refresh-cost'; sessionTotal: number };

export function emptyLoopState(chatId = '', settings: LoopSettings = DEFAULT_LOOP_SETTINGS): LoopDetectorState {
  return {
    chatId,
    settings: {
      enabled: settings.enabled,
      threshold: clampThreshold(settings.threshold),
    },
    errorSignature: null,
    errorCount: 0,
    errorPreview: '',
    writeKey: null,
    writePath: '',
    writeCount: 0,
    isLooping: false,
    loopKind: null,
    revertToMessageId: null,
    lastSafeMessageId: null,
    lastMessageId: null,
    sessionTotalAtFirst: 0,
    wastedCost: 0,
    tried: [],
    shouldAbort: false,
  };
}

function resetStreaks(state: LoopDetectorState): LoopDetectorState {
  return {
    ...state,
    errorSignature: null,
    errorCount: 0,
    errorPreview: '',
    writeKey: null,
    writePath: '',
    writeCount: 0,
    isLooping: false,
    loopKind: null,
    revertToMessageId: null,
    sessionTotalAtFirst: 0,
    wastedCost: 0,
    tried: [],
    shouldAbort: false,
  };
}

function maybeTrigger(
  state: LoopDetectorState,
  count: number,
  kind: LoopKind,
  preview: string,
  sessionTotal: number,
): LoopDetectorState {
  if (!state.settings.enabled || count < state.settings.threshold) {
    return { ...state, shouldAbort: false };
  }

  if (state.isLooping) {
    return {
      ...state,
      isLooping: true,
      loopKind: kind,
      wastedCost: wastedCostSince(sessionTotal, state.sessionTotalAtFirst),
      shouldAbort: false,
    };
  }

  const revertToMessageId = state.revertToMessageId ?? state.lastSafeMessageId ?? state.lastMessageId;
  const tried = preview && !state.tried.includes(preview) ? [...state.tried, preview] : state.tried;

  return {
    ...state,
    isLooping: true,
    loopKind: kind,
    revertToMessageId,
    wastedCost: wastedCostSince(sessionTotal, state.sessionTotalAtFirst),
    tried,
    errorPreview: preview || state.errorPreview,
    shouldAbort: true,
  };
}

export function reduceLoop(state: LoopDetectorState, feed: LoopFeed): LoopDetectorState {
  switch (feed.type) {
    case 'settings': {
      const nextSettings: LoopSettings = {
        enabled: feed.settings.enabled ?? state.settings.enabled,
        threshold: clampThreshold(feed.settings.threshold ?? state.settings.threshold),
      };

      if (!nextSettings.enabled) {
        return { ...resetStreaks(state), settings: nextSettings };
      }

      return { ...state, settings: nextSettings, shouldAbort: false };
    }

    case 'chat': {
      if (feed.chatId === state.chatId) {
        return { ...state, shouldAbort: false };
      }

      return emptyLoopState(feed.chatId, state.settings);
    }

    case 'context': {
      return {
        ...state,
        lastMessageId: feed.lastMessageId ?? state.lastMessageId,
        lastSafeMessageId: feed.lastSafeMessageId ?? state.lastSafeMessageId,
        shouldAbort: false,
      };
    }

    case 'success': {
      return resetStreaks(state);
    }

    case 'dismiss': {
      return resetStreaks(state);
    }

    case 'refresh-cost': {
      if (!state.isLooping) {
        return { ...state, shouldAbort: false };
      }

      return {
        ...state,
        wastedCost: wastedCostSince(feed.sessionTotal, state.sessionTotalAtFirst),
        shouldAbort: false,
      };
    }

    case 'user': {
      const lastMessageId = feed.messageId ?? state.lastMessageId;

      if (isAutoFixRequest(feed.text)) {
        const preview = state.errorPreview;
        const tried = preview && !state.tried.includes(preview) ? [...state.tried, preview] : state.tried;

        return {
          ...state,
          lastMessageId,
          tried,
          shouldAbort: false,
        };
      }

      return {
        ...resetStreaks(state),
        lastMessageId,
        lastSafeMessageId: feed.messageId ?? state.lastMessageId ?? state.lastSafeMessageId,
      };
    }

    case 'error': {
      if (!state.settings.enabled) {
        return { ...state, shouldAbort: false };
      }

      const signed = signatureFromError(feed.raw);
      const lastMessageId = feed.messageId ?? state.lastMessageId;
      const same = signed.signature === state.errorSignature;
      const errorCount = same ? state.errorCount + 1 : 1;
      const sessionTotalAtFirst = same && state.errorCount > 0 ? state.sessionTotalAtFirst : feed.sessionTotal;

      const next: LoopDetectorState = {
        ...state,
        lastMessageId,
        isLooping: same ? state.isLooping : false,
        loopKind: same ? state.loopKind : null,
        revertToMessageId: same ? state.revertToMessageId : (state.lastSafeMessageId ?? lastMessageId),
        errorSignature: signed.signature,
        errorCount,
        errorPreview: signed.preview,
        sessionTotalAtFirst,
        wastedCost: wastedCostSince(feed.sessionTotal, sessionTotalAtFirst),
        tried: same ? state.tried : [],
      };

      return maybeTrigger(next, errorCount, 'error', signed.preview, feed.sessionTotal);
    }

    case 'write': {
      if (!state.settings.enabled) {
        return { ...state, shouldAbort: false };
      }

      const key = contentHash(feed.filePath, feed.content);
      const same = key === state.writeKey;
      const writeCount = same ? state.writeCount + 1 : 1;
      const sessionTotalAtFirst = same && state.writeCount > 0 ? state.sessionTotalAtFirst : feed.sessionTotal;
      const preview = `rewrote ${feed.filePath} with identical content`;

      const next: LoopDetectorState = {
        ...state,
        lastMessageId: feed.messageId ?? state.lastMessageId,
        writeKey: key,
        writePath: feed.filePath,
        writeCount,
        sessionTotalAtFirst,
        wastedCost: wastedCostSince(feed.sessionTotal, sessionTotalAtFirst),
        errorPreview: same || writeCount >= state.settings.threshold ? preview : state.errorPreview,
      };

      return maybeTrigger(next, writeCount, 'write', preview, feed.sessionTotal);
    }

    default: {
      return { ...state, shouldAbort: false };
    }
  }
}

export function publicLoopState(state: LoopDetectorState): {
  isLooping: boolean;
  signature: string | null;
  count: number;
  wastedCost: number;
  displayError: string;
  revertToMessageId: string | null;
  loopKind: LoopKind | null;
  tried: string[];
} {
  const count = state.loopKind === 'write' ? state.writeCount : state.errorCount;

  return {
    isLooping: state.isLooping,
    signature: state.loopKind === 'write' ? state.writeKey : state.errorSignature,
    count,
    wastedCost: state.wastedCost,
    displayError: state.errorPreview,
    revertToMessageId: state.revertToMessageId,
    loopKind: state.loopKind,
    tried: state.tried,
  };
}

/** Call abort at most once per trigger. */
export function fireAbortOnce(previous: LoopDetectorState, next: LoopDetectorState, abort: () => void): void {
  if (next.shouldAbort && !previous.shouldAbort) {
    abort();
  }
}
