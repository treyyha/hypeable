# First-load budget

A first-time visitor on `/` should not download the code editor, Shiki grammars, xterm, or WebContainer until they start a build. The first HTML must include the home hero and composer so LCP is not blocked on client JS.

| What | When it loads |
|---|---|
| Home chrome, composer, first-run card, OpenRouter connect | First visit (in the HTML) |
| Chat.client / Workbench | Composer intent (focus, pointerenter, keypress) |
| Menu / ControlPanel | Sidebar or settings intent (hover, focus, or click) |
| `provider-list` | Model picker intent (hover/focus/open), or first send |
| Workbench / CodeMirror UI | Started chat (lazy `Workbench`) |
| Editor / terminal / resize-handle CSS | Workbench chunk |
| Shiki message CSS | Messages chunk |
| Shiki grammars | First highlighted code block after the stream ends |
| xterm CSS | Terminal panel mount |
| WebContainer | First send, or workbench open |

## Budget

`docs/first-load-budget.json` is the blocking check:

```bash
pnpm build
node scripts/check-first-load-budget.mjs
```

CI runs that after `pnpm build`. This app is SSR, so there is no `build/client/index.html`. The checker walks static imports from `entry.client`, `root`, and `_index`. Chat, Menu, the workbench, ControlPanel, and `provider-list` (LLM SDKs) must stay behind `import()`. Dynamic `import()` (Chat.client, Menu.client, Workbench, Shiki, xterm CSS, `@webcontainer/api`) stays out of the graph or the job fails.

Measured on 2026-10-27 after the SSR first-run card and deferring Menu / `provider-list` (gzip level 9):

| | Raw | Gzip |
|---|---|---|
| JS | 945 KiB | 307 KiB |
| CSS | 343 KiB | 62 KiB |
| Files in static graph | 75 | |

Budget is 351 KiB JS gzip / 73 KiB CSS gzip. The empty home no longer static-imports Chat.client, Menu.client, ControlPanel, Workbench, or `provider-list`. The SSR hero and first-run card stay mounted until a build starts. Chat and Workbench prefetch on composer focus, pointerenter, or first keypress; Menu on sidebar/settings intent; `provider-list` on model-picker intent or first send. Hashed `/assets/*` are immutable; HTML stays `no-store`. Production Lighthouse for this path is recorded in [PERFORMANCE.md](PERFORMANCE.md); that pass is closed.

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
