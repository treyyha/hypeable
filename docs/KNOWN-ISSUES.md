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

## Local 5s timeouts (3)

These import a full LLM route and talk to a local mock (or fail before one is listening). Vitest's default 5s budget is tight on a loaded Windows machine; they usually pass on retry.

7. `app/lib/api/request-keys.spec.ts` — `POST /api/llmcall missing key` dynamically imports `~/routes/api.llmcall`. Route module graph + Cloudflare-shaped context can exceed 5s before the 401 is asserted.
8. `app/lib/.server/llm/api-chat.integration.spec.ts` — streams `POST /api/chat` against `scripts/dev/mock-openai.mjs`. Startup of the mock + the chat action can miss 5s.
9. `app/lib/.server/llm/mock-openai-stream.spec.ts` — same mock server path through `POST /api/llmcall` with a fake `x-hypeable-key`.

Do not treat a 5s timeout here as a key-leak regression; re-run the file. Do not add more known-failing tests.

## Logger null (fixed)

`app/utils/logger.spec.ts` `should handle null and undefined as strings` used to throw `TypeError: Cannot read properties of undefined (reading 'replace')` in `app/lib/security/redact.ts` because `JSON.stringify(undefined)` is not a string. `redactUnknown` now stringifies `null` / `undefined` first. Keep it off this list unless it regresses.

## Production `pnpm audit --prod` leftovers

Only critical/high issues with a patch or minor fix were applied; no major bumps. After those batches, **0 critical / 0 high** remain in production.

Patched (pnpm overrides, patch-level):

- `dompurify` `3.4.16` → `^3.4.17` (critical + high)
- `zod` `4.6.5` → `^4.6.6` (high; lockfile resolved `4.6.7`)
- `body-parser` `2.3.0` → `^2.4.0` (high)
- `undici` `7.30.0` → `^7.30.1` (high). The override pins every `undici` to `^7.30.1`. Two **dev-only** dependents want a different major (`jsdom` wants `^8`, `node-gyp` wants `^6`); they stay on the overridden 7.x until a non-breaking path exists. Production code does not use those packages.

Left unpatched on purpose (moderate/low, or no non-major fix):

| Severity | Package | Current | Notes |
|---|---|---|---|
| moderate | `ip-address` | `10.7.3` | patch exists at `10.7.4`; skipped because it is not critical/high |
| moderate | `fast-uri` | `3.1.8` | patch exists at `3.1.9`; skipped because it is not critical/high |
| low | `fast-uri` | `3.1.8` | same as above (additional low advisories) |
| low | `elliptic` | `6.6.1` | advisory lists patched versions as `<0.0.0` (no real patch) |

GitHub Dependabot still reports more alerts than `pnpm audit --prod` because it includes devDependencies (Electron, etc.). Those are out of scope for this pass.
