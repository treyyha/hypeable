# Known issues

## Policy

Fix or delete the items below **before v1.0**. Do not add more known-failing tests. CI keeps gitleaks, typecheck, and lint blocking; the test step is `continue-on-error` until this list is empty.

## Upstream tests that fail (6)

### Frame-budget performance (4)

These assert a 16.67ms (60fps) wall-clock budget against `render()` in jsdom. That is not a browser frame; they flake or fail under CI load even when they pass on a quiet local machine.

1. `tests/performance/core-journeys.perf.test.tsx` — `streaming message updates stay within frame budget`
2. `tests/performance/streaming-performance.perf.test.tsx` — `maintains 60fps during simple text streaming`
3. `tests/performance/streaming-performance.perf.test.tsx` — `handles code block streaming efficiently`
4. `tests/performance/streaming-performance.perf.test.tsx` — `handles mixed content (text + code + lists)`

### Chat-history timeout (1)

5. `app/lib/persistence/useChatHistory.spec.tsx` — at least one `waitFor` case times out under CI (IndexedDB mock / chat-switch handoff). The file can pass locally.

### Workbench mock `getFile` (1)

6. `app/lib/stores/workbench-lifecycle.spec.ts` — `keeps Preview selected while incoming file actions stream`. The `FilesStore` mock does not implement `getFile`, so `_runAction` throws `TypeError: this[#filesStore].getFile is not a function` (`app/lib/stores/workbench.ts` around the imported-project file registration).

### Shiki timing flake

`tests/performance/syntax-highlighting.perf.test.ts` asserts wall-clock budgets (`< 600ms` small, `< 1000ms` large, `< 200ms` for 10 incremental highlights). Under CI load `createHighlighter()` / `codeToHtml()` can exceed those budgets even when highlighting is correct. `tests/unit/syntax-highlighter-client.test.ts` can also flake if the worker is slow to start. Do not treat a timing miss as a highlighter regression.

## Started chat is not mobile-friendly (533px min width)

Once a chat has started, the transcript column uses `--chat-min-width: 533px` (`app/styles/variables.scss`, applied as `lg:min-w-[var(--chat-min-width)]` in `app/components/chat/BaseChat.tsx`). Home/empty states were designed down to 390px; the started-chat + workbench shell was not. Do not treat a squeezed started-chat layout under 533px as a regression of the home screenshots.

## Logger null (fixed)

`app/utils/logger.spec.ts` `should handle null and undefined as strings` used to throw `TypeError: Cannot read properties of undefined (reading 'replace')` in `app/lib/security/redact.ts` because `JSON.stringify(undefined)` is not a string. `redactUnknown` now stringifies `null` / `undefined` first. Keep it off this list unless it regresses.

## Production `pnpm audit --prod` leftovers

`pnpm audit --prod` is **0 critical / 0 high / 0 moderate / 1 low**.

Patched (pnpm overrides): `dompurify` `^3.4.17`, `zod` `^4.6.6`, `body-parser` `^2.4.0`, `undici` `^7.30.1`, `fast-uri` `^3.1.9`, `ip-address` `^10.7.5`, `shell-quote` `^1.11.0`.

Left unpatched on purpose:

| Severity | Package | Ships in prod bundle? | Notes |
|---|---|---|---|
| low | `elliptic` `6.6.1` | Yes — client, via `vite-plugin-node-polyfills` → `crypto-browserify` (WebContainer Node shims). | Advisory patched versions are `<0.0.0` (no real patch). |

GitHub Dependabot also lists pip alerts on `docs/poetry.lock` (upstream MkDocs). Those packages are **not** in the Workers/client production bundle. See [SECURITY.md](SECURITY.md).
