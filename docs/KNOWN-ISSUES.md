# Known issues

## Policy

Do not add known-failing tests. Unit tests and Playwright e2e are blocking in CI. Wall-clock performance tests run in a separate non-blocking `perf` job — they are not quarantined skips.

## Wall-clock performance (non-blocking CI)

`tests/performance/*.perf.test.*` assert a 16.67 ms (60 fps) `render()` budget in jsdom, or a Shiki `codeToHtml()` wall-clock budget. jsdom is not a browser frame, and `createHighlighter()` varies with CI load. A miss is not a product regression.

They are excluded from `pnpm test` and run as `pnpm test:perf` (`.github/workflows/ci.yml` job `perf`, `continue-on-error: true`).

| File | What it measures |
|---|---|
| `tests/performance/core-journeys.perf.test.tsx` | streaming message updates vs frame budget |
| `tests/performance/streaming-performance.perf.test.tsx` | simple text, code-block, and mixed-content streaming vs frame budget |
| `tests/performance/syntax-highlighting.perf.test.ts` | Shiki small/large/incremental highlight budgets |
| `tests/performance/chat-input.perf.test.ts` | composer input timing |
| `tests/performance/chat-body-cpu.perf.test.ts` | `/api/chat` parse + validate CPU near the 2 MiB cap |
| `tests/performance/heap-builds.perf.test.ts` | 30 min mocked-build heap slope (`docs/heap-mocked-builds.json`) |

Deterministic unit coverage of the same monitors stays blocking: `tests/unit/frame-rate-monitor.test.ts` (fake timers), `tests/unit/performance-monitor.test.ts`.

## Docs screenshots (opt-in)

`e2e/docs-screenshots.spec.ts` and `e2e/docs-demos.spec.ts` are skipped unless `CAPTURE_DOCS=1`. They are capture helpers, not product tests. `pnpm e2e` still runs smoke, spend, predeploy, OpenRouter connect, and home presentation. Demo clips in `docs/assets/demo-*.webp` are recorded against the mock provider; README captions say so.

## Started chat on narrow screens

Below 1024px the started chat uses a Chat | Preview | Code tab switch instead of the 533px split. Home and started-chat shots at 375, 768, and 1440 live in `docs/assets`.

## Production `pnpm audit --prod` leftovers

`pnpm audit --prod` is **0 critical / 0 high / 0 moderate / 1 low**.

Patched (pnpm overrides): `dompurify` `^3.4.17`, `zod` `^4.6.6`, `body-parser` `^2.4.0`, `undici` `^7.30.1`, `fast-uri` `^3.1.9`, `ip-address` `^10.7.5`, `shell-quote` `^1.11.0`.

Left unpatched on purpose:

| Severity | Package | Ships in prod bundle? | Notes |
|---|---|---|---|
| low | `elliptic` `6.6.1` ([GHSA-848j-6mx2-7j84](https://github.com/advisories/GHSA-848j-6mx2-7j84)) | Yes — client, via `vite-plugin-node-polyfills` → `crypto-browserify` (WebContainer Node shims). | Rechecked 2026-10-28: still the only open Dependabot alert. Advisory patched versions are `<0.0.0` (no real patch). |

GitHub Dependabot previously listed pip alerts on `docs/poetry.lock` (unused upstream MkDocs). That lockfile is gone. See [SECURITY.md](SECURITY.md).

## Playwright Firefox and WebKit (2026-10-31)

CI and `pnpm e2e` stay on Chromium. WebContainer's supported browser is Chromium; Firefox is alpha and Safari/WebKit is beta.

| Browser | `e2e/smoke.spec.ts` | What we saw | Action |
|---|---|---|---|
| Firefox 157 (Playwright) | Failed | `page.goto('/')` hit the 120s test timeout. Vite logged a React hydration mismatch (`server rendered HTML didn't match the client`). | Not cheap. Home SSR vs client theme/clock is Firefox-sensitive. Use Chrome or Edge. |
| WebKit 27.2 (Playwright) | Failed before the loop-panel locator fix; chat and cost pill worked | `DataCloneError: The object can not be cloned` on the Vite client (likely `postMessage` / IndexedDB of a non-cloneable value). The smoke then saw two `status` regions. | Cheap: the loop panel now has `aria-label="Same error, looping"` so the test targets it. The DataCloneError is still open. |

Install locally with `npx playwright install firefox webkit`. Do not add them to the CI matrix until WebContainer and hydration are green.
