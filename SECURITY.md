# Security Policy

Hypeable is bring-your-own-key and hosts no user apps. That shrinks the attack surface on purpose.

## Reporting a vulnerability
Please do **not** open a public issue. Use GitHub's private reporting: **Security tab -> Report a vulnerability**. We aim to reply within 72 hours.

## Design principles
- Stored in your browser. Sent over HTTPS to this app's server for each request, used once for that request to your provider, never stored or logged. Verify it in [`app/routes/api.chat.ts`](app/routes/api.chat.ts). Want zero trust? Run Hypeable locally: `pnpm dev`.
- Hypeable servers never store or persist keys. Logs run through `app/lib/security/redact.ts`.
- Apps you generate are published to **your** Vercel/GitHub, not ours.
- Secrets are blocked from commits by `.husky/pre-commit` (`node scripts/secret-scan.mjs`), CI gitleaks, and GitHub push protection.

Full details: [docs/SECURITY.md](docs/SECURITY.md).

## Supported versions
Only the latest `main` is supported before v1.0.
