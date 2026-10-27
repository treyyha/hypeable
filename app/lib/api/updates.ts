export interface UpdateCheckResult {
  available: boolean;
  version: string;
  releaseNotes?: string;
  error?: {
    type: 'rate_limit' | 'network' | 'auth' | 'unknown';
    message: string;
  };
}

/**
 * Hypeable does not phone home. The old bolt.diy path fetched
 * raw.githubusercontent.com; nothing in the product calls this, and the
 * function itself no longer contacts any host.
 */
export const checkForUpdates = async (): Promise<UpdateCheckResult> => {
  return {
    available: false,
    version: 'unknown',
  };
};

export const acknowledgeUpdate = async (version: string): Promise<void> => {
  try {
    localStorage.setItem('last_acknowledged_update', version);
  } catch {
    // Storage can be unavailable in private mode; ignoring is fine.
  }
};
