# Threat model

Short and honest. Hypeable is a **browser app** plus a **stateless Cloudflare Worker**. Users bring their own model key. No accounts and no database. In hosted mode, requests are relayed through our Cloudflare Worker to the provider you choose; we do not store or log prompts, keys or code, and observability is off. Run Hypeable locally to skip our relay. Your provider's own data policy applies to what you send them.

## Assets

| Asset | Where it lives |
|---|---|
| Model API keys | `localStorage` / `sessionStorage` in the user's browser (`hypeable_api_keys`). Sent to our Worker only on LLM routes, in `x-hypeable-key`, then onward to the chosen provider. |
| Connector tokens (GitHub, GitLab, Vercel, Netlify, Supabase) | Browser storage. GitHub/GitLab publish go browser→provider. Vercel/Netlify take a one-shot hop through the Worker so we can scan files. |
| Chat, files, spend ledger, plan, caps | This browser (IndexedDB / localStorage). |
| Generated preview | WebContainer on `*.local-credentialless.webcontainer-api.io` — a **different origin** from `hypeable.dev`. After the first build, the runtime and preview frames load from StackBlitz-hosted domains. We have not audited what StackBlitz sees. |
| Operator secrets on `hypeable.dev` | None in `wrangler.jsonc`. The only production binding is `API_RATE_LIMITER`. Hosted code ignores operator `*_API_KEY` / `GITHUB_TOKEN` env vars even if someone set them in the dashboard. |

## Who can attack what

| Attacker | What they can try | What we do |
|---|---|---|
| Random internet vs the Worker | SSRF via git-proxy / chat / llmcall; abuse; CORS; origin forgery | Host allowlists, no redirects without re-check, same-origin CORS on hosted, `Origin` check on mutating methods, CF-Connecting-IP rate limit, body size + zod `.strict()` |
| XSS on `hypeable.dev` | Steal keys from web storage, act as the user | Enforcing CSP, sanitised markdown, escaped HTML sinks, preview `postMessage` origin checks. `unsafe-inline` / `unsafe-eval` remain because of root scripts and WebContainer — see [SECURITY.md](SECURITY.md). |
| Malicious generated app | Read `hypeable.dev` storage, phish | Preview is cross-origin. A generated app cannot read our `localStorage`. Pre-deploy scan before publish. |
| Malicious model output | Script in markdown, `PLAN.md`, diffs, file names, toasts | Render paths are sanitised or text; we do not use `rehype-raw` without `rehype-sanitize`. |
| Compromised npm / GitHub Action | Ship malware in CI or the bundle | Lockfile, Dependabot (npm + github-actions), Actions pinned to SHAs, gitleaks, `secret-scan.mjs --dir build` on client and server bundles. |
| Cloudflare dashboard / Workers Builds | Add a secret, turn on logs, inject Web Analytics, attach a custom domain | Production `observability` is off. HTML sends `Cache-Control: no-transform` so the edge cannot inject `beacon.min.js`. Still disable Web Analytics in the account dashboard. Do not add API keys. `npx wrangler tail` can still see request metadata — do not leave it running. |

## What we do not protect against

- A **malicious or compromised browser extension** with access to `hypeable.dev` (it can read `localStorage`).
- A **compromised user machine**, shared computer, or unlocked stolen laptop.
- The user **pasting a key into the generated app** or a site that is not Hypeable.
- **Provider-side** theft (OpenAI, OpenRouter, GitHub, …). Set caps there too. Their data policy applies to what you send them.
- **Cloudflare** request metadata and traffic in transit (IP, User-Agent, URL, and the TLS hop). We do not persist that; Cloudflare still handles it as our host.
- **StackBlitz WebContainer** traffic after the first build. We have not audited what StackBlitz sees.
- **DNS rebinding** of an allowlisted hostname to a private IP. Workers follow DNS; we cannot pin resolved addresses.
- **Physical access** to DevTools on an already-unlocked session.

Report vulnerabilities privately: [GitHub security advisories](https://github.com/treyyha/hypeable/security/advisories/new). See `https://hypeable.dev/.well-known/security.txt`.
