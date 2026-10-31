# Notice
Hypeable is a fork of [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) (MIT, (c) StackBlitz and contributors). The original license text must be kept in `LICENSE`.
Hypeable is an independent project and is not affiliated with or endorsed by Lovable, Bolt, or StackBlitz.

## Design reference

`design-reference/` (gitignored) is a copy of [kokonutUI](https://github.com/kokonut-labs/kokonutui) used as a visual and structural reference. The **source repo** license is MIT (SPDX MIT; `gh api repos/kokonut-labs/kokonutui/license`, 2026-10-26). Hypeable ports layout patterns (stat cards, list rows, action rows, progress cards, sidebar section labels) into `app/components/ui/` and the Spend page, restyled to Hypeable tokens and UnoCSS. Template fonts and logos were not copied. Each ported file carries a header comment. The kokonutUI MIT text follows.

MIT License

Copyright (c) 2025 kokonutUI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Bundled fonts

Hypeable self-hosts **Geist Sans** and **Geist Mono** (via `@fontsource/geist-sans` and `@fontsource/geist-mono`) and serves the font files to every visitor.

- Geist Sans and Geist Mono Font, (C) 2023 Vercel, made in collaboration with basement.studio.
- Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font).

They are licensed under the SIL Open Font License, Version 1.1 ([text](https://openfontlicense.org/open-font-license-official-text/)); the full licence ships in each package's `LICENSE`. The fonts are unmodified and are not sold on their own.

## History note

Obvious placeholder key patterns were redacted from upstream history so GitHub push protection would accept the push. Upstream sync policy: cherry-pick from upstream, don't merge.
