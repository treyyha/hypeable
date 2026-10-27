/**
 * Warm chat/workbench/menu only after the user shows intent. Idle prefetch of
 * Chat, Workbench, Menu, and provider-list pulled hundreds of KiB of unused JS
 * into the first-load Lighthouse trace and delayed LCP on Slow 4G.
 */
import { atom } from 'nanostores';
import { settingsPanelStore } from '~/lib/stores/settings-panel';

export const homeChatShouldLoad = atom(false);
export const homeMenuShouldLoad = atom(false);

export function prefetchChatRuntime(): void {
  void import('~/components/chat/Chat.client');
}

export function prefetchWorkbench(): void {
  void import('~/components/workbench/Workbench.client');
}

export function prefetchProviderList(): void {
  void import('~/utils/provider-list');
  void import('~/components/chat/ModelKeyPopover');
}

export function prefetchMenu(): void {
  void import('~/components/sidebar/Menu.client');
}

export function prefetchSettings(): void {
  prefetchMenu();
  void import('~/components/@settings/core/ControlPanel');
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

export function requestMenuLoad(): void {
  prefetchMenu();
  homeMenuShouldLoad.set(true);
}

export function requestSettingsLoad(): void {
  prefetchSettings();
  homeMenuShouldLoad.set(true);
}

settingsPanelStore.subscribe((state) => {
  if (state.open) {
    requestSettingsLoad();
  }
});
