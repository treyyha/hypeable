# Security Policy

Hypeable is bring-your-own-key and hosts no user apps. That shrinks the attack surface on purpose.

## Reporting a vulnerability
Please do **not** open a public issue. Use GitHub's private reporting: **Security tab -> Report a vulnerability**. We aim to reply within 72 hours.

## Design principles
- API keys stay in your browser and go only to the model provider you chose.
- Hypeable servers never store, log, or proxy-persist keys.
- Apps you generate are published to **your** Vercel/GitHub, not ours.
- Secrets are blocked from commits by a local hook, CI scan (gitleaks), and GitHub push protection.

Full details: [docs/SECURITY.md](docs/SECURITY.md).

## Supported versions
Only the latest `main` is supported before v1.0.
