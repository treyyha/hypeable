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

CI runs that after `pnpm build`. It fails if the JS or CSS referenced from `build/client/index.html` exceeds the gzip byte caps.

Throttled Fast 4G wall-clock is recorded in the task report, not in CI (network is not deterministic).
