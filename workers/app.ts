import { createRequestHandler, type ServerBuild } from 'react-router';
import { BoltRouterContext } from '../app/lib/cloudflare-context';
import { applyApiSecurityHeaders, isApiRequest } from '../app/lib/security/headers';
import { hostnameFromRequest, isHostedMode, isPrivateOrLoopbackHost } from '../app/lib/security/hosted';
import { releaseUnreadBody } from '../app/lib/security/unread-body';

declare global {
  interface CloudflareEnvironment extends Env {}
}

const requestHandler = createRequestHandler(

  /*
   * The virtual module resolves to the generated server build; the cast bridges the
   * ambient declaration in `types/` to the `ServerBuild` shape the handler expects.
   */
  () => import('virtual:react-router/server-build') as unknown as Promise<ServerBuild>,
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    /*
     * URL host only. Do not read Host / X-Forwarded-Host / Forwarded — those
     * are caller-controlled. Missing or unparseable hostname fail-closes.
     */
    const hostname = hostnameFromRequest(request);

    /*
     * Fail closed: a public or missing Host is hosted even if HYPEABLE_HOSTED
     * was forgotten. Proxy the binding so every isHostedMode(env) call sees it.
     */
    const hosted = isHostedMode(env as unknown as Record<string, unknown>, hostname);

    /*
     * Production edge always sets cf-connecting-ip. Local workerd / vite preview
     * often leave it empty, and withSecurity then 503s every /api/chat because
     * rate limiting has no trusted client IP. Fallback to 127.0.0.1 only on
     * loopback; a public hostname without the Cloudflare header shares no
     * bucket and is refused instead.
     */
    const cfIp = request.headers.get('cf-connecting-ip')?.trim();
    const clientAddress = cfIp || (hosted && !isPrivateOrLoopbackHost(hostname) ? '' : '127.0.0.1');

    const workerEnv = hosted
      ? new Proxy(env, {
          get(target, prop, receiver) {
            if (prop === 'HYPEABLE_HOSTED') {
              return '1';
            }

            return Reflect.get(target, prop, receiver);
          },
        })
      : env;

    const context = new BoltRouterContext({ env: workerEnv, ctx }, clientAddress, hostname);

    /*
     * React Router only matches OPTIONS to a loader. Most /api routes only
     * export an action, so a preflight would 500 as "Unexpected Server Error"
     * under workerd. Answer here: 204 and no CORS on a cross-site Origin.
     */
    if (request.method === 'OPTIONS' && isApiRequest(request)) {
      const released = releaseUnreadBody(request);

      if (released) {
        ctx.waitUntil(released);
      }

      return applyApiSecurityHeaders(new Response(null, { status: 204 }));
    }

    const response = await requestHandler(request, context);
    const released = releaseUnreadBody(request);

    if (released) {
      ctx.waitUntil(released);
    }

    /*
     * Document COOP/COEP/CSP stay on HTML. Every /api/* response (including
     * routes that skip withSecurity) gets the small API set. The wrapper
     * rebuilds Response from the original body so chat SSE is not buffered.
     */
    if (!isApiRequest(request)) {
      return response;
    }

    return applyApiSecurityHeaders(response);
  },
} satisfies ExportedHandler<CloudflareEnvironment>;
