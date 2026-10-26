# Design

Hypeable is dark-first. Tokens live in **one place**: [`app/styles/tokens.scss`](../app/styles/tokens.scss). Existing `--bolt-elements-*` variables map onto those tokens so the rest of the app recolours without renaming internals.

## Tokens

| Token | Dark | Light |
|---|---|---|
| `--hype-bg` | `#0A0A0F` | `#FAFAF7` |
| `--hype-surface` | `#111118` | `#FFFFFF` |
| `--hype-surface-2` | `#17171F` | `#F3F3EE` |
| `--hype-border` | `#24242E` | `#E6E6DF` |
| `--hype-text` | `#F5F5F7` | `#0A0A0F` |
| `--hype-muted` | `#9A9AA6` | `#5C5C66` |
| `--hype-accent` | lime fill `#C8FF3D` | lime fill `#C8FF3D` |
| `--hype-accent-text` | lime | `#4D7A00` |
| `--hype-on-accent` | `#0A0A0F` | `#0A0A0F` |
| `--hype-ok` / `--hype-warn` / `--hype-danger` | lime / `#FFB020` / `#FF5A5F` | `#4D7A00` / warn / danger |

Also: radii 8 / 12 / 18 / 999, a 4px spacing scale, shadows, motion durations, and a type scale. Font is **Geist Sans + Geist Mono**, self-hosted via `@fontsource`. Money always uses `tabular-nums`.

Uno classes: `bg-hype-bg`, `text-hype-text`, `border-hype-border`, `bg-hype-accent`, `text-hype-on-accent`, `text-hype-accent-text`, `bg-hype-ok`, `bg-hype-warn`, `bg-hype-danger`.

## Gradient rules

**Do**

- Aurora: full-bleed layered CSS radial-gradients (lime, mint, cyan) behind the empty home column only, fading out once a chat starts. Slow drift, off under `prefers-reduced-motion`. No background box on the heading.
- At most one gradient word in a heading (`hype-gradient-text`).
- Composer: subtle lime→mint→cyan focus ring (`.hype-composer:focus-within`).

**Don't**

- Gradient fills on buttons, logos, status, cards, or the workbench.
- Images or heavy `blur()` filters for atmosphere.
- Lime text on white. On light, accent *text* is `#4D7A00`; lime is a fill with dark text.
- Imitate other products' branding.

Logo stays **flat lime**. Buttons are solid single colours. Status never uses the gradient.

## Components

Shared primitives in `app/components/ui/`: `Button` (primary / ghost / danger), `Card`, `Chip`, `Badge`, `Progress`, `Tabs`, `Dialog` (modal), toast (react-toastify themed from tokens), `EmptyState`, `LoadingState`, `ErrorState`.

Plan Card, loop panel, cap modal, cost popover, settings, and onboarding consume those tokens. Empty states are honest — no fake charts or placeholder spend.

## Quality

AA contrast on both themes, visible `:focus-visible` rings, keyboard navigation, usable down to 390px, reduced motion respected.

## Screenshots

- Home dark desktop: [assets/home-dark-1440.png](assets/home-dark-1440.png)
- Home light desktop: [assets/home-light-1440.png](assets/home-light-1440.png)
- Home dark mobile: [assets/home-dark-390.png](assets/home-dark-390.png)
- Home light mobile: [assets/home-light-390.png](assets/home-light-390.png)
- Spend dark desktop: [assets/spend-dark-1440.png](assets/spend-dark-1440.png)
- Spend light desktop: [assets/spend-light-1440.png](assets/spend-light-1440.png)
- Spend dark mobile: [assets/spend-dark-390.png](assets/spend-dark-390.png)
- Spend light mobile: [assets/spend-light-390.png](assets/spend-light-390.png)
