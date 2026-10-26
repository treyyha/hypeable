# AGENTS.md: rules for AI coding agents (Cursor, Claude Code, Codex)

Hypeable is a free, open-source AI app builder. Tagline: **worth the hype.**
Base: fork of bolt.diy (MIT). Users bring their own API key. Hypeable hosts nothing.

## Non-negotiables
1. **Never write a real secret into any file.** Keys, tokens, passwords go in `.env.local` (git-ignored) and are read via `process.env`. Use `.env.example` for names only.
2. **BYO key never leaves the user's browser** except in the single request to their chosen model provider. No server stores it. No logs print it. Redact `Authorization`, `x-api-key`, and anything matching `sk-`.
3. **Validate every server input with zod `.strict()`.** Never trust client-sent fields like `userId`, `role`, `price`, `plan`. Derive them server-side from the session.
4. **Auth is enforced on the server**, in the route/loader/action. UI hiding is not security.
5. **Conventional commits**: `type(scope): summary`. Types: feat fix docs style refactor perf test build ci chore security.
6. Small commits, one idea each. Explain the *why* in the body.
7. Locally run `npm run test:related` on the files you touched. Full typecheck runs on push. Full unit suite, lint of the tree, build, and e2e run in CI. Run e2e locally only when touching `app/routes`, the chat flow, or the shell UI.
8. Do not add telemetry, trackers, or any network call to a domain we do not own, besides the user's chosen model provider and their own Vercel/GitHub.

## Product pillars (build in this order)
1. Live cost meter: tokens x model price, session and daily caps, hard stop.
2. Loop breaker: stop after 3 repeated identical errors, offer replan / revert / switch model.
3. Plan-first mode: show a plan, user approves, then build.
4. Pre-deploy security check: exposed keys, missing DB access rules, open CORS, debug flags.
5. One-click publish to the user's own Vercel/GitHub.

## Style
- TypeScript strict. No `any` without a comment explaining why.
- Comments explain *why*, not *what*. Public modules get a short header comment.
- Prefer small pure functions with tests (vitest).
- Brand: do not imitate any other product's logo, colours, or copy. Footer: "Not affiliated with Lovable, Bolt, or StackBlitz."

## Repo map
Read `docs/ORIENTATION.md` only if needed. Prefer targeted reads of the files below. Do not re-read files already in context.

| Feature | Where it lives |
|---|---|
| Cost meter | `app/lib/cost/` (`calc.ts`, `caps.ts`, `prices.json`), `app/lib/stores/cost.ts`, `app/components/cost/`, `docs/COST-METER.md` |
| Spend page | `app/routes/spend.tsx`, `app/components/spend/`, `app/lib/cost/ledger.ts`, `app/lib/stores/ledger.ts` |
| Loop breaker | `app/lib/loop/`, `app/lib/stores/loop.ts`, `app/lib/hooks/useLoopBreaker.ts`, `app/components/loop/`, `docs/LOOP-BREAKER.md` |
| Plan-first | `app/lib/plan/`, `app/lib/stores/plan.ts`, `app/components/plan/` (`PlanCard.tsx`, `PlanFirstChip.tsx`, `PlanSettings.tsx`), `docs/PLAN-MODE.md` |
| Pre-deploy check | `app/lib/predeploy/`, `app/lib/stores/predeploy.ts`, `app/components/predeploy/`, `app/lib/security/secret-patterns.json`, `docs/PREDEPLOY-CHECK.md` |
| Keys / security | `app/lib/api/api-key-storage.ts`, `app/lib/openrouter/` (PKCE connect), `app/lib/api/request-keys.ts`, `app/lib/security/` (`hosted.ts`, `outbound.ts`, `headers.ts`), `templates/security/`, `scripts/secret-scan.mjs`, `docs/SECURITY.md`, `docs/KEY-FLOW.md`, `docs/DEPLOY.md` |
| Routes | `app/routes.ts` (URL table), `app/routes/` (page + `/api/*` modules), `app/root.tsx`, `app/entry.server.tsx` |
| Stores | `app/lib/stores/` (`cost.ts`, `loop.ts`, `plan.ts`, `theme.ts`, `workbench.ts`, `settings.ts`, connector stores) |
| Components | `app/components/chat/` (composer + messages), `app/components/header/`, `app/components/home/`, `app/components/workbench/`, `app/components/ui/`, `app/components/@settings/` |
| Scripts | `scripts/secret-scan.mjs`, `scripts/ship.mjs`, `scripts/finish.mjs`, `scripts/typecheck.mjs`, `scripts/test-related.mjs`, `scripts/ci-docs-only.mjs` |
| Docs | `docs/*.md` (product). Upstream mkdocs copies sit in `docs/docs/` — do not treat those as source of truth. |
| E2E | `e2e/smoke.spec.ts`, `e2e/hosted.spec.ts` (`pnpm e2e:hosted`), `e2e/openrouter-connect.spec.ts`, `e2e/docs-screenshots.spec.ts`, `playwright.config.ts`. Local mocks: `scripts/dev/mock-openai.mjs`, `scripts/dev/mock-openrouter.mjs`. |

## Command cheat sheet
Times are local (Windows) after this speed pass. CI still runs gitleaks, typecheck, lint, unit tests, build, and e2e.

| Command | What | Typical |
|---|---|---|
| `npm run ship -- "type(scope): summary"` | Secret scan + commit locally (hooks: scan + lint-staged). No push. | ~12s |
| `npm run finish` | `git pull --rebase`, push, `gh run watch` **once** | typecheck on pre-push (~12s incremental), then CI |
| `pnpm typecheck` | Incremental `tsc` (`node_modules/.cache/tsconfig.tsbuildinfo`) | ~35s first, ~12s later |
| `pnpm lint` | eslint `--cache` on `app/` | ~43s cold, ~5s cached |
| `npm run test:related` | Vitest related mode on files changed vs HEAD | seconds on a small diff |
| `pnpm test` | Full unit suite. CI only, unless you need the whole picture. | ~33s |
| `pnpm build` | Production build | ~34s |
| `pnpm e2e` | Playwright smoke. Locally only if you touched routes, chat, or shell UI. | ~60s |
| `npm run smoke:live -- <url> [--expect-commit <sha>]` | Live deploy checks. With `--expect-commit`, poll `/api/health` up to 5 minutes until `commit` matches, then run the rest. | |

## Git hooks
Husky (`.husky/`) is the only hook system. `pnpm install` sets `core.hooksPath` to `.husky/_`. Do not set `core.hooksPath` yourself.
- `.husky/pre-commit` — `node scripts/secret-scan.mjs` first, then lint-staged (eslint on **staged** files only). No full typecheck on commit.
- `.husky/pre-push` — full typecheck once per push.
- `.husky/commit-msg` — Conventional Commits (`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `security`; Merge/Revert/fixup/squash allowed).
