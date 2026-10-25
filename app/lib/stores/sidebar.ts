/**
 * Presentation-only sidebar collapse / mobile drawer state.
 */
import { atom } from 'nanostores';

const COLLAPSED_KEY = 'hypeable:sidebar-collapsed';

function readCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export const sidebarCollapsedStore = atom(readCollapsed());
export const sidebarMobileOpenStore = atom(false);

export function setSidebarCollapsed(collapsed: boolean): void {
  sidebarCollapsedStore.set(collapsed);

  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Private mode should not break the shell.
  }
}

export function toggleSidebarCollapsed(): void {
  setSidebarCollapsed(!sidebarCollapsedStore.get());
}

export function setSidebarMobileOpen(open: boolean): void {
  sidebarMobileOpenStore.set(open);
}

export function toggleSidebarMobile(): void {
  sidebarMobileOpenStore.set(!sidebarMobileOpenStore.get());
}
