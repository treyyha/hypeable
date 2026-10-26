/**
 * Gate every publish path: scan locally, show the modal, continue only when allowed.
 */

import { collectScanFiles } from './collect';
import type { ScanFileEntry } from './types';
import { requestPredeployClearance } from '~/lib/stores/predeploy';

export async function withPredeployScan<T>(
  fileMap: Record<string, ScanFileEntry | undefined>,
  proceed: () => Promise<T>,
): Promise<T | undefined> {
  return withPredeployScanFiles(collectScanFiles(fileMap), proceed);
}

export async function withPredeployScanFiles<T>(
  files: Record<string, string>,
  proceed: () => Promise<T>,
): Promise<T | undefined> {
  const allowed = await requestPredeployClearance(files);

  if (!allowed) {
    return undefined;
  }

  return proceed();
}

export function publishBlockedMessage(): string {
  return 'Publish cancelled — pre-deploy check was not cleared.';
}
