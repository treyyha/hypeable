# Deploy Hypeable on Cloudflare

The public site (`hypeable.dev`) is a **stateless** Hypeable: users bring their own model key in the browser. Hypeable stores nothing.

## Hosted vs local (fail closed)

A request is **hosted** when **any** of these is true, unless the operator sets `HYPEABLE_SELF_HOSTED=1`:

1. `HYPEABLE_HOSTED=1` (Cloudflare env or process env)
2. The request URL's own host is **not** loopback / `localhost` / RFC1918 / link-local / `*.local`
3. That host is **missing, empty, or unparseable** (fail closed)

Host comes from `request.url` only. `Host`, `X-Forwarded-Host`, `Forwarded`, and similar headers are ignored — they are caller-controlled.

Local `pnpm dev`, Playwright, and Electron stay open: they hit `localhost` / `127.0.0.1` and do not set the env. A forgotten env var on the public hostname still locks custom endpoints.

Set `HYPEABLE_SELF_HOSTED=1` only if you run Hypeable on a public hostname and **want** Ollama / custom URLs / MCP.

| Capability | Hosted (public/missing Host or `HYPEABLE_HOSTED=1`) | Local / `HYPEABLE_SELF_HOSTED=1` |
|---|---|---|
| First-party providers (OpenAI, Anthropic, Google, OpenRouter, Groq, DeepSeek, Mistral, xAI, Together, Perplexity, Cohere, Hugging Face, Fireworks, Cerebras, Amazon Bedrock, GitHub Models, Moonshot, Hyperbolic, Z.ai) | Yes, BYO key in the browser | Yes |
| Custom OpenAI-compatible base URL, Ollama, LM Studio | Rejected: "Run Hypeable locally to use custom endpoints" | Yes |
| Git proxy | `github.com` / `gitlab.com` (and GitHub raw/codeload hosts), git smart-HTTP only | Open (same as today) |
| MCP, bug-report, update, `/api/system/*`, `/api/git-info`, `/api/check-env-key`, `/api/configured-providers` | 404 | Yes |
| `/api/export-api-keys` | 410 (keys are browser-only) | 410 |
| `/api/health` | `{ ok: true, hosted: true, commit }` | `{ ok: true, hosted: false, commit }` |
| WebContainer preview | Yes | Yes |

No secrets are required on the public deployment. Model keys and connector tokens (GitHub, GitLab, Vercel, Netlify, Supabase) live in the browser and are sent over HTTPS for the request, never stored or logged, and never read from Worker env. There is no Hypeable-owned Vercel/Netlify/GitHub target.

After a deploy, wait until the Worker is serving this commit:

```bash
npm run smoke:live -- https://hypeable.gentle-scene-0c4c.workers.dev --expect-commit $(git rev-parse HEAD)
```

`commit` is the SHA baked in at build time (`WORKERS_CI_COMMIT_SHA` from Workers Builds, else `git rev-parse HEAD`). You do not add that variable in the dashboard. The home footer shows `v0.1.0 . abc1234` and links to that commit on GitHub.

Once `hypeable.dev` is verified, run the same command against `https://hypeable.dev`.

## Primary path: Cloudflare Worker via Workers Builds

`wrangler.jsonc` is the source of truth (`name`: `hypeable`, `main`: `./workers/app.ts`). The Vite Cloudflare plugin emits static assets from `build/client`. There are no secrets in `wrangler.jsonc`.

`workers_dev` is **true** so deploys keep the `*.workers.dev` test URL. `preview_urls` is **false**.

TODO: turn `workers_dev` off once `hypeable.dev` is live and verified.

## Observability and logs (never stored or logged)

The privacy claim is that the BYO key is never stored or logged. Cloudflare Workers observability can persist **invocation logs** that include request metadata (URL, method, headers on some plans). Our key travels in `x-hypeable-key`. Production `wrangler.jsonc` therefore sets:

- `observability.enabled`: `false`
- `observability.traces.enabled`: `false`
- `observability.logs.enabled`: `false` (no invocation logs, not persisted)

Temporarily debug a live Worker with `npx wrangler tail` (stream to your terminal only; do not leave it running; do not paste tail output that might contain headers). Turn it off when you are done.

Server `console.*` is wrapped by `installSafeConsole()` (`app/lib/security/redact.ts`). Still: **do not log headers, bodies, or cookies.** Status codes and generic error names are fine. If a real key ever appears in a log, rotate it.

### Dashboard steps

1. Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
2. **Create** → **Workers** → **Import a repository** / **Connect to Git**.
3. Select **`treyyha/hypeable`**. Production branch **`main`**.
4. Set:
   - **Build command:** `pnpm run build`
   - **Deploy command:** `npx wrangler deploy`
5. **Variables**
   - **Build** variable: `NODE_VERSION` = `22`
   - **Runtime** variable: `HYPEABLE_HOSTED` = `1` (defence in depth; public Host already fail-closes)
   - Do **not** add API keys, connector tokens, `SESSION_SECRET`, or `ENCRYPTION_KEY`.
6. Save and deploy.

`wrangler.jsonc` also binds `API_RATE_LIMITER` (60 requests / 60s) for `/api/chat` and `/api/llmcall`, on top of the in-memory limiter.

Local production bundle:

```bash
pnpm build
$env:HYPEABLE_HOSTED="1"
npx wrangler dev --var HYPEABLE_HOSTED:1 --port 8788 --ip 127.0.0.1
```

Check Worker size (uncompressed counts; gzip is informational): `npx wrangler deploy --dry-run`. Limit is **64 MiB uncompressed** on Free and Paid ([Workers size limits](https://developers.cloudflare.com/workers/platform/limits/#worker-size)). The old 3 MiB gzip cap was removed in September 2026.

## Fallback: classic Cloudflare Pages

Use this only if Workers Builds is unavailable.

1. **Create** → **Pages** → **Connect to Git** → **`treyyha/hypeable`**.
2. Production branch `main`. Build command `pnpm run build`. Output directory `build/client`.
3. Env (Production and Preview): `NODE_VERSION`=`22`, `HYPEABLE_HOSTED`=`1`. No secrets.
4. Pages Functions do **not** document the Rate Limiting binding. Add a WAF rule: zone → **Security → WAF → Rate limiting rules** matching `/api/chat` or `/api/llmcall`, same IP, Block or Challenge.

`wrangler pages dev` currently fails on Windows (workerd `middleware-insertion-facade.js`). Use `wrangler dev`.

## Custom domain (`hypeable.dev`)

1. Add `hypeable.dev` as a Cloudflare zone; point the registrar nameservers to Cloudflare.
2. Wait until **Active**.
3. Worker → **Settings → Domains & Routes → Custom Domain**. Attach `hypeable.dev` and `www.hypeable.dev`. Delete leftover A/CNAME at the old DNS host first.

## Rollback

Worker → **Deployments** → last good production deployment → **Rollback to this deployment**. Runtime vars stay. Or revert `main` and let Workers Builds rebuild.

## WebContainer licence

The in-browser runtime is [WebContainer](https://webcontainers.io/) from StackBlitz. **Free for open source and non-commercial use.** The public site must not show ads or paid features without a StackBlitz commercial licence.

## Cost and limits (Cloudflare Free, as of 2026)

| Item | Free plan |
|---|---|
| Worker size (uncompressed) | 64 MiB (gzip no longer limited) |
| Workers requests | 100,000 / day |
| Static asset files | 20,000 |
| Rate Limiting binding | Approximate, per Cloudflare location; 10s or 60s |

## Headers

Values live in `app/lib/security/headers.ts`. Keep `public/_headers` in sync with the HTML row. Document-only headers are never applied to JSON/SSE.

| Surface | Headers |
|---|---|
| HTML (`app/entry.server.tsx`) | COOP `same-origin`, COEP `credentialless`, `X-Content-Type-Options: nosniff`, Referrer-Policy `strict-origin-when-cross-origin`, Permissions-Policy `camera=(), microphone=(), geolocation=(), payment=(), usb=()`, CSP-Report-Only |
| Static assets (`public/_headers`) | Same as HTML |
| `/api/*` (`workers/app.ts`) | `X-Content-Type-Options: nosniff`, Referrer-Policy `strict-origin-when-cross-origin`, `Cache-Control: no-store`. No COOP, COEP, CSP, or Permissions-Policy. A route's existing stricter Cache-Control (already `no-store`) or Referrer-Policy is kept. The wrapper copies `status` / `headers` and passes the original body through so chat SSE is not buffered. |

See `app/lib/security/headers.ts` for why CSP-Report-Only allows `blob:`, `wasm-unsafe-eval`, `https:` connect/frame, and localhost.
