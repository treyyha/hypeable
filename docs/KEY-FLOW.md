# API key flow

Where a user's BYO model key lives, how it reaches a provider, and where it could have been logged. Line numbers refer to `main` after the cookie removal.

## Client storage

Keys are **not** stored in a cookie. Cookies attach to every same-origin request, including static assets.

| Location | When |
|---|---|
| `localStorage` key `hypeable_api_keys` | Default |
| `sessionStorage` key `hypeable_api_keys` | "Forget keys when I close the tab" (`hypeable_api_keys_forget=1` in sessionStorage) |

Implementation: `app/lib/api/api-key-storage.ts`.

- Read: `readStoredApiKeys()` (`app/lib/api/api-key-storage.ts` ~64)
- Write: `writeStoredApiKeys()` (`app/lib/api/api-key-storage.ts` ~74) from `APIKeyManager` (~69), `BaseChat` (~238), `FirstRunOnboarding` (~109)
- Migration: `migrateApiKeysFromCookie()` (~132). On load, if the old `apiKeys` cookie exists, it is copied into web storage and the cookie is deleted.

## Client → our server

The key is sent **only** on LLM routes, per request, in `x-hypeable-key` (URI-encoded JSON `{ "OpenAI": "…" }`). OpenAILike also needs its base URL on those same requests: `x-hypeable-providers` (URI-encoded JSON `{ "OpenAILike": { "enabled": true, "baseUrl": "http://127.0.0.1:8787/v1" } }`). The `providers` cookie is a fallback; it is written from a React effect and can miss the first `/api/models` fetch.

Connector tokens (GitHub, GitLab, Vercel, Netlify, Supabase) take the same hop: stored in the browser, sent over HTTPS for the request (Authorization or JSON body), never stored or logged. They are **not** cookies. See `app/lib/api/connector-tokens.ts`. Direct browser-to-provider calls (where CORS allows) are on `docs/ROADMAP.md`.

| Route | Client | Header attached |
|---|---|---|
| `POST /api/chat` | `Chat.client.tsx` `DefaultChatTransport.headers` (~266) | `getLlmRequestHeaders()` (`x-hypeable-key` + `x-hypeable-providers`) |
| `POST /api/llmcall` | (internal / programmatic) | same headers |
| `POST /api/enhancer` | `usePromptEnhancer.ts` `llmFetch` (~33) | `llmFetch` |
| `GET /api/models` and `GET /api/models/:provider` | `BaseChat.tsx` `llmFetch` (~220, ~245, ~266) | `llmFetch` — OpenAILike lists models only when **both** the key and the base URL are present |

The chat JSON body no longer includes `apiKeys`. If a client still sends that field, `chatRequestSchema` drops it (`app/lib/.server/api/schemas.ts`).

`/api/check-env-key` reports **server env** keys only. `/api/export-api-keys` returns 410; export is a client-side read of web storage.

## Server: used once, never persisted

`getApiKeysFromRequest()` (`app/lib/api/request-keys.ts`) reads `x-hypeable-key`, then a body `apiKeys` field. **It never reads the `apiKeys` cookie.** Header lookup is case-insensitive and accepts either URI-encoded JSON or already-decoded JSON (workerd vs Node Headers).

`getProviderSettingsFromRequest()` (`app/lib/api/provider-settings.ts`) reads `x-hypeable-providers`, then the `providers` cookie. OpenAILike's Settings tab and onboarding still persist the base URL in `localStorage` key `provider_settings`; `llmFetch` copies that onto the header at request time.

Called from:

- `app/routes/api.chat.ts` ~89
- `app/routes/api.llmcall.ts` ~106
- `app/routes/api.enhancer.ts` ~37
- `app/routes/api.models.ts` ~51

The map is passed into `streamText` → `provider.getModelInstance()` → `getProviderBaseUrlAndKey()` (`app/lib/modules/llm/base-provider.ts` ~97–98), which picks `apiKeys[providerName]` or a server env var. That value is used as `Authorization: Bearer …` (or the provider's equivalent) on the **single outbound call to the user's chosen provider**. It is not written to disk, cookies, or a database.

LLM responses set `Cache-Control: no-store` (`LLM_NO_STORE_HEADERS` in `request-keys.ts`; applied by `withSecurity` for LLM paths and by `toApiErrorResponse`).

## Log and error paths (must not print the key)

| Path | File | What happens |
|---|---|---|
| App logger | `app/utils/logger.ts` ~5, ~61 | `installSafeConsole()` + `redactUnknown()` on every message |
| `console.*` on the server | `app/lib/security/redact.ts` ~47 | Patched at module load when `window` is undefined |
| Route wrapper | `app/lib/security.ts` ~5, ~348 | `console.error` redacted; error JSON is a generic message, never headers/cookies/body |
| LLM error responses | `app/lib/.server/api/errors.ts` `toApiErrorResponse` | Fixed client-safe strings; `Cache-Control: no-store` |
| SSR render errors | `app/entry.server.tsx` ~15 | `redactUnknown(error)` |
| Provider credential failures | `toMissingCredentialError` | Logs `Provider credential error` without the provider's diagnostic |

Redaction patterns (`app/lib/security/redact.ts`): `sk-ant-…`, `sk-…`, GitHub `gh*_…`, `Bearer …`, `x-hypeable-key` / `x-api-key` / `authorization` dumps, `apiKeys=` / `githubToken=` / other connector-token cookie blobs.

## What we do not do

- We do **not** send the LLM key or a connector token from the browser straight to the provider. There is a server hop. Direct browser-to-provider (CORS) is on `docs/ROADMAP.md`.
