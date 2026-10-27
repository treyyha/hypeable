# Security Policy

Hypeable is bring-your-own-key. Generated apps publish to your own Vercel/GitHub, not ours. Hosted model requests relay through our Cloudflare Worker.

## Reporting a vulnerability
Please do **not** open a public issue. Use GitHub's private reporting: **Security tab -> Report a vulnerability**. We aim to reply within 72 hours.

## Design principles
- Model keys and connector tokens (GitHub, GitLab, Vercel, Netlify, Supabase) are stored in your browser. Hosted requests relay through our Cloudflare Worker; we do not store or log prompts, keys or code, and observability is off. Verify LLM keys in [`app/routes/api.chat.ts`](app/routes/api.chat.ts) and connectors in [`app/lib/api/connector-tokens.ts`](app/lib/api/connector-tokens.ts). Run locally to skip the relay: `pnpm dev`.
- We do not persist keys. Logs run through `app/lib/security/redact.ts`. Cloudflare still handles request metadata and sees traffic in transit.
- Apps you generate are published to **your** Vercel/GitHub, not ours.
- Secrets are blocked from commits by `.husky/pre-commit` (`node scripts/secret-scan.mjs`), CI gitleaks, and GitHub push protection.

Full details: [docs/SECURITY.md](docs/SECURITY.md).

## Supported versions
`1.0.x` and the latest `main` are supported.
