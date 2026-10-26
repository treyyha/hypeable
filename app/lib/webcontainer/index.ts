/**
 * WebContainer boot is deferred until the first build or workbench open.
 * Importing this module on the empty home must not start the runtime.
 */

import type { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';
import { cleanStackTrace } from '~/utils/stacktrace';

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

let resolveBoot: ((value: WebContainer) => void) | undefined;
let rejectBoot: ((reason: unknown) => void) | undefined;
let booting = false;

export const webcontainer: Promise<WebContainer> = import.meta.env.SSR
  ? new Promise(() => {
      /* never resolves on the server */
    })
  : (import.meta.hot?.data.webcontainer ??
    new Promise<WebContainer>((resolve, reject) => {
      resolveBoot = resolve;
      rejectBoot = reject;
    }));

if (import.meta.hot && !import.meta.env.SSR) {
  import.meta.hot.data.webcontainer = webcontainer;
}

async function actuallyBoot(): Promise<WebContainer> {
  const webcontainerApi = await import('@webcontainer/api');

  const instance = await webcontainerApi.WebContainer.boot({
    coep: 'credentialless',
    workdirName: WORK_DIR_NAME,
    forwardPreviewErrors: true,
  });

  webcontainerContext.loaded = true;

  const { workbenchStore } = await import('~/lib/stores/workbench');

  const response = await fetch('/inspector-script.js');
  const inspectorScript = await response.text();
  await instance.setPreviewScript(inspectorScript);

  instance.on('preview-message', (message) => {
    if (message.type === 'PREVIEW_UNCAUGHT_EXCEPTION' || message.type === 'PREVIEW_UNHANDLED_REJECTION') {
      const isPromise = message.type === 'PREVIEW_UNHANDLED_REJECTION';
      const title = isPromise ? 'Unhandled Promise Rejection' : 'Uncaught Exception';
      workbenchStore.actionAlert.set({
        type: 'preview',
        title,
        description: 'message' in message ? message.message : 'Unknown error',
        content: `Error occurred at ${message.pathname}${message.search}${message.hash}\nPort: ${message.port}\n\nStack trace:\n${cleanStackTrace(message.stack || '')}`,
        source: 'preview',
      });
    }
  });

  return instance;
}

/** Start the in-browser runtime. Safe to call more than once. */
export function bootWebContainer(): Promise<WebContainer> {
  if (import.meta.env.SSR) {
    return webcontainer;
  }

  if (!booting) {
    booting = true;
    void actuallyBoot().then(
      (instance) => resolveBoot?.(instance),
      (err) => rejectBoot?.(err),
    );
  }

  return webcontainer;
}
