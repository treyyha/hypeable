/**
 * Dev-only helper so `?debugPredeploy=fail|warn|clean` can show the modal
 * without a generated app. Production bundles drop this import.
 */

import { cleanDebugFixture, failDebugFixture, warnDebugFixture } from './fixtures';
import { requestPredeployClearance } from '~/lib/stores/predeploy';

let fired = false;

export function runDebugPredeployOnce(): void {
  if (fired || typeof window === 'undefined') {
    return;
  }

  const value = new URLSearchParams(window.location.search).get('debugPredeploy');

  if (value !== 'fail' && value !== 'warn' && value !== 'clean') {
    return;
  }

  fired = true;

  const files = value === 'fail' ? failDebugFixture : value === 'warn' ? warnDebugFixture : cleanDebugFixture;
  void requestPredeployClearance(files);
}
