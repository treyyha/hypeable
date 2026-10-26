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

Deterministic unit coverage of the same monitors stays blocking: `tests/unit/frame-rate-monitor.test.ts` (fake timers), `tests/unit/performance-monitor.test.ts`.

## Docs screenshots (opt-in)

`e2e/docs-screenshots.spec.ts` is skipped unless `CAPTURE_DOCS=1`. That is a capture helper, not a product test. `pnpm e2e` still runs smoke, spend, predeploy, OpenRouter connect, and home presentation.

## Started chat is not mobile-friendly (533px min width)

Once a chat has started, the transcript column uses `--chat-min-width: 533px` (`app/styles/variables.scss`, applied as `lg:min-w-[var(--chat-min-width)]` in `app/components/chat/BaseChat.tsx`). Home/empty states were designed down to 390px; the started-chat + workbench shell was not. Do not treat a squeezed started-chat layout under 533px as a regression of the home screenshots.

## Production `pnpm audit --prod` leftovers

`pnpm audit --prod` is **0 critical / 0 high / 0 moderate / 1 low**.

Patched (pnpm overrides): `dompurify` `^3.4.17`, `zod` `^4.6.6`, `body-parser` `^2.4.0`, `undici` `^7.30.1`, `fast-uri` `^3.1.9`, `ip-address` `^10.7.5`, `shell-quote` `^1.11.0`.

Left unpatched on purpose:

| Severity | Package | Ships in prod bundle? | Notes |
|---|---|---|---|
| low | `elliptic` `6.6.1` | Yes — client, via `vite-plugin-node-polyfills` → `crypto-browserify` (WebContainer Node shims). | Advisory patched versions are `<0.0.0` (no real patch). |

GitHub Dependabot previously listed pip alerts on `docs/poetry.lock` (unused upstream MkDocs). That lockfile is gone. See [SECURITY.md](SECURITY.md).
