# Security guide

Longer write-up: [THREAT-MODEL.md](THREAT-MODEL.md). Report privately via [GitHub security advisories](https://github.com/treyyha/hypeable/security/advisories/new) (`https://hypeable.dev/.well-known/security.txt`).

## Threat model (short)
| Threat | Mitigation |
|---|---|
| Key leaks to GitHub | `.gitignore`, `.husky/pre-commit` secret-scan, CI gitleaks (`.gitleaks.toml` extends the default rule set), GitHub push protection |
| Key leaks via our server | Stored in the browser; sent over HTTPS for the request (LLM: `x-hypeable-key`; connectors: Authorization/body); never stored or logged; `app/lib/security/redact.ts` |
| OpenRouter Connect (PKCE) | Verifier + `state` in sessionStorage; `?code=` stripped from the URL before React; exchange is browser→`openrouter.ai` (CORS `*`); key never hops our server; `sk-or-` redacted |
| Abuse of any server route | rate limit + bot protection + origin check |
| Field tampering (`role`, `price`, `userId`) | zod `.strict()` schemas; identity from session only |
| Session theft | HttpOnly + Secure + SameSite cookie, short lifetime, rotation |
| Missing auth | check inside every server handler |
| XSS / clickjacking | HTML/static: enforcing CSP + stricter CSP-Report-Only, COOP/COEP, Permissions-Policy; `/api/*`: nosniff + Referrer-Policy + `Cache-Control: no-store` (no document CSP on JSON) |
| Supply chain | Dependabot, lockfile, CI audit. Remaining open alert: `elliptic` (low, client polyfill, no patch). |
| Generated apps shipping secrets | pre-deploy scanner ([PREDEPLOY-CHECK.md](PREDEPLOY-CHECK.md)); shared patterns in `app/lib/security/secret-patterns.json` |
| Operator env keys on hosted | Hosted ignores `serverEnv` / `process.env` API keys and `GITHUB_TOKEN`. `wrangler.jsonc` has no secrets; only `API_RATE_LIMITER`. |

## Response headers

| Surface | Headers |
|---|---|
| HTML (`app/entry.server.tsx`) | COOP `same-origin`, COEP `credentialless`, `X-Content-Type-Options: nosniff`, Referrer-Policy `strict-origin-when-cross-origin`, `Cache-Control: no-store, no-transform` (blocks Cloudflare HTML rewrites / Web Analytics injection), Permissions-Policy `camera=(), microphone=(), geolocation=(), payment=(), usb=()`, enforcing `Content-Security-Policy`, stricter `Content-Security-Policy-Report-Only` |
| Static assets (`public/_headers`) | Same as HTML |
| `/api/*` (`workers/app.ts`) | `X-Content-Type-Options: nosniff`, Referrer-Policy `strict-origin-when-cross-origin`, `Cache-Control: no-store`. No COOP, COEP, CSP, or Permissions-Policy. Existing stricter Cache-Control / Referrer-Policy on a route is kept. Body is passed through (not buffered) so chat/SSE still streams. |

Enforcing CSP (`app/lib/security/headers.ts` `CSP_ENFORCING`) keeps `https:` on `connect-src` / `frame-src` / `img-src` because the user picks a provider at runtime and WebContainer preview frames are per-session. Tightening those to a static host list would break Connect, preview, and publish. A stricter report-only policy (`CSP_REPORT_ONLY`) lists known provider and WebContainer hosts so new origins show up in the console without breaking a flow.

`unsafe-inline` / `unsafe-eval` (not removable without a rewrite):

- `script-src 'unsafe-inline'`: root theme boot and the OpenRouter callback-strip script in `app/root.tsx`
- `script-src 'unsafe-eval'` and `'wasm-unsafe-eval'`: WebContainer compiles guest JavaScript and WASM
- `style-src 'unsafe-inline'`: UnoCSS / runtime component styles

Constants: `app/lib/security/headers.ts`.

Hosted JSON does not send `Access-Control-Allow-Origin`. `/api/git-proxy/*` is same-origin only on hosted (the product uses the relative URL `corsProxy: '/api/git-proxy'`). Local debug routes (`/api/system/git-info`, `/api/system/diagnostics`) reflect a loopback `Origin` or send no CORS header — never `*`. Both return 404 on hosted.

## Where each snippet is
`templates/security/validate.ts`, `rate-limit.ts`, `session.ts`, `crypto.ts`, `require-auth.ts`, `vercel.json` (headers). Copy into `app/lib/security/` and adapt.

## Rate limiting and bots
1. In app code: in-memory limiter in `app/lib/security.ts` (per-IP, per-route). `/api/chat` and `/api/llmcall` also call the Workers `API_RATE_LIMITER` binding when present.
2. Public Cloudflare deploy: see [DEPLOY.md](DEPLOY.md) for the dashboard WAF rate-limit rule (Pages Functions do not document the Rate Limiting binding).
3. Optional: Cloudflare Turnstile on any expensive endpoint.

## Set the GitHub guardrails (run once, needs `gh auth login`)
```bash
bash scripts/github-guardrails.sh <owner>/<repo>
```
Turns on secret scanning, push protection, and Dependabot alerts. Protect `main` with a ruleset (solo maintainer: no required reviews, so you are not locked out):

1. Repo → **Settings**. If the tab is hidden, open the **···** menu, then **Settings**.
2. Left sidebar, under **Code, planning, and automation**, click **Rulesets**, then **Rulesets**.
3. **New ruleset** → **New branch ruleset**. Name: `main`. Enforcement: **Active**.
4. **Target branches** → **Add a target** → **Include default branch**.
5. Under **Branch protections**, enable:
   - **Block force pushes**
   - **Restrict deletions**
   - **Require status checks to pass before merging** → add `build`, `e2e`, `secrets` (the CI job names). Do **not** require “Require a pull request before merging” with approving reviews — a solo maintainer would need a bypass for every push.
6. **Bypass list**: add only your user (so you can still push a hotfix if CI is broken). Leave everyone else subject to the rules.
7. **Create**.

Do **not** enable **Require signed commits** unless you already sign every local commit. Do **not** require **linear history** unless you already rebase.

Private vulnerability reporting (needed for `security.txt`):

1. Repo → **Settings**.
2. Left sidebar, under **Security and quality**, click **Advanced Security**.
3. Next to **Private vulnerability reporting**, click **Enable**.

## Env vars on the Worker
Production is Cloudflare (`docs/DEPLOY.md`), not Vercel. `wrangler.jsonc` defines **no secrets**. Bindings/vars:

| Name | Kind | Purpose |
|---|---|---|
| `API_RATE_LIMITER` | Rate Limiting binding | `/api/chat` and `/api/llmcall`. Keyed on `CF-Connecting-IP` (not `X-Forwarded-For`). Missing binding → in-memory limiter only. Public host without `CF-Connecting-IP` fail-closes. |
| `HYPEABLE_HOSTED` | Optional dashboard var `1` | Defence in depth; a public Host already fail-closes. |
| `WORKERS_CI_COMMIT_SHA` | Set by Workers Builds | `/api/health` `commit`. Not a secret. |
| `NODE_VERSION` | Build var `22` | Toolchain. |

Do **not** add `OPENAI_API_KEY`, connector tokens, `SESSION_SECRET`, or `ENCRYPTION_KEY`. Hosted code ignores operator `*_API_KEY` / `GITHUB_TOKEN` even if they appear. `worker-configuration.d.ts` still types leftover bolt.diy key names for local self-host; they are not in `wrangler.jsonc`.

Cloudflare Web Analytics (`static.cloudflareinsights.com/beacon.min.js`) is **not** in our HTML. The zone can still inject it. HTML responses set `Cache-Control: no-store, no-transform` to block that rewrite. Also turn it off: account dashboard → **Analytics & logs** → **Web Analytics** → **Manage site** on `hypeable.dev` → **Disable**.

## Purging secrets from git history
**Step 0, always: rotate the key.** Anyone could have copied it already. Deleting it from history does not un-leak it.
```bash
pip install git-filter-repo
git clone --mirror git@github.com:<owner>/<repo>.git && cd <repo>.git
printf 'REAL_SECRET_VALUE==>***REMOVED***\n' > ../replacements.txt   # do not commit this file
git filter-repo --replace-text ../replacements.txt
git push --force --all && git push --force --tags
```
Then ask GitHub Support to purge cached views if the repo was public, and tell collaborators to re-clone.

## Remaining Dependabot alerts
After dropping Electron, unused MkDocs/`docs/poetry.lock`, and pinning `fast-uri@3.1.9`, npm production audit is one low finding.

| Package | Ships in prod bundle? | Action |
|---|---|---|
| `elliptic` 6.6.1 (low) | Yes — client, via `vite-plugin-node-polyfills` → `crypto-browserify` for WebContainer Node shims. | No real patch (`<0.0.0`). Keep until the polyfill stack replaces it. |
