# User-facing errors

Copy lives in `app/lib/errors/user-facing.ts`. The chat never shows a stack trace.

| What you hit | Title |
|---|---|
| No key in the browser | Add an API key |
| Provider 401 | That key was rejected |
| Provider 402 / no credit | No credit left |
| 429 (provider or hosted) | Too many requests |
| 413, chat body over the 2 MB cap ([LIMITS.md](LIMITS.md)) | This chat is too big to send |
| 5xx or timeout | The provider did not respond / stopped responding |
| `navigator.onLine === false` | You look offline |
| Session or daily cost cap | Cap reached (existing cost modal) |
| Same error three times | Same error, looping |
| Not Chromium, or no cross-origin isolation | Use Chrome or Edge… |

WebContainer support (https://webcontainers.io/guides/browser-support, October 2026): Chromium (Chrome, Edge, Brave, …) is full. Firefox is alpha. Safari 16.4+ is beta. Embedding arbitrary preview resources needs Chromium, so Hypeable asks for Chrome or Edge.

E2E: `e2e/errors.spec.ts` mocks `/api/chat` for 401, 402, 429, 503, plus offline, no key, cost cap, loop, and the browser banner.
