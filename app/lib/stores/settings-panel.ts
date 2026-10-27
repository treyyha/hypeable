/**
 * Settings panel open request. The header button is in the SSR shell; the
 * sidebar that mounts ControlPanel is lazy. A store survives that gap so a
 * click before Menu hydrates is not dropped.
 */
import { atom } from 'nanostores';

export type SettingsPanelState = {
  open: boolean;
  tab?: string;
};

export const settingsPanelStore = atom<SettingsPanelState>({ open: false });

export function openSettingsPanel(tab?: string): void {
  settingsPanelStore.set({ open: true, tab });
}

export function closeSettingsPanel(): void {
  settingsPanelStore.set({ open: false });
}
