/**
 * Pre-deploy modal state. Holds the masked report only — never raw file contents.
 */

import { atom } from 'nanostores';
import { scan } from '~/lib/predeploy/scan';
import type { ScanReport } from '~/lib/predeploy/types';

export type PredeployUiState = {
  open: boolean;
  report: ScanReport | null;
  acknowledged: boolean;
  resolve: ((allowed: boolean) => void) | null;
};

const emptyState = (): PredeployUiState => ({
  open: false,
  report: null,
  acknowledged: false,
  resolve: null,
});

export const predeployUiStore = atom<PredeployUiState>(emptyState());

export function setPredeployAcknowledged(acknowledged: boolean): void {
  const current = predeployUiStore.get();
  predeployUiStore.set({ ...current, acknowledged });
}

export function closePredeploy(allowed: boolean): void {
  const current = predeployUiStore.get();
  current.resolve?.(allowed);
  predeployUiStore.set(emptyState());
}

export async function requestPredeployClearance(files: Record<string, string>): Promise<boolean> {
  const report = scan(files);

  return new Promise((resolve) => {
    predeployUiStore.set({
      open: true,
      report,
      acknowledged: false,
      resolve,
    });
  });
}

export function resetPredeployGate(): void {
  predeployUiStore.set(emptyState());
}
