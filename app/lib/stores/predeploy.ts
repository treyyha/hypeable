/**
 * Pre-deploy modal state. Holds the masked report only — never raw file contents.
 */

import { atom } from 'nanostores';
import { fingerprintFiles } from '~/lib/predeploy/collect';
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

let lastAllowedFingerprint = '';

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
  const fingerprint = fingerprintFiles(files);

  if (fingerprint && fingerprint === lastAllowedFingerprint) {
    return true;
  }

  const report = scan(files);

  return new Promise((resolve) => {
    predeployUiStore.set({
      open: true,
      report,
      acknowledged: false,
      resolve: (allowed) => {
        if (allowed) {
          lastAllowedFingerprint = fingerprint;
        }

        resolve(allowed);
      },
    });
  });
}

export function resetPredeployGate(): void {
  lastAllowedFingerprint = '';
  predeployUiStore.set(emptyState());
}
