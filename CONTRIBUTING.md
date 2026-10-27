# Contributing

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

1. Fork, then `pnpm install` (Husky activates `.husky/` secret-scan, lint-staged, pre-push typecheck, and commit-message hooks) and `npm run setup` (creates `.env.local` if missing and runs a full secret scan). Do not set `core.hooksPath`; Husky owns it.
2. Branch: `feat/<thing>` or `fix/<thing>`.
3. Commit locally with `npm run ship -- "feat(meter): add daily cap"`. Secret scan always runs. Typecheck runs on push (`npm run finish` at the end of a task). Conventional Commits: `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `security`.
4. Locally run `npm run test:related` on the files you touched. `pnpm typecheck` is incremental. Full unit tests, lint of the tree, build, and e2e run in CI. Run `pnpm e2e` locally only when you touch `app/routes`, the chat flow, or the shell UI.
5. Open a PR using the template. Explain the *why*.

## Fixing prices

`app/lib/cost/prices.json` is community-maintained list prices (dollars per 1M tokens). The meter uses it when the provider does not report a billed cost.

Each PR that changes a row must:

1. Link the official pricing page for that provider in the PR (and keep the row's `source` URL in sync). Example: [Groq pricing](https://groq.com/pricing).
2. Set `checkedAt` on the catalog to the date you verified the numbers (`YYYY-MM-DD`).
3. Set `verified: true` only when the figure is on that official page. Use `verified: false` for best-effort / inferred rows — the UI will show them as estimates (`≈`).

Do not invent prices. If you cannot find an official figure, leave the model out (the UI will ask the user to set a custom price) or mark it unverified.

## Never commit secrets
Hooks and CI block them. If a real key ever lands in git, rotate it first, then see docs/SECURITY.md "Purging secrets".
