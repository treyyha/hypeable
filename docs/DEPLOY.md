# Deploy Hypeable on Cloudflare

The public site (`hypeable.dev`) is a **stateless** Hypeable: users bring their own model key in the browser. Hypeable stores nothing. Set `HYPEABLE_HOSTED=1` only on that deployment.

Self-hosted (`pnpm dev` / Docker, no env var) behaves exactly as today: Ollama, LM Studio, OpenAI-compatible URLs, MCP, and system routes stay available.

## Hosted vs local

| Capability | Public host (`HYPEABLE_HOSTED=1`) | Local / self-host (unset) |
|---|---|---|
| First-party providers (OpenAI, Anthropic, Google, OpenRouter, Groq, DeepSeek, Mistral, xAI, Together, Perplexity, Cohere, Hugging Face, Fireworks, Cerebras, Amazon Bedrock, GitHub Models, Moonshot, Hyperbolic, Z.ai) | Yes, BYO key in the browser | Yes |
| Custom OpenAI-compatible base URL, Ollama, LM Studio | Rejected server-side: "Run Hypeable locally to use custom endpoints" | Yes |
| Git proxy | `github.com` / `gitlab.com` (and GitHub raw/codeload hosts), git smart-HTTP only | Open (same as today) |
| MCP, bug-report, update, `/api/system/*`, `/api/git-info`, `/api/check-env-key`, `/api/configured-providers` | 404 | Yes |
| `/api/export-api-keys` | 410 (keys are browser-only) | 410 |
| WebContainer preview | Yes | Yes |

No secrets are required on the public deployment. Users paste keys in the app; they leave the browser only in the request to their chosen provider.

## Wrangler

`wrangler.jsonc` is the source of truth:

- `name`: `hypeable`
- `main`: `./workers/app.ts` (SSR Worker; Vite's Cloudflare plugin emits the client into `build/client`)
- `compatibility_date`: `2026-10-01`
- `compatibility_flags`: `["nodejs_compat"]`
- `ratelimits`: `API_RATE_LIMITER` (60 requests / 60s per key) — used by `/api/chat` and `/api/llmcall` **in addition to** the in-memory limiter

The Rate Limiting API is a **Workers** binding ([docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)). Cloudflare's Pages Functions binding list does not include it. This repo deploys as a Worker with static assets, so the binding applies when Wrangler (or Workers Builds) reads `wrangler.jsonc`. If you use classic Pages without that binding, add the WAF rule below.

Local production bundle:

```bash
pnpm build
# PowerShell — use wrangler dev (SSR Worker + static assets from build/)
$env:HYPEABLE_HOSTED="1"
npx wrangler dev --var HYPEABLE_HOSTED:1 --port 8788 --ip 127.0.0.1
```

`wrangler pages dev ./build/client` currently fails on Windows: workerd cannot load `.wrangler/tmp/.../middleware-insertion-facade.js` (imported from `pages-shim.js`). This repo deploys as a Worker with assets (`main`: `workers/app.ts`, client in `build/client`), so `wrangler dev` is the matching local command. Confirm `/` is 200 with COOP `same-origin` and COEP `credentialless`, disabled routes 404, and OpenAILike/git-proxy custom hosts 403.

## Cloudflare Pages — Git integration (click these)

1. Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
2. **Create** → **Pages** → **Connect to Git**.
3. Authorize GitHub if asked. Select **`treyyha/hypeable`**.
4. Set:
   - **Production branch:** `main`
   - **Framework preset:** None (or Wrangler, if offered — this repo has `wrangler.jsonc`)
   - **Build command:** `pnpm run build`
   - **Build output directory:** `build/client`
   - **Root directory:** `/` (leave empty)
5. **Environment variables** (Production and Preview):
   - `NODE_VERSION` = `22`
   - `HYPEABLE_HOSTED` = `1`
   - Do **not** add API keys, `SESSION_SECRET`, or `ENCRYPTION_KEY`.
6. Save and deploy. First build uses the wrangler compatibility date and `nodejs_compat` from `wrangler.jsonc`.

If the UI creates a **Worker** instead of a classic Pages project (Cloudflare is merging the two), that is correct: keep `wrangler.jsonc`, set the same two env vars under **Settings → Variables**, and deploy from `main`.

### WAF rate-limit rule (classic Pages, or extra edge limit)

Workers Rate Limiting bindings are **not** listed for Pages Functions. If this project is a classic Pages project without `API_RATE_LIMITER`:

1. Open the zone that fronts `hypeable.dev` (after the domain step below).
2. **Security** → **WAF** → **Rate limiting rules** → **Create rule**.
3. Match `http.request.uri.path eq "/api/chat"` **or** `http.request.uri.path eq "/api/llmcall"`.
4. **With the same IP**, **10 seconds**, **counter**: 10 (or 60/minute if the UI allows a 60s period).
5. Action: **Block** (or Challenge). Deploy.

The in-memory limiter in `app/lib/security.ts` still runs (60/min chat, 30/min llmcall) even without this rule. It is per-isolate, so the WAF (or the Workers binding) is the shared edge limit.

## Custom domain (`hypeable.dev`)

1. In Cloudflare **Registrars / Add a site**, add `hypeable.dev` if it is not already a zone. Change the domain's nameservers at the current registrar to the two Cloudflare nameservers shown.
2. Wait until the zone is **Active**.
3. Workers & Pages → this project → **Custom domains** (Pages) or **Settings → Domains & Routes → Add → Custom Domain** (Workers).
4. Enter `hypeable.dev` and `www.hypeable.dev`. Cloudflare will create the DNS records and issue the certificate. Delete any leftover A/CNAME at the old DNS host first, or the add will fail.

## Rollback

1. Workers & Pages → the project → **Deployments**.
2. Open the last good production deployment.
3. **Rollback to this deployment** (Workers) or **Retry deployment** of that commit (Pages).
4. Confirm `HYPEABLE_HOSTED=1` is still set. Rollback restores that build's Worker; env vars are project-level and stay.

To undo a bad `main` commit: revert on GitHub and let the Git integration rebuild.

## WebContainer licence

The in-browser runtime is [WebContainer](https://webcontainers.io/) from StackBlitz. **Free for open source and non-commercial use.** The public Hypeable site must not show ads or paid features unless you have a StackBlitz commercial licence. Self-hosting for personal use is fine. Do not put a paywall on `hypeable.dev` without that licence.

## Cost and limits (Cloudflare Free, as of 2026)

| Item | Free plan |
|---|---|
| Pages builds | 500 / month, 1 at a time, 20 min timeout |
| Pages custom domains | 100 / project |
| Pages files | 20,000 |
| Workers requests | 100,000 / day (CPU-time limited) |
| Rate Limiting binding | Approximate, per Cloudflare location; period 10s or 60s |

Hypeable does not host model inference. Usage cost is the user's provider bill plus this Cloudflare free-tier envelope. Stay on Free until request volume exceeds the Workers daily cap; then Workers Paid.

## Headers

`public/_headers` (static) and `app/entry.server.tsx` (HTML) set:

- `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opener-Policy: same-origin` — WebContainer SharedArrayBuffer
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Content-Security-Policy-Report-Only` — see `app/lib/security/headers.ts` for why `blob:`, `wasm-unsafe-eval`, `https:` connect/frame, and localhost are allowed (WebContainer guest + preview iframe + the user's model provider)

Report-only first: a missing origin must not brick the preview. Tighten to enforcing CSP after a week of empty reports.
