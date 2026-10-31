/**
 * Dev-only helper so `?debugDeploy=1` can show the deploy alert without a
 * real publish. Production bundles drop this import.
 */
import { workbenchStore } from '~/lib/stores/workbench';

let fired = false;

export function runDebugDeployOnce(): void {
  if (fired || typeof window === 'undefined') {
    return;
  }

  if (new URLSearchParams(window.location.search).get('debugDeploy') !== '1') {
    return;
  }

  fired = true;

  workbenchStore.deployAlert.set({
    type: 'error',
    title: 'Deploy failed',
    description: 'The last publish did not finish.',
    content: 'debug deploy fixture',
    source: 'vercel',
    stage: 'deploying',
    buildStatus: 'complete',
    deployStatus: 'failed',
  });
}
