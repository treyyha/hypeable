import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { ServerRouter, type EntryContext, type RouterContextProvider } from 'react-router';
import { DOCUMENT_SECURITY_HEADERS } from '~/lib/security/headers';
import { installSafeConsole, redactUnknown } from '~/lib/security/redact';

installSafeConsole();

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: Readonly<RouterContextProvider>,
) {
  const body = await renderToReadableStream(<ServerRouter context={routerContext} url={request.url} />, {
    signal: request.signal,
    onError(error: unknown) {
      console.error(redactUnknown(error));
      responseStatusCode = 500;
    },
  });

  if (isbot(request.headers.get('user-agent') || '') || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');

  /*
   * WebContainer requires a cross-origin-isolated document.
   * `credentialless` is used because the preview iframe and the
   * COEP header would otherwise block every third-party subresource.
   * Extra headers + enforcing CSP + stricter CSP-Report-Only live in
   * DOCUMENT_SECURITY_HEADERS (keep public/_headers in sync).
   */
  for (const [name, value] of Object.entries(DOCUMENT_SECURITY_HEADERS)) {
    responseHeaders.set(name, value);
  }

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
