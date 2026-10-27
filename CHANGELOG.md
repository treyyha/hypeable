# Changelog

All notable changes to Hypeable are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Upstream bolt.diy notes (before this fork): [docs/upstream-changelog.md](docs/upstream-changelog.md).

## [Unreleased]

## [1.0.0] - YYYY-MM-DD

First numbered public release. Fill the date when the GitHub release is published. Notes: [docs/RELEASE-NOTES-1.0.0.md](docs/RELEASE-NOTES-1.0.0.md).

### Added

- Live cost meter, session and daily caps (estimate, not an invoice)
- Loop breaker after three repeated identical errors
- Plan-first mode
- Pre-deploy security check
- Spend page (`/spend`)
- OpenRouter PKCE connect
- Hosted-mode locks for custom endpoints, MCP, env-key probes, and git proxy
- `/privacy` and `/terms`, linked from the footer and listed in the sitemap
- Branded 404 and error pages, per-route titles, `<html lang="en">`, and a `<noscript>` message
- Scheduled `smoke:live` against hypeable.dev every 6 hours (single "Site down" issue)
- Cost-meter accuracy stub (`docs/COST-ACCURACY.md`) — empty until a real-key comparison is published
- Playwright check that first load of `/`, `/spend`, and a mocked build stay free of console errors and failed requests
- Example-prompt chips that fill the composer instead of sending

### Changed

- Preference cookies (`selectedProvider`, `selectedModel`, `providers`, `cachedPrompt`, `agentMode`, `isDebugEnabled`, `eventLogs`) moved to `localStorage`. Leftover cookies are migrated once and deleted.
- README Status section: tested vs experimental vs unverified cost-meter accuracy
- Hosted first load no longer calls `/api/configured-providers` or `/api/check-env-key`
- Plugin marketplace tab hidden (unvetted third-party content)
- Settings no longer offers a "Main Branch Updates" toggle
- `/privacy` and `/terms` now render in the HTML (no empty client-only shell)

## [0.1.0] - 2026-10-27

First public snapshot of Hypeable, a [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) (MIT) fork. Bring your own API key. Hypeable hosts nothing.

### Added

- Live cost meter, session and daily caps
- Loop breaker after three repeated identical errors
- Plan-first mode
- Pre-deploy security check
- Spend page (`/spend`)
- OpenRouter PKCE connect
- Hosted-mode locks for custom endpoints, MCP, env-key probes, and git proxy

[Unreleased]: https://github.com/treyyha/hypeable/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/treyyha/hypeable/releases/tag/v1.0.0
[0.1.0]: https://github.com/treyyha/hypeable/releases/tag/v0.1.0
