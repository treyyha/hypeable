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

  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(() => prefetchHomeChunks());
    return () => window.cancelIdleCallback(id);
  }

  const id = window.setTimeout(() => prefetchHomeChunks(), 1);

  return () => window.clearTimeout(id);
}
