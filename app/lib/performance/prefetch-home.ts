/**
 * Warm the chat runtime and workbench after first paint so the first build
 * is not waiting on a cold dynamic import.
 */
export function prefetchChatRuntime(): void {
  void import('~/components/chat/Chat.client');
}

export function prefetchWorkbench(): void {
  void import('~/components/workbench/Workbench.client');
}

export function prefetchHomeChunks(): void {
  prefetchChatRuntime();
  prefetchWorkbench();
}

export function scheduleHomePrefetch(): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const win = window;

  if (typeof win.requestIdleCallback === 'function') {
    const id = win.requestIdleCallback(() => prefetchHomeChunks());
    return () => win.cancelIdleCallback(id);
  }

  const id = win.setTimeout(() => prefetchHomeChunks(), 1);

  return () => win.clearTimeout(id);
}
