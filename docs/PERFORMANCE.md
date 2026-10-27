# Performance (last pass)

This is the last first-visit performance pass. Do not chase the Lighthouse score further. Numbers are production Lighthouse on `https://hypeable.dev/` `/`, 5-run median, Slow 4G simulation, commit `307d23a1`. First-time visitors (empty `localStorage`) are the measured path.

The first HTML includes the hero and the **Start in 60 seconds** card. Dismissal is `localStorage` only (`bolt_onboarding_completed`). There is no covering dialog, no fake LCP node, and no delayed content.

## Before / after

Before = previous pass, when `FirstRunOnboarding` was a client-only dialog and `provider-list` (161 KiB gzip) downloaded on first view.

| | Mobile before | Mobile after | Desktop before | Desktop after |
|---|---:|---:|---:|---:|
| Performance | 55 | **88** | 89 | 87 |
| LCP | 7.47 s | **2.74 s** | 1.07 s | 1.38 s |
| Speed Index | 7.92 s | **5.86 s** | 3.37 s | **2.55 s** |
| TBT | 452 ms | **60 ms** | 8 ms | **0 ms** |
| CLS | 0.009 | 0.008 | 0.007 | 0.012 |
| FCP | 2.32 s | 2.29 s | 0.99 s | 1.26 s |

Mobile runs: 88, 88, 83, 92, 91. Desktop runs: 92, 91, 87, 87, 87.

`provider-list` is gone from first-view unused JS. Remaining unused JS: `proxy` ~37 KiB, `jszip` ~25 KiB, `entry.client` ~23 KiB, `workbench` store ~21 KiB. Unused CSS: `root` ~50 KiB of ~53 KiB.

## First-load budget (CI, unchanged)

Static graph of `entry.client` + `root` + `_index` (gzip level 9), commit `307d23a1`:

| | Raw | Gzip | Budget |
|---|---:|---:|---:|
| JS | 945 KiB | 307 KiB | 351 KiB |
| CSS | 343 KiB | 62 KiB | 73 KiB |

Do not raise `docs/first-load-budget.json`. Chat, Menu, Workbench, ControlPanel, and `provider-list` stay behind `import()`. See [FIRST-LOAD.md](FIRST-LOAD.md).

## Remaining ceiling (stop here)

- **Desktop 95+ is not honest on this path.** Speed Index is ~2.55 s (Lighthouse desktop p10 is ~1.3 s). The first-run card is real, above-the-fold content every video visitor sees. Hiding it, painting an invisible larger node, or delaying the card would game the metric.
- Best desktop run in this set was 92. Getting to 95 means shrinking SI without removing the card: unused `root` CSS, `jszip` / `proxy` / workbench-store still downloaded, fonts, hydrate of composer chrome.
- **Mobile 88** is the honest high. Slow 4G LCP of the SSR card is ~2.7 s. Further cuts are the same leftover bytes, not another product change.
- Security headers stay as they are: COOP `same-origin`, COEP `credentialless`, enforcing CSP. Do not relax them for a score.

## What loads when

| What | When |
|---|---|
| Hero, first-run card, composer chrome | First HTML |
| Chat.client / Workbench UI | Composer intent or first send |
| Menu / ControlPanel | Sidebar or settings intent |
| `provider-list` (LLM SDKs) | Model picker intent or first send |
| Debug logger | Only if that module is imported (settings / download log) |
