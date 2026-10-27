# Security Policy

Hypeable is bring-your-own-key and hosts no user apps. That shrinks the attack surface on purpose.

## Reporting a vulnerability
Please do **not** open a public issue. Use GitHub's private reporting: **Security tab -> Report a vulnerability**. We aim to reply within 72 hours.

## Design principles
- Model keys and connector tokens (GitHub, GitLab, Vercel, Netlify, Supabase) are stored in your browser. Sent over HTTPS for the request, never stored or logged. Verify LLM keys in [`app/routes/api.chat.ts`](app/routes/api.chat.ts) and connectors in [`app/lib/api/connector-tokens.ts`](app/lib/api/connector-tokens.ts). Want zero trust? Run Hypeable locally: `pnpm dev`.
- Hypeable servers never store or persist keys. Logs run through `app/lib/security/redact.ts`.
- Apps you generate are published to **your** Vercel/GitHub, not ours.
- Secrets are blocked from commits by `.husky/pre-commit` (`node scripts/secret-scan.mjs`), CI gitleaks, and GitHub push protection.

Full details: [docs/SECURITY.md](docs/SECURITY.md).

## Supported versions
`1.0.x` and the latest `main` are supported.
