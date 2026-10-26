# First-load budget

A first-time visitor on `/` should not download the code editor, Shiki grammars, xterm, or WebContainer until they start a build.

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

CI runs that after `pnpm build`. This app is SSR, so there is no `build/client/index.html`. The checker walks static imports from `entry.client`, `root`, `_index`, and `Chat.client`. Dynamic `import()` (Workbench, Shiki, xterm CSS, `@webcontainer/api`) stays out of the graph or the job fails.

Measured on 2026-10-27 after the deferral pass (gzip level 9):

| | Raw | Gzip |
|---|---|---|
| JS | 3648 KiB | 1033 KiB |
| CSS | 391 KiB | 90 KiB |
| Files in static graph | 53 | |

Budget is 1250 KiB JS gzip / 120 KiB CSS gzip. Throttled Fast 4G wall-clock is recorded in the task report, not in CI (network is not deterministic).
