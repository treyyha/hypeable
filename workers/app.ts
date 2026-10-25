import { createRequestHandler, type ServerBuild } from 'react-router';
import { BoltRouterContext } from '../app/lib/cloudflare-context';

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
    const context = new BoltRouterContext({ env, ctx }, clientAddress);

    return requestHandler(request, context);
  },
} satisfies ExportedHandler<CloudflareEnvironment>;
