# Security guide

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
| XSS / clickjacking | HTML/static: CSP-Report-Only, COOP/COEP, Permissions-Policy; `/api/*`: nosniff + Referrer-Policy + `Cache-Control: no-store` (no document CSP on JSON) |
| Supply chain | Dependabot, lockfile, CI audit. Remaining open alert: `elliptic` (low, client polyfill, no patch). |
| Generated apps shipping secrets | pre-deploy scanner ([PREDEPLOY-CHECK.md](PREDEPLOY-CHECK.md)); shared patterns in `app/lib/security/secret-patterns.json` |

## Response headers

| Surface | Headers |
|---|---|
| HTML (`app/entry.server.tsx`) | COOP `same-origin`, COEP `credentialless`, `X-Content-Type-Options: nosniff`, Referrer-Policy `strict-origin-when-cross-origin`, Permissions-Policy `camera=(), microphone=(), geolocation=(), payment=(), usb=()`, CSP-Report-Only |
| Static assets (`public/_headers`) | Same as HTML |
| `/api/*` (`workers/app.ts`) | `X-Content-Type-Options: nosniff`, Referrer-Policy `strict-origin-when-cross-origin`, `Cache-Control: no-store`. No COOP, COEP, CSP, or Permissions-Policy. Existing stricter Cache-Control / Referrer-Policy on a route is kept. Body is passed through (not buffered) so chat/SSE still streams. |

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
Turns on secret scanning, push protection, Dependabot alerts, and protects `main`.

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

## Env vars on Vercel
Add secrets in Project -> Settings -> Environment Variables (never in git). Mark as Sensitive.

## Remaining Dependabot alerts
After dropping Electron, unused MkDocs/`docs/poetry.lock`, and pinning `fast-uri@3.1.9`, npm production audit is one low finding.

| Package | Ships in prod bundle? | Action |
|---|---|---|
| `elliptic` 6.6.1 (low) | Yes — client, via `vite-plugin-node-polyfills` → `crypto-browserify` for WebContainer Node shims. | No real patch (`<0.0.0`). Keep until the polyfill stack replaces it. |
