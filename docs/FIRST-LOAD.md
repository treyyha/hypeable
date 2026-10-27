# First-load budget

A first-time visitor on `/` should not download the code editor, Shiki grammars, xterm, or WebContainer until they start a build. The first HTML must include the home hero and composer so LCP is not blocked on client JS.

| What | When it loads |
|---|---|
| Home chrome, composer, OpenRouter connect | First visit |
| Workbench / CodeMirror | Started chat (lazy `Workbench`) |
| Shiki grammars | First highlighted code block after the stream ends |
| xterm CSS | Terminal panel mount |
| WebContainer | First send, or workbench open |

## Budget

`docs/first-load-budget.json` is the blocking check:

```bash
pnpm build
node scripts/check-first-load-budget.mjs
```

CI runs that after `pnpm build`. This app is SSR, so there is no `build/client/index.html`. The checker walks static imports from `entry.client`, `root`, and `_index`. Chat, the sidebar, the workbench, ControlPanel, and `provider-list` (LLM SDKs) must stay behind `import()`. Dynamic `import()` (Chat.client, Workbench, Shiki, xterm CSS, `@webcontainer/api`) stays out of the graph or the job fails.

Measured on 2026-10-27 after code-splitting Chat/Menu/LLM SDKs off `/` (gzip level 9):

| | Raw | Gzip |
|---|---|---|
| JS | 938 KiB | 304 KiB |
| CSS | 391 KiB | 90 KiB |
| Files in static graph | 72 | |

Budget is still 1250 KiB JS gzip / 120 KiB CSS gzip until the unused-CSS pass; then CI will lower it. The empty home no longer static-imports Chat.client, ControlPanel, Workbench, or `provider-list`. Idle/composer-focus prefetch warms those chunks so the first build is not a cold import.

Throttled Fast 4G (Chrome DevTools: 9 Mbps down, 1.5 Mbps up, 170 ms RTT) against local `pnpm start` on 2026-10-27:

| | |
|---|---|
| Wall clock to `networkidle` | 7.7 s |
| Navigation duration | 4.3 s |
| Requests | 78 |
| Transfer (preview is uncompressed) | 6.4 MiB |

`vite preview` does not gzip. Production on Cloudflare does. Use the gzip column above for CDN-sized JS/CSS. Re-run with:

```bash
pnpm start
node scripts/measure-first-load.mjs http://localhost:5173/
```
