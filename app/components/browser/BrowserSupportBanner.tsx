/**
 * In-browser runtime needs Chromium. Copy matches WebContainers docs (Oct 2026).
 */

import { useEffect, useState } from 'react';
import { browserSupportCopy, detectBrowserSupport } from '~/lib/browser/support';

export function BrowserSupportBanner() {
  const [copy, setCopy] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debug = params.get('debugBrowser') === '1';

    const status = detectBrowserSupport({
      userAgent: debug ? 'Mozilla/5.0 Firefox/131.0' : navigator.userAgent,
      crossOriginIsolated: debug ? false : window.crossOriginIsolated,
      hasSharedArrayBuffer: debug ? false : typeof SharedArrayBuffer !== 'undefined',
    });

    if (status.supported) {
      return;
    }

    setCopy(browserSupportCopy(status));
  }, []);

  if (!copy?.title) {
    return null;
  }

  return (
    <div
      role="status"
      data-testid="browser-support-banner"
      className="relative z-[2] mx-auto mt-3 w-full max-w-chat px-4"
    >
      <div className="rounded-[var(--hype-radius-md)] border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-4 py-3">
        <p className="text-sm font-medium text-bolt-elements-textPrimary">{copy.title}</p>
        <p className="mt-1 text-sm text-bolt-elements-textSecondary">{copy.message}</p>
      </div>
    </div>
  );
}
