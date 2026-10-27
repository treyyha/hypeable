/**
 * Composer draft and the ChatImpl bridge that survive keeping the SSR
 * home shell painted. Keys and send live in Chat; the visible textarea
 * must not forget what the user typed (or an example chip filled) before
 * that mounts. When Chat is a headless island, runtime callbacks hydrate
 * the same shell in place so the hero is never unmounted.
 */
import { atom } from 'nanostores';
import type { UIEvent } from 'react';
import type { LlmErrorAlertType } from '~/types/actions';
import type { ProviderInfo } from '~/types/model';

export const homeComposerDraft = atom('');
export const homeComposerSendNonce = atom(0);

export type HomeChatRuntime = {
  ready: boolean;
  providerList: ProviderInfo[];
  provider?: ProviderInfo;
  model?: string;
  setProvider?: (provider: ProviderInfo) => void;
  setModel?: (model: string) => void;
  sendMessage?: (event: UIEvent, messageInput?: string) => void;
  enhancePrompt?: () => void;
  llmErrorAlert?: LlmErrorAlertType;
  clearLlmErrorAlert?: () => void;
};

export const emptyHomeChatRuntime: HomeChatRuntime = {
  ready: false,
  providerList: [],
};

export const homeChatRuntime = atom<HomeChatRuntime>(emptyHomeChatRuntime);

export function setHomeComposerDraft(value: string): void {
  homeComposerDraft.set(value);
}

export function requestHomeComposerSend(): void {
  homeComposerSendNonce.set(homeComposerSendNonce.get() + 1);
}

export function resetHomeChatRuntime(): void {
  homeChatRuntime.set(emptyHomeChatRuntime);
}
