/**
 * Dev-only helper so `?debugCap=1` can show the cap-reached modal without a
 * real blocked request. Production bundles drop this import.
 */
import { capDialogStore, costStore } from '~/lib/stores/cost';

let fired = false;

export function runDebugCapOnce(): void {
  if (fired || typeof window === 'undefined') {
    return;
  }

  if (new URLSearchParams(window.location.search).get('debugCap') !== '1') {
    return;
  }

  fired = true;

  const snapshot = costStore.get();
  capDialogStore.set({
    kind: 'session',
    spent: snapshot.sessionTotal,
    cap: snapshot.caps.session,
    reason: 'hit',
  });
}
