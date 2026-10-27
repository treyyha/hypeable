/**
 * Warm chat/workbench only after the user shows intent. Idle prefetch of
 * Chat, Workbench, and provider-list pulled hundreds of KiB of unused JS
 * into the first-load Lighthouse trace and delayed LCP on Slow 4G.
 */
import { atom } from 'nanostores';

export const homeChatShouldLoad = atom(false);

export function prefetchChatRuntime(): void {
  void import('~/components/chat/Chat.client');
}

export function prefetchWorkbench(): void {
  void import('~/components/workbench/Workbench.client');
}

export function prefetchProviderList(): void {
  void import('~/utils/provider-list');
}

export function prefetchOnComposerIntent(): void {
  prefetchChatRuntime();
  prefetchWorkbench();
}

export function requestHomeChatLoad(): void {
  prefetchOnComposerIntent();
  homeChatShouldLoad.set(true);
}

export function requestProviderListLoad(): void {
  prefetchProviderList();
  requestHomeChatLoad();
}
