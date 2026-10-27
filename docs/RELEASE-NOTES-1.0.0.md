# Hypeable 1.0.0

**worth the hype.** A free, open-source AI app builder. You bring your own API key. No accounts and no Hypeable-owned database.

This is the first numbered public release of the [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) (MIT) fork. Try it at [hypeable.dev](https://hypeable.dev).

Not affiliated with Lovable, Bolt, or StackBlitz.

## What is in it

1. **Live cost meter** — header pill is an **estimate** of session spend (tokens × list price, or a provider-reported cost when one exists). Session and daily caps with a hard stop. Accuracy against provider billing is not yet independently verified; see [docs/COST-ACCURACY.md](COST-ACCURACY.md).
2. **Loop breaker** — stop after 3 repeated identical errors, then replan, revert, switch model, or continue.
3. **Plan-first mode** — show a plan (pages, data, features, dollar estimate range), you approve, then it builds.
4. **Pre-deploy security check** — scan generated files in this browser (and again on the Vercel/Netlify proxy) for exposed keys, open CORS, missing DB rules, debug flags.
5. **Spend page** (`/spend`) — today, session, month-to-date, and recent builds from this browser only.

Also: OpenRouter Connect (PKCE, you pay them directly), hosted-mode locks so the public site cannot use custom endpoints or operator env keys, cookie diet (drafts and logs stay in `localStorage`).

## Known limits

- **Publish connectors are experimental.** GitHub, GitLab, Vercel, Netlify, and Supabase talk to **your** account with **your** token. There is no live end-to-end deploy in CI.
- **Cost figures are estimates, not invoices.** Set a limit on your provider too.
- **WebContainers licence.** StackBlitz WebContainers is free for personal and open-source use. Commercial hosted use needs a StackBlitz license.
- **Browser support.** The in-browser preview needs Chromium (Chrome, Edge) with cross-origin isolation. Firefox is alpha and Safari is beta for WebContainers.

## Bugs and security

- Bugs: [github.com/treyyha/hypeable/issues](https://github.com/treyyha/hypeable/issues)
- Vulnerabilities: **do not** open a public issue. Use [GitHub private reporting](https://github.com/treyyha/hypeable/security/advisories/new) (`https://hypeable.dev/.well-known/security.txt`).

## Credits

- [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) (MIT) — the base this fork started from. See [LICENSE](../LICENSE) and [NOTICE.md](../NOTICE.md).
- [KokonutUI](https://github.com/kokonut-labs/kokonutui) (MIT) — layout patterns ported into `app/components/ui/` and the Spend page, restyled to Hypeable tokens.
