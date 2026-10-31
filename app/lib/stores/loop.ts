/**
 * Live loop-breaker state. Detection is pure (`app/lib/loop`); this store
 * persists settings locally and exposes isLooping for later pillars.
 */
import { atom, map } from 'nanostores';
import {
  emptyLoopState,
  fireAbortOnce,
  LOOP_SETTINGS_KEY,
  publicLoopState,
  readLoopSettings,
  reduceLoop,
  setLoopSignalListener,
  type LoopDetectorState,
  type LoopErrorSource,
  type LoopSettings,
} from '~/lib/loop';
import { costStore } from '~/lib/stores/cost';

export type LoopPublicState = ReturnType<typeof publicLoopState>;

const browserStorage = (): Storage | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

function loadSettings(): LoopSettings {
  try {
    return readLoopSettings(browserStorage()?.getItem(LOOP_SETTINGS_KEY));
  } catch {
    return readLoopSettings(null);
  }
}

function persistSettings(settings: LoopSettings): void {
  try {
    browserStorage()?.setItem(LOOP_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Quota or private-mode failures must not break chat.
  }
}

let detector: LoopDetectorState = emptyLoopState('', loadSettings());

export const loopStore = map<LoopPublicState>(publicLoopState(detector));

export const loopSettingsStore = map<LoopSettings>(detector.settings);

export const loopAbortTick = atom(0);

function sessionTotal(): number {
  return costStore.get().sessionTotal;
}

function commit(next: LoopDetectorState): LoopPublicState {
  fireAbortOnce(detector, next, () => {
    loopAbortTick.set(loopAbortTick.get() + 1);
  });
  detector = next;

  const view = publicLoopState(next);
  loopStore.set(view);
  loopSettingsStore.set(next.settings);

  return view;
}

export function getLoopDetectorState(): LoopDetectorState {
  return detector;
}

export function reportLoopError(
  raw: string,
  source: LoopErrorSource = 'action',
  messageId?: string,
  attemptId?: string,
): void {
  commit(
    reduceLoop(detector, {
      type: 'error',
      raw,
      source,
      messageId,
      attemptId,
      sessionTotal: sessionTotal(),
    }),
  );
}

export function reportLoopWrite(filePath: string, content: string, messageId?: string): void {
  commit(
    reduceLoop(detector, {
      type: 'write',
      filePath,
      content,
      messageId,
      sessionTotal: sessionTotal(),
    }),
  );
}

export function reportLoopSuccess(): void {
  commit(reduceLoop(detector, { type: 'success' }));
}

export function noteLoopUserMessage(text: string, messageId?: string): void {
  commit(reduceLoop(detector, { type: 'user', text, messageId }));
}

export function setLoopChat(chatId: string): void {
  commit(reduceLoop(detector, { type: 'chat', chatId }));
}

export function setLoopContext(
  lastMessageId?: string,
  lastSafeMessageId?: string,
  lastAssistantMessageId?: string,
): void {
  commit(reduceLoop(detector, { type: 'context', lastMessageId, lastSafeMessageId, lastAssistantMessageId }));
}

export function refreshLoopCost(): void {
  commit(reduceLoop(detector, { type: 'refresh-cost', sessionTotal: sessionTotal() }));
}

export function dismissLoop(): void {
  commit(reduceLoop(detector, { type: 'dismiss' }));
}

export function setLoopSettings(patch: Partial<LoopSettings>): void {
  const next = commit(reduceLoop(detector, { type: 'settings', settings: patch }));
  persistSettings(detector.settings);
  void next;
}

export const OPEN_MODEL_PICKER_EVENT = 'open-hypeable-model-picker';

export function openModelPicker(selection?: { model?: string; provider?: string }): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(OPEN_MODEL_PICKER_EVENT, { detail: selection ?? {} }));
}

export function rewindToMessage(messageId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  params.set('rewindTo', messageId);
  window.location.search = params.toString();
}

setLoopSignalListener({
  error: (raw, source) => reportLoopError(raw, source),
  write: (filePath, content) => reportLoopWrite(filePath, content),
  success: () => reportLoopSuccess(),
});
