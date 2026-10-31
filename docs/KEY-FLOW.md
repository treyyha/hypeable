# API key flow

Where a user's BYO model key lives, how it reaches a provider, and where it could have been logged. Line numbers refer to `main` after the cookie removal.

No accounts and no database. In hosted mode, requests are relayed through our Cloudflare Worker to the provider you choose; we do not store or log prompts, keys or code, and observability is off. Run Hypeable locally to skip our relay. Your provider's own data policy applies to what you send them. Cloudflare, as our host, handles request metadata and sees traffic in transit. After the first build, the in-browser runtime (WebContainer) and preview frames load from StackBlitz-hosted domains. We have not audited what StackBlitz sees.

## Connect with OpenRouter (PKCE)

One-click alternative to pasting a key. Protocol: [OpenRouter OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth) (verified 2026-10-26).

1. The browser generates a PKCE verifier (`crypto.getRandomValues`, 32 bytes, base64url) and an anti-CSRF `state`. Both sit in **sessionStorage only**.
2. The user is redirected to `https://openrouter.ai/auth` with `callback_url=<origin>/auth/openrouter/callback`, `code_challenge` (S256), `code_challenge_method=S256`, `state`, and `key_label=Hypeable`. Local runs use `http://localhost` callbacks, which OpenRouter allows on any port.
3. `/auth/openrouter/callback` stashes `code` / `state` and immediately `history.replaceState`s them out of the URL (inline script in `app/root.tsx`, before React). It checks `state`, then POSTs `{ code, code_verifier, code_challenge_method: "S256" }` from the **browser** to `https://openrouter.ai/api/v1/auth/keys`. OpenRouter's CORS on that endpoint is `Access-Control-Allow-Origin: *`, so Hypeable's server never sees the code or the minted key.
4. On success the key is written with `writeStoredApiKeys()` under provider `OpenRouter` — the same store as a pasted key — selected provider/model are written to `localStorage` (`hypeable:pref:selectedProvider` / `hypeable:pref:selectedModel`) as OpenRouter / `z-ai/glm-5.3-flash`, and a toast confirms it. Failure shows a plain error and the paste fallback. Disconnect removes the key from this browser; revoke the key on [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).

The user pays OpenRouter directly. Hypeable never sees their card. The minted key is written only in this browser; hosted **model** requests after that still relay through our Worker.

## Client storage

Keys are **not** stored in a cookie. Cookies attach to every same-origin request, including static assets. Preference state is not a cookie either.

| Location | When |
|---|---|
| `localStorage` key `hypeable_api_keys` | Default |
| `sessionStorage` key `hypeable_api_keys` | "Forget keys when I close the tab" (`hypeable_api_keys_forget=1` in sessionStorage) |
| `localStorage` `hypeable:pref:*` | Selected provider/model, agent mode, composer draft, debug flag (`app/lib/api/prefs-storage.ts`) |
| `localStorage` `hypeable:eventLogs` | In-app event log (never a cookie; logs can contain user text) |
| `localStorage` `provider_settings` | Enabled providers and OpenAILike/Ollama/LM Studio base URLs |

Implementation: `app/lib/api/api-key-storage.ts`, `app/lib/api/prefs-storage.ts`.

- Read: `readStoredApiKeys()` (`app/lib/api/api-key-storage.ts` ~69)
- Write: `writeStoredApiKeys()` (`app/lib/api/api-key-storage.ts` ~79) from `APIKeyManager`, `BaseChat`, and OpenRouter PKCE success (`app/lib/openrouter/connect.ts`)
- Key migration: `migrateApiKeysFromCookie()` (~144). On load, if the old `apiKeys` cookie exists, it is copied into web storage and the cookie is deleted.
- Pref migration: `migrateLegacyPrefCookies()` (`app/lib/api/prefs-storage.ts`), called from `app/entry.client.tsx`. Leftover `selectedProvider`, `selectedModel`, `providers`, `cachedPrompt`, `agentMode`, `isDebugEnabled`, `eventLogs`, and `tabConfiguration` cookies are copied into localStorage (storage wins if both exist) and deleted.

Hypeable sets **no** first-party preference cookies. Cloudflare may set its own cookies to deliver the page. Proved by `e2e/cookies.spec.ts` (fails if any remaining cookie value contains a composer draft, a secret-pattern match, a JWT, or an OAuth `code=`).

## Client → our server

The key is sent **only** on LLM routes, per request, in `x-hypeable-key` (URI-encoded JSON `{ "OpenAI": "…" }`). OpenAILike also needs its base URL on those same requests: `x-hypeable-providers` (URI-encoded JSON `{ "OpenAILike": { "enabled": true, "baseUrl": "http://127.0.0.1:8787/v1" } }`). We no longer write a `providers` cookie. A leftover cookie is still read as a one-release fallback, then deleted on the next visit.

Connector tokens (GitHub, GitLab, Vercel, Netlify, Supabase) are stored in the browser, sent over HTTPS for the request (Authorization or JSON body). We do not store or log them, and they are **never** read from server env. They are **not** cookies. See `app/lib/api/connector-tokens.ts`.

| Connector | How publish travels |
|---|---|
| GitHub / GitLab publish | Browser → `api.github.com` / GitLab API (CORS). Pre-deploy modal in the UI first. |
| Vercel / Netlify publish | Browser → `/api/vercel-deploy` or `/api/netlify-deploy` (user token in the body) → provider. Server re-scans files. Site/project is created **in the user's account**. |
| Supabase | Browser → `/api/supabase*` with the user's management token. Not a static-host publish. There is no keyless or environment-token activation and no `/api/supabase-user` route; the user must paste a token. |

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

`getProviderSettingsFromRequest()` (`app/lib/api/provider-settings.ts`) reads `x-hypeable-providers`, then a leftover `providers` cookie if the header is absent. OpenAILike's Settings tab and onboarding persist the base URL in `localStorage` key `provider_settings`; `llmFetch` copies that onto the header at request time.

Called from:

- `app/routes/api.chat.ts` ~89
- `app/routes/api.llmcall.ts` ~106
- `app/routes/api.enhancer.ts` ~37
- `app/routes/api.models.ts` ~51

The map is passed into `streamText` → `provider.getModelInstance()` → `getProviderBaseUrlAndKey()` (`app/lib/modules/llm/base-provider.ts`). On **hosted**, that helper uses only `apiKeys[providerName]` from the request — it does **not** fall back to Worker or `process.env` operator keys. Self-hosted still may. That value is used as `Authorization: Bearer …` (or the provider's equivalent) on the **single outbound call to the user's chosen provider**. It is not written to disk, cookies, or a database.

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

Redaction patterns (`app/lib/security/redact.ts`): `sk-ant-…`, `sk-or-…`, `sk-…`, GitHub `gh*_…`, `Bearer …`, `x-hypeable-key` / `x-api-key` / `authorization` dumps, `apiKeys=` / `githubToken=` / other connector-token cookie blobs.

## What we do not do

- We do **not** store connector tokens on the server or fall back to an operator `VERCEL_TOKEN` / `GITHUB_TOKEN`.
- GitHub and GitLab publish send the user's token from the browser to GitHub/GitLab (CORS; our Worker is not on that path). Vercel and Netlify publish take a one-shot proxy hop so the server can scan files.
