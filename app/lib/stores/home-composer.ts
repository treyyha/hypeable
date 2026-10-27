/**
 * Composer draft that survives the ClientOnly swap from the SSR home shell
 * to ChatImpl. Keys and send live in Chat; the visible textarea must not
 * forget what the user typed (or an example chip filled) before that mounts.
 */
import { atom } from 'nanostores';

export const homeComposerDraft = atom('');
export const homeComposerSendNonce = atom(0);

export function setHomeComposerDraft(value: string): void {
  homeComposerDraft.set(value);
}

export function requestHomeComposerSend(): void {
  homeComposerSendNonce.set(homeComposerSendNonce.get() + 1);
}
