# Security guide

## Threat model (short)
| Threat | Mitigation |
|---|---|
| Key leaks to GitHub | `.gitignore`, pre-commit scan, CI gitleaks, GitHub push protection |
| Key leaks via our server | BYO key, never stored/logged; log redaction |
| Abuse of any server route | rate limit + bot protection + origin check |
| Field tampering (`role`, `price`, `userId`) | zod `.strict()` schemas; identity from session only |
| Session theft | HttpOnly + Secure + SameSite cookie, short lifetime, rotation |
| Missing auth | check inside every server handler |
| XSS / clickjacking | CSP, X-Frame-Options, no inline eval |
| Supply chain | Dependabot, lockfile, CI audit |
| Generated apps shipping secrets | pre-deploy scanner |

## Where each snippet is
`templates/security/validate.ts`, `rate-limit.ts`, `session.ts`, `crypto.ts`, `require-auth.ts`, `vercel.json` (headers). Copy into `app/lib/security/` and adapt.

## Rate limiting and bots (Vercel)
1. In app code use `rate-limit.ts` (per-IP, per-route).
2. In the Vercel dashboard: Project -> Firewall -> add rate-limit rules for `/api/*`; enable **Bot Protection** / Attack Challenge Mode when attacked.
3. Optional: Cloudflare Turnstile on sign-up and any expensive endpoint.

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
