# Testing

How to prove the LLM chain without a real provider key, and what the automated suite covers.

## Unit / integration (Node)

```bash
pnpm test
pnpm run typecheck
pnpm run lint
```

Vitest runs in Node (or jsdom for UI tests). Those paths construct `Request` with undici `Headers`. They do **not** load workerd. A green unit suite is not proof that `pnpm dev` can talk to a model.

## Local OpenAI-compatible mock

```bash
node scripts/dev/mock-openai.mjs
```

Listens on `127.0.0.1:8787`. Accepts any `Authorization` header. Does not log headers. `GET /v1/models` returns `mock-model`. Planning requests (body contains the hypeable-plan instruction) return a `hypeable-plan` fence; other chat requests return a small `boltArtifact`.

Use **`http://127.0.0.1:8787/v1`**, not `localhost`. On Windows `localhost` can resolve to `::1` while the mock binds IPv4, and workerd's outbound fetch will miss.

## Correct OpenAILike setup in the app

OpenAILike needs **both** a fake key and a base URL. The models route returns `[]` if either is missing; `/api/chat` then answers `Invalid or missing API key` (no key) or fails to reach the mock (no base URL).

1. Start the mock (above).
2. Settings → local providers → enable **OpenAILike** → API Endpoint `http://127.0.0.1:8787/v1`.
3. Enter any non-empty key in the OpenAILike key field on the chat composer (Ollama/LM Studio hide this field; OpenAILike does not).
4. Pick provider OpenAILike, model `mock-model`.

The key lives in `localStorage` (`hypeable_api_keys`) and is sent only on LLM routes as `x-hypeable-key`. The base URL is sent as `x-hypeable-providers` (and also copied into the `providers` cookie). See [KEY-FLOW.md](./KEY-FLOW.md).

## Playwright smoke (`pnpm e2e`)

Docs screenshots (skipped unless `CAPTURE_DOCS=1`): `docs/assets/home-*.png`, plan card, loop panel, cost popover.

```bash
pnpm exec playwright install chromium
pnpm e2e
```

Playwright starts the mock on port 8787 and `pnpm run dev` on port 5173. It does **not** reuse those ports — a leftover mock can still return the old non-artifact body. Free 8787 and 5173 before running if a previous run did not exit cleanly.

The test seeds the app's own storage keys, then:

1. Loads `/` and checks COOP/COEP plus the Hypeable header.
2. Sends `make a todo app` and waits for the Plan Card from the real SSE stream.
3. Unticks the optional feature, clicks **Approve & build**, waits for a `boltArtifact`.
4. Asserts the cost pill is above `$0.000` (`mock-model` has a custom price in the seed).
5. Visits `/?debugLoop=1` and asserts the loop panel (dev bundle only).
6. Asserts the fake key never appears in console output or response bodies, and `/api/chat` sends `Cache-Control: no-store`.

It does **not** assert that the WebContainer preview boots. That preview fetches `*.webcontainer-api.io` and needs external network.

## Production build (`pnpm e2e:preview`)

`pnpm start` / `pnpm preview` is `vite preview` with the Cloudflare Vite plugin, so it **does** run the workerd production bundle locally (not a static-only file server).

```bash
pnpm e2e:preview
```

That builds, then serves `vite preview` on 5173 plus the mock. `?debugLoop=1` is skipped: the debug helper is stripped from the production client. WebContainer preview is still not asserted.

## CI

`.github/workflows/ci.yml` has an `e2e` job that installs Chromium (cached under `~/.cache/ms-playwright`) and runs `pnpm e2e`. It is `continue-on-error: true` until the smoke is proven stable.

Local `@cloudflare/vite-plugin` (`pnpm dev` and `vite preview`) lets workerd fetch `127.0.0.1`. A Worker on Cloudflare's edge cannot; the loopback mock only proves the local workerd path.

## What still needs a real key

- Live calls to OpenAI / Anthropic / OpenRouter / etc.
- WebContainer boot and the in-browser preview iframe.
- Connector OAuth (GitHub, Vercel, Netlify, Supabase).
- A deployed Worker talking to a **public** OpenAI-compatible endpoint (edge `fetch` cannot reach loopback).
