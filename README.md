# Hypeable

![Hypeable home, dark](docs/assets/home-dark-1440.png)

![Hypeable home, light](docs/assets/home-light-1440.png)

![Hypeable spend, dark](docs/assets/spend-dark-1440.png)

**Worth the hype.** A free, open-source AI app builder. Describe an app, watch it get built, publish it to your own Vercel or GitHub. The empty home is a heading, one composer, four starters, and a live cost pill — model, key, and extra actions stay one click away.

> Not affiliated with Lovable, Bolt, or StackBlitz. Built on [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) (MIT).

## Live cost meter

The header pill is session spend in dollars. Click it for today, per-model totals, and cap progress. Caps default to $2/session and $10/day (`0` = off). They are enforced in this browser; set a limit on your provider too. The **Spend** page (`/spend`, also in the sidebar with New build / Search) shows today, session, month-to-date, a 7-day chart, per-model share, recent builds, and cap progress from this browser only. Empty browsers show the empty state — demo rows exist only in e2e fixtures.

Unknown models show tokens plus a prompt to set a price in Settings. Copy receipt produces a shareable line such as `Built with Hypeable: $0.42 | 38k tokens | claude-x, gpt-y | hypeable.dev`.

Details: [docs/COST-METER.md](docs/COST-METER.md).

## Loop breaker

If the same error (or the same file rewrite) repeats 3 times, Hypeable stops the run — same as hitting Stop — and shows a panel: the error, how many times it failed, and what the loop cost. Replan, revert to before the loop, switch to a stronger model you already have a key for, or keep going. Off by a setting; threshold 2–5. Local only.

Details: [docs/LOOP-BREAKER.md](docs/LOOP-BREAKER.md).

## Plan-first mode

On by default. The first build in an empty workspace (or every request, if you turn that on) returns a plan card — pages, data, features you can tick, and a dollar **estimate** range — before any code is written. Approve, ask for changes, or skip. Loop-breaker **Replan** uses the same flow.

Details: [docs/PLAN-MODE.md](docs/PLAN-MODE.md).

## Pre-deploy security check

Before you publish a generated app to your own Vercel, Netlify, GitHub, or GitLab, Hypeable scans the files in this browser and shows a pass / warn / fail report. Secrets are masked (`sk-a***`). Failures need an explicit “I understand the risk” check. Nothing leaves the machine.

![Pre-deploy check, dark](docs/assets/predeploy-fail-dark-1440.png)

Details: [docs/PREDEPLOY-CHECK.md](docs/PREDEPLOY-CHECK.md).

## Why Hypeable
| Problem with typical AI builders | What Hypeable does |
|---|---|
| Surprise bills, you only find out after | **Live cost meter** in dollars, with session and daily caps and a hard stop |
| The AI loops on the same error and burns credits | **Loop breaker** stops after 3 repeats and offers replan / revert / switch model |
| It starts coding before agreeing on what to build | **Plan-first mode**, you approve the plan first |
| Apps ship with exposed keys and open databases | **Pre-deploy security check** |
| Lock-in and hosting | You bring your key and publish to **your own** Vercel/GitHub |

## Status
Early. Built in public. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Quick start
```bash
git clone https://github.com/treyyha/hypeable && cd hypeable
pnpm install         # Husky: secret-scan + lint-staged on commit, typecheck on push
npm run setup        # creates .env.local if missing, runs a full secret scan
npm run dev
```
Add your own model key in the app's settings. Stored in your browser. Sent over HTTPS for the request, never stored or logged. The same is true of GitHub, GitLab, Vercel, Netlify, and Supabase tokens. Verify LLM keys in [`app/routes/api.chat.ts`](app/routes/api.chat.ts) and connectors in [`app/lib/api/connector-tokens.ts`](app/lib/api/connector-tokens.ts). Want zero trust? Run Hypeable locally: `pnpm dev`.

## Run locally
Hypeable's server sees your key for the duration of each LLM request so it can forward the call to your provider. If you do not want that hop, run the app on your machine:

```bash
git clone https://github.com/treyyha/hypeable && cd hypeable
pnpm install
pnpm dev
```

Then open the printed local URL (typically `http://localhost:5173`). Keys stay on your computer; the only network call with the key is from your local process to the model provider you chose.

The public site at [hypeable.dev](https://hypeable.dev) sets `HYPEABLE_HOSTED=1`: custom endpoints (Ollama, LM Studio, OpenAI-compatible URLs) are disabled. Run locally for those. Deploy: [docs/DEPLOY.md](docs/DEPLOY.md).

## Testing
Related unit tests: `npm run test:related`. Full suite: `pnpm test` (CI). To prove the workerd dev server without a real provider key, run `pnpm exec playwright install chromium` then `pnpm e2e` (starts a local OpenAI-compatible mock). Hosted-mode smoke: `pnpm e2e:hosted`. Commit locally with `npm run ship -- "type(scope): summary"`; push and watch CI once with `npm run finish`. Details: [docs/TESTING.md](docs/TESTING.md).

## Contributing
Read [CONTRIBUTING.md](CONTRIBUTING.md). Commits follow [Conventional Commits](https://www.conventionalcommits.org).

## Security
See [SECURITY.md](SECURITY.md) and [docs/SECURITY.md](docs/SECURITY.md).

## License
MIT. Base code from bolt.diy is MIT as well; see [NOTICE.md](NOTICE.md).
> Note: StackBlitz WebContainers is free for personal/open-source use. Commercial hosted use needs a StackBlitz license.
