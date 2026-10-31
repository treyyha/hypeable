# Request limits

`POST /api/chat` is validated before any provider call (`app/lib/.server/api/schemas.ts`, `readJsonBody`).

## Chat body cap: 2 MiB

The client re-sends the file map and the full conversation on every turn. A 413 is a clean JSON error (`payload_too_large`); the chat maps it to "This chat is too big to send".

| Body | Size | How |
|---|---|---|
| Largest `/api/chat` body in the e2e flows | 3,284 bytes (4 chat POSTs; next largest 959) | `HYPE_BODY_SIZE` log on `pnpm e2e`, 31 Oct 2026 |
| New 15-file app, 1 turn | ~75 KB | `app/lib/.server/api/chat-body-fixture.ts` |
| 60 files × 4 KB, 25 turns | ~565 KB | same |
| Same + one 500 KB screenshot | ~1.2 MB | same |
| 60 files, 60 turns | ~1.0 MB | same |
| Cap | **2,097,152 bytes** | `REQUEST_LIMITS.MAX_CHAT_BODY_BYTES` |

Headroom: a long session with a screenshot still fits; a second large image or a much bigger file map does not. The previous 16 MiB ceiling let a single request occupy most of a Worker isolate for JSON parse + Zod with no product need.

`chatRequestSchema` is **strict** at the top level and on `supabase`, `connectorEnabled`, and `plugins`. Client-sent `userId`, `role`, `plan`, `price`, `system`, or `model` is a 400. Messages and parts stay loose so an SDK part-type bump does not reject a live conversation. `apiKeys` in the body is still accepted and stripped (keys belong in `x-hypeable-key`).

## Worker CPU near the cap

Median over 40 Node runs of `readJsonBody` + `parseBody(chatRequestSchema)` (`tests/performance/chat-body-cpu.perf.test.ts`):

| Body | CPU / request | Wall / request |
|---|---|---|
| 0.29 MiB | 2.8 ms | 1.2 ms |
| 0.49 MiB | 2.3 ms | 1.9 ms |
| 1.00 MiB | 5.9 ms | 3.8 ms |
| 1.49 MiB | 11.3 ms | 5.4 ms |
| 1.94 MiB | 15.6 ms | 6.9 ms |

This is isolate CPU before the model call. A 2 MiB cap keeps that well under the Workers CPU budget (10 ms / 50 ms on Free / Paid for an unawaited isolate, plus I/O wait for the provider).

## Which routes are dynamic Worker invocations

The production Worker (`workers/app.ts`) is the fallback after static assets. Cloudflare serves hashed `/assets/*`, `favicon*`, `og.png`, `robots.txt`, `llms.txt`, `sitemap.xml`, `site.webmanifest`, and `/.well-known/*` from `build/client` without a Worker isolate when the file exists.

Every HTML document still runs the Worker: `root.tsx` has a loader that sets `hosted` from the request host, and `app/entry.server.tsx` streams HTML with a per-request CSP nonce. These cannot become static assets without dropping that:

- `/`, `/chat/:id`, `/spend`, `/privacy`, `/terms`, `/git`, `/starter`, `/webcontainer/preview/:id`, branded 404

Every `/api/*` request is a Worker invocation. None of those can be static.

`/webcontainer/connect/:id` is a Worker 404 (route exists so the URL is not a static miss).

No HTML route was moved to static assets: the hosted flag and the nonce require the isolate.

## 30-minute mocked-build heap (31 Oct 2026)

`tests/performance/heap-builds.perf.test.ts` parsed a ~256 KB chat body, reduced a loop-breaker alert, and recorded cost (8 rotating message ids) every 200 ms for 30 minutes. Samples: `docs/heap-mocked-builds.json`.

| | Start (after warmup, 0.5 min) | End (30 min) | Delta |
|---|---|---|---|
| Turns | 150 | 8,421 | +8,271 |
| `heapUsed` | 63 MB | 170 MB | +107 MB peak-to-end; floor stayed ~63–95 MB with GC sawtooth to 214 MB |
| RSS | 132 MB | 319 MB | +187 MB; one GC drop to 184 MB at 28 min |

I could not prove a product leak: the heap floor rose ~20–30 MB over half an hour, consistent with V8 fragmentation on repeated Zod parse of the same 256 KB JSON, not an unbounded store (message ids rotate). No fix shipped from this run. A browser/WebContainer session was not measured (would need a 30 min headed smoke).
