# Public data-flow claims

Canonical wording (adapt only for length):

> No accounts and no database. In hosted mode, requests are relayed through our Cloudflare Worker to the provider you choose; we do not store or log prompts, keys or code, and observability is off. Run Hypeable locally to skip our relay. Your provider's own data policy applies to what you send them.

Known limits we state plainly:

- Cloudflare, as our host, handles request metadata and sees traffic in transit.
- After the first build, the in-browser runtime (WebContainer) and preview frames load from StackBlitz-hosted domains. We have **not** audited what StackBlitz sees.
- Web search (user or model) sends the search text from our Worker to DuckDuckGo (`html.duckduckgo.com`). Hosted mode refuses arbitrary page fetches.
- Opening Settings → Plugins fetches the public plugin catalogue from GitHub (`api.github.com`, `raw.githubusercontent.com`) directly from the browser. No key or project data is sent.

Constants: `app/utils/privacy-copy.ts`. Banned overclaims: `docs/banned-privacy-phrases.json`. The unit test `app/lib/security/privacy-claims.spec.ts` walks README, `SECURITY.md`, `AGENTS.md`, `CHANGELOG.md`, `public/llms.txt`, `docs/`, and `app/` and fails if a banned phrase returns. This file is excluded from that walk so the table can quote retired wording.

| Surface | Exact wording now | Evidence | Status |
|---|---|---|---|
| Canonical constant | `PRIVACY_CLAIM` in `app/utils/privacy-copy.ts` | `app/utils/privacy-copy.spec.ts` | proven |
| `/privacy` | Full canonical claim, plus Cloudflare metadata, unaudited StackBlitz, `WEB_SEARCH_CLAIM` (DuckDuckGo), `PLUGIN_CATALOG_CLAIM` (GitHub), leftover cookie names | `app/routes/privacy.tsx`; `e2e/legal.spec.ts`; `tests/security/web-search.spec.ts` | proven |
| `/terms` | Provider data policy applies; link to `/privacy` | `app/routes/terms.tsx`; `e2e/legal.spec.ts` | proven |
| Home onboarding card | `PRIVACY_OPENROUTER` | `app/components/onboarding/StartInSixty.tsx` | proven |
| Connect with OpenRouter (settings) | `PRIVACY_OPENROUTER` | `app/components/onboarding/OpenRouterConnection.tsx` | proven |
| API key explainer | `PRIVACY_KEY_HINT` | `app/components/chat/APIKeyManager.tsx` | proven |
| Cloud providers tab | `PRIVACY_KEY_HINT` | `app/components/@settings/tabs/providers/cloud/CloudProvidersTab.tsx` | proven |
| Connector token hint | `PRIVACY_CONNECTOR_HINT` (GitHub/GitLab CORS vs Worker hop) | `app/components/ui/ConnectorTokenHint.tsx` | proven |
| Home hero | "worth the hype. Bring a key. Watch the cost." — no data-flow claim | `app/components/home/HomeHero.tsx` | proven (no overclaim) |
| Meta / OG / Twitter / webmanifest | `APP_DESCRIPTION` = "worth the hype. A free, open-source AI app builder." — no data-flow claim | `app/utils/brand.ts`, `app/utils/brand.spec.ts`, `public/site.webmanifest` | proven (no overclaim) |
| README intro | No accounts, no Hypeable-owned database, no Hypeable-owned deploy target | `README.md` | softened |
| README Connect / key travel | Canonical claim + Cloudflare metadata + unaudited StackBlitz; GitHub/GitLab CORS vs Worker hop | `README.md`; `docs/KEY-FLOW.md` | proven |
| `public/llms.txt` | Canonical claim + Cloudflare + StackBlitz | `public/llms.txt` | proven |
| `docs/KEY-FLOW.md` | Canonical claim at top; OpenRouter PKCE stays browser→OpenRouter; hosted model calls still relay | `docs/KEY-FLOW.md`; `e2e/openrouter-connect.spec.ts`; `app/lib/openrouter/connect.ts` | proven |
| `docs/SECURITY.md` / `SECURITY.md` | Browser storage; Worker relay; we do not store or log; observability off | `docs/SECURITY.md`; `SECURITY.md`; `wrangler.jsonc` `observability.enabled: false`; `app/lib/security/redact.ts` | proven |
| `docs/THREAT-MODEL.md` | Canonical claim; Cloudflare metadata; unaudited StackBlitz | `docs/THREAT-MODEL.md` | proven |
| `docs/DEPLOY.md` | Stateless Worker; we do not store or log; observability off; StackBlitz unaudited | `docs/DEPLOY.md`; `wrangler.jsonc` | proven |
| `docs/ARCHITECTURE.md` | Worker is a relay, not a store | `docs/ARCHITECTURE.md` | softened |
| `AGENTS.md` / `.cursorrules` | Key stored in browser; hosted relay through Worker | `AGENTS.md` | softened |
| CHANGELOG 0.1.0 / release notes | Retired "hosts nothing" | `CHANGELOG.md`; `docs/RELEASE-NOTES-1.0.0.md` | softened |
| Old "never leaves your browser" | Removed | banned-phrase test | removed |
| Old "stores nothing" / "hosts nothing" | Removed | banned-phrase test | removed |
| Old "straight to the provider" / "go only to the provider" | Removed (GitHub/GitLab now "browser to GitHub/GitLab (CORS)") | banned-phrase test; `docs/KEY-FLOW.md` | removed |
| Unqualified "private" as a product promise | Not used | banned-phrase test does not match the word "private" alone (private reporting, private IPs, private repos stay) | proven |

Observability off is the production `wrangler.jsonc` setting, not a runtime test that the Cloudflare account dashboard stayed untouched. `npx wrangler tail` can still see request metadata if someone turns it on — `docs/DEPLOY.md` says not to leave it running.
