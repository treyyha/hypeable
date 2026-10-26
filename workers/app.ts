import { createRequestHandler, type ServerBuild } from 'react-router';
import { BoltRouterContext } from '../app/lib/cloudflare-context';
import { hostnameFromRequest, isHostedMode } from '../app/lib/security/hosted';

declare global {
  interface CloudflareEnvironment extends Env {}
}

const requestHandler = createRequestHandler(
  // The virtual module resolves to the generated server build; the cast bridges the
  // ambient declaration in `types/` to the `ServerBuild` shape the handler expects.
  () => import('virtual:react-router/server-build') as unknown as Promise<ServerBuild>,
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    /*
     * Production edge always sets cf-connecting-ip. Local workerd / vite preview
     * often leave it empty, and withSecurity then 503s every /api/chat because
     * rate limiting has no trusted client IP. Electron already passes 127.0.0.1.
     */
    const cfIp = request.headers.get('cf-connecting-ip')?.trim();
    const clientAddress = cfIp || '127.0.0.1';
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

    return requestHandler(request, context);
  },
} satisfies ExportedHandler<CloudflareEnvironment>;
