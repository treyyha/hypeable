/**
 * Always-on pre-deploy modal plus the dev-only debug query.
 */
import { useEffect } from 'react';
import { PredeployModal } from './PredeployModal';

export function PredeployHost() {
  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    void import('~/lib/predeploy/debug-predeploy').then((mod) => mod.runDebugPredeployOnce());
  }, []);

  return <PredeployModal />;
}
